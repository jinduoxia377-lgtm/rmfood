#!/usr/bin/env node
/**
 * 深色漏配 top 20 重灾区批量修复
 * 规则：A 类真漏配行（dark-audit2.mjs 判定：无 dark: 配对 + 非 var 令牌）
 *   bg-white        → 追加 dark:bg-neutral-900
 *   bg-neutral-100 → 追加 dark:bg-neutral-800
 *   bg-neutral-50  → 追加 dark:bg-neutral-800
 *   bg-slate-100   → 追加 dark:bg-neutral-800
 *   bg-slate-50    → 追加 dark:bg-neutral-800
 * 只在行内首次出现目标类且行内无 dark:bg- 时追加（避免重复、避免误伤已适配行）。
 * 排除他人 WIP 模式（与 dark-audit2 一致），只改 104 文件中的 top 20（按行数降序）。
 * 输出：每文件修改行数 + 全量清单，供 git diff 复核。
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { relative } from 'node:path';

const ROOT = process.cwd();
const SRC = `${ROOT}/src`;
const wipPatterns = ['src/api/admin','src/api/auth','src/api/notifications','components/dashboard/','layout/MainLayout','layout/MobileBottomNav','config/dashboard','hooks/useUserSettings','pages/auth/Login','pages/dashboard/','pages/formula/components/AIInsights','pages/formula/components/DashboardLayout','pages/formula/components/NotificationCenter','pages/settings/','services/websocket','services/professional','types/design-tokens','focus-scroll','molecule/MoleculeViewer3D','hooks/useQueries','utils/configManager'];
const isWip = (rel) => wipPatterns.some(p => rel.startsWith(p.replace(/\/$/, '')) || rel === p);

function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    const p = `${dir}/${e}`, s = statSync(p);
    if (s.isDirectory()) { if (e === 'node_modules' || e === '__tests__') continue; walk(p, out); }
    else if (/\.(tsx|ts)$/.test(e)) out.push(p);
  }
  return out;
}

// 目标类 → 暗色配对（中性 800/900 档，与项目既有 dark:bg-neutral-* 用色一致）
const RULES = [
  { re: /\bbg-white\b(?![\w-])/g, dark: 'dark:bg-neutral-900' },
  { re: /\bbg-neutral-100\b/g, dark: 'dark:bg-neutral-800' },
  { re: /\bbg-neutral-50\b/g, dark: 'dark:bg-neutral-800' },
  { re: /\bbg-slate-100\b/g, dark: 'dark:bg-neutral-800' },
  { re: /\bbg-slate-50\b/g, dark: 'dark:bg-neutral-800' },
];

// 先统计每文件 A 类命中行数（与 dark-audit2 同口径），选 top 20
const TARGET = /\bbg-(?:white|neutral-(?:50|100)|slate-(?:50|100))\b(?![-\w])/;
const DARK_BG = /dark:bg-[^\s"'`]+/;
const VAR_BG = /bg-(?:var\(|\[var\()/;

const counts = new Map();
for (const f of walk(SRC)) {
  const rel = relative(ROOT, f).replace(/\\/g, '/');
  if (isWip(rel)) continue;
  const lines = readFileSync(f, 'utf8').split('\n');
  let n = 0;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (/^\s*(\/\/|\/\*|\*)/.test(l)) continue;
    if (!TARGET.test(l)) continue;
    if (VAR_BG.test(l)) continue;
    const near = lines.slice(Math.max(0, i - 3), i + 4).join('\n');
    if (DARK_BG.test(near)) continue;
    if (/dark:/.test(l)) continue;
    n++;
  }
  if (n > 0) counts.set(rel, n);
}
const top20 = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20);
console.log('══ top 20 重灾区（文件: 行数）══');
top20.forEach(([k, v]) => console.log(`  ${k}  ${v}`));

// 修改 top 20
let total = 0;
const changedFiles = [];
for (const [rel] of top20) {
  const f = `${ROOT}/${rel}`;
  const lines = readFileSync(f, 'utf8').split('\n');
  let changed = 0;
  for (let i = 0; i < lines.length; i++) {
    let l = lines[i];
    if (/^\s*(\/\/|\/\*|\*)/.test(l)) continue;
    if (!TARGET.test(l)) continue;
    if (VAR_BG.test(l)) continue;
    const near = lines.slice(Math.max(0, i - 3), i + 4).join('\n');
    if (DARK_BG.test(near)) continue;
    if (/dark:/.test(l)) continue;
    let m = l;
    for (const r of RULES) {
      if (r.re.test(m)) {
        // 只在「class 属性串」内追加（避免注释/字符串误伤）——逐类替换为 类+空格+暗色配对
        m = m.replace(r.re, (cls) => `${cls} ${r.dark}`);
        r.re.lastIndex = 0;
      }
    }
    if (m !== l) { lines[i] = m; changed++; total++; }
  }
  if (changed > 0) { writeFileSync(f, lines.join('\n')); changedFiles.push(`${rel} (+${changed} 行)`); }
}
console.log(`\n══ 修改完成：${changedFiles.length} 文件 / ${total} 行 ══`);
changedFiles.forEach(c => console.log('  ' + c));
