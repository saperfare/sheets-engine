import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { IconArchive, IconArrowBackUp, IconFileAlert, IconFileCheck, IconRefresh, IconCheck, IconDeviceFloppy, IconLayoutSidebarLeftCollapse, IconLayoutSidebarLeftExpand, IconDownload, IconPresentation, IconLayoutBoard, IconSelector, IconSettings, IconX, IconRulerMeasure } from '@tabler/icons-react'
import { clearMeasures, drawMeasures } from './measure'
import FormatBar, { TextColorsContext } from './FormatBar'
import { EngineContext, FormatContext, LANDSCAPE, LayoutsContext, PageContext, ScaleContext, TEXT, type Cards, type Saved, type SheetCards, type TextEdit, type Texts } from './Sheet'
import type { DocConfig, PresentationConfig, PresentationData } from './config'
import type { Theme } from './theme'

declare const __BUILD_ID__: string
type Settings = { texture?: string; order?: string[]; approved?: string[]; lockLayout?: string[]; lockText?: string[]; margin?: number; gap?: number; names?: Record<string, string> }
// Editor preferences: per browser, not part of the project files
// keys are set per presentation in PresentationApp (they hold its id)
let UI_KEY = 'sheets-editor-ui'
const UI_OPTIONS = [
  ['labels', 'Testi sui comandi delle pagine', 'Senza, i comandi mostrano solo le icone (il nome compare al passaggio del mouse)', false],
  ['cardBar', 'Comandi sulle card', 'Scala, colore, immagine ed elimina, in alto su ogni card', true],
  ['cardSize', 'Misure delle card', 'Il chip con altezza e larghezza in blocchi della griglia', true],
] as const
type UiKey = (typeof UI_OPTIONS)[number][0]
type Ui = Record<UiKey, boolean>
const UI_DEFAULT = Object.fromEntries(UI_OPTIONS.map(([k, , , v]) => [k, v])) as Ui
const loadUi = (): Ui => { try { return { ...UI_DEFAULT, ...JSON.parse(localStorage.getItem(UI_KEY) ?? '{}') } } catch { return UI_DEFAULT } }
// The editor exists only on the local dev server; the published site is read only.
const EDITOR = import.meta.env.DEV
const fit = (f = LANDSCAPE) => Math.min(window.innerWidth / f.w, window.innerHeight / f.h)
const load = (path: string) => fetch(path).then(r => r.json()).catch(() => ({}))
const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)

type Store<T> = Record<string, T>

// One draft store: values in memory, what is on disk, and which ids differ from disk.
function useStore<T>() {
  const [values, setValues] = useState<Store<T>>({})
  const [base, setBase] = useState<Store<T>>({})
  const ref = useRef(values)
  ref.current = values
  const set = useCallback((id: string, v: T | null) => {
    setValues(prev => {
      const next = { ...prev }
      if (v) next[id] = v
      else delete next[id]
      return next
    })
  }, [])
  const init = useCallback((v: Store<T>) => { setValues(v); setBase(v) }, [])
  const dirty = Object.keys({ ...values, ...base }).filter(id => !same(values[id], base[id]))
  const revert = useCallback(() => setValues(base), [base])
  return { values, ref, set, init, dirty, setBase, revert }
}

// Edits stay a draft in memory until "Salva": reloading without saving drops them.
async function persist<T>(path: string, ids: string[], values: Store<T>) {
  for (const id of ids) {
    const res = await fetch(path, { method: 'POST', body: JSON.stringify({ id, value: values[id] ?? null }) })
    if (!res.ok) throw new Error(path)
  }
}

function markSaved<T>(setBase: (f: (b: Store<T>) => Store<T>) => void, ids: string[], values: Store<T>) {
  setBase(b => {
    const next = { ...b }
    for (const id of ids) {
      if (values[id]) next[id] = values[id]
      else delete next[id]
    }
    return next
  })
}

