import { jsx as _jsx } from "react/jsx-runtime";
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { PresentationApp } from './App';
import { applyTheme, checkTheme } from './theme';
export { PresentationApp } from './App';
export { defineConfig } from './config';
export { applyTheme, checkTheme } from './theme';
export { EngineContext, FormatContext, LANDSCAPE, LayoutsContext, PORTRAIT, PageContext, SLIDE, ScaleContext, Sheet, SlotSize, TEXT, VideoBox, mm } from './Sheet';
// Starts a presentation in #root: theme first (so the first paint and the PDF are already right), then the app.
export function mount({ config, theme, data }) {
    const errors = checkTheme(theme);
    if (errors.length)
        console.error('theme.json:', errors.join(', '));
    applyTheme(theme);
    createRoot(document.getElementById('root')).render(_jsx(StrictMode, { children: _jsx(PresentationApp, { config: config, theme: theme, data: data }) }));
}
