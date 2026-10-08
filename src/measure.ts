// Spacing overlay for the editor: page margins (blue), gaps between cards (green) and card paddings (orange),
// each band labelled with its value in px (sheet pixels, before the zoom). Drawn straight into the DOM.

type Box = { l: number; t: number; r: number; b: number }

function band(layer: HTMLElement, kind: string, x: number, y: number, w: number, h: number, value: number) {
  if (w <= 0 || h <= 0 || value < 1) return
  const el = document.createElement('div')
  el.className = `measure-band measure-${kind}`
  Object.assign(el.style, { left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${h}px` })
  const tag = document.createElement('span')
  tag.textContent = String(Math.round(value))
  el.append(tag)
  layer.append(el)
}

function drawSheet(sheet: HTMLElement) {
  sheet.querySelector(':scope > .measure-layer')?.remove()
  const scale = sheet.getBoundingClientRect().width / sheet.offsetWidth || 1
  const origin = sheet.getBoundingClientRect()
  const rel = (r: DOMRect): Box => ({ l: (r.left - origin.left) / scale, t: (r.top - origin.top) / scale, r: (r.right - origin.left) / scale, b: (r.bottom - origin.top) / scale })
  const cells = [...sheet.querySelectorAll<HTMLElement>('[data-card] > .cell')].filter(c => c.offsetWidth > 0)
  if (!cells.length) return
  const layer = document.createElement('div')
  layer.className = 'measure-layer'
  const boxes = cells.map(c => rel(c.getBoundingClientRect()))

  // margins: from the sheet edges (and the footer) to the outer cards
  const W = sheet.offsetWidth
  const foot = sheet.querySelector<HTMLElement>('.sheet-foot')
  const H = foot ? foot.offsetTop : sheet.offsetHeight
  const u = { l: Math.min(...boxes.map(b => b.l)), t: Math.min(...boxes.map(b => b.t)), r: Math.max(...boxes.map(b => b.r)), b: Math.max(...boxes.map(b => b.b)) }
  band(layer, 'margin', 0, u.t, u.l, u.b - u.t, u.l)
  band(layer, 'margin', u.r, u.t, W - u.r, u.b - u.t, W - u.r)
  band(layer, 'margin', u.l, 0, u.r - u.l, u.t, u.t)
  band(layer, 'margin', u.l, u.b, u.r - u.l, H - u.b, H - u.b)

  // gaps: to the nearest card on the right and below, over the stretch the two cards share
  // ponytail: O(n²) over the cards of one sheet, fine for the few dozen a page holds
  for (const a of boxes) {
    const right = boxes.filter(b => b.l >= a.r - 0.5 && Math.min(a.b, b.b) - Math.max(a.t, b.t) > 1).sort((x, y) => x.l - y.l)[0]
    if (right) { const t = Math.max(a.t, right.t), h = Math.min(a.b, right.b) - t; band(layer, 'gap', a.r, t, right.l - a.r, h, right.l - a.r) }
    const below = boxes.filter(b => b.t >= a.b - 0.5 && Math.min(a.r, b.r) - Math.max(a.l, b.l) > 1).sort((x, y) => x.t - y.t)[0]
    if (below) { const l = Math.max(a.l, below.l), w = Math.min(a.r, below.r) - l; band(layer, 'gap', l, a.b, w, below.t - a.b, below.t - a.b) }
  }

  // paddings: the four inner bands of every card
  cells.forEach((c, i) => {
    const b = boxes[i]
    const s = getComputedStyle(c)
    const [pt, pr, pb, pl] = [s.paddingTop, s.paddingRight, s.paddingBottom, s.paddingLeft].map(parseFloat)
    band(layer, 'pad', b.l, b.t, b.r - b.l, pt, pt)
    band(layer, 'pad', b.l, b.b - pb, b.r - b.l, pb, pb)
    band(layer, 'pad', b.l, b.t + pt, pl, b.b - b.t - pt - pb, pl)
    band(layer, 'pad', b.r - pr, b.t + pt, pr, b.b - b.t - pt - pb, pr)
  })
  sheet.append(layer)
}

export function drawMeasures() {
  document.querySelectorAll<HTMLElement>('.sheet').forEach(drawSheet)
}

export function clearMeasures() {
  document.querySelectorAll('.measure-layer').forEach(l => l.remove())
}
