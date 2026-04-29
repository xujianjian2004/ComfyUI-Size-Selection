# ComfyUI-Size-Selection

一个轻量、直观的ComfyUI尺寸选择节点，支持**预设分辨率快速选择**与**自定义宽高输入**，输出 `width` 和 `height` 整数，可直接接入任何下游节点。
A lightweight and intuitive ComfyUI size selection node that supports quick selection of preset resolutions and custom width and height input, outputting width and height as integers, which can be directly connected to any downstream node.

![License](https://img.shields.io/badge/license-MIT-green)
![Python](https://img.shields.io/badge/python-3.9%2B-blue)
![ComfyUI](https://img.shields.io/badge/ComfyUI-0.2.0%2B-orange)
![Version](https://img.shields.io/badge/version-1.0-brightgreen)

---

## ✨ 功能特性

- 预设分辨率快速选择（普清 / 标清 / 高清h / 超清 × 9 种宽高比）
- 自定义宽高输入，自动向下对齐 8 的倍数
- ⇄ 一键互换宽高
- 实时尺寸预览

## 🖼️ 节点预览
<p align="center">
  <img src="https://raw.githubusercontent.com/xujianjian2004/ComfyUI-Size-Selection/refs/heads/main/ComfyUI-Size-Selection-Preview.jpg" width="800"/>
</p>

### 两种工作模式

**▼ Preset（预设模式）**
- 4 档分辨率 × 9 种宽高比，点选即用
  - 普清(0.15-0.45MP) ·标清 (0.45-1.0MP) · 高清 (1.0-3.0MP) · 超清 (3.0-5.0MP)
- 图形化按钮组 + SVG 比例图标，视觉直观
- 实时预览框显示对应像素尺寸

**▲ Custom（自定义模式）**
- 手动输入宽高（256–2048 px），自动向下对齐 8 的倍数
- **⇄互换宽高数值**：一键互换宽高，横竖切换无缝

---

## 📐 预设尺寸对照表

按**总像素量**分四档，所有尺寸均整除 8，横竖比例严格对称。

| 宽高比 | 普清（0.15-0.45MP） | 标清（0.45-1.0MP） | 高清（1.0-3.0MP） | 超清（3.0-5.0MP） |
|--------|--------------------|-----------------------|-----------------|------------------|
| 21:9   | 768×328            | 1280×544              | 2560×1080       | 3440×1440        |
| 16:9   | 640×360            | 1280×720              | 1920×1080       | 2560×1440        |
| 3:2    | 768×512            | 1152×768              | 1536×1024       | 2304×1536        |
| 4:3    | 512×384            | 800×600               | 1280×960        | 2048×1536        |
| 1:1    | 512×512            | 768×768               | 1024×1024       | 1792×1792        |
| 3:4    | 384×512            | 600×800               | 960×1280        | 1536×2048        |
| 2:3    | 512×768            | 768×1152              | 1024×1536       | 1536×2304        |
| 9:16   | 360×640            | 720×1280              | 1080×1920       | 1440×2560        |
| 9:21   | 328×768            | 544×1280              | 1080×2560       | 1440×3440        |

> 所有预设值均已对齐到 8 的倍数，与主流扩散模型 VAE 编码要求一致。  
> High / Ultra 的 21:9 使用真实超宽屏标准分辨率（2560×1080、3440×1440），比例误差 ≤2.4%。

---

## 🔌 节点输入 / 输出

### 输入参数

| 名称 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `Manual_Mode` | COMBO | ✅ | `off` = 预设模式，`on` = 自定义模式 |
| `Resolution` | COMBO | ➖ | 分辨率档位：普清(0.15-0.45MP) ·标清 (0.45-1.0MP) · 高清 (1.0-3.0MP) · 超清 (3.0-5.0MP)（预设模式有效） |
| `Aspect_Ratio` | COMBO | ➖ | 宽高比，9 种可选（Preset 模式有效） |
| `Custom_Width` | INT | ➖ | 自定义宽度，256–2048 px，步长 8（自定义模式有效） |
| `Custom_Height` | INT | ➖ | 自定义高度，256–2048 px，步长 8（自定义模式有效） |

### 输出参数

| 名称 | 类型 | 说明 |
|------|------|------|
| `width` | INT | 目标宽度（像素，已对齐 8） |
| `height` | INT | 目标高度（像素，已对齐 8） |

---

## 📦 安装

### 方法一：手动克隆

```bash
cd ComfyUI/custom_nodes/
git clone https://github.com/xujianjian2004/ComfyUI-Size-Selection.git
# 重启 ComfyUI
```

### 方法二：ComfyUI Manager

在 ComfyUI Manager 中搜索 `ComfyUI-Size-Selection`，点击安装后重启。

---

## 🔗 典型工作流接线

**预设模式 → EmptyLatentImage**
```
[Size Selection]
    ├── width  ──→ [Empty Latent Image].width
    └── height ──→ [Empty Latent Image].height
```

**Custom 模式 → 任意接受 INT 输入的节点**
```
[Size Selection]  (Manual_Mode = on, Custom_Width = 1024, Custom_Height = 1024)
    ├── width  ──→ [EmptySD3LatentImage].width
    └── height ──→ [EmptySD3LatentImage].height
```

示例工作流文件位于 `workflows/Size-Selection_example.json`，可直接在 ComfyUI 中通过 `File → Load Workflow` 载入。

---

## 📝 技术说明
- 遵循 [ComfyUI 自定义节点规范](https://docs.comfy.org/zh-CN/custom-nodes/overview)
- 使用：在画布空白处双击或左侧"节点"中，搜索"Size Selection"。
- Custom 模式下宽高输入会自动**向下取整对齐到 8 的倍数**（如 `265` → `264`）。
- `Manual_Mode` 原生下拉框与 Preset / Custom 按钮保持**双向同步**，两种方式切换效果相同。
- 点击 **⇄ 互换宽高数值** 会直接互换 `Custom_Width` 与 `Custom_Height` 的值。
- 前端依赖 ComfyUI `app.js` 模块，需要 **ComfyUI 0.2.0 或更高版本**。

---

## 🗂️ 文件结构

```
ComfyUI-Size-Selection/
├── __init__.py                         # 节点注册入口
├── py/
│   └── size_selection.py               # Python 后端逻辑
├── web/
│   └── size_selection.js               # 前端自定义 UI
├── workflows/
│   └── Size-Selection_example.json     # 示例工作流
├── pyproject.toml                      # 项目元数据
├── requirements.txt                    # 依赖声明
├── LICENSE                             # MIT 开源协议
└── README.md
```

---

## 📄 License

本项目采用 [MIT License](LICENSE) 开源协议。

MIT © 2026 穿山阅海
