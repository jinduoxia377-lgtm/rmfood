/**
 * KG 主题规范修复回归验证脚本（尽力而为版，best-effort）
 * 静态验证已通过（tsc 0 错误 / vitest 10-10）。
 * 浏览器验证：若后端不可用则跳过图谱数据断言，仅验证前端 HTML 可加载。
 * 截图输出：D:\RMFOODFP\screenshots\kg-regression\
 */
import { chromium } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const BASE_URL = 'http://localhost:3000'
const SCREENSHOT_DIR = 'D:\\RMFOODFP\\screenshots\\kg-regression'
const VIEWPORT = { width: 1440, height: 1000 }

fs.mkdirSync(SCREENSHOT_DIR, { recursive: true })

const results = []
const consoleErrors = []
const pageErrors = []

function record(name, pass, detail = '') {
  results.push({ name, pass, detail })
  console.log(`${pass ? 'PASS' : 'FAIL'} | ${name}${detail ? ' | ' + detail : ''}`)
}

const browser = await chromium.launch()
const context = await browser.newContext({ viewport: VIEWPORT })
const page = await context.newPage()

page.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push(`[console.error] ${msg.text()}`)
})
page.on('pageerror', (err) => {
  pageErrors.push(`[pageerror] ${err.message}`)
})

try {
  // 0. 前端 HTML 可加载（不依赖后端）
  const resp = await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 45000 })
  record('前端 :3000 可加载 (login 页面)', resp !== null && resp.status() < 500, `HTTP ${resp?.status()}`)
  const hasUsername = await page.locator('#rhine-username').count().catch(() => 0)
  record('login 页面渲染出 #rhine-username', hasUsername > 0)
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '00-frontend-login-loaded.png') }).catch(() => {})

  // 1. 登录（尽力而为）
  let loggedIn = false
  try {
    await page.fill('#rhine-username', 'admin', { timeout: 15000 })
    await page.fill('#rhine-password', 'admin123', { timeout: 15000 })
    await page.click('button.rhine-submit-btn', { timeout: 15000 })
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 45000 })
    loggedIn = true
    record('登录成功', true)
  } catch (e) {
    record('登录成功', false, `登录流程失败：${String(e).split('\n')[0]}`)
  }

  if (!loggedIn) {
    record('后端可用性', false, '登录 API 无响应（后端不可用/资源饥饿），跳过图谱数据断言')
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '99-login-failed.png') }).catch(() => {})
  } else {
    record('后端可用性', true, '登录 API 响应正常')

    // 2. 进入 /databases 知识图谱 tab（高负载下 Vite 慢，带重试）
    await page.goto(`${BASE_URL}/databases`, { waitUntil: 'domcontentloaded', timeout: 90000 })
    let tabReady = false
    for (let i = 0; i < 3 && !tabReady; i++) {
      try {
        await page.locator('button[role="tab"]').first().waitFor({ timeout: 30000 })
        tabReady = true
      } catch {
        await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {})
      }
    }
    record('/databases 页面 tab 栏就绪', tabReady)
    const kgTab = page.locator('button[role="tab"]:has-text("知识图谱")').first()
    await kgTab.click({ timeout: 30000 })

    let rendered = false
    try {
      await page.waitForFunction(() => document.querySelectorAll('svg g.node-group').length > 0, { timeout: 60000 })
      rendered = true
    } catch {
      rendered = false
    }
    record('图谱节点渲染 (node-group > 0)', rendered)
    if (rendered) {
      await page.waitForSelector('svg g.graph-container text.node-label', { timeout: 15000 }).catch(() => {})
      await page.waitForTimeout(1500)
      const nodeGroupCount = await page.locator('svg g.node-group').count()
      record('node-group 数量', nodeGroupCount > 0, `count=${nodeGroupCount}`)
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01-databases-graph-loaded.png') }).catch(() => {})

      // 3. 亮色模式
      const light = await page.evaluate(() => {
        const label = document.querySelector('svg g.graph-container text.node-label')
        const bg = document.querySelector('svg g.graph-container rect.label-bg')
        const graphSvg = document.querySelector('g.graph-container')?.ownerSVGElement || null
        const cs = (el) => el ? getComputedStyle(el) : null
        return { labelFill: label ? cs(label).fill : null, bgFill: bg ? cs(bg).fill : null, svgBg: graphSvg ? cs(graphSvg).backgroundColor : null }
      })
      record('亮色: node-label fill 为深色', !!light.labelFill && light.labelFill !== 'rgb(255, 255, 255)' && light.labelFill !== 'transparent', `fill=${light.labelFill}`)
      record('亮色: label-bg fill 为白色', light.bgFill === 'rgb(255, 255, 255)', `fill=${light.bgFill}`)
      record('亮色: svg backgroundColor 为白色', light.svgBg === 'rgb(255, 255, 255)', `bg=${light.svgBg}`)
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02-light-mode-graph.png') }).catch(() => {})

      // 4. 暗色模式
      await page.evaluate(() => { document.documentElement.classList.add('dark') })
      await page.waitForTimeout(500)
      const dark = await page.evaluate(() => {
        const label = document.querySelector('svg g.graph-container text.node-label')
        const bg = document.querySelector('svg g.graph-container rect.label-bg')
        const graphSvg = document.querySelector('g.graph-container')?.ownerSVGElement || null
        const cs = (el) => el ? getComputedStyle(el) : null
        return { labelFill: label ? cs(label).fill : null, bgFill: bg ? cs(bg).fill : null, svgBg: graphSvg ? cs(graphSvg).backgroundColor : null }
      })
      record('暗色: node-label fill = rgb(241,245,249)', dark.labelFill === 'rgb(241, 245, 249)', `fill=${dark.labelFill}`)
      record('暗色: label-bg fill = rgb(15,23,42)', dark.bgFill === 'rgb(15, 23, 42)', `fill=${dark.bgFill}`)
      record('暗色: svg backgroundColor 为深色', !!dark.svgBg && dark.svgBg !== 'rgb(255, 255, 255)', `bg=${dark.svgBg}`)
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03-dark-mode-graph.png') }).catch(() => {})

      // 5. 图例按钮
      const legendBtn = page.locator('button:has-text("图例")').first()
      const legendVisible = await legendBtn.isVisible().catch(() => false)
      record('图例按钮可见', legendVisible)
      if (legendVisible) {
        await legendBtn.click({ timeout: 10000 })
        const expanded = await page.locator('text=节点类型分布').count().catch(() => 0)
        record('点击图例后展开「节点类型分布」', expanded > 0, `匹配=${expanded}`)
      } else {
        record('点击图例后展开「节点类型分布」', false, '图例按钮不可见')
      }
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04-legend-open.png') }).catch(() => {})

      // 6. prefers-reduced-motion: reduce（保留登录态，直接 reload）
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 90000 })
      let rmTabReady = false
      for (let i = 0; i < 3 && !rmTabReady; i++) {
        try {
          await page.locator('button[role="tab"]').first().waitFor({ timeout: 30000 })
          rmTabReady = true
        } catch {
          await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {})
        }
      }
      record('reduced-motion reload 后 tab 栏就绪', rmTabReady)
      const kgTab2 = page.locator('button[role="tab"]:has-text("知识图谱")').first()
      await kgTab2.click({ timeout: 30000 })
      let rmRendered = false
      try {
        await page.waitForFunction(() => document.querySelectorAll('svg g.node-group').length > 0, { timeout: 60000 })
        rmRendered = true
      } catch { rmRendered = false }
      record('reduced-motion 下图谱仍渲染 (node-group > 0)', rmRendered)
      if (rmRendered) {
        const rmCount = await page.locator('svg g.node-group').count()
        record('reduced-motion node-group 数量', rmCount > 0, `count=${rmCount}`)
        await page.waitForTimeout(800)
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, '05-reduced-motion-graph.png') }).catch(() => {})
      }
    } else {
      record('后端可用性（图谱数据）', false, '图谱 API 未返回数据（后端不可用/资源饥饿），跳过颜色与图例断言')
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '99-graph-not-rendered.png') }).catch(() => {})
    }
  }

  record('页面无 console error', consoleErrors.length === 0, consoleErrors.length ? consoleErrors.join(' || ') : '0 条')
  record('页面无 pageerror', pageErrors.length === 0, pageErrors.length ? pageErrors.join(' || ') : '0 条')
} catch (err) {
  record('脚本执行', false, String(err).split('\n')[0])
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '99-error.png') }).catch(() => {})
} finally {
  await browser.close()
}

const output = { results, consoleErrors, pageErrors, screenshotDir: SCREENSHOT_DIR }
fs.writeFileSync(path.join(SCREENSHOT_DIR, 'kg-regression-results.json'), JSON.stringify(output, null, 2))
console.log('RESULTS_JSON=' + JSON.stringify(output))