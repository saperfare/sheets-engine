import type { CSSProperties, ReactNode } from 'react'

// Reusable cards, born in the Kaivros sheets. Place them as direct children of <Sheet> with a `key`.
export type Area = { col: string; row: string }
export const area = ({ col, row }: Area): CSSProperties => ({ gridColumn: col, gridRow: row })

// Column with a title and a text (string, or paragraphs and a <dl className="facts"> list).
// top: text from the top; compact: small title; small: smaller title and text with soft shapes;
// num: a number written before the title (chapter numbers).
export function Head({ at, title, top, compact, small, orange, num, children }: { at: Area; chip?: string; title: ReactNode; top?: boolean; compact?: boolean; small?: boolean; orange?: boolean; num?: string; children?: ReactNode }) {
  const cls = ['cell', 'cell-head', top && 'cell-head-top', compact && 'cell-head-compact', small && 'cell-head-small', orange && 'cell-head-orange'].filter(Boolean).join(' ')
  return (
    <div className={cls} style={area(at)}>
      <h2 className="sheet-title">{num && <span className="slide-num">{num}</span>}{title}</h2>
      {children && <div className="sheet-desc">{typeof children === 'string' ? <p>{children}</p> : children}</div>}
    </div>
  )
}

// A picture filling its card, with an optional chip
export function Tile({ at, src, chip, pos }: { at: Area; src: string; chip?: string; pos?: string }) {
  return (
    <div className="cell cell-img" style={area(at)}>
      <img src={src} alt={chip ?? ''} style={pos ? { objectPosition: pos } : undefined} />
      {chip && <span className="chip chip-float">{chip}</span>}
    </div>
  )
}

// Picture above, name with a chip and one line below. variant: overlay (caption on the picture), nested (two sub-cards)
export function ToolCard({ at, src, name, chip, line, variant }: { at: Area; src: string; name: string; chip?: string; line?: string; variant?: 'overlay' | 'nested' }) {
  return (
    <div className={`cell cell-tool${variant ? ` cell-tool-${variant}` : ''}`} style={area(at)}>
      <div className="tool-img"><img src={src} alt={name} /></div>
      <div className="tool-caption">
        <div className="tool-head"><p className="tool-name">{name}</p>{chip && <span className="chip">{chip}</span>}</div>
        {line && <p className="tool-line">{line}</p>}
      </div>
    </div>
  )
}

// A QR code with its link under it
export function QrCard({ at, src, label }: { at: Area; src: string; label: string }) {
  return (
    <div className="cell cell-online" style={area(at)}>
      <img src={src} alt={`QR verso ${label}`} />
      <div><p className="online-url">{label}</p></div>
    </div>
  )
}
