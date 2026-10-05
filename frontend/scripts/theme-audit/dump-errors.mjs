#!/usr/bin/env node
// 直接 dump theme-validate 的 error 明细（绕过 PowerShell 管道）
import { execSync } from 'node:child_process';
let out = '';
try {
  out = execSync('npx tsx scripts/theme-validate.ts 2>&1', { cwd: process.cwd(), encoding: 'utf8' });
} catch (e) {
  out = (e.stdout || '') + (e.stderr || '');
}
const lines = out.split('\n');
// 找 "前 20 个 error" 段
const start = lines.findIndex(l => l.includes('error') && l.includes('前'));
if (start > -1) {
  console.log(lines.slice(start, start + 30).join('\n'));
} else {
  // 输出含 error 的行
  lines.filter(l => l.includes('error') || l.match(/^\s+\d+\./)).slice(0, 30).forEach(l => console.log(l));
  console.log('--- 完整输出 ---');
  console.log(out.slice(-2000));
}
