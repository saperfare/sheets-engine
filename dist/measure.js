// Spacing overlay for the editor: page margins (blue), gaps between cards (green), card paddings (orange) and
// the gaps inside the cards (pink), plus the bounding box of every card and element (violet outlines),
// each band labelled with its value in px (sheet pixels, before the zoom). Drawn straight into the DOM.
function band(layer, kind, x, y, w, h, value) {
    if (w <= 0 || h <= 0 || value < 1)
        return;
    const el = document.createElement('div');
    el.className = `measure-band measure-${kind}`;
    Object.assign(el.style, { left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${h}px` });
    const tag = document.createElement('span');
    tag.textContent = String(Math.round(value));
    el.append(tag);
    layer.append(el);
}
function drawSheet(sheet) {
    sheet.querySelector(':scope > .measure-layer')?.remove();
    const scale = sheet.getBoundingClientRect().width / sheet.offsetWidth || 1;
    const origin = sheet.getBoundingClientRect();
    const rel = (r) => ({ l: (r.left - origin.left) / scale, t: (r.top - origin.top) / scale, r: (r.right - origin.left) / scale, b: (r.bottom - origin.top) / scale });
    const cells = [...sheet.querySelectorAll('[data-card] > .cell')].filter(c => c.offsetWidth > 0);
    if (!cells.length)
        return;
    const layer = document.createElement('div');
    layer.className = 'measure-layer';
    const boxes = cells.map(c => rel(c.getBoundingClientRect()));
    // margins: from the sheet edges (and the footer) to the outer cards
    const W = sheet.offsetWidth;
    const foot = sheet.querySelector('.sheet-foot');
    const H = foot ? foot.offsetTop : sheet.offsetHeight;
    const u = { l: Math.min(...boxes.map(b => b.l)), t: Math.min(...boxes.map(b => b.t)), r: Math.max(...boxes.map(b => b.r)), b: Math.max(...boxes.map(b => b.b)) };
    band(layer, 'margin', 0, u.t, u.l, u.b - u.t, u.l);
    band(layer, 'margin', u.r, u.t, W - u.r, u.b - u.t, W - u.r);
    band(layer, 'margin', u.l, 0, u.r - u.l, u.t, u.t);
    band(layer, 'margin', u.l, u.b, u.r - u.l, H - u.b, H - u.b);
    // gaps: to the nearest card on the right and below, over the stretch the two cards share
    // ponytail: O(n²) over the cards of one sheet, fine for the few dozen a page holds
    for (const a of boxes) {
        const right = boxes.filter(b => b.l >= a.r - 0.5 && Math.min(a.b, b.b) - Math.max(a.t, b.t) > 1).sort((x, y) => x.l - y.l)[0];
        if (right) {
            const t = Math.max(a.t, right.t), h = Math.min(a.b, right.b) - t;
            band(layer, 'gap', a.r, t, right.l - a.r, h, right.l - a.r);
        }
        const below = boxes.filter(b => b.t >= a.b - 0.5 && Math.min(a.r, b.r) - Math.max(a.l, b.l) > 1).sort((x, y) => x.t - y.t)[0];
        if (below) {
            const l = Math.max(a.l, below.l), w = Math.min(a.r, below.r) - l;
            band(layer, 'gap', l, a.b, w, below.t - a.b, below.t - a.b);
        }
    }
    // paddings: the four inner bands of every card
    cells.forEach((c, i) => {
        const b = boxes[i];
        const s = getComputedStyle(c);
        const [pt, pr, pb, pl] = [s.paddingTop, s.paddingRight, s.paddingBottom, s.paddingLeft].map(parseFloat);
        band(layer, 'pad', b.l, b.t, b.r - b.l, pt, pt);
        band(layer, 'pad', b.l, b.b - pb, b.r - b.l, pb, pb);
        band(layer, 'pad', b.l, b.t + pt, pl, b.b - b.t - pt - pb, pl);
        band(layer, 'pad', b.r - pr, b.t + pt, pr, b.b - b.t - pt - pb, pr);
    });
    // bounding boxes: every card and every element inside it (divs, texts, pictures), drawn as outlines
    for (const el of cells.flatMap(c => [c, ...c.querySelectorAll('*')])) {
        if (el.closest('.card-bar, .video-bar') || !el.getClientRects().length)
            continue;
        const b = rel(el.getBoundingClientRect());
        if (b.r - b.l < 2 || b.b - b.t < 2)
            continue;
        const box = document.createElement('div');
        box.className = el.classList.contains('cell') ? 'measure-box is-card' : 'measure-box';
        Object.assign(box.style, { left: `${b.l}px`, top: `${b.t}px`, width: `${b.r - b.l}px`, height: `${b.b - b.t}px` });
        layer.append(box);
    }
    // inner gaps: between the children of every flex or grid box inside the cards (lists, columns, rows)
    for (const c of cells) {
        for (const box of [c, ...c.querySelectorAll('*')]) {
            const s = getComputedStyle(box);
            if (!/flex|grid/.test(s.display) || (parseFloat(s.rowGap) || 0) + (parseFloat(s.columnGap) || 0) === 0)
                continue;
            const kids = [...box.children].filter(k => k.offsetWidth > 0 && getComputedStyle(k).position !== 'absolute').map(k => rel(k.getBoundingClientRect()));
            for (const a of kids) {
                const right = kids.filter(b => b.l >= a.r - 0.5 && Math.min(a.b, b.b) - Math.max(a.t, b.t) > 1).sort((x, y) => x.l - y.l)[0];
                if (right) {
                    const t = Math.max(a.t, right.t);
                    band(layer, 'inner', a.r, t, right.l - a.r, Math.min(a.b, right.b) - t, right.l - a.r);
                }
                const below = kids.filter(b => b.t >= a.b - 0.5 && Math.min(a.r, b.r) - Math.max(a.l, b.l) > 1).sort((x, y) => x.t - y.t)[0];
                if (below) {
                    const l = Math.max(a.l, below.l);
                    band(layer, 'inner', l, a.b, Math.min(a.r, below.r) - l, below.t - a.b, below.t - a.b);
                }
            }
        }
    }
    sheet.append(layer);
}
export function drawMeasures() {
    document.querySelectorAll('.sheet').forEach(drawSheet);
}
export function clearMeasures() {
    document.querySelectorAll('.measure-layer').forEach(l => l.remove());
}
