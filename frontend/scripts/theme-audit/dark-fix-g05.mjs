#!/usr/bin/env node
/**
 * 修复 GATE-05 回归：我批量加的 dark:bg-neutral-900* 使玻璃态白字元素暗色下
 * 深底白字对比度跌破。把「同行含 text-white 且 dark:bg-neutral-900*」的暗色底
 * 改回半透明 dark:bg-white/15（恢复玻璃态可读性，白字叠彩色/页面背景）。
 * 幂等：只改我加的那类；不碰原本就是 dark:bg-white/NN 的行。
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
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

let total = 0; const perFile = [];
for (const f of walk(`${ROOT}/src`)) {
  const rel = relative(ROOT, f).replace(/\\/g, '/');
  if (isWip(rel)) continue;
  const lines = readFileSync(f, 'utf8').split('\n');
  let changed = 0;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (/^\s*(\/\/|\/\*|\*)/.test(l)) continue;
    // 条件：该行含 text-white（或 text-white/NN）且含我加的 dark:bg-neutral-900*
    if (!/\btext-white(?:\/\d+)?\b/.test(l)) continue;
    if (!/dark:bg-neutral-900/.test(l)) continue;
    // 把 dark:bg-neutral-900/NN 或 dark:bg-neutral-900（不带透明度=实底）改回 dark:bg-white/15
    // 若原本 dark:bg-neutral-900 是实底（我追加的），暗色玻璃态应半透明
    const m = lines[i];
    lines[i] = m.replace(/dark:bg-neutral-900(\/\d+)?(?!\d)/g, (full) => {
      // 若已是带 /10 /15 /20 的半透明（我脚本加的 /NN），保留原半透明度即可（本就是半透明，可读）
      // 只有「不带透明度的实底 dark:bg-neutral-900」才改成 /15
      return full.endsWith('/') || /dark:bg-neutral-900\/\d/.test(full) ? full : 'dark:bg-white/15';
    });
    if (lines[i] !== m) { changed++; total++; }
  }
  if (changed > 0) { writeFileSync(f, lines.join('\n')); perFile.push(`${rel} (+${changed} 行)`); }
}
console.log(`GATE-05 回归修复：${perFile.length} 文件 / ${total} 行 玻璃态白字改回半透明`);
perFile.forEach(c => console.log('  ' + c));
