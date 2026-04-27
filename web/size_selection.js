/**
 * ComfyUI Size Selection Node - Frontend UI Extension
 *
 * Features:
 *   - Preset mode: button selection of resolution tier x aspect ratio, live preview
 *   - Custom mode: numeric input for custom width/height, with one-click swap
 *   - Compatible with classic LiteGraph canvas and Nodes 2.0 Vue render mode
 *
 * Performance optimisations (v1.1):
 *   - SVG icons pre-computed once at module load (ICON_CACHE), not per render
 *   - Height-monitor interval reduced to 500 ms; auto-paused when tab is hidden
 *   - Flash animation respects prefers-reduced-motion (CSS + JS double guard)
 *
 * Memory management:
 *   - AbortController manages all DOM event listeners, cleaned up on node removal
 *   - All setInterval/setTimeout handles cleared in onRemoved hook
 *
 * @version:1.1
 * @author:穿山阅海
 */

import { app } from "../../scripts/app.js";

// ── Constants ─────────────────────────────────────────────────────────────────
const MAX_DIMENSION  = 2048;
const MIN_DIMENSION  = 256;
const DEFAULT_RES    = "High (1.0~3.0MP)";
const DEFAULT_RATIO  = "9:16";

// ── Preset resolution data (mirrors Python backend) ───────────────────────────
const RESOLUTION_DATA = {
    "Draft (0.15~0.45MP)":   { "21:9":[768,328],  "16:9":[640,360],  "3:2":[768,512],  "4:3":[512,384],  "1:1":[512,512],  "3:4":[384,512],  "2:3":[512,768],  "9:16":[360,640],  "9:21":[328,768]  },
    "Standard (0.45~1.0MP)": { "21:9":[1280,544], "16:9":[1280,720], "3:2":[1152,768], "4:3":[800,600],  "1:1":[768,768],  "3:4":[600,800],  "2:3":[768,1152], "9:16":[720,1280], "9:21":[544,1280] },
    "High (1.0~3.0MP)":      { "21:9":[2560,1080],"16:9":[1920,1080],"3:2":[1536,1024],"4:3":[1280,960], "1:1":[1024,1024],"3:4":[960,1280], "2:3":[1024,1536],"9:16":[1080,1920],"9:21":[1080,2560] },
    "Ultra (3.0~5.0MP)":     { "21:9":[3440,1440],"16:9":[2560,1440],"3:2":[2304,1536],"4:3":[2048,1536],"1:1":[1792,1792],"3:4":[1536,2048],"2:3":[1536,2304],"9:16":[1440,2560],"9:21":[1440,3440] },
};

// ── Resolution button labels (two-line: name + range) ─────────────────────────
const RESOLUTION_LABELS = {
    "Draft (0.15~0.45MP)":   "Draft (0.15~0.45MP)",
    "Standard (0.45~1.0MP)": "Standard (0.45~1.0MP)",
    "High (1.0~3.0MP)":      "High (1.0~3.0MP)",
    "Ultra (3.0~5.0MP)":     "Ultra (3.0~5.0MP)",
};

// ── Aspect ratio display labels ────────────────────────────────────────────────
const ASPECT_RATIO_LABELS = {
    "21:9":  "21:9 Ultrawide",
    "16:9":  "16:9 Widescreen",
    "3:2":   "3:2 Photo Standard",
    "4:3":   "4:3 Fullscreen",
    "1:1":   "1:1 Square",
    "3:4":   "3:4 Portrait",
    "2:3":   "2:3 Tall Portrait",
    "9:16":  "9:16 Mobile Vertical",
    "9:21":  "9:21 Ultra Tall",
};

// ── Aspect ratio groups ────────────────────────────────────────────────────────
const ASPECT_GROUPS = {
    Landscape: ["3:2", "4:3", "16:9", "21:9"],
    Portrait:  ["2:3", "3:4", "9:16", "9:21"],
    Square:    ["1:1"],
};

const ASPECT_GROUP_LABELS = {
    Landscape: "Landscape",
    Portrait:  "Portrait",
    Square:    "Square",
};

// ── SVG icon dimensions [w, h] for each aspect ratio ──────────────────────────
const RATIO_ICON = {
    "21:9":  [42, 18], "16:9": [36, 20], "3:2":  [33, 22], "4:3":  [28, 22],
    "1:1":   [22, 22], "3:4":  [22, 28], "2:3":  [22, 33], "9:16": [20, 36], "9:21": [18, 42],
};

