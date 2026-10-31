import puppeteer from 'puppeteer'
import fs from 'node:fs'

const sleep = (ms) => new Promise(r => setTimeout(r, ms))
const OUT_DIR = 'D:/RMFOODFP/reports/ai-i18n'
fs.mkdirSync(OUT_DIR, { recursive: true })

const browser = await puppeteer.launch({
  headless: true,
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  protocolTimeout: 120000,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
})

const page = await browser.newPage()
await page.setViewport({ width: 1600, height: 1000 })
await page.setDefaultTimeout(30000)

try {
  await page.goto('http://localhost:3000/login', { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForSelector('#rhine-username', { timeout: 30000 })
  await page.type('#rhine-username', 'admin')
  await page.type('#rhine-password', 'admin123')
  await page.click('button[type="submit"]')
  let loggedIn = false
  for (let i = 0; i < 40; i++) {
    await sleep(500)
    if (!page.url().includes('/login')) { loggedIn = true; break }
  }
  if (!loggedIn) throw new Error('login failed')

  await page.goto('http://localhost:3000/ai', { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForFunction(() => {
    const h1 = document.querySelector('h1')
    return h1 && h1.textContent.length > 0
  }, { timeout: 30000 })
  await sleep(6000)
  await page.screenshot({ path: `${OUT_DIR}/ai-zh-CN.png`, fullPage: false })

  await page.evaluate(() => localStorage.setItem('rmfood-language', 'en-US'))
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForFunction(() => {
    const h1 = document.querySelector('h1')
    return h1 && h1.textContent.length > 0
  }, { timeout: 30000 })
  await sleep(6000)
  await page.screenshot({ path: `${OUT_DIR}/ai-en-US.png`, fullPage: false })

  console.log('screenshots saved to ' + OUT_DIR)
} catch (err) {
  console.error('ERROR:', err && err.stack ? err.stack : err)
  process.exitCode = 1
} finally {
  await browser.close()
}