#!/usr/bin/env node
/**
 * C-1：剩余 221 warn 的分类统计
 * 按 文件目录 + hex 分组，判定每类的性质（长尾/可收口/白名单）
 */
import { execSync } from 'node:child_process';

let out = '';
try {
  out = execSync('npx tsx scripts/theme-validate.ts 2>&1', { cwd: process.cwd(), encoding: 'utf8' });
} catch (e) {
  out = (e.stdout || '') + (e.stderr || '');
}
const lines = out.split('\n');

// 解析 "前 10 个 warn" 之外的完整数据 → 需要改 theme-validate 输出全部 warn，
// 这里改用 m5-analyze 的思路直接扫一遍：用 theme-validate 已输出的分布段
const hexDist = lines.slice(lines.findIndex(l => l.includes('warn hex 分布')),
  lines.findIndex(l => l.includes('warn 文件分布')));
console.log('══ warn hex 分布 ══');
console.log(hexDist.join('\n'));

// 文件分布
const fileDist = lines.slice(lines.findIndex(l => l.includes('warn 文件分布')));
console.log('\n══ warn 文件分布 ══');
console.log(fileDist.join('\n'));

// 按顶层目录聚合
console.log('\n══ 按顶层目录聚合（从文件分布推断）══');
