#!/usr/bin/env node
/**
 * i18n-key-guard.mjs - 三语 key 一致性护栏
 *
 * 用 Vite SSR 真正加载语言模块再比对 key 集合，避免正则把字符串值误当 key。
 * 注意：每个语言必须用独立 Vite server 加载，否则 ssrLoadModule 的模块图缓存
 * 会让多次读取拿到同一引用，比对塌陷成"自己比自己"（实测出现 8704 条假阳性）。
 *
 * 用法:
 *   node scripts/i18n-key-guard.mjs         检查; 不一致 exit 1
 *   node scripts/i18n-key-guard.mjs --json  机器可读输出
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const LOCALES = ['zh-CN', 'en-US', 'de-DE']
const NAMESPACES = ['ai']

const asJson = process.argv.slice(2).includes('--json')

function flatten(input, prefix, out) {
  if (!input || typeof input !== 'object') return out
  for (const key of Object.keys(input)) {
    const full = prefix ? `${prefix}.${key}` : key
    out.add(full)
    const value = input[key]
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      flatten(value, full, out)
    }
  }
  return out
}

async function loadLocale(locale, namespace) {
  const { createServer } = await import('vite')
  const server = await createServer({
    root: ROOT,
    server: { middlewareMode: true },
    appType: 'custom',
    logLevel: 'error',
  })
  try {
    const file = path.join(ROOT, 'src', 'i18n', locale, `${namespace}.ts`)
    if (!fs.existsSync(file)) return null
    const mod = await server.ssrLoadModule(file)
    const exported = mod.default ?? mod
    return exported && exported[namespace] ? exported[namespace] : exported
  } finally {
    await server.close()
  }
}

async function main() {
  const diffs = []

  for (const namespace of NAMESPACES) {
    const byLocale = new Map()
    for (const locale of LOCALES) {
      const namespaceObject = await loadLocale(locale, namespace)
      if (namespaceObject) {
        byLocale.set(locale, flatten(namespaceObject, namespace, new Set()))
      }
    }

    const reference = LOCALES[0]
    const refKeys = byLocale.get(reference) || new Set()

    for (const locale of LOCALES.slice(1)) {
      const keys = byLocale.get(locale) || new Set()
      for (const key of refKeys) {
        if (!keys.has(key)) diffs.push({ namespace, locale, key, kind: 'missing' })
      }
      for (const key of keys) {
        if (!refKeys.has(key)) diffs.push({ namespace, locale: reference, key, kind: 'extra' })
      }
    }
  }

  if (asJson) {
    console.log(JSON.stringify({ total: diffs.length, diffs }, null, 2))
  } else if (diffs.length === 0) {
    console.log(`[i18n-key-guard] OK - ${LOCALES.join(' / ')} keys in sync`)
  } else {
    console.error(`[i18n-key-guard] FAIL - ${diffs.length} key(s) out of sync:`)
    for (const diff of diffs.slice(0, 200)) {
      console.error(`  ${diff.namespace}  ${diff.locale}  ${diff.kind}  ${diff.key}`)
    }
    console.error('\nFix: add the key to the other locale files.')
  }

  return diffs.length === 0 ? 0 : 1
}

const code = await main()
process.exit(code)
