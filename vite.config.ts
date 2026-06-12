import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base: './' keeps asset paths relative so a build works under a
// GitHub Pages subpath (e.g. /lottie-studio/) without extra config.
export default defineConfig({
  base: './',
  plugins: [react()],
})
