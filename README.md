# sheets-engine

White-label editor and presenter for A4 and 16:9 **sheets**: cards on a grid that you drag and resize,
texts you rewrite in place, an image and video gallery, two locks per page (layout, texts), present mode,
and a PDF printed by headless Edge. One engine, one repo per presentation.

Born as the editor of the Kaivros thesis (gengiord/kaivros-project); used for the Bioplast machine catalogue.

## How a presentation is made

```
my-presentation/
  presentation.config.tsx   documents: sheets, order, format, PDF name, footer, public or not
  theme.json                colours, fonts, logos, palettes, grain (the look, editable by AI)
  src/main.tsx              mount(): theme + config + data
  src/sheets/*.tsx          the pages, written with <Sheet>, <SlotSize>, <VideoBox>
  src/content.css           the presentation's own CSS (loaded after the engine CSS)
  data/layouts.json texts.json cards.json   what the editor saves
  public/ img/ video/       assets; the gallery lists public/img and public/video
  out/                      PDFs made with "Scarica PDF" (the published ones are copied to the site)
  vite.config.ts            react() + sheetsEngine({ docs: { id: { pdf, publish } } })
  middleware.js             Vercel only: export default createGate({ cookie, salt, ... })
```

Install from GitHub at a tag:

```json
"dependencies": { "@saperfare/sheets-engine": "github:saperfare/sheets-engine#v0.1.0" }
```

`src/main.tsx`:

```tsx
import { mount, type Theme } from '@saperfare/sheets-engine'
import '@saperfare/sheets-engine/engine.css'
import './content.css'
import config from '../presentation.config'
import theme from '../theme.json'
import layouts from '../data/layouts.json'
import texts from '../data/texts.json'
import cards from '../data/cards.json'

mount({ config, theme: theme as unknown as Theme, data: { layouts, texts, cards } as never })
```

A page:

```tsx
import { Sheet } from '@saperfare/sheets-engine'

export function Cover() {
  return (
    <Sheet id="cover" cols={12} rows={[1]}>
      <div key="title" className="cell" style={{ gridColumn: '1 / 13', gridRow: '1' }}>
        <h2>Titolo</h2>
      </div>
    </Sheet>
  )
}
```

Every direct child needs a `key`: it is the card id that layouts, texts and images are saved under.
`data-slot` makes a card an image slot; a card with a plain `<img>` can swap it from the gallery.

## Editor and site

- `npm run dev`: the editor. Documents are picked in the sidebar (`?doc=<id>` in the address).
  "Salva" writes `data/*.json`; "Scarica PDF" prints the saved version into `out/`.
- `npm run build`: the read-only site, with the JSON baked in. Only documents with `public: true`
  are reachable (`?doc=<id>`); `siteDefault` opens without `?doc=`.
- PDF printing needs Microsoft Edge (`EDGE_PATH` overrides the macOS path) and `pdftocairo` (poppler)
  for documents with `files` (one SVG and one PNG per page).

## Theme

`theme.json` follows `theme.schema.json`. The engine reads the semantic colours
`paper ink page accent-lt accent accent-dk strong-lt strong strong-dk` and the three fonts
(`display`, `title`, `body`); any other colour key becomes `--color-<key>` for the content CSS.

```
npx sheets-engine theme check theme.json
```

checks the required keys and the WCAG contrast of the pairs the engine draws.

## Develop the engine

```
npm install
npm run build        # dist/ is committed, so a GitHub install needs no build step
```

To try a change in a presentation, point its dependency to the local folder
(`"file:../path/to/sheets-engine"`), and back to the tag before pushing the presentation.
