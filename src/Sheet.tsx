import { Children, cloneElement, createContext, isValidElement, useContext, useEffect, useRef, useState, type CSSProperties, type ReactElement, type ReactNode } from 'react'
import { IconAlignLeft, IconArchive, IconArchiveOff, IconArrowDown, IconArrowUp, IconBoxPadding, IconDeviceFloppy, IconLock, IconLockOpen, IconLayoutBottombar, IconLayoutGrid, IconTypography, IconMaximize, IconMovie, IconPalette, IconPlayerPauseFilled, IconPlayerPlayFilled, IconPhoto, IconPlus, IconRestore, IconTrash, IconUpload, IconX, IconZoomIn, IconZoomOut } from '@tabler/icons-react'
import { createPortal } from 'react-dom'
import ReactGridLayout, { getCompactor, type Layout, type LayoutItem } from 'react-grid-layout'
import { createScaledStrategy } from 'react-grid-layout/core'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'

// Sheet = A4 at 1600px on the long side (landscape for the pagine, portrait for the thesis covers),
// on a 48 x 48 support grid so cards can be dragged and resized finely. Sheets are laid out in design
// columns, converted to units with one rounding rule (rounding edges, not widths), so cards that touch keep touching.
// margin = page margin, gap = space between cards (px), both editable per document
// page = the @page size for the PDF, mm = printed long side (sets the print zoom);
// margin = top and bottom, marginX = left and right (px of the sheet: 1600px = 297mm, so 1cm = 53.87px)
export const LANDSCAPE = { w: 1600, h: 1131.36, foot: true, margin: 18, marginX: 18, gap: 18, page: 'A4 landscape', mm: 297 }
export const PORTRAIT = { w: 1131.36, h: 1600, foot: false, margin: 18, marginX: 18, gap: 30, page: 'A4 portrait', mm: 297 }
// Sizes in millimetres: the long side is 1600px = 297mm
export const mm = (v: number) => (v * 1600) / 297
// Slides: 16:9 at the same width as the A4 landscape sheets
export const SLIDE = { w: 1600, h: 900, foot: true, margin: 18, marginX: 18, gap: 18, page: '297mm 167.06mm', mm: 297 }
export type Format = { w: number; h: number; foot: boolean; margin: number; marginX: number; gap: number; page: string; mm: number }
export const FormatContext = createContext<Format>(LANDSCAPE)

// What the presentation tells every sheet: footer items and its key in texts.json, the theme bits the sheets use
export type EngineInfo = { footer: string[]; footerKey: string; logoMono: string; backgrounds: string[] }
export const EngineContext = createContext<EngineInfo>({ footer: [], footerKey: '__footer', logoMono: '', backgrounds: ['#FFFFFF'] })
const UNITS = 48
// data-u values are written in thirds of a design column (the old grid): converted at runtime
const OLD_SUB = 3
const ROWS = 48
// One line of footer at the bottom of every sheet, outside the grid
const FOOT = 34
const footHtml = (items: string[]) => items.map(t => `<span>${t}</span>`).join('<i class="sheet-foot-dot" aria-hidden="true"></i>')

// The footer text is one editable text per document: editing it on any page changes every page of that document
function FooterText({ editable }: { editable: boolean }) {
  const { texts, setText } = useContext(LayoutsContext)
  const { footer, footerKey: FOOT_KEY } = useContext(EngineContext)
  const FOOT_HTML = footHtml(footer)
  const ref = useRef<HTMLSpanElement>(null)
  const t = texts[FOOT_KEY]
  const want = t && t.orig === FOOT_HTML ? t.html : FOOT_HTML
  useEffect(() => {
    const el = ref.current
    if (el && document.activeElement !== el && el.innerHTML !== want) el.innerHTML = want
  }, [want])
  return (
    <span
      ref={ref}
      className="sheet-foot-text"
      contentEditable={editable}
      suppressContentEditableWarning
      onInput={e => setText(FOOT_KEY, e.currentTarget.innerHTML === FOOT_HTML ? null : { orig: FOOT_HTML, html: e.currentTarget.innerHTML })}
    />
  )
}

const rowH = (gridH: number, margin: number, gap: number) => (gridH - 2 * margin - (ROWS - 1) * gap) / ROWS
// Optional title bar at the top, same height as the footer, outside the grid
const HEAD = 34

export type Saved = Record<string, Layout>
// orig = the markup in the code, so an edit is applied only while the code text is unchanged
export type TextEdit = { orig: string; html: string }
export type Texts = Record<string, TextEdit>
// Per sheet: removed cards, cards added by hand, image scale and background per card
// An added card: text, a full image, or an image with a caption
export type Extra = { i: string; kind: 'text' | 'image' | 'media' | 'video'; src?: string }
// img: the image picked for a placeholder card (data-slot) of the code
export type SheetCards = { hidden?: string[]; extra?: (Extra | string)[]; scale?: Record<string, number>; pad?: Record<string, number>; bg?: Record<string, string>; img?: Record<string, string> }
export type Cards = Record<string, SheetCards>

