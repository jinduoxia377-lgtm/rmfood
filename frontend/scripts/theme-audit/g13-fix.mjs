#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
const edits = [
  ['src/components/ui/FocusRing.tsx', 'var(--color-brand-400)', 'var(--color-primary)'],
  ['src/components/ai/charts/ScoreRadarChart.tsx', 'var(--color-text-muted)', 'var(--text-muted)'],
  ['src/components/ai/FormulaSharePanel.tsx', 'var(--color-text-secondary)', 'var(--text-secondary)'],
  ['src/utils/typography.ts', 'var(--color-text-secondary)', 'var(--text-secondary)'],
  ['src/utils/chartTheme.ts', 'var(--color-text-secondary, #6E6E73)', 'var(--text-secondary, #6E6E73)'],
  ['src/pages/stability/StabilityPage.tsx', 'var(--color-danger)', 'var(--color-error)'],
  ['src/pages/ingredient/IngredientAnalysisPage.tsx', 'var(--color-danger)', 'var(--color-error)'],
];
for (const [rel, from, to] of edits) {
  const t = readFileSync(rel, 'utf8');
  const n = t.split(from).length - 1;
  if (n === 0) { console.log('  [无匹配] ' + rel); continue; }
  writeFileSync(rel, t.split(from).join(to));
  console.log('  [修复] ' + rel + '：' + n + ' 处 → ' + to);
}
console.log('完成');