// ── CSS (injected once, reused across nodes) ───────────────────────────────────
const CSS = `
.ss-wrap{padding:6px 8px;font-family:system-ui,sans-serif;user-select:none;box-sizing:border-box;width:100%;overflow:hidden;display:flex;flex-direction:column}
.ss-content{flex:1;overflow:hidden;min-height:0}
.ss-hidden{display:none!important;height:0!important;overflow:hidden!important;padding:0!important;margin:0!important}
.ss-sec{font-size:11px;font-weight:700;color:#9a9a9a;letter-spacing:.06em;margin:13px 0 5px;display:flex;align-items:center;gap:5px}
.ss-sec::before{content:"";width:5px;height:5px;border-radius:50%;background:#4caf80;flex-shrink:0}
.ss-mode-row{display:flex;gap:8px;margin-bottom:9px}
.ss-mode-btn{flex:1;padding:8px 12px;border-radius:6px;border:1.5px solid #3c3c3c;background:#272727;color:#b0b0b0;font-size:10px;font-weight:600;cursor:pointer;text-align:center}
.ss-mode-btn:hover{border-color:#5aaf7a;color:#e8e8e8}
.ss-mode-btn.active{background:#1a4530;border-color:#ffb347;color:#ffb347}
.ss-res-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;row-gap:10px;margin-bottom:9px}
.ss-res-btn{padding:6px 8px;border-radius:6px;border:1.5px solid #3c3c3c;background:#272727;color:#b0b0b0;font-size:10px;font-weight:600;cursor:pointer;text-align:center;display:flex;flex-direction:column;align-items:center;gap:2px;line-height:1.3}.ss-res-btn span:first-child{font-size:11px;font-weight:700}.ss-res-btn span:last-child{font-size:9px;font-weight:400;opacity:0.8}
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
.ss-swap-btn{width:100%;margin-top:9px;padding:6px 0;border-radius:6px;border:1.5px solid #3c3c3c;background:#272727;color:#b0b0b0;font-size:11px;font-weight:700;cursor:pointer;text-align:center;letter-spacing:.04em}
.ss-swap-btn:hover{border-color:#5aaf7a;color:#e8e8e8;background:#1e3328}
.ss-preview{display:flex;align-items:center;justify-content:space-between;gap:6px;margin-top:13px;padding:0 12px;background:#1a4530;border-radius:6px;border:1.5px solid #ffb347;color:#fff;height:38px;box-sizing:border-box;overflow:hidden}
.ss-preview.flash{animation:ss-flash-box 0.8s ease-in-out}
@keyframes ss-flash-box{0%,100%{border-color:#ffb347;box-shadow:none}50%{border-color:#ffd700;box-shadow:0 0 15px rgba(255,215,0,0.6)}}
.ss-preview.flash .ss-preview-val{animation:ss-flash-text 0.8s ease-in-out}
@keyframes ss-flash-text{0%,100%{color:#fff}50%{color:#ffd700}}
@media(prefers-reduced-motion:reduce){.ss-preview.flash,.ss-preview.flash .ss-preview-val{animation:none!important}}
.ss-preview-lbl{font-size:12px;color:#fff;white-space:nowrap;flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis}
.ss-preview-val{font-size:13px;font-weight:800;color:#fff;letter-spacing:.08em;white-space:nowrap;flex-shrink:0;text-align:right}
.ss-copyright{margin-top:6px;margin-left:-8px;margin-right:-8px;padding:6px 10px;border-top:1px solid #2e2e2e;text-align:center;flex-shrink:0}
.ss-copyright span{color:#666;font-size:10px;letter-spacing:0.5px;white-space:nowrap}
`;

// ── Utilities ─────────────────────────────────────────────────────────────────

/** Returns fixed node height for the given mode */
function getFixedHeight(manual) {
    return manual ? 320 : 680;
}

/** Inject CSS into document head (idempotent) */
let _stylesInjected = false;
function injectStyles() {
    if (_stylesInjected || document.getElementById("ss-styles")) return;
    _stylesInjected = true;
    const s = document.createElement("style");
    s.id = "ss-styles";
    s.textContent = CSS;
    document.head.appendChild(s);
}

