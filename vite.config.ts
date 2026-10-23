import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// BASE_PATH lets GitHub Pages serve from /<repo>/; Vercel uses the default "/".
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  plugins: [react(), tailwindcss()],
  // JSON imports become JSON.parse('…') strings: much faster to parse than object literals.
  json: { stringify: true },
})
