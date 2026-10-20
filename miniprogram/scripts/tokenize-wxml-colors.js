#!/usr/bin/env node
/**
 * WXML 组件色属性令牌化（一次性迁移）
 * - <icon> 等自定义组件：color="#hex" → color="var(--color-*)"（由 resolveTokenColor 解析）
 * - <switch> 等原生组件：color 属性不支持 CSS 变量，改为品牌绿 #047857（跟随新品牌）
 *
 * 用法：node scripts/tokenize-wxml-colors.js
 */
const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '..')
const DIRS = ['pages', 'packages', 'components']

// 自定义组件色属性映射（Icon 组件经 resolveTokenColor 解析 var()）
const ICON_MAP = {
  '#FFFFFF': 'var(--color-text-white)',
  '#CCCCCC': 'var(--color-text-disabled)',
  '#2D5A3D': 'var(--color-primary)',
  '#666666': 'var(--color-text-tertiary)',
  '#007AFF': 'var(--color-system-blue)',
  '#8E8E93': 'var(--color-text-muted)',
  '#999999': 'var(--color-text-muted)',
  '#EF4444': 'var(--color-danger-text)',
  '#9CA3AF': 'var(--color-text-muted)',
  '#FF3B30': 'var(--color-system-red)',
  '#1565C0': 'var(--color-accent-600)',
  '#1976D2': 'var(--color-accent)',
  '#7B1FA2': 'var(--color-accent-600)',
  '#E65100': 'var(--color-warning-text)',
  '#C62828': 'var(--color-danger-text)',
}

// 原生组件品牌色（switch/checkbox 等不支持 CSS 变量，用新品牌绿）
const NATIVE_BRAND = '#047857'

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else if (/\.wxml$/.test(e.name)) out.push(p)
  }
  return out
}

let iconCount = 0
let nativeCount = 0

for (const dir of DIRS) {
  for (const file of walk(path.join(ROOT, dir))) {
    const src = fs.readFileSync(file, 'utf8')
    const lines = src.split('\n')
    let changed = false
    const outLines = lines.map((line) => {
      // 原生组件（switch/checkbox/radio/slider）：品牌色属性改 hex
      if (/<(switch|checkbox|radio|slider)\b/.test(line)) {
        const replaced = line.replace(
          /\b(color|activeColor)="(#[0-9a-fA-F]{3,8})"/g,
          (m, attr, hex) => {
            if (attr === 'color' && /^#2D5A3D$/i.test(hex)) {
              changed = true
              nativeCount++
              return `color="${NATIVE_BRAND}"`
            }
            return m
          }
        )
        return replaced
      }
      // 自定义组件：hex → var()
      const replaced = line.replace(
        /\bcolor="(#[0-9a-fA-F]{3,8})"/g,
        (m, hex) => {
          const up = hex.toUpperCase()
          const token = ICON_MAP[up]
          if (!token) return m
          changed = true
          iconCount++
          return `color="${token}"`
        }
      )
      return replaced
    })
    if (changed) {
      fs.writeFileSync(file, outLines.join('\n'), 'utf8')
      console.log(`  ${path.relative(ROOT, file).replace(/\\/g, '/')}`)
    }
  }
}

console.log(`\nWXML 颜色令牌化完成：icon 组件 ${iconCount} 处 / 原生组件 ${nativeCount} 处`)  // eslint-disable-line no-console