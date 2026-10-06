import type { ComponentType } from 'react'
import type { Format } from './Sheet'
import type { Cards, Saved, Texts } from './Sheet'

// One document of a presentation: a set of sheets in one format (the tavole, the slides, the covers)
export type DocConfig = {
  label: string                                   // name in the document picker
  name: string                                    // longer name, shown next to the logo on the read-only site
  sheets: Record<string, [ComponentType, string]> // sheet id -> [component, default name]
  order?: string[]                                // first order, before any reorder is saved (default: sheets order)
  settings?: string                               // key of its settings in cards.json (default: settings:<doc id>)
  pdf: string                                     // file name of its PDF, in out/ and on the site
  format: Format
  files?: Record<string, string>                  // sheet id -> page file name; when set the PDF is also split per page
  picker?: [image: string, format: string]        // picture and format label in the document picker
  footer?: string[]                               // footer items for this document (default: config.footer)
  public?: boolean                                // shown on the published site too
}

export type PresentationConfig = {
  id: string                     // short id: localStorage keys, PDF folder names
  title: string                  // page title
  docs: Record<string, DocConfig>
  pickerOrder?: string[]         // order in the document picker (default: docs order)
  editorDefault?: string         // document the editor opens first (default: the first one)
  siteDefault?: string           // document the published site opens without ?doc= (default: the first public one)
  footer?: string[]              // footer items under every sheet (a format with foot: true)
}

export type PresentationData = { layouts: Saved; texts: Texts; cards: Cards }

export const defineConfig = (c: PresentationConfig) => c
