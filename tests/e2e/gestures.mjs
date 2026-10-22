// Gesture tests: real multi-touch via CDP (Chrome mobile emulation).
import { chromium } from 'playwright-core'

const URL = process.env.MAP_URL ?? 'http://localhost:5179/'
const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true })
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
await page.goto(URL, { waitUntil: 'networkidle' })
await page.waitForFunction(() => window.__kuMap?.camera?.ready && window.__kuMap.camera.home)
// Software GL is slow; render at low resolution so touch timing stays realistic.
await page.evaluate(() => window.__kuMap.three().setDpr(0.4))
await page.waitForTimeout(1200)
const cdp = await ctx.newCDPSession(page)

const sleep = (ms) => page.waitForTimeout(ms)
// Virtual input clock: every touch carries an explicit timestamp, so gesture
// timing (double-tap windows, fling velocity) is exact even when software GL
// makes frames slow. `advance` is the time since the previous touch event.
let vclock = Date.now() / 1000
const touch = (type, pts, advance = 16) => {
  vclock += advance / 1000
  return cdp.send('Input.dispatchTouchEvent', {
    type,
    timestamp: vclock,
    touchPoints: pts.map((p) => ({ x: p.x, y: p.y, id: p.id, radiusX: 4, radiusY: 4, force: 1 })),
  })
}
const state = () =>
  page.evaluate(() => {
    const s = window.__kuMap.camera.read()
    return { x: s.target.x, z: s.target.z, d: s.distance, az: s.azimuth, polar: s.polar, active: window.__kuMap.camera.active }
  })
const ground = (x, y) =>
  page.evaluate(([x, y]) => {
    const v = window.__kuMap.camera.groundAt(x, y, new (window.__kuMap.three().camera.position.constructor)())
    return v && { x: v.x, z: v.z }
  }, [x, y])
const reset = async () => {
  await page.evaluate(() => {
    const c = window.__kuMap.camera
    c.cancelAnimation()
    window.__kuMap.view(0, -100, 900, 0, c.defaultPolar)
  })
  await sleep(150)
}
const settled = () => page.waitForFunction(() => !window.__kuMap.camera.active, null, { timeout: 4000 })
const url = () => page.evaluate(() => new URL(location.href).searchParams.get('place'))

/** Move fingers along straight lines. paths: [{id, from:[x,y], to:[x,y]}] */
async function gesture(paths, { steps = 12, stepMs = 16, lift = true, holdMs = 0, gap = 400 } = {}) {
  const at = (k) => paths.map((p) => ({ id: p.id, x: p.from[0] + (p.to[0] - p.from[0]) * k, y: p.from[1] + (p.to[1] - p.from[1]) * k }))
  // Fingers go down one at a time, like real hands.
  for (let i = 1; i <= paths.length; i++) await touch('touchStart', at(0).slice(0, i), i === 1 ? gap : 10)
  for (let s = 1; s <= steps; s++) await touch('touchMove', at(s / steps), s === 1 ? holdMs + stepMs : stepMs)
  if (lift) await touch('touchEnd', [], 8)
}
/** A tap: `gap` ms after the previous touch event, held 50 ms. */
const tap = async (x, y, id = 1, gap = 400) => {
  await touch('touchStart', [{ id, x, y }], gap)
  await touch('touchEnd', [], 50)
}
const angle = (a) => Math.atan2(Math.sin(a), Math.cos(a))
const deg = (r) => ((r * 180) / Math.PI).toFixed(1)

