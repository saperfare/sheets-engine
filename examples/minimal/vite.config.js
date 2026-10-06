import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { sheetsEngine } from '@saperfare/sheets-engine/vite'

export default defineConfig({
  plugins: [react(), sheetsEngine({ docs: { slides: { pdf: 'demo-slides.pdf', publish: true, png: [1920, 1080] } } })],
})
