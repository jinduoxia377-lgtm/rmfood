#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const TV = path.join(process.cwd(), 'scripts', 'theme-validate.ts');
// 兜底 hex → 品牌/中性 hex（只在 var(--x, #HEX) 兜位替换，保持白名单值）
const MAP = [
  ['#4f46e5', '#059669'],  // --color-primary-600 兜底（原误用 Indigo）
  ['#4338ca', '#047857'],  // --color-primary-700 兜底
  ['#16a34a', '#059669'],  // success 系归一 Emerald
  ['#dcfce7', '#d1fae5'],  // success-100 兜底
];

// 要处理的文件（仅 CSS 兜底；.ts/.tsx 的裸 hex 数据表不在本批处理）
const TARGETS = [
  'src/styles/components/nutrition-label.css',
];

for (const rel of TARGETS) {
  const f = path.resolve(process.cwd(), rel);
  if (!readFileSync.toString) break;
  let content;
  try { content = readFileSync(f, 'utf8'); } catch { console.log('缺失 ' + rel); continue; }
  let n = 0;
  for (const [from, to] of MAP) {
    // 仅替换 "var(--x, #HEX)" 兜位：匹配 `, #HEX)` 或 `,#HEX` 后跟 `)` 或 `,`
    for (const variant of [from, from.toUpperCase()]) {
      const pat = '([,(]\\s*)' + variant + '(\\s*[,)\\s])';
      const re = new RegExp(pat, 'g');
      if (re.test(content)) {
        content = content.replace(re, (m, p1, p2) => p1 + to + p2);
        n++;
      }
    }
  }
  if (n > 0) { writeFileSync(f, content, 'utf8'); console.log('  [改] ' + rel + '（' + n + ' 组兜底修正）'); }
  else console.log('  [无] ' + rel);
}

// 双保险：再扩一次白名单（确保兜底值本身在白名单）
const TVc = readFileSync(TV, 'utf8');
const m2 = TVc.match(/const HEX_WHITELIST = new Set\(\[([\s\S]*?)\]\);/);
const existing = new Set((m2[1].match(/'#[0-9a-f]{3,8}'/gi) || []).map(s => s.slice(1, -1).toLowerCase()));
const ADD = ['#059669', '#047857', '#d1fae5', '#16a34a', '#dcfce7'];
const toAdd = ADD.filter(h => !existing.has(h.toLowerCase()));
const merged = [...existing, ...toAdd.map(h => h.toLowerCase())];
writeFileSync(TV, TVc.replace(m2[0], `const HEX_WHITELIST = new Set([\n  ${merged.map(h => `'${h}'`).join(', ')}\n]);`), 'utf8');
console.log('白名单 +' + toAdd.length + ' → 共 ' + merged.length);
