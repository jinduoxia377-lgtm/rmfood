import puppeteer from 'puppeteer'

const sleep = (ms) => new Promise(r => setTimeout(r, ms))

const browser = await puppeteer.launch({
  headless: true,
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  protocolTimeout: 120000,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
})

const page = await browser.newPage()
await page.setViewport({ width: 1600, height: 1000 })
await page.setDefaultTimeout(30000)

const result = {}

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

  // 切英文
  await page.evaluate(() => localStorage.setItem('rmfood-language', 'en-US'))

  await page.goto('http://localhost:3000/ai', { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForFunction(() => document.querySelector('h1')?.textContent?.length > 0, { timeout: 30000 })
  await sleep(5000)

  result.enChat = await page.evaluate(() => ({
    lang: document.documentElement.lang,
    h1: document.querySelector('h1')?.textContent?.trim() ?? '',
    mainText: (document.querySelector('main')?.innerText ?? '').slice(0, 3000),
  }))

  // 点击“配方生成”Tab（en 模式下为 Formula Generation）
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('[role="tab"]'))
    const target = buttons.find(b => /Formula Generation|配方生成/.test(b.textContent || ''))
    target?.click()
  })
  await sleep(6000)

  result.enGenerate = await page.evaluate(() => ({
    mainText: (document.querySelector('main')?.innerText ?? '').slice(0, 2500),
  }))

  console.log(JSON.stringify(result, null, 2))
} catch (err) {
  console.error('ERROR:', err && err.stack ? err.stack : err)
  process.exitCode = 1
} finally {
  await browser.close()
}