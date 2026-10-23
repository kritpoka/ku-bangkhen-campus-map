// Frame-cost profile in iPhone-13-like emulation (390×844 @3x, touch, CPU
// throttled), on this machine's real GPU (headed Chrome). Pans and pinches the
// map with CDP touch input and reports per-frame costs, once per debug switch.
//
//   npm run dev -- --port 5179      # in another terminal
//   node tests/perf/profile.mjs [--throttle 4] [--dpr 1.5] [--configs baseline,shadows]
//
// --gpu waits for the GPU after each frame, so 'cpu ms/frame' becomes CPU+GPU time.
// Numbers are for comparing configurations on one machine; the GPU here is
// not an iPhone's, so confirm on the device with ?debug=1.
import { chromium } from 'playwright-core'
const URL = (process.env.MAP_URL ?? 'http://localhost:5179/') + '?debug=1'
const arg = (name, def) => {
  const i = process.argv.indexOf(`--${name}`)
  return i > 0 ? process.argv[i + 1] : def
}
const THROTTLE = +arg('throttle', 4)
const FORCE_DPR = arg('dpr', null) // caps the resolution (rest and motion)
const ALL = ['baseline', 'shadows', 'blur', 'pins', 'stops', 'trees']
const CONFIGS = arg('configs', ALL.join(',')).split(',')

const browser = await chromium.launch({ channel: 'chrome', headless: false, args: ['--ignore-gpu-blocklist'] })
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true })
const page = await ctx.newPage()
await page.goto(URL, { waitUntil: 'networkidle' })
await page.waitForFunction(() => window.__kuMap?.camera?.home && window.__kuPerf)
await page.waitForTimeout(2500)
await page.locator('button[aria-label="แสดงเส้นทางรถตะลัย"]').tap() // stops + shuttle lines on
await page.waitForTimeout(800)
const cdp = await ctx.newCDPSession(page)
await cdp.send('Performance.enable')
await cdp.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE })
if (process.argv.includes('--gpu')) await page.evaluate(() => (window.__kuPerf.syncGpu = true))
if (FORCE_DPR) await page.evaluate((d) => window.__kuMap.capDpr(d), +FORCE_DPR)

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts })
let motionDpr = 0, motionCalls = 0
/** ~1.4 s pan in a loop, then ~1.4 s pinch out and back in, events every 16 ms. */
async function gesture() {
  const cx = 195, cy = 420
  await touch('touchStart', [{ id: 1, x: cx, y: cy }])
  for (let i = 1; i <= 85; i++) {
    const a = (i / 85) * Math.PI * 2
    await touch('touchMove', [{ id: 1, x: cx + 90 * Math.sin(a), y: cy + 120 * Math.sin(2 * a) / 2 }])
    if (i === 60) [motionDpr, motionCalls] = await page.evaluate(() => [window.__kuPerf.stats.dpr, window.__kuPerf.stats.calls])
    await sleep(16)
  }
  await touch('touchEnd', [])
  await sleep(120)
  await touch('touchStart', [{ id: 1, x: cx - 40, y: cy - 40 }, { id: 2, x: cx + 40, y: cy + 40 }])
  for (let i = 1; i <= 85; i++) {
    const s = 40 + 70 * Math.sin((i / 85) * Math.PI)
    await touch('touchMove', [{ id: 1, x: cx - s, y: cy - s }, { id: 2, x: cx + s, y: cy + s }])
    await sleep(16)
  }
  await touch('touchEnd', [])
  await sleep(300)
}
const metrics = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]))
const stats = () => page.evaluate(() => ({ ...window.__kuPerf.stats }))
const setFlag = async (k, on) => {
  await page.evaluate(([k, on]) => window.__kuPerf.setFlag(k, on), [k, on])
  await page.waitForTimeout(100)
}

await gesture() // warm-up: shader compiles, caches
const rows = []
for (const cfg of CONFIGS) {
  if (cfg !== 'baseline') await setFlag(cfg, false)
  await page.waitForTimeout(400)
  await gesture() // settle after the switch
  const m0 = await metrics(), s0 = await stats(), t0 = Date.now()
  await gesture()
  const m1 = await metrics(), s1 = await stats(), secs = (Date.now() - t0) / 1000
  const frames = s1.frames - s0.frames
  const per = (k) => ((m1[k] - m0[k]) * 1000) / Math.max(1, frames)
  rows.push({
    config: cfg === 'baseline' ? 'all on' : `${cfg} off`,
    // Renders follow input, and CDP touch events arrive every ~30 ms here (not every
    // display frame as on a phone), so this is input-bound; compare costs instead.
    'renders/s': +(frames / (secs - 0.54)).toFixed(1),
    'raf ms': +s1.rafMs.toFixed(1),
    'cpu ms/frame': +((s1.cpuTotal - s0.cpuTotal) / Math.max(1, frames)).toFixed(2),
    'script ms/frame': +per('ScriptDuration').toFixed(2),
    'style ms/frame': +per('RecalcStyleDuration').toFixed(2),
    'layout ms/frame': +per('LayoutDuration').toFixed(2),
    'dpr moving': motionDpr,
    'dpr rest': s1.dpr,
    'calls moving': motionCalls,
    'calls rest': s1.calls,
    'tris k': Math.round(s1.triangles / 1000),
  })
  if (cfg !== 'baseline') await setFlag(cfg, true)
}
console.log(`CPU throttle ${THROTTLE}x${FORCE_DPR ? `, DPR forced to ${FORCE_DPR}` : ''}`)
console.table(rows)
await browser.close()
