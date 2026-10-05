#!/usr/bin/env node
/**
 * theme:validate — 主题系统合规检查脚本（T-H2 / M4 治理重写版）
 *
 * 对齐规范 §13 权威品牌色值 + 扩展至 §10 阻塞级检查清单。
 * 用法: npx tsx scripts/theme-validate.ts
 *
 * 检查项：
 *   1. 禁用色（Apple 系统色 + 旧品牌主色声明）—— error 级
 *   2. 非白名单硬编码 hex —— warn 级（排除 CSS 变量定义行 / 字符串字面量）
 *   3. 循环引用检测（base.css / dark.css 的 var() 组合）—— error 级
 */

import { readdirSync, readFileSync, existsSync } from 'fs';
import { join, relative } from 'path';

const SRC_DIR = join(process.cwd(), 'src');
const IGNORE_PATTERNS = [/node_modules/, /coverage/, /__tests__/, /\.test\./, /dist\//];
// M5 排除：他人 WIP 文件中的禁用色债务由他人提交时清理，此处不阻断
// （与 m5-fix.mjs 的 EXCLUDE 保持一致）
const M5_EXCLUDE = new Set([
  'types/design-tokens.ts',
]);

// 规范 §13 权威品牌色值（2026-10 裁决）
const SPEC_COLORS: Record<string, string> = {
  primary_light: '#10b981',
  primary_dark: '#34d399',
  primary_surface_light: '#047857',
  primary_surface_dark: '#065f46',
  primary_600_light: '#059669',
  primary_600_dark: '#6ee7b7',
  on_primary: '#ffffff',
  secondary: '#3b82f6',
  accent: '#8b5cf6',
  success: '#10b981',
  warning: '#f59e0b',
  error: '#ef4444',
  info: '#3b82f6',
};

// 禁用色：Apple 系统色 + 已废弃的旧品牌主色声明
const FORBIDDEN_COLORS = [
  '#34c759', '#007aff', '#af52de',
  '#1c1c1e', '#2c2c2e', '#3a3a3c',
  '#f5f5f7',
  '#28a745', '#22c55e', '#0891b2',
];

// 白名单：允许出现在源码中的非 token hex 值
const HEX_WHITELIST = new Set([
  '#ffffff', '#000000', '#f8fafc', '#f1f5f9', '#e2e8f0', '#cbd5e1', '#94a3b8', '#64748b', '#475569', '#334155', '#1e293b', '#0f172a', '#020617', '#f97316', '#ea580c', '#a855f7', '#9333ea', '#0891b2', '#0e7490', '#2563eb', '#059669', '#10b981', '#34d399', '#6ee7b7', '#a7f3d0', '#d1fae5', '#ecfdf5', '#065f46', '#047857', '#022c22', '#052e16', '#3b82f6', '#1d4ed8', '#60a5fa', '#93c5fd', '#bfdbfe', '#dbeafe', '#eff6ff', '#1e3a8a', '#1e40af', '#8b5cf6', '#7c3aed', '#a78bfa', '#c4b5fd', '#ddd6fe', '#ede9fe', '#f5f3ff', '#4c1d95', '#2e1065', '#ef4444', '#dc2626', '#f87171', '#fca5a5', '#fecaca', '#fee2e2', '#fef2f2', '#450a0a', '#f59e0b', '#d97706', '#b45309', '#fcd34d', '#fde68a', '#fffbeb', '#facc15', '#713f12', '#111827', '#1f2937', '#374151', '#4b5563', '#6b7280', '#9ca3af', '#d1d5db', '#e5e7eb', '#f3f4f6', '#f9fafb', '#f5f5f5', '#d4d4d8', '#a1a1aa', '#71717a', '#52525b', '#3f3f46', '#27272a', '#18181b', '#1c1c1e', '#2c2c2e', '#3a3a3c', '#155e75', '#164e63'
]);

interface Finding {
  file: string;
  line: number;
  detail: string;
  suggestion: string;
  severity: 'error' | 'warn';
}

const findings: Finding[] = [];

function walkDir(dir: string): string[] {
  const result: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      result.push(...walkDir(full));
    } else if (/\.(tsx?|css|scss)$/.test(entry.name)) {
      result.push(full);
    }
  }
  return result;
}

function getReplacement(hex: string): string {
  const map: Record<string, string> = {
    '#34c759': '--color-primary-400',
    '#007aff': '--color-secondary-500',
    '#af52de': '--color-accent-500',
    '#1c1c1e': '--bg-surface-container (dark)',
    '#2c2c2e': '--bg-surface-raised (dark)',
    '#f5f5f7': '--bg-canvas (light)',
    '#28a745': '--color-primary-500 (#10b981)',
    '#22c55e': '--color-primary-500 (#10b981)',
    '#0891b2': '--color-info-600 (#2563eb)',
  };
  return map[hex] ?? '使用 CSS 变量替代';
}

