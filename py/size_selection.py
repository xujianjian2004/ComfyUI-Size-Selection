"""
ComfyUI Size Selection Node — Python 后端
==========================================

功能：根据预设分辨率档位和宽高比，输出对齐 8 倍数的宽高整数。

输入（必填）：
  Manual_Mode   — 模式切换（"off" = 预设模式，"on" = 自定义模式）

输入（可选）：
  Resolution    — 分辨率档位（Draft / Standard / High / Ultra）
  Aspect_Ratio  — 宽高比（共 9 种）
  Custom_Width  — 自定义宽度（仅 Manual_Mode="on" 时生效）
  Custom_Height — 自定义高度（仅 Manual_Mode="on" 时生效）

输出：
  width  (INT) — 目标宽度，已对齐至 8 的倍数
  height (INT) — 目标高度，已对齐至 8 的倍数

注意：
  Resolution 和 Aspect_Ratio 声明为 optional，是为了让前端在
  Custom 模式下从 node.widgets 中物理移除这两个 widget 时，
  后端不会抛出 "Required input is missing" 错误。

作者：穿山阅海
版本：1.0
"""

import math
from typing import Optional

# ── 预设分辨率数据 ─────────────────────────────────────────────────────────────
# 结构：{档位名称: {宽高比: (宽, 高)}}
# 按总像素量分四档，所有尺寸均整除 8，横竖比例严格对称
RESOLUTION_DATA = {
    # Draft — 轻量预览档，适合 SD 1.5 等早期模型（0.15~0.45MP）
    "Draft (0.15~0.45MP)": {
        "21:9": (768,  328),  "16:9": (640,  360),  "3:2": (768, 512),
        "4:3":  (512,  384),  "1:1":  (512,  512),  "3:4": (384, 512),
        "2:3":  (512,  768),  "9:16": (360,  640),  "9:21": (328, 768),
    },
    # Standard — 主流生成档，适合 SD 2.x / SDXL 基础尺寸（0.45~1.0MP）
    "Standard (0.45~1.0MP)": {
        "21:9": (1280, 544),  "16:9": (1280, 720),  "3:2": (1152, 768),
        "4:3":  (800,  600),  "1:1":  (768,  768),  "3:4": (600,  800),
        "2:3":  (768,  1152), "9:16": (720,  1280), "9:21": (544,  1280),
    },
    # High — 高清直出档，适合 SDXL / Flux / SD 3（1.0~3.0MP）
    "High (1.0~3.0MP)": {
        "21:9": (2560, 1080), "16:9": (1920, 1080), "3:2": (1536, 1024),
        "4:3":  (1280, 960),  "1:1":  (1024, 1024), "3:4": (960,  1280),
        "2:3":  (1024, 1536), "9:16": (1080, 1920), "9:21": (1080, 2560),
    },
    # Ultra — 超高清档，适合高清放大 / Hi-Res Fix 后处理（3.0~5.0MP）
    "Ultra (3.0~5.0MP)": {
        "21:9": (3440, 1440), "16:9": (2560, 1440), "3:2": (2304, 1536),
        "4:3":  (2048, 1536), "1:1":  (1792, 1792), "3:4": (1536, 2048),
        "2:3":  (1536, 2304), "9:16": (1440, 2560), "9:21": (1440, 3440),
    },
}

# 所有合法宽高比（顺序与前端 ASPECT_GROUPS 保持一致）
ASPECT_RATIOS = ["21:9", "16:9", "3:2", "4:3", "1:1", "3:4", "2:3", "9:16", "9:21"]

# Custom 模式输入边界（Preset 模式预设值不受此限制）
MAX_DIMENSION = 2048   # 单边最大像素
MIN_DIMENSION = 256    # 单边最小像素

# Preset 模式下可选输入缺失时的默认回退值
DEFAULT_RES   = "High (1.0~3.0MP)"
DEFAULT_RATIO = "9:16"


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
    DESCRIPTION = "选择预设/自定义图像尺寸节点"

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
                "Aspect_Ratio":  (ASPECT_RATIOS,                {"default": DEFAULT_RATIO}),
                "Custom_Width":  ("INT", {"default": 512, "min": MIN_DIMENSION, "max": MAX_DIMENSION, "step": 8}),
                "Custom_Height": ("INT", {"default": 512, "min": MIN_DIMENSION, "max": MAX_DIMENSION, "step": 8}),
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
        Custom_Width: int = 512,
        Custom_Height: int = 512,
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

        # 参数合法性校验（前端已做过滤，此处作为后端保险）
        if Resolution not in RESOLUTION_DATA:
            raise ValueError(
                "[ComfyUI_Size_Selection] 无效分辨率档位: {!r}。合法值: {}".format(
                    Resolution, list(RESOLUTION_DATA.keys())
                )
            )
        if Aspect_Ratio not in RESOLUTION_DATA[Resolution]:
            raise ValueError(
                "[ComfyUI_Size_Selection] 分辨率 {!r} 下无效宽高比: {!r}。合法值: {}".format(
                    Resolution, Aspect_Ratio, list(RESOLUTION_DATA[Resolution].keys())
                )
            )

        w, h = RESOLUTION_DATA[Resolution][Aspect_Ratio]
        return (_r8(w), _r8(h))

    @classmethod
    def IS_CHANGED(
        cls,
        Manual_Mode: str = "off",
        Resolution: Optional[str] = None,
        Aspect_Ratio: Optional[str] = None,
        Custom_Width: int = 512,
        Custom_Height: int = 512,
        **kwargs,
    ) -> tuple:
        """返回值变化时触发节点重新计算，将所有影响输出的参数打包为元组作为比较键。"""
        return (Manual_Mode, Resolution, Aspect_Ratio, Custom_Width, Custom_Height)
