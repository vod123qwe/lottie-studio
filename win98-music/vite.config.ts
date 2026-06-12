import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base: './' keeps asset paths relative so a static build works under any
// subpath (GitHub Pages, etc.) without extra config.
export default defineConfig({
  base: './',
  plugins: [react()],
})
