import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { PresentationApp } from './App'
import type { PresentationConfig, PresentationData } from './config'
import { applyTheme, checkTheme, type Theme } from './theme'

export { PresentationApp } from './App'
export { defineConfig, type DocConfig, type PresentationConfig, type PresentationData } from './config'
export { applyTheme, checkTheme, type Theme } from './theme'
export { Head, QrCard, Tile, ToolCard, area, type Area } from './Blocks'
export { EngineContext, FormatContext, LANDSCAPE, LayoutsContext, PORTRAIT, PageContext, SLIDE, ScaleContext, Sheet, SlotSize, TEXT, VideoBox, mm, type Format } from './Sheet'

const FAVICON = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#26262B"/><rect x="7" y="7" width="8" height="18" rx="2" fill="#6366F1"/><rect x="17" y="7" width="8" height="8" rx="2" fill="#FAFAFA"/><rect x="17" y="17" width="8" height="8" rx="2" fill="#FAFAFA"/></svg>')

// Starts a presentation in #root: theme first (so the first paint and the PDF are already right), then the app.
export function mount({ config, theme, data }: { config: PresentationConfig; theme: Theme; data: PresentationData }) {
  const errors = checkTheme(theme)
  if (errors.length) console.error('theme.json:', errors.join(', '))
  applyTheme(theme)
  // the editor has the engine's favicon, so its tab never looks like the published presentation
  if (import.meta.env.DEV) {
    document.querySelectorAll('link[rel~="icon"]').forEach(l => l.remove())
    document.head.append(Object.assign(document.createElement('link'), { rel: 'icon', href: FAVICON }))
  }
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <PresentationApp config={config} theme={theme} data={data} themeErrors={errors} />
    </StrictMode>,
  )
}
