#!/usr/bin/env node
// sheets-engine theme check [theme.json]
// Checks the required keys and the WCAG contrast of the pairs the engine actually draws.
import { readFileSync } from 'node:fs'

// accepts `sheets-engine theme check [file]` or `sheets-engine check [file]`
const path = process.argv.slice(2).filter(a => a !== 'theme' && a !== 'check')[0] ?? 'theme.json'
const theme = JSON.parse(readFileSync(path, 'utf8'))

const REQUIRED = ['paper', 'ink', 'page', 'accent-lt', 'accent', 'accent-dk', 'strong-lt', 'strong', 'strong-dk']
const errors = []
for (const k of REQUIRED) if (!/^#[0-9a-f]{6}$/i.test(theme.colors?.[k] ?? '')) errors.push(`colors.${k} must be a #RRGGBB colour`)
for (const k of ['display', 'title', 'body']) if (typeof theme.fonts?.[k] !== 'string') errors.push(`fonts.${k} is missing`)
for (const k of ['logo', 'logoMono']) if (typeof theme[k] !== 'string') errors.push(`${k} is missing`)

const lum = hex => {
  const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
}
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05) }

// [foreground, background, minimum, where it shows]
const PAIRS = [
  ['ink', 'paper', 4.5, 'body text on cards'],
  ['strong', 'paper', 4.5, 'titles and toolbar text on cards'],
  ['strong', 'accent-lt', 4.5, 'text on hovered buttons'],
  ['#FFFFFF', 'strong', 4.5, 'white text on primary buttons and toasts'],
  ['strong', 'page', 4.5, 'page names above the sheets'],
  ['accent-dk', 'paper', 3, 'small labels (large or bold text only)'],
]
const warnings = []
if (!errors.length) {
  for (const [fg, bg, min, where] of PAIRS) {
    const a = fg.startsWith('#') ? fg : theme.colors[fg]
    const b = theme.colors[bg]
    const r = ratio(a, b)
    const line = `${fg} on ${bg}: ${r.toFixed(2)}:1 (min ${min}) ${where}`
    if (r < min) warnings.push(line)
    else console.log('ok   ' + line)
  }
}
for (const w of warnings) console.log('LOW  ' + w)
for (const e of errors) console.log('ERR  ' + e)
process.exit(errors.length || warnings.length ? 1 : 0)
