/**
 * ComfyUI 尺寸选择节点 — 前端 UI
 *
 * 功能特性：
 *   - 预设模式：SD/HD/FHD/QHD 四档 × 8 种宽高比
 *   - 自定义模式：手动输入宽高（256–2048 px），一键互换宽高，对齐 8 倍数
 *   - 兼容经典 LiteGraph 画布模式与 Nodes 2.0 Vue 渲染模式
 *   - 工作流序列化/反序列化，节点高度锁定，内存安全清理
 *
 * @version 2.1
 * @author  穿山阅海（WOSAI STUDIO）
 */

import { app } from "../../scripts/app.js";

// ── 常量定义 ──────────────────────────────────────────────────────────────────
const MAX_DIMENSION  = 2048;   // 自定义模式单边最大像素
const MIN_DIMENSION  = 256;    // 自定义模式单边最小像素
const DEFAULT_RES    = "FHD 1080P 全高清";  // 默认分辨率档位（与 Python 后端保持一致）
const DEFAULT_RATIO  = "9:16 Mobile 手机竖屏";  // 默认宽高比（完整标签格式，与后端保持一致）

// ── 预设分辨率数据（与 Python 后端 RESOLUTION_DATA 完全一致）─────────────────
const RESOLUTION_DATA = {
    "SD 480P 标清":  { "3:2":[768,512],  "2:3":[512,768],  "4:3":[512,384],  "3:4":[384,512],  "16:9":[640,360],  "9:16":[360,640],  "21:9":[768,328],  "1:1":[512,512]  },
    "HD 720P 高清":  { "3:2":[1152,768], "2:3":[768,1152], "4:3":[1024,768], "3:4":[768,1024], "16:9":[1280,720], "9:16":[720,1280], "21:9":[1280,544], "1:1":[768,768]  },
    "FHD 1080P 全高清": { "3:2":[1536,1024],"2:3":[1024,1536],"4:3":[1280,960], "3:4":[960,1280], "16:9":[1920,1080],"9:16":[1080,1920],"21:9":[2560,1080],"1:1":[1024,1024]},
    "QHD 2K+ 超清": { "3:2":[2304,1536],"2:3":[1536,2304],"4:3":[2048,1536],"3:4":[1536,2048],"16:9":[2560,1440],"9:16":[1440,2560],"21:9":[3440,1440],"1:1":[1536,1536]},
};

// ── 分辨率按钮短标签（单行显示）─────────────────────────────────────────────
const RESOLUTION_SHORT_LABELS = {
    "SD 480P 标清":  "标 清",
    "HD 720P 高清":  "高 清",
    "FHD 1080P 全高清": "全高清",
    "QHD 2K+ 超清": "超 清",
};

// ── 宽高比中文显示标签 ────────────────────────────────────────────────────────
const ASPECT_RATIO_LABELS = {
    "3:2":   "3:2 Classic 经典胶片",
    "2:3":   "2:3 Photo 人像照片",
    "4:3":   "4:3 Standard 标准画幅",
    "3:4":   "3:4 Portrait 竖幅人像",
    "16:9":  "16:9 Widescreen 标准宽屏",
    "9:16":  "9:16 Mobile 手机竖屏",
    "21:9":  "21:9 Ultrawide 超宽银幕",
    "1:1":   "1:1 Square 正方形",
};

// ── 宽高比网格布局：[4列]，预览格单独一行在底部 ─────────────────────────────
const ASPECT_ROWS = [
    ["9:16", "16:9", "21:9", "1:1"],
    ["3:2",  "2:3",  "4:3",  "3:4"],
];

// ── SVG 图标尺寸映射 [宽, 高]，用于生成各宽高比的预览图标 ─────────────────────
const RATIO_ICON = {
    "3:2":  [33, 22], "2:3":  [22, 33],
    "4:3":  [28, 22], "3:4":  [22, 28],
    "16:9": [36, 20], "9:16": [20, 36],
    "21:9": [42, 18],
    "1:1":  [22, 22],
};

