#!/usr/bin/env node
/**
 * 深色漏配精准判定 v2：把 ①表面仅亮色 / ②纯白实底 细分为
 *  A. 真漏配：元素自身背景，无 dark: 配对，也无 var() 令牌 → 暗色下白/浅灰卡
 *  B. 可忽略：值走 var(--*) 令牌（自动响应暗色）
 *  C. 已适配：同组件/同行已有 dark: 背景变体（放宽到文件级相邻 3 行）
 * 输出：A 类按文件聚合清单（供修复）+ B/C 计数（供核验）
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
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

// 目标类：卡片表面亮色底（bg-white / bg-{neutral,slate,gray,zinc}-{50,100}）
const TARGET = /\bbg-(?:white|neutral-(?:50|100)|slate-(?:50|100)|gray-(?:50|100)|zinc-(?:50|100))\b(?![-\w])/;
const DARK_BG = /dark:bg-[^\s"'`]+/;
const VAR_BG = /bg-(?:var\(|\[var\()/;

const result = { A: [], B: [], C: [] };

for (const f of walk(SRC)) {
  const rel = relative(ROOT, f).replace(/\\/g, '/');
  if (isWip(rel)) continue;
  const lines = readFileSync(f, 'utf8').split('\n');
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (/^\s*(\/\/|\/\*|\*)/.test(l)) continue;
    if (!TARGET.test(l)) continue;
    const m = { rel, line: i + 1, code: l.trim().slice(0, 100) };
    if (VAR_BG.test(l)) { result.B.push(m); continue; }
    // 同行或上下 3 行有 dark:bg- 配对 → 已适配
    const near = lines.slice(Math.max(0, i - 3), i + 4).join('\n');
    if (DARK_BG.test(near)) { result.C.push(m); continue; }
    // 同行有 dark:（任意属性）→ 视为组件级已处理暗色
    if (/dark:/.test(l)) { result.C.push(m); continue; }
    result.A.push(m);
  }
}

// A 类按文件聚合
const byFile = {};
for (const h of result.A) (byFile[h.rel] = byFile[h.rel] || []).push(h.line);
console.log(`══ 深色真漏配（A 类：无 dark: 配对 + 非 var 令牌）══`);
console.log(`文件数: ${Object.keys(byFile).length}，行数: ${result.A.length}`);
console.log(`（B 类 var 令牌 ${result.B.length} / C 类已适配 ${result.C.length} 已排除）\n`);
Object.keys(byFile).sort().forEach((k) => {
  console.log(`${k}（${byFile[k].length} 行）: ${byFile[k].slice(0, 8).join(', ')}${byFile[k].length > 8 ? '…' : ''}`);
});
