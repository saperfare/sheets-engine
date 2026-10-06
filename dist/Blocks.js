import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export const area = ({ col, row }) => ({ gridColumn: col, gridRow: row });
// Column with a title and a text (string, or paragraphs and a <dl className="facts"> list).
// top: text from the top; compact: small title; small: smaller title and text with soft shapes;
// num: a number written before the title (chapter numbers).
export function Head({ at, title, top, compact, small, orange, num, children }) {
    const cls = ['cell', 'cell-head', top && 'cell-head-top', compact && 'cell-head-compact', small && 'cell-head-small', orange && 'cell-head-orange'].filter(Boolean).join(' ');
    return (_jsxs("div", { className: cls, style: area(at), children: [_jsxs("h2", { className: "sheet-title", children: [num && _jsx("span", { className: "slide-num", children: num }), title] }), children && _jsx("div", { className: "sheet-desc", children: typeof children === 'string' ? _jsx("p", { children: children }) : children })] }));
}
// A picture filling its card, with an optional chip
export function Tile({ at, src, chip, pos }) {
    return (_jsxs("div", { className: "cell cell-img", style: area(at), children: [_jsx("img", { src: src, alt: chip ?? '', style: pos ? { objectPosition: pos } : undefined }), chip && _jsx("span", { className: "chip chip-float", children: chip })] }));
}
// Picture above, name with a chip and one line below. variant: overlay (caption on the picture), nested (two sub-cards)
export function ToolCard({ at, src, name, chip, line, variant }) {
    return (_jsxs("div", { className: `cell cell-tool${variant ? ` cell-tool-${variant}` : ''}`, style: area(at), children: [_jsx("div", { className: "tool-img", children: _jsx("img", { src: src, alt: name }) }), _jsxs("div", { className: "tool-caption", children: [_jsxs("div", { className: "tool-head", children: [_jsx("p", { className: "tool-name", children: name }), chip && _jsx("span", { className: "chip", children: chip })] }), line && _jsx("p", { className: "tool-line", children: line })] })] }));
}
// A QR code with its link under it
export function QrCard({ at, src, label }) {
    return (_jsxs("div", { className: "cell cell-online", style: area(at), children: [_jsx("img", { src: src, alt: `QR verso ${label}` }), _jsx("div", { children: _jsx("p", { className: "online-url", children: label }) })] }));
}
