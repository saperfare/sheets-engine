import type { CSSProperties, ReactNode } from 'react';
export type Area = {
    col: string;
    row: string;
};
export declare const area: ({ col, row }: Area) => CSSProperties;
export declare function Head({ at, title, top, compact, small, orange, num, children }: {
    at: Area;
    chip?: string;
    title: ReactNode;
    top?: boolean;
    compact?: boolean;
    small?: boolean;
    orange?: boolean;
    num?: string;
    children?: ReactNode;
}): import("react").JSX.Element;
export declare function Tile({ at, src, chip, pos }: {
    at: Area;
    src: string;
    chip?: string;
    pos?: string;
}): import("react").JSX.Element;
export declare function ToolCard({ at, src, name, chip, line, variant }: {
    at: Area;
    src: string;
    name: string;
    chip?: string;
    line?: string;
    variant?: 'overlay' | 'nested';
}): import("react").JSX.Element;
export declare function QrCard({ at, src, label }: {
    at: Area;
    src: string;
    label: string;
}): import("react").JSX.Element;
