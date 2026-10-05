#!/usr/bin/env node
/**
 * 列出 M5 批量替换实际改动的文件（基于 git diff + 替换特征），
 * 并与他人 WIP 登记清单交叉核对，输出可安全提交的精确清单。
 */
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const FE = process.cwd();

// git diff（在仓库根运行，得到全仓库路径）
const out = execSync('git diff --name-only', { cwd: path.resolve(FE, '..'), encoding: 'utf8' });
const changed = out.trim().split('\n').filter(Boolean);

// M5 替换特征（出现任一 = 该文件被 M5 改过）
const M5_SIG = /var\(--color-primary-400\)|var\(--color-secondary-500\)|var\(--color-accent-500\)|var\(--color-info-600\)|var\(--color-primary-500\)|var\(--bg-canvas\)|#34d399|#3b82f6|#8b5cf6|#10b981/;

// 他人 WIP 登记（绝不提交）
const WIP = /(^|\b)(api\/(admin|auth|notifications)\.ts|components\/dashboard\/|components\/layout\/(MainLayout|MobileBottomNav)\.tsx|config\/dashboard\.ts|hooks\/useUserSettings|pages\/auth\/Login|pages\/dashboard\/|pages\/formula\/components\/(AIInsights|DashboardLayout|NotificationCenter)\.tsx|pages\/settings\/|services\/websocket\.ts|styles\/utilities\/focus-scroll\.css|types\/design-tokens\.ts|backend\/|STARTUP\.md|start\.ps1|stop\.ps1)/;

const m5 = [];
const skipWip = [];
const noSig = [];
for (const f of changed) {
  // f 是仓库根相对路径，如 frontend/src/... 或 backend/...
  const p = path.resolve(FE, '..', f);
  let ok = false;
  try {
    const c = readFileSync(p, 'utf8');
    ok = M5_SIG.test(c);
  } catch { /* ignore */ }
  const rel = f.replace(/^frontend\//, ''); // 让 WIP 正则按 frontend 内相对路径匹配
  if (WIP.test(rel) || WIP.test(f)) {
    skipWip.push(f);
  } else if (ok) {
    m5.push(f);
  } else {
    noSig.push(f);
  }
}

console.log('══ git diff 改动: ' + changed.length + ' 文件 ══');
console.log('M5 可提交（含替换特征、非 WIP）: ' + m5.length);
m5.forEach(f => console.log('  ✓ ' + f));
console.log('\nWIP 排除（他人未提交，含替换特征也跳过）: ' + skipWip.length);
skipWip.forEach(f => console.log('  ⚠ ' + f));
console.log('\n无 M5 特征（可能是他人改动或纯格式，需人工确认）: ' + noSig.length);
noSig.forEach(f => console.log('  ? ' + f));

// 写清单供 git add 使用
const fs = await import('node:fs');
fs.writeFileSync(path.join(FE, '..', 'temp', 'm5-staged.txt'), m5.join('\n'), 'utf8');
console.log('\n清单已写入 temp/m5-staged.txt（' + m5.length + ' 行）');
