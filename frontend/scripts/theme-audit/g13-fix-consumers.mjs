#!/usr/bin/env node
/**
 * GATE-13 检出 4 个未登记 --color-* 消费 → 修消费者（对齐 L0 权威令牌名）
 *
 * | 消费者引用 | L0 实际 | 修复 |
 * |:-----------|:--------|:-----|
 * | `--color-text-secondary`（2 文件） | `--text-secondary`（base/dark） | `var(--color-text-secondary)` → `var(--text-secondary)` |
 * | `--color-text-muted`（1 文件） | `--text-muted` | `var(--color-text-muted)` → `var(--text-muted)` |
 * | `--color-danger`（2 文件） | `--color-error`（功能色族权威名） | `var(--color-danger)` → `var(--color-error)` |
 * | `--color-brand-400`（1 文件） | `--color-primary`（品牌主色） | `var(--color-brand-400)` → `var(--color-primary)` |
 *
 * 不补 L0 新定义（避免引入第二真相源），改消费者对齐既有权威名。
 * 文件均为非 WIP（git status 核验）。
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const ROOT = process.cwd(); // 在 frontend/ 下运行
const EDITS = [
  // [相对路径, 原串, 替换串]
  ['src/components/ai/charts/ScoreRadarChart.tsx', 'var(--color-text-muted', 'var(--text-muted'],
  ['src/components/ai/FormulaSharePanel.tsx', 'var(--color-text-secondary', 'var(--text-secondary'],
  ['src/utils/typography.ts', 'var(--color-text-secondary', 'var(--text-secondary'],
  ['src/components/ingredient/IngredientAnalysisPage.tsx', 'var(--color-danger)', 'var(--color-error)'],
  ['src/pages/stability/StabilityPage.tsx', 'var(--color-danger)', 'var(--color-error)'],
  ['src/components/ui/FocusRing.tsx', 'var(--color-brand-400)', 'var(--color-primary)'],
];
// 上述路径可能与实际不完全一致，按前缀匹配定位真实文件
const targets = EDITS.map(([p]) => p);

// 先按已知确切路径尝试，缺的再扫描
let changed = 0;
for (const [rel, from, to] of EDITS) {
  const p = `${ROOT}/${rel}`;
  if (!existsSync(p)) { console.log(`  [跳过] 不存在 ${rel}`); continue; }
  const t = readFileSync(p, 'utf8');
  const n = t.split(from).length - 1;
  if (n === 0) { console.log(`  [无匹配] ${rel}（${from}）`); continue; }
  writeFileSync(p, t.split(from).join(to), 'utf8');
  console.log(`  [修复] ${rel}：${from} → ${to}（${n} 处）`);
  changed++;
}
console.log(`\nGATE-13 消费者修复：${changed} 文件`);
