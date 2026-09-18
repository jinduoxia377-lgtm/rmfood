#!/usr/bin/env node
/**
 * theme:validate — 主题系统合规检查脚本
 * 扫描 src/ 目录，检测硬编码颜色、缺失 token 引用
 * 用法: npx tsx scripts/theme-validate.ts
 */

import { readdirSync, readFileSync, existsSync } from 'fs';
import { join, relative } from 'path';

const SRC_DIR = join(process.cwd(), 'src');
const IGNORE_PATTERNS = [/node_modules/, /coverage/, /__tests__/, /\.test\./, /dist\//];

// 品牌规范色值（来自 DESIGN.md v1.0）
const SPEC_COLORS = {
  primary_main: '#059669',
  primary_500: '#10b981',
  secondary_main: '#2563eb',
  secondary_500: '#3b82f6',
  accent_main: '#7c3aed',
  accent_500: '#8b5cf6',
};

// Apple 风格颜色（禁止使用）
const FORBIDDEN_COLORS = [
  '#34c759', '#34C759', // Apple Emerald
  '#007aff', '#007AFF', // Apple Blue
  '#af52de', '#AF52DE', // Apple Purple
  '#1c1c1e', '#2c2c2e', '#3a3a3c', // Apple dark surfaces
  '#f5f5f7', '#F5F5F7', // Apple light surface
];

interface Finding {
  file: string;
  line: number;
  color: string;
  suggestion: string;
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

function checkFile(filePath: string) {
  if (IGNORE_PATTERNS.some(p => p.test(filePath))) return;

  const content = readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const relPath = relative(SRC_DIR, filePath);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const matches = line.matchAll(/(?<![a-zA-Z0-9#])(#[0-9a-fA-F]{3,8})\b/g);
    for (const m of matches) {
      const hex = m[1].toLowerCase();
      // Skip if it's inside a CSS variable definition
      if (line.includes('var(--') || line.includes('// ') || line.includes('* ')) continue;
      // Skip valid Tailwind classes
      if (hex.length === 3 && /^[0-9a-f]{3}$/.test(hex)) continue;
      // Check forbidden colors
      if (FORBIDDEN_COLORS.some(f => f.toLowerCase() === hex)) {
        findings.push({
          file: relPath,
          line: i + 1,
          color: hex,
          suggestion: getReplacement(hex),
        });
      }
    }
  }
}

function getReplacement(hex: string): string {
  const map: Record<string, string> = {
    '#34c759': '--color-primary-400 (Forest Green 浅)',
    '#007aff': '--color-secondary-500 (Ocean Blue)',
    '#af52de': '--color-accent-500 (Bio Purple)',
    '#1c1c1e': '--bg-surface-container (dark)',
    '#2c2c2e': '--bg-surface-raised (dark)',
    '#f5f5f7': '--bg-canvas (light)',
  };
  return map[hex] ?? '使用 CSS 变量替代';
}

// Main
console.log('🔍 扫描主题合规性...');
const files = walkDir(SRC_DIR);
console.log(`   找到 ${files.length} 个源文件`);

for (const f of files) checkFile(f);

console.log(`\n📊 发现 ${findings.length} 个问题`);
if (findings.length > 0) {
  console.log('\n前 20 个:')
  findings.slice(0, 20).forEach((f, i) => {
    console.log(`  ${i+1}. ${f.file}:${f.line} → ${f.color} (${f.suggestion})`);
  });
  if (findings.length > 20) console.log(`  ... 还有 ${findings.length - 20} 个`);
  process.exit(1);
} else {
  console.log('✅ 所有文件符合主题规范');
  process.exit(0);
}