import { IconAlignCenter, IconAlignLeft, IconAlignRight, IconArrowBackUp, IconArrowForwardUp, IconBold, IconClearFormatting, IconHighlight, IconItalic, IconLetterCaseUpper, IconList, IconListNumbers, IconStrikethrough, IconTextDecrease, IconTextIncrease, IconUnderline } from '@tabler/icons-react'
import { createContext, useContext, type ReactNode } from 'react'

// Text colours come from the theme (palettes.text); without them, ink and the two theme accents
export const TextColorsContext = createContext<[string, string][]>([])

// ponytail: document.execCommand is deprecated but still the only native rich-text
// API in Chromium, and the browser fires `input`, so Sheet saves the result as usual.
const run = (cmd: string, value?: string) => {
  document.execCommand('styleWithCSS', false, 'true')
  document.execCommand(cmd, false, value)
}

// Scales the selection (or the whole text if nothing is selected) by a factor, in px,
// so repeated clicks keep growing with no upper bound.
const resize = (factor: number) => {
  const host = document.activeElement as HTMLElement | null
  const sel = getSelection()
  if (!host?.isContentEditable || !sel?.rangeCount) return
  const range = sel.getRangeAt(0)
  if (range.collapsed) range.selectNodeContents(host)
  const start = range.startContainer.nodeType === 1 ? (range.startContainer as Element) : range.startContainer.parentElement!
  const px = parseFloat(getComputedStyle(start).fontSize) * factor
  const frag = range.extractContents()
  frag.querySelectorAll<HTMLElement>('[style*="font-size"]').forEach(e => e.style.removeProperty('font-size'))
  const span = document.createElement('span')
  span.style.fontSize = `${Math.round(px * 10) / 10}px`
  span.append(frag)
  range.insertNode(span)
  host.querySelectorAll('span:empty').forEach(e => e.remove())
  sel.removeAllRanges()
  const r = document.createRange()
  r.selectNodeContents(span)
  sel.addRange(r)
  host.dispatchEvent(new Event('input', { bubbles: true }))
}

const FONTS = [
  ['Outfit', 'Outfit'],
  ['Bricolage Grotesque', 'Bricolage'],
  ['Noto Sans', 'Noto'],
] as const

// Wraps the selection in a span with one inline style (used where execCommand has no command)
const wrap = (prop: string, value: string) => {
  const host = document.activeElement as HTMLElement | null
  const sel = getSelection()
  if (!host?.isContentEditable || !sel?.rangeCount || sel.getRangeAt(0).collapsed) return
  const range = sel.getRangeAt(0)
  const span = document.createElement('span')
  span.style.setProperty(prop, value)
  span.append(range.extractContents())
  range.insertNode(span)
  sel.removeAllRanges()
  const r = document.createRange()
  r.selectNodeContents(span)
  sel.addRange(r)
  host.dispatchEvent(new Event('input', { bubbles: true }))
}

function Btn({ title, onPress, children }: { title: string; onPress: () => void; children: ReactNode }) {
  // mousedown + preventDefault keeps the text selection while clicking the bar
  return (
    <button type="button" title={title} aria-label={title} onMouseDown={e => { e.preventDefault(); onPress() }}>
      {children}
    </button>
  )
}

export default function FormatBar() {
  const COLORS = useContext(TextColorsContext)
  const I = { size: 16, stroke: 1.75 }
  return (
    <div className="format-bar" role="toolbar" aria-label="Formattazione">
      <Btn title="Annulla" onPress={() => run('undo')}><IconArrowBackUp {...I} /></Btn>
      <Btn title="Ripeti" onPress={() => run('redo')}><IconArrowForwardUp {...I} /></Btn>
      <span className="format-sep" />
      {FONTS.map(([family, label]) => (
        <Btn key={family} title={`Carattere ${label}`} onPress={() => run('fontName', family)}>
          <span className="font-chip" style={{ fontFamily: `'${family}', sans-serif` }}>{label}</span>
        </Btn>
      ))}
      <span className="format-sep" />
      <Btn title="Grassetto" onPress={() => run('bold')}><IconBold {...I} /></Btn>
      <Btn title="Corsivo" onPress={() => run('italic')}><IconItalic {...I} /></Btn>
      <Btn title="Sottolineato" onPress={() => run('underline')}><IconUnderline {...I} /></Btn>
      <Btn title="Barrato" onPress={() => run('strikeThrough')}><IconStrikethrough {...I} /></Btn>
      <Btn title="Maiuscolo" onPress={() => wrap('text-transform', 'uppercase')}><IconLetterCaseUpper {...I} /></Btn>
      <Btn title="Evidenzia" onPress={() => run('hiliteColor', '#DDD1F2')}><IconHighlight {...I} /></Btn>
      <span className="format-sep" />
      <Btn title="Elenco puntato" onPress={() => run('insertUnorderedList')}><IconList {...I} /></Btn>
      <Btn title="Elenco numerato" onPress={() => run('insertOrderedList')}><IconListNumbers {...I} /></Btn>
      <span className="format-sep" />
      <Btn title="Allinea a sinistra" onPress={() => run('justifyLeft')}><IconAlignLeft {...I} /></Btn>
      <Btn title="Centra" onPress={() => run('justifyCenter')}><IconAlignCenter {...I} /></Btn>
      <Btn title="Allinea a destra" onPress={() => run('justifyRight')}><IconAlignRight {...I} /></Btn>
      <span className="format-sep" />
      <Btn title="Testo più piccolo" onPress={() => resize(0.875)}><IconTextDecrease {...I} /></Btn>
      <Btn title="Testo più grande" onPress={() => resize(1.15)}><IconTextIncrease {...I} /></Btn>
      <span className="format-sep" />
      {COLORS.map(([hex, name]) => (
        <Btn key={hex} title={name} onPress={() => run('foreColor', hex)}>
          <span className="swatch-dot" style={{ background: hex }} />
        </Btn>
      ))}
      <span className="format-sep" />
      <Btn title="Rimuovi formattazione" onPress={() => run('removeFormat')}><IconClearFormatting {...I} /></Btn>
    </div>
  )
}
