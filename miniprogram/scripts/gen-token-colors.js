#!/usr/bin/env node
/**
 * 设计令牌 → 真实色值映射生成器
 *
 * 读取 design-tokens.wxss（亮色）与 dark-mode.wxss（暗色），
 * 解析全部 --color-* / --bg-* / --text-* / --primary / --gradient-* 变量定义，
 * 展开 var() 引用后生成 utils/token_colors.js 的 LIGHT / DARK 两表。
 *
 * 背景：小程序 WXML 不支持内联 <svg>，Icon 组件用 <image>+base64 SVG，
 *       SVG 无法继承 CSS 变量，故需在 JS 侧把 var(--token) 解析为真实色值。
 *       本脚本保证 JS 表与 wxss 定义始终一致（此前 token_colors.js 为手工旧表，
 *       深色值停留在 GitHub 风格 #0D1117/#161B22，与 Apple HIG 页面脱节）。
 *
 * 用法：node scripts/gen-token-colors.js
 * 输出：utils/token_colors.js（自动生成，请勿手改）
 */
const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '..')
const LIGHT_WXSS = path.join(ROOT, 'design-tokens.wxss')
const DARK_WXSS = path.join(ROOT, 'dark-mode.wxss')
const OUT = path.join(ROOT, 'utils', 'token_colors.js')

/** 提取 CSS 变量定义 --name: value; */
function extractVars(src) {
  const vars = {}
  const re = /(--[a-zA-Z0-9-]+)\s*:\s*([^;]+);/g
  let m
  while ((m = re.exec(src))) vars[m[1].trim()] = m[2].trim()
  return vars
}

/** 展开 var() 引用（支持 var(--x) 与 var(--x, fallback)），循环引用时回退 */
function resolve(value, vars, seen = new Set()) {
  if (!value) return value
  const v = String(value).trim()
  const m = /^var\(\s*(--[a-zA-Z0-9-]+)\s*(?:,\s*([^)]+))?\)$/.exec(v)
  if (!m) return v
  const name = m[1]
  if (seen.has(name)) return m[2] ? m[2].trim() : v
  seen.add(name)
  if (name in vars) return resolve(vars[name], vars, seen)
  return m[2] ? m[2].trim() : v
}

/**
 * JS-only 令牌：Icon 组件专用、wxss 未必定义的派生色。
 * 品牌相关随 design-tokens 的 --color-brand-* / --color-accent 联动。
 */
function deriveJsOnly(lightVars, darkVars) {
  const l = (n) => resolve(lightVars[n] || '', lightVars) || undefined
  const d = (n) => resolve(darkVars[n] || '', darkVars) || undefined
  const brand500L = l('--color-brand-500') || '#10B981'
  const brand700L = l('--color-brand-700') || '#047857'
  const brand500D = d('--color-brand-500') || '#34D399'
  const accentL = l('--color-accent') || '#6D28D9'
  const accentD = d('--color-accent') || '#A78BFA'
  return {
    '--gradient-brand': { light: brand500L, dark: brand500D },
    '--gradient-accent': { light: accentL, dark: accentD },
    '--gradient-danger': { light: '#D32F2F', dark: '#D32F2F' },
    '--gradient-purple': { light: '#AF52DE', dark: '#BF5AF2' },
    '--color-brand-solid': { light: brand700L, dark: brand500D },
    '--color-primary-solid': { light: brand700L, dark: brand500D },
    '--color-danger-solid': { light: '#D32F2F', dark: '#D32F2F' },
    '--color-success-solid': { light: '#248059', dark: '#248059' },
    '--color-warning-solid': { light: '#C2410C', dark: '#C2410C' },
    '--color-score-bad-solid': { light: '#C62828', dark: '#C62828' },
    '--color-score-bad-text': { light: '#C62828', dark: '#F87171' },
    '--color-score-excellent-solid': { light: '#15803D', dark: '#15803D' },
    '--color-score-excellent-text': { light: '#0F6B33', dark: '#4ADE80' },
    '--color-score-fair-solid': { light: '#A16207', dark: '#A16207' },
    '--color-score-fair-text': { light: '#8A5305', dark: '#FACC15' },
    '--color-score-good-solid': { light: '#4D7C0F', dark: '#4D7C0F' },
    '--color-score-good-text': { light: '#3F6609', dark: '#A3E635' },
    '--color-score-poor-solid': { light: '#C2410C', dark: '#C2410C' },
    '--color-score-poor-text': { light: '#C2410C', dark: '#FB923C' },
    '--color-purple-600': { light: '#7B1FA2', dark: '#7B1FA2' },
  }
}

