#!/usr/bin/env node
/**
 * GATE-14 清理工具（§4.3 C-24 方案 A）— 安全版
 *
 * 替换：bg-X-{400..950} text-white（同行共现）→ bg-X-container text-X-main
 *
 * WIP 安全机制（双重）：
 *   ① 显式排除名单 EXCLUDE_WIP（登记的他人 WIP 文件，绝对不可改）
 *   ② git status 动态 M 名单（运行时额外兜底）
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { relative } from 'node:path';
import { execSync } from 'node:child_process';

const ROOT = process.cwd(); // frontend/
const SRC = `${ROOT}/src`;
const FAMS = ['primary', 'secondary', 'accent'];

// ① 显式排除（他人 WIP，绝不触碰）
const EXCLUDE_WIP = new Set([
  'src/pages/settings/SettingsPage.tsx',
]);
// ② 动态 M 名单
const status = execSync('git status --porcelain', { cwd: ROOT, encoding: 'utf8' });
const gitM = new Set(status.split('\n').filter(l => /^\s*M/.test(l)).map(l => l.slice(3).trim().replace(/\\/g, '/')));
const isWip = (rel) => EXCLUDE_WIP.has(rel) || gitM.has(rel) || gitM.has('frontend/' + rel);

function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    const p = `${dir}/${e}`, s = statSync(p);
    if (s.isDirectory()) { if (e === 'node_modules' || e === '__tests__') continue; walk(p, out); }
    else if (/\.(ts|tsx)$/.test(e)) out.push(p);
  }
  return out;
}

const files = walk(SRC);
let changedFiles = 0, changedLines = 0;
const wipHit = new Set();

for (const f of files) {
  const rel = relative(ROOT, f).replace(/\\/g, '/');
  if (isWip(rel)) continue; // WIP 直接跳过（不读不写）
  const lines = readFileSync(f, 'utf8').split('\n');
  let dirty = false;

  for (let i = 0; i < lines.length; i++) {
    let l = lines[i];
    if (/^\s*(\/\/|\/\*|\*)/.test(l)) continue;
    const hasBgfam = FAMS.some(fm => new RegExp(`bg-${fm}-(?:400|500|600|700|800|900|950)`).test(l));
    if (!hasBgfam || !/\btext-white\b/.test(l)) continue;
    let nl = l;
    for (const fam of FAMS) nl = nl.replace(new RegExp(`bg-${fam}-(?:400|500|600|700|800|900|950)`, 'g'), `bg-${fam}-container`);
    const famsInLine = FAMS.filter(fm => l.includes(`bg-${fm}-`));
    const target = famsInLine[0] || 'primary';
    nl = nl.replace(/\btext-white\b/g, `text-${target}-main`);
    if (nl !== l) { lines[i] = nl; dirty = true; changedLines++; }
  }

  if (dirty) {
    writeFileSync(f, lines.join('\n'));
    changedFiles++;
    console.log(`  ✅ ${rel}`);
  }
}
console.log(`══ 已修改 ${changedFiles} 文件 / ${changedLines} 行（WIP 已排除）══`);
