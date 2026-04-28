/**
 * ComfyUI 尺寸选择节点 - 前端UI扩展（中文版）
 *
 * 功能特性：
 *   - 预设模式：按钮选择分辨率档位 × 宽高比，实时预览尺寸
 *   - 自定义模式：手动输入宽高，支持一键互换宽高
 *   - 兼容经典 LiteGraph 画布模式与 Nodes 2.0 Vue 渲染模式
 * @version 1.0
 * @author 穿山阅海
 */

import { app } from "../../scripts/app.js";

// ── 常量定义 ──────────────────────────────────────────────────────────────────
const MAX_DIMENSION  = 2048;   // 自定义模式单边最大像素
const MIN_DIMENSION  = 256;    // 自定义模式单边最小像素
const DEFAULT_RES    = "High (1.0~3.0MP)";  // 默认分辨率档位（与 Python 后端保持一致）
const DEFAULT_RATIO  = "9:16";              // 默认宽高比

// ── 预设分辨率数据（与 Python 后端 RESOLUTION_DATA 完全一致）─────────────────
const RESOLUTION_DATA = {
    "Draft (0.15~0.45MP)":   { "21:9":[768,328],  "16:9":[640,360],  "3:2":[768,512],  "4:3":[512,384],  "1:1":[512,512],  "3:4":[384,512],  "2:3":[512,768],  "9:16":[360,640],  "9:21":[328,768]  },
    "Standard (0.45~1.0MP)": { "21:9":[1280,544], "16:9":[1280,720], "3:2":[1152,768], "4:3":[800,600],  "1:1":[768,768],  "3:4":[600,800],  "2:3":[768,1152], "9:16":[720,1280], "9:21":[544,1280] },
    "High (1.0~3.0MP)":      { "21:9":[2560,1080],"16:9":[1920,1080],"3:2":[1536,1024],"4:3":[1280,960], "1:1":[1024,1024],"3:4":[960,1280], "2:3":[1024,1536],"9:16":[1080,1920],"9:21":[1080,2560] },
    "Ultra (3.0~5.0MP)":     { "21:9":[3440,1440],"16:9":[2560,1440],"3:2":[2304,1536],"4:3":[2048,1536],"1:1":[1792,1792],"3:4":[1536,2048],"2:3":[1536,2304],"9:16":[1440,2560],"9:21":[1440,3440] },
};

// ── 分辨率按钮中文显示标签（两行：档位名 + 像素量范围）──────────────────────
// 注：数据 key 保持英文以匹配后端，仅 label 做中文化
const RESOLUTION_LABELS = {
    "Draft (0.15~0.45MP)": "普清 (0.15~0.45MP)",
    "Standard (0.45~1.0MP)": "标清 (0.45~1.0MP)",
    "High (1.0~3.0MP)":"高清 (1.0~3.0MP)",
    "Ultra (3.0~5.0MP)": "超清 (3.0~5.0MP)",
};

// ── 宽高比中文显示标签 ────────────────────────────────────────────────────────
const ASPECT_RATIO_LABELS = {
    "21:9":  "21:9 超宽荧幕",
    "16:9":  "16:9 手机横屏",
    "3:2":   "3:2 经典画幅",
    "4:3":   "4:3 老式标清",
    "1:1":   "1:1 标准方形",
    "3:4":   "3:4 常用竖屏",
    "2:3":   "2:3 竖屏海报",
    "9:16":  "9:16 手机竖屏",
    "9:21":  "9:21 超高竖屏",
};

// ── 宽高比分组（Landscape=横向 / Portrait=纵向 / Square=正方形）───────────────
const ASPECT_GROUPS = {
    Landscape: ["3:2", "4:3", "16:9", "21:9"],
    Portrait:  ["2:3", "3:4", "9:16", "9:21"],
    Square:    ["1:1"],
};

// 宽高比分组的中文标签
const ASPECT_GROUP_LABELS = {
    Landscape: "横向",
    Portrait:  "纵向",
    Square:    "正方形",
};

// ── SVG 图标尺寸映射 [宽, 高]，用于生成各宽高比的预览图标 ─────────────────────
const RATIO_ICON = {
    "21:9":  [42, 18], "16:9": [36, 20], "3:2":  [33, 22], "4:3":  [28, 22],
    "1:1":   [22, 22], "3:4":  [22, 28], "2:3":  [22, 33], "9:16": [20, 36], "9:21": [18, 42],
};

