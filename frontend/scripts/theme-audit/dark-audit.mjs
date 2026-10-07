#!/usr/bin/env node
/**
 * 深色适配深度核查 — 四类漏配扫描（只读，输出分类清单）
 * 一：卡片表面仅亮色背景（bg-white / bg-neutral-50/100 / bg-gray-50/100 无同行 dark: 变体）
 * 二：纯白实底类（bg-white，单独强调）
 * 三：硬编码亮色 surface/text/border 值（hex 字面量，非 var(--*)）
 * 四：D-50 残余（反转色阶 + 白字）
 * 排除：__tests__、node_modules、他人 WIP 模式、纯注释行
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { relative } from 'node:path';
import { execSync } from 'node:child_process';

const ROOT = process.cwd(); // frontend/
const SRC = `${ROOT}/src`;
const wipPatterns = ['src/api/admin','src/api/auth','src/api/notifications','components/dashboard/','layout/MainLayout','layout/MobileBottomNav','config/dashboard','hooks/useUserSettings','pages/auth/Login','pages/dashboard/','pages/formula/components/AIInsights','pages/formula/components/DashboardLayout','pages/formula/components/NotificationCenter','pages/settings/','services/websocket','services/professional','types/design-tokens','focus-scroll','molecule/MoleculeViewer3D','hooks/useQueries','utils/configManager'];
const isWip = (rel) => wipPatterns.some(p => rel.includes(p.replace(/\/$/, '')) || rel === p || (p.endsWith('/') && rel.startsWith(p)));

function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    const p = `${dir}/${e}`, s = statSync(p);
    if (s.isDirectory()) { if (e === 'node_modules' || e === '__tests__') continue; walk(p, out); }
    else if (/\.(tsx|ts)$/.test(e)) out.push(p);
  }
  return out;
}

// ── ① 表面仅亮色（无 dark: 配对）──
// 命中：行内有 bg-white | bg-neutral-50 | bg-neutral-100 | bg-gray-50 | bg-gray-100 | bg-slate-50 | bg-slate-100
// 一、表面仅亮色（无 dark: 配对）的类名集合
const HAS_DARK = /dark:bg-[^\s"'`]+/;

const hits = { surfaceOnly: [], pureWhite: [], hardcoded: [], d50: [] };
const isSurfaceCls = (c) => /bg-(white|neutral-50|neutral-100|gray-50|gray-100|slate-50|slate-100|zinc-50|zinc-100)/.test(c);

for (const f of walk(SRC)) {
  const rel = relative(ROOT, f).replace(/\\/g, '/');
  if (isWip(rel)) continue;
  const lines = readFileSync(f, 'utf8').split('\n');
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (/^\s*(\/\/|\/\*|\*)/.test(l)) continue;
    // 一/二、表面仅亮色类名（逐类判定）
    for (const c of [...l.matchAll(/\b(?:bg-[a-z]+-?(?:50|100)?|bg-white)\b/g)].map(x => x[0])) {
      if (!isSurfaceCls(c)) continue;
      const isWhite = /\bbg-white\b/.test(c);
      if (isWhite && !HAS_DARK.test(l)) hits.pureWhite.push({ rel, line: i + 1, cls: c, code: l.trim().slice(0, 90) });
      else if (!isWhite && !HAS_DARK.test(l)) hits.surfaceOnly.push({ rel, line: i + 1, cls: c, code: l.trim().slice(0, 90) });
    }
    // ③ 硬编码亮色值（卡片背景类 hex：#fff / #f8fafc / #f9fafb / #f3f4f6 / #f5f5f7 等作 bg:）
    const hc = l.match(/(?:background(?:-color)?|bg|fill|color)\s*[:=]\s*['"]?(#(?:fff|f8fafc|f9fafb|f3f4f6|f5f5f7|ffffff|fafafa|f1f5f9))[0-9a-fA-F]*/i);
    if (hc) hits.hardcoded.push({ rel, line: i + 1, val: hc[0].slice(0, 60), code: l.trim().slice(0, 90) });
    // ④ D-50
    if (/(?:bg|from)-(?:primary|secondary|accent)-(?:400|500|600|700|800|900|950)/.test(l) && /\btext-white\b/.test(l) && !/dark:text-neutral|text-neutral-900 dark/.test(l)) {
      hits.d50.push({ rel, line: i + 1, code: l.trim().slice(0, 90) });
    }
  }
}

const g = (arr) => arr.length ? arr.map(h => `  ${h.rel}:${h.line}  ${h.cls ?? h.val ?? ''}`).join('\n') : '  (0)';
console.log(`══ 深色漏配扫描（排除他人 WIP ${wipPatterns.length} 模式）══`);
console.log(`\n① 表面仅亮色（无 dark: 配对）：${hits.surfaceOnly.length}`);
console.log(g(hits.surfaceOnly).split('\n').slice(0, 60).join('\n'));
console.log(`\n② 纯白实底 bg-white（暗色无背景风险最高）：${hits.pureWhite.length}`);
console.log(g(hits.pureWhite));
console.log(`\n③ 硬编码亮色值：${hits.hardcoded.length}`);
console.log(g(hits.hardcoded).split('\n').slice(0, 30).join('\n'));
console.log(`\n④ D-50 残余：${hits.d50.length}`);
console.log(g(hits.d50));
