# sheets-engine — Docs

## What it is
White-label editor and presenter for A4 and 16:9 sheets, extracted on 06/10/2026 from gengiord/kaivros-project
(the Kaivros thesis editor). One engine, one repo per presentation: kaivros-project (thesis, Vercel) and
saperfare/bioplast-catalogue (machine catalogue, Cloudflare Worker). Public repo saperfare/sheets-engine.

## Stack
React 19, react-grid-layout, Tabler icons, TypeScript compiled to dist/ (committed, so a GitHub install needs no
build). Vite plugin and Vercel middleware in plain JS. PDF via headless Microsoft Edge, page split via pdftocairo.

## Structure
- `src/App.tsx` PresentationApp: doc picker, sidebar, present mode, save, PDF buttons, settings
- `src/Sheet.tsx` the sheet: grid, text edit, gallery, video, locks, footer; formats LANDSCAPE, PORTRAIT, SLIDE
- `src/config.ts` PresentationConfig / DocConfig; `src/theme.ts` Theme, checkTheme, applyTheme
- `src/engine.css` generic CSS, colours and fonts as variables from theme.json
- `vite/plugin.js` sheetsEngine(): /__layouts /__texts /__cards /__pdf* /__images /__upload /__delete-image
- `middleware.js` createGate() for Vercel; `bin/sheets-engine.js` theme check
- `theme.schema.json` the theme contract

## Key decisions
- Theme in a JSON file (not a settings UI): people and Claude edit it, skill presentation-style.
- Semantic colours (paper, ink, page, accent*, strong*); a presentation may add its own keys.
- dist/ committed instead of a prepare step: installs from GitHub work on Vercel and in Actions.
- PDFs printed locally and committed: CI never needs a browser.
- Every print uses an explicit ?doc= (a default document in the editor once made the tavole print the slides).
