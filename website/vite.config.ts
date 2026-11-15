import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Relative asset paths, so the same build works at a domain root and under
// GitHub Pages' /T.O.R.C.H/ path. Routing is by hash, so no server rewrites.
export default defineConfig({
  base: './',
  plugins: [react()],
  server: { port: 4173 },
  build: { target: 'es2022', sourcemap: false }
})
