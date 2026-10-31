/**
 * 轻量探针：仅测量知识图谱 SVG 画布背景色（亮/暗），
 * 使用 g.graph-container 的 ownerSVGElement 精确定位图谱 SVG。
 */
import { chromium } from '@playwright/test'

const BASE_URL = 'http://localhost:3000'
const browser = await chromium.launch()
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
const page = await context.newPage()

try {
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 90000 })
  await page.locator('#rhine-username').waitFor({ timeout: 30000 })
  await page.fill('#rhine-username', 'admin')
  await page.fill('#rhine-password', 'admin123')
  await page.click('button.rhine-submit-btn', { timeout: 20000 })
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 60000 })

  await page.goto(`${BASE_URL}/databases`, { waitUntil: 'domcontentloaded', timeout: 90000 })
  for (let i = 0; i < 3; i++) {
    try { await page.locator('button[role="tab"]').first().waitFor({ timeout: 30000 }); break }
    catch { await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {}) }
  }
  await page.locator('button[role="tab"]:has-text("知识图谱")').first().click({ timeout: 30000 })
  await page.waitForFunction(() => document.querySelectorAll('svg g.node-group').length > 0, { timeout: 60000 })
  await page.waitForTimeout(1200)

  async function measure() {
    return page.evaluate(() => {
      const g = document.querySelector('g.graph-container')
      const svg = g?.ownerSVGElement || null
      const style = svg?.getAttribute('style') || null
      const bg = svg ? getComputedStyle(svg).backgroundColor : null
      const rootBg = getComputedStyle(document.documentElement).getPropertyValue('--bg-secondary').trim()
      return { style, bg, rootBg }
    })
  }

  const light = await measure()
  console.log('LIGHT:', JSON.stringify(light))

  await page.evaluate(() => { document.documentElement.classList.add('dark') })
  await page.waitForTimeout(500)
  const dark = await measure()
  console.log('DARK:', JSON.stringify(dark))
} finally {
  await browser.close()
}