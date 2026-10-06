export type Theme = {
    name?: string;
    colors: Record<string, string>;
    fonts: {
        display: string;
        title: string;
        body: string;
        css?: string[];
    };
    logo: string;
    logoMono: string;
    radius?: string;
    palettes?: {
        background?: string[];
        text?: [color: string, name: string][];
    };
    texture?: 'grain' | 'none';
};
export declare function checkTheme(t: unknown): string[];
export declare function applyTheme(t: Theme): void;