/** Generate SVG markup for a single aspect ratio icon */
function _buildIcon(ratio, S) {
    const [rw, rh] = RATIO_ICON[ratio] || [24, 24];
    const pad = 4;
    const sc = (S - pad * 2) / Math.max(rw, rh);
    const w  = Math.round(rw * sc);
    const h  = Math.round(rh * sc);
    const x  = Math.round((S - w) / 2);
    const y  = Math.round((S - h) / 2);
    return `<svg width="${S}" height="${S}" viewBox="0 0 ${S} ${S}" xmlns="http://www.w3.org/2000/svg">`
         + `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2" ry="2" `
         + `fill="none" stroke="currentColor" stroke-width="1.2"/></svg>`;
}

/**
 * Pre-computed SVG icon cache — built once at module load.
 * Keyed by ratio string; two sizes: normal (36px) and square (22px).
 * Avoids repeated string construction and Math.round calls per render.
 */
const ICON_CACHE    = Object.fromEntries(Object.keys(RATIO_ICON).map(r => [r, _buildIcon(r, 36)]));
const ICON_CACHE_SQ = Object.fromEntries(Object.keys(RATIO_ICON).map(r => [r, _buildIcon(r, 22)]));

/**
 * Poll until all named widgets are ready, then invoke callback.
 * Returns the interval handle for cleanup in onRemoved.
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
            console.warn("[SizeSelection] Widget wait timed out:", names);
        }
    }, 30);
    return intv;
}

/** Clamp value to [MIN_DIMENSION, maxV] and round down to nearest multiple of 8 */
function roundTo8(v, maxV = MAX_DIMENSION) {
    const n = Math.max(MIN_DIMENSION, Math.min(maxV, Number(v) || MIN_DIMENSION));
    return Math.floor(n / 8) * 8;
}

/**
 * Checks whether the user has requested reduced motion.
 * Used to skip the flash animation at the JS level (CSS media query is the
 * primary guard; this is a secondary defence for browsers that animate
 * despite the query, e.g. some Electron builds).
 */
const _prefersReducedMotion = () =>
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

