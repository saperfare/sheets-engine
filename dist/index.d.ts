import type { PresentationConfig, PresentationData } from './config';
import { type Theme } from './theme';
export { PresentationApp } from './App';
export { defineConfig, type DocConfig, type PresentationConfig, type PresentationData } from './config';
export { applyTheme, checkTheme, type Theme } from './theme';
export { EngineContext, FormatContext, LANDSCAPE, LayoutsContext, PORTRAIT, PageContext, SLIDE, ScaleContext, Sheet, SlotSize, TEXT, VideoBox, mm, type Format } from './Sheet';
export declare function mount({ config, theme, data }: {
    config: PresentationConfig;
    theme: Theme;
    data: PresentationData;
}): void;
