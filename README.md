# ComfyUI-Size-Selection

一个轻量、直观的 ComfyUI 尺寸选择节点（已适配 Nodes 2.0），支持**四档预设分辨率快速选择**与**自定义宽高输入**，输出 `width` 和 `height` 整数，可直接接入任何下游节点。

A lightweight and intuitive ComfyUI size selection node. Supports quick selection across 4 preset resolution tiers × 9 aspect ratios, plus a fully custom mode with live preview. Outputs `width` and `height` integers directly connectable to any downstream node.

---

## ✨ 功能特性

- 四档预设分辨率（标清 SD / 高清 HD / 全高清 FHD / 超清 QHD）× 九种宽高比
- 自定义宽高输入（256–2048 px），自动向下对齐 8 的倍数
- 一键互换宽高数值
- 实时尺寸预览，切换即刷新
- 兼容 LiteGraph 画布模式与 Nodes 2.0 Vue 渲染模式

## 🖼️ 节点预览

<p align="center">
  <img src="https://raw.githubusercontent.com/xujianjian2004/ComfyUI-Size-Selection/refs/heads/main/Preview-LiteGraph.png" width="800"/>
</p>
<p align="center">
  <img src="https://raw.githubusercontent.com/xujianjian2004/ComfyUI-Size-Selection/refs/heads/main/Preview-Nodes%202.0.png" width="800"/>
</p>

### 两种工作模式

**▼ Preset（预设模式）**

- 4 档分辨率 × 9 种宽高比，点选即用
  - 📺 标清 SD (0.2–0.4MP) · 📱 高清 HD (0.6–1.0MP) · 💻 全高清 FHD (1.1–2.8MP) · 🎬 超清 QHD (2.4–5.0MP)
- 图形化按钮组 + SVG 比例图标
- 实时预览格显示对应像素尺寸

**▲ Custom（自定义模式）**

- 手动输入宽高（256–2048 px），自动向下对齐 8 的倍数
- **⇄ 互换宽高数值**：一键横竖切换

---

## 📐 预设尺寸对照表（适配常用 AI 生图规格，兼容主流社媒全尺寸）

按**总像素量**分四档，所有尺寸均整除 8，横竖比例严格对称。

| 宽高比 | 📺 标清 SD<br>(0.2–0.4MP)≈480P | 📱 高清 HD<br>(0.6–1.0MP) ≈720P | 💻 全高清 FHD<br>(1.1–2.8MP) ≈1080P | 🎬 超清 QHD<br>(2.4–5.0MP) ≈2K+ |
| --- | --- | --- | --- | --- |
| 3:2 摄影横图 | 768×512 | 1152×768 | 1536×1024 | 2304×1536 |
| 2:3 海报竖图 | 512×768 | 768×1152 | 1024×1536 | 1536×2304 |
| 4:3 经典横图 | 512×384 | 1024×768 | 1280×960 | 2048×1536 |
| 3:4 经典竖图 | 384×512 | 768×1024 | 960×1280 | 1536×2048 |
| 16:9 壁纸横图 | 640×360 | 1280×720 | 1920×1080 | 2560×1440 |
| 9:16 手机竖图 | 360×640 | 720×1280 | 1080×1920 | 1440×2560 |
| 21:9 影视横图 | 768×328 | 1280×544 | 2560×1080 | 3440×1440 |
| 9:21 超长竖图 | 328×768 | 544×1280 | 1080×2560 | 1440×3440 |
| 1:1 正方形图 | 512×512 | 768×768 | 1024×1024 | 1536×1536 |

> 所有预设值均已对齐到 8 的倍数，与主流扩散模型 VAE 编码要求一致。

---

## 🔌 节点输入 / 输出

### 输入参数

| 名称 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `Manual_Mode` | COMBO | ✅ | `off` = 预设模式，`on` = 自定义模式 |
| `Resolution` | COMBO | ➖ | 分辨率档位：SD · HD · FHD · QHD（预设模式有效） |
| `Aspect_Ratio` | COMBO | ➖ | 宽高比，9 种可选（预设模式有效） |
| `Custom_Width` | INT | ➖ | 自定义宽度，256–2048 px，步长 8（自定义模式有效） |
| `Custom_Height` | INT | ➖ | 自定义高度，256–2048 px，步长 8（自定义模式有效） |

### 输出参数

| 名称 | 类型 | 说明 |
| --- | --- | --- |
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

**自定义模式 → 任意接受 INT 输入的节点**

```
[Size Selection]  (Manual_Mode = on, Custom_Width = 1024, Custom_Height = 1536)
    ├── width  ──→ [EmptySD3LatentImage].width
    └── height ──→ [EmptySD3LatentImage].height
```

示例工作流位于 `workflows/Size-Selection_example.json`，可通过 `File → Load Workflow` 直接载入。

---

## 📝 技术说明

- 遵循 [ComfyUI 自定义节点规范](https://docs.comfy.org/zh-CN/custom-nodes/overview)
- 在画布空白处双击或左侧节点面板中搜索 `Size Selection` 即可添加。
- Custom 模式下宽高输入自动**向下取整对齐到 8 的倍数**（如 `265` → `264`）。
- `Manual_Mode` 原生下拉框与 Preset / Custom 按钮保持**双向同步**。
- `Custom_Width` / `Custom_Height` 的外部连接端口已隐藏，仅支持 UI 直接输入。
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

## 📋 版本历史

| 版本 | 主要变更 |
| --- | --- |
| **2.0** | - 成功瘦身：变美变瘦，丝滑不卡顿<br>- 颜值逆袭：UI大焕新，配色更清爽<br>- 版本匹配：经典现代，模式全兼容<br>- 自由设定：内置预设，也能自定义<br>- 实时预览：尺寸大小，切换看得见<br>- 全景适配：各种规格，统统都拿捏 |
| **1.1** | UI 重构：分辨率单行四列、宽高比两列配对网格、预览格嵌入、配色对齐 |
| **1.0** | 初始版本 |

---

## 📄 License

COPYRIGHT © WOS AI STUDIO | 穿山阅海

详见 [LICENSE](./LICENSE) 文件。
