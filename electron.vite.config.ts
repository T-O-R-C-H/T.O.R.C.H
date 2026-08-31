import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  main: {},
  preload: {},
  renderer: {
    // The backend rewrites the project's .env whenever the user saves
    // Settings. Vite watches .env by default and restarts the dev server on
    // any change, which reloads the renderer mid-flow - it made onboarding
    // impossible to complete in development. The renderer has no env of its
    // own, so pointing envDir at an empty directory stops the watch.
    envDir: resolve('build/renderer-env'),
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        '@resources': resolve('resources')
      }
    },
    plugins: [react(), tailwindcss()]
  }
})
