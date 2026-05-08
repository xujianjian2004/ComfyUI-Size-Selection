"""
ComfyUI Size Selection Node — Python 后端
==========================================
功能：根据预设分辨率档位和宽高比，输出对齐 8 倍数的宽高整数。
作者：穿山阅海
版本：2.0
"""

import math
from typing import Optional  # Python 3.9 兼容；3.10+ 可用 str | None 语法

# ── 预设分辨率数据 ─────────────────────────────────────────────────────────────
# 结构：{档位名称: {宽高比: (宽, 高)}}
# 按总像素量分四档，所有尺寸均整除 8，横竖比例严格对称
RESOLUTION_DATA = {
    # 标清 SD
    "SD·480P": {
        "3:2": (768, 512),  "2:3": (512,  768),
        "4:3": (512, 384),  "3:4": (384,  512),
        "16:9":(640, 360),  "9:16":(360,  640),
        "21:9":(768, 328),  "9:21":(328,  768),
        "1:1": (512, 512),
    },
    # 高清 HD
    "HD·720P": {
        "3:2": (1152, 768),  "2:3": (768,  1152),
        "4:3": (1024, 768),  "3:4": (768,  1024),
        "16:9":(1280, 720),  "9:16":(720,  1280),
        "21:9":(1280, 544),  "9:21":(544,  1280),
        "1:1": (768,  768),
    },
    # 全高清 FHD
    "FHD·1080P": {
        "3:2": (1536, 1024), "2:3": (1024, 1536),
        "4:3": (1280, 960),  "3:4": (960,  1280),
        "16:9":(1920, 1080), "9:16":(1080, 1920),
        "21:9":(2560, 1080), "9:21":(1080, 2560),
        "1:1": (1024, 1024),
    },
    # 超清 QHD
    "QHD·2K+": {
        "3:2": (2304, 1536), "2:3": (1536, 2304),
        "4:3": (2048, 1536), "3:4": (1536, 2048),
        "16:9":(2560, 1440), "9:16":(1440, 2560),
        "21:9":(3440, 1440), "9:21":(1440, 3440),
        "1:1": (1536, 1536),
    },
}

# 所有合法宽高比完整标签（顺序与前端 ASPECT_PAIRS 保持一致）
# 格式："短键 描述"，calculate_size 中取 split(" ")[0] 查 RESOLUTION_DATA
ASPECT_RATIOS = [
    "3:2 摄影横图", "2:3 海报竖图",
    "4:3 经典横图", "3:4 经典竖图",
    "16:9 壁纸横图", "9:16 手机竖图",
    "21:9 影视横图", "9:21 超长竖图",
    "1:1 正方形图",
]

# Custom 模式输入边界（Preset 模式预设值不受此限制）
MAX_DIMENSION = 2048   # 单边最大像素
MIN_DIMENSION = 256    # 单边最小像素

# Preset 模式下可选输入缺失时的默认回退值
DEFAULT_RES   = "FHD·1080P"
DEFAULT_RATIO = "9:16 手机竖图"


def _r8(v: int) -> int:
    """将数值向下取整到 8 的倍数，保证结果 >= 8。"""
    return max(8, math.floor(v / 8) * 8)


class ComfyUI_Size_Selection:
    """
    尺寸选择节点：
      - Preset 模式：从预设分辨率档位 x 宽高比组合中读取尺寸
      - Custom 模式：使用自定义宽高，自动对齐至 8 的倍数
    输出 width 和 height 两个 INT，可直接接入 EmptyLatentImage 等节点。
    """

    # ComfyUI 菜单分类路径
    CATEGORY    = "⚡️穿山阅海"
    DESCRIPTION = "可自由选择图片尺寸或自定义宽高的可视化节点"

    @classmethod
    def INPUT_TYPES(cls):
        return {
            # 仅 Manual_Mode 为必填；Resolution / Aspect_Ratio 声明为 optional，
            # 是为了让前端在 Custom 模式下物理移除这两个 widget 时后端不报错
            "required": {
                "Manual_Mode": (["off", "on"], {"default": "off"}),
            },
            "optional": {
                "Resolution":    (list(RESOLUTION_DATA.keys()), {"default": DEFAULT_RES}),
                "Aspect_Ratio":  (ASPECT_RATIOS, {"default": DEFAULT_RATIO}),
                "Custom_Width":  ("INT", {"default": MIN_DIMENSION, "min": MIN_DIMENSION, "max": MAX_DIMENSION, "step": 8}),
                "Custom_Height": ("INT", {"default": MAX_DIMENSION, "min": MIN_DIMENSION, "max": MAX_DIMENSION, "step": 8}),
            },
        }

    RETURN_TYPES = ("INT", "INT")
    RETURN_NAMES = ("width", "height")
    FUNCTION     = "calculate_size"
    OUTPUT_NODE  = False

    def calculate_size(
        self,
        Manual_Mode: str = "off",
        Resolution: Optional[str] = None,
        Aspect_Ratio: Optional[str] = None,
        Custom_Width: int = 256,
        Custom_Height: int = 2048,
        **kwargs,
    ) -> tuple[int, int]:
        """根据 Manual_Mode 分支计算并返回 (width, height)，所有尺寸均对齐至 8 的倍数。"""

        if Manual_Mode == "on":
            # Custom 模式：使用用户自定义宽高，夹紧至合法边界后对齐 8
            w = max(MIN_DIMENSION, min(MAX_DIMENSION, Custom_Width))
            h = max(MIN_DIMENSION, min(MAX_DIMENSION, Custom_Height))
            return (_r8(w), _r8(h))

        # Preset 模式：从预设表查找，可选输入缺失时回退到默认值
        if not Resolution:
            Resolution = DEFAULT_RES
        if not Aspect_Ratio:
            Aspect_Ratio = DEFAULT_RATIO

        # 从完整标签提取短键（"9:16 手机竖图" → "9:16"）
        aspect_key = Aspect_Ratio.split(" ")[0] if Aspect_Ratio else DEFAULT_RATIO.split(" ")[0]

        # 参数合法性校验（前端已做过滤，此处作为后端保险）
        if Resolution not in RESOLUTION_DATA:
            raise ValueError(
                "[ComfyUI_Size_Selection] 无效分辨率档位: {!r}。合法值: {}".format(
                    Resolution, list(RESOLUTION_DATA.keys())
                )
            )
        if aspect_key not in RESOLUTION_DATA[Resolution]:
            raise ValueError(
                "[ComfyUI_Size_Selection] 分辨率 {!r} 下无效宽高比: {!r}。合法值: {}".format(
                    Resolution, Aspect_Ratio, list(RESOLUTION_DATA[Resolution].keys())
                )
            )

        w, h = RESOLUTION_DATA[Resolution][aspect_key]
        return (_r8(w), _r8(h))

    @classmethod
    def IS_CHANGED(
        cls,
        Manual_Mode: str = "off",
        Resolution: Optional[str] = None,
        Aspect_Ratio: Optional[str] = None,
        Custom_Width: int = 256,
        Custom_Height: int = 2048,
        **kwargs,
    ) -> tuple[str, Optional[str], Optional[str], int, int]:
        """返回值变化时触发节点重新计算，将所有影响输出的参数打包为元组作为比较键。"""
        return (Manual_Mode, Resolution, Aspect_Ratio, Custom_Width, Custom_Height)