// ── CSS 样式（只注入一次，多节点共用）──────────────────────────────────────────
const CSS = `
.ss-wrap{padding:6px 8px;font-family:system-ui,sans-serif;user-select:none;box-sizing:border-box;width:100%;max-width:100%;overflow:hidden;display:flex;flex-direction:column;contain:layout style;position:relative}
.ss-content{flex:1;overflow:hidden;min-height:0;max-width:100%}
.ss-hidden{display:none!important;height:0!important;overflow:hidden!important;padding:0!important;margin:0!important}
.ss-sec{font-size:11px;font-weight:700;color:#9a9a9a;letter-spacing:.06em;margin:13px 0 5px;display:flex;align-items:center;gap:5px}
.ss-sec::before{content:"";width:5px;height:5px;border-radius:50%;background:#4caf80;flex-shrink:0}
.ss-mode-row{display:flex;gap:8px;margin-bottom:9px}
.ss-mode-btn{flex:1;padding:8px 12px;border-radius:6px;border:1.5px solid #3c3c3c;background:#272727;color:#b0b0b0;font-size:12px;font-weight:600;cursor:pointer;text-align:center}
.ss-mode-btn:hover{border-color:#5aaf7a;color:#e8e8e8}
.ss-mode-btn.active{background:#1a4530;border-color:#ffb347;color:#ffb347}
.ss-res-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;row-gap:10px;margin-bottom:9px}
.ss-res-btn{padding:6px 8px;border-radius:6px;border:1.5px solid #3c3c3c;background:#272727;color:#b0b0b0;font-size:10px;font-weight:600;cursor:pointer;text-align:center;display:flex;flex-direction:column;align-items:center;gap:3px;line-height:1.3}.ss-res-btn span:first-child{font-size:11px;font-weight:700;letter-spacing:.35em}.ss-res-btn span:last-child{font-size:9px;font-weight:400;opacity:0.8}
.ss-res-btn:hover{border-color:#5aaf7a;color:#e8e8e8}
.ss-res-btn.active{background:#1a4530;border-color:#ffb347;color:#ffb347}
.ss-glabel{font-size:8px;color:#666;margin:8px 0 3px 1px;letter-spacing:.04em}
.ss-ar-row{display:flex;gap:4px;margin-bottom:7px}
.ss-ar-btn{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;padding:4px 2px;border-radius:5px;border:1.5px solid #3c3c3c;background:#222;color:#aaa;cursor:pointer;min-width:0;overflow:hidden}
.ss-ar-btn .ar-icon{flex-shrink:0;display:flex;align-items:center;justify-content:center}
.ss-ar-btn .ar-ratio{font-size:11px;font-weight:600;letter-spacing:.02em}
.ss-ar-btn .ar-label{font-size:8px;color:#777;text-align:center;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}
.ss-ar-btn:hover{border-color:#5aaf7a;color:#e8e8e8}
.ss-ar-btn:hover .ar-label{color:#aaa}
.ss-ar-btn.active{background:#1a4530;border-color:#ffb347;color:#ffb347}
.ss-ar-btn.active .ar-label{color:#ffb347}
.ss-ar-btn-sq{flex-direction:row;gap:8px;padding:0 12px;justify-content:center;height:38px;box-sizing:border-box}
.ss-ar-btn-sq .ar-label{font-size:8px;white-space:nowrap;overflow:visible;max-width:none}
.ss-swap-btn{width:100%;margin-top:9px;padding:8px 0;border-radius:6px;border:1.5px solid #3c3c3c;background:#272727;color:#b0b0b0;font-size:14px;font-weight:700;cursor:pointer;text-align:center;letter-spacing:.04em}
.ss-swap-btn:hover{border-color:#5aaf7a;color:#e8e8e8;background:#1e3328}
.ss-preview{display:flex;align-items:center;justify-content:space-between;gap:6px;margin-top:13px;padding:0 12px;background:#1a4530;border-radius:6px;border:1.5px solid #ffb347;color:#fff;height:38px;box-sizing:border-box;overflow:hidden}
.ss-preview.flash{animation:ss-flash-box 0.8s ease-in-out}
@keyframes ss-flash-box{0%,100%{border-color:#ffb347;box-shadow:none}50%{border-color:#ffd700;box-shadow:0 0 15px rgba(255,215,0,0.6)}}
.ss-preview.flash .ss-preview-val{animation:ss-flash-text 0.8s ease-in-out}
@keyframes ss-flash-text{0%,100%{color:#fff}50%{color:#ffd700}}
@media(prefers-reduced-motion:reduce){.ss-preview.flash,.ss-preview.flash .ss-preview-val{animation:none!important}}
.ss-preview-lbl{font-size:16px;color:#fff;white-space:nowrap;flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis}
.ss-preview-val{font-size:17px;font-weight:800;color:#fff;letter-spacing:.08em;white-space:nowrap;flex-shrink:0;text-align:right}
.ss-copyright{margin-top:6px;margin-left:-8px;margin-right:-8px;padding:6px 10px;border-top:1px solid #2e2e2e;text-align:center;flex-shrink:0}
.ss-copyright span{color:#666;font-size:10px;letter-spacing:0.5px;white-space:nowrap}
`;