type Ctx = {
  saved: Saved
  save: (id: string, l: Layout | null) => void
  texts: Texts
  setText: (key: string, t: TextEdit | null) => void
  cards: Cards
  setCards: (id: string, c: SheetCards | null) => void
  saveSheet: (id: string) => void
  pendingIn: (id: string) => number
  mode: 'layout' | 'text' | 'view'
}
type PageInfo = {
  n: number
  of: number
  title: string
  onMove?: (d: number) => void
  canUp?: boolean
  canDown?: boolean
  onArchive?: () => void
  onRestore?: () => void
  approved?: boolean // both locks on
  layoutLocked?: boolean
  textLocked?: boolean
  onLockLayout?: () => void
  onLockText?: () => void
  onApprove?: () => void
  onRename?: (title: string) => void
}
export const PageContext = createContext<PageInfo>({ n: 1, of: 1, title: '' })

// Sheet name in the tools bar: click to rename inline (Enter saves, Esc cancels); empty restores the default
function SheetName({ n, title, onRename }: { n: number; title: string; onRename?: (t: string) => void }) {
  const [draft, setDraft] = useState<string | null>(null)
  if (!onRename) return <span className="sheet-tools-name">{n}. {title}</span>
  if (draft === null) return <button type="button" className="sheet-tools-name is-editable" title="Rinomina" onClick={() => setDraft(title)}>{n}. {title}</button>
  const done = (save: boolean) => { if (save) onRename(draft); setDraft(null) }
  return (
    <span className="sheet-tools-name">{n}.{' '}
      <input
        className="sheet-rename" autoFocus value={draft} aria-label="Nome della pagina"
        onChange={e => setDraft(e.target.value)} onFocus={e => e.target.select()}
        onKeyDown={e => { if (e.key === 'Enter') done(true); if (e.key === 'Escape') done(false) }}
        onBlur={() => done(true)}
      />
    </span>
  )
}

// Zoom applied to the sheets (to fit next to the sidebar): the grid needs it to keep dragging precise
export const ScaleContext = createContext(1)
// The library's scaled strategy computes the drag start against the viewport (the card jumps):
// without calcDragPosition the grid falls back to parent-relative math, still divided by the scale
const scaled = (s: number) => ({ ...createScaledStrategy(s), calcDragPosition: undefined })
export const LayoutsContext = createContext<Ctx>({
  saved: {}, save: () => {}, texts: {}, setText: () => {}, cards: {}, setCards: () => {}, saveSheet: () => {}, pendingIn: () => 0, mode: 'layout',
})

// Every leaf of text a viewer can rewrite in text mode
export const TEXT = 'h2, h3, p, li > span, li > b, dt, dd, .chip, .type-font-title, .type-font-desc, .tw-sample, .tl-num'


// Children.toArray prefixes keys with their position (".1:$x"): keep only the name
const clean = (k: unknown) => String(k).replace(/^.*\$/, '')
const asExtra = (e: Extra | string): Extra => (typeof e === 'string' ? { i: e, kind: 'text' } : e)

// Light or dark background, judged on the first colour of the value (gradients start light here)
const isLight = (bg: string) => {
  const hex = bg.match(/#([0-9a-f]{6})/i)?.[1] ?? 'ffffff'
  const [r, g, b] = [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16))
  return 0.299 * r + 0.587 * g + 0.114 * b > 150
}

const MIN = 3
const overlaps = (a0: number, a1: number, b0: number, b1: number) => a0 < b1 && b0 < a1

// Resizing works like a splitter on every side: the cells touching the moved edge
// give or take the same space, never below MIN.
function shareEdge(layout: Layout, o: LayoutItem, n: LayoutItem): Layout {
  const out = layout.map(l => ({ ...l }))
  const me = out.find(l => l.i === n.i)!
  const others = out.filter(l => l !== me)
  const rowsTouch = (l: LayoutItem) => overlaps(l.y, l.y + l.h, o.y, o.y + o.h)
  const colsTouch = (l: LayoutItem) => overlaps(l.x, l.x + l.w, o.x, o.x + o.w)
  const east = others.filter(l => l.x === o.x + o.w && rowsTouch(l))
  const west = others.filter(l => l.x + l.w === o.x && rowsTouch(l))
  const south = others.filter(l => l.y === o.y + o.h && colsTouch(l))
  const north = others.filter(l => l.y + l.h === o.y && colsTouch(l))
  // growth of each edge (positive = the card gets bigger on that side)
  let dE = n.x + n.w - (o.x + o.w)
  let dW = o.x - n.x
  let dS = n.y + n.h - (o.y + o.h)
  let dN = o.y - n.y
  const cap = (d: number, ls: LayoutItem[], size: (l: LayoutItem) => number) =>
    d > 0 ? ls.reduce((m, l) => Math.min(m, Math.max(0, size(l) - MIN)), d) : d
  dE = cap(dE, east, l => l.w)
  dW = cap(dW, west, l => l.w)
  dS = cap(dS, south, l => l.h)
  dN = cap(dN, north, l => l.h)
  me.x = o.x - dW
  me.w = o.w + dW + dE
  me.y = o.y - dN
  me.h = o.h + dN + dS
  for (const l of east) { l.x += dE; l.w -= dE }
  for (const l of west) l.w -= dW
  for (const l of south) { l.y += dS; l.h -= dS }
  for (const l of north) l.h -= dN
  return out
}