const results = []
const check = (name, ok, detail) => {
  results.push({ name, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`)
}

// 1. One-finger pan: the ground under the finger follows it.
await reset()
{
  const g0 = await ground(195, 500)
  await gesture([{ id: 1, from: [195, 500], to: [195, 360] }], { steps: 14, stepMs: 30 })
  await sleep(40)
  const g1 = await ground(195, 360)
  // Finger paused-ish (30 ms steps) -> may fling a little; compare right after lift.
  check('1-finger drag pans (ground stays under finger)', Math.hypot(g0.x - g1.x, g0.z - g1.z) < 6, `drift ${Math.hypot(g0.x - g1.x, g0.z - g1.z).toFixed(2)} m`)
  await settled()
}

// 2. Fling: a fast swipe keeps gliding after release, then stops.
await reset()
{
  await gesture([{ id: 1, from: [195, 600], to: [195, 380] }], { steps: 6, stepMs: 16 })
  const atLift = await state()
  await sleep(250)
  const later = await state()
  await settled()
  const end = await state()
  const glide = Math.hypot(later.x - atLift.x, later.z - atLift.z)
  check('fling continues after release and eases out', glide > 5 && !end.active, `glided ${glide.toFixed(1)} m in 250 ms`)
}

// 3. Pinch zoom anchored at the finger midpoint (off-centre on purpose).
await reset()
{
  const mid = [120, 560]
  const g0 = await ground(...mid)
  const s0 = await state()
  await gesture(
    [
      { id: 1, from: [mid[0] - 40, mid[1]], to: [mid[0] - 100, mid[1]] },
      { id: 2, from: [mid[0] + 40, mid[1]], to: [mid[0] + 100, mid[1]] },
    ],
    { lift: false },
  )
  const g1 = await ground(...mid)
  const s1 = await state()
  await touch('touchEnd', [])
  await settled()
  check('pinch out zooms in', s1.d < s0.d * 0.55, `distance ${s0.d.toFixed(0)} → ${s1.d.toFixed(0)}`)
  check('pinch anchored at midpoint (not screen centre)', Math.hypot(g0.x - g1.x, g0.z - g1.z) < 4, `anchor drift ${Math.hypot(g0.x - g1.x, g0.z - g1.z).toFixed(2)} m`)
  check('plain pinch does not rotate or tilt', Math.abs(angle(s1.az - s0.az)) < 1e-3 && Math.abs(s1.polar - s0.polar) < 1e-3, `Δaz ${deg(s1.az - s0.az)}°, Δtilt ${deg(s1.polar - s0.polar)}°`)
}

// 4. Small twist (8°) during a pinch is ignored; a clear twist (35°) rotates.
const twist = async (degrees) => {
  await reset()
  const c = [195, 500], r = 80
  const s0 = await state()
  const paths = [1, 2].map((id) => {
    const a0 = id === 1 ? Math.PI : 0
    const a1 = a0 + (degrees * Math.PI) / 180
    return { id, from: [c[0] + r * Math.cos(a0), c[1] + r * Math.sin(a0)], to: [c[0] + r * Math.cos(a1), c[1] + r * Math.sin(a1)] }
  })
  // Rotate along an arc (several straight segments).
  const segs = 10
  for (let i = 1; i <= 2; i++) await touch('touchStart', paths.slice(0, i).map((p) => ({ id: p.id, x: p.from[0], y: p.from[1] })), i === 1 ? 400 : 10)
  for (let s = 1; s <= segs; s++) {
    const k = s / segs
    await touch(
      'touchMove',
      [1, 2].map((id) => {
        const a = (id === 1 ? Math.PI : 0) + ((degrees * Math.PI) / 180) * k
        return { id, x: c[0] + r * Math.cos(a), y: c[1] + r * Math.sin(a) }
      }),
    )
  }
  await touch('touchEnd', [])
  const s1 = await state()
  await settled()
  return angle(s1.az - s0.az)
}
{
  const small = await twist(8)
  check('8° twist does not rotate (threshold ~12°)', Math.abs(small) < 1e-3, `Δazimuth ${deg(small)}°`)
  const big = await twist(35)
  check('35° clockwise twist rotates the map clockwise', big > 0.3 && big < 0.45, `Δazimuth ${deg(big)}° (expected ≈ 35 − 12 = 23°)`)
}

// 5. Compass appears when rotated; tapping it returns to north + default tilt.
{
  const visible = await page.evaluate(() => {
    const b = document.querySelector('nav button[aria-hidden="false"]')
    return !!b
  })
  check('compass visible after rotating', visible)
  const box = await page.evaluate(() => {
    const b = document.querySelector('nav button[aria-hidden="false"]').getBoundingClientRect()
    return { x: b.x + b.width / 2, y: b.y + b.height / 2 }
  })
  await tap(box.x, box.y, 7)
  await settled()
  const s = await state()
  const hidden = await page.evaluate(() => !document.querySelector('nav button[aria-hidden="false"]'))
  const def = await page.evaluate(() => window.__kuMap.camera.defaultPolar)
  check('compass tap resets to north and default tilt, then hides', Math.abs(angle(s.az)) < 1e-3 && Math.abs(s.polar - def) < 1e-3 && hidden, `az ${deg(s.az)}°, tilt Δ ${deg(s.polar - def)}°`)
}

// 6. Two fingers dragged up together tilt (toward the horizon), without zooming.
await reset()
{
  const s0 = await state()
  await gesture([
    { id: 1, from: [140, 560], to: [140, 470] },
    { id: 2, from: [250, 560], to: [250, 470] },
  ])
  const s1 = await state()
  await settled()
  const s2 = await state()
  check('two-finger drag up tilts toward horizon', s1.polar > s0.polar + 0.15, `tilt ${deg(s0.polar)}° → ${deg(s1.polar)}° from vertical`)
  check('tilt does not zoom or rotate', Math.abs(s1.d - s0.d) < 1 && Math.abs(angle(s1.az - s0.az)) < 1e-3)
  const max = await page.evaluate(() => window.__kuMap.camera.limits.maxPolar)
  check('tilt stays within the 28–54° range after settling', s2.polar <= max + 1e-3, `settled at ${(90 - +deg(s2.polar)).toFixed(1)}° above ground`)
}

// 7. Double-tap zooms in one step, centred on the tap point.
await reset()
{
  const p = [110, 520]
  const g0 = await ground(...p)
  const s0 = await state()
  await tap(...p)
  await tap(...p, 1, 120)
  await settled()
  const s1 = await state()
  const g1 = await ground(...p)
  check('double-tap zooms in one step', Math.abs(s1.d / s0.d - 0.5) < 0.02, `distance ×${(s1.d / s0.d).toFixed(3)}`)
  check('double-tap zoom anchored on the tap point', Math.hypot(g0.x - g1.x, g0.z - g1.z) < 4, `drift ${Math.hypot(g0.x - g1.x, g0.z - g1.z).toFixed(2)} m`)
  check('double-tap does not select anything', (await url()) === null)
}

// 8. Two-finger tap zooms out one step.
await reset()
{
  const s0 = await state()
  await touch('touchStart', [{ id: 1, x: 150, y: 500 }], 400)
  await touch('touchStart', [{ id: 1, x: 150, y: 500 }, { id: 2, x: 240, y: 500 }], 15)
  await touch('touchEnd', [{ id: 2, x: 240, y: 500 }], 90)
  await touch('touchEnd', [], 10)
  await settled()
  const s1 = await state()
  check('two-finger tap zooms out one step', Math.abs(s1.d / s0.d - 2) < 0.05 || s1.d >= (await page.evaluate(() => window.__kuMap.camera.limits.maxDistance)) - 1, `distance ×${(s1.d / s0.d).toFixed(3)}`)
}

// 9. Double-tap-and-hold, then drag: one-handed zoom (down = in, up = out).
await reset()
{
  const s0 = await state()
  await tap(195, 500)
  await gesture([{ id: 1, from: [195, 500], to: [195, 600] }], { steps: 10, stepMs: 20, gap: 120, holdMs: 150 })
  await settled()
  const s1 = await state()
  check('double-tap-hold-drag down zooms in', s1.d < s0.d * 0.6, `distance ×${(s1.d / s0.d).toFixed(3)}`)
  await reset()
  const s2 = await state()
  await tap(195, 500)
  await gesture([{ id: 1, from: [195, 500], to: [195, 420] }], { steps: 10, stepMs: 20, gap: 120, holdMs: 150 })
  await settled()
  const s3 = await state()
  check('double-tap-hold-drag up zooms out', s3.d > s2.d * 1.3, `distance ×${(s3.d / s2.d).toFixed(3)}`)
}

// 10. Single tap selects a pin — but not when the touch was a pan.
await page.evaluate(() => window.__kuMap.view(390, 570, 700, 0, window.__kuMap.camera.defaultPolar))
await sleep(400)
{
  const target = await page.evaluate(() => {
    // A visible pin's dot position (map-relative == viewport here).
    for (const el of document.querySelectorAll('[data-mode]')) {
      if (el.dataset.mode === 'hidden') continue
      const m = /translate3d\(([-\d.]+)px, ([-\d.]+)px/.exec(el.style.transform)
      if (!m) continue
      const x = +m[1], y = +m[2]
      if (x > 40 && x < 350 && y > 200 && y < 700) return { x, y, label: el.querySelector('button').getAttribute('aria-label') }
    }
    return null
  })
  // Pan starting on the pin: must not select.
  await gesture([{ id: 1, from: [target.x, target.y], to: [target.x + 60, target.y + 40] }], { steps: 8, stepMs: 30 })
  await sleep(450)
  check('pan starting on a pin does not select', (await url()) === null)
  await settled()
  // Re-find (the pan moved it) and tap.
  const t2 = await page.evaluate((label) => {
    for (const el of document.querySelectorAll('[data-mode]')) {
      if (el.querySelector('button').getAttribute('aria-label') !== label) continue
      const m = /translate3d\(([-\d.]+)px, ([-\d.]+)px/.exec(el.style.transform)
      return { x: +m[1], y: +m[2] }
    }
  }, target.label)
  await tap(t2.x, t2.y)
  await sleep(150)
  const early = await url()
  await sleep(300)
  const sel = await url()
  check('single tap on a pin selects it (after the double-tap window)', early === null && !!sel, `selected ${sel} (${target.label})`)
  const sheet = await page.evaluate(() => !!document.querySelector('section[role=dialog] h2'))
  check('mobile bottom sheet opens with the place', sheet)
  await settled()
  // Tap on empty map clears the selection (pick a spot with no pin under it).
  const empty = await page.evaluate(() => {
    const clear = (x, y) => { for (let dy = -60; dy <= 60; dy += 15) for (let dx = -60; dx <= 60; dx += 15) if (window.__kuMap.pins.hitTest(x + dx, y + dy)) return false; return true }
    for (let y = 150; y < 420; y += 15) for (let x = 70; x < 320; x += 15) if (clear(x, y)) return { x, y }
  })
  await tap(empty.x, empty.y)
  await sleep(450)
  check('tap on empty map clears the selection', (await url()) === null)
}

// 11. Rubber band: dragging past the pan bounds resists, then springs back inside.
await page.evaluate(() => window.__kuMap.view(0, -100, 900, 0, window.__kuMap.camera.defaultPolar))
await sleep(200)
{
  const b = await page.evaluate(() => window.__kuMap.camera.limits.bounds)
  // Drag the map down hard many times (camera target moves north, past maxZ? north is -z -> minZ).
  for (let i = 0; i < 5; i++) await gesture([{ id: 1, from: [195, 250], to: [195, 750] }], { steps: 10, stepMs: 30 })
  const over = await state()
  await settled()
  const back = await state()
  check('dragging past the edge rubber-bands, then settles inside the bounds', back.z >= b.minZ - 0.5 && over.z < back.z + 0.01, `target z ${over.z.toFixed(0)} → ${back.z.toFixed(0)} (min ${b.minZ.toFixed(0)})`)
}

// 12. Zoom limit rubber band: pinching far past max distance springs back.
await reset()
{
  const max = await page.evaluate(() => window.__kuMap.camera.limits.maxDistance)
  let peak = 0
  for (let i = 0; i < 3; i++) {
    await gesture([
      { id: 1, from: [95, 500], to: [175, 500] },
      { id: 2, from: [295, 500], to: [215, 500] },
    ], { lift: false })
    peak = Math.max(peak, (await state()).d)
    if (i === 0) console.log('   pinch-in state:', JSON.stringify(await page.evaluate(() => ({ mode: window.__kuGesture.mode(), n: window.__kuGesture.pointers(), zooming: window.__kuGesture.multi.zooming, active: window.__kuMap.camera.active }))))
    await touch('touchEnd', [])
  }
  await settled()
  const s = await state()
  check('zooming out past the limit overshoots softly, then springs back to max', peak > max && s.d <= max + 0.5 && Math.abs(s.d - max) < 1, `peak ${peak.toFixed(0)}, settled ${s.d.toFixed(0)} (max ${max.toFixed(0)})`)
}

// 13. The page never scrolls or browser-zooms.
{
  const vv = await page.evaluate(() => ({ sy: window.scrollY, sx: window.scrollX, scale: window.visualViewport?.scale ?? 1 }))
  check('page did not scroll or zoom during gestures', vv.sx === 0 && vv.sy === 0 && vv.scale === 1, JSON.stringify(vv))
}

check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '))
const failed = results.filter((r) => !r.ok).length
console.log(`\n${results.length - failed}/${results.length} passed`)
await browser.close()
process.exit(failed ? 1 : 0)
