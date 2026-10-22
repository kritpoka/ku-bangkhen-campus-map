// WebKit (Safari engine) pass: native touchscreen tap + synthetic multi-touch pointer streams.
const URL = process.env.MAP_URL ?? 'http://localhost:5179/'
import { webkit } from 'playwright-core'
const browser = await webkit.launch()
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, deviceScaleFactor: 1 })
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
await page.goto(URL, { waitUntil: 'networkidle' })
await page.waitForFunction(() => window.__kuMap?.camera?.home, null, { timeout: 30000 })
await page.waitForTimeout(800)
const results = []
const check = (n, ok, d = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${d ? '  — ' + d : ''}`) }
const st = () => page.evaluate(() => { const s = window.__kuMap.camera.read(); return { x: s.target.x, z: s.target.z, d: s.distance, az: s.azimuth, polar: s.polar } })
const reset = () => page.evaluate(() => { window.__kuMap.camera.cancelAnimation(); window.__kuMap.view(0, -100, 900, 0, window.__kuMap.camera.defaultPolar) })
const settled = () => page.waitForFunction(() => !window.__kuMap.camera.active, null, { timeout: 5000 })

// In-page synthetic pointer streams (fingers: [{id, from, to}]).
const stream = (fingers, steps = 12, lift = true) =>
  page.evaluate(async ([fingers, steps, lift]) => {
    const el = document.querySelector('canvas')
    const fire = (type, f, x, y) =>
      el.dispatchEvent(new PointerEvent(type, { pointerType: 'touch', pointerId: 100 + f.id, isPrimary: f.id === 1, clientX: x, clientY: y, bubbles: true, cancelable: true }))
    const wait = (ms) => new Promise((r) => setTimeout(r, ms))
    for (const f of fingers) { fire('pointerdown', f, ...f.from); await wait(10) }
    for (let s = 1; s <= steps; s++) {
      for (const f of fingers) fire('pointermove', f, f.from[0] + (f.to[0] - f.from[0]) * s / steps, f.from[1] + (f.to[1] - f.from[1]) * s / steps)
      await wait(16)
    }
    if (lift) for (const f of fingers) fire('pointerup', f, ...f.to)
  }, [fingers, steps, lift])

await reset(); await page.waitForTimeout(100)
{ const a = await st(); await stream([{ id: 1, from: [195, 500], to: [195, 380] }]); await settled(); const b = await st(); check('1-finger pan', b.z > a.z + 50, `Δz ${(b.z - a.z).toFixed(0)} m`) }
await reset(); await page.waitForTimeout(100)
{ const a = await st(); await stream([{ id: 1, from: [135, 500], to: [75, 500] }, { id: 2, from: [255, 500], to: [315, 500] }]); await settled(); const b = await st(); check('pinch zoom', b.d < a.d * 0.6, `${a.d.toFixed(0)} → ${b.d.toFixed(0)}`); check('pinch does not rotate', Math.abs(b.az - a.az) < 1e-3) }
await reset(); await page.waitForTimeout(100)
{ const a = await st(); await stream([{ id: 1, from: [140, 560], to: [140, 470] }, { id: 2, from: [250, 560], to: [250, 470] }]); const b = await st(); await settled(); check('two-finger tilt', b.polar > a.polar + 0.1, `${(a.polar * 57.3).toFixed(0)}° → ${(b.polar * 57.3).toFixed(0)}°`) }
// Native WebKit touch: double-tap zoom, then single tap selection.
await reset(); await page.waitForTimeout(300)
{ const a = await st(); await page.touchscreen.tap(150, 520); await page.waitForTimeout(90); await page.touchscreen.tap(150, 520); await settled(); await page.waitForTimeout(400); const b = await st(); check('native double-tap zooms in', Math.abs(b.d / a.d - 0.5) < 0.03, `×${(b.d / a.d).toFixed(3)}`) }
await page.evaluate(() => window.__kuMap.view(390, 570, 700, 0, window.__kuMap.camera.defaultPolar)); await page.waitForTimeout(500)
{
  const p = await page.evaluate(() => { for (const el of document.querySelectorAll('[data-mode]')) { if (el.dataset.mode === 'hidden') continue; const m = /translate3d\(([-\d.]+)px, ([-\d.]+)px/.exec(el.style.transform); return { x: +m[1], y: +m[2] } } })
  await page.touchscreen.tap(p.x, p.y); await page.waitForTimeout(600)
  const sel = await page.evaluate(() => new URL(location.href).searchParams.get('place'))
  check('native single tap selects a pin', !!sel, sel ?? '')
  check('bottom sheet shown', await page.evaluate(() => !!document.querySelector('section[role=dialog] h2')))
}
const vv = await page.evaluate(() => ({ sx: scrollX, sy: scrollY, scale: visualViewport?.scale ?? 1 }))
check('page did not scroll/zoom', vv.sx === 0 && vv.sy === 0 && vv.scale === 1, JSON.stringify(vv))
check('no page errors', errors.length === 0, errors.slice(0, 2).join(' | '))
console.log(`\n${results.filter(Boolean).length}/${results.length} passed (WebKit ${browser.version()})`)
await browser.close()
