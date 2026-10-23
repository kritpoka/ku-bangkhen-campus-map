// Mobile bottom sheets at 375 px: drag from anywhere, inner scrolling hand-off,
// horizontal swipes, dismissing by flick / tap outside, and what must NOT dismiss.
// Real touch input via CDP with explicit timestamps (see README).
import { chromium } from 'playwright-core'
const URL = process.env.MAP_URL ?? 'http://localhost:5179/'

const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const results = []
const check = (name, ok, detail = '') => {
  results.push(ok)
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`)
}
const errors = []

async function open(path) {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 667 }, isMobile: true, hasTouch: true })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto(URL + path, { waitUntil: 'networkidle' })
  await page.waitForFunction(() => window.__kuMap?.camera?.home)
  await page.evaluate(() => window.__kuMap.capDpr(0.5))
  await page.waitForTimeout(1200)
  const cdp = await ctx.newCDPSession(page)
  let t = Date.now() / 1000
  const send = (type, pts, adv) => cdp.send('Input.dispatchTouchEvent', { type, timestamp: (t += adv / 1000), touchPoints: pts })
  /** One-finger gesture through points [[x,y],…], `ms` between moves; `hold` ms still before lifting. */
  const gesture = async (pts, ms = 16, hold = 0) => {
    await send('touchStart', [{ id: 1, x: pts[0][0], y: pts[0][1] }], 30)
    for (const [x, y] of pts.slice(1)) await send('touchMove', [{ id: 1, x, y }], ms)
    if (hold) {
      const [x, y] = pts[pts.length - 1]
      await send('touchMove', [{ id: 1, x, y }], hold)
    }
    await send('touchEnd', [], 16)
    await page.waitForTimeout(450)
  }
  const line = (x0, y0, x1, y1, n = 16) => Array.from({ length: n + 1 }, (_, i) => [x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n])
  const tap = async (x, y) => {
    await send('touchStart', [{ id: 1, x, y }], 30)
    await send('touchEnd', [], 60)
    await page.waitForTimeout(700) // past the double-tap window
  }
  return { ctx, page, gesture, line, tap }
}

const sheetH = (page) => page.evaluate(() => {
  const s = document.querySelector('[data-sheet]')
  return s ? Math.round(innerHeight - s.getBoundingClientRect().top) : 0
})
const scrollTop = (page) => page.evaluate(() => document.querySelector('[data-sheet-body]')?.scrollTop ?? -1)
const place = (page) => page.evaluate(() => new URL(location.href).searchParams.get('place'))
const VH = 667
const FULL = VH - 76, HALF = Math.round(Math.min(VH * 0.5, 460)), PEEK = 168

// ─── Drag, scroll and hand-off ───────────────────────────────────────────────
{
  const { ctx, page, gesture, line } = await open('?place=auditorium')
  check('place sheet opens at half', Math.abs((await sheetH(page)) - HALF) < 3, `${await sheetH(page)} px`)

  // A drag that starts on the body (below the header) moves the sheet.
  const y = VH - 60
  await gesture(line(190, y, 190, y - 300), 16, 120)
  check('drag up from the sheet body expands it to full', Math.abs((await sheetH(page)) - FULL) < 3, `${await sheetH(page)} px`)

  const before = await scrollTop(page)
  const room = await page.evaluate(() => { const b = document.querySelector('[data-sheet-body]'); return b.scrollHeight - b.clientHeight })
  await gesture(line(190, 560, 190, 300), 16, 120)
  const scrolled = await scrollTop(page)
  check('at full height, dragging up scrolls the content (sheet stays)', room > 20 && scrolled >= Math.min(room, before + 150) - 2 && Math.abs((await sheetH(page)) - FULL) < 3, `scrollTop ${before} → ${scrolled} (room ${room} px)`)

  // One gesture: scroll the content back to its top, then keep going down.
  await gesture(line(190, 250, 190, 250 + scrolled + 230, 30), 16, 120)
  const h = await sheetH(page)
  check('scroll to top then keep dragging down collapses the sheet in one gesture', (await scrollTop(page)) === 0 && h < FULL - 100, `scrollTop 0, sheet ${h} px`)

  // Back to half, then a horizontal swipe on the photo gallery.
  const g = await page.evaluate(() => {
    const el = document.querySelector('[data-sheet] figure > div')
    const r = el.getBoundingClientRect()
    return { y: Math.min(r.top + 30, innerHeight - 20), left: el.scrollLeft }
  })
  const h0 = await sheetH(page)
  await gesture(line(320, g.y, 60, g.y + 12, 16), 16, 0)
  const g1 = await page.evaluate(() => document.querySelector('[data-sheet] figure > div').scrollLeft)
  check('horizontal swipe on the photo gallery scrolls it and does not move the sheet', g1 > g.left + 50 && Math.abs((await sheetH(page)) - h0) < 2, `scrollLeft ${g.left} → ${g1}, sheet ${h0} → ${await sheetH(page)} px`)

  // A drag that starts on a button moves the sheet and doesn't press the button.
  const close = await page.locator('[data-sheet] button[aria-label="ปิด"]').first().boundingBox()
  const cx = close.x + close.width / 2, cy = close.y + close.height / 2
  await gesture(line(cx, cy, cx, cy - 150), 16, 120)
  check('a drag starting on the close button moves the sheet, does not close it', (await place(page)) === 'auditorium' && (await sheetH(page)) > h0 + 50, `sheet ${await sheetH(page)} px`)

  // Flick down from full: one snap at a time, then a flick at the lowest snap closes.
  for (let i = 0; i < 4 && (await place(page)); i++) {
    const top = VH - (await sheetH(page)) + 70 // start inside the sheet as it shrinks
    await gesture(line(190, top, 190, top + 120, 4), 10)
  }
  check('flicking down dismisses the place sheet', (await place(page)) === null && (await sheetH(page)) === 0)
  // Dismissing stepped back over the app's own history entry, so the next back
  // gesture behaves as if the place had never been opened.
  check('dismissing clears ?place= and leaves no app history entry behind', await page.evaluate(() => !new URL(location.href).searchParams.has('place') && history.state?.['ku-map:place'] === undefined))
  await ctx.close()
}

// ─── Tap outside, switch, pan ────────────────────────────────────────────────
{
  const { ctx, page, gesture, line, tap } = await open('?place=library')
  // Zoom out a little so other pins are on screen above the sheet.
  await page.evaluate(() => { const s = window.__kuMap.camera.read(); window.__kuMap.view(s.target.x, s.target.z + 120, s.distance * 1.8, s.azimuth) })
  await page.waitForTimeout(900)
  /** A visible pin (label or dot) other than `except`, above the sheet. */
  const otherPin = (except) => page.evaluate(([except, limit]) => {
    for (const el of document.querySelectorAll('[data-mode=label], [data-mode=dot]')) {
      const m = /translate3d\(([-\d.]+)px, ([-\d.]+)px/.exec(el.style.transform)
      if (!m) continue
      for (const dy of [0, -12, -24, -32]) {
        const x = +m[1], y = +m[2] + dy
        const id = window.__kuMap.pins.hitTest(x, y)
        if (id && id !== except && x > 20 && x < 355 && y > 120 && y < limit) return { id, x, y }
      }
    }
  }, [except, VH - HALF - 30])
  /** A map point with nothing under it, above the sheet. */
  const emptyPoint = () => page.evaluate((limit) => {
    for (let y = 140; y < limit; y += 23) for (let x = 30; x < 345; x += 29) if (!window.__kuMap.pins.hitTest(x, y) && !window.__kuMap.stops.hitTest(x, y)) return { x, y }
  }, VH - HALF - 30)

  const cam = () => page.evaluate(() => { const s = window.__kuMap.camera.read(); return [s.target.x, s.target.z] })
  const c0 = await cam()
  await gesture(line(120, 200, 260, 280, 12), 16, 120)
  const c1 = await cam()
  check('panning the map does not dismiss the sheet', (await place(page)) === 'library' && Math.hypot(c1[0] - c0[0], c1[1] - c0[1]) > 10)

  const pin = await otherPin('library')
  if (pin) {
    await tap(pin.x, pin.y)
    check('tapping another pin switches the sheet to it', (await place(page)) === pin.id && (await sheetH(page)) > 0, pin.id)
  } else check('tapping another pin switches the sheet to it', false, 'no other pin visible above the sheet')

  await page.waitForTimeout(1500) // let the fly-to finish: touching a moving map only stops it
  const p = await emptyPoint()
  await tap(p.x, p.y)
  await page.waitForTimeout(300)
  check('tapping empty map dismisses the sheet and clears ?place=', (await place(page)) === null && (await sheetH(page)) === 0)
  check('the search bar is back with pins clear of it', await page.locator('button', { hasText: 'ค้นหาสถานที่ใน มก.' }).isVisible())
  await ctx.close()
}

// ─── Shuttle line sheet + search sheet ──────────────────────────────────────
{
  const { ctx, page, gesture, line, tap } = await open('')
  await page.locator('button[aria-label="แสดงเส้นทางรถตะลัย"]').tap()
  await page.waitForTimeout(500)
  await page.locator('[data-line-chips] button', { hasText: 'สาย 3' }).tap()
  await page.waitForTimeout(600)
  const lineOpen = await sheetH(page)
  const p = await page.evaluate((limit) => {
    for (let y = 150; y < limit; y += 23) for (let x = 30; x < 330; x += 29) if (!window.__kuMap.pins.hitTest(x, y) && !window.__kuMap.stops.hitTest(x, y)) return { x, y }
  }, VH - lineOpen - 30)
  await tap(p.x, p.y)
  check('tapping empty map dismisses the line sheet', lineOpen > 0 && (await sheetH(page)) === 0, `${lineOpen} px → ${await sheetH(page)} px`)

  await page.locator('button', { hasText: 'ค้นหาสถานที่ใน มก.' }).tap()
  await page.waitForTimeout(600)
  await page.evaluate(() => document.activeElement?.blur())
  const s0 = await sheetH(page)
  await gesture(line(190, 400, 190, 300), 16, 120)
  const s1 = await scrollTop(page)
  await gesture(line(190, 150, 190, Math.min(VH - 10, 150 + s1 + 420), 30), 16, 120)
  await page.waitForTimeout(300)
  check('search sheet: drag on the results scrolls, then dragging down past the top collapses it to the bar',
    s0 > 500 && s1 > 30 && (await page.locator('section[role=dialog]').count()) === 0 && (await page.locator('button', { hasText: 'ค้นหาสถานที่ใน มก.' }).isVisible()),
    `scrolled ${s1} px`)
  await ctx.close()
}

check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '))
console.log(`\n${results.filter(Boolean).length}/${results.length} passed`)
await browser.close()
process.exit(results.every(Boolean) ? 0 : 1)
