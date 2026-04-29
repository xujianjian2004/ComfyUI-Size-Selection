"""
ComfyUI-Size-Selection - 节点注册入口
======================================

功能：
- 导出 WEB_DIRECTORY（JavaScript 前端扩展目录）
- 注册尺寸选择节点到 ComfyUI

特性：
- 预设分辨率快速选择（Draft / Standard / High / Ultra × 9 种宽高比）
- 自定义宽高输入，自动向下对齐 8 的倍数
- ⇄ 一键互换宽高
- 实时尺寸预览

作者：穿山阅海
版本：1.0
"""

import os

# JavaScript 前端扩展目录（ComfyUI 启动时自动加载其中的 .js 文件）
WEB_DIRECTORY = os.path.join(os.path.dirname(os.path.abspath(__file__)), "web")

# 导入节点类
from .py.size_selection import ComfyUI_Size_Selection  # noqa: E402

# 节点类型名 → 节点类（工作流 JSON 中的唯一标识符）
NODE_CLASS_MAPPINGS: dict[str, type] = {
    "ComfyUI_Size_Selection": ComfyUI_Size_Selection,
}

# 节点类型名 → UI 显示名称（ComfyUI 菜单与搜索中展示）
NODE_DISPLAY_NAME_MAPPINGS: dict[str, str] = {
    "ComfyUI_Size_Selection": "Size Selection",
}

__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS", "WEB_DIRECTORY"]
