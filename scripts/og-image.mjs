/**
 * Render the link-preview image (public/og-image.jpg, 1200×630) from the real map.
 *
 *   npm run dev -- --port 5179     # in another terminal
 *   node scripts/og-image.mjs
 *
 * Opens the app at 1200×630, hides the UI chrome, adds a title panel in the
 * app's own font and colours, and saves a JPEG under ~500 KB.
 */
import { chromium } from 'playwright-core'
import { statSync } from 'node:fs'

const MAP = process.env.MAP_URL ?? 'http://localhost:5179/'
const OUT = new URL('../public/og-image.jpg', import.meta.url).pathname

const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=metal', '--ignore-gpu-blocklist'] })
const page = await (await browser.newContext({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 })).newPage()
await page.goto(MAP, { waitUntil: 'networkidle' })
await page.waitForFunction(() => window.__kuMap?.camera?.home)
await page.evaluate(() => document.fonts.ready)
// Overview framing: campus centred in the right two thirds, tilted like the default view.
await page.evaluate(() => {
  const h = window.__kuMap.camera.home
  window.__kuMap.view(h.target.x - 150, h.target.z + 30, h.distance * 0.78, 0)
})
await page.waitForTimeout(3500)
await page.addStyleTag({
  content: `
    header, nav, a[href*="openstreetmap"], [class*="Attribution"] { display: none !important; }
    #og-title { position: fixed; inset: 0 auto 0 0; width: 560px; padding: 0 56px; display: flex; flex-direction: column; justify-content: center; gap: 18px;
      background: linear-gradient(90deg, rgba(247,251,249,.97) 0%, rgba(247,251,249,.93) 72%, rgba(247,251,249,0) 100%); z-index: 99;
      font-family: 'IBM Plex Sans Thai', system-ui, sans-serif; color: #063d36; }
    #og-title .logo { width: 64px; height: 64px; }
    #og-title h1 { margin: 0; font-size: 58px; line-height: 1.22; font-weight: 700; letter-spacing: -0.01em; }
    #og-title p { margin: 0; font-size: 26px; line-height: 1.4; font-weight: 500; color: #3d6b63; }
    #og-title .badge { align-self: flex-start; background: #0b7a62; color: #fff; font-size: 20px; font-weight: 600; padding: 4px 16px; border-radius: 999px; }
  `,
})
await page.evaluate(() => {
  const d = document.createElement('div')
  d.id = 'og-title'
  d.innerHTML = `
    <img class="logo" src="/favicon.svg" alt="" />
    <h1>แผนที่ มก.<br/>บางเขน</h1>
    <p>KU Bangkhen Campus Map</p>
    <span class="badge">3D · ไทย / EN</span>`
  document.body.appendChild(d)
})
await page.waitForTimeout(500)
for (const q of [88, 82, 76, 70]) {
  await page.screenshot({ path: OUT, type: 'jpeg', quality: q })
  const kb = statSync(OUT).size / 1024
  console.log(`quality ${q}: ${kb.toFixed(0)} KB`)
  if (kb < 480) break
}
await browser.close()
