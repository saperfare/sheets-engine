import type { PresentationConfig, PresentationData } from './config';
import type { Theme } from './theme';
export declare function PresentationApp({ config, theme, data: initial, themeErrors }: {
    config: PresentationConfig;
    theme: Theme;
    data: PresentationData;
    themeErrors?: string[];
}): import("react").JSX.Element | null;
