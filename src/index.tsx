import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { PresentationApp } from './App'
import type { PresentationConfig, PresentationData } from './config'
import { applyTheme, checkTheme, type Theme } from './theme'

export { PresentationApp } from './App'
export { defineConfig, type DocConfig, type PresentationConfig, type PresentationData } from './config'
export { applyTheme, checkTheme, type Theme } from './theme'
export { EngineContext, FormatContext, LANDSCAPE, LayoutsContext, PORTRAIT, PageContext, SLIDE, ScaleContext, Sheet, SlotSize, TEXT, VideoBox, mm, type Format } from './Sheet'

// Starts a presentation in #root: theme first (so the first paint and the PDF are already right), then the app.
export function mount({ config, theme, data }: { config: PresentationConfig; theme: Theme; data: PresentationData }) {
  const errors = checkTheme(theme)
  if (errors.length) console.error('theme.json:', errors.join(', '))
  applyTheme(theme)
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <PresentationApp config={config} theme={theme} data={data} />
    </StrictMode>,
  )
}
