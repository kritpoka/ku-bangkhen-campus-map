import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const PLACEHOLDER = 'REPLACE-ME.invalid'

/**
 * Link-preview tags need an absolute URL, so a production build must not ship
 * the placeholder from .env. On Vercel/CI it fails the build; locally it warns.
 */
function requireSiteUrl(): Plugin {
  return {
    name: 'require-site-url',
    apply: 'build',
    configResolved(config) {
      const url = loadEnv(config.mode, process.cwd(), 'VITE_').VITE_SITE_URL ?? ''
      const bad = !/^https?:\/\//.test(url) || url.includes(PLACEHOLDER) || url.endsWith('/')
      if (!bad) return
      const msg =
        `VITE_SITE_URL is "${url}". Set it to the deployed origin without a trailing slash ` +
        '(e.g. https://ku-map.vercel.app), or link previews will point at the wrong address.'
      if (process.env.VERCEL || process.env.CI) throw new Error(msg)
      config.logger.warn(`\n⚠ ${msg}\n`)
    },
  }
}

// BASE_PATH lets GitHub Pages serve from /<repo>/; Vercel uses the default "/".
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  plugins: [react(), tailwindcss(), requireSiteUrl()],
  // JSON imports become JSON.parse('…') strings: much faster to parse than object literals.
  json: { stringify: true },
})
