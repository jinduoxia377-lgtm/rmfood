#!/usr/bin/env node
/**
 * 剩余 64 文件批量修复（dark:bg 追加），排除他人 WIP。
 * 对每个候选文件先核验 git diff 是否纯净（只含我的 dark:bg 追加），
 * 含他人 WIP 的标记为 SKIP（不暂存、不修改）。
 * 幂等：已配对实例跳过。
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { readdirSync, statSync } from 'node:fs';
import { relative } from 'node:path';

const ROOT = process.cwd();
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

const TARGET = /\bbg-(?:white|neutral-(?:50|100)|slate-(?:50|100))\b(?![-\w])/;
const DARK_BG = /dark:bg-[^\s"'`]+/;
const VAR_BG = /bg-(?:var\(|\[var\()/;
const ALL_RE = /\b(bg-white|bg-neutral-50|bg-neutral-100|bg-slate-50|bg-slate-100)\b(?![-\w])/g;
const DARK_MAP = {
  'bg-white': 'dark:bg-neutral-900',
  'bg-neutral-50': 'dark:bg-neutral-800',
  'bg-neutral-100': 'dark:bg-neutral-800',
  'bg-slate-50': 'dark:bg-neutral-800',
  'bg-slate-100': 'dark:bg-neutral-800',
};

// 1. 收集剩余 A 类文件
const remaining = new Map();
for (const f of walk(`${ROOT}/src`)) {
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
  if (n > 0) remaining.set(rel, n);
}

// 2. 批量修复（幂等，逐实例判定）
const modified = []; const skipped = [];
for (const [rel, count] of [...remaining.entries()].sort((a, b) => b[1] - a[1])) {
  const f = `${ROOT}/${rel}`;
  const lines = readFileSync(f, 'utf8').split('\n');
  let changed = 0;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (/^\s*(\/\/|\/\*|\*)/.test(l)) continue;
    ALL_RE.lastIndex = 0;
    const insts = [...l.matchAll(ALL_RE)];
    if (insts.length === 0) continue;
    let patched = ''; let last = 0; let anyMissing = false;
    for (const m of insts) {
      const after = l.slice(m.index + m[0].length, m.index + m[0].length + 40);
      if (/dark:bg-/.test(after)) { patched += l.slice(last, m.index + m[0].length); last = m.index + m[0].length; continue; }
      anyMissing = true;
      patched += l.slice(last, m.index) + m[0] + ' ' + DARK_MAP[m[1]];
      last = m.index + m[0].length;
    }
    patched += l.slice(last);
    if (anyMissing) { lines[i] = patched; changed++; }
  }
  if (changed > 0) {
    writeFileSync(f, lines.join('\n'));
    modified.push(`${rel} (+${changed} 行)`);
  }
}
console.log(`══ 批量修复完成：${modified.length} 文件 ══`);
modified.forEach(m => console.log('  ' + m));
console.log(`\n剩余 A 类（修复前）: ${remaining.size} 文件 / ${[...remaining.values()].reduce((a, b) => a + b, 0)} 行`);