// "2 / 4" or "3" (CSS grid lines) -> [start, span]
const lines = (v: unknown, fallback: number): [number, number] => {
  if (v == null) return [fallback, 1]
  const [a, b] = String(v).split('/').map(n => parseFloat(n))
  return [a - 1, (b || a + 1) - a]
}

// design column edge -> grid unit
const toUnit = (col: number, cols: number) => Math.round((col * UNITS) / cols)

// fr weights -> cumulative unit boundaries summing to ROWS
const rowEdges = (fr: number[]) => {
  const total = fr.reduce((a, b) => a + b, 0)
  let acc = 0
  return [0, ...fr.map(f => Math.round(((acc += f) / total) * ROWS))]
}

// data-u="x w" overrides the horizontal position in grid units (finer than a column)
type CellProps = { style?: CSSProperties; at?: { col: string; row: string }; 'data-u'?: string; 'data-slot'?: boolean }

function CardBar({ isImage, isVideo, pad, onPad, onScale, onBg, onImage, onRemove }: { isImage: boolean; isVideo?: boolean; pad?: number; onPad: (p: number | null) => void; onScale: (f: number) => void; onBg: (c: string | null) => void; onImage: () => void; onRemove: () => void }) {
  const [colors, setColors] = useState(false)
  const { backgrounds } = useContext(EngineContext)
  // Inner margin of the card; starts from the padding the CSS gives it now
  const [padOpen, setPadOpen] = useState<number | null>(null)
  const bar = useRef<HTMLDivElement>(null)
  const openPad = () => {
    if (padOpen !== null) return setPadOpen(null)
    const cell = bar.current?.parentElement?.querySelector<HTMLElement>(':scope > .cell')
    setPadOpen(pad ?? Math.round(parseFloat(cell ? getComputedStyle(cell).paddingTop : '28')))
  }
  const I = { size: 15, stroke: 1.75 }
  return (
    <div className="card-bar" ref={bar} onMouseDown={e => e.stopPropagation()}>
      <button type="button" title="Immagine più piccola" onClick={() => onScale(1 / 1.1)}><IconZoomOut {...I} /></button>
      <button type="button" title="Immagine più grande" onClick={() => onScale(1.1)}><IconZoomIn {...I} /></button>
      {isImage && <button type="button" title={isVideo ? 'Cambia video' : 'Cambia immagine'} onClick={onImage}>{isVideo ? <IconMovie {...I} /> : <IconPhoto {...I} />}</button>}
      <button type="button" title="Margine interno" className={padOpen !== null ? 'on' : ''} onClick={openPad}><IconBoxPadding {...I} /></button>
      <button type="button" title="Sfondo" className={colors ? 'on' : ''} onClick={() => setColors(c => !c)}><IconPalette {...I} /></button>
      <button type="button" title="Elimina card" onClick={onRemove}><IconTrash {...I} /></button>
      {padOpen !== null && (
        <div className="card-colors card-pad">
          <span>Margine interno</span>
          <input type="range" min={0} max={160} step={2} value={padOpen} onChange={e => { const v = +e.target.value; setPadOpen(v); onPad(v) }} />
          <b>{padOpen} px</b>
          <button type="button" className="card-colors-reset" onClick={() => { onPad(null); setPadOpen(null) }}>Originale</button>
        </div>
      )}
      {colors && (
        <div className="card-colors">
          {backgrounds.map(c => (
            <button key={c} type="button" title={c.startsWith('linear') ? 'Gradiente' : c} onClick={() => onBg(c)}><span className="swatch-dot" style={{ background: c }} /></button>
          ))}
          <button type="button" title="Sfondo originale" className="card-colors-reset" onClick={() => onBg(null)}>Originale</button>
        </div>
      )}
    </div>
  )
}

