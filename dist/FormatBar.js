import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { IconAlignCenter, IconAlignLeft, IconAlignRight, IconArrowBackUp, IconArrowForwardUp, IconBold, IconClearFormatting, IconHighlight, IconItalic, IconLetterCaseUpper, IconList, IconListNumbers, IconStrikethrough, IconTextDecrease, IconTextIncrease, IconUnderline } from '@tabler/icons-react';
import { createContext, useContext } from 'react';
// Text colours come from the theme (palettes.text); without them, ink and the two theme accents
export const TextColorsContext = createContext([]);
// ponytail: document.execCommand is deprecated but still the only native rich-text
// API in Chromium, and the browser fires `input`, so Sheet saves the result as usual.
const run = (cmd, value) => {
    document.execCommand('styleWithCSS', false, 'true');
    document.execCommand(cmd, false, value);
};
// Scales the selection (or the whole text if nothing is selected) by a factor, in px,
// so repeated clicks keep growing with no upper bound.
const resize = (factor) => {
    const host = document.activeElement;
    const sel = getSelection();
    if (!host?.isContentEditable || !sel?.rangeCount)
        return;
    const range = sel.getRangeAt(0);
    if (range.collapsed)
        range.selectNodeContents(host);
    const start = range.startContainer.nodeType === 1 ? range.startContainer : range.startContainer.parentElement;
    const px = parseFloat(getComputedStyle(start).fontSize) * factor;
    const frag = range.extractContents();
    frag.querySelectorAll('[style*="font-size"]').forEach(e => e.style.removeProperty('font-size'));
    const span = document.createElement('span');
    span.style.fontSize = `${Math.round(px * 10) / 10}px`;
    span.append(frag);
    range.insertNode(span);
    host.querySelectorAll('span:empty').forEach(e => e.remove());
    sel.removeAllRanges();
    const r = document.createRange();
    r.selectNodeContents(span);
    sel.addRange(r);
    host.dispatchEvent(new Event('input', { bubbles: true }));
};
const FONTS = [
    ['Outfit', 'Outfit'],
    ['Bricolage Grotesque', 'Bricolage'],
    ['Noto Sans', 'Noto'],
];
// Wraps the selection in a span with one inline style (used where execCommand has no command)
const wrap = (prop, value) => {
    const host = document.activeElement;
    const sel = getSelection();
    if (!host?.isContentEditable || !sel?.rangeCount || sel.getRangeAt(0).collapsed)
        return;
    const range = sel.getRangeAt(0);
    const span = document.createElement('span');
    span.style.setProperty(prop, value);
    span.append(range.extractContents());
    range.insertNode(span);
    sel.removeAllRanges();
    const r = document.createRange();
    r.selectNodeContents(span);
    sel.addRange(r);
    host.dispatchEvent(new Event('input', { bubbles: true }));
};
function Btn({ title, onPress, children }) {
    // mousedown + preventDefault keeps the text selection while clicking the bar
    return (_jsx("button", { type: "button", title: title, "aria-label": title, onMouseDown: e => { e.preventDefault(); onPress(); }, children: children }));
}
export default function FormatBar() {
    const COLORS = useContext(TextColorsContext);
    const I = { size: 16, stroke: 1.75 };
    return (_jsxs("div", { className: "format-bar", role: "toolbar", "aria-label": "Formattazione", children: [_jsx(Btn, { title: "Annulla", onPress: () => run('undo'), children: _jsx(IconArrowBackUp, { ...I }) }), _jsx(Btn, { title: "Ripeti", onPress: () => run('redo'), children: _jsx(IconArrowForwardUp, { ...I }) }), _jsx("span", { className: "format-sep" }), FONTS.map(([family, label]) => (_jsx(Btn, { title: `Carattere ${label}`, onPress: () => run('fontName', family), children: _jsx("span", { className: "font-chip", style: { fontFamily: `'${family}', sans-serif` }, children: label }) }, family))), _jsx("span", { className: "format-sep" }), _jsx(Btn, { title: "Grassetto", onPress: () => run('bold'), children: _jsx(IconBold, { ...I }) }), _jsx(Btn, { title: "Corsivo", onPress: () => run('italic'), children: _jsx(IconItalic, { ...I }) }), _jsx(Btn, { title: "Sottolineato", onPress: () => run('underline'), children: _jsx(IconUnderline, { ...I }) }), _jsx(Btn, { title: "Barrato", onPress: () => run('strikeThrough'), children: _jsx(IconStrikethrough, { ...I }) }), _jsx(Btn, { title: "Maiuscolo", onPress: () => wrap('text-transform', 'uppercase'), children: _jsx(IconLetterCaseUpper, { ...I }) }), _jsx(Btn, { title: "Evidenzia", onPress: () => run('hiliteColor', '#DDD1F2'), children: _jsx(IconHighlight, { ...I }) }), _jsx("span", { className: "format-sep" }), _jsx(Btn, { title: "Elenco puntato", onPress: () => run('insertUnorderedList'), children: _jsx(IconList, { ...I }) }), _jsx(Btn, { title: "Elenco numerato", onPress: () => run('insertOrderedList'), children: _jsx(IconListNumbers, { ...I }) }), _jsx("span", { className: "format-sep" }), _jsx(Btn, { title: "Allinea a sinistra", onPress: () => run('justifyLeft'), children: _jsx(IconAlignLeft, { ...I }) }), _jsx(Btn, { title: "Centra", onPress: () => run('justifyCenter'), children: _jsx(IconAlignCenter, { ...I }) }), _jsx(Btn, { title: "Allinea a destra", onPress: () => run('justifyRight'), children: _jsx(IconAlignRight, { ...I }) }), _jsx("span", { className: "format-sep" }), _jsx(Btn, { title: "Testo pi\u00F9 piccolo", onPress: () => resize(0.875), children: _jsx(IconTextDecrease, { ...I }) }), _jsx(Btn, { title: "Testo pi\u00F9 grande", onPress: () => resize(1.15), children: _jsx(IconTextIncrease, { ...I }) }), _jsx("span", { className: "format-sep" }), COLORS.map(([hex, name]) => (_jsx(Btn, { title: name, onPress: () => run('foreColor', hex), children: _jsx("span", { className: "swatch-dot", style: { background: hex } }) }, hex))), _jsx("span", { className: "format-sep" }), _jsx(Btn, { title: "Rimuovi formattazione", onPress: () => run('removeFormat'), children: _jsx(IconClearFormatting, { ...I }) })] }));
}
