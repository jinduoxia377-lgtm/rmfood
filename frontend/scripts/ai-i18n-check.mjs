import puppeteer from 'puppeteer'

const sleep = (ms) => new Promise(r => setTimeout(r, ms))

const browser = await puppeteer.launch({
  headless: true,
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  protocolTimeout: 120000,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
})

const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 900 })
await page.setDefaultTimeout(30000)

const result = {}

try {
  // 登录
  await page.goto('http://localhost:3000/login', { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForSelector('#rhine-username', { timeout: 30000 })
  await page.type('#rhine-username', 'admin')
  await page.type('#rhine-password', 'admin123')
  await page.click('button[type="submit"]')
  // 等待跳转（最多 20s）
  let loggedIn = false
  for (let i = 0; i < 40; i++) {
    await sleep(500)
    const url = page.url()
    if (!url.includes('/login')) { loggedIn = true; break }
  }
  result.loggedIn = loggedIn
  result.urlAfterLogin = page.url()

  if (loggedIn) {
    await page.goto('http://localhost:3000/ai', { waitUntil: 'domcontentloaded', timeout: 60000 })
    try {
      await page.waitForFunction(() => {
        const h1 = document.querySelector('h1')
        return h1 && h1.textContent.length > 0
      }, { timeout: 30000 })
    } catch (e) { console.log('wait h1 timeout:', e.message) }
    await sleep(5000)

    result.zh = await page.evaluate(() => {
      const main = document.querySelector('main')
      return {
        url: location.href,
        lang: document.documentElement.lang,
        storedLang: localStorage.getItem('rmfood-language'),
        h1: document.querySelector('h1')?.textContent?.trim() ?? '',
        mainText: main ? main.innerText.slice(0, 6000) : '',
        bodyText: document.body.innerText.slice(0, 2000),
      }
    })

    // 切换英文
    await page.evaluate(() => {
      localStorage.setItem('rmfood-language', 'en-US')
    })
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 })
    try {
      await page.waitForFunction(() => {
        const h1 = document.querySelector('h1')
        return h1 && h1.textContent.length > 0
      }, { timeout: 30000 })
    } catch (e) { console.log('wait h1 timeout (en):', e.message) }
    await sleep(5000)

    result.en = await page.evaluate(() => {
      const main = document.querySelector('main')
      return {
        url: location.href,
        lang: document.documentElement.lang,
        storedLang: localStorage.getItem('rmfood-language'),
        h1: document.querySelector('h1')?.textContent?.trim() ?? '',
        mainText: main ? main.innerText.slice(0, 6000) : '',
        bodyText: document.body.innerText.slice(0, 2000),
      }
    })
  }

  console.log(JSON.stringify(result, null, 2))
} catch (err) {
  console.error('ERROR:', err && err.stack ? err.stack : err)
} finally {
  await browser.close()
}