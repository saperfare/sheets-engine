// Vite plugin of the engine: the local editor's endpoints (save the JSON data, print the PDF with headless
// Edge, image and video gallery, uploads) and the copy of the published PDFs into dist/.
// Plain JS on purpose: Vite loads its config with Node, which does not run TypeScript from node_modules.
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync, readdirSync, renameSync, statSync } from 'node:fs'
import { basename, extname, join, relative, resolve } from 'node:path'
import { execFile } from 'node:child_process'

/**
 * @typedef {{ pdf: string, publish?: boolean, png?: [number, number] }} DocPdf
 * @param {{ docs: Record<string, DocPdf>, data?: string, public?: string, out?: string, edge?: string }} options
 *   docs: document id -> its PDF file name in out/ (publish: copied to the site; png: page size when split)
 */
export function sheetsEngine(options) {
  const edge = options.edge ?? process.env.EDGE_PATH ?? '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'
  let root = process.cwd()
  const p = (...parts) => resolve(root, ...parts)
  const DATA = () => p(options.data ?? 'data')
  const PUBLIC = () => p(options.public ?? 'public')
  const OUT = () => p(options.out ?? 'out')
  const docPdf = doc => (options.docs[doc] ? join(OUT(), options.docs[doc].pdf) : null)

  // Another site open in the browser must not be able to write into the project
  const crossSite = req => req.headers['sec-fetch-site'] === 'cross-site'
  const walk = (dir, re) => (existsSync(dir) ? readdirSync(dir, { withFileTypes: true }).flatMap(d => (d.isDirectory() ? walk(join(dir, d.name), re) : re.test(d.name) ? [join(dir, d.name)] : [])) : [])

  // GET returns the file, POST { id, value } merges one entry (null removes it), so two open tabs never clobber each other
  function store(server, path, file) {
    server.middlewares.use(path, (req, res) => {
      const f = join(DATA(), file)
      if (req.method === 'POST') {
        if (crossSite(req)) { res.statusCode = 403; res.end('cross-site'); return }
        let body = ''
        req.on('data', c => (body += c))
        req.on('end', () => {
          try {
            const { id, value } = JSON.parse(body)
            const all = existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : {}
            if (value) all[id] = value
            else delete all[id]
            mkdirSync(DATA(), { recursive: true })
            writeFileSync(f, JSON.stringify(all, null, 2) + '\n')
            res.end('ok')
          } catch (e) {
            res.statusCode = 400
            res.end(String(e))
          }
        })
        return
      }
      res.setHeader('Content-Type', 'application/json')
      res.end(existsSync(f) ? readFileSync(f) : '{}')
    })
  }

  const pkgVersion = () => { try { return JSON.parse(readFileSync(p('package.json'), 'utf8')).version } catch { return '0.0.0' } }

  return {
    name: 'sheets-engine',
    config: () => ({
      define: {
        __APP_VERSION__: JSON.stringify(pkgVersion()),
        __BUILD_DATE__: JSON.stringify(new Date().toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Rome' })),
        __BUILD_ID__: JSON.stringify(Date.now().toString(36)),
      },
      // one React only, also when the engine is linked from a local folder with its own node_modules
      resolve: { dedupe: ['react', 'react-dom'] },
      // saving rewrites the data files: no reload for that
      server: { watch: { ignored: ['**/data/layouts.json', '**/data/texts.json', '**/data/cards.json'] } },
    }),
    configResolved(c) { root = c.root },
    // The published site serves the PDFs made locally with "Scarica PDF"
    closeBundle() {
      for (const [, d] of Object.entries(options.docs)) {
        const src = join(OUT(), d.pdf)
        if (d.publish && existsSync(src)) writeFileSync(p('dist', d.pdf), readFileSync(src))
      }
    },
    configureServer(server) {
      // Prints a document with headless Edge (same engine as the browser print) and returns the PDF.
      // names=a,b,c also splits it into one SVG and one PNG per page, in out/<doc>/ (or out/word/bg/ with ?bg)
      server.middlewares.use('/__pdf', (req, res) => {
        const q = new URL(req.url ?? '', 'http://x').searchParams
        const doc = q.get('doc') ?? ''
        const bg = q.has('bg')
        const base = docPdf(doc)
        if (!base) { res.statusCode = 404; res.end('unknown doc'); return }
        const pdf = bg ? base.replace(/\.pdf$/, '-bg.pdf') : base
        const names = (q.get('names') ?? '').split(',').filter(n => /^[a-z0-9-]+$/.test(n))
        mkdirSync(OUT(), { recursive: true })
        rmSync(pdf, { force: true }) // never hand back a stale PDF
        const args = ['--headless=new', '--disable-gpu', '--no-pdf-header-footer', '--virtual-time-budget=12000', `--print-to-pdf=${pdf}`, `http://${req.headers.host}/?doc=${doc}${bg ? '&bg' : ''}`]
        execFile(edge, args, { timeout: 90_000 }, async err => {
          if (err || !existsSync(pdf)) { res.statusCode = 500; res.end(String(err ?? 'no pdf')); return }
          if (names.length) {
            const dir = bg ? join(OUT(), 'word', 'bg') : join(OUT(), doc)
            mkdirSync(dir, { recursive: true })
            const run = a => new Promise(ok => execFile('pdftocairo', a, ok))
            const [pw, ph] = options.docs[doc].png ?? [2480, 3508]
            for (const [i, name] of names.entries()) {
              const pg = ['-f', String(i + 1), '-l', String(i + 1)]
              if (!bg) await run(['-svg', ...pg, pdf, join(dir, `${name}.svg`)])
              await run(['-png', '-scale-to-x', String(pw), '-scale-to-y', String(ph), '-singlefile', ...pg, pdf, join(dir, name)])
            }
          }
          res.setHeader('Content-Type', 'application/pdf')
          res.end(readFileSync(pdf))
        })
      })
      // Is the PDF of a document newer than everything it is made of (saved data, code, styles, theme)?
      server.middlewares.use('/__pdf-status', (req, res) => {
        const pdf = docPdf(new URL(req.url ?? '', 'http://x').searchParams.get('doc') ?? '')
        const files = [...['layouts.json', 'texts.json', 'cards.json'].map(f => join(DATA(), f)), p('theme.json'), ...walk(p('src'), /./)]
        const newest = Math.max(...files.filter(f => existsSync(f)).map(f => statSync(f).mtimeMs))
        const made = pdf && existsSync(pdf) ? statSync(pdf).mtimeMs : 0
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ fresh: made >= newest, made }))
      })
      // The PDF already in out/, as it is (no new print)
      server.middlewares.use('/__pdf-file', (req, res) => {
        const pdf = docPdf(new URL(req.url ?? '', 'http://x').searchParams.get('doc') ?? '')
        if (!pdf || !existsSync(pdf)) { res.statusCode = 404; res.end('no pdf'); return }
        res.setHeader('Content-Type', 'application/pdf')
        res.end(readFileSync(pdf))
      })
      // Gallery: every image under public/img (or, with ?kind=video, every video under public/video)
      server.middlewares.use('/__images', (req, res) => {
        const video = new URL(req.url ?? '', 'http://x').searchParams.get('kind') === 'video'
        const files = video ? walk(join(PUBLIC(), 'video'), /\.(mp4|webm)$/i) : walk(join(PUBLIC(), 'img'), /\.(jpe?g|png|webp|svg)$/i)
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify(files.map(f => '/' + relative(PUBLIC(), f))))
      })
      // Delete from the gallery: the file is moved to .trash/ (outside the site), never destroyed
      server.middlewares.use('/__delete-image', (req, res) => {
        const src = new URL(req.url ?? '', 'http://x').searchParams.get('src') ?? ''
        const file = join(PUBLIC(), src)
        if (req.method !== 'POST' || crossSite(req) || !/^\/(img|video)\//.test(src) || src.includes('..') || !existsSync(file)) {
          res.statusCode = 400
          res.end('not a file of the gallery')
          return
        }
        mkdirSync(p('.trash'), { recursive: true })
        renameSync(file, p('.trash', `${Date.now().toString(36)}-${basename(file)}`))
        res.end('ok')
      })
      server.middlewares.use('/__upload', (req, res) => {
        const q = new URL(req.url ?? '', 'http://x').searchParams
        const raw = q.get('name') ?? 'image'
        const video = q.get('kind') === 'video'
        const ext = extname(raw).toLowerCase()
        if (req.method !== 'POST' || crossSite(req) || !(video ? /^\.(mp4|webm)$/ : /^\.(jpe?g|png|webp)$/).test(ext)) {
          res.statusCode = 400
          res.end('not an image')
          return
        }
        const name = `${Date.now().toString(36)}-${basename(raw, ext).replace(/[^a-z0-9]+/gi, '-').toLowerCase()}${ext}`
        const chunks = []
        let size = 0
        req.on('data', c => {
          size += c.length
          if (size > (video ? 400 : 40) * 1024 * 1024) req.destroy() // 40 MB cap, 400 MB for a video
          else chunks.push(c)
        })
        req.on('end', () => {
          const dir = video ? 'video/uploads' : 'img/uploads'
          mkdirSync(join(PUBLIC(), dir), { recursive: true })
          writeFileSync(join(PUBLIC(), dir, name), Buffer.concat(chunks))
          res.end(`/${dir}/${name}`)
        })
      })
      store(server, '/__layouts', 'layouts.json')
      store(server, '/__texts', 'texts.json')
      store(server, '/__cards', 'cards.json')
    },
  }
}
