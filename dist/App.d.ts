import type { PresentationConfig, PresentationData } from './config';
import type { Theme } from './theme';
export declare function PresentationApp({ config, theme, data: initial }: {
    config: PresentationConfig;
    theme: Theme;
    data: PresentationData;
}): import("react").JSX.Element | null;
