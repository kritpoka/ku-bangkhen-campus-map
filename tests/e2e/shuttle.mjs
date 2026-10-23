// Shuttle overlay: toggle, line highlight, stop tap, stop search — desktop + mobile Chrome.
import { chromium } from 'playwright-core'
const URL = process.env.MAP_URL ?? 'http://localhost:5179/'
const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const results = []
const check = (name, ok, detail = '') => {
  results.push(ok)
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`)
}
const errors = []
async function open(ctxOpts) {
  const ctx = await browser.newContext(ctxOpts)
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto(URL, { waitUntil: 'networkidle' })
  await page.waitForFunction(() => window.__kuMap?.camera?.home)
  await page.evaluate(() => window.__kuMap.three().setDpr(0.5))
  await page.waitForTimeout(700)
  return { ctx, page }
}
const shownStops = (page) => page.evaluate(() => [...window.__kuMap.stops.elements.values()].filter((e) => e.dataset.mode === 'shown').length)
const TOGGLE = 'button[aria-label="แสดงเส้นทางรถตะลัย"]'

// ─── Desktop ───────────────────────────────────────────────────────────────
{
  const { ctx, page } = await open({ viewport: { width: 1280, height: 800 } })
  check('overlay off by default: no stops drawn', (await shownStops(page)) === 0)
  await page.click(TOGGLE)
  await page.waitForTimeout(700)
  const all = await shownStops(page)
  check('toggle shows stops, the legend and a pressed button', all > 20 && (await page.locator('section[aria-label="รถตะลัย"]').isVisible()) && (await page.getAttribute(TOGGLE, 'aria-pressed')) === 'true', `${all} stops drawn`)
  await page.click('section[aria-label="รถตะลัย"] button:has-text("สาย 3")')
  await page.waitForTimeout(500)
  const visible = await page.evaluate(() => [...window.__kuMap.stops.visible])
  const { stops3 } = await page.evaluate(async () => {
    const { shuttleLines } = await import('/src/data/shuttle.ts')
    return { stops3: shuttleLines.find((l) => l.id === '3').stops }
  })
  check('selecting a line limits stops to that line', visible.length > 0 && visible.every((id) => stops3.includes(id)), `${visible.length} stops`)
  check('line details list hours and stops in order', await page.locator('section[aria-label="รถตะลัย"] ol li').first().textContent().then((t) => /E1a/.test(t ?? '')))
  await page.click('section[aria-label="รถตะลัย"] button:has-text("สาย 3")') // deselect
  // Stop search by code.
  await page.click('header input[role=combobox]')
  await page.keyboard.type('E12')
  await page.waitForTimeout(250)
  const opt = (await page.locator('[role=option]').first().textContent()) ?? ''
  check('searching a stop code finds the stop', /สำนักหอสมุด/.test(opt) && /ป้ายรถตะลัย/.test(opt), opt.slice(0, 60))
  await page.keyboard.press('Enter')
  await page.waitForTimeout(1500)
  const card = page.locator('aside', { hasText: 'E12' })
  const lines = await card.locator('button[aria-pressed]').allTextContents()
  check('stop card lists the lines that serve it', (await card.isVisible()) && lines.join(',') === 'สาย 1,สาย 5', lines.join(', '))
  // Click a stop dot on the map (mouse).
  await page.keyboard.press('Escape')
  await page.waitForTimeout(200)
  const dot = await page.evaluate(() => {
    for (const [id, el] of window.__kuMap.stops.elements) {
      if (el.dataset.mode !== 'shown') continue
      const m = /translate3d\(([-\d.]+)px, ([-\d.]+)px/.exec(el.style.transform)
      const x = +m[1], y = +m[2]
      if (x > 420 && x < 860 && y > 160 && y < 760 && !window.__kuMap.pins.hitTest(x, y)) return { id, x, y }
    }
  })
  await page.mouse.click(dot.x, dot.y)
  await page.waitForTimeout(400)
  check('clicking a stop dot opens its card', await page.locator('aside h2').isVisible(), dot.id)
  await page.click(TOGGLE)
  await page.waitForTimeout(400)
  check('toggling off hides stops and closes stop UI', (await shownStops(page)) === 0 && (await page.locator('aside').count()) === 0)
  await ctx.close()
}

// ─── Mobile ────────────────────────────────────────────────────────────────
{
  const { ctx, page } = await open({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
  await page.tap(TOGGLE)
  await page.waitForTimeout(700)
  check('mobile: line chips appear above the search bar', await page.locator('[role=group][aria-label="รถตะลัย"]').isVisible())
  await page.tap('[role=group][aria-label="รถตะลัย"] button:has-text("สาย 1")')
  await page.waitForTimeout(600)
  check('mobile: tapping a line opens its sheet', await page.locator('section[role=dialog] h2', { hasText: 'สาย 1' }).isVisible())
  await page.tap('section[role=dialog] button[aria-label="ปิด"]')
  await page.waitForTimeout(500)
  // Tap a stop dot (real touch via CDP, so it goes through the gesture recogniser).
  const dot = await page.evaluate(() => {
    for (const [id, el] of window.__kuMap.stops.elements) {
      if (el.dataset.mode !== 'shown') continue
      const m = /translate3d\(([-\d.]+)px, ([-\d.]+)px/.exec(el.style.transform)
      const x = +m[1], y = +m[2]
      if (x > 30 && x < 360 && y > 150 && y < 600 && !window.__kuMap.pins.hitTest(x, y)) return { id, x, y }
    }
  })
  const cdp = await ctx.newCDPSession(page)
  const t0 = Date.now() / 1000
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', timestamp: t0, touchPoints: [{ id: 1, x: dot.x, y: dot.y }] })
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', timestamp: t0 + 0.06, touchPoints: [] })
  await page.waitForTimeout(700)
  const sheet = page.locator('section[role=dialog]')
  check('mobile: tapping a stop opens the stop sheet with its lines', (await sheet.isVisible()) && (await sheet.locator('button[aria-pressed]').count()) > 0, dot.id)
  await ctx.close()
}

check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '))
console.log(`\n${results.filter(Boolean).length}/${results.length} passed`)
await browser.close()
process.exit(results.every(Boolean) ? 0 : 1)