// ── 工具函数 ──────────────────────────────────────────────────────────────────

/** 根据模式返回节点固定高度（像素）：自定义模式=320，预设模式=680 */
function getFixedHeight(manual) {
    return manual ? 340 : 690;
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
 * 生成单个宽高比的 SVG 图标标记字符串。
 * @param {string} ratio - 宽高比键名，如 "16:9"
 * @param {number} S     - SVG 画布边长（像素）
 * @returns {string} SVG HTML 字符串
 */
function _buildIcon(ratio, S) {
    const [rw, rh] = RATIO_ICON[ratio] || [24, 24];
    const pad = 4;                                      // 图标内边距
    const sc = (S - pad * 2) / Math.max(rw, rh);       // 等比缩放系数
    const w  = Math.round(rw * sc);
    const h  = Math.round(rh * sc);
    const x  = Math.round((S - w) / 2);                // 水平居中偏移
    const y  = Math.round((S - h) / 2);                // 垂直居中偏移
    return `<svg width="${S}" height="${S}" viewBox="0 0 ${S} ${S}" xmlns="http://www.w3.org/2000/svg">`
         + `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2" ry="2" `
         + `fill="none" stroke="currentColor" stroke-width="1.2"/></svg>`;
}

/**
 * 预计算 SVG 图标缓存——模块加载时一次性构建，避免每次渲染重复计算。
 * ICON_CACHE：普通尺寸（36px），用于横/纵向宽高比按钮。
 * ICON_CACHE_SQ：小尺寸（22px），用于正方形按钮的行内图标。
 */
const ICON_CACHE    = Object.fromEntries(Object.keys(RATIO_ICON).map(r => [r, _buildIcon(r, 36)]));
const ICON_CACHE_SQ = Object.fromEntries(Object.keys(RATIO_ICON).map(r => [r, _buildIcon(r, 22)]));

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
    }, 30);
    return intv;
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
 * 模块加载时创建一次，flashPreview 调用时只读取 .matches，
 * 避免每次动画帧重复调用 matchMedia()。
 */
const _mqlReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)") ?? null;
/** 检测用户是否开启了"减少动效"无障碍选项 */
const _prefersReducedMotion = () => _mqlReducedMotion?.matches ?? false;