// ── 读取并解析 ──
const lightVars = extractVars(fs.readFileSync(LIGHT_WXSS, 'utf8'))
const darkRaw = extractVars(fs.readFileSync(DARK_WXSS, 'utf8'))
const darkVars = { ...lightVars, ...darkRaw } // 暗色 = 亮色基座 + 暗色覆盖

// 键集：wxss 定义的颜色类令牌 + 派生 JS-only 令牌
const jsOnly = deriveJsOnly(lightVars, darkVars)
const COLOR_KEY_RE = /^--(color|bg|text|border|primary|gradient|shadow-brand)/i
const keys = new Set([
  ...Object.keys(lightVars).filter((k) => COLOR_KEY_RE.test(k)),
  ...Object.keys(jsOnly),
])

const LIGHT = {}
const DARK = {}
for (const k of keys) {
  if (jsOnly[k]) {
    LIGHT[k] = jsOnly[k].light
    DARK[k] = jsOnly[k].dark
    continue
  }
  const lv = lightVars[k]
  const dv = darkVars[k]
  if (lv) LIGHT[k] = resolve(lv, lightVars)
  if (dv) DARK[k] = resolve(dv, darkVars)
  else if (lv) DARK[k] = resolve(lv, darkVars) // 暗色未覆盖则沿用亮色解析
}

// 排序输出（保持可读性）
const sortedLight = Object.fromEntries(Object.keys(LIGHT).sort().map((k) => [k, LIGHT[k]]))
const sortedDark = Object.fromEntries(Object.keys(DARK).sort().map((k) => [k, DARK[k]]))

const banner = `/**
 * 设计令牌 → 真实色值映射（由 scripts/gen-token-colors.js 自动生成，请勿手改）
 *
 * 背景：小程序 WXML 不支持内联 <svg>，Icon 组件改用 <image> + base64 data URI。
 *       <image> 内的 SVG 无法继承外部 CSS 变量，故需在 JS 侧把 var(--token) 解析为色值。
 *
 * 用法：resolveTokenColor('var(--color-brand-solid)', isDark)
 */
`

const out = `${banner}const LIGHT = ${JSON.stringify(sortedLight, null, 2)}

const DARK = ${JSON.stringify(sortedDark, null, 2)}

/**
 * 解析颜色：支持 #hex 直接返回，支持 var(--token) 查表。
 * @param {string} color  形如 '#2D5A3D' 或 'var(--color-brand-solid)'
 * @param {boolean} isDark 当前是否深色主题
 * @param {string} fallback 解析失败时的兜底色
 */
function resolveTokenColor(color, isDark, fallback) {
  const fb = fallback || (isDark ? '#FFFFFF' : '#333333')
  if (!color) return fb
  const c = String(color).trim()
  if (/^#[0-9a-fA-F]{3,8}$/.test(c)) return c
  const m = /^var\\(\\s*(--[A-Za-z0-9_-]+)\\s*(?:,\\s*(#[0-9a-fA-F]{3,8})\\s*)?\\)$/.exec(c)
  if (!m) return /^[a-z]+$/i.test(c) ? c : fb
  const table = isDark ? DARK : LIGHT
  return table[m[1]] || m[2] || fb
}

module.exports = { LIGHT, DARK, resolveTokenColor }
`

fs.writeFileSync(OUT, out, 'utf8')

// 自校验：解析出的 JS 文件可加载且 resolveTokenColor 对品牌色命中预期
const gen = require(OUT)
const checks = [
  ['--color-primary', 'light', '#047857'],
  ['--color-primary', 'dark', '#34D399'],
  ['--color-bg-page', 'dark', '#1C1C1E'],
  ['--color-bg-card', 'dark', '#2C2C2E'],
  ['--color-text-primary', 'light', '#1D1D1F'],
]
let ok = true
for (const [key, mode, expect] of checks) {
  const got = gen.resolveTokenColor(`var(${key})`, mode === 'dark')
  const pass = String(got).toLowerCase() === expect.toLowerCase()
  if (!pass) ok = false
  console.log(`${pass ? '✅' : '❌'} ${mode} ${key} = ${got}（期望 ${expect}）`)
}
console.log(`\n已生成 ${OUT}`)
console.log(`亮色表 ${Object.keys(gen.LIGHT).length} 个 / 暗色表 ${Object.keys(gen.DARK).length} 个令牌`)
process.exit(ok ? 0 : 1)