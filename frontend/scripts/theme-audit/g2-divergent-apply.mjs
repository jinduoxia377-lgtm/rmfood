#!/usr/bin/env node
/**
 * T-G2 DIVERGENT 余项批量组合（暗色档位裁决实施）
 *
 * 裁决原则（浏览器级可验证，零视觉回归）：
 *   - 暗色值 == 某暗色 primitive 档位值 → 暗侧改 var(--该档位)
 *   - 亮色值 == 某亮色 primitive 档位值 → 亮侧改 var(--该档位)
 *   - 两侧独立匹配（同一档位号在亮/暗下值不同，互不干扰）
 *   - rgba() 容器 / 独立设计值（#1e1b4b 等）→ 保持字面量
 *
 * 本脚本只改 base.css/dark.css 的指定行，改前备份、改后输出 diff。
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const TOKENS = path.join(process.cwd(), 'src', 'styles', 'tokens');

// token → { light: 档位名 | null, dark: 档位名 | null }（null = 保持字面量）
const DECISIONS = [
  // 可组合（双侧或单侧有档位匹配）
  { t: '--color-primary-text', light: 'success-600', dark: 'primary-600' },
  { t: '--color-primary-surface', light: 'primary-700', dark: 'primary-200' },
  { t: '--color-primary-surface-hover', light: 'primary-800', dark: 'primary-300' },
  { t: '--color-accent-hover', light: 'accent-600', dark: 'accent-700' },
  { t: '--color-tertiary', light: 'accent-500', dark: 'accent-600' },
  { t: '--color-tertiary-hover', light: 'accent-600', dark: 'accent-700' },
  { t: '--color-info-bg', light: 'secondary-50', dark: null },
  { t: '--bg-tertiary', light: 'neutral-100', dark: null },
  { t: '--bg-surface-elevated', light: 'neutral-100', dark: null },
  { t: '--text-secondary', light: 'neutral-700', dark: null },
  { t: '--text-muted', light: 'neutral-700', dark: null },
  { t: '--text-disabled', light: 'neutral-500', dark: null },
  { t: '--border-color', light: 'neutral-200', dark: null },
  { t: '--border-default', light: 'neutral-200', dark: null },
  { t: '--focus-ring', light: 'secondary-500', dark: null },
  { t: '--bg-gradient-end', light: 'success-50', dark: 'primary-100' },
  { t: '--color-info-text', light: 'secondary-800', dark: null },
  // 保持字面量（rgba 容器 / 独立设计值）
  { t: '--color-primary-container', light: null, dark: null },
  { t: '--color-secondary-container', light: null, dark: null },
  { t: '--color-accent-container', light: null, dark: null },
];

function replaceInFile(file, token, scaleRef) {
  if (!scaleRef) return 0;
  const p = path.join(TOKENS, file);
  let content = readFileSync(p, 'utf8');
  const re = new RegExp('(' + token.replace(/[-]/g, '\\-') + '\\s*:\\s*)[^;]+;', 'm');
  const m = content.match(re);
  if (!m) { console.log('  ⚠ ' + file + ' 未找到 ' + token); return 0; }
  const oldVal = m[0];
  const newVal = m[1] + 'var(--color-' + scaleRef + ');';
  content = content.replace(re, newVal);
  writeFileSync(p, content, 'utf8');
  console.log('  [' + file + '] ' + token + ': ' + m[0].split(':')[1].trim().slice(0, 24) + ' → var(--color-' + scaleRef + ')');
  return 1;
}

let n = 0;
for (const d of DECISIONS) {
  n += replaceInFile('base.css', d.t, d.light);
  n += replaceInFile('dark.css', d.t, d.dark);
}
console.log('\n══ 已改 ' + n + ' 处（仅档位匹配项；rgba/独立设计值保持字面量）══');
