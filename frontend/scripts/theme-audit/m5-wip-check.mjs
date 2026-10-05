#!/usr/bin/env node
import { execSync } from 'node:child_process';
import path from 'node:path';

const FE = process.cwd();
const out = execSync('git diff --name-only', { cwd: path.resolve(FE, '..'), encoding: 'utf8' });
const changed = out.trim().split('\n').filter(Boolean);

// 他人 WIP 登记（绝不提交）—— 仓库根相对路径匹配
const WIP_PATTERNS = [
  'backend/', 'STARTUP.md', 'start.ps1', 'stop.ps1',
  'src/api/admin.ts', 'src/api/auth.ts', 'src/api/notifications.ts',
  'src/components/dashboard/', 'src/components/layout/MainLayout.tsx', 'src/components/layout/MobileBottomNav.tsx',
  'src/config/dashboard.ts', 'src/hooks/useUserSettings',
  'src/pages/auth/Login', 'src/pages/dashboard/',
  'src/pages/formula/components/AIInsights.tsx', 'src/pages/formula/components/DashboardLayout.tsx',
  'src/pages/formula/components/NotificationCenter.tsx',
  'src/pages/settings/',
  'src/services/websocket.ts',
  'src/styles/utilities/focus-scroll.css',
  'src/types/design-tokens.ts',
];
function isWip(f) {
  return WIP_PATTERNS.some(p => f.includes(p));
}
const wip = changed.filter(isWip);
const rest = changed.filter(f => !isWip(f));
console.log('WIP 排除（' + wip.length + '）:');
wip.forEach(f => console.log('  ⚠ ' + f));
console.log('\n非 WIP（' + rest.length + '）:');
rest.forEach(f => console.log('  ' + f));