// ── 主 UI 构建函数 ────────────────────────────────────────────────────────────
function buildUI(node) {
    injectStyles();

    // 资源句柄——全部在 onRemoved 中统一清理，防止内存泄漏
    let _waitIntv            = null;  // waitForWidgets 的轮询定时器
    let _resizeInterval      = null;  // 节点高度/宽度监测定时器（500ms）
    let _vueMinWidthInterval = null;  // Vue 渲染模式最小宽度修正轮询
    let _vueMinWidthTimeout  = null;  // Vue 最小宽度修正的超时保护
    const _ac = new AbortController(); // DOM 事件监听的统一生命周期控制器

    // 注意：onRemoved 必须在 waitForWidgets 之前注册，确保节点在等待期间
    // 被删除时也能正确清理所有资源
    const _origOnRemoved = node.onRemoved;
    node.onRemoved = () => {
        clearInterval(_waitIntv);
        clearInterval(_resizeInterval);
        clearInterval(_vueMinWidthInterval);
        clearTimeout(_vueMinWidthTimeout);
        _ac.abort();           // 一次性中止所有通过 _ac.signal 注册的 DOM 监听
        _origOnRemoved?.();    // 调用原始 onRemoved（如有）
    };

    // ── 加载兼容：提前预隐藏原生 widget，避免轮询延迟期间引起错位 ─────────────────
    // 问题根因：waitForWidgets 异步触发，但 ComfyUI 从 JSON 载入时是同步的。
    // 在轮询完成之前，所有原生 widget（manW/resW/aspW 等）均处于可见状态，
    // 撑开节点高度导致 DOM 面板尚未挂载时出现布局错位。
    // 解决方案：立即将原生 widget 折叠为零高度（保留在数组中，
    // 确保 configure() 仍能按索引正确赋值），等待轮询完成后由 applyMode 按需恢复显示。
    if (node.widgets) {
        for (const w of node.widgets) {
            if (w.name === "Manual_Mode") continue; // manW 由 applyMode 管理，始终保持可见
            w.hidden = true;
            w.computeSize = () => [0, -4];
        }
    }

    // 拦截 onConfigure：工作流载入时，ComfyUI 会先通过 configure() 把 JSON 中保存的
    // node.size 写回节点，再调用 onConfigure 钩子。
    // 此处在钩子中立即根据已恢复的 Manual_Mode 值修正节点高度，
    // 防止保存值与 getFixedHeight() 不一致导致的画布错位跳动。
    const _origOnConfigure = node.onConfigure;
    node.onConfigure = function (info) {
        _origOnConfigure?.apply(this, arguments);
        if (Array.isArray(info?.widgets_values) && info.widgets_values.length > 0) {
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

        // 覆盖原生 widget 显示标签为中文（label 仅影响显示文字，
        // name 保持英文不变，确保工作流 JSON 序列化兼容性）
        if (manW) manW.label = "手动模式";
        if (resW) resW.label = "分辨率";
        if (aspW) aspW.label = "宽高比";
        if (cusW) cusW.label = "自定义宽度";
        if (cusH) cusH.label = "自定义高度";

        // 将自定义宽高夹紧到合法范围（防止旧工作流中的越界值）
        if (cusW) cusW.value = Math.max(MIN_DIMENSION, Math.min(MAX_DIMENSION, cusW.value));
        if (cusH) cusH.value = Math.max(MIN_DIMENSION, Math.min(MAX_DIMENSION, cusH.value));

        // 校验分辨率/宽高比是否在数据表中，不合法时回退到默认值
        // （兼容从旧版本或不同语言版本迁移的工作流）
        let currentRes = (resW?.value && RESOLUTION_DATA[resW.value]) ? resW.value : DEFAULT_RES;
        let currentAsp = (aspW?.value && RESOLUTION_DATA[currentRes]?.[aspW.value]) ? aspW.value : DEFAULT_RATIO;
        if (resW && resW.value !== currentRes) resW.value = currentRes;
        if (aspW && aspW.value !== currentAsp) aspW.value = currentAsp;

        let isManual         = manW?.value === "on";  // 当前是否处于自定义模式
        let baseWidth        = cusW?.value || 512;    // 自定义宽度缓存
        let baseHeight       = cusH?.value || 512;    // 自定义高度缓存
        let _updatingDisplay = false;  // 防止 updateWidgetValue 触发循环回调
        let _applyingMode    = false;  // 防止 applyMode 与 manW.callback 互相触发
        let _targetHeight    = getFixedHeight(isManual);  // 当前期望节点高度

        // 记录原始 widget 顺序，用于在显示/隐藏 widget 时恢复正确插入位置
        const _origOrder = new Map();
        node.widgets.forEach((w, i) => _origOrder.set(w, i));

        // 自定义序列化：仅保存 5 个核心 widget 的值，忽略 UI 面板 widget
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
         * 显示或隐藏一个 widget，同时从 node.widgets 数组中添加/移除，
         * 以防止 ComfyUI 在隐藏状态下仍为其预留空间。
         * @param {object}  widget - 目标 widget
         * @param {boolean} vis    - true=显示，false=隐藏
         */
        function setWidgetVis(widget, vis) {
            if (!widget || !node.widgets) return;
            widget.hidden = !vis;
            widget.computeSize = vis ? undefined : () => [0, -4]; // 隐藏时高度折叠为 0
            if (widget.element) widget.element.style.display = vis ? "" : "none";
            if (widget.inputEl)  widget.inputEl.style.display  = vis ? "" : "none";
            const inArray = node.widgets.includes(widget);
            if (!vis && inArray) {
                // 从 widgets 数组中移除，防止占位
                node.widgets.splice(node.widgets.indexOf(widget), 1);
            } else if (vis && !inArray) {
                // 按原始顺序重新插入
                const targetOrig = _origOrder.get(widget) ?? Infinity;
                let insertAt = 0;
                for (let i = 0; i < node.widgets.length; i++) {
                    if ((_origOrder.get(node.widgets[i]) ?? Infinity) < targetOrig) insertAt = i + 1;
                }
                node.widgets.splice(insertAt, 0, widget);
            }
        }

        // 设置节点最小尺寸，防止过窄导致按钮溢出
        node.minSize = [340, 150];
        if (node.size[0] < 340) node.size[0] = 340;

        // ── DOM 结构构建 ──────────────────────────────────────────────────────
        const wrap = document.createElement("div");
        wrap.className = "ss-wrap";
        // translate="no"：阻止浏览器翻译插件干扰按钮文字
        wrap.setAttribute("translate", "no");
        // 显式设置像素宽度，防止 DOM widget 在首次布局前溢出节点边界
        wrap.style.width = node.size[0] + "px";

        const contentDiv = document.createElement("div");
        contentDiv.className = "ss-content";
        wrap.appendChild(contentDiv);

        // 模式切换行（预设 / 自定义）
        const modeRow = document.createElement("div");
        modeRow.className = "ss-mode-row";

        const btnAuto = document.createElement("button");
        btnAuto.className = `ss-mode-btn${!isManual ? " active" : ""}`;
        btnAuto.textContent = "▼ 预设";

        const btnMan = document.createElement("button");
        btnMan.className = `ss-mode-btn${isManual ? " active" : ""}`;
        btnMan.textContent = "▲ 自定义";

        modeRow.append(btnAuto, btnMan);
        contentDiv.appendChild(modeRow);

        // 尺寸预览条（始终可见）
        const preview = document.createElement("div");
        preview.className = "ss-preview";
        preview.innerHTML = `<span class="ss-preview-lbl">📐 尺寸预览：</span><span class="ss-preview-val">-</span>`;

        // 预设面板（预设模式下可见）
        const autoPanel = document.createElement("div");
        autoPanel.className = isManual ? "ss-hidden" : "";

        const resSecLabel = document.createElement("div");
        resSecLabel.className = "ss-sec";
        resSecLabel.textContent = "分辨率";
        autoPanel.appendChild(resSecLabel);

        const resGrid = document.createElement("div");
        resGrid.className = "ss-res-grid";
        autoPanel.appendChild(resGrid);

        // 分辨率按钮（2×2 网格布局，两行显示：档位名 + 像素量范围）
        const resBtns = {};
        for (const lv of Object.keys(RESOLUTION_DATA)) {
            const b = document.createElement("button");
            b.className = `ss-res-btn${lv === currentRes ? " active" : ""}`;
            const label = RESOLUTION_LABELS[lv] || lv;
            // 正则拆分：第一段为名称，第二段为括号内的像素量范围
            const m = label.match(/^(\S+)\s+(\(.+\))$/);
            b.innerHTML = m ? `<span>${m[1]}</span><span>${m[2]}</span>` : label;
            b.title = lv; // 悬停显示英文原始 key，便于调试
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

        const aspSecLabel = document.createElement("div");
        aspSecLabel.className = "ss-sec";
        aspSecLabel.textContent = "宽高比";
        autoPanel.appendChild(aspSecLabel);

        contentDiv.appendChild(autoPanel);

        // 宽高比按钮（按横向/纵向/正方形分组，使用预缓存 SVG 图标）
        const aspBtns = {};
        for (const [grp, ratios] of Object.entries(ASPECT_GROUPS)) {
            // 分组标签
            const lbl = document.createElement("div");
            lbl.className = "ss-glabel";
            lbl.textContent = `- ${ASPECT_GROUP_LABELS[grp] || grp}`;
            autoPanel.appendChild(lbl);

            const row = document.createElement("div");
            row.className = "ss-ar-row";
            autoPanel.appendChild(row);

            for (const r of ratios) {
                const label     = ASPECT_RATIO_LABELS[r] || r;
                const ratioPart = label.split(" ")[0];         // 比例数字部分（如 "16:9"）
                const textPart  = label.split(" ").slice(1).join(" "); // 说明文字（如 "宽屏"）
                const isSq = grp === "Square";                 // 正方形按钮采用横排布局
                const b = document.createElement("button");
                // 使用 filter(Boolean).join(" ") 避免空字符串产生多余空格
                b.className = ["ss-ar-btn", r === currentAsp ? "active" : "", isSq ? "ss-ar-btn-sq" : ""].filter(Boolean).join(" ");
                b.title = label;
                // 直接使用预缓存图标字符串，避免重复 Math.round / 字符串拼接
                const iconSvg = isSq ? ICON_CACHE_SQ[r] : ICON_CACHE[r];
                b.innerHTML = `<span class="ar-icon">${iconSvg}</span>`
                            + `<span class="ar-ratio">${ratioPart}</span>`
                            + `<span class="ar-label">${textPart}</span>`;
                b.onclick = () => {
                    currentAsp = r;
                    aspW.value = r;
                    aspW.callback?.(r);
                    Object.entries(aspBtns).forEach(([k, btn]) => btn.classList.toggle("active", k === r));
                    syncPreview();
                    app.graph?.setDirtyCanvas(true, true);
                };
                row.appendChild(b);
                aspBtns[r] = b;
            }
        }

        // 自定义面板（自定义模式下可见）
        const manPanel = document.createElement("div");
        manPanel.className = isManual ? "" : "ss-hidden";

        // 互换宽高按钮
        const swapBtn = document.createElement("button");
        swapBtn.className = "ss-swap-btn";
        swapBtn.textContent = "⇄ 互换宽高数值";
        swapBtn.onclick = () => {
            [baseWidth, baseHeight] = [baseHeight, baseWidth];
            updateWidgetValue(cusW, baseWidth);
            updateWidgetValue(cusH, baseHeight);
            syncPreview();
            app.graph?.setDirtyCanvas(true, true);
        };
        manPanel.appendChild(swapBtn);
        contentDiv.appendChild(manPanel);
        contentDiv.appendChild(preview);

        // 版权栏
        const copyright = document.createElement("div");
        copyright.className = "ss-copyright";
        copyright.innerHTML = `<span>©2026 WOS AI Studio. Powered by 穿山阅海</span>`;
        wrap.appendChild(copyright);

        // ── 逻辑函数 ──────────────────────────────────────────────────────────

        /**
         * 触发预览条闪烁动画，提示数值已更新。
         * 当用户开启"减少动效"选项时完全跳过（CSS + JS 双重保护）。
         */
        function flashPreview() {
            if (_prefersReducedMotion()) return;
            preview.classList.remove("flash");
            void preview.offsetWidth; // 强制重排以重新触发 CSS 动画
            preview.classList.add("flash");
        }

        /**
         * 同步尺寸预览条的显示值：
         * - 预设模式：从 RESOLUTION_DATA 查表
         * - 自定义模式：读取 cusW/cusH 并对齐到 8 的倍数
         */
        function syncPreview() {
            const val = preview.querySelector(".ss-preview-val");
            if (!val) return; // 防御性检查：DOM 元素未找到时提前返回
            if (!isManual) {
                const d = RESOLUTION_DATA[currentRes]?.[currentAsp];
                val.textContent = d ? `${d[0]} × ${d[1]}` : "N/A";
            } else {
                const w = roundTo8(parseInt(cusW?.value) || baseWidth,  MAX_DIMENSION);
                const h = roundTo8(parseInt(cusH?.value) || baseHeight, MAX_DIMENSION);
                val.textContent = `${w} × ${h}`;
            }
            flashPreview();
        }

        /**
         * 以编程方式更新 widget 的值，同时刷新对应的 DOM 输入元素。
         * 设置 _updatingDisplay 标志以防止 callback 循环触发。
         * @param {object} widget - 目标 widget
         * @param {number} value  - 新值
         */
        function updateWidgetValue(widget, value) {
            if (!widget) return;
            _updatingDisplay = true;
            try {
                const maxV = widget.options?.max;
                const minV = widget.options?.min;
                // 仅在值在合法范围内时才写入，避免越界
                const inBounds = (maxV === undefined || value <= maxV) &&
                                 (minV === undefined || value >= minV);
                if (inBounds) widget.value = value;
                // 适配不同版本 ComfyUI 的 widget DOM 结构
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
         * @param {boolean} manual - true=自定义模式，false=预设模式
         */
        function applyMode(manual) {
            _applyingMode = true;
            isManual = manual;
            manW.value = manual ? "on" : "off";
            manW.callback?.(manW.value);

            btnAuto.classList.toggle("active", !manual);
            btnMan.classList.toggle("active",   manual);

            autoPanel.classList.toggle("ss-hidden",  manual);
            manPanel.classList.toggle("ss-hidden",  !manual);

            // 预设模式：显示 resW/aspW，隐藏 cusW/cusH；自定义模式反之
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
         * 同时清除 Vue 渲染模式可能注入的 height/min-height/max-height 内联样式。
         */
        function updateNodeHeight() {
            const h = getFixedHeight(isManual);
            _targetHeight = h;
            node.size = [node.size[0], h];
            wrap.style.width = node.size[0] + "px"; // 同步保持宽度一致
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

        // 监听分辨率 widget 变化（校验合法性后同步按钮与预览）
        const origRes = resW.callback;
        resW.callback = function (v) {
            if (!RESOLUTION_DATA[v]) return; // 过滤无效分辨率键
            currentRes = v;
            Object.entries(resBtns).forEach(([k, btn]) => btn.classList.toggle("active", k === v));
            syncPreview();
            origRes?.apply(this, arguments);
        };

        // 监听宽高比 widget 变化（校验合法性后同步按钮与预览）
        const origAsp = aspW.callback;
        aspW.callback = function (v) {
            if (!RESOLUTION_DATA[currentRes]?.[v]) return; // 过滤无效宽高比键
            currentAsp = v;
            Object.entries(aspBtns).forEach(([k, btn]) => btn.classList.toggle("active", k === v));
            syncPreview();
            origAsp?.apply(this, arguments);
        };

        // 自定义宽度 widget 事件绑定
        if (cusW) {
            const origW = cusW.callback;
            cusW.callback = function (v) {
                if (!_updatingDisplay) baseWidth = v;
                origW?.apply(this, arguments);
                if (isManual) syncPreview();
            };
            if (cusW.element) {
                // input 事件：实时预览（用户输入过程中触发）
                cusW.element.addEventListener("input", (e) => {
                    if (!isManual) return;
                    const input  = e.target.querySelector("input") || e.target;
                    const rawVal = parseInt(input.value) || 0;
                    if (rawVal > 0) {
                        const r = roundTo8(rawVal, MAX_DIMENSION);
                        input.value = r;
                        cusW.value  = r;
                        baseWidth   = r;
                    }
                    syncPreview();
                }, { signal: _ac.signal });
                // change 事件：输入完成时（失焦或回车）再次对齐
                cusW.element.addEventListener("change", (e) => {
                    if (!isManual) return;
                    const input  = e.target.querySelector("input") || e.target;
                    const rawVal = parseInt(input.value) || 0;
                    if (rawVal <= 0) return;
                    const r = roundTo8(rawVal, MAX_DIMENSION);
                    input.value = r;
                    cusW.value  = r;
                    baseWidth   = r;
                    syncPreview();
                }, { signal: _ac.signal });
            }
        }

        // 自定义高度 widget 事件绑定（逻辑与宽度相同）
        if (cusH) {
            const origH = cusH.callback;
            cusH.callback = function (v) {
                if (!_updatingDisplay) baseHeight = v;
                origH?.apply(this, arguments);
                if (isManual) syncPreview();
            };
            if (cusH.element) {
                cusH.element.addEventListener("input", (e) => {
                    if (!isManual) return;
                    const input  = e.target.querySelector("input") || e.target;
                    const rawVal = parseInt(input.value) || 0;
                    if (rawVal > 0) {
                        const r = roundTo8(rawVal, MAX_DIMENSION);
                        input.value = r;
                        cusH.value  = r;
                        baseHeight  = r;
                    }
                    syncPreview();
                }, { signal: _ac.signal });
                cusH.element.addEventListener("change", (e) => {
                    if (!isManual) return;
                    const input  = e.target.querySelector("input") || e.target;
                    const rawVal = parseInt(input.value) || 0;
                    if (rawVal <= 0) return;
                    const r = roundTo8(rawVal, MAX_DIMENSION);
                    input.value = r;
                    cusH.value  = r;
                    baseHeight  = r;
                    syncPreview();
                }, { signal: _ac.signal });
            }
        }

        // 覆盖 computeSize：锁定高度，同步 wrap 宽度
        const _origComputeSize = node.computeSize?.bind(node);
        node.computeSize = function (out) {
            const s = _origComputeSize
                ? _origComputeSize(out)
                : [node.size[0] || 340, getFixedHeight(isManual)];
            const w = Math.max(node.minSize?.[0] || 340, s[0]);
            wrap.style.width = w + "px";
            return [w, getFixedHeight(isManual)];
        };

        // 将 DOM 包裹器挂载为节点的 DOM widget
        node.addDOMWidget("ss_ui", "ss_panel", wrap, { getMinHeight: function () { return 0; } });

        // 应用初始模式（根据已保存的 manW.value）
        applyMode(isManual);

        // 下一帧计算版权栏实际宽度，动态设置节点最小尺寸
        requestAnimationFrame(() => {
            const copyrightSpan = copyright.querySelector("span");
            const textW = copyrightSpan?.scrollWidth || 340;
            const minW  = Math.max(textW + 16, 340);
            const minH  = 45 + 12 + (copyright.offsetHeight || 44);
            node.minSize = [minW, minH];

            // 为 Vue 渲染模式（Nodes 2.0）设置最小宽高
            const applyVueMinWidth = () => {
                if (node.element?.style) {
                    node.element.style.minWidth  = minW + "px";
                    node.element.style.minHeight = minH + "px";
                    return;
                }
                // node.element 尚未挂载时轮询等待（最多 5 秒）
                _vueMinWidthInterval = setInterval(() => {
                    if (node.element?.style) {
                        node.element.style.minWidth  = minW + "px";
                        node.element.style.minHeight = minH + "px";
                        clearInterval(_vueMinWidthInterval);
                        _vueMinWidthInterval = null;
                        clearTimeout(_vueMinWidthTimeout);
                        _vueMinWidthTimeout = null;
                    }
                }, 50);
                _vueMinWidthTimeout = setTimeout(() => {
                    clearInterval(_vueMinWidthInterval);
                    _vueMinWidthInterval = null;
                    _vueMinWidthTimeout  = null;
                }, 5000);
            };
            applyVueMinWidth();
        });

        // ── 高度/宽度监测定时器（性能优化版）────────────────────────────────
        // 间隔从 100ms 降至 500ms（减少 80% 的 CPU 轮询）。
        // 标签页隐藏时（document.hidden）自动暂停，消除后台 CPU 占用。
        let _lastHeight   = node.size[1];
        let _resizePaused = document.hidden;

        // 监听页面可见性变化，隐藏时暂停监测
        document.addEventListener(
            "visibilitychange",
            () => { _resizePaused = document.hidden; },
            { signal: _ac.signal }
        );

        let _lastWidth = node.size[0];
        _resizeInterval = setInterval(() => {
            if (_resizePaused) return;
            const curH = node.size[1];
            const curW = node.size[0];
            // 水平方向调整：同步 wrap 宽度
            if (curW !== _lastWidth) {
                _lastWidth = curW;
                wrap.style.width = curW + "px";
            }
            // 高度未变化时跳过，避免无效更新
            if (curH === _lastHeight) return;
            _lastHeight = curH;
            // 高度偏离目标时纠正（防止 ComfyUI 自动调整破坏固定高度）
            if (curH !== _targetHeight) updateNodeHeight();
        }, 500);
    });
}

// ── 注册 ComfyUI 扩展 ────────────────────────────────────────────────────────
app.registerExtension({
    name: "Size_Selection",
    async beforeRegisterNodeDef(nodeType, nodeData) {
        // 仅处理目标节点类型
        if (nodeData.name !== "ComfyUI_Size_Selection") return;
        const _orig = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function () {
            _orig?.apply(this, arguments);
            buildUI(this); // 在节点创建后挂载 UI
        };
    },
});
