/* UX audit: screenshots + computed-style probe for /login */
const path = require('path')
const fs = require('fs')
const pc = require('D:/RMFOODFP/frontend/node_modules/.pnpm/playwright-core@1.61.1/node_modules/playwright-core')

const OUT = 'D:/RMFOODFP/frontend'
const HEADLESS_SHELL = 'C:\\Users\\Administrator\\.cache\\puppeteer\\chrome-headless-shell\\win64-154.0.8037.57\\chrome-headless-shell-win64\\chrome-headless-shell.exe'
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'

function pickExe() {
  if (fs.existsSync(HEADLESS_SHELL)) return HEADLESS_SHELL
  if (fs.existsSync(CHROME)) return CHROME
  return undefined
}

// prop names are valid JS identifiers, so a plain string expression is safe to evaluate in-page
const PROBE = {
  '.rhine-card-header h2': ['fontSize','fontWeight','lineHeight','letterSpacing','marginBottom'],
  '.rhine-card-header p': ['fontSize','color','marginTop','lineHeight'],
  '.rhine-form-group': ['marginBottom'],
  '.rhine-input': ['height','fontSize','paddingLeft','borderRadius','borderColor','backgroundColor','borderWidth'],
  '.rhine-label': ['fontSize','fontWeight','marginBottom','lineHeight'],
  '.rhine-submit-btn': ['height','fontSize','fontWeight','backgroundColor','color','borderRadius','boxShadow','marginTop','minHeight'],
  '.rhine-form-options': ['marginTop','marginBottom'],
  '.rhine-security-note': ['fontSize','marginTop','marginBottom','color'],
  '.rhine-footer': ['marginTop','paddingTop','borderTop','borderTopColor'],
  '.rhine-preregister': ['marginTop','paddingTop','borderTop','borderTopColor','marginBottom'],
  '.rhine-preregister-toggle': ['height','fontSize','backgroundColor','borderRadius','minHeight','borderColor','gap'],
  '.rhine-preregister-head': ['marginBottom','marginTop'],
  '.rhine-preregister-title': ['fontSize','lineHeight','fontWeight'],
  '.rhine-preregister-sub': ['fontSize','marginTop','color','lineHeight'],
  '.rhine-preregister-form .rhine-alert': ['marginBottom'],
  '.rhine-preregister-row': ['gap','marginBottom','gridTemplateColumns'],
  '.rhine-preregister-actions': ['gap','marginTop'],
  '.rhine-preregister-submit': ['height','width','backgroundColor','borderRadius','minHeight','fontSize'],
  '.rhine-preregister-cancel': ['height','width','border','backgroundColor','borderRadius','minHeight','fontSize'],
  '.rhine-brand-overlay': ['width','padding','top','left'],
  '.rhine-brand-logo': ['gap','marginBottom'],
  '.rhine-brand-name': ['fontSize','lineHeight','fontWeight'],
  '.rhine-brand-name-en': ['fontSize','marginTop'],
  '.rhine-brand-tagline': ['fontSize','maxWidth','lineHeight','marginTop'],
  '.rhine-form-panel': ['padding'],
  '.rhine-card': ['padding','borderRadius','border','borderWidth','boxShadow','maxWidth','width'],
}

function buildProbesFn(selector, props) {
  return () => {
    const el = document.querySelector(selector)
    if (!el) return { exists: false, selector }
    const cs = getComputedStyle(el)
    const r = el.getBoundingClientRect()
    const styles = {}
    for (const p of props) styles[p] = cs[p]
    return { exists: true, selector, rect: { x: Math.round(r.x*100)/100, y: Math.round(r.y*100)/100, w: Math.round(r.w !== undefined ? r.width : r.width, 100)/1, h: Math.round(r.height*100)/100 }, styles }
  }
}

// fix: keep simple
function probeInPage(selector, props) {
  const el = document.querySelector(selector)
  if (!el) return { exists: false, selector }
  const cs = getComputedStyle(el)
  const r = el.getBoundingClientRect()
  const styles = {}
  for (const p of props) styles[p] = cs[p]
  return {
    exists: true,
    selector,
    rect: { x: Math.round(r.x * 100) / 100, y: Math.round(r.y * 100) / 100, w: Math.round(r.width * 100) / 100, h: Math.round(r.height * 100) / 100 },
    styles,
  }
}

const CARD_GAP_SEQUENCE = [
  ['.rhine-card-header', 'header'],
  ['.rhine-card form .rhine-form-group:nth-of-type(1)', 'first-form-group'],
  ['.rhine-card form .rhine-form-group:nth-of-type(2)', 'second-form-group'],
  ['.rhine-form-options', 'options'],
  ['.rhine-submit-btn', 'submit'],
  ['.rhine-preregister', 'preregister'],
  ['.rhine-security-note', 'security-note'],
  ['.rhine-footer', 'footer'],
]

function gapsInPage(seq) {
  const els = seq.map(s => document.querySelector(s))
  const out = []
  for (let i = 0; i < els.length; i++) {
    const el = els[i]
    if (!el) { out.push({ seq: seq[i][1], missing: true }); continue }
    const r = el.getBoundingClientRect()
    out.push({ seq: seq[i][1], top: Math.round(r.top * 100) / 100, bottom: Math.round(r.bottom * 100) / 100, height: Math.round(r.height * 100) / 100 })
  }
  return out
}

