// Search, filters, history (back gesture) and sheet snaps — desktop + mobile Chrome.
import { chromium } from 'playwright-core'
const URL = process.env.MAP_URL ?? 'http://localhost:5179/'

const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const results = []
const check = (name, ok, detail = '') => {
  results.push(ok)
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`)
}
const errors = []
async function open(ctxOpts, path = '') {
  const ctx = await browser.newContext(ctxOpts)
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto(URL + path, { waitUntil: 'networkidle' })
  await page.waitForFunction(() => window.__kuMap?.camera?.home)
  await page.evaluate(() => window.__kuMap.three().setDpr(0.5))
  await page.waitForTimeout(700)
  return { ctx, page }
}
const place = (page) => page.evaluate(() => new URL(location.href).searchParams.get('place'))

// ─── Desktop ───────────────────────────────────────────────────────────────
{
  const { ctx, page } = await open({ viewport: { width: 1280, height: 800 } })
  const input = page.locator('header input[role=combobox]')

  await page.keyboard.press('/')
  check('"/" focuses the search box', await input.evaluate((el) => el === document.activeElement))
  await page.keyboard.type('ku ave')
  await page.waitForTimeout(200)
  const first = await page.locator('[role=option]').first().textContent()
  check('partial English query ranks KU Avenue first', /KU Avenue/.test(first ?? ''), first ?? '')
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('ArrowUp')
  await page.keyboard.press('Enter')
  await page.waitForTimeout(1200)
  check('Enter selects the active result (fly-to + card)', (await place(page)) === 'ku-avenue' && (await page.locator('aside h2').textContent()) === 'KU Avenue')

  await input.fill('สนามอินทรี')
  await page.waitForTimeout(200)
  check('Thai substring query finds the stadium', /สนามอินทรีจันทรสถิตย์/.test((await page.locator('[role=option]').first().textContent()) ?? ''))
  await input.fill('xyz123')
  await page.waitForTimeout(200)
  check('friendly empty state', await page.locator('[role=status]', { hasText: 'xyz123' }).isVisible())
  await page.keyboard.press('Escape')
  await page.keyboard.press('Escape')
  check('Esc clears, then closes the dropdown', (await page.locator('[role=listbox]').count()) === 0 && (await input.inputValue()) === '')

  // Filters
  await page.keyboard.press('Escape') // close the card too
  await page.waitForTimeout(300)
  await page.locator('header button[aria-pressed]', { hasText: 'อาหาร' }).click()
  await page.waitForTimeout(400)
  const vis = await page.evaluate(() => [...(window.__kuMap.pins.visible ?? [])])
  const shown = await page.evaluate(() => [...document.querySelectorAll('[data-mode]')].filter((e) => e.dataset.mode !== 'hidden').length)
  check('food chip limits pins to food places', vis.length === 3 && shown <= 3, `${vis.join(', ')} (${shown} pins drawn)`)
  await input.fill('คณะ')
  await page.waitForTimeout(200)
  const facultyHits = await page.locator('[role=option]').count()
  check('filters also narrow search results', facultyHits === 0, `${facultyHits} faculty results while filtered to food`)
  await input.fill('')
  await page.keyboard.press('Escape')
  await page.locator('header button[aria-pressed]', { hasText: 'คณะ' }).click()
  await page.waitForTimeout(300)
  const multi = await page.evaluate(() => window.__kuMap.pins.visible?.size ?? -1)
  const expected = await page.evaluate(async () => {
    const { landmarks } = await import('/src/data/landmarks.ts')
    return landmarks.filter((l) => l.category === 'food' || l.category === 'faculty').length
  })
  check('chips are multi-select (food + faculties)', multi === expected, `${multi} visible, expected ${expected}`)
  await page.locator('header button[aria-pressed]', { hasText: 'ทั้งหมด' }).click()
  await page.waitForTimeout(300)
  check('"All" clears the filters', await page.evaluate(() => window.__kuMap.pins.visible === null))
  await ctx.close()
}

// ─── Mobile ────────────────────────────────────────────────────────────────
const mobile = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }
{
  const { ctx, page } = await open(mobile)
  await page.locator('button', { hasText: 'ค้นหาสถานที่ใน มก.' }).tap()
  await page.waitForTimeout(500)
  const input = page.locator('section[role=dialog] input[role=combobox]')
  check('tapping the bottom search bar expands the search sheet', await input.isVisible())
  await input.fill('หอสมุด')
  await page.waitForTimeout(250)
  await page.locator('[role=option]').first().tap()
  await page.waitForTimeout(1200)
  check('picking a result opens the place sheet', (await place(page)) === 'library' && (await page.locator('section[role=dialog] h2').textContent()) === 'สำนักหอสมุด')
  await page.goBack()
  await page.waitForTimeout(500)
  check('back gesture closes the place and returns to search', (await place(page)) === null && (await input.isVisible()))
  await page.goBack()
  await page.waitForTimeout(500)
  check('back again collapses search to the bar', await page.locator('button', { hasText: 'ค้นหาสถานที่ใน มก.' }).isVisible())
  check('still on the map (did not leave the site)', page.url().startsWith(URL))
  await ctx.close()
}
{
  // Deep link: back closes the sheet instead of leaving.
  const { ctx, page } = await open(mobile, '?place=stadium')
  await page.waitForTimeout(600)
  const sheet = page.locator('section[role=dialog]')
  const visible = () => sheet.evaluate((el) => window.innerHeight - el.getBoundingClientRect().top)
  const h0 = await visible()
  const vh = await page.evaluate(() => window.innerHeight)
  check('place sheet opens at the half snap', Math.abs(h0 - Math.min(vh * 0.5, 460)) < 3, `${h0.toFixed(0)} px`)
  await page.locator('section[role=dialog] button[aria-expanded]').tap()
  await page.waitForTimeout(450)
  const h1 = await visible()
  check('handle tap expands to full', Math.abs(h1 - (vh - 76)) < 3, `${h1.toFixed(0)} px`)
  // Drag the header down past half to reach peek.
  const box = await page.locator('section[role=dialog] h2').boundingBox()
  const cdp = await ctx.newCDPSession(page)
  let t = Date.now() / 1000
  const touch = (type, pts, adv = 30) => cdp.send('Input.dispatchTouchEvent', { type, timestamp: (t += adv / 1000), touchPoints: pts })
  const x = box.x - 20, y0 = box.y + 5
  await touch('touchStart', [{ id: 1, x, y: y0 }], 0)
  for (let i = 1; i <= 12; i++) await touch('touchMove', [{ id: 1, x, y: y0 + (i * (vh - 76 - 190)) / 12 }], 40)
  await page.waitForTimeout(100)
  await touch('touchEnd', [], 200) // slow release = no flick
  await page.waitForTimeout(450)
  const h2 = await visible()
  check('dragging down settles on the peek snap', Math.abs(h2 - 168) < 3, `${h2.toFixed(0)} px`)
  await page.goBack()
  await page.waitForTimeout(500)
  check(
    'back on a deep link closes the place, stays on the map',
    (await place(page)) === null && page.url().startsWith(URL) && (await page.locator('button', { hasText: 'ค้นหาสถานที่ใน มก.' }).isVisible()),
  )
  await ctx.close()
}

check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '))
console.log(`\n${results.filter(Boolean).length}/${results.length} passed`)
await browser.close()
process.exit(results.every(Boolean) ? 0 : 1)