// Sidebar with every sheet: a miniature (a static copy of the sheet DOM), click to jump,
// drag to reorder in the editor. ponytail: DOM copy refreshed on edits, no second React render.
const SIDEBAR = 216
const THUMB_W = SIDEBAR - 40
let SIDE_KEY = 'sheets-editor-sidebar'
const loadSide = () => { try { return localStorage.getItem(SIDE_KEY) !== 'closed' } catch { return true } }
// Landscape fits the width; portrait also fits the height, so a whole page is on screen
const pageFit = (open: boolean, f = LANDSCAPE) =>
  Math.min(1, (window.innerWidth - (open && window.innerWidth > 900 ? SIDEBAR + 16 : 0) - 64) / f.w, f.h > f.w ? (window.innerHeight - 110) / f.h : 1)

function Thumb({ id, stamp, w }: { id: string; stamp: string; w: number }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const t = setTimeout(() => {
      const src = document.querySelector(`#sheet-${id} .sheet`)
      const box = ref.current
      if (!src || !box) return
      const copy = src.cloneNode(true) as HTMLElement
      copy.querySelectorAll('[contenteditable]').forEach(e => e.removeAttribute('contenteditable'))
      copy.querySelectorAll('.card-bar, .card-size, .react-resizable-handle').forEach(e => e.remove())
      copy.querySelectorAll('[data-card]').forEach(e => e.removeAttribute('data-card'))
      // no duplicate ids: SVG gradients (chapter numbers) must resolve to the page, not to the hidden copy
      copy.querySelectorAll('[id]').forEach(e => e.removeAttribute('id'))
      copy.style.zoom = String(THUMB_W / 1600)   // the long side is always 1600px
      box.replaceChildren(copy)
    }, 400)
    return () => clearTimeout(t)
  }, [id, stamp, w])
  return <div className="thumb" ref={ref} aria-hidden="true" />
}

