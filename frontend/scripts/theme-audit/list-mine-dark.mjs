#!/usr/bin/env node
/**
 * 筛选「我名下可提交」的深色修复文件：
 * 1. git status 全部改动文件
 * 2. 排除他人 WIP 目录
 * 3. 逐文件 git diff 含 dark:bg-neutral-* / dark:hover:bg-neutral / dark:text-gray-300 特征
 * 4. 输出文件清单到 temp/mine-dark-files.txt
 */
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const status = execFileSync('git', ['status', '--porcelain'], { cwd: 'D:\\RMFOODFP', encoding: 'utf8' });
const lines = status.split('\n').filter((l) => l.trim());

const wipPrefixes = [
  'backend/', 'STARTUP.md', 'start.ps1', 'stop.ps1',
  'frontend/src/api/admin.ts', 'frontend/src/api/auth.ts', 'frontend/src/api/notifications',
  'frontend/src/components/dashboard/', 'frontend/src/components/layout/MainLayout',
  'frontend/src/components/layout/MobileBottomNav', 'frontend/src/config/dashboard',
  'frontend/src/hooks/useUserSettings', 'frontend/src/pages/auth/Login',
  'frontend/src/pages/dashboard/', 'frontend/src/pages/formula/components/AIInsights',
  'frontend/src/pages/formula/components/DashboardLayout',
  'frontend/src/pages/formula/components/NotificationCenter',
  'frontend/src/pages/settings/', 'frontend/src/services/websocket',
  'frontend/src/services/professional', 'frontend/src/types/design-tokens',
  'frontend/src/styles/utilities/focus-scroll', 'frontend/src/components/molecule/MoleculeViewer3D',
  'frontend/src/hooks/useQueries', 'frontend/src/utils/configManager',
];
const isWip = (p) => wipPrefixes.some((w) => p.startsWith(w.replace(/\/$/, '')));

const out = [];
for (const l of lines) {
  const p = l.slice(3).trim();
  if (!p.startsWith('frontend/src/')) continue;
  if (isWip(p)) continue;
  let diff;
  try { diff = execFileSync('git', ['diff', '--', p], { cwd: 'D:\\RMFOODFP', encoding: 'utf8' }); }
  catch { continue; }
  if (/dark:bg-neutral-\d/.test(diff) || /dark:hover:bg-neutral/.test(diff) || /dark:text-gray-300/.test(diff)) {
    out.push(p);
  }
}
writeFileSync('D:\\RMFOODFP\\temp\\mine-dark-files.txt', out.join('\n') + '\n');
console.log('可提交深色修复文件: ' + out.length);
out.slice(0, 10).forEach((f) => console.log('  ' + f));
