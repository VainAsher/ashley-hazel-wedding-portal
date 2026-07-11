// One-off mobile audit: walk every guest + admin page on staging at Pixel 5
// size, save full-page screenshots, and report horizontal overflow.
import { mkdirSync } from 'node:fs'
import { chromium, devices } from '@playwright/test'

const BASE = 'http://192.168.0.32'
const OUT = process.env.MOBILE_PASS_OUT ?? 'mobile-pass-shots'
mkdirSync(OUT, { recursive: true })

const findings = []

async function shoot(page, name) {
  await page.waitForTimeout(900)
  const overflow = await page.evaluate(() => {
    const width = window.innerWidth
    const docWide = document.documentElement.scrollWidth > width + 1
    const wide = []
    if (docWide) {
      for (const el of document.querySelectorAll('body *')) {
        const r = el.getBoundingClientRect()
        if (r.width > width + 1 && el.children.length < 8) {
          wide.push(`${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]} ${Math.round(r.width)}px`)
          if (wide.length >= 5) break
        }
      }
    }
    return { docWide, wide, scrollWidth: document.documentElement.scrollWidth, innerWidth: width }
  })
  if (overflow.docWide) {
    findings.push(`${name}: H-OVERFLOW scrollWidth=${overflow.scrollWidth} vs ${overflow.innerWidth} — ${overflow.wide.join(' | ')}`)
  }
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true })
  console.log(`shot ${name}${overflow.docWide ? '  ** H-OVERFLOW **' : ''}`)
}

async function login(context, code) {
  const page = await context.newPage()
  await page.addInitScript(() => sessionStorage.setItem('ah-envelope-opened', '1'))
  await page.goto(`${BASE}/invite`)
  await page.getByLabel('Invite Code').fill(code)
  await page.getByRole('button', { name: 'Enter the celebration' }).click()
  await page.waitForURL(/dashboard|admin/, { timeout: 15000 })
  return page
}

const browser = await chromium.launch()

// ---- Guest pass ----
{
  const context = await browser.newContext({ ...devices['Pixel 5'] })
  const page = await login(context, 'DEMO-GUEST')
  for (const [path, name] of [
    ['/dashboard', 'guest-dashboard'],
    ['/rsvp', 'guest-rsvp'],
    ['/schedule', 'guest-schedule'],
    ['/blessings', 'guest-blessings'],
    ['/music', 'guest-music'],
    ['/gallery', 'guest-gallery'],
  ]) {
    await page.goto(BASE + path)
    await shoot(page, name)
  }
  // Feedback dialog open state
  await page.goto(`${BASE}/dashboard`)
  await page.getByRole('button', { name: /feedback/i }).click()
  await shoot(page, 'guest-feedback-dialog')
  // Envelope sealed state at mobile size
  const fresh = await context.newPage()
  await fresh.goto(`${BASE}/invite`)
  await shoot(fresh, 'guest-envelope-sealed')
  await context.close()
}

// ---- Admin pass ----
{
  const context = await browser.newContext({ ...devices['Pixel 5'] })
  const page = await login(context, 'DEMO-COORDINATOR')
  await shoot(page, 'admin-dashboard')
  const links = await page.evaluate(() =>
    Array.from(document.querySelectorAll('nav a, aside a'))
      .map((a) => ({ href: a.getAttribute('href'), text: (a.textContent || '').trim() }))
      .filter((l) => l.href && l.href.startsWith('/')),
  )
  const seen = new Set()
  for (const link of links) {
    if (seen.has(link.href)) continue
    seen.add(link.href)
    const name = 'admin-' + (link.text || link.href).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    await page.goto(BASE + link.href)
    await shoot(page, name)
  }
  await context.close()
}

await browser.close()
console.log('\n=== FINDINGS ===')
console.log(findings.length ? findings.join('\n') : 'no horizontal overflow detected')