async function main() {
  const exe = pickExe()
  console.log('using executable:', exe)
  const browser = await pc.chromium.launch({ executablePath: exe, headless: true })
  const results = {}

  const PROBE_LIST = Object.entries(PROBE)
  const PRE_REGISTER_PROBE = [
    ['.rhine-preregister-head', PROBE['.rhine-preregister-head']],
    ['.rhine-preregister-title', PROBE['.rhine-preregister-title']],
    ['.rhine-preregister-sub', PROBE['.rhine-preregister-sub']],
    ['.rhine-preregister-row', PROBE['.rhine-preregister-row']],
    ['.rhine-preregister-actions', PROBE['.rhine-preregister-actions']],
    ['.rhine-preregister-submit', PROBE['.rhine-preregister-submit']],
    ['.rhine-preregister-cancel', PROBE['.rhine-preregister-cancel']],
    ['.rhine-preregister-form .rhine-form-group', ['marginBottom','marginTop']],
    ['.rhine-preregister-form .rhine-label', ['marginBottom','fontSize']],
    ['.rhine-preregister-form .rhine-input', ['height','borderRadius']],
  ]
  const PRE_GAP_SEQ = [
    ['.rhine-preregister-head', 'preHead'],
    ['.rhine-preregister-form .rhine-form-group:nth-of-type(1)', 'preEmailGroup'],
    ['.rhine-preregister-row', 'preRow'],
    ['.rhine-preregister-actions', 'preActions'],
  ]

  async function shoot(name, width, height, mobile) {
    const context = await browser.newContext({
      viewport: { width, height },
      deviceScaleFactor: 1,
      isMobile: !!mobile,
      hasTouch: !!mobile,
      userAgent: mobile
        ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
        : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    })
    const page = await context.newPage()
    await page.goto('http://127.0.0.1:3000/login', { waitUntil: 'networkidle' })
    await page.waitForTimeout(3000)
    const filePath = path.join(OUT, name)
    await page.screenshot({ path: filePath, fullPage: true })
    console.log(`shot ${name} saved: ${filePath}`)

    if (name === 'ux-desktop-full.png') {
      // ---- collapsed-state probes ----
      const probes = {}
      for (const [sel, props] of PROBE_LIST) {
        probes[sel] = await page.evaluate(([s, p]) => {
          const el = document.querySelector(s)
          if (!el) return { exists: false, selector: s }
          const cs = getComputedStyle(el)
          const r = el.getBoundingClientRect()
          const styles = {}
          for (const pp of p) styles[pp] = cs[pp]
          return {
            exists: true,
            selector: s,
            rect: { x: Math.round(r.x * 100) / 100, y: Math.round(r.y * 100) / 100, w: Math.round(r.width * 100) / 100, h: Math.round(r.height * 100) / 100 },
            styles,
          }
        }, [sel, props])
      }

      // card vertical rhythm (collapsed pre-register)
      const cardBlocks = await page.evaluate(seq => {
        const out = []
        for (const [sel, label] of seq) {
          const el = document.querySelector(sel)
          if (!el) { out.push({ label, missing: true }); continue }
          const r = el.getBoundingClientRect()
          out.push({ label, top: Math.round(r.top * 100) / 100, bottom: Math.round(r.bottom * 100) / 100, height: Math.round(r.height * 100) / 100 })
        }
        return out
      }, CARD_GAP_SEQUENCE)

      // ---- expanded pre-register probes ----
      const toggle = page.locator('.rhine-preregister-toggle')
      const toggleExists = await toggle.count()
      let preExpanded = null
      if (toggleExists) {
        await toggle.click()
        await page.waitForTimeout(400)
        const preProbes = {}
        for (const [sel, props] of PRE_REGISTER_PROBE) {
          preProbes[sel] = await page.evaluate(([s, p]) => {
            const el = document.querySelector(s)
            if (!el) return { exists: false, selector: s }
            const cs = getComputedStyle(el)
            const r = el.getBoundingClientRect()
            const styles = {}
            for (const pp of p) styles[pp] = cs[pp]
            return {
              exists: true,
              selector: s,
              rect: { x: Math.round(r.x * 100) / 100, y: Math.round(r.y * 100) / 100, w: Math.round(r.width * 100) / 100, h: Math.round(r.height * 100) / 100 },
              styles,
            }
          }, [sel, props])
        }
        const preBlocks = await page.evaluate(seq => {
          const out = []
          for (const [sel, label] of seq) {
            const el = document.querySelector(sel)
            if (!el) { out.push({ label, missing: true }); continue }
            const r = el.getBoundingClientRect()
            out.push({ label, top: Math.round(r.top * 100) / 100, bottom: Math.round(r.bottom * 100) / 100, height: Math.round(r.height * 100) / 100 })
          }
          return out
        }, PRE_GAP_SEQ)
        await page.screenshot({ path: path.join(OUT, 'ux-desktop-prereg.png'), fullPage: true })
        console.log('shot ux-desktop-prereg.png saved (expanded pre-register)')
        preExpanded = { probes: preProbes, blocks: preBlocks }
      }

      results.probes = probes
      results.cardBlocks = cardBlocks
      results.preExpanded = preExpanded
      results.page = { url: page.url(), title: await page.title(), viewport: { width, height } }
    }

    await context.close()
  }

  await shoot('ux-desktop-full.png', 1440, 900, false)
  await shoot('ux-mobile-full.png', 390, 844, true)
  await shoot('ux-tablet-full.png', 834, 1112, false)

  fs.writeFileSync(path.join(OUT, 'ux-audit-probes.json'), JSON.stringify(results, null, 2))
  console.log('probes written to ux-audit-probes.json')
  await browser.close()
}

main().catch(e => { console.error(e); process.exit(1) })
