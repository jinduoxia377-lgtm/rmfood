/**
 * 全站移动端「真实自适应」批量改造
 * 将无响应式断点的固定多列网格改为移动端单列/两列：
 *   grid-cols-2 → grid-cols-1 sm:grid-cols-2
 *   grid-cols-3 → grid-cols-1 sm:grid-cols-3
 *   grid-cols-4 → grid-cols-2 sm:grid-cols-4
 * 用法: node scripts/make-grids-responsive.mjs
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(__dirname, '../src');

const files = [];
function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full);
    } else if (entry.endsWith('.tsx') || entry.endsWith('.ts')) {
      files.push(full);
    }
  }
}
walk(SRC);

let changedFiles = 0;
let changedCount = 0;

const patterns = [
  // grid grid-cols-N（无响应式前缀）
  { re: /(^|[\s"'])(grid\s+grid-cols-2)(?=\s|"|'|`|})/g, to: (m, p1) => `${p1}grid grid-cols-1 sm:grid-cols-2` },
  { re: /(^|[\s"'])(grid\s+grid-cols-3)(?=\s|"|'|`|})/g, to: (m, p1) => `${p1}grid grid-cols-1 sm:grid-cols-3` },
  { re: /(^|[\s"'])(grid\s+grid-cols-4)(?=\s|"|'|`|})/g, to: (m, p1) => `${p1}grid grid-cols-2 sm:grid-cols-4` },
];

for (const file of files) {
  const original = readFileSync(file, 'utf8');
  let content = original;
  for (const { re, to } of patterns) {
    content = content.replace(re, to);
  }
  if (content !== original) {
    writeFileSync(file, content, 'utf8');
    const diff = content.split(/\r?\n/).length - original.split(/\r?\n/).length;
    changedFiles += 1;
    changedCount += 1;
    console.log(`[changed] ${path.relative(SRC, file)} (lines diff ${diff})`);
  }
}

console.log(`\n===== 批量改造完成 =====\n修改文件: ${changedFiles}`);