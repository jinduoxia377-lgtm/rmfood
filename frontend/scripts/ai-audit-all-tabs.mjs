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

const result = { tabs: {} }

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

  await page.evaluate(() => localStorage.setItem('rmfood-language', 'en-US'))
  await page.goto('http://localhost:3000/ai', { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForFunction(() => document.querySelector('h1')?.textContent?.length > 0, { timeout: 30000 })
  await sleep(5000)

  const tabs = [
    ['chat', /Smart Chat|智能对话/],
    ['generate', /Formula Generation|配方生成/],
    ['safety', /Safety Check|安全检查/],
    ['synergy', /Synergy Analysis|协同分析/],
    ['taste', /Taste Prediction|口感预测/],
    ['stability', /Stability Assessment|稳定性评估/],
    ['genetic', /Genetic Optimization|遗传优化/],
    ['peptide-analyze', /Peptide Sequence Analysis|肽序列分析/],
    ['peptide-design', /Peptide Design Optimization|肽设计优化/],
    ['knowledge', /Knowledge Base|知识库/],
    ['config', /Config Management|配置管理/],
  ]

  for (const [key, re] of tabs) {
    const clicked = await page.evaluate((reSrc) => {
      const re = new RegExp(reSrc)
      const btns = Array.from(document.querySelectorAll('[role="tab"], nav button, aside button'))
      const btn = btns.find(b => re.test(b.textContent || ''))
      if (btn) { btn.click(); return true }
      return false
    }, re.source)
    await sleep(4500)
    result.tabs[key] = await page.evaluate((clicked) => ({
      clicked,
      text: (document.querySelector('main')?.innerText ?? '').slice(0, 2600),
    }), clicked)
  }

  console.log(JSON.stringify(result, null, 2))
} catch (err) {
  console.error('ERROR:', err && err.stack ? err.stack : err)
  process.exitCode = 1
} finally {
  await browser.close()
}