// ── CSS 样式（只注入一次，多节点共用）──────────────────────────────────────────
const CSS = `
/* ── CSS 变量（深色默认值）────────────────────────────────────── */
.ss-wrap {
    /* 背景 */
    --ss-surface-2:      #1c1d20;
    --ss-surface-3:      #131417;
    /* 边框 */
    --ss-border:          #383B44;
    /* 文字 */
    --ss-text:            #E4E4E7;
    --ss-text-secondary:  #A3A3A3;
    --ss-text-muted:      #7A7A7A;
    /* 品牌色 */
    --ss-accent:          #DD6F4A;
    --ss-accent-hover:    rgba(221,111,74,.7);
    --ss-accent-glow:     rgba(221,111,74,.55);
    --ss-accent-dim:      rgba(221,111,74,.22);
    /* 布局 */
    padding:6px;font-family:system-ui,sans-serif;user-select:none;
    box-sizing:border-box;width:100%;max-width:100%;height:100%;
    display:flex;flex-direction:column;contain:layout style;
    position:relative;color:#E4E4E7;
}
.ss-hidden{display:none!important;height:0!important;overflow:hidden!important;padding:0!important;margin:0!important}
.ss-mode-row{display:flex;gap:8px;margin-bottom:10px}
.ss-mode-btn{flex:1;padding:7px 6px;border-radius:6px;border:1.5px solid #383B44;background:#1c1d20;color:#A3A3A3;font-size:12px;font-weight:normal;cursor:pointer;text-align:center;white-space:normal;word-break:break-word;line-height:1.3;transition:all .15s ease-out}
.ss-mode-btn:hover:not(.active){background:#DD6F4A;border-color:#DD6F4A;color:#fff;opacity:.7}
.ss-mode-btn.active{background:#DD6F4A;border-color:#DD6F4A;color:#fff}
.ss-mode-btn:active{filter:brightness(.85);transition:none}
.ss-res-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px 6px;margin-top:0;margin-bottom:10px}
.ss-res-btn{position:relative;padding:7px 4px;border-radius:6px;border:1.5px solid #383B44;background:#2c2c2e;color:#A3A3A3;font-size:11px;font-weight:normal;cursor:pointer;text-align:center;white-space:normal;word-break:break-word;line-height:1.3;transition:all .15s ease-out}
.ss-res-btn:hover:not(.active){background:#DD6F4A;border-color:#DD6F4A;color:#fff;opacity:.7}
.ss-res-btn.active{background:#DD6F4A;border-color:#DD6F4A;color:#fff}
.ss-res-btn:active{filter:brightness(.85);transition:none}
.ss-ar-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px 6px;margin-top:0}
.ss-ar-btn{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;padding:4px 2px;border-radius:6px;border:1.5px solid #383B44;background:#333336;color:#A3A3A3;cursor:pointer;min-width:0;min-height:44px;overflow:hidden;transition:all .15s ease-out}
.ss-ar-btn .ar-icon{flex-shrink:0;display:flex;align-items:center;justify-content:center;color:inherit;width:16px;height:16px}
.ss-wrap .ss-ar-btn .ar-icon svg{display:block;width:auto!important;height:auto!important;max-width:none!important;max-height:none!important}
.ss-wrap .ss-ar-btn .ar-icon svg rect{fill:none!important;stroke:#A3A3A3!important;stroke-width:1.0!important}
.ss-wrap .ss-ar-btn:hover:not(.active) .ar-icon svg rect,
.ss-wrap .ss-ar-btn.active .ar-icon svg rect{stroke:#fff!important}
.ss-ar-btn .ar-ratio{font-size:11px;font-weight:normal;line-height:1;letter-spacing:.02em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex-shrink:1;width:auto;text-align:center;color:inherit;min-width:0}
.ss-ar-btn:hover:not(.active){background:#DD6F4A;border-color:#DD6F4A;color:#fff;opacity:.7}
.ss-ar-btn.active{background:#DD6F4A;border-color:#DD6F4A;color:#fff}
.ss-ar-btn:active{filter:brightness(.85);transition:none}
.ss-preview-cell{display:flex;align-items:center;justify-content:center;gap:6px;border-radius:6px;border:1.5px solid #DD6F4A;background:#1c1d20;cursor:default;min-height:33px;overflow:hidden;margin-top:12px}
.ss-preview-cell-lbl{font-size:12px;color:#A3A3A3;white-space:nowrap}
.ss-preview-cell-val{font-size:14px;font-weight:normal;font-family:inherit;color:#E4E4E7;letter-spacing:.02em;text-align:center;padding:6px 10px;line-height:1.3}
.ss-preview-cell.flash,.ss-preview.flash{animation:ss-flash-border .8s ease-in-out}
.ss-preview-cell.flash .ss-preview-cell-val,.ss-preview.flash .ss-preview-val{animation:ss-flash-text .8s ease-in-out}
@keyframes ss-flash-border{0%,100%{border-color:#DD6F4A;box-shadow:none}50%{border-color:#DD6F4A;box-shadow:0 0 14px rgba(221,111,74,.55)}}
@keyframes ss-flash-text{0%,100%{transform:scale(1);color:#E4E4E7}50%{transform:scale(1.15);color:#DD6F4A}}
/* 自定义模式：版权钉底 —— margin-top:auto 吃掉剩余空间，预览条↔版权 ≥12px，
   版权↔节点底固定 12px（6px margin + 6px wrap padding），不随高度计算偏差失衡 */
.ss-mode-manual .ss-copyright{margin-top:auto;padding-top:12px;margin-bottom:6px}
.ss-swap-btn{width:100%;margin-top:8px;margin-bottom:4px;padding:7px 0;border-radius:6px;border:1.5px solid #383B44;background:#1c1d20;color:#A3A3A3;font-size:14px;font-weight:normal;cursor:pointer;text-align:center;letter-spacing:.04em;transition:all .15s ease-out}
.ss-swap-btn:hover{background:#DD6F4A;border-color:#DD6F4A;color:#fff}
.ss-swap-btn:active{filter:brightness(.85);transition:none}
.ss-preview{display:flex;align-items:center;justify-content:center;gap:6px;margin-top:12px;padding:6px 12px;background:#1c1d20;border-radius:6px;border:1.5px solid #DD6F4A;color:#E4E4E7;min-height:33px;box-sizing:border-box}
@media(prefers-reduced-motion:reduce){.ss-preview.flash,.ss-preview-cell.flash,.ss-preview.flash .ss-preview-val,.ss-preview-cell.flash .ss-preview-cell-val{animation:none!important}}
.ss-preview-lbl{font-size:12px;color:#A3A3A3;white-space:nowrap}
.ss-preview-val{font-size:14px;font-family:inherit;font-weight:normal;color:#E4E4E7;letter-spacing:.02em;white-space:nowrap}
.ss-copyright{margin-top:12px;margin-left:0;margin-right:0;padding:6px 4px 0;text-align:center;width:100%;flex-shrink:0;font-size:8.5px;color:#7A7A7A;letter-spacing:.4px;white-space:nowrap;max-width:100%;overflow:hidden;text-overflow:ellipsis;box-sizing:border-box}
`;

