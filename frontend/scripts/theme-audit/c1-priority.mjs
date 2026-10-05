#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import path from 'node:path';

const SRC = path.join(process.cwd(), 'src');
// 剩余 warn 里的 hex（来自 c1 分布，排除已白名单的）
const REMAINING = [
  '#1a56db','#6d28d9','#e8e8e8','#adb5bd','#fafbfc','#16a34a','#fafafa',
  '#991b1b','#212529','#92400e','#dcfce7','#313244','#45475a','#ff4d4f',
  '#f0f0f0','#f5f5f4','#1a202c','#bbf7d0','#fef08a','#a6adc8','#edf2f7',
  '#4f46e5','#fbbf24','#f0fdf4','#1a73e8','#14b8a6','#0ea5e9','#1e1e1e',
  '#272822','#002b36','#ec4899','#11998e','#38ef7d','#14b8a6','#06b6d4',
  '#0ea5e9','#84cc16','#059669','#6366f1','#f59e0b',
];
const PRIORITY_FILES = [
  'styles/tokens/dark.css',
  'styles/components/nutrition-label.css',
  'components/ai/features/styles/chatTheme.css',
  'components/ai/features/styles/chatDesignSystem.ts',
  'components/ai/features/components/pro/MarkdownRenderer.tsx',
  'pages/landing/sections/Hero.tsx',
];

function walkDir(dir, out = []) {
  for (const e of require_readdirSync(dir)) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walkDir(full, out);
    else if (/\.(tsx?|css)$/.test(e.name)) out.push(full);
  }
  return out;
}
const { readdirSync } = await import('node:fs');
function require_readdirSync(d){ return readdirSync(d, { withFileTypes: true }); }

const files = walkDir(SRC);
for (const rel of PRIORITY_FILES) {
  const f = path.join(SRC, ...rel.split('/'));
  if (!files.includes(f)) { console.log('缺失 ' + rel); continue; }
  const lines = readFileSync(f, 'utf8').split('\n');
  const hits = [];
  lines.forEach((l, i) => {
    const t = l.trim();
    if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return;
    for (const hex of REMAINING) {
      if (l.toLowerCase().includes(hex)) {
        hits.push('L' + (i + 1) + ': ' + l.trim().slice(0, 100));
      }
    }
  });
  console.log('\n── ' + rel + '（' + hits.length + ' 处）──');
  hits.slice(0, 20).forEach(h => console.log('  ' + h));
}