// In-app gallery: every image in public/img, plus upload from disk (dev server only)
function Gallery({ onPick, onClose, inUse, video }: { onPick: (src: string) => void; onClose: () => void; inUse: Set<string>; video?: boolean }) {
  const [images, setImages] = useState<string[] | null>(null)
  const [confirm, setConfirm] = useState<string | null>(null)
  const refresh = () => fetch(video ? '/__images?kind=video' : '/__images').then(r => r.json()).then(setImages).catch(() => setImages([]))
  useEffect(() => { refresh() }, [])
  const upload = async (file: File) => {
    const res = await fetch(`/__upload?name=${encodeURIComponent(file.name)}${video ? '&kind=video' : ''}`, { method: 'POST', body: file })
    if (res.ok) onPick(await res.text())
  }
  // Two clicks: the first arms the delete, the second moves the file to .trash/
  const remove = async (src: string) => {
    if (confirm !== src) return setConfirm(src)
    await fetch(`/__delete-image?src=${encodeURIComponent(src)}`, { method: 'POST' })
    setConfirm(null)
    refresh()
  }
  // portal: the sheet is scaled with a transform, which would trap a fixed modal inside it
  return createPortal(
    <div className="modal-back" onMouseDown={onClose}>
      <div className="modal" role="dialog" aria-label={video ? 'Scegli un video' : "Scegli un'immagine"} onMouseDown={e => e.stopPropagation()}>
        <header>
          <span>{video ? 'Scegli un video' : "Scegli un'immagine"}</span>
          <label className="modal-upload">
            <IconUpload size={15} stroke={1.75} />Carica dal computer
            <input type="file" accept={video ? 'video/mp4,video/webm' : 'image/png,image/jpeg,image/webp'} hidden onChange={e => e.target.files?.[0] && upload(e.target.files[0])} />
          </label>
          <button type="button" onClick={onClose} aria-label="Chiudi"><IconX size={16} stroke={1.75} /></button>
        </header>
        <div className="modal-grid">
          {images === null && <p>Carico…</p>}
          {images?.map(src => (
            <div key={src} className="modal-tile">
              <button type="button" className="modal-pick" onClick={() => onPick(src)} title={src}>{video ? <video src={src} muted preload="metadata" /> : <img src={src} alt="" loading="lazy" />}</button>
              <button
                type="button"
                className={confirm === src ? 'modal-del armed' : 'modal-del'}
                title={confirm === src ? (inUse.has(src) ? 'È usato in una card: clicca ancora per eliminarlo' : 'Clicca ancora per eliminarlo') : 'Elimina file'}
                aria-label="Elimina file"
                onClick={() => remove(src)}
                onMouseLeave={() => confirm === src && setConfirm(null)}
              >
                <IconTrash size={14} stroke={1.75} />{confirm === src && <span>{inUse.has(src) ? 'In uso, elimina?' : 'Elimina?'}</span>}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  , document.body)
}

// Size of a placeholder, so the right image can be prepared: the long side is 1600px = 297mm,
// so at 300 dpi one CSS pixel of the sheet is 3508 / 1600 printed pixels (either orientation).
const PRINT = 3508 / 1600
const RATIOS: [string, number][] = [['1:1', 1], ['4:3', 4 / 3], ['3:2', 3 / 2], ['16:9', 16 / 9], ['3:4', 3 / 4], ['2:3', 2 / 3], ['9:16', 9 / 16]]

export function SlotSize() {
  const ref = useRef<HTMLSpanElement>(null)
  const [size, setSize] = useState<[number, number] | null>(null)
  useEffect(() => {
    const box = ref.current?.parentElement
    if (!box) return
    const ro = new ResizeObserver(([e]) => setSize([e.contentRect.width, e.contentRect.height]))
    ro.observe(box)
    return () => ro.disconnect()
  }, [])
  if (!size || !size[1]) return <span ref={ref} className="slot-size" />
  const [w, h] = size
  const r = w / h
  const near = RATIOS.find(([, v]) => Math.abs(v - r) / v < 0.03)?.[0]
  return (
    <span ref={ref} className="slot-size">
      Rapporto {near ?? `${r.toFixed(2).replace('.', ',')}:1`}
      <br />
      Per la stampa almeno {Math.round(w * PRINT)} × {Math.round(h * PRINT)} px
    </span>
  )
}

// Cards that hold a plain <img> in their markup (the logos, the picture behind the thanks slide):
// the image can be swapped from the gallery like a slot. The choice is stored in cards.img like the slots.
function hasImg(node: ReactNode): boolean {
  let found = false
  Children.forEach(node, c => {
    if (found || !isValidElement(c)) return
    found = c.type === 'img' || hasImg((c.props as { children?: ReactNode }).children)
  })
  return found
}
function swapImg(el: ReactElement, src: string): ReactElement {
  let done = false
  const walk = (n: ReactNode): ReactNode =>
    Children.map(n, c => {
      if (done || !isValidElement(c)) return c
      if (c.type === 'img') { done = true; return cloneElement(c as ReactElement<{ src?: string }>, { src }) }
      const kids = (c.props as { children?: ReactNode }).children
      return kids ? cloneElement(c, undefined, walk(kids)) : c
    })
  return cloneElement(el, undefined, walk((el.props as { children?: ReactNode }).children))
}

// A video that loops muted inside its card and opens full screen on demand (the slides, the video cards).
// Sound only in full screen; play and pause from the bar or by clicking the video (also while presenting,
// where a click elsewhere turns the slide).
export function VideoBox({ src, poster, label }: { src: string; poster?: string; label?: string }) {
  const ref = useRef<HTMLVideoElement>(null)
  const [paused, setPaused] = useState(false)
  useEffect(() => {
    const v = ref.current
    if (!v) return
    // React does not write the muted attribute: set it on the element, or Edge may autoplay with sound
    v.muted = true
    v.defaultMuted = true
    const onFs = () => { v.muted = document.fullscreenElement !== v }
    document.addEventListener('fullscreenchange', onFs)
    return () => document.removeEventListener('fullscreenchange', onFs)
  }, [])
  const toggle = (e: { stopPropagation: () => void }) => {
    e.stopPropagation()
    const v = ref.current
    if (!v) return
    if (v.paused) v.play()
    else v.pause()
  }
  return (
    <>
      <video ref={ref} src={src} poster={poster} autoPlay muted loop playsInline onPlay={() => setPaused(false)} onPause={() => setPaused(true)} onClick={toggle} />
      <div className="video-bar">
        {label ? <p>{label}</p> : <span />}
        <div className="video-actions">
          <button type="button" title={paused ? 'Riproduci' : 'Pausa'} aria-label={paused ? 'Riproduci il video' : 'Metti in pausa il video'} onClick={toggle}>{paused ? <IconPlayerPlayFilled size={16} /> : <IconPlayerPauseFilled size={16} />}</button>
          <button type="button" title="Schermo intero, con l’audio" aria-label="Guarda il video a schermo intero, con l’audio" onClick={e => { e.stopPropagation(); ref.current?.requestFullscreen() }}><IconMaximize size={18} stroke={1.75} /></button>
        </div>
      </div>
    </>
  )
}

function ExtraCard({ e }: { e: Extra }) {
  if (e.kind === 'video')
    return (
      <div className="cell cell-video">
        {e.src ? <VideoBox src={e.src} /> : <div className="slot-empty"><IconMovie size={28} stroke={1.5} /><span>Scegli un video</span></div>}
      </div>
    )
  if (e.kind === 'image')
    return (
      <div className="cell cell-img">
        {e.src ? <img src={e.src} alt="" /> : <div className="slot-empty"><IconPhoto size={28} stroke={1.5} /><span>Scegli un'immagine</span></div>}
      </div>
    )
  if (e.kind === 'media')
    return (
      <div className="cell cell-media">
        <div className="tool-img">{e.src ? <img src={e.src} alt="" /> : <div className="slot-empty"><IconPhoto size={28} stroke={1.5} /><span>Scegli un'immagine</span></div>}</div>
        <p className="media-caption">Scrivi qui la didascalia.</p>
      </div>
    )
  return (
    <div className="cell cell-text cell-extra">
      <span className="chip">Nota</span>
      <p>Scrivi qui il testo della card.</p>
    </div>
  )
}

// bleed: no page margin, no gaps, square cards (one surface edge to edge, e.g. the thesis covers)
// nofoot: this sheet only goes without the footer (the cover slide)
export function Sheet({ id, cols, rows, className = 'sheet', heading, bleed, nofoot, children }: { id: string; cols: number; rows: number[]; className?: string; heading?: string; bleed?: boolean; nofoot?: boolean; children: ReactNode }) {
  const { logoMono } = useContext(EngineContext)
  const f = useContext(FormatContext)
  const { w: W, h: H } = f
  const foot = f.foot && !nofoot
  const [margin, marginX, gap] = bleed ? [0, 0, 0] : [f.margin, f.marginX, f.gap]
  const gridH = H - (foot ? FOOT : 0) - (heading ? HEAD : 0)
  const { saved, save, texts, setText, cards, setCards, saveSheet, pendingIn, mode: globalMode } = useContext(LayoutsContext)
  const page = useContext(PageContext)
  const scale = useContext(ScaleContext)
  // Two locks: the layout one stops moving, resizing and adding cards, the text one stops rewriting
  const layoutLocked = !!(page.approved || page.layoutLocked)
  const textLocked = !!(page.approved || page.textLocked)
  const mode = (globalMode === 'layout' && layoutLocked) || (globalMode === 'text' && textLocked) ? 'view' : globalMode
  const pending = pendingIn(id)
  const ref = useRef<HTMLDivElement>(null)
  const [rev, setRev] = useState(0)
  const [adding, setAdding] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const [live, setLive] = useState<LayoutItem | null>(null)
  const [picking, setPicking] = useState<string | 'new-image' | 'new-media' | null>(null)
  const mine = cards[id] ?? {}
  const extras = (mine.extra ?? []).map(asExtra)
  const update = (patch: Partial<SheetCards>) => setCards(id, { ...mine, ...patch })

  // Text edits live in the DOM (contentEditable); React never rewrites these static nodes.
  // Keys are card + position inside the card, so adding or removing cards keeps them stable.
  // data-text-key="x" makes a shared text (key "@x"): editing it in one place edits it on every sheet.
  useEffect(() => {
    ref.current?.querySelectorAll<HTMLElement>('[data-card]').forEach(card => {
      card.querySelectorAll<HTMLElement>(TEXT).forEach((el, n) => {
        if (el.closest('.card-bar')) return
        const key = el.dataset.textKey ? `@${el.dataset.textKey}` : `${id}:${card.dataset.card}:${n}`
        el.dataset.orig ??= el.innerHTML
        const orig = el.dataset.orig
        const t = texts[key]
        const want = t && t.orig === orig ? t.html : orig
        if (document.activeElement !== el && el.innerHTML !== want) el.innerHTML = want
        const editable = mode === 'text' ? 'true' : 'false'
        if (el.contentEditable !== editable) el.contentEditable = editable // reassigning drops the focus
        el.oninput = () => setText(key, el.innerHTML === orig ? null : { orig, html: el.innerHTML })
        el.onpaste = e => {
          e.preventDefault()
          document.execCommand('insertText', false, e.clipboardData?.getData('text/plain') ?? '')
        }
      })
    })
  })

  const reset = () => {
    if (!confirmReset) {
      setConfirmReset(true)
      setTimeout(() => setConfirmReset(false), 3000)
      return
    }
    setConfirmReset(false)
    save(id, null)
    setCards(id, null)
    for (const k of Object.keys(texts)) if (k.startsWith(id + ':')) setText(k, null)
    setRev(r => r + 1)
  }

  const edges = rowEdges(rows)
  const hidden = new Set(mine.hidden ?? [])
  const coded = Children.toArray(children).filter(isValidElement) as ReactElement<CellProps>[]

  // ponytail: cells without an explicit position flow left to right, top to bottom
  let flow = 0
  const taken = new Set<number>()
  const defaults: LayoutItem[] = coded.map((el, n) => {
    const p = el.props
    let [cx, cw] = lines(p.at?.col ?? p.style?.gridColumn, -1)
    let [ry, rh] = lines(p.at?.row ?? p.style?.gridRow, -1)
    if (cx < 0 || ry < 0) {
      while (taken.has(flow)) flow++
      cx = flow % cols; ry = Math.floor(flow / cols); cw = rh = 1
    }
    for (let r = ry; r < ry + rh; r++) for (let c = cx; c < cx + cw; c++) taken.add(r * cols + c)
    const [ux, uw] = (p['data-u'] ?? '').split(' ').map(Number)
    // edges in design columns (or thirds of a column for data-u), then one rounding per edge
    const [l, r] = p['data-u'] ? [ux / OLD_SUB, (ux + uw) / OLD_SUB] : [cx, cx + cw]
    const x = toUnit(l, cols)
    return { i: el.key != null ? clean(el.key) : String(n), x, w: toUnit(r, cols) - x, y: edges[ry], h: edges[ry + rh] - edges[ry], minW: MIN, minH: MIN }
  })
  for (const e of extras) defaults.push({ i: e.i, x: 0, y: 0, w: toUnit(2, cols), h: 16, minW: MIN, minH: MIN })

  const nodes: [string, ReactElement][] = [
    ...coded.map((el, n): [string, ReactElement] => [el.key != null ? clean(el.key) : String(n), el]),
    ...extras.map((e): [string, ReactElement] => [e.i, <ExtraCard e={e} />]),
  ].filter(([k]) => !hidden.has(k))
  const stored = new Map((saved[id] ?? []).map(l => [clean(l.i), l]))
  const layout = defaults
    .filter(d => !hidden.has(d.i))
    .map(d => {
      const s = stored.get(d.i)
      return s ? { ...d, x: s.x, y: s.y, w: s.w, h: s.h } : d
    })

  // Only positions that differ from the code are stored, so later code changes still apply.
  const keep = (l: Layout) => {
    const byId = new Map(defaults.map(d => [d.i, d]))
    const diff = l.filter(it => {
      const d = byId.get(it.i)
      return !d || d.x !== it.x || d.y !== it.y || d.w !== it.w || d.h !== it.h
    }).map(({ i, x, y, w, h }) => ({ i, x, y, w, h }))
    save(id, diff.length ? (diff as Layout) : null)
    setRev(r => r + 1) // remount so the grid re-reads the layout prop even when nothing moved
  }

  const remove = (k: string) => {
    if (extras.some(e => e.i === k)) update({ extra: extras.filter(e => e.i !== k) })
    else update({ hidden: [...hidden, k] })
  }
  const add = (kind: Extra['kind']) => {
    setAdding(false)
    const i = `nota-${Date.now().toString(36)}`
    if (kind === 'text') update({ extra: [...extras, { i, kind }] })
    else setPicking(kind === 'image' ? 'new-image' : kind === 'video' ? 'new-video' : 'new-media')
  }
  const pick = (src: string) => {
    if (picking === 'new-video') {
      update({ extra: [...extras, { i: `video-${Date.now().toString(36)}`, kind: 'video', src }] })
    } else if (picking === 'new-image' || picking === 'new-media') {
      update({ extra: [...extras, { i: `img-${Date.now().toString(36)}`, kind: picking === 'new-image' ? 'image' : 'media', src }] })
    } else if (picking && extras.some(e => e.i === picking)) {
      update({ extra: extras.map(e => (e.i === picking ? { ...e, src } : e)) })
    } else if (picking) {
      update({ img: { ...mine.img, [picking]: src } })
    }
    setPicking(null)
  }
  const scaleBy = (k: string, f: number) => update({ scale: { ...mine.scale, [k]: Math.round((mine.scale?.[k] ?? 1) * f * 100) / 100 } })
  const setPad = (k: string, p: number | null) => {
    const pad = { ...mine.pad }
    if (p === null) delete pad[k]
    else pad[k] = p
    update({ pad })
  }
  const setBg = (k: string, c: string | null) => {
    const bg = { ...mine.bg }
    if (c) bg[k] = c
    else delete bg[k]
    update({ bg })
  }

  const I = { size: 14, stroke: 1.75 }
  return (
    <div className="sheet-wrap">
      {globalMode !== 'view' && <div className="sheet-tools">
        <div className="sheet-tools-left">
          {page.n > 0 && <SheetName n={page.n} title={page.title} onRename={textLocked ? undefined : page.onRename} />}
          {page.onMove && !layoutLocked && (
            <>
              <button type="button" className="round" title="Sposta su" aria-label="Sposta la pagina su" disabled={!page.canUp} onClick={() => page.onMove!(-1)}><IconArrowUp {...I} /></button>
              <button type="button" className="round" title="Sposta giù" aria-label="Sposta la pagina giù" disabled={!page.canDown} onClick={() => page.onMove!(1)}><IconArrowDown {...I} /></button>
            </>
          )}
        </div>
        {!layoutLocked && <div className="add-wrap">
          <button type="button" title="Aggiungi card" aria-label="Aggiungi card" className={adding ? 'on' : ''} onClick={() => setAdding(a => !a)}><IconPlus {...I} /><span className="lbl">Aggiungi card</span></button>
          {adding && (
            <div className="add-menu">
              <button type="button" onClick={() => add('text')}><IconAlignLeft {...I} />Testo</button>
              <button type="button" onClick={() => add('image')}><IconPhoto {...I} />Immagine</button>
              <button type="button" onClick={() => add('media')}><IconLayoutBottombar {...I} />Immagine e didascalia</button>
              <button type="button" onClick={() => add('video')}><IconMovie {...I} />Video</button>
            </div>
          )}
        </div>}
        {!layoutLocked && <button type="button" title={confirmReset ? 'Clicca ancora per ripristinare' : 'Ripristina pagina'} aria-label="Ripristina pagina" className={confirmReset ? 'danger' : ''} onClick={reset}>
          <IconRestore {...I} />{confirmReset ? <span className="lbl lbl-keep">Clicca ancora</span> : <span className="lbl">Ripristina pagina</span>}
        </button>}
        {page.onArchive && !layoutLocked && <button type="button" title="Archivia la pagina" aria-label="Archivia la pagina" onClick={page.onArchive}><IconArchive {...I} /><span className="lbl">Archivia</span></button>}
        {page.onRestore && <button type="button" title="Rimetti tra le pagine" aria-label="Rimetti tra le pagine" onClick={page.onRestore}><IconArchiveOff {...I} /><span className="lbl">Rimetti tra le pagine</span></button>}
        <button type="button" title={pending ? 'Salva pagina' : 'Pagina salvata'} aria-label="Salva pagina" className="primary" onClick={() => saveSheet(id)} disabled={!pending}>
          <IconDeviceFloppy {...I} /><span className="lbl">{pending ? 'Salva pagina' : 'Pagina salvata'}</span>{pending > 0 && <span className="count">{pending}</span>}
        </button>
        {page.onLockLayout && (
          <button type="button" className={layoutLocked ? 'approved' : 'unapproved'} title={layoutLocked ? 'Sblocca il layout' : 'Blocca il layout: niente spostamenti, ridimensionamenti o card nuove'} onClick={page.onLockLayout}>
            {layoutLocked ? <IconLock {...I} /> : <IconLockOpen {...I} />}<IconLayoutGrid {...I} /><span className="lbl">Layout</span>
          </button>
        )}
        {page.onLockText && (
          <button type="button" className={textLocked ? 'approved' : 'unapproved'} title={textLocked ? 'Sblocca i testi' : 'Blocca i testi: niente modifiche alle scritte'} onClick={page.onLockText}>
            {textLocked ? <IconLock {...I} /> : <IconLockOpen {...I} />}<IconTypography {...I} /><span className="lbl">Testi</span>
          </button>
        )}
      </div>}
      <div className={`${className}${bleed ? ' sheet-bleed' : ''}${layoutLocked && textLocked && globalMode !== 'view' ? ' is-approved' : mode === 'view' && globalMode !== 'view' ? ' is-locked' : ''}${layoutLocked && globalMode !== 'view' ? ' is-layout-locked' : ''}`} ref={ref}>
        {heading && <header className="sheet-head" style={{ height: HEAD }}><h2>{heading}</h2></header>}
        <ReactGridLayout
          key={rev}
          width={W}
          layout={layout}
          positionStrategy={scale === 1 ? undefined : scaled(scale)}
          autoSize={false}
          style={{ height: gridH, marginTop: heading ? HEAD : 0 }}
          gridConfig={{ cols: UNITS, rowHeight: rowH(gridH, margin, gap), margin: [gap, gap], containerPadding: [marginX, margin], maxRows: ROWS }}
          dragConfig={{ enabled: mode === 'layout', bounded: true, cancel: '.card-bar' }}
          resizeConfig={{ enabled: mode === 'layout', handles: ['n', 'e', 's', 'w', 'ne', 'nw', 'se', 'sw'] }}
          compactor={getCompactor(null, true)}
          onResize={(_l, _o, n) => n && setLive(n)}
          onDrag={(_l, _o, n) => n && setLive(n)}
          onDragStop={l => { setLive(null); keep(l) }}
          onResizeStop={(l, o, n) => { setLive(null); keep(o && n ? shareEdge(l, o, n) : l) }}
        >
          {nodes.map(([k, el]) => {
            const bg = mine.bg?.[k]
            const img = mine.img?.[k]
            const slot = !!(el.props as CellProps)['data-slot']
            const pad = mine.pad?.[k]
            const style = { '--s': mine.scale?.[k] ?? 1, ...(pad != null ? { '--pad': `${pad}px` } : {}), ...(bg ? { '--bg': bg } : {}), ...(img ? { '--img': `url("${img}")` } : {}) } as CSSProperties
            const extra = extras.find(e => e.i === k)
            const plainImg = !slot && !extra && hasImg((el.props as { children?: ReactNode }).children)
            const cls = [bg && `has-bg ${isLight(bg) ? 'bg-light' : 'bg-dark'}`, img && 'has-img', pad != null && 'has-pad'].filter(Boolean).join(' ')
            return (
              <div
                key={k}
                data-card={k}
                className={cls || undefined}
                style={style}
                onClick={slot && mode === 'layout' ? e => { if ((e.target as HTMLElement).closest('.slot-empty')) setPicking(k) } : undefined}
              >
                {plainImg && img ? swapImg(el, img) : el}
                {mode === 'layout' && (() => {
                  // live size while resizing or moving, so the chip never goes stale or disappears
                  const it = live?.i === k ? live : layout.find(l => l.i === k)
                  return it ? <span className={live?.i === k ? 'card-size is-live' : 'card-size'} aria-hidden="true">A {it.h} × L {it.w}</span> : null
                })()}
                {mode === 'layout' && (
                  <CardBar
                    isImage={slot || plainImg || (!!extra && extra.kind !== 'text')}
                    isVideo={extra?.kind === 'video'}
                    pad={pad}
                    onPad={p => setPad(k, p)}
                    onScale={f => scaleBy(k, f)}
                    onBg={c => setBg(k, c)}
                    onImage={() => setPicking(k)}
                    onRemove={() => remove(k)}
                  />
                )}
              </div>
            )
          })}
        </ReactGridLayout>
        {foot && <footer className="sheet-foot" style={{ height: FOOT }}>
          {logoMono && <img src={logoMono} alt="" />}
          <FooterText editable={mode === 'text'} />
          <span className="sheet-foot-n">{page.title}{page.n > 0 && <><i className="sheet-foot-dot" aria-hidden="true" />Pagina {page.n} di {page.of}</>}</span>
        </footer>}
      </div>
      {picking && (
        <Gallery
          video={picking === 'new-video' || extras.some(e => e.i === picking && e.kind === 'video')}
          onPick={pick}
          onClose={() => setPicking(null)}
          inUse={new Set(Object.values(cards).flatMap(c => [...Object.values(c.img ?? {}), ...(c.extra ?? []).map(e => (typeof e === 'string' ? '' : e.src ?? ''))]))}
        />
      )}
    </div>
  )
}
