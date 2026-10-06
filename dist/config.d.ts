import type { ComponentType } from 'react';
import type { Format } from './Sheet';
import type { Cards, Saved, Texts } from './Sheet';
export type DocConfig = {
    label: string;
    name: string;
    sheets: Record<string, [ComponentType, string]>;
    order?: string[];
    settings?: string;
    pdf: string;
    format: Format;
    files?: Record<string, string>;
    picker?: [image: string, format: string];
    footer?: string[];
    public?: boolean;
};
export type PresentationConfig = {
    id: string;
    title: string;
    docs: Record<string, DocConfig>;
    pickerOrder?: string[];
    editorDefault?: string;
    siteDefault?: string;
    footer?: string[];
};
export type PresentationData = {
    layouts: Saved;
    texts: Texts;
    cards: Cards;
};
export declare const defineConfig: (c: PresentationConfig) => PresentationConfig;
