#!/usr/bin/env node
import { execSync } from 'node:child_process';
function show(label, cmd, greps) {
  let out = '';
  try { out = execSync(cmd, { cwd: process.cwd(), encoding: 'utf8', stdio: 'pipe' }); }
  catch (e) { out = ((e.stdout || '') + (e.stderr || '')); }
  const lines = out.split('\n').filter(l => greps.some(g => l.includes(g)));
  console.log('══ ' + label + ' ══');
  lines.slice(0, 6).forEach(l => console.log('  ' + l.trim()));
  if (!lines.length) console.log('  (无匹配行)');
}
show('门禁', 'node scripts/theme-audit/theme-gate.mjs', ['通过 ', '失败']);
show('theme:validate', 'npx tsx scripts/theme-validate.ts', ['发现 ']);
show('vite build', 'npx vite build', ['built', 'error']);
show('vitest', 'npx vitest run src/stores/__tests__/themeStore.test.ts src/stores/__tests__/theme.presets.test.ts', ['Test Files', 'Tests  ', 'passed', 'failed']);
show('浏览器回归', 'node scripts/theme-audit/verify-g2-browser.mjs', ['verify-g2-browser']);
show('verify-g2 静态', 'node scripts/theme-audit/verify-g2.mjs', ['verify-g2 静态']);
