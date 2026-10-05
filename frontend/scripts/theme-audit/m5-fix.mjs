#!/usr/bin/env node
/**
 * M5 禁用色债务批量替换
 *
 * 把 10 种禁用色（Apple 系统色 + 旧品牌主色）替换为品牌色阶 var() 引用。
 *
 * 替换规则（按上下文）：
 *   A. var(--x, #FORBIDDEN)  → var(--x, #BRAND)     把 var() 兜底值换成品牌色阶值
 *   B. "#FORBIDDEN"          → "var(--token)"        字符串字面量 → CSS 变量
 *   C. #FORBIDDEN（裸）       → var(--token)          CSS/模板中的裸 hex
 *
 * 排除文件（WIP / 数据定义 / 校验器误报）：
 *   - src/types/design-tokens.ts（他人 WIP）
 *   - 注释中的历史标注（// 原 Apple 蓝 #007AFF）—— 正则跳过注释行
 *
 * dry-run 模式：node scripts/theme-audit/m5-fix.mjs --dry
 * 应用模式：    node scripts/theme-audit/m5-fix.mjs
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const FE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SRC = path.join(FE, 'src');
const DRY = process.argv.includes('--dry');

// 禁用色 → 双目标：var()（DOM/CSS）+ hex（canvas 不解析 var()）
const REPLACEMENTS = [
  { hex: '#34c759', to: 'var(--color-primary-400)', hexTo: '#34d399', note: 'Apple 绿→品牌浅档' },
  { hex: '#007aff', to: 'var(--color-secondary-500)', hexTo: '#3b82f6', note: 'Apple 蓝→辅色' },
  { hex: '#af52de', to: 'var(--color-accent-500)', hexTo: '#8b5cf6', note: 'Apple 紫→强调色' },
  { hex: '#1c1c1e', to: 'var(--bg-surface-container)', hexTo: '#1c1c1e', note: 'Apple 暗面（保留）' },
  { hex: '#2c2c2e', to: 'var(--bg-surface-raised)', hexTo: '#2c2c2e', note: 'Apple 暗面（保留）' },
  { hex: '#3a3a3c', to: 'var(--bg-surface-container-high)', hexTo: '#3a3a3c', note: 'Apple 暗面（保留）' },
  { hex: '#f5f5f7', to: 'var(--bg-canvas)', hexTo: '#f8fafc', note: 'Apple 亮面→品牌中性 50' },
  { hex: '#28a745', to: 'var(--color-primary-500)', hexTo: '#10b981', note: '旧 bootstrap 绿→品牌主色' },
  { hex: '#22c55e', to: 'var(--color-primary-500)', hexTo: '#10b981', note: 'Tailwind green-500→品牌主色' },
  { hex: '#0891b2', to: 'var(--color-info-600)', hexTo: '#0891b2', note: 'cyan-600（保留，非 Apple）' },
];

// canvas 直绘文件（fillStyle/strokeStyle 不解析 var()，用 hex 目标）
const CANVAS_FILES = new Set([
  path.join(SRC, 'types', 'knowledge-graph-colors.ts'),
  path.join(SRC, 'components', 'database', 'KnowledgeGraph.tsx'),
  path.join(SRC, 'components', 'database', 'graph', 'components', 'MinimapCanvas.tsx'),
  path.join(SRC, 'components', 'database', 'graph', 'engine', 'forceSimulation.ts'),
  path.join(SRC, 'components', 'database', 'graph', 'hooks', 'useGraphHandlers.ts'),
  path.join(SRC, 'components', 'database', 'graph', 'hooks', 'useGraphState.ts'),
  path.join(SRC, 'components', 'database', 'graph', 'types.ts'),
]);

// 排除文件（WIP / 数据定义 / 误报）
const EXCLUDE = new Set([
  path.join(SRC, 'types', 'design-tokens.ts').replace(/\\/g, '/'), // 他人 WIP
  path.join(SRC, 'styles', 'tokens', 'base.css').replace(/\\/g, '/'),  // token 定义层（#0891b2 是 cyan-600 定义）
  path.join(SRC, 'styles', 'tokens', 'dark.css').replace(/\\/g, '/'),
]);

function walkDir(dir) {
  const result = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (/node_modules|coverage|dist/.test(e.name)) continue;
      result.push(...walkDir(full));
    } else if (/\.(tsx?|css|scss)$/.test(e.name)) {
      result.push(full);
    }
  }
  return result;
}

// 匹配禁用色：前面是 # 或引号或空格或行首，后面是 引号/逗号/空格/行尾
// 用大小写不敏感匹配（#34C759 / #34c759 都要抓）
function buildHexPattern(hex) {
  const h = hex.replace('#', '\\#');
  return new RegExp(`(\\${h}|(?<![0-9a-zA-Z])\\${h.slice(1).toUpperCase()})`, 'g');
}

// 替换目标选择：canvas 文件用 hex，其他用 var()
function getTarget(rep, filePath) {
  return CANVAS_FILES.has(filePath.replace(/\\/g, '/')) ? rep.hexTo : rep.to;
}

// 简化：直接对每个禁用色做大小写变体替换
function replaceInLine(line, count, filePath) {
  for (const rep of REPLACEMENTS) {
    const target = getTarget(rep, filePath);
    const hexLc = rep.hex;
    const hexUc = rep.hex.replace('#', '#').toUpperCase();
    // 两种大小写
    for (const variant of [hexLc, hexUc]) {
      // A 模式：var(--x, #HEX) → var(--x, REPL)（保留 var 前缀）
      // B/C 模式：#HEX → REPL
      // 跳过已被 M5 替换的 var(--token, #HEX) 中的历史 hex（target 已含品牌值时不再处理）
      let idx = 0;
      while (true) {
        const p = line.indexOf(variant, idx);
        if (p === -1) break;
        // 边界检查：前后不能是 hex 数字/字母（避免误匹配更长 hex）
        const before = p > 0 ? line[p - 1] : '';
        const afterOff = p + variant.length;
        const after = afterOff < line.length ? line[afterOff] : '';
        if (/[0-9a-fA-F]/.test(before) || /[0-9a-fA-F]/.test(after)) {
          idx = afterOff;
          continue;
        }
        // 跳过注释：行首 // 或 * 或 /*
        const t = line.slice(0, p).trim();
        if (t.endsWith('//') || t.endsWith('*') || t.endsWith('/*')) {
          idx = afterOff;
          continue;
        }
        line = line.slice(0, p) + target + line.slice(afterOff);
        count.replaced++;
        idx = p + target.length;
      }
    }
  }
  return line;
}

let totalReplaced = 0;
let totalFiles = 0;
const files = walkDir(SRC).filter(f => {
  const norm = f.replace(/\\/g, '/');
  if (EXCLUDE.has(norm)) return false;
  if (EXCLUDE.has(f)) return false;
  return true;
});

for (const f of files) {
  const rel = path.relative(SRC, f).replace(/\\/g, '/');
  const content = readFileSync(f, 'utf8');
  const lines = content.split('\n');
  const count = { replaced: 0 };
  let changed = false;
  const newLines = lines.map(l => {
    const before = l;
    const after = replaceInLine(l, count, f);
    if (after !== before) changed = true;
    return after;
  });
  if (changed && count.replaced > 0) {
    totalReplaced += count.replaced;
    totalFiles++;
    if (DRY) {
      console.log(`  [dry] ${rel}: ${count.replaced} 处`);
    } else {
      writeFileSync(f, newLines.join('\n'), 'utf8');
    }
  }
}

console.log(DRY
  ? `\n══ dry-run：将替换 ${totalReplaced} 处 / ${totalFiles} 文件（--dry 未写盘）══`
  : `\n══ 已替换 ${totalReplaced} 处 / ${totalFiles} 文件 ══`);
