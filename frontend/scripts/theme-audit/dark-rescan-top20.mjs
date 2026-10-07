#!/usr/bin/env node
/** 统计 top20 文件当前 A 类剩余行数（与 dark-audit2 同口径，逐文件计数） */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { relative } from 'node:path';

const ROOT = process.cwd();
const files = [
  'src/pages/database/DashboardOverview.tsx',
  'src/components/ai/professional/IngredientAnalyzer.tsx',
  'src/components/ai/professional/PeptideAnalyzer.tsx',
  'src/components/inference/InferenceChainVisualizer.tsx',
  'src/components/inference/InferenceChainVisualizerV2.tsx',
  'src/components/academic/editor/AcademicElementEditor.tsx',
  'src/components/coa/COAView.tsx',
  'src/components/ai/features/safety/SafetyReportTemplate.tsx',
  'src/components/search/SearchBar.tsx',
  'src/pages/dashboard/DashboardPage.tsx',
  'src/components/ai/components/StructureEditor.tsx',
  'src/components/coa/COACreateForm.tsx',
  'src/components/ai/components/AdvancedChartRenderer.tsx',
  'src/components/coa/COATable.tsx',
  'src/pages/database/CrossSearchPanel.tsx',
  'src/components/ai/AdvancedPeptideDesign.tsx',
  'src/components/ai/components/TemplateSelector.tsx',
  'src/components/ai/features/ChatEnhancedDemo.tsx',
  'src/components/ai/features/components/ThinkingVisualizer.tsx',
  'src/components/ai/PromptOptimizer.tsx',
];
const TARGET = /\bbg-(?:white|neutral-(?:50|100)|slate-(?:50|100))\b(?![-\w])/;
const DARK_BG = /dark:bg-[^\s"'`]+/;
const VAR_BG = /bg-(?:var\(|\[var\()/;

let sum = 0;
for (const rel of files) {
  const lines = readFileSync(`${ROOT}/${rel}`, 'utf8').split('\n');
  let n = 0;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (/^\s*(\/\/|\/\*|\*)/.test(l)) continue;
    if (!TARGET.test(l)) continue;
    if (VAR_BG.test(l)) continue;
    const near = lines.slice(Math.max(0, i - 3), i + 4).join('\n');
    if (DARK_BG.test(near)) continue;
    if (/dark:/.test(l)) continue;
    n++;
  }
  if (n > 0) { console.log(`${rel}: ${n} 行残留`); sum += n; }
}
console.log(`\n══ top20 残留合计: ${sum} 行 ══`);
