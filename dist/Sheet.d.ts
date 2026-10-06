import { type ReactNode } from 'react';
import { type Layout } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
export declare const LANDSCAPE: {
    w: number;
    h: number;
    foot: boolean;
    margin: number;
    marginX: number;
    gap: number;
    page: string;
    mm: number;
};
export declare const PORTRAIT: {
    w: number;
    h: number;
    foot: boolean;
    margin: number;
    marginX: number;
    gap: number;
    page: string;
    mm: number;
};
export declare const mm: (v: number) => number;
export declare const SLIDE: {
    w: number;
    h: number;
    foot: boolean;
    margin: number;
    marginX: number;
    gap: number;
    page: string;
    mm: number;
};
export type Format = {
    w: number;
    h: number;
    foot: boolean;
    margin: number;
    marginX: number;
    gap: number;
    page: string;
    mm: number;
};
export declare const FormatContext: import("react").Context<Format>;
export type EngineInfo = {
    footer: string[];
    footerKey: string;
    logoMono: string;
    backgrounds: string[];
};
export declare const EngineContext: import("react").Context<EngineInfo>;
export type Saved = Record<string, Layout>;
export type TextEdit = {
    orig: string;
    html: string;
};
export type Texts = Record<string, TextEdit>;
export type Extra = {
    i: string;
    kind: 'text' | 'image' | 'media' | 'video';
    src?: string;
};
export type SheetCards = {
    hidden?: string[];
    extra?: (Extra | string)[];
    scale?: Record<string, number>;
    pad?: Record<string, number>;
    bg?: Record<string, string>;
    img?: Record<string, string>;
};
export type Cards = Record<string, SheetCards>;
type Ctx = {
    saved: Saved;
    save: (id: string, l: Layout | null) => void;
    texts: Texts;
    setText: (key: string, t: TextEdit | null) => void;
    cards: Cards;
    setCards: (id: string, c: SheetCards | null) => void;
    saveSheet: (id: string) => void;
    pendingIn: (id: string) => number;
    mode: 'layout' | 'text' | 'view';
};
type PageInfo = {
    n: number;
    of: number;
    title: string;
    onMove?: (d: number) => void;
    canUp?: boolean;
    canDown?: boolean;
    onArchive?: () => void;
    onRestore?: () => void;
    approved?: boolean;
    layoutLocked?: boolean;
    textLocked?: boolean;
    onLockLayout?: () => void;
    onLockText?: () => void;
    onApprove?: () => void;
    onRename?: (title: string) => void;
};
export declare const PageContext: import("react").Context<PageInfo>;
export declare const ScaleContext: import("react").Context<number>;
export declare const LayoutsContext: import("react").Context<Ctx>;
export declare const TEXT = "h2, h3, p, li > span, li > b, dt, dd, .chip, .type-font-title, .type-font-desc, .tw-sample, .tl-num";
export declare function SlotSize(): import("react").JSX.Element;
export declare function VideoBox({ src, poster, label }: {
    src: string;
    poster?: string;
    label?: string;
}): import("react").JSX.Element;
export declare function Sheet({ id, cols, rows, className, heading, bleed, nofoot, children }: {
    id: string;
    cols: number;
    rows: number[];
    className?: string;
    heading?: string;
    bleed?: boolean;
    nofoot?: boolean;
    children: ReactNode;
}): import("react").JSX.Element;
export {};
