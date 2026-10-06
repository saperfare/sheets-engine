import { mount, defineConfig, SLIDE, Sheet, Head, Tile, ToolCard, QrCard } from '@saperfare/sheets-engine'
import '@saperfare/sheets-engine/engine.css'
import theme from '../theme.json'
import layouts from '../data/layouts.json'
import texts from '../data/texts.json'
import cards from '../data/cards.json'

// Two slides built only with the engine's blocks: change theme.json and everything follows.
function Intro() {
  return (
    <Sheet id="intro" cols={3} rows={[1]}>
      <Head key="head" at={{ col: '1', row: '1' }} title="Una demo" top small>
        <p>Una presentazione fatta solo con i blocchi dell'engine.</p>
        <dl className="facts">
          <div><dt>Tema</dt><dd>theme.json: colori, caratteri, logo</dd></div>
          <div><dt>Editor</dt><dd>trascina le card, scrivi nei testi, Salva</dd></div>
        </dl>
      </Head>
      <Tile key="foto" at={{ col: '2 / 4', row: '1' }} src="/img/a.svg" chip="Immagine" />
    </Sheet>
  )
}
function Cards() {
  return (
    <Sheet id="cards" cols={3} rows={[1, 0.4]}>
      <ToolCard key="uno" at={{ col: '1', row: '1' }} src="/img/a.svg" name="Primo" chip="A" line="Una card con immagine e didascalia." />
      <ToolCard key="due" at={{ col: '2', row: '1' }} src="/img/b.svg" name="Secondo" chip="B" line="La variante sovrapposta." variant="overlay" />
      <ToolCard key="tre" at={{ col: '3', row: '1' }} src="/img/c.svg" name="Terzo" chip="C" line="La variante a due card." variant="nested" />
      <QrCard key="qr" at={{ col: '3', row: '2' }} src="/img/b.svg" label="Il progetto" />
      <Head key="nota" at={{ col: '1 / 3', row: '2' }} title="Blocchi" compact>Head, Tile, ToolCard, QrCard</Head>
    </Sheet>
  )
}

const config = defineConfig({
  id: 'demo',
  title: 'Demo, sheets-engine',
  footer: ['sheets-engine', 'Presentazione di esempio'],
  docs: { slides: { label: 'Slides', name: 'Demo', pdf: 'demo-slides.pdf', format: SLIDE, public: true, sheets: { intro: [Intro, 'Introduzione'], cards: [Cards, 'Le card'] } } },
})

mount({ config, theme, data: { layouts, texts, cards } })
