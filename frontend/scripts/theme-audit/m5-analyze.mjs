#!/usr/bin/env node
/**
 * M5 禁用色债务清理 —— 前期分析
 * 从源码提取禁用色（Apple 系统色 + 旧品牌主色）的每处「文件:行:上下文」，
 * 输出按文件分组的清理清单，供批量替换。
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const FE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SRC = path.join(FE, 'src');

// 与 theme-validate.ts 保持一致的禁用色表
const FORBIDDEN = [
  { hex: '#34c759', to: 'var(--color-primary-400)', note: 'Apple 绿→品牌浅档' },
  { hex: '#007aff', to: 'var(--color-secondary-500)', note: 'Apple 蓝→辅色' },
  { hex: '#af52de', to: 'var(--color-accent-500)', note: 'Apple 紫→强调色' },
  { hex: '#1c1c1e', to: 'var(--bg-surface-container)', note: 'Apple 暗面' },
  { hex: '#2c2c2e', to: 'var(--bg-surface-raised)', note: 'Apple 暗面' },
  { hex: '#3a3a3c', to: 'var(--bg-surface-container-high)', note: 'Apple 暗面' },
  { hex: '#f5f5f7', to: 'var(--bg-canvas)', note: 'Apple 亮面' },
  { hex: '#28a745', to: 'var(--color-primary-500)', note: '旧 bootstrap 绿' },
  { hex: '#22c55e', to: 'var(--color-primary-500)', note: 'Tailwind green-500' },
  { hex: '#0891b2', to: 'var(--color-info-600)', note: 'cyan-600' },
];

function walkDir(dir) {
  const result = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (/node_modules|coverage|dist/.test(entry.name)) continue;
      result.push(...walkDir(full));
    } else if (/\.(tsx?|css|scss)$/.test(entry.name)) {
      result.push(full);
    }
  }
  return result;
}

const hits = []; // { file, rel, line, col, hex, context }
const files = walkDir(SRC);
for (const f of files) {
  const lines = readFileSync(f, 'utf8').split('\n');
  const rel = path.relative(SRC, f);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // 跳过纯注释行（禁用色在注释里不算债务）
    const t = line.trim();
    if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) continue;
    // 找所有 hex（大小写）
    for (const spec of FORBIDDEN) {
      let idx = 0;
      while (true) {
        const p = line.toLowerCase().indexOf(spec.hex, idx);
        if (p === -1) break;
        // 前后不能是 hex 数字/字母（避免误匹配更长 hex 的子串）
        const before = p > 0 ? line[p - 1] : '';
        const afterOff = p + spec.hex.length;
        const after = afterOff < line.length ? line[afterOff] : '';
        if (!/[0-9a-fA-F]/.test(before) && !/[0-9a-fA-F]/.test(after)) {
          hits.push({ rel, line: i + 1, col: p + 1, hex: spec.hex, context: line.trim().slice(0, 100), spec });
        }
        idx = p + spec.hex.length;
      }
    }
  }
}

// 按文件分组
const byFile = new Map();
for (const h of hits) {
  if (!byFile.has(h.rel)) byFile.set(h.rel, []);
  byFile.get(h.rel).push(h);
}

console.log('═══ M5 禁用色债务清单 ═══');
console.log('禁用色命中 ' + hits.length + ' 处 / ' + byFile.size + ' 个文件\n');
for (const [rel, list] of byFile) {
  console.log('── ' + rel + '  [' + list.length + ' 处]');
  for (const h of list) {
    console.log('   L' + h.line + ': ' + h.hex + ' → ' + h.spec.to + '  | ' + h.context.slice(0, 70));
  }
}
console.log('\n══ 色值分布 ══');
const byHex = new Map();
for (const h of hits) byHex.set(h.hex, (byHex.get(h.hex) || 0) + 1);
for (const [hex, n] of byHex) {
  const spec = FORBIDDEN.find(s => s.hex === hex);
  console.log('  ' + hex + ' → ' + spec.to + ' : ' + n + ' 处');
}
