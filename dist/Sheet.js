import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { Children, cloneElement, createContext, isValidElement, useContext, useEffect, useRef, useState } from 'react';
import { IconAlignLeft, IconArchive, IconArchiveOff, IconArrowDown, IconArrowUp, IconBoxPadding, IconDeviceFloppy, IconLock, IconLockOpen, IconLayoutBottombar, IconLayoutGrid, IconTypography, IconMaximize, IconMovie, IconPalette, IconPlayerPauseFilled, IconPlayerPlayFilled, IconPhoto, IconPlus, IconRestore, IconTrash, IconUpload, IconX, IconZoomIn, IconZoomOut } from '@tabler/icons-react';
import { createPortal } from 'react-dom';
import ReactGridLayout, { getCompactor } from 'react-grid-layout';
import { createScaledStrategy } from 'react-grid-layout/core';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
// Sheet = A4 at 1600px on the long side (landscape for the pagine, portrait for the thesis covers),
// on a 48 x 48 support grid so cards can be dragged and resized finely. Sheets are laid out in design
// columns, converted to units with one rounding rule (rounding edges, not widths), so cards that touch keep touching.
// margin = page margin, gap = space between cards (px), both editable per document
// page = the @page size for the PDF, mm = printed long side (sets the print zoom);
// margin = top and bottom, marginX = left and right (px of the sheet: 1600px = 297mm, so 1cm = 53.87px)
export const LANDSCAPE = { w: 1600, h: 1131.36, foot: true, margin: 18, marginX: 18, gap: 18, page: 'A4 landscape', mm: 297 };
export const PORTRAIT = { w: 1131.36, h: 1600, foot: false, margin: 18, marginX: 18, gap: 30, page: 'A4 portrait', mm: 297 };
// Sizes in millimetres: the long side is 1600px = 297mm
export const mm = (v) => (v * 1600) / 297;
// Slides: 16:9 at the same width as the A4 landscape sheets
export const SLIDE = { w: 1600, h: 900, foot: true, margin: 18, marginX: 18, gap: 18, page: '297mm 167.06mm', mm: 297 };
export const FormatContext = createContext(LANDSCAPE);
export const EngineContext = createContext({ footer: [], footerKey: '__footer', logoMono: '', backgrounds: ['#FFFFFF'] });
const UNITS = 48;
// data-u values are written in thirds of a design column (the old grid): converted at runtime
const OLD_SUB = 3;
const ROWS = 48;
// One line of footer at the bottom of every sheet, outside the grid
const FOOT = 34;
const footHtml = (items) => items.map(t => `<span>${t}</span>`).join('<i class="sheet-foot-dot" aria-hidden="true"></i>');
// The footer text is one editable text per document: editing it on any page changes every page of that document
function FooterText({ editable }) {
    const { texts, setText } = useContext(LayoutsContext);
    const { footer, footerKey: FOOT_KEY } = useContext(EngineContext);
    const FOOT_HTML = footHtml(footer);
    const ref = useRef(null);
    const t = texts[FOOT_KEY];
    const want = t && t.orig === FOOT_HTML ? t.html : FOOT_HTML;
    useEffect(() => {
        const el = ref.current;
        if (el && document.activeElement !== el && el.innerHTML !== want)
            el.innerHTML = want;
    }, [want]);
    return (_jsx("span", { ref: ref, className: "sheet-foot-text", contentEditable: editable, suppressContentEditableWarning: true, onInput: e => setText(FOOT_KEY, e.currentTarget.innerHTML === FOOT_HTML ? null : { orig: FOOT_HTML, html: e.currentTarget.innerHTML }) }));
}
const rowH = (gridH, margin, gap) => (gridH - 2 * margin - (ROWS - 1) * gap) / ROWS;
// Optional title bar at the top, same height as the footer, outside the grid
const HEAD = 34;
export const PageContext = createContext({ n: 1, of: 1, title: '' });
// Sheet name in the tools bar: click to rename inline (Enter saves, Esc cancels); empty restores the default
function SheetName({ n, title, onRename }) {
    const [draft, setDraft] = useState(null);
    if (!onRename)
        return _jsxs("span", { className: "sheet-tools-name", children: [n, ". ", title] });
    if (draft === null)
        return _jsxs("button", { type: "button", className: "sheet-tools-name is-editable", title: "Rinomina", onClick: () => setDraft(title), children: [n, ". ", title] });
    const done = (save) => { if (save)
        onRename(draft); setDraft(null); };
    return (_jsxs("span", { className: "sheet-tools-name", children: [n, ".", ' ', _jsx("input", { className: "sheet-rename", autoFocus: true, value: draft, "aria-label": "Nome della pagina", onChange: e => setDraft(e.target.value), onFocus: e => e.target.select(), onKeyDown: e => { if (e.key === 'Enter')
                    done(true); if (e.key === 'Escape')
                    done(false); }, onBlur: () => done(true) })] }));
}
// Zoom applied to the sheets (to fit next to the sidebar): the grid needs it to keep dragging precise
export const ScaleContext = createContext(1);
// The library's scaled strategy computes the drag start against the viewport (the card jumps):
// without calcDragPosition the grid falls back to parent-relative math, still divided by the scale
const scaled = (s) => ({ ...createScaledStrategy(s), calcDragPosition: undefined });
export const LayoutsContext = createContext({
    saved: {}, save: () => { }, texts: {}, setText: () => { }, cards: {}, setCards: () => { }, saveSheet: () => { }, pendingIn: () => 0, mode: 'layout',
});
// Every leaf of text a viewer can rewrite in text mode
export const TEXT = 'h2, h3, p, li > span, li > b, dt, dd, .chip, .type-font-title, .type-font-desc, .tw-sample, .tl-num';
// Children.toArray prefixes keys with their position (".1:$x"): keep only the name
const clean = (k) => String(k).replace(/^.*\$/, '');
const asExtra = (e) => (typeof e === 'string' ? { i: e, kind: 'text' } : e);
// Light or dark background, judged on the first colour of the value (gradients start light here)
const isLight = (bg) => {
    const hex = bg.match(/#([0-9a-f]{6})/i)?.[1] ?? 'ffffff';
    const [r, g, b] = [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16));
    return 0.299 * r + 0.587 * g + 0.114 * b > 150;
};
const MIN = 3;
const overlaps = (a0, a1, b0, b1) => a0 < b1 && b0 < a1;
// Resizing works like a splitter on every side: the cells touching the moved edge
// give or take the same space, never below MIN.
function shareEdge(layout, o, n) {
    const out = layout.map(l => ({ ...l }));
    const me = out.find(l => l.i === n.i);
    const others = out.filter(l => l !== me);
    const rowsTouch = (l) => overlaps(l.y, l.y + l.h, o.y, o.y + o.h);
    const colsTouch = (l) => overlaps(l.x, l.x + l.w, o.x, o.x + o.w);
    const east = others.filter(l => l.x === o.x + o.w && rowsTouch(l));
    const west = others.filter(l => l.x + l.w === o.x && rowsTouch(l));
    const south = others.filter(l => l.y === o.y + o.h && colsTouch(l));
    const north = others.filter(l => l.y + l.h === o.y && colsTouch(l));
    // growth of each edge (positive = the card gets bigger on that side)
    let dE = n.x + n.w - (o.x + o.w);
    let dW = o.x - n.x;
    let dS = n.y + n.h - (o.y + o.h);
    let dN = o.y - n.y;
    const cap = (d, ls, size) => d > 0 ? ls.reduce((m, l) => Math.min(m, Math.max(0, size(l) - MIN)), d) : d;
    dE = cap(dE, east, l => l.w);
    dW = cap(dW, west, l => l.w);
    dS = cap(dS, south, l => l.h);
    dN = cap(dN, north, l => l.h);
    me.x = o.x - dW;
    me.w = o.w + dW + dE;
    me.y = o.y - dN;
    me.h = o.h + dN + dS;
    for (const l of east) {
        l.x += dE;
        l.w -= dE;
    }
    for (const l of west)
        l.w -= dW;
    for (const l of south) {
        l.y += dS;
        l.h -= dS;
    }
    for (const l of north)
        l.h -= dN;
    return out;
}
// "2 / 4" or "3" (CSS grid lines) -> [start, span]
const lines = (v, fallback) => {
    if (v == null)
        return [fallback, 1];
    const [a, b] = String(v).split('/').map(n => parseFloat(n));
    return [a - 1, (b || a + 1) - a];
};
// design column edge -> grid unit
const toUnit = (col, cols) => Math.round((col * UNITS) / cols);
// fr weights -> cumulative unit boundaries summing to ROWS
const rowEdges = (fr) => {
    const total = fr.reduce((a, b) => a + b, 0);
    let acc = 0;
    return [0, ...fr.map(f => Math.round(((acc += f) / total) * ROWS))];
};
function CardBar({ isImage, isVideo, pad, onPad, onScale, onBg, onImage, onRemove }) {
    const [colors, setColors] = useState(false);
    const { backgrounds } = useContext(EngineContext);
    // Inner margin of the card; starts from the padding the CSS gives it now
    const [padOpen, setPadOpen] = useState(null);
    const bar = useRef(null);
    const openPad = () => {
        if (padOpen !== null)
            return setPadOpen(null);
        const cell = bar.current?.parentElement?.querySelector(':scope > .cell');
        setPadOpen(pad ?? Math.round(parseFloat(cell ? getComputedStyle(cell).paddingTop : '28')));
    };
    const I = { size: 15, stroke: 1.75 };
    return (_jsxs("div", { className: "card-bar", ref: bar, onMouseDown: e => e.stopPropagation(), children: [_jsx("button", { type: "button", title: "Immagine pi\u00F9 piccola", onClick: () => onScale(1 / 1.1), children: _jsx(IconZoomOut, { ...I }) }), _jsx("button", { type: "button", title: "Immagine pi\u00F9 grande", onClick: () => onScale(1.1), children: _jsx(IconZoomIn, { ...I }) }), isImage && _jsx("button", { type: "button", title: isVideo ? 'Cambia video' : 'Cambia immagine', onClick: onImage, children: isVideo ? _jsx(IconMovie, { ...I }) : _jsx(IconPhoto, { ...I }) }), _jsx("button", { type: "button", title: "Margine interno", className: padOpen !== null ? 'on' : '', onClick: openPad, children: _jsx(IconBoxPadding, { ...I }) }), _jsx("button", { type: "button", title: "Sfondo", className: colors ? 'on' : '', onClick: () => setColors(c => !c), children: _jsx(IconPalette, { ...I }) }), _jsx("button", { type: "button", title: "Elimina card", onClick: onRemove, children: _jsx(IconTrash, { ...I }) }), padOpen !== null && (_jsxs("div", { className: "card-colors card-pad", children: [_jsx("span", { children: "Margine interno" }), _jsx("input", { type: "range", min: 0, max: 160, step: 2, value: padOpen, onChange: e => { const v = +e.target.value; setPadOpen(v); onPad(v); } }), _jsxs("b", { children: [padOpen, " px"] }), _jsx("button", { type: "button", className: "card-colors-reset", onClick: () => { onPad(null); setPadOpen(null); }, children: "Originale" })] })), colors && (_jsxs("div", { className: "card-colors", children: [backgrounds.map(c => (_jsx("button", { type: "button", title: c.startsWith('linear') ? 'Gradiente' : c, onClick: () => onBg(c), children: _jsx("span", { className: "swatch-dot", style: { background: c } }) }, c))), _jsx("button", { type: "button", title: "Sfondo originale", className: "card-colors-reset", onClick: () => onBg(null), children: "Originale" })] }))] }));
}
// In-app gallery: every image in public/img, plus upload from disk (dev server only)
function Gallery({ onPick, onClose, inUse, video }) {
    const [images, setImages] = useState(null);
    const [confirm, setConfirm] = useState(null);
    const refresh = () => fetch(video ? '/__images?kind=video' : '/__images').then(r => r.json()).then(setImages).catch(() => setImages([]));
    useEffect(() => { refresh(); }, []);
    const upload = async (file) => {
        const res = await fetch(`/__upload?name=${encodeURIComponent(file.name)}${video ? '&kind=video' : ''}`, { method: 'POST', body: file });
        if (res.ok)
            onPick(await res.text());
    };
    // Two clicks: the first arms the delete, the second moves the file to .trash/
    const remove = async (src) => {
        if (confirm !== src)
            return setConfirm(src);
        await fetch(`/__delete-image?src=${encodeURIComponent(src)}`, { method: 'POST' });
        setConfirm(null);
        refresh();
    };
    // portal: the sheet is scaled with a transform, which would trap a fixed modal inside it
    return createPortal(_jsx("div", { className: "modal-back", onMouseDown: onClose, children: _jsxs("div", { className: "modal", role: "dialog", "aria-label": video ? 'Scegli un video' : "Scegli un'immagine", onMouseDown: e => e.stopPropagation(), children: [_jsxs("header", { children: [_jsx("span", { children: video ? 'Scegli un video' : "Scegli un'immagine" }), _jsxs("label", { className: "modal-upload", children: [_jsx(IconUpload, { size: 15, stroke: 1.75 }), "Carica dal computer", _jsx("input", { type: "file", accept: video ? 'video/mp4,video/webm' : 'image/png,image/jpeg,image/webp', hidden: true, onChange: e => e.target.files?.[0] && upload(e.target.files[0]) })] }), _jsx("button", { type: "button", onClick: onClose, "aria-label": "Chiudi", children: _jsx(IconX, { size: 16, stroke: 1.75 }) })] }), _jsxs("div", { className: "modal-grid", children: [images === null && _jsx("p", { children: "Carico\u2026" }), images?.map(src => (_jsxs("div", { className: "modal-tile", children: [_jsx("button", { type: "button", className: "modal-pick", onClick: () => onPick(src), title: src, children: video ? _jsx("video", { src: src, muted: true, preload: "metadata" }) : _jsx("img", { src: src, alt: "", loading: "lazy" }) }), _jsxs("button", { type: "button", className: confirm === src ? 'modal-del armed' : 'modal-del', title: confirm === src ? (inUse.has(src) ? 'È usato in una card: clicca ancora per eliminarlo' : 'Clicca ancora per eliminarlo') : 'Elimina file', "aria-label": "Elimina file", onClick: () => remove(src), onMouseLeave: () => confirm === src && setConfirm(null), children: [_jsx(IconTrash, { size: 14, stroke: 1.75 }), confirm === src && _jsx("span", { children: inUse.has(src) ? 'In uso, elimina?' : 'Elimina?' })] })] }, src)))] })] }) }), document.body);
}
// Size of a placeholder, so the right image can be prepared: the long side is 1600px = 297mm,
// so at 300 dpi one CSS pixel of the sheet is 3508 / 1600 printed pixels (either orientation).
const PRINT = 3508 / 1600;
const RATIOS = [['1:1', 1], ['4:3', 4 / 3], ['3:2', 3 / 2], ['16:9', 16 / 9], ['3:4', 3 / 4], ['2:3', 2 / 3], ['9:16', 9 / 16]];
export function SlotSize() {
    const ref = useRef(null);
    const [size, setSize] = useState(null);
    useEffect(() => {
        const box = ref.current?.parentElement;
        if (!box)
            return;
        const ro = new ResizeObserver(([e]) => setSize([e.contentRect.width, e.contentRect.height]));
        ro.observe(box);
        return () => ro.disconnect();
    }, []);
    if (!size || !size[1])
        return _jsx("span", { ref: ref, className: "slot-size" });
    const [w, h] = size;
    const r = w / h;
    const near = RATIOS.find(([, v]) => Math.abs(v - r) / v < 0.03)?.[0];
    return (_jsxs("span", { ref: ref, className: "slot-size", children: ["Rapporto ", near ?? `${r.toFixed(2).replace('.', ',')}:1`, _jsx("br", {}), "Per la stampa almeno ", Math.round(w * PRINT), " \u00D7 ", Math.round(h * PRINT), " px"] }));
}
// Cards that hold a plain <img> in their markup (the logos, the picture behind the thanks slide):
// the image can be swapped from the gallery like a slot. The choice is stored in cards.img like the slots.
function hasImg(node) {
    let found = false;
    Children.forEach(node, c => {
        if (found || !isValidElement(c))
            return;
        found = c.type === 'img' || hasImg(c.props.children);
    });
    return found;
}
function swapImg(el, src) {
    let done = false;
    const walk = (n) => Children.map(n, c => {
        if (done || !isValidElement(c))
            return c;
        if (c.type === 'img') {
            done = true;
            return cloneElement(c, { src });
        }
        const kids = c.props.children;
        return kids ? cloneElement(c, undefined, walk(kids)) : c;
    });
    return cloneElement(el, undefined, walk(el.props.children));
}
// A video that loops muted inside its card and opens full screen on demand (the slides, the video cards).
// Sound only in full screen; play and pause from the bar or by clicking the video (also while presenting,
// where a click elsewhere turns the slide).
export function VideoBox({ src, poster, label }) {
    const ref = useRef(null);
    const [paused, setPaused] = useState(false);
    useEffect(() => {
        const v = ref.current;
        if (!v)
            return;
        // React does not write the muted attribute: set it on the element, or Edge may autoplay with sound
        v.muted = true;
        v.defaultMuted = true;
        const onFs = () => { v.muted = document.fullscreenElement !== v; };
        document.addEventListener('fullscreenchange', onFs);
        return () => document.removeEventListener('fullscreenchange', onFs);
    }, []);
    const toggle = (e) => {
        e.stopPropagation();
        const v = ref.current;
        if (!v)
            return;
        if (v.paused)
            v.play();
        else
            v.pause();
    };
    return (_jsxs(_Fragment, { children: [_jsx("video", { ref: ref, src: src, poster: poster, autoPlay: true, muted: true, loop: true, playsInline: true, onPlay: () => setPaused(false), onPause: () => setPaused(true), onClick: toggle }), _jsxs("div", { className: "video-bar", children: [label ? _jsx("p", { children: label }) : _jsx("span", {}), _jsxs("div", { className: "video-actions", children: [_jsx("button", { type: "button", title: paused ? 'Riproduci' : 'Pausa', "aria-label": paused ? 'Riproduci il video' : 'Metti in pausa il video', onClick: toggle, children: paused ? _jsx(IconPlayerPlayFilled, { size: 16 }) : _jsx(IconPlayerPauseFilled, { size: 16 }) }), _jsx("button", { type: "button", title: "Schermo intero, con l\u2019audio", "aria-label": "Guarda il video a schermo intero, con l\u2019audio", onClick: e => { e.stopPropagation(); ref.current?.requestFullscreen(); }, children: _jsx(IconMaximize, { size: 18, stroke: 1.75 }) })] })] })] }));
}
function ExtraCard({ e }) {
    if (e.kind === 'video')
        return (_jsx("div", { className: "cell cell-video", children: e.src ? _jsx(VideoBox, { src: e.src }) : _jsxs("div", { className: "slot-empty", children: [_jsx(IconMovie, { size: 28, stroke: 1.5 }), _jsx("span", { children: "Scegli un video" })] }) }));
    if (e.kind === 'image')
        return (_jsx("div", { className: "cell cell-img", children: e.src ? _jsx("img", { src: e.src, alt: "" }) : _jsxs("div", { className: "slot-empty", children: [_jsx(IconPhoto, { size: 28, stroke: 1.5 }), _jsx("span", { children: "Scegli un'immagine" })] }) }));
    if (e.kind === 'media')
        return (_jsxs("div", { className: "cell cell-media", children: [_jsx("div", { className: "tool-img", children: e.src ? _jsx("img", { src: e.src, alt: "" }) : _jsxs("div", { className: "slot-empty", children: [_jsx(IconPhoto, { size: 28, stroke: 1.5 }), _jsx("span", { children: "Scegli un'immagine" })] }) }), _jsx("p", { className: "media-caption", children: "Scrivi qui la didascalia." })] }));
    return (_jsxs("div", { className: "cell cell-text cell-extra", children: [_jsx("span", { className: "chip", children: "Nota" }), _jsx("p", { children: "Scrivi qui il testo della card." })] }));
}
// bleed: no page margin, no gaps, square cards (one surface edge to edge, e.g. the thesis covers)
// nofoot: this sheet only goes without the footer (the cover slide)
export function Sheet({ id, cols, rows, className = 'sheet', heading, bleed, nofoot, children }) {
    const { logoMono } = useContext(EngineContext);
    const f = useContext(FormatContext);
    const { w: W, h: H } = f;
    const foot = f.foot && !nofoot;
    const [margin, marginX, gap] = bleed ? [0, 0, 0] : [f.margin, f.marginX, f.gap];
    const gridH = H - (foot ? FOOT : 0) - (heading ? HEAD : 0);
    const { saved, save, texts, setText, cards, setCards, saveSheet, pendingIn, mode: globalMode } = useContext(LayoutsContext);
    const page = useContext(PageContext);
    const scale = useContext(ScaleContext);
    // Two locks: the layout one stops moving, resizing and adding cards, the text one stops rewriting
    const layoutLocked = !!(page.approved || page.layoutLocked);
    const textLocked = !!(page.approved || page.textLocked);
    const mode = (globalMode === 'layout' && layoutLocked) || (globalMode === 'text' && textLocked) ? 'view' : globalMode;
    const pending = pendingIn(id);
    const ref = useRef(null);
    const [rev, setRev] = useState(0);
    const [adding, setAdding] = useState(false);
    const [confirmReset, setConfirmReset] = useState(false);
    const [live, setLive] = useState(null);
    const [picking, setPicking] = useState(null);
    const mine = cards[id] ?? {};
    const extras = (mine.extra ?? []).map(asExtra);
    const update = (patch) => setCards(id, { ...mine, ...patch });
    // Text edits live in the DOM (contentEditable); React never rewrites these static nodes.
    // Keys are card + position inside the card, so adding or removing cards keeps them stable.
    // data-text-key="x" makes a shared text (key "@x"): editing it in one place edits it on every sheet.
    useEffect(() => {
        ref.current?.querySelectorAll('[data-card]').forEach(card => {
            card.querySelectorAll(TEXT).forEach((el, n) => {
                var _a;
                if (el.closest('.card-bar'))
                    return;
                const key = el.dataset.textKey ? `@${el.dataset.textKey}` : `${id}:${card.dataset.card}:${n}`;
                (_a = el.dataset).orig ?? (_a.orig = el.innerHTML);
                const orig = el.dataset.orig;
                const t = texts[key];
                const want = t && t.orig === orig ? t.html : orig;
                if (document.activeElement !== el && el.innerHTML !== want)
                    el.innerHTML = want;
                const editable = mode === 'text' ? 'true' : 'false';
                if (el.contentEditable !== editable)
                    el.contentEditable = editable; // reassigning drops the focus
                el.oninput = () => setText(key, el.innerHTML === orig ? null : { orig, html: el.innerHTML });
                el.onpaste = e => {
                    e.preventDefault();
                    document.execCommand('insertText', false, e.clipboardData?.getData('text/plain') ?? '');
                };
            });
        });
    });
    const reset = () => {
        if (!confirmReset) {
            setConfirmReset(true);
            setTimeout(() => setConfirmReset(false), 3000);
            return;
        }
        setConfirmReset(false);
        save(id, null);
        setCards(id, null);
        for (const k of Object.keys(texts))
            if (k.startsWith(id + ':'))
                setText(k, null);
        setRev(r => r + 1);
    };
    const edges = rowEdges(rows);
    const hidden = new Set(mine.hidden ?? []);
    const coded = Children.toArray(children).filter(isValidElement);
    // ponytail: cells without an explicit position flow left to right, top to bottom
    let flow = 0;
    const taken = new Set();
    const defaults = coded.map((el, n) => {
        const p = el.props;
        let [cx, cw] = lines(p.at?.col ?? p.style?.gridColumn, -1);
        let [ry, rh] = lines(p.at?.row ?? p.style?.gridRow, -1);
        if (cx < 0 || ry < 0) {
            while (taken.has(flow))
                flow++;
            cx = flow % cols;
            ry = Math.floor(flow / cols);
            cw = rh = 1;
        }
        for (let r = ry; r < ry + rh; r++)
            for (let c = cx; c < cx + cw; c++)
                taken.add(r * cols + c);
        const [ux, uw] = (p['data-u'] ?? '').split(' ').map(Number);
        // edges in design columns (or thirds of a column for data-u), then one rounding per edge
        const [l, r] = p['data-u'] ? [ux / OLD_SUB, (ux + uw) / OLD_SUB] : [cx, cx + cw];
        const x = toUnit(l, cols);
        return { i: el.key != null ? clean(el.key) : String(n), x, w: toUnit(r, cols) - x, y: edges[ry], h: edges[ry + rh] - edges[ry], minW: MIN, minH: MIN };
    });
    for (const e of extras)
        defaults.push({ i: e.i, x: 0, y: 0, w: toUnit(2, cols), h: 16, minW: MIN, minH: MIN });
    const nodes = [
        ...coded.map((el, n) => [el.key != null ? clean(el.key) : String(n), el]),
        ...extras.map((e) => [e.i, _jsx(ExtraCard, { e: e })]),
    ].filter(([k]) => !hidden.has(k));
    const stored = new Map((saved[id] ?? []).map(l => [clean(l.i), l]));
    const layout = defaults
        .filter(d => !hidden.has(d.i))
        .map(d => {
        const s = stored.get(d.i);
        return s ? { ...d, x: s.x, y: s.y, w: s.w, h: s.h } : d;
    });
    // Only positions that differ from the code are stored, so later code changes still apply.
    const keep = (l) => {
        const byId = new Map(defaults.map(d => [d.i, d]));
        const diff = l.filter(it => {
            const d = byId.get(it.i);
            return !d || d.x !== it.x || d.y !== it.y || d.w !== it.w || d.h !== it.h;
        }).map(({ i, x, y, w, h }) => ({ i, x, y, w, h }));
        save(id, diff.length ? diff : null);
        setRev(r => r + 1); // remount so the grid re-reads the layout prop even when nothing moved
    };
    const remove = (k) => {
        if (extras.some(e => e.i === k))
            update({ extra: extras.filter(e => e.i !== k) });
        else
            update({ hidden: [...hidden, k] });
    };
    const add = (kind) => {
        setAdding(false);
        const i = `nota-${Date.now().toString(36)}`;
        if (kind === 'text')
            update({ extra: [...extras, { i, kind }] });
        else
            setPicking(kind === 'image' ? 'new-image' : kind === 'video' ? 'new-video' : 'new-media');
    };
    const pick = (src) => {
        if (picking === 'new-video') {
            update({ extra: [...extras, { i: `video-${Date.now().toString(36)}`, kind: 'video', src }] });
        }
        else if (picking === 'new-image' || picking === 'new-media') {
            update({ extra: [...extras, { i: `img-${Date.now().toString(36)}`, kind: picking === 'new-image' ? 'image' : 'media', src }] });
        }
        else if (picking && extras.some(e => e.i === picking)) {
            update({ extra: extras.map(e => (e.i === picking ? { ...e, src } : e)) });
        }
        else if (picking) {
            update({ img: { ...mine.img, [picking]: src } });
        }
        setPicking(null);
    };
    const scaleBy = (k, f) => update({ scale: { ...mine.scale, [k]: Math.round((mine.scale?.[k] ?? 1) * f * 100) / 100 } });
    const setPad = (k, p) => {
        const pad = { ...mine.pad };
        if (p === null)
            delete pad[k];
        else
            pad[k] = p;
        update({ pad });
    };
    const setBg = (k, c) => {
        const bg = { ...mine.bg };
        if (c)
            bg[k] = c;
        else
            delete bg[k];
        update({ bg });
    };
    const I = { size: 14, stroke: 1.75 };
    return (_jsxs("div", { className: "sheet-wrap", children: [globalMode !== 'view' && _jsxs("div", { className: "sheet-tools", children: [_jsxs("div", { className: "sheet-tools-left", children: [page.n > 0 && _jsx(SheetName, { n: page.n, title: page.title, onRename: textLocked ? undefined : page.onRename }), page.onMove && !layoutLocked && (_jsxs(_Fragment, { children: [_jsx("button", { type: "button", className: "round", title: "Sposta su", "aria-label": "Sposta la pagina su", disabled: !page.canUp, onClick: () => page.onMove(-1), children: _jsx(IconArrowUp, { ...I }) }), _jsx("button", { type: "button", className: "round", title: "Sposta gi\u00F9", "aria-label": "Sposta la pagina gi\u00F9", disabled: !page.canDown, onClick: () => page.onMove(1), children: _jsx(IconArrowDown, { ...I }) })] }))] }), !layoutLocked && _jsxs("div", { className: "add-wrap", children: [_jsxs("button", { type: "button", title: "Aggiungi card", "aria-label": "Aggiungi card", className: adding ? 'on' : '', onClick: () => setAdding(a => !a), children: [_jsx(IconPlus, { ...I }), _jsx("span", { className: "lbl", children: "Aggiungi card" })] }), adding && (_jsxs("div", { className: "add-menu", children: [_jsxs("button", { type: "button", onClick: () => add('text'), children: [_jsx(IconAlignLeft, { ...I }), "Testo"] }), _jsxs("button", { type: "button", onClick: () => add('image'), children: [_jsx(IconPhoto, { ...I }), "Immagine"] }), _jsxs("button", { type: "button", onClick: () => add('media'), children: [_jsx(IconLayoutBottombar, { ...I }), "Immagine e didascalia"] }), _jsxs("button", { type: "button", onClick: () => add('video'), children: [_jsx(IconMovie, { ...I }), "Video"] })] }))] }), !layoutLocked && _jsxs("button", { type: "button", title: confirmReset ? 'Clicca ancora per ripristinare' : 'Ripristina pagina', "aria-label": "Ripristina pagina", className: confirmReset ? 'danger' : '', onClick: reset, children: [_jsx(IconRestore, { ...I }), confirmReset ? _jsx("span", { className: "lbl lbl-keep", children: "Clicca ancora" }) : _jsx("span", { className: "lbl", children: "Ripristina pagina" })] }), page.onArchive && !layoutLocked && _jsxs("button", { type: "button", title: "Archivia la pagina", "aria-label": "Archivia la pagina", onClick: page.onArchive, children: [_jsx(IconArchive, { ...I }), _jsx("span", { className: "lbl", children: "Archivia" })] }), page.onRestore && _jsxs("button", { type: "button", title: "Rimetti tra le pagine", "aria-label": "Rimetti tra le pagine", onClick: page.onRestore, children: [_jsx(IconArchiveOff, { ...I }), _jsx("span", { className: "lbl", children: "Rimetti tra le pagine" })] }), _jsxs("button", { type: "button", title: pending ? 'Salva pagina' : 'Pagina salvata', "aria-label": "Salva pagina", className: "primary", onClick: () => saveSheet(id), disabled: !pending, children: [_jsx(IconDeviceFloppy, { ...I }), _jsx("span", { className: "lbl", children: pending ? 'Salva pagina' : 'Pagina salvata' }), pending > 0 && _jsx("span", { className: "count", children: pending })] }), page.onLockLayout && (_jsxs("button", { type: "button", className: layoutLocked ? 'approved' : 'unapproved', title: layoutLocked ? 'Sblocca il layout' : 'Blocca il layout: niente spostamenti, ridimensionamenti o card nuove', onClick: page.onLockLayout, children: [layoutLocked ? _jsx(IconLock, { ...I }) : _jsx(IconLockOpen, { ...I }), _jsx(IconLayoutGrid, { ...I }), _jsx("span", { className: "lbl", children: "Layout" })] })), page.onLockText && (_jsxs("button", { type: "button", className: textLocked ? 'approved' : 'unapproved', title: textLocked ? 'Sblocca i testi' : 'Blocca i testi: niente modifiche alle scritte', onClick: page.onLockText, children: [textLocked ? _jsx(IconLock, { ...I }) : _jsx(IconLockOpen, { ...I }), _jsx(IconTypography, { ...I }), _jsx("span", { className: "lbl", children: "Testi" })] }))] }), _jsxs("div", { className: `${className}${bleed ? ' sheet-bleed' : ''}${layoutLocked && textLocked && globalMode !== 'view' ? ' is-approved' : mode === 'view' && globalMode !== 'view' ? ' is-locked' : ''}${layoutLocked && globalMode !== 'view' ? ' is-layout-locked' : ''}`, ref: ref, children: [heading && _jsx("header", { className: "sheet-head", style: { height: HEAD }, children: _jsx("h2", { children: heading }) }), _jsx(ReactGridLayout, { width: W, layout: layout, positionStrategy: scale === 1 ? undefined : scaled(scale), autoSize: false, style: { height: gridH, marginTop: heading ? HEAD : 0 }, gridConfig: { cols: UNITS, rowHeight: rowH(gridH, margin, gap), margin: [gap, gap], containerPadding: [marginX, margin], maxRows: ROWS }, dragConfig: { enabled: mode === 'layout', bounded: true, cancel: '.card-bar' }, resizeConfig: { enabled: mode === 'layout', handles: ['n', 'e', 's', 'w', 'ne', 'nw', 'se', 'sw'] }, compactor: getCompactor(null, true), onResize: (_l, _o, n) => n && setLive(n), onDrag: (_l, _o, n) => n && setLive(n), onDragStop: l => { setLive(null); keep(l); }, onResizeStop: (l, o, n) => { setLive(null); keep(o && n ? shareEdge(l, o, n) : l); }, children: nodes.map(([k, el]) => {
                            const bg = mine.bg?.[k];
                            const img = mine.img?.[k];
                            const slot = !!el.props['data-slot'];
                            const pad = mine.pad?.[k];
                            const style = { '--s': mine.scale?.[k] ?? 1, ...(pad != null ? { '--pad': `${pad}px` } : {}), ...(bg ? { '--bg': bg } : {}), ...(img ? { '--img': `url("${img}")` } : {}) };
                            const extra = extras.find(e => e.i === k);
                            const plainImg = !slot && !extra && hasImg(el.props.children);
                            const cls = [bg && `has-bg ${isLight(bg) ? 'bg-light' : 'bg-dark'}`, img && 'has-img', pad != null && 'has-pad'].filter(Boolean).join(' ');
                            return (_jsxs("div", { "data-card": k, className: cls || undefined, style: style, onClick: slot && mode === 'layout' ? e => { if (e.target.closest('.slot-empty'))
                                    setPicking(k); } : undefined, children: [plainImg && img ? swapImg(el, img) : el, mode === 'layout' && (() => {
                                        // live size while resizing or moving, so the chip never goes stale or disappears
                                        const it = live?.i === k ? live : layout.find(l => l.i === k);
                                        return it ? _jsxs("span", { className: live?.i === k ? 'card-size is-live' : 'card-size', "aria-hidden": "true", children: ["A ", it.h, " \u00D7 L ", it.w] }) : null;
                                    })(), mode === 'layout' && (_jsx(CardBar, { isImage: slot || plainImg || (!!extra && extra.kind !== 'text'), isVideo: extra?.kind === 'video', pad: pad, onPad: p => setPad(k, p), onScale: f => scaleBy(k, f), onBg: c => setBg(k, c), onImage: () => setPicking(k), onRemove: () => remove(k) }))] }, k));
                        }) }, rev), foot && _jsxs("footer", { className: "sheet-foot", style: { height: FOOT }, children: [logoMono && _jsx("img", { src: logoMono, alt: "" }), _jsx(FooterText, { editable: mode === 'text' }), _jsxs("span", { className: "sheet-foot-n", children: [page.title, page.n > 0 && _jsxs(_Fragment, { children: [_jsx("i", { className: "sheet-foot-dot", "aria-hidden": "true" }), "Pagina ", page.n, " di ", page.of] })] })] })] }), picking && (_jsx(Gallery, { video: picking === 'new-video' || extras.some(e => e.i === picking && e.kind === 'video'), onPick: pick, onClose: () => setPicking(null), inUse: new Set(Object.values(cards).flatMap(c => [...Object.values(c.img ?? {}), ...(c.extra ?? []).map(e => (typeof e === 'string' ? '' : e.src ?? ''))])) }))] }));
}
