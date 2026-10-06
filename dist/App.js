import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useCallback, useEffect, useRef, useState } from 'react';
import { IconArchive, IconArrowBackUp, IconFileAlert, IconFileCheck, IconRefresh, IconCheck, IconDeviceFloppy, IconLayoutSidebarLeftCollapse, IconLayoutSidebarLeftExpand, IconDownload, IconPresentation, IconLayoutBoard, IconSelector, IconSettings, IconX } from '@tabler/icons-react';
import FormatBar, { TextColorsContext } from './FormatBar';
import { EngineContext, FormatContext, LANDSCAPE, LayoutsContext, PageContext, ScaleContext, TEXT } from './Sheet';
// Editor preferences: per browser, not part of the project files
// keys are set per presentation in PresentationApp (they hold its id)
let UI_KEY = 'sheets-editor-ui';
const UI_OPTIONS = [
    ['labels', 'Testi sui comandi delle pagine', 'Senza, i comandi mostrano solo le icone (il nome compare al passaggio del mouse)', false],
    ['cardBar', 'Comandi sulle card', 'Scala, colore, immagine ed elimina, in alto su ogni card', true],
    ['cardSize', 'Misure delle card', 'Il chip con altezza e larghezza in blocchi della griglia', true],
];
const UI_DEFAULT = Object.fromEntries(UI_OPTIONS.map(([k, , , v]) => [k, v]));
const loadUi = () => { try {
    return { ...UI_DEFAULT, ...JSON.parse(localStorage.getItem(UI_KEY) ?? '{}') };
}
catch {
    return UI_DEFAULT;
} };
// The editor exists only on the local dev server; the published site is read only.
const EDITOR = import.meta.env.DEV;
const fit = (f = LANDSCAPE) => Math.min(window.innerWidth / f.w, window.innerHeight / f.h);
const load = (path) => fetch(path).then(r => r.json()).catch(() => ({}));
const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
// One draft store: values in memory, what is on disk, and which ids differ from disk.
function useStore() {
    const [values, setValues] = useState({});
    const [base, setBase] = useState({});
    const ref = useRef(values);
    ref.current = values;
    const set = useCallback((id, v) => {
        setValues(prev => {
            const next = { ...prev };
            if (v)
                next[id] = v;
            else
                delete next[id];
            return next;
        });
    }, []);
    const init = useCallback((v) => { setValues(v); setBase(v); }, []);
    const dirty = Object.keys({ ...values, ...base }).filter(id => !same(values[id], base[id]));
    const revert = useCallback(() => setValues(base), [base]);
    return { values, ref, set, init, dirty, setBase, revert };
}
// Edits stay a draft in memory until "Salva": reloading without saving drops them.
async function persist(path, ids, values) {
    for (const id of ids) {
        const res = await fetch(path, { method: 'POST', body: JSON.stringify({ id, value: values[id] ?? null }) });
        if (!res.ok)
            throw new Error(path);
    }
}
function markSaved(setBase, ids, values) {
    setBase(b => {
        const next = { ...b };
        for (const id of ids) {
            if (values[id])
                next[id] = values[id];
            else
                delete next[id];
        }
        return next;
    });
}
// Sidebar with every sheet: a miniature (a static copy of the sheet DOM), click to jump,
// drag to reorder in the editor. ponytail: DOM copy refreshed on edits, no second React render.
const SIDEBAR = 216;
const THUMB_W = SIDEBAR - 40;
let SIDE_KEY = 'sheets-editor-sidebar';
const loadSide = () => { try {
    return localStorage.getItem(SIDE_KEY) !== 'closed';
}
catch {
    return true;
} };
// Landscape fits the width; portrait also fits the height, so a whole page is on screen
const pageFit = (open, f = LANDSCAPE) => Math.min(1, (window.innerWidth - (open && window.innerWidth > 900 ? SIDEBAR + 16 : 0) - 64) / f.w, f.h > f.w ? (window.innerHeight - 110) / f.h : 1);
function Thumb({ id, stamp, w }) {
    const ref = useRef(null);
    useEffect(() => {
        const t = setTimeout(() => {
            const src = document.querySelector(`#sheet-${id} .sheet`);
            const box = ref.current;
            if (!src || !box)
                return;
            const copy = src.cloneNode(true);
            copy.querySelectorAll('[contenteditable]').forEach(e => e.removeAttribute('contenteditable'));
            copy.querySelectorAll('.card-bar, .card-size, .react-resizable-handle').forEach(e => e.remove());
            copy.querySelectorAll('[data-card]').forEach(e => e.removeAttribute('data-card'));
            // no duplicate ids: SVG gradients (chapter numbers) must resolve to the page, not to the hidden copy
            copy.querySelectorAll('[id]').forEach(e => e.removeAttribute('id'));
            copy.style.zoom = String(THUMB_W / 1600); // the long side is always 1600px
            box.replaceChildren(copy);
        }, 400);
        return () => clearTimeout(t);
    }, [id, stamp, w]);
    return _jsx("div", { className: "thumb", ref: ref, "aria-hidden": "true" });
}
// Document picker: the current document as a button, the list with picture, format and pages in a popover
function DocPicker({ docs, ids, current, onPick }) {
    const [open, setOpen] = useState(false);
    const box = useRef(null);
    useEffect(() => {
        if (!open)
            return;
        const close = (e) => { if (!box.current?.contains(e.target))
            setOpen(false); };
        const esc = (e) => { if (e.key === 'Escape')
            setOpen(false); };
        document.addEventListener('mousedown', close);
        document.addEventListener('keydown', esc);
        return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc); };
    }, [open]);
    const row = (d) => (_jsxs(_Fragment, { children: [docs[d].picker && _jsx("img", { src: docs[d].picker[0], alt: "" }), _jsxs("span", { children: [_jsx("b", { children: docs[d].label }), _jsxs("small", { children: [docs[d].picker ? `${docs[d].picker[1]}, ` : '', Object.keys(docs[d].sheets).length, " pagine"] })] })] }));
    return (_jsxs("div", { className: "doc-picker", ref: box, children: [_jsxs("button", { type: "button", className: "doc-picker-current", "aria-haspopup": "listbox", "aria-expanded": open, onClick: () => setOpen(o => !o), children: [row(current), _jsx(IconSelector, { size: 16, stroke: 1.75 })] }), open && (_jsx("ul", { className: "doc-picker-list", role: "listbox", "aria-label": "Documento", children: ids.map(d => (_jsx("li", { children: _jsxs("button", { type: "button", role: "option", "aria-selected": d === current, className: d === current ? 'on' : '', onClick: () => { setOpen(false); if (d !== current)
                            onPick(d); }, children: [row(d), d === current && _jsx(IconCheck, { size: 16, stroke: 2 })] }) }, d))) }))] }));
}
// The editor and the read-only site of one presentation
export function PresentationApp({ config, theme, data: initial }) {
    const DOCS = config.docs;
    const ids = Object.keys(DOCS);
    const PUBLIC_DOCS = ids.filter(d => DOCS[d].public);
    const DOC_KEY = `${config.id}-editor-doc`;
    UI_KEY = `${config.id}-editor-ui`;
    SIDE_KEY = `${config.id}-editor-sidebar`;
    const loadDoc = () => {
        const d = new URLSearchParams(location.search).get('doc') ?? '';
        // online: only the public documents; the site opens on siteDefault without ?doc=
        if (!import.meta.env.DEV)
            return PUBLIC_DOCS.includes(d) ? d : config.siteDefault ?? PUBLIC_DOCS[0] ?? ids[0];
        // editor: the ?doc in the address, else the last one used, else editorDefault
        let last = '';
        try {
            last = localStorage.getItem(DOC_KEY) ?? '';
        }
        catch { /* storage blocked: fall back */ }
        return d in DOCS ? d : last in DOCS ? last : config.editorDefault ?? ids[0];
    };
    const layouts = useStore();
    const texts = useStore();
    const cards = useStore();
    const [ready, setReady] = useState(false);
    const [docId, setDocId] = useState(loadDoc);
    const doc = DOCS[docId];
    const SET = doc.settings ?? `settings:${docId}`;
    const PDF_NAME = doc.pdf;
    const footer = doc.footer ?? config.footer ?? [];
    const FOOTER_KEY = doc.footer ? `__footer:${docId}` : '__footer';
    const switchDoc = (d) => {
        setDocId(d);
        setTab('pages');
        history.replaceState(null, '', `?doc=${d}`);
        try {
            localStorage.setItem(DOC_KEY, d);
        }
        catch { /* storage blocked: the address still says it */ }
        window.scrollTo(0, 0);
    };
    const [mode, setMode] = useState('layout');
    const [tab, setTab] = useState('pages');
    const [rev, setRev] = useState(0);
    // /?present opens straight into the presentation (the QR printed on the cover lands here)
    const [ui, setUi] = useState(loadUi);
    const [showSettings, setShowSettings] = useState(false);
    // One editor: clicking a text edits it (caret where you clicked), clicking anywhere else moves cards
    useEffect(() => {
        if (!EDITOR)
            return;
        const onClick = (e) => {
            const el = e.target;
            if (el.closest('.toolbar, .sidebar, .save-dock, .format-float, .modal-back, .sheet-tools, .card-bar, .settings'))
                return;
            const text = el.closest(`[data-card] :is(${TEXT})`);
            if (text && mode === 'layout') {
                setMode('text');
                const { clientX: x, clientY: y } = e;
                requestAnimationFrame(() => requestAnimationFrame(() => {
                    text.focus();
                    const r = document.caretRangeFromPoint?.(x, y);
                    if (r) {
                        const sel = getSelection();
                        sel?.removeAllRanges();
                        sel?.addRange(r);
                    }
                }));
            }
            else if (!text && mode === 'text' && el.closest('.sheets'))
                setMode('layout');
        };
        document.addEventListener('click', onClick);
        return () => document.removeEventListener('click', onClick);
    }, [mode]);
    const toggleUi = (k) => setUi(u => {
        const next = { ...u, [k]: !u[k] };
        try {
            localStorage.setItem(UI_KEY, JSON.stringify(next));
        }
        catch { /* private mode: keeps working for this session */ }
        return next;
    });
    const [slide, setSlide] = useState(() => (new URLSearchParams(location.search).has('present') ? 0 : null));
    const [scale, setScale] = useState(() => fit(doc.format));
    const [sideOpen, setSideOpen] = useState(loadSide);
    const [fitPage, setFitPage] = useState(() => pageFit(loadSide(), doc.format));
    const [dragFrom, setDragFrom] = useState(null);
    useEffect(() => {
        const on = () => setFitPage(pageFit(sideOpen, doc.format));
        on();
        window.addEventListener('resize', on);
        return () => window.removeEventListener('resize', on);
    }, [sideOpen, doc.format]);
    // Portrait-like formats share the CSS; sizes and print zoom come in as variables
    useEffect(() => {
        const f = doc.format;
        document.body.classList.toggle('doc-portrait', f !== LANDSCAPE); // every format but the pagine: sizes from the variables
        document.body.style.setProperty('--sheet-w', `${f.w}px`);
        document.body.style.setProperty('--sheet-h', `${f.h}px`);
        document.body.style.setProperty('--print-zoom', String((f.mm * 96) / 25.4 / Math.max(f.w, f.h)));
    }, [doc.format]);
    useEffect(() => { document.body.classList.toggle('side-closed', !sideOpen); }, [sideOpen]);
    // ?bg prints the pages without their texts: the backgrounds of the Word version, where the texts are live
    useEffect(() => { document.body.classList.toggle('export-bg', new URLSearchParams(location.search).has('bg')); }, []);
    const toggleSide = () => setSideOpen(o => {
        try {
            localStorage.setItem(SIDE_KEY, o ? 'closed' : 'open');
        }
        catch { /* session only */ }
        return !o;
    });
    const [busy, setBusy] = useState(null);
    const [toast, setToast] = useState(null);
    const toastTimer = useRef(undefined);
    useEffect(() => {
        const data = EDITOR
            ? Promise.all([load('/__layouts'), load('/__texts'), load('/__cards')])
            : Promise.resolve([initial.layouts, initial.texts, initial.cards]);
        data.then(([l, t, c]) => {
            layouts.init(l);
            texts.init(t);
            cards.init(c);
            setReady(true);
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const notify = (msg) => {
        clearTimeout(toastTimer.current);
        setToast(msg);
        toastTimer.current = window.setTimeout(() => setToast(null), 3500);
    };
    const dirty = layouts.dirty.length + texts.dirty.length + cards.dirty.length;
    window.__dirty = dirty > 0;
    // Saves every pending edit, or only those of one sheet. Values are snapshotted first,
    // so an edit typed while saving stays pending instead of being marked as saved.
    const commit = async (sheet) => {
        const l = layouts.dirty.filter(i => !sheet || i === sheet);
        // settings (order, archive, approval, texture) and the shared footer belong to every sheet
        const c = cards.dirty.filter(i => !sheet || i === sheet || i === SET);
        const t = texts.dirty.filter(k => !sheet || k.startsWith(sheet + ':') || k === FOOTER_KEY);
        if (!l.length && !c.length && !t.length)
            return;
        const snap = { l: { ...layouts.ref.current }, t: { ...texts.ref.current }, c: { ...cards.ref.current } };
        setBusy('save');
        try {
            await persist('/__layouts', l, snap.l);
            await persist('/__texts', t, snap.t);
            await persist('/__cards', c, snap.c);
            markSaved(layouts.setBase, l, snap.l);
            markSaved(texts.setBase, t, snap.t);
            markSaved(cards.setBase, c, snap.c);
            notify(sheet ? 'Pagina salvata' : 'Modifiche salvate');
        }
        catch {
            notify('Salvataggio non riuscito: il server locale è acceso?');
        }
        finally {
            setBusy(null);
        }
    };
    const pendingIn = (sheet) => layouts.dirty.filter(i => i === sheet).length +
        cards.dirty.filter(i => i === sheet || i === SET).length +
        texts.dirty.filter(k => k.startsWith(sheet + ':') || k === FOOTER_KEY).length;
    // Prints the saved version with headless Edge into out/; `download` also hands it to the browser.
    const makePdf = async (download) => {
        if (!EDITOR) {
            // versioned link, so the browser never serves an older cached copy
            Object.assign(document.createElement('a'), { href: `/${PDF_NAME}?v=${__BUILD_ID__}`, download: PDF_NAME }).click();
            return;
        }
        if (dirty)
            return notify('Salva prima le modifiche: il PDF usa la versione salvata');
        setBusy('pdf');
        try {
            const files = doc.files;
            const names = files ? `&names=${order.map(id => files[id]).join(',')}` : '';
            // download of an up-to-date PDF: hand over the file in out/, no new print
            const fresh = download && (await fetch(`/__pdf-status?doc=${docId}`).then(r => r.json()).catch(() => ({ fresh: false }))).fresh;
            const res = await fetch(fresh ? `/__pdf-file?doc=${docId}` : `/__pdf?doc=${docId}${names}`);
            if (!res.ok)
                throw new Error(await res.text());
            if (download) {
                const url = URL.createObjectURL(await res.blob());
                Object.assign(document.createElement('a'), { href: url, download: PDF_NAME }).click();
                URL.revokeObjectURL(url);
            }
            notify(fresh ? 'PDF già aggiornato, scaricato' : files ? `PDF aggiornato, le pagine sono in out/${docId}/` : 'PDF aggiornato in out/');
        }
        catch {
            notify('Il PDF non si è generato: il server locale è acceso?');
        }
        finally {
            setBusy(null);
            checkPdf();
        }
    };
    const downloadPdf = () => makePdf(true);
    // Is the PDF in out/ newer than the saved data and the code? (editor only)
    const [pdfFresh, setPdfFresh] = useState(null);
    const checkPdf = useCallback(() => {
        if (!EDITOR)
            return;
        fetch(`/__pdf-status?doc=${docId}`).then(r => r.json()).then(s => setPdfFresh(s.fresh)).catch(() => setPdfFresh(null));
    }, [docId]);
    useEffect(() => { checkPdf(); const t = setInterval(checkPdf, 15000); return () => clearInterval(t); }, [checkPdf, dirty]);
    const present = () => {
        setSlide(0);
        document.documentElement.requestFullscreen?.().catch(() => { });
    };
    const exit = useCallback(() => {
        setSlide(null);
        if (location.search.includes('present'))
            history.replaceState(null, '', location.pathname);
        if (document.fullscreenElement)
            document.exitFullscreen().catch(() => { });
    }, []);
    const settings = (cards.values[SET] ?? {});
    const order = (settings.order ?? doc.order ?? Object.keys(doc.sheets)).filter(id => id in doc.sheets);
    const archived = Object.keys(doc.sheets).filter(id => !order.includes(id));
    const step = (d) => setSlide(s => Math.min(Math.max((s ?? 0) + d, 0), order.length - 1));
    useEffect(() => {
        if (slide === null)
            return;
        const onKey = (e) => {
            if (['ArrowRight', 'ArrowDown', 'PageDown', ' '].includes(e.key)) {
                e.preventDefault();
                step(1);
            }
            else if (['ArrowLeft', 'ArrowUp', 'PageUp'].includes(e.key)) {
                e.preventDefault();
                step(-1);
            }
            else if (e.key === 'Escape')
                exit();
        };
        const onResize = () => setScale(fit(doc.format));
        const onFs = () => { if (!document.fullscreenElement)
            setSlide(null); };
        window.addEventListener('keydown', onKey);
        window.addEventListener('resize', onResize);
        document.addEventListener('fullscreenchange', onFs);
        onResize();
        return () => {
            window.removeEventListener('keydown', onKey);
            window.removeEventListener('resize', onResize);
            document.removeEventListener('fullscreenchange', onFs);
        };
    }, [slide, exit, doc.format]);
    if (!ready)
        return null;
    const presenting = slide !== null;
    // Texture choice lives with the saved data, so the PDF and the site use the same one
    const texture = ((settings.texture ?? theme.texture) === 'none' ? 'none' : 'grain');
    const setSettings = (patch) => cards.set(SET, { ...settings, ...patch });
    const setTexture = (t) => setSettings({ texture: t });
    const format = { ...doc.format, margin: settings.margin ?? doc.format.margin, marginX: settings.margin ?? doc.format.marginX, gap: settings.gap ?? doc.format.gap };
    const SPACING = [['margin', 'Margine della pagina', 'Spazio fra il bordo del foglio e le card'], ['gap', 'Spazio fra le card', 'Distanza fra una card e l\'altra']];
    const move = (id, d) => {
        const next = [...order];
        const i = next.indexOf(id);
        if (i + d < 0 || i + d >= next.length)
            return;
        [next[i], next[i + d]] = [next[i + d], next[i]];
        setSettings({ order: next });
    };
    // custom page names live in the settings; an empty or default name drops the override
    const nameOf = (id) => settings.names?.[id] ?? doc.sheets[id][1];
    const rename = (id, t) => {
        const names = { ...settings.names };
        const v = t.trim();
        if (v && v !== doc.sheets[id][1])
            names[id] = v;
        else
            delete names[id];
        setSettings({ names });
    };
    const archive = (id) => setSettings({ order: order.filter(x => x !== id) });
    const restore = (id) => setSettings({ order: [...order, id] });
    // Two locks per sheet; the old «approved» (both locks) is split the first time one of them is touched
    const approved = new Set(settings.approved ?? []);
    const lockLayout = new Set([...(settings.lockLayout ?? []), ...approved]);
    const lockText = new Set([...(settings.lockText ?? []), ...approved]);
    const toggleLock = (id, which) => {
        const l = new Set(lockLayout), t = new Set(lockText);
        const set = which === 'layout' ? l : t;
        if (set.has(id))
            set.delete(id);
        else
            set.add(id);
        setSettings({ approved: [], lockLayout: [...l], lockText: [...t] });
    };
    const I = { size: 16, stroke: 1.75 };
    return (_jsx(EngineContext.Provider, { value: { footer, footerKey: FOOTER_KEY, logoMono: theme.logoMono, backgrounds: theme.palettes?.background ?? ['#FFFFFF', theme.colors.paper, theme.colors['accent-lt'], theme.colors.accent, theme.colors.strong, theme.colors.ink] }, children: _jsx(TextColorsContext.Provider, { value: theme.palettes?.text ?? [[theme.colors.ink, 'Testo'], [theme.colors.strong, 'Scuro'], [theme.colors.accent, 'Accento'], ['#FFFFFF', 'Bianco']], children: _jsxs(LayoutsContext.Provider, { value: {
                    saved: layouts.values, save: layouts.set, texts: texts.values, setText: texts.set, cards: cards.values, setCards: cards.set,
                    saveSheet: commit, pendingIn, mode: presenting || !EDITOR ? 'view' : mode,
                }, children: [!presenting && EDITOR && mode === 'text' && (_jsx("div", { className: "format-float", children: _jsx(FormatBar, {}) })), !presenting && (_jsxs("div", { className: "dock", children: [_jsxs("nav", { className: "toolbar", "aria-label": "Strumenti", children: [_jsx("button", { type: "button", className: "icon-btn", title: "Presenta", "aria-label": "Presenta", onClick: present, children: _jsx(IconPresentation, { ...I }) }), _jsx("button", { type: "button", className: busy === 'pdf' ? 'icon-btn is-busy' : 'icon-btn', title: busy === 'pdf' ? 'Genero il PDF…' : 'Scarica PDF', "aria-label": "Scarica PDF", onClick: downloadPdf, disabled: busy !== null, children: _jsx(IconDownload, { ...I }) }), EDITOR && (_jsx("button", { type: "button", className: `icon-btn pdf-state ${busy === 'pdf' ? 'is-busy' : pdfFresh ? 'is-fresh' : 'is-stale'}`, onClick: () => makePdf(false), disabled: busy !== null, title: busy === 'pdf' ? 'Genero il PDF…' : pdfFresh ? 'PDF aggiornato: clic per rigenerarlo' : 'PDF da aggiornare: clic per rigenerarlo senza scaricarlo', "aria-label": "Rigenera PDF", children: busy === 'pdf' ? _jsx(IconRefresh, { ...I }) : pdfFresh ? _jsx(IconFileCheck, { ...I }) : _jsx(IconFileAlert, { ...I }) }))] }), EDITOR && (_jsxs("div", { className: "save-dock", children: [dirty > 0 && (_jsxs("button", { type: "button", title: "Scarta tutte le modifiche non salvate", onClick: () => { layouts.revert(); texts.revert(); cards.revert(); setRev(r => r + 1); notify('Modifiche annullate'); }, disabled: busy !== null, children: [_jsx(IconArrowBackUp, { ...I }), "Annulla"] })), _jsxs("button", { type: "button", className: "primary", onClick: () => commit(), disabled: !dirty || busy !== null, children: [dirty ? _jsx(IconDeviceFloppy, { ...I }) : _jsx(IconCheck, { ...I }), busy === 'save' ? 'Salvo…' : dirty ? `Salva (${dirty})` : 'Salvato'] })] }))] })), showSettings && (_jsx("div", { className: "modal-back", onMouseDown: () => setShowSettings(false), children: _jsxs("div", { className: "settings", role: "dialog", "aria-label": "Impostazioni dell'editor", onMouseDown: e => e.stopPropagation(), children: [_jsxs("header", { className: "settings-head", children: [_jsx("h2", { children: "Impostazioni" }), _jsx("button", { type: "button", className: "round", "aria-label": "Chiudi", onClick: () => setShowSettings(false), children: _jsx(IconX, { ...I }) })] }), _jsxs("label", { className: "settings-row", children: [_jsxs("span", { children: [_jsx("b", { children: "Grana" }), _jsx("small", { children: "La texture di carta sopra le pagine; vale anche per il PDF e il sito (si salva con Salva)" })] }), _jsx("button", { type: "button", role: "switch", "aria-checked": texture === 'grain', className: texture === 'grain' ? 'toggle on' : 'toggle', onClick: () => setTexture(texture === 'grain' ? 'none' : 'grain'), children: _jsx("span", {}) })] }), SPACING.map(([k, label, hint]) => (_jsxs("div", { className: "settings-row", children: [_jsxs("span", { children: [_jsx("b", { children: label }), _jsxs("small", { children: [hint, ", in ", doc.label.toLowerCase(), " (si salva con Salva)"] })] }), _jsxs("span", { className: "stepper", children: [_jsx("button", { type: "button", "aria-label": "Meno", onClick: () => setSettings({ [k]: Math.max(0, format[k] - 2) }), children: "\u2212" }), _jsx("b", { children: format[k] }), _jsx("button", { type: "button", "aria-label": "Pi\u00F9", onClick: () => setSettings({ [k]: Math.min(120, format[k] + 2) }), children: "+" })] })] }, k))), UI_OPTIONS.map(([k, label, hint]) => (_jsxs("label", { className: "settings-row", children: [_jsxs("span", { children: [_jsx("b", { children: label }), _jsx("small", { children: hint })] }), _jsx("button", { type: "button", role: "switch", "aria-checked": ui[k], className: ui[k] ? 'toggle on' : 'toggle', onClick: () => toggleUi(k), children: _jsx("span", {}) })] }, k)))] }) })), !presenting && (_jsxs("aside", { className: sideOpen ? 'sidebar' : 'sidebar is-closed', "aria-label": "Pagine", children: [_jsxs("div", { className: "sidebar-top", children: [_jsxs("a", { className: "sidebar-brand", href: "#top", "aria-label": config.title, children: [EDITOR ? _jsxs("span", { className: "engine-mark", children: [_jsx(IconLayoutBoard, { size: 18, stroke: 2 }), "sheets"] }) : _jsx("img", { src: theme.logo, alt: "" }), !EDITOR && _jsx("span", { children: doc.name })] }), _jsx("button", { type: "button", className: "icon-btn", title: sideOpen ? 'Chiudi la barra' : 'Apri la barra', "aria-label": sideOpen ? 'Chiudi la barra' : 'Apri la barra', onClick: toggleSide, children: sideOpen ? _jsx(IconLayoutSidebarLeftCollapse, { ...I }) : _jsx(IconLayoutSidebarLeftExpand, { ...I }) })] }), sideOpen && EDITOR && (_jsx(DocPicker, { docs: DOCS, ids: config.pickerOrder ?? ids, current: docId, onPick: switchDoc })), sideOpen && EDITOR && tab === 'archive' && _jsxs("p", { className: "sidebar-label", children: ["Archivio (", archived.length, ")"] }), sideOpen && _jsx("ol", { className: "sidebar-list", children: (tab === 'archive' ? archived : order).map((id, i) => (_jsx("li", { className: dragFrom === i ? 'is-dragging' : undefined, draggable: EDITOR && tab === 'pages', onDragStart: () => setDragFrom(i), onDragOver: e => e.preventDefault(), onDrop: () => {
                                        if (dragFrom === null || dragFrom === i)
                                            return;
                                        const next = [...order];
                                        next.splice(i, 0, next.splice(dragFrom, 1)[0]);
                                        setSettings({ order: next });
                                        setDragFrom(null);
                                    }, onDragEnd: () => setDragFrom(null), children: _jsxs("button", { type: "button", onClick: () => { requestAnimationFrame(() => document.getElementById(`sheet-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })); }, children: [_jsx(Thumb, { id: id, w: doc.format.w, stamp: `${rev}-${dirty}-${order.join()}-${tab}-${docId}` }), _jsxs("span", { className: "sidebar-name", children: [_jsx("i", { children: i + 1 }), nameOf(id)] })] }) }, id))) }), sideOpen && EDITOR && (_jsxs("div", { className: "sidebar-foot", children: [_jsxs("button", { type: "button", className: "sidebar-settings", onClick: () => setShowSettings(true), children: [_jsx(IconSettings, { ...I }), "Impostazioni"] }), _jsx("button", { type: "button", className: tab === 'archive' ? 'icon-btn on' : 'icon-btn', title: tab === 'archive' ? 'Torna alle pagine' : `Archivio (${archived.length})`, "aria-label": "Archivio", "aria-pressed": tab === 'archive', onClick: () => setTab(t => (t === 'archive' ? 'pages' : 'archive')), children: _jsx(IconArchive, { ...I }) })] }))] })), doc.format !== LANDSCAPE && _jsx("style", { children: `@page { size: ${doc.format.page}; margin: 0; }` }), _jsx(FormatContext.Provider, { value: format, children: _jsxs("main", { id: "top", className: `${presenting ? 'sheets present' : `sheets mode-${EDITOR ? mode : 'view'}`} tex-${texture}${ui.labels ? '' : ' ui-icons'}${ui.cardBar ? '' : ' ui-nobar'}${ui.cardSize ? '' : ' ui-nosize'}`, style: (presenting ? { '--fit': scale } : { '--page-fit': fitPage }), onClick: presenting ? e => step(e.clientX > window.innerWidth / 2 ? 1 : -1) : undefined, children: [(tab === 'pages' || presenting) && order.map((id, i) => {
                                    const [Page] = doc.sheets[id];
                                    const title = nameOf(id);
                                    return (_jsx("div", { id: `sheet-${id}`, className: 'page' + (i === slide ? ' current' : ''), children: _jsx(ScaleContext.Provider, { value: presenting ? 1 : fitPage, children: _jsx(PageContext.Provider, { value: { n: i + 1, of: order.length, title, onMove: d => move(id, d), canUp: i > 0, canDown: i < order.length - 1, onArchive: () => archive(id), layoutLocked: lockLayout.has(id), textLocked: lockText.has(id), onLockLayout: () => toggleLock(id, 'layout'), onLockText: () => toggleLock(id, 'text'), onRename: t => rename(id, t) }, children: _jsx(Page, {}) }) }) }, `${id}-${rev}-${docId}`));
                                }), EDITOR && !presenting && tab === 'archive' && (_jsxs("section", { className: "archive", children: [_jsx("h2", { className: "archive-title", children: "Pagine archiviate" }), _jsx("p", { className: "archive-note", children: "Escluse dal PDF, dalla presentazione e dal sito." }), archived.length === 0 && _jsx("p", { className: "archive-note", children: "Nessuna pagina archiviata." }), archived.map(id => {
                                            const [Page] = doc.sheets[id];
                                            const title = nameOf(id);
                                            return (_jsx("div", { id: `sheet-${id}`, className: "page", children: _jsx(ScaleContext.Provider, { value: fitPage, children: _jsx(PageContext.Provider, { value: { n: 0, of: order.length, title: `${title}, archiviata`, onRestore: () => restore(id), layoutLocked: lockLayout.has(id), textLocked: lockText.has(id) }, children: _jsx(Page, {}) }) }) }, `${id}-${rev}`));
                                        })] }))] }) }), presenting && (_jsxs("div", { className: "present-bar", onClick: e => e.stopPropagation(), children: [_jsxs("span", { children: [(slide ?? 0) + 1, " / ", order.length] }), _jsxs("button", { type: "button", onClick: exit, children: [_jsx(IconX, { ...I }), "Esci"] })] })), toast && _jsx("div", { className: "toast", role: "status", children: toast })] }) }) }));
}