// Document picker: the current document as a button, the list with picture, format and pages in a popover
function DocPicker({ docs, ids, current, onPick }: { docs: Record<string, DocConfig>; ids: string[]; current: string; onPick: (d: string) => void }) {
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc) }
  }, [open])
  const row = (d: string) => (
    <>
      {docs[d].picker && <img src={docs[d].picker![0]} alt="" />}
      <span><b>{docs[d].label}</b><small>{docs[d].picker ? `${docs[d].picker![1]}, ` : ''}{Object.keys(docs[d].sheets).length} pagine</small></span>
    </>
  )
  return (
    <div className="doc-picker" ref={box}>
      <button type="button" className="doc-picker-current" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(o => !o)}>
        {row(current)}<IconSelector size={16} stroke={1.75} />
      </button>
      {open && (
        <ul className="doc-picker-list" role="listbox" aria-label="Documento">
          {ids.map(d => (
            <li key={d}>
              <button type="button" role="option" aria-selected={d === current} className={d === current ? 'on' : ''} onClick={() => { setOpen(false); if (d !== current) onPick(d) }}>
                {row(d)}{d === current && <IconCheck size={16} stroke={2} />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

type DocId = string

// The editor and the read-only site of one presentation
export function PresentationApp({ config, theme, data: initial, themeErrors = [] }: { config: PresentationConfig; theme: Theme; data: PresentationData; themeErrors?: string[] }) {
  const DOCS = config.docs
  const ids = Object.keys(DOCS)
  const PUBLIC_DOCS = ids.filter(d => DOCS[d].public)
  const DOC_KEY = `${config.id}-editor-doc`
  UI_KEY = `${config.id}-editor-ui`
  SIDE_KEY = `${config.id}-editor-sidebar`
  const loadDoc = (): DocId => {
    const d = new URLSearchParams(location.search).get('doc') ?? ''
    // online: only the public documents; the site opens on siteDefault without ?doc=
    if (!import.meta.env.DEV) return PUBLIC_DOCS.includes(d) ? d : config.siteDefault ?? PUBLIC_DOCS[0] ?? ids[0]
    // editor: the ?doc in the address, else the last one used, else editorDefault
    let last = ''
    try { last = localStorage.getItem(DOC_KEY) ?? '' } catch { /* storage blocked: fall back */ }
    return d in DOCS ? d : last in DOCS ? last : config.editorDefault ?? ids[0]
  }
  const layouts = useStore<Saved[string]>()
  const texts = useStore<TextEdit>()
  const cards = useStore<SheetCards>()
  const [ready, setReady] = useState(false)
  const [docId, setDocId] = useState<DocId>(loadDoc)
  const doc = DOCS[docId]
  const SET = doc.settings ?? `settings:${docId}`
  const PDF_NAME = doc.pdf
  const footer = doc.footer ?? config.footer ?? []
  const FOOTER_KEY = doc.footer ? `__footer:${docId}` : '__footer'
  const switchDoc = (d: DocId) => {
    setDocId(d)
    setTab('pages')
    history.replaceState(null, '', `?doc=${d}`)
    try { localStorage.setItem(DOC_KEY, d) } catch { /* storage blocked: the address still says it */ }
    window.scrollTo(0, 0)
  }
  const [mode, setMode] = useState<'layout' | 'text'>('layout')
  const [tab, setTab] = useState<'pages' | 'archive'>('pages')
  const [rev, setRev] = useState(0)
  // /?present opens straight into the presentation (the QR printed on the cover lands here)
  const [ui, setUi] = useState<Ui>(loadUi)
  const [showSettings, setShowSettings] = useState(false)
  // One editor: clicking a text edits it (caret where you clicked), clicking anywhere else moves cards
  useEffect(() => {
    if (!EDITOR) return
    const onClick = (e: MouseEvent) => {
      const el = e.target as HTMLElement
      if (el.closest('.toolbar, .sidebar, .save-dock, .format-float, .modal-back, .sheet-tools, .card-bar, .settings')) return
      const text = el.closest<HTMLElement>(`[data-card] :is(${TEXT})`)
      if (text && mode === 'layout') {
        setMode('text')
        const { clientX: x, clientY: y } = e
        requestAnimationFrame(() => requestAnimationFrame(() => {
          text.focus()
          const r = document.caretRangeFromPoint?.(x, y)
          if (r) { const sel = getSelection(); sel?.removeAllRanges(); sel?.addRange(r) }
        }))
      } else if (!text && mode === 'text' && el.closest('.sheets')) setMode('layout')
    }
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [mode])
  const toggleUi = (k: UiKey) => setUi(u => {
    const next = { ...u, [k]: !u[k] }
    try { localStorage.setItem(UI_KEY, JSON.stringify(next)) } catch { /* private mode: keeps working for this session */ }
    return next
  })
  const [slide, setSlide] = useState<number | null>(() => (new URLSearchParams(location.search).has('present') ? 0 : null))
  const [scale, setScale] = useState(() => fit(doc.format))
  const [sideOpen, setSideOpen] = useState(loadSide)
  const [fitPage, setFitPage] = useState(() => pageFit(loadSide(), doc.format))
  const [dragFrom, setDragFrom] = useState<number | null>(null)
  useEffect(() => {
    const on = () => setFitPage(pageFit(sideOpen, doc.format))
    on()
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [sideOpen, doc.format])
  // Portrait-like formats share the CSS; sizes and print zoom come in as variables
  useEffect(() => {
    const f = doc.format
    document.body.classList.toggle('doc-portrait', f !== LANDSCAPE)   // every format but the pagine: sizes from the variables
    document.body.style.setProperty('--sheet-w', `${f.w}px`)
    document.body.style.setProperty('--sheet-h', `${f.h}px`)
    document.body.style.setProperty('--print-zoom', String((f.mm * 96) / 25.4 / Math.max(f.w, f.h)))
  }, [doc.format])
  useEffect(() => { document.body.classList.toggle('side-closed', !sideOpen) }, [sideOpen])
  // ?bg prints the pages without their texts: the backgrounds of the Word version, where the texts are live
  useEffect(() => { document.body.classList.toggle('export-bg', new URLSearchParams(location.search).has('bg')) }, [])
  const toggleSide = () => setSideOpen(o => {
    try { localStorage.setItem(SIDE_KEY, o ? 'closed' : 'open') } catch { /* session only */ }
    return !o
  })
  const [busy, setBusy] = useState<'save' | 'pdf' | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<number | undefined>(undefined)

  useEffect(() => {
    const data = EDITOR
      ? Promise.all([load('/__layouts'), load('/__texts'), load('/__cards')])
      : Promise.resolve([initial.layouts, initial.texts, initial.cards])
    data.then(([l, t, c]) => {
      layouts.init(l as Saved)
      texts.init(t as Texts)
      cards.init(c as Cards)
      setReady(true)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const notify = (msg: string, ms = 3500) => {
    clearTimeout(toastTimer.current)
    setToast(msg)
    toastTimer.current = window.setTimeout(() => setToast(null), ms)
  }
  // A broken theme.json is said in the editor, not only in the console
  useEffect(() => {
    if (EDITOR && themeErrors.length) notify(`theme.json da correggere: ${themeErrors.join(', ')}`, 12000)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const dirty = layouts.dirty.length + texts.dirty.length + cards.dirty.length

  // Spacing overlay (margins, gaps, paddings with their values), redrawn while on
  const [measure, setMeasure] = useState(false)
  useEffect(() => {
    if (!measure) return clearMeasures()
    drawMeasures()
    // ponytail: redraw on a timer instead of tracking every drag and edit; 600 ms is enough for a visual check
    const t = setInterval(drawMeasures, 600)
    return () => { clearInterval(t); clearMeasures() }
  }, [measure])
  ;(window as { __dirty?: boolean }).__dirty = dirty > 0

  // Saves every pending edit, or only those of one sheet. Values are snapshotted first,
  // so an edit typed while saving stays pending instead of being marked as saved.
  const commit = async (sheet?: string) => {
    const l = layouts.dirty.filter(i => !sheet || i === sheet)
    // settings (order, archive, approval, texture), the footer and shared texts (@key) belong to every sheet
    const c = cards.dirty.filter(i => !sheet || i === sheet || i === SET)
    const t = texts.dirty.filter(k => !sheet || k.startsWith(sheet + ':') || k === FOOTER_KEY || k.startsWith('@'))
    if (!l.length && !c.length && !t.length) return
    const snap = { l: { ...layouts.ref.current }, t: { ...texts.ref.current }, c: { ...cards.ref.current } }
    setBusy('save')
    try {
      await persist('/__layouts', l, snap.l)
      await persist('/__texts', t, snap.t)
      await persist('/__cards', c, snap.c)
      markSaved(layouts.setBase, l, snap.l)
      markSaved(texts.setBase, t, snap.t)
      markSaved(cards.setBase, c, snap.c)
      notify(sheet ? 'Pagina salvata' : 'Modifiche salvate')
    } catch {
      notify('Salvataggio non riuscito: il server locale è acceso?')
    } finally {
      setBusy(null)
    }
  }

  const pendingIn = (sheet: string) =>
    layouts.dirty.filter(i => i === sheet).length +
    cards.dirty.filter(i => i === sheet || i === SET).length +
    texts.dirty.filter(k => k.startsWith(sheet + ':') || k === FOOTER_KEY || k.startsWith('@')).length

  // Prints the saved version with headless Edge into out/; `download` also hands it to the browser.
  const makePdf = async (download: boolean) => {
    if (!EDITOR) {
      // versioned link, so the browser never serves an older cached copy
      Object.assign(document.createElement('a'), { href: `/${PDF_NAME}?v=${__BUILD_ID__}`, download: PDF_NAME }).click()
      return
    }
    if (dirty) return notify('Salva prima le modifiche: il PDF usa la versione salvata')
    setBusy('pdf')
    try {
      const files = doc.files
      const names = files ? `&names=${order.map(id => files[id]).join(',')}` : ''
      // download of an up-to-date PDF: hand over the file in out/, no new print
      const fresh = download && (await fetch(`/__pdf-status?doc=${docId}`).then(r => r.json()).catch(() => ({ fresh: false }))).fresh
      const res = await fetch(fresh ? `/__pdf-file?doc=${docId}` : `/__pdf?doc=${docId}${names}`)
      if (!res.ok) throw new Error(await res.text())
      if (download) {
        const url = URL.createObjectURL(await res.blob())
        Object.assign(document.createElement('a'), { href: url, download: PDF_NAME }).click()
        URL.revokeObjectURL(url)
      }
      notify(fresh ? 'PDF già aggiornato, scaricato' : files ? `PDF aggiornato, le pagine sono in out/${docId}/` : 'PDF aggiornato in out/')
    } catch {
      notify('Il PDF non si è generato: il server locale è acceso?')
    } finally {
      setBusy(null)
      checkPdf()
    }
  }
  const downloadPdf = () => makePdf(true)
  // Is the PDF in out/ newer than the saved data and the code? (editor only)
  const [pdfFresh, setPdfFresh] = useState<boolean | null>(null)
  const checkPdf = useCallback(() => {
    if (!EDITOR) return
    fetch(`/__pdf-status?doc=${docId}`).then(r => r.json()).then(s => setPdfFresh(s.fresh)).catch(() => setPdfFresh(null))
  }, [docId])
  useEffect(() => { checkPdf(); const t = setInterval(checkPdf, 15000); return () => clearInterval(t) }, [checkPdf, dirty])

  const present = () => {
    setSlide(0)
    document.documentElement.requestFullscreen?.().catch(() => {})
  }

  const exit = useCallback(() => {
    setSlide(null)
    if (location.search.includes('present')) history.replaceState(null, '', location.pathname)
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
  }, [])

  const settings = (cards.values[SET] ?? {}) as Settings
  const order = (settings.order ?? doc.order ?? Object.keys(doc.sheets)).filter(id => id in doc.sheets)
  const archived = Object.keys(doc.sheets).filter(id => !order.includes(id))
  const step = (d: number) => setSlide(s => Math.min(Math.max((s ?? 0) + d, 0), order.length - 1))

  useEffect(() => {
    if (slide === null) return
    const onKey = (e: KeyboardEvent) => {
      if (['ArrowRight', 'ArrowDown', 'PageDown', ' '].includes(e.key)) { e.preventDefault(); step(1) }
      else if (['ArrowLeft', 'ArrowUp', 'PageUp'].includes(e.key)) { e.preventDefault(); step(-1) }
      else if (e.key === 'Escape') exit()
    }
    const onResize = () => setScale(fit(doc.format))
    const onFs = () => { if (!document.fullscreenElement) setSlide(null) }
    window.addEventListener('keydown', onKey)
    window.addEventListener('resize', onResize)
    document.addEventListener('fullscreenchange', onFs)
    onResize()
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', onResize)
      document.removeEventListener('fullscreenchange', onFs)
    }
  }, [slide, exit, doc.format])

  if (!ready) return null
  const presenting = slide !== null
  // Texture choice lives with the saved data, so the PDF and the site use the same one
  const texture = ((settings.texture ?? theme.texture) === 'none' ? 'none' : 'grain') as 'grain' | 'none'
  const setSettings = (patch: Settings) => cards.set(SET, { ...settings, ...patch } as SheetCards)
  const setTexture = (t: string) => setSettings({ texture: t })
  const format = { ...doc.format, margin: settings.margin ?? doc.format.margin, marginX: settings.margin ?? doc.format.marginX, gap: settings.gap ?? doc.format.gap }
  const SPACING = [['margin', 'Margine della pagina', 'Spazio fra il bordo del foglio e le card'], ['gap', 'Spazio fra le card', 'Distanza fra una card e l\'altra']] as const
  const move = (id: string, d: number) => {
    const next = [...order]
    const i = next.indexOf(id)
    if (i + d < 0 || i + d >= next.length) return
    ;[next[i], next[i + d]] = [next[i + d], next[i]]
    setSettings({ order: next })
  }
  // custom page names live in the settings; an empty or default name drops the override
  const nameOf = (id: string) => settings.names?.[id] ?? doc.sheets[id][1]
  const rename = (id: string, t: string) => {
    const names = { ...settings.names }
    const v = t.trim()
    if (v && v !== doc.sheets[id][1]) names[id] = v
    else delete names[id]
    setSettings({ names })
  }
  const archive = (id: string) => setSettings({ order: order.filter(x => x !== id) })
  const restore = (id: string) => setSettings({ order: [...order, id] })
  // Two locks per sheet; the old «approved» (both locks) is split the first time one of them is touched
  const approved = new Set(settings.approved ?? [])
  const lockLayout = new Set([...(settings.lockLayout ?? []), ...approved])
  const lockText = new Set([...(settings.lockText ?? []), ...approved])
  const toggleLock = (id: string, which: 'layout' | 'text') => {
    const l = new Set(lockLayout), t = new Set(lockText)
    const set = which === 'layout' ? l : t
    if (set.has(id)) set.delete(id)
    else set.add(id)
    setSettings({ approved: [], lockLayout: [...l], lockText: [...t] })
  }
  const I = { size: 16, stroke: 1.75 }

  return (
    <EngineContext.Provider value={{ footer, footerKey: FOOTER_KEY, logoMono: theme.logoMono, backgrounds: theme.palettes?.background ?? ['#FFFFFF', theme.colors.paper, theme.colors['accent-lt'], theme.colors.accent, theme.colors.strong, theme.colors.ink] }}>
    <TextColorsContext.Provider value={theme.palettes?.text ?? [[theme.colors.ink, 'Testo'], [theme.colors.strong, 'Scuro'], [theme.colors.accent, 'Accento'], ['#FFFFFF', 'Bianco']]}>
    <LayoutsContext.Provider
      value={{
        saved: layouts.values, save: layouts.set, texts: texts.values, setText: texts.set, cards: cards.values, setCards: cards.set,
        saveSheet: commit, pendingIn, mode: presenting || !EDITOR ? 'view' : mode,
      }}
    >
      {!presenting && EDITOR && mode === 'text' && (
        <div className="format-float">
          <FormatBar />
        </div>
      )}

      {/* Presenta, Scarica PDF and Salva together, bottom right */}
      {!presenting && (
        <div className="dock">
        <nav className="toolbar" aria-label="Strumenti">
            <button type="button" className="icon-btn" title="Presenta" aria-label="Presenta" onClick={present}><IconPresentation {...I} /></button>
            <button type="button" className={busy === 'pdf' ? 'icon-btn is-busy' : 'icon-btn'} title={busy === 'pdf' ? 'Genero il PDF…' : 'Scarica PDF'} aria-label="Scarica PDF" onClick={downloadPdf} disabled={busy !== null}>
              <IconDownload {...I} />
            </button>
            {EDITOR && (
              <button type="button" className={measure ? 'icon-btn on' : 'icon-btn'} title={measure ? 'Nascondi le misure' : 'Mostra margini, gap e padding'} aria-label="Misure" aria-pressed={measure} onClick={() => setMeasure(m => !m)}>
                <IconRulerMeasure {...I} />
              </button>
            )}
            {EDITOR && (
              <button type="button" className={`icon-btn pdf-state ${busy === 'pdf' ? 'is-busy' : pdfFresh ? 'is-fresh' : 'is-stale'}`} onClick={() => makePdf(false)} disabled={busy !== null}
                title={busy === 'pdf' ? 'Genero il PDF…' : pdfFresh ? 'PDF aggiornato: clic per rigenerarlo' : 'PDF da aggiornare: clic per rigenerarlo senza scaricarlo'} aria-label="Rigenera PDF">
                {busy === 'pdf' ? <IconRefresh {...I} /> : pdfFresh ? <IconFileCheck {...I} /> : <IconFileAlert {...I} />}
              </button>
            )}
          </nav>

          {EDITOR && (
            <div className="save-dock">
          {dirty > 0 && (
            <button type="button" title="Scarta tutte le modifiche non salvate" onClick={() => { layouts.revert(); texts.revert(); cards.revert(); setRev(r => r + 1); notify('Modifiche annullate') }} disabled={busy !== null}>
              <IconArrowBackUp {...I} />Annulla
            </button>
          )}
          <button type="button" className="primary" onClick={() => commit()} disabled={!dirty || busy !== null}>
            {dirty ? <IconDeviceFloppy {...I} /> : <IconCheck {...I} />}
            {busy === 'save' ? 'Salvo…' : dirty ? `Salva (${dirty})` : 'Salvato'}
          </button>
        </div>
      )}

        </div>
      )}

      {showSettings && (
        <div className="modal-back" onMouseDown={() => setShowSettings(false)}>
          <div className="settings" role="dialog" aria-label="Impostazioni dell'editor" onMouseDown={e => e.stopPropagation()}>
            <header className="settings-head">
              <h2>Impostazioni</h2>
              <button type="button" className="round" aria-label="Chiudi" onClick={() => setShowSettings(false)}><IconX {...I} /></button>
            </header>
            <label className="settings-row">
              <span><b>Grana</b><small>La texture di carta sopra le pagine; vale anche per il PDF e il sito (si salva con Salva)</small></span>
              <button type="button" role="switch" aria-checked={texture === 'grain'} className={texture === 'grain' ? 'toggle on' : 'toggle'} onClick={() => setTexture(texture === 'grain' ? 'none' : 'grain')}><span /></button>
            </label>
            {SPACING.map(([k, label, hint]) => (
              <div key={k} className="settings-row">
                <span><b>{label}</b><small>{hint}, in {doc.label.toLowerCase()} (si salva con Salva)</small></span>
                <span className="stepper">
                  <button type="button" aria-label="Meno" onClick={() => setSettings({ [k]: Math.max(0, format[k] - 2) })}>−</button>
                  <b>{format[k]}</b>
                  <button type="button" aria-label="Più" onClick={() => setSettings({ [k]: Math.min(120, format[k] + 2) })}>+</button>
                </span>
              </div>
            ))}
            {UI_OPTIONS.map(([k, label, hint]) => (
              <label key={k} className="settings-row">
                <span><b>{label}</b><small>{hint}</small></span>
                <button type="button" role="switch" aria-checked={ui[k]} className={ui[k] ? 'toggle on' : 'toggle'} onClick={() => toggleUi(k)}><span /></button>
              </label>
            ))}
          </div>
        </div>
      )}

      {!presenting && (
        <aside className={sideOpen ? 'sidebar' : 'sidebar is-closed'} aria-label="Pagine">
          <div className="sidebar-top">
            <a className="sidebar-brand" href="#top" aria-label={config.title}>
              {/* the editor wears the engine's mark; the published site the presentation's logo */}
              {EDITOR ? <span className="engine-mark"><IconLayoutBoard size={18} stroke={2} />sheets</span> : <img src={theme.logo} alt="" />}
              {!EDITOR && <span>{doc.name}</span>}
            </a>
            <button type="button" className="icon-btn" title={sideOpen ? 'Chiudi la barra' : 'Apri la barra'} aria-label={sideOpen ? 'Chiudi la barra' : 'Apri la barra'} onClick={toggleSide}>
              {sideOpen ? <IconLayoutSidebarLeftCollapse {...I} /> : <IconLayoutSidebarLeftExpand {...I} />}
            </button>
          </div>
          {sideOpen && EDITOR && (
            <DocPicker docs={DOCS} ids={config.pickerOrder ?? ids} current={docId} onPick={switchDoc} />
          )}
          {sideOpen && EDITOR && tab === 'archive' && <p className="sidebar-label">Archivio ({archived.length})</p>}
          {sideOpen && <ol className="sidebar-list">
            {(tab === 'archive' ? archived : order).map((id, i) => (
              <li
                key={id}
                className={dragFrom === i ? 'is-dragging' : undefined}
                draggable={EDITOR && tab === 'pages'}
                onDragStart={() => setDragFrom(i)}
                onDragOver={e => e.preventDefault()}
                onDrop={() => {
                  if (dragFrom === null || dragFrom === i) return
                  const next = [...order]
                  next.splice(i, 0, next.splice(dragFrom, 1)[0])
                  setSettings({ order: next })
                  setDragFrom(null)
                }}
                onDragEnd={() => setDragFrom(null)}
              >
                <button type="button" onClick={() => { requestAnimationFrame(() => document.getElementById(`sheet-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })) }}>
                  <Thumb id={id} w={doc.format.w} stamp={`${rev}-${dirty}-${order.join()}-${tab}-${docId}`} />
                  <span className="sidebar-name"><i>{i + 1}</i>{nameOf(id)}</span>
                </button>
              </li>
            ))}
          </ol>}
          {sideOpen && EDITOR && (
            <div className="sidebar-foot">
              <button type="button" className="sidebar-settings" onClick={() => setShowSettings(true)}><IconSettings {...I} />Impostazioni</button>
              <button type="button" className={tab === 'archive' ? 'icon-btn on' : 'icon-btn'} title={tab === 'archive' ? 'Torna alle pagine' : `Archivio (${archived.length})`} aria-label="Archivio" aria-pressed={tab === 'archive'} onClick={() => setTab(t => (t === 'archive' ? 'pages' : 'archive'))}>
                <IconArchive {...I} />
              </button>
            </div>
          )}
        </aside>
      )}

      {doc.format !== LANDSCAPE && <style>{`@page { size: ${doc.format.page}; margin: 0; }`}</style>}
      <FormatContext.Provider value={format}>
      <main
        id="top"
        className={`${presenting ? 'sheets present' : `sheets mode-${EDITOR ? mode : 'view'}`} tex-${texture}${ui.labels ? '' : ' ui-icons'}${ui.cardBar ? '' : ' ui-nobar'}${ui.cardSize ? '' : ' ui-nosize'}`}
        style={(presenting ? { '--fit': scale } : { '--page-fit': fitPage }) as unknown as CSSProperties}
        onClick={presenting ? e => step(e.clientX > window.innerWidth / 2 ? 1 : -1) : undefined}
      >
        {(tab === 'pages' || presenting) && order.map((id, i) => {
          const [Page] = doc.sheets[id]
          const title = nameOf(id)
          return (
            <div key={`${id}-${rev}-${docId}`} id={`sheet-${id}`} className={'page' + (i === slide ? ' current' : '')}>
              <ScaleContext.Provider value={presenting ? 1 : fitPage}>
              <PageContext.Provider
                value={{ n: i + 1, of: order.length, title, onMove: d => move(id, d), canUp: i > 0, canDown: i < order.length - 1, onArchive: () => archive(id), layoutLocked: lockLayout.has(id), textLocked: lockText.has(id), onLockLayout: () => toggleLock(id, 'layout'), onLockText: () => toggleLock(id, 'text'), onRename: t => rename(id, t) }}
              >
                <Page />
              </PageContext.Provider>
              </ScaleContext.Provider>
            </div>
          )
        })}
        {EDITOR && !presenting && tab === 'archive' && (
          <section className="archive">
            <h2 className="archive-title">Pagine archiviate</h2>
            <p className="archive-note">Escluse dal PDF, dalla presentazione e dal sito.</p>
            {archived.length === 0 && <p className="archive-note">Nessuna pagina archiviata.</p>}
            {archived.map(id => {
              const [Page] = doc.sheets[id]
              const title = nameOf(id)
              return (
                <div key={`${id}-${rev}`} id={`sheet-${id}`} className="page">
                  <ScaleContext.Provider value={fitPage}>
                  <PageContext.Provider value={{ n: 0, of: order.length, title: `${title}, archiviata`, onRestore: () => restore(id), layoutLocked: lockLayout.has(id), textLocked: lockText.has(id) }}>
                    <Page />
                  </PageContext.Provider>
                  </ScaleContext.Provider>
                </div>
              )
            })}
          </section>
        )}
      </main>
      </FormatContext.Provider>

      {presenting && (
        <div className="present-bar" onClick={e => e.stopPropagation()}>
          <span>{(slide ?? 0) + 1} / {order.length}</span>
          <button type="button" onClick={exit}><IconX {...I} />Esci</button>
        </div>
      )}

      {toast && <div className="toast" role="status">{toast}</div>}
    </LayoutsContext.Provider>
    </TextColorsContext.Provider>
    </EngineContext.Provider>
  )
}