// ── Main UI builder ───────────────────────────────────────────────────────────
function buildUI(node) {
    injectStyles();

    // Resource handles — all cleaned up in onRemoved
    let _waitIntv            = null;
    let _resizeInterval      = null;
    let _vueMinWidthInterval = null;
    let _vueMinWidthTimeout  = null;
    const _ac = new AbortController();

    // Register onRemoved BEFORE waitForWidgets so cleanup runs even if node
    // is deleted while still waiting for widgets to appear
    const _origOnRemoved = node.onRemoved;
    node.onRemoved = () => {
        clearInterval(_waitIntv);
        clearInterval(_resizeInterval);
        clearInterval(_vueMinWidthInterval);
        clearTimeout(_vueMinWidthTimeout);
        _ac.abort();
        _origOnRemoved?.();
    };

    _waitIntv = waitForWidgets(node, ["Resolution", "Aspect_Ratio", "Manual_Mode"], () => {
        const resW = node.widgets.find(w => w.name === "Resolution");
        const aspW = node.widgets.find(w => w.name === "Aspect_Ratio");
        const manW = node.widgets.find(w => w.name === "Manual_Mode");
        const cusW = node.widgets.find(w => w.name === "Custom_Width");
        const cusH = node.widgets.find(w => w.name === "Custom_Height");

        // Clamp custom dimensions to valid range
        if (cusW) cusW.value = Math.max(MIN_DIMENSION, Math.min(MAX_DIMENSION, cusW.value));
        if (cusH) cusH.value = Math.max(MIN_DIMENSION, Math.min(MAX_DIMENSION, cusH.value));

        // Validate resolution/ratio against data; fall back to defaults if stale
        let currentRes = (resW?.value && RESOLUTION_DATA[resW.value]) ? resW.value : DEFAULT_RES;
        let currentAsp = (aspW?.value && RESOLUTION_DATA[currentRes]?.[aspW.value]) ? aspW.value : DEFAULT_RATIO;
        if (resW && resW.value !== currentRes) resW.value = currentRes;
        if (aspW && aspW.value !== currentAsp) aspW.value = currentAsp;

        let isManual         = manW?.value === "on";
        let baseWidth        = cusW?.value || 512;
        let baseHeight       = cusH?.value || 512;
        let _updatingDisplay = false;
        let _applyingMode    = false;
        let _targetHeight    = getFixedHeight(isManual);

        // Track original widget order for restoring visibility
        const _origOrder = new Map();
        node.widgets.forEach((w, i) => _origOrder.set(w, i));

        // Custom serialization: save only the 5 core widget values
        const _origSerialize = node.serialize?.bind(node);
        node.serialize = function () {
            const data = _origSerialize ? _origSerialize() : {};
            const coreWidgets = [manW, resW, aspW, cusW, cusH].filter(Boolean);
            data.widgets_values = coreWidgets
                .filter(w => w.options?.serialize !== false)
                .map(w => w.value);
            return data;
        };

        /** Show or hide a widget, also inserting/removing it from node.widgets */
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

        node.minSize = [340, 150];
        if (node.size[0] < 340) node.size[0] = 340;

        // ── DOM structure ─────────────────────────────────────────────────────
        const wrap = document.createElement("div");
        wrap.className = "ss-wrap";

        const contentDiv = document.createElement("div");
        contentDiv.className = "ss-content";
        wrap.appendChild(contentDiv);

        // Mode toggle row
        const modeRow = document.createElement("div");
        modeRow.className = "ss-mode-row";

        const btnAuto = document.createElement("button");
        btnAuto.className = `ss-mode-btn ${!isManual ? "active" : ""}`;
        btnAuto.textContent = "▼ Preset";

        const btnMan = document.createElement("button");
        btnMan.className = `ss-mode-btn ${isManual ? "active" : ""}`;
        btnMan.textContent = "▲ Custom";

        modeRow.append(btnAuto, btnMan);
        contentDiv.appendChild(modeRow);

        // Size preview bar
        const preview = document.createElement("div");
        preview.className = "ss-preview";
        preview.innerHTML = `<span class="ss-preview-lbl">📐 Size Preview:</span><span class="ss-preview-val">-</span>`;

        // Preset panel
        const autoPanel = document.createElement("div");
        autoPanel.className = isManual ? "ss-hidden" : "";

        const resSecLabel = document.createElement("div");
        resSecLabel.className = "ss-sec";
        resSecLabel.textContent = "Resolution";
        autoPanel.appendChild(resSecLabel);

        const resGrid = document.createElement("div");
        resGrid.className = "ss-res-grid";
        autoPanel.appendChild(resGrid);

        // Resolution buttons
        const resBtns = {};
        for (const lv of Object.keys(RESOLUTION_DATA)) {
            const b = document.createElement("button");
            b.className = `ss-res-btn ${lv === currentRes ? "active" : ""}`;
            const label = RESOLUTION_LABELS[lv] || lv;
            const m = label.match(/^(\S+)\s+(\(.+\))$/);
            b.innerHTML = m ? `<span>${m[1]}</span><span>${m[2]}</span>` : label;
            b.title = lv;
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
        aspSecLabel.textContent = "Aspect Ratio";
        autoPanel.appendChild(aspSecLabel);

        contentDiv.appendChild(autoPanel);

        // Aspect ratio buttons (grouped) — use pre-cached SVG icons
        const aspBtns = {};
        for (const [grp, ratios] of Object.entries(ASPECT_GROUPS)) {
            const lbl = document.createElement("div");
            lbl.className = "ss-glabel";
            lbl.textContent = `- ${ASPECT_GROUP_LABELS[grp] || grp}`;
            autoPanel.appendChild(lbl);

            const row = document.createElement("div");
            row.className = "ss-ar-row";
            autoPanel.appendChild(row);

            for (const r of ratios) {
                const label     = ASPECT_RATIO_LABELS[r] || r;
                const ratioPart = label.split(" ")[0];
                const textPart  = label.split(" ").slice(1).join(" ");
                const isSq = grp === "Square";
                const b = document.createElement("button");
                b.className = `ss-ar-btn ${r === currentAsp ? "active" : ""} ${isSq ? "ss-ar-btn-sq" : ""}`;
                b.title = label;
                // Use pre-cached icon string — avoids repeated Math.round / string build
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

        // Custom panel
        const manPanel = document.createElement("div");
        manPanel.className = isManual ? "" : "ss-hidden";

        const swapBtn = document.createElement("button");
        swapBtn.className = "ss-swap-btn";
        swapBtn.textContent = "↕ Swap Width / Height";
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

        // Copyright bar
        const copyright = document.createElement("div");
        copyright.className = "ss-copyright";
        copyright.innerHTML = `<span>©2026 WOS AI Studio. Powered by 穿山阅海</span>`;
        wrap.appendChild(copyright);

        // ── Logic functions ───────────────────────────────────────────────────

        /**
         * Flash the preview bar to signal a value change.
         * Skipped entirely when prefers-reduced-motion is set (CSS + JS guard).
         */
        function flashPreview() {
            if (_prefersReducedMotion()) return;
            preview.classList.remove("flash");
            void preview.offsetWidth; // force reflow to re-trigger animation
            preview.classList.add("flash");
        }

        function syncPreview() {
            const val = preview.querySelector(".ss-preview-val");
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

        function applyMode(manual) {
            _applyingMode = true;
            isManual = manual;
            manW.value = manual ? "on" : "off";
            manW.callback?.(manW.value);

            btnAuto.classList.toggle("active", !manual);
            btnMan.classList.toggle("active",   manual);

            autoPanel.classList.toggle("ss-hidden",  manual);
            manPanel.classList.toggle("ss-hidden",  !manual);

            setWidgetVis(resW, !manual);
            setWidgetVis(aspW, !manual);
            setWidgetVis(cusW,  manual);
            setWidgetVis(cusH,  manual);

            syncPreview();
            updateNodeHeight();
            _applyingMode = false;
        }

        function updateNodeHeight() {
            const h = getFixedHeight(isManual);
            _targetHeight = h;
            node.size = [node.size[0], h];
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

        btnAuto.onclick = () => applyMode(false);
        btnMan.onclick  = () => applyMode(true);

        const origMan = manW.callback;
        manW.callback = function (v) {
            origMan?.apply(this, arguments);
            if (!_applyingMode) applyMode(v === "on");
        };

        const origRes = resW.callback;
        resW.callback = function (v) {
            currentRes = v;
            Object.entries(resBtns).forEach(([k, btn]) => btn.classList.toggle("active", k === v));
            syncPreview();
            origRes?.apply(this, arguments);
        };

        const origAsp = aspW.callback;
        aspW.callback = function (v) {
            currentAsp = v;
            Object.entries(aspBtns).forEach(([k, btn]) => btn.classList.toggle("active", k === v));
            syncPreview();
            origAsp?.apply(this, arguments);
        };

        if (cusW) {
            const origW = cusW.callback;
            cusW.callback = function (v) {
                if (!_updatingDisplay) baseWidth = v;
                origW?.apply(this, arguments);
                if (isManual) syncPreview();
            };
            if (cusW.element) {
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

        const _origComputeSize = node.computeSize?.bind(node);
        node.computeSize = function (out) {
            const s = _origComputeSize
                ? _origComputeSize(out)
                : [node.size[0] || 340, getFixedHeight(isManual)];
            return [Math.max(node.minSize?.[0] || 340, s[0]), getFixedHeight(isManual)];
        };

        node.addDOMWidget("ss_ui", "ss_panel", wrap, { getMinHeight() { return 0; } });

        applyMode(isManual);

        requestAnimationFrame(() => {
            const copyrightSpan = copyright.querySelector("span");
            const textW = copyrightSpan?.scrollWidth || 340;
            const minW  = Math.max(textW + 16, 340);
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
                }, 50);
                _vueMinWidthTimeout = setTimeout(() => {
                    clearInterval(_vueMinWidthInterval);
                    _vueMinWidthInterval = null;
                    _vueMinWidthTimeout  = null;
                }, 5000);
            };
            applyVueMinWidth();
        });

        // ── Height monitor (optimised) ────────────────────────────────────────
        // Interval reduced from 100 ms to 500 ms (-80% tick rate).
        // Automatically paused when the browser tab/window is hidden
        // (document.visibilityState === "hidden") to eliminate background CPU use.
        let _lastHeight    = node.size[1];
        let _resizePaused  = document.hidden;

        document.addEventListener(
            "visibilitychange",
            () => { _resizePaused = document.hidden; },
            { signal: _ac.signal }
        );

        _resizeInterval = setInterval(() => {
            if (_resizePaused) return;
            const cur = node.size[1];
            if (cur === _lastHeight) return;
            _lastHeight = cur;
            if (cur !== _targetHeight) updateNodeHeight();
        }, 500);
    });
}

// ── Register ComfyUI extension ────────────────────────────────────────────────
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