// ── 工具函数 ──────────────────────────────────────────────────────────────────

/** 根据模式返回节点固定高度（像素）：自定义模式=282，预设模式=360 */
function getFixedHeight(manual) {
    return manual ? 282 : 360;
}

/** 向文档 head 注入 CSS 样式（幂等，多次调用只注入一次） */
let _stylesInjected = false;
function injectStyles() {
    if (_stylesInjected || document.getElementById("ss-styles")) return;
    _stylesInjected = true;
    const s = document.createElement("style");
    s.id = "ss-styles";
    s.textContent = CSS;
    document.head.appendChild(s);
}

/**
 * 生成单个宽高比的 SVG 图标标记字符串（紧致 viewBox 版）。
 * SVG 恰好包住线框（无内边空隙），icon 与文字间距即真实 gap，
 * 组团在按钮内真正居中（旧版固定方形画布导致 icon 两侧有幽灵空白、视觉偏移）。
 * @param {string} ratio - 宽高比键名，如 "16:9"
 * @param {number} H     - 图标长边目标高度（像素）
 * @returns {string} SVG HTML 字符串
 */
function _buildIcon(ratio, H) {
    const [rw, rh] = RATIO_ICON[ratio] || [24, 24];
    const sc = H / Math.max(rw, rh);          // 长边贴齐目标高度
    const w  = Math.max(6, Math.round(rw * sc));
    const h  = Math.max(6, Math.round(rh * sc));
    const lw = 1.0, pad = 1.5;                 // 线宽改细（1.0px），pad 保持 1.5 留足抗锯齿空间
    const vw = w + pad * 2, vh = H + pad * 2;  // 高度盒统一为 H（垂直居中）
    const y  = pad + Math.round((H - h) / 2);
    return `<svg width="${vw}" height="${vh}" viewBox="0 0 ${vw} ${vh}" xmlns="http://www.w3.org/2000/svg">`
         + `<rect x="${pad}" y="${y}" width="${w}" height="${h}" rx="2" ry="2" `
         + `fill="none" stroke="currentColor" stroke-width="${lw}"/></svg>`;
}

/** 预计算 SVG 图标缓存（长边 13px，紧致盒）——模块加载时一次性构建，避免每次渲染重复计算。 */
const ICON_CACHE_SM = Object.fromEntries(Object.keys(RATIO_ICON).map(r => [r, _buildIcon(r, 13)]));

/**
 * 轮询等待指定名称的 widget 全部就绪，然后执行回调。
 * 超时后打印警告并停止轮询，防止内存泄漏。
 *
 * @param {object}   node    - LiteGraph 节点实例
 * @param {string[]} names   - 需要等待的 widget 名称列表
 * @param {Function} cb      - 所有 widget 就绪后的回调
 * @param {number}   timeout - 最大等待时长（毫秒），默认 3000
 * @returns {number} setInterval 句柄，供 onRemoved 清理
 */
function waitForWidgets(node, names, cb, timeout = 3000) {
    const start = Date.now();
    const intv = setInterval(() => {
        const ready = node.widgets && names.every(n => node.widgets.some(w => w.name === n));
        if (ready) {
            clearInterval(intv);
            cb();
        } else if (Date.now() - start >= timeout) {
            clearInterval(intv);
            console.warn("[尺寸选择] 等待组件超时：", names);
        }
    }, 50);
    return intv;
}