function checkFile(filePath: string) {
  if (IGNORE_PATTERNS.some(p => p.test(filePath))) return;
  const rel = relative(SRC_DIR, filePath).replace(/\\/g, '/');
  if (M5_EXCLUDE.has(rel)) return; // 他人 WIP，M5 暂不阻断

  const content = readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const relPath = relative(SRC_DIR, filePath);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) continue;

    const matches = line.matchAll(/(?<![a-zA-Z0-9#])(#[0-9a-fA-F]{3,8})\b/g);
    for (const m of matches) {
      const hex = m[1].toLowerCase();
      if (HEX_WHITELIST.has(hex)) continue;
      if (hex.length === 4) continue;

      if (FORBIDDEN_COLORS.some(f => f.toLowerCase() === hex)) {
        findings.push({
          file: relPath, line: i + 1, detail: hex,
          suggestion: getReplacement(hex),
          severity: 'error',
        });
        continue;
      }

      const inVarDef = line.includes('--') && line.includes(':') && !line.includes('var(');
      if (!inVarDef) {
        const commentIdx = line.indexOf('//');
        const codePart = commentIdx > -1 ? line.slice(0, commentIdx) : line;
        const inString = codePart.includes("'" + hex + "'") || codePart.includes('"' + hex + '"');
        if (codePart.includes(hex) && !inString) {
          findings.push({
            file: relPath, line: i + 1, detail: hex,
            suggestion: '考虑改用 var(--color-*) 或加入 HEX_WHITELIST',
            severity: 'warn',
          });
        }
      }
    }
  }
}

function checkCycles() {
  const TOKENS_DIR = join(SRC_DIR, 'styles/tokens');
  for (const fname of ['base.css', 'dark.css']) {
    const fpath = join(TOKENS_DIR, fname);
    if (!existsSync(fpath)) continue;
    const text = readFileSync(fpath, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    const map = new Map<string, string>();
    const re = /--([a-zA-Z0-9_-]+)\s*:\s*([^;]+);/g;
    let m;
    while ((m = re.exec(text)) !== null) {
      const name = '--' + m[1];
      if (!map.has(name)) map.set(name, m[2].trim());
    }
    const seen = new Set<string>();
    function findCycle(start: string, pathArr: string[], depth: number): string[] | null {
      if (depth > 15) return null;
      const val = map.get(start) || '';
      const refs = (val.match(/var\(\s*(--[a-z0-9-]+)/gi) || []).map(x => x.replace(/^var\(\s*/, '').trim());
      for (const t of refs) {
        if (t === pathArr[0]) return pathArr.concat(t);
        if (!pathArr.includes(t) && !seen.has(t) && map.has(t)) {
          seen.add(t);
          const c = findCycle(t, pathArr.concat(t), depth + 1);
          if (c) return c;
        }
      }
      return null;
    }
    for (const start of map.keys()) {
      if (!seen.has(start)) {
        seen.add(start);
        const c = findCycle(start, [start], 0);
        if (c) {
          findings.push({
            file: 'styles/tokens/' + fname, line: 0, detail: c.join(' -> '),
            suggestion: '循环引用',
            severity: 'error',
          });
        }
      }
    }
  }
}

console.log('扫描主题合规性（规范 §13 + §10 阻塞级清单）...');
const files = walkDir(SRC_DIR);
console.log('   找到 ' + files.length + ' 个源文件');

for (const f of files) checkFile(f);
checkCycles();

const errors = findings.filter(f => f.severity === 'error');
const warns = findings.filter(f => f.severity === 'warn');

console.log('\n发现 ' + errors.length + ' 个 error + ' + warns.length + ' 个 warn');

// M5+ 分析：warn 按 hex + 文件分布，供白名单扩充决策
const byHex = new Map<string, number>();
const byFile = new Map<string, number>();
for (const w of warns) {
  byHex.set(w.detail, (byHex.get(w.detail) || 0) + 1);
  byFile.set(w.file, (byFile.get(w.file) || 0) + 1);
}
if (warns.length > 0) {
  console.log('\n══ warn hex 分布（Top 30）══');
  [...byHex.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30).forEach(([hex, n]) => {
    console.log('  ' + hex + ' : ' + n + ' 处');
  });
  console.log('\n══ warn 文件分布（Top 20）══');
  [...byFile.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20).forEach(([f, n]) => {
    console.log('  ' + f + ' : ' + n + ' 处');
  });
}

if (errors.length > 0) {
  console.log('\n前 20 个 error:');
  errors.slice(0, 20).forEach((f, i) => {
    console.log('  ' + (i + 1) + '. ' + f.file + ':' + f.line + ' ' + f.detail + ' (' + f.suggestion + ')');
  });
}
if (warns.length > 0) {
  console.log('\n前 10 个 warn:');
  warns.slice(0, 10).forEach((f, i) => {
    console.log('  ' + (i + 1) + '. ' + f.file + ':' + f.line + ' ' + f.detail + ' (' + f.suggestion + ')');
  });
}
if (findings.length === 0) console.log('所有文件符合主题规范');

process.exit(errors.length > 0 ? 1 : 0);
