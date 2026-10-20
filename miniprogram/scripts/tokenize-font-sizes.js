#!/usr/bin/env node
/**
 * 字号令牌化批量替换脚本（一次性迁移）
 * 将 pages/packages/components 下所有 wxss 中的硬编码 font-size: Nrpx
 * 替换为 var(--font-size-*) 令牌。只处理不含 var( 的行，避免破坏已有令牌用法。
 *
 * 用法：node scripts/tokenize-font-sizes.js
 */
const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '..')
const DIRS = ['pages', 'packages', 'components']

const MAP = {
  16: 'var(--font-size-micro-legal)',
  18: 'var(--font-size-fine-print)',
  20: 'var(--font-size-fine-print)',
  22: 'var(--font-size-caption)',
  24: 'var(--font-size-caption)',
  26: 'var(--font-size-callout)',
  28: 'var(--font-size-body)',
  30: 'var(--font-size-subtitle)',
  32: 'var(--font-size-title-3)',
  34: 'var(--font-size-title-3)',
  36: 'var(--font-size-title-2)',
  40: 'var(--font-size-title-1)',
  44: 'var(--font-size-2xl)',
  48: 'var(--font-size-large-title)',
  52: 'var(--font-size-3xl)',
  56: 'var(--font-size-display)',
  64: 'var(--font-size-stat)',
  80: 'var(--font-size-hero)',
  96: 'var(--font-size-hero-xl)',
  120: 'var(--font-size-hero-2xl)',
}

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else if (/\.wxss$/.test(e.name)) out.push(p)
  }
  return out
}

const RE = /font-size:\s*(\d+(?:\.\d+)?)rpx/g
let total = 0
const perFile = {}

for (const dir of DIRS) {
  for (const file of walk(path.join(ROOT, dir))) {
    const src = fs.readFileSync(file, 'utf8')
    const lines = src.split('\n')
    let count = 0
    const outLines = lines.map((line) => {
      if (line.includes('var(')) return line
      return line.replace(RE, (match, sizeStr) => {
        const size = Math.round(Number(sizeStr))
        const token = MAP[size]
        if (!token) return match
        count++
        return `font-size: ${token}`
      })
    })
    if (count > 0) {
      fs.writeFileSync(file, outLines.join('\n'), 'utf8')
      const rel = path.relative(ROOT, file).replace(/\\/g, '/')
      perFile[rel] = count
      total += count
    }
  }
}

console.log(`字号令牌化完成：共 ${total} 处替换`)
for (const [f, n] of Object.entries(perFile).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${f}: ${n} 处`)
}