/** 从完整标签提取短键（"16:9 Widescreen 标准宽屏" → "16:9"，纯短键直接返回） */
function _shortAsp(label) {
    if (!label) return DEFAULT_RATIO.split(" ")[0];
    const i = label.indexOf(" ");
    return i > 0 ? label.slice(0, i) : label;
}

/**
 * 将数值夹紧至 [MIN_DIMENSION, maxV] 并向下对齐到 8 的倍数。
 * @param {number} v    - 输入值
 * @param {number} maxV - 上限，默认为 MAX_DIMENSION
 * @returns {number} 对齐后的整数
 */
function roundTo8(v, maxV = MAX_DIMENSION) {
    const n = Math.max(MIN_DIMENSION, Math.min(maxV, Number(v) || MIN_DIMENSION));
    return Math.floor(n / 8) * 8;
}

/**
 * 预缓存 prefers-reduced-motion 媒体查询对象。
 */
const _mqlReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)") ?? null;
/** 检测用户是否开启了"减少动效"无障碍选项 */
const _prefersReducedMotion = () => _mqlReducedMotion?.matches ?? false;

// ── 主 UI 构建函数 ────────────────────────────────────────────────────────────
function buildUI(node) {
    injectStyles();

    // 注入节点元信息（cnr_id + ver），对齐 ComfyUI 内置节点属性面板格式
    node.properties = node.properties || {};
    if (!node.properties.cnr_id) node.properties.cnr_id = "custom-nodes/ComfyUI-Size-Selection";
    if (!node.properties.ver) node.properties.ver = "2.1";
    delete node.properties.aux_id;

    // 移除所有参数的外部连接端口
    // （五个参数均由自定义 UI 内部控制，不需要外部节点连入）
    if (node.inputs) {
        const hiddenPorts = new Set([
            "Manual_Mode", "Resolution", "Aspect_Ratio",
            "Custom_Width", "Custom_Height",
        ]);
        node.inputs = node.inputs.filter(i => !hiddenPorts.has(i.name));
    }

    // 资源句柄——全部在 onRemoved 中统一清理，防止内存泄漏
    let _waitIntv            = null;
    let _vueMinWidthInterval = null;
    let _vueMinWidthTimeout  = null;
    let _resizeObserver      = null;
    const _ac = new AbortController();

    const _origOnRemoved = node.onRemoved;
    node.onRemoved = () => {
        clearInterval(_waitIntv);
        _resizeObserver?.disconnect();
        clearInterval(_vueMinWidthInterval);
        clearTimeout(_vueMinWidthTimeout);
        _ac.abort();
        _origOnRemoved?.();
    };

    // 预隐藏原生 widget，避免轮询延迟期间引起错位
    if (node.widgets) {
        for (const w of node.widgets) {
            w.hidden = true;
            w.computeSize = () => [0, -4];
        }
    }

    // 拦截 onConfigure：工作流载入时修正节点高度
    const _origOnConfigure = node.onConfigure;
    node.onConfigure = function (info) {
        _origOnConfigure?.apply(this, arguments);
        if (Array.isArray(info?.widgets_values) && info.widgets_values.length > 0 && node.size) {
            const isMan = info.widgets_values[0] === "on";
            node.size[1] = getFixedHeight(isMan);
        }
    };

    // 等待三个核心 widget 就绪后初始化 UI
    _waitIntv = waitForWidgets(node, ["Resolution", "Aspect_Ratio", "Manual_Mode"], () => {
        // 获取五个核心 widget 引用
        const resW = node.widgets.find(w => w.name === "Resolution");
        const aspW = node.widgets.find(w => w.name === "Aspect_Ratio");
        const manW = node.widgets.find(w => w.name === "Manual_Mode");
        const cusW = node.widgets.find(w => w.name === "Custom_Width");
        const cusH = node.widgets.find(w => w.name === "Custom_Height");

        // 覆盖原生 widget 显示标签为中文
        if (manW) manW.label = "自定义模式";
        if (resW) resW.label = "分辨率";
        if (aspW) aspW.label = "宽高比";
        if (cusW) cusW.label = "自定义宽度";
        if (cusH) cusH.label = "自定义高度";

        // 将自定义宽高夹紧到合法范围
        if (cusW) cusW.value = Math.max(MIN_DIMENSION, Math.min(MAX_DIMENSION, cusW.value));
        if (cusH) cusH.value = Math.max(MIN_DIMENSION, Math.min(MAX_DIMENSION, cusH.value));

        // 校验分辨率/宽高比合法性，不合法时回退到默认值
        // aspW.value 存完整标签（如 "16:9 Widescreen 标准宽屏"），currentAsp 用短键（"16:9"）做 RESOLUTION_DATA 查表
        let currentRes = (resW?.value && RESOLUTION_DATA[resW.value]) ? resW.value : DEFAULT_RES;
        if (resW && resW.value !== currentRes) resW.value = currentRes;
        const _aspShort = _shortAsp(aspW?.value);
        let currentAsp = (aspW?.value && RESOLUTION_DATA[currentRes]?.[_aspShort]) ? _aspShort : DEFAULT_RATIO.split(" ")[0];
        // 将 aspW.value 标准化为完整标签
        const _aspLabel = ASPECT_RATIO_LABELS[currentAsp] || currentAsp;
        if (aspW && aspW.value !== _aspLabel) aspW.value = _aspLabel;

        let isManual         = manW?.value === "on";
        let baseWidth        = cusW?.value || MIN_DIMENSION;
        let baseHeight       = cusH?.value || MAX_DIMENSION;
        let _updatingDisplay = false;
        let _applyingMode    = false;
        let _targetHeight    = getFixedHeight(isManual);

        // 记录原始 widget 顺序，用于在显示/隐藏 widget 时恢复正确插入位置
        const _origOrder = new Map();
        node.widgets.forEach((w, i) => _origOrder.set(w, i));

        // 自定义序列化：仅保存 5 个核心 widget 的值
        const _origSerialize = node.serialize?.bind(node);
        node.serialize = function () {
            const data = _origSerialize ? _origSerialize() : {};
            const coreWidgets = [manW, resW, aspW, cusW, cusH].filter(Boolean);
            data.widgets_values = coreWidgets
                .filter(w => w.options?.serialize !== false)
                .map(w => w.value);
            return data;
        };

        /**
         * 显示或隐藏一个 widget，同时从 node.widgets 数组中添加/移除。
         */
        function setWidgetVis(widget, vis) {
            if (!widget || !node.widgets) return;
            widget.hidden = !vis;
            widget.computeSize = vis ? undefined : () => [0, -4];
            if (widget.element) widget.element.style.display = vis ? "" : "none";
            if (widget.inputEl)  widget.inputEl.style.display  = vis ? "" : "none";
            const inArray = node.widgets.includes(widget);
            if (!vis && inArray) {
                node.widgets.splice(node.widgets.indexOf(widget), 1);
            } else if (vis && !inArray) {
                const targetOrig = _origOrder.get(widget) ?? Infinity;
                let insertAt = 0;
                for (let i = 0; i < node.widgets.length; i++) {
                    if ((_origOrder.get(node.widgets[i]) ?? Infinity) < targetOrig) insertAt = i + 1;
                }
                node.widgets.splice(insertAt, 0, widget);
            }
        }

        // 默认宽度 250px（下拉框文字完整显示），最小硬限 220px
        node.minSize = [220, 150];
        if (node.size[0] < 220) node.size[0] = 250;

        // ── DOM 结构构建 ──────────────────────────────────────────────────────
        const wrap = document.createElement("div");
        wrap.className = "ss-wrap" + (isManual ? " ss-mode-manual" : " ss-mode-preset");
        wrap.setAttribute("translate", "no");        wrap.style.width = (node.size?.[0] || 250) + "px";

        const contentDiv = document.createElement("div");
        contentDiv.className = "ss-content";
        wrap.appendChild(contentDiv);

        // 模式切换行（预设 / 自定义）
        const modeRow = document.createElement("div");
        modeRow.className = "ss-mode-row";

        const btnAuto = document.createElement("button");
        btnAuto.className = `ss-mode-btn${!isManual ? " active" : ""}`;
        btnAuto.textContent = "预设模式";

        const btnMan = document.createElement("button");
        btnMan.className = `ss-mode-btn${isManual ? " active" : ""}`;
        btnMan.textContent = "自定义模式";

        modeRow.append(btnAuto, btnMan);
        contentDiv.appendChild(modeRow);

        // ── 预设面板 ──────────────────────────────────────────────────────────
        const autoPanel = document.createElement("div");
        autoPanel.className = isManual ? "ss-hidden" : "";

        // 分辨率按钮（4列单行，短标签）
        const resGrid = document.createElement("div");
        resGrid.className = "ss-res-grid";
        autoPanel.appendChild(resGrid);

        const resBtns = {};
        for (const lv of Object.keys(RESOLUTION_DATA)) {
            const b = document.createElement("button");
            b.className = `ss-res-btn${lv === currentRes ? " active" : ""}`;
            b.textContent = RESOLUTION_SHORT_LABELS[lv] || lv;
            b.onclick = () => {
                currentRes = lv;
                resW.value = lv;
                resW.callback?.(lv);
                Object.entries(resBtns).forEach(([k, btn]) => btn.classList.toggle("active", k === lv));
                syncPreview();
                app.graph?.setDirtyCanvas(true, true);
            };
            resGrid.appendChild(b);
            resBtns[lv] = b;
        }

        // 宽高比按钮（4列网格）
        const arGrid = document.createElement("div");
        arGrid.className = "ss-ar-grid";
        autoPanel.appendChild(arGrid);

        const aspBtns = {};

        /**
         * 创建单个宽高比按钮（图标 + 比例数字）
         */
        function makeArBtn(r) {
            const label     = ASPECT_RATIO_LABELS[r] || r;
            const ratioPart = label.split(" ")[0];
            const b = document.createElement("button");
            b.className = `ss-ar-btn${r === currentAsp ? " active" : ""}`;
            b.innerHTML = `<span class="ar-icon">${ICON_CACHE_SM[r]}</span>`
                        + `<span class="ar-ratio">${ratioPart}</span>`;
            return b;
        }

        /**
         * 处理宽高比按钮点击：currentAsp 用短键，aspW.value 存完整标签
         */
        function onAspClick(r) {
            currentAsp = r;
            aspW.value = ASPECT_RATIO_LABELS[r] || r;  // 完整标签写入下拉框
            aspW.callback?.(aspW.value);
            Object.entries(aspBtns).forEach(([k, btn]) => btn.classList.toggle("active", k === r));
            syncPreview();
            app.graph?.setDirtyCanvas(true, true);
        }

        // 填充 AR 网格（4列）
        for (const row of ASPECT_ROWS) {
            for (const ratio of row) {
                const b = makeArBtn(ratio);
                b.onclick = () => onAspClick(ratio);
                arGrid.appendChild(b);
                aspBtns[ratio] = b;
            }
        }

        // 预览尺寸单独占一行（底部）
        const previewCell = document.createElement("div");
        previewCell.className = "ss-preview-cell";
        const previewCellLbl = document.createElement("span");
        previewCellLbl.className = "ss-preview-cell-lbl";
        previewCellLbl.textContent = "尺寸预览：";
        const previewCellVal = document.createElement("span");
        previewCellVal.className = "ss-preview-cell-val";
        previewCellVal.textContent = "-";
        previewCell.append(previewCellLbl, previewCellVal);
        autoPanel.appendChild(previewCell);

        contentDiv.appendChild(autoPanel);

        // ── 自定义面板 ────────────────────────────────────────────────────────
        const manPanel = document.createElement("div");
        manPanel.className = isManual ? "" : "ss-hidden";

        const swapBtn = document.createElement("button");
        swapBtn.className = "ss-swap-btn";
        swapBtn.textContent = "一键互换宽高";
        swapBtn.onclick = () => {
            [baseWidth, baseHeight] = [baseHeight, baseWidth];
            updateWidgetValue(cusW, baseWidth);
            updateWidgetValue(cusH, baseHeight);
            syncPreview();
            app.graph?.setDirtyCanvas(true, true);
        };
        manPanel.appendChild(swapBtn);
        contentDiv.appendChild(manPanel);

        // 全幅预览条（自定义模式专用，初始根据 isManual 决定显隐）
        const preview = document.createElement("div");
        preview.className = "ss-preview" + (isManual ? "" : " ss-hidden");
        preview.innerHTML = `<span class="ss-preview-lbl">尺寸预览：</span><span class="ss-preview-val">-</span>`;
        const previewVal = preview.querySelector(".ss-preview-val");

        // 版权栏：仅自定义模式显示，跟随 manPanel 显隐，无需单独切换
        const copyright = document.createElement("div");
        copyright.className = "ss-copyright" + (isManual ? "" : " ss-hidden");
        copyright.textContent = "COPYRIGHT © WOSAI STUDIO | 穿山阅海";

        wrap.appendChild(preview);
        wrap.appendChild(copyright);

        // ── 逻辑函数 ──────────────────────────────────────────────────────────

        /**
         * 触发预览条/预览格闪烁动画，提示数值已更新。
         */
        function flashPreview() {
            if (_prefersReducedMotion() || document.hidden) return;
            if (!isManual) {
                // 预设模式：闪烁预览格
                previewCell.classList.remove("flash");
                void previewCell.offsetWidth;  // 强制重排以重新触发动画
                previewCell.classList.add("flash");
            } else {
                // 自定义模式：闪烁全幅预览条
                preview.classList.remove("flash");
                void preview.offsetWidth;
                preview.classList.add("flash");
            }
        }

        /**
         * 同步尺寸预览的显示值（预览格 + 全幅条同步更新）：
         * - 预设模式：从 RESOLUTION_DATA 查表，预览格显示 "WxH"（无空格）
         * - 自定义模式：读取 cusW/cusH 并对齐到 8 的倍数，全幅条显示 "W × H"
         */
        function syncPreview() {
            if (!isManual) {
                const d = RESOLUTION_DATA[currentRes]?.[currentAsp];
                // 预览格：紧凑格式（无空格），充分利用单元格宽度
                previewCellVal.textContent = d ? `${d[0]}×${d[1]}` : "N/A";
                // 全幅条同步（隐藏状态下也保持数据一致）
                if (previewVal) previewVal.textContent = d ? `${d[0]} × ${d[1]}` : "N/A";
            } else {
                const w = roundTo8(parseInt(cusW?.value) || baseWidth,  MAX_DIMENSION);
                const h = roundTo8(parseInt(cusH?.value) || baseHeight, MAX_DIMENSION);
                if (previewVal) previewVal.textContent = `${w} × ${h}`;
                previewCellVal.textContent = `${w}×${h}`;
            }
            flashPreview();
        }

        /**
         * 以编程方式更新 widget 的值，同时刷新对应的 DOM 输入元素。
         */
        function updateWidgetValue(widget, value) {
            if (!widget) return;
            _updatingDisplay = true;
            try {
                const maxV = widget.options?.max;
                const minV = widget.options?.min;
                const inBounds = (maxV === undefined || value <= maxV) &&
                                 (minV === undefined || value >= minV);
                if (inBounds) widget.value = value;
                if (widget.inputEl) {
                    widget.inputEl.value = value;
                } else if (widget.element) {
                    const input = widget.element.querySelector("input[type='number']")
                               || widget.element.querySelector("input")
                               || widget.element.querySelector("textarea");
                    if (input) {
                        input.value = value;
                    } else if (typeof widget.element.value !== "undefined") {
                        widget.element.value = value;
                    }
                }
            } finally {
                _updatingDisplay = false;
            }
            app.graph?.setDirtyCanvas(true, true);
        }

        /**
         * 切换预设/自定义模式：更新按钮状态、面板显隐、widget 可见性，
         * 并重新计算节点高度。
         */
        function applyMode(manual) {
            _applyingMode = true;
            isManual = manual;
            manW.value = manual ? "on" : "off";
            manW.callback?.(manW.value);

            btnAuto.classList.toggle("active", !manual);
            btnMan.classList.toggle("active",   manual);

            wrap.classList.toggle("ss-mode-manual",  manual);
            wrap.classList.toggle("ss-mode-preset", !manual);

            autoPanel.classList.toggle("ss-hidden",  manual);
            manPanel.classList.toggle("ss-hidden",  !manual);
            // 全幅预览条 & 版权栏：仅在自定义模式显示；预设模式使用预览格
            preview.classList.toggle("ss-hidden", !manual);
            copyright.classList.toggle("ss-hidden", !manual);

            setWidgetVis(resW, !manual);
            setWidgetVis(aspW, !manual);
            setWidgetVis(cusW,  manual);
            setWidgetVis(cusH,  manual);

            syncPreview();
            updateNodeHeight();
            _applyingMode = false;
        }

        /**
         * 强制将节点高度锁定到当前模式对应的固定值，并同步 wrap 宽度。
         */
        function updateNodeHeight() {
            const h = getFixedHeight(isManual);
            _targetHeight = h;
            const curW = node.size?.[0] || 250;
            node.size = [curW, h];
            wrap.style.width = curW + "px";
            if (node.element?.style) {
                node.element.style.removeProperty("height");
                node.element.style.removeProperty("min-height");
                node.element.style.removeProperty("max-height");
                delete node.height;
                delete node._minHeight;
                delete node._maxHeight;
            }
            app.graph?.setDirtyCanvas(true, true);
        }

        // 模式切换按钮点击事件
        btnAuto.onclick = () => applyMode(false);
        btnMan.onclick  = () => applyMode(true);

        // 监听原生下拉框的 Manual_Mode 变化（双向同步）
        const origMan = manW.callback;
        manW.callback = function (v) {
            origMan?.apply(this, arguments);
            if (!_applyingMode) applyMode(v === "on");
        };

        // 监听分辨率 widget 变化
        const origRes = resW.callback;
        resW.callback = function (v) {
            if (!RESOLUTION_DATA[v]) return;
            currentRes = v;
            Object.entries(resBtns).forEach(([k, btn]) => btn.classList.toggle("active", k === v));
            syncPreview();
            origRes?.apply(this, arguments);
        };

        // 监听宽高比 widget 变化（v 为完整标签，提取短键后查表）
        const origAsp = aspW.callback;
        aspW.callback = function (v) {
            const short = _shortAsp(v);
            if (!RESOLUTION_DATA[currentRes]?.[short]) return;
            currentAsp = short;
            Object.entries(aspBtns).forEach(([k, btn]) => btn.classList.toggle("active", k === short));
            syncPreview();
            origAsp?.apply(this, arguments);
        };

        /**
         * 为自定义宽高 widget 绑定 callback 及 DOM input/change 事件。
         * @param {object}   widget   - ComfyUI widget 实例
         * @param {Function} setBase  - 更新基准值的回调（baseWidth / baseHeight）
         */
        function bindCustomDimWidget(widget, setBase) {
            if (!widget) return;
            const origCb = widget.callback;
            widget.callback = function (v) {
                if (!_updatingDisplay) setBase(v);
                origCb?.apply(this, arguments);
                if (isManual) syncPreview();
            };
            if (!widget.element) return;
            const handleDimEvent = (e, skipZero) => {
                if (!isManual) return;
                const input  = e.target.querySelector("input") || e.target;
                const rawVal = parseInt(input.value) || 0;
                if (rawVal <= 0) { if (skipZero) return; syncPreview(); return; }
                const r = roundTo8(rawVal, MAX_DIMENSION);
                input.value  = r;
                widget.value = r;
                setBase(r);
                syncPreview();
            };
            widget.element.addEventListener("input",  (e) => handleDimEvent(e, false), { signal: _ac.signal });
            widget.element.addEventListener("change", (e) => handleDimEvent(e, true),  { signal: _ac.signal });
        }

        // 自定义宽高 widget 事件绑定
        bindCustomDimWidget(cusW, (v) => { baseWidth  = v; });
        bindCustomDimWidget(cusH, (v) => { baseHeight = v; });

        // 覆盖 computeSize：先调用原始计算，再应用 minSize 限制（参考 WOSAI）
        const _origComputeSize = node.computeSize?.bind(node);
        node.computeSize = function (out) {
            const s = _origComputeSize
                ? _origComputeSize(out)
                : [node.size?.[0] || 220, getFixedHeight(isManual)];
            const w = Math.max(node.minSize?.[0] || 220, s[0]);
            wrap.style.width = w + "px";
            return [w, getFixedHeight(isManual)];
        };

        // 将 DOM 包裹器挂载为节点的 DOM widget
        node.addDOMWidget("ss_ui", "ss_panel", wrap, { getMinHeight: function () { return 0; } });

        // 应用初始模式（根据已保存的 manW.value）
        applyMode(isManual);

        // 下一帧计算版权栏实际宽度，动态设置节点最小尺寸
        // 最小宽度以版权文字宽度为准，fallback 220px（与新节点默认宽度无关）
        requestAnimationFrame(() => {
            const textW = copyright.scrollWidth > 0
                ? copyright.scrollWidth
                : 220;
            const minW  = Math.max(textW + 16, 220);
            const minH  = 45 + 12 + (copyright.offsetHeight || 44);
            node.minSize = [minW, minH];

            const applyVueMinWidth = () => {
                if (node.element?.style) {
                    node.element.style.minWidth  = minW + "px";
                    node.element.style.minHeight = minH + "px";
                    return;
                }
                _vueMinWidthInterval = setInterval(() => {
                    if (node.element?.style) {
                        node.element.style.minWidth  = minW + "px";
                        node.element.style.minHeight = minH + "px";
                        clearInterval(_vueMinWidthInterval);
                        _vueMinWidthInterval = null;
                        clearTimeout(_vueMinWidthTimeout);
                        _vueMinWidthTimeout = null;
                    }
                }, 100);
                _vueMinWidthTimeout = setTimeout(() => {
                    clearInterval(_vueMinWidthInterval);
                    _vueMinWidthInterval = null;
                    _vueMinWidthTimeout  = null;
                }, 3000);
            };
            applyVueMinWidth();
        });

        // ── 高度/宽度监测（ResizeObserver，替代 setInterval）───────────────────
        let _lastHeight   = node.size[1];
        let _resizePaused = document.hidden;

        document.addEventListener(
            "visibilitychange",
            () => { _resizePaused = document.hidden; },
            { signal: _ac.signal }
        );

        let _lastWidth = node.size[0];
        // ResizeObserver 替代 setInterval：事件驱动，页面不可见时自动暂停，更高效
        _resizeObserver = new ResizeObserver(() => {
            if (_resizePaused || !node.size) return;
            const curH = node.size[1];
            const curW = node.size[0];
            if (curW !== _lastWidth) {
                _lastWidth = curW;
                wrap.style.width = curW + "px";
            }
            if (curH === _lastHeight) return;
            _lastHeight = curH;
            if (curH !== _targetHeight) updateNodeHeight();
        });
        _resizeObserver.observe(wrap);
    });
}

// ── 注册 ComfyUI 扩展 ────────────────────────────────────────────────────────
app.registerExtension({
    name: "Size_Selection",
    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData.name !== "ComfyUI_Size_Selection") return;
        const _orig = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function () {
            _orig?.apply(this, arguments);
            buildUI(this);
        };
    },
});
