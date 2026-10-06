import type { Plugin } from 'vite'
export type DocPdf = { pdf: string; publish?: boolean; png?: [number, number] }
export function sheetsEngine(options: { docs: Record<string, DocPdf>; data?: string; public?: string; out?: string; edge?: string }): Plugin
