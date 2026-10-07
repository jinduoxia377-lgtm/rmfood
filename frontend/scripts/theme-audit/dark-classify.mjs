#!/usr/bin/env node
/**
 * 20 文件分组：判定每个文件的 git diff 是否「纯净」（只有我的 dark:bg-* 追加）。
 * 纯净 = 所有 -/+ 行要么是空行调整，要么 +/- 行的实质内容只差 dark:bg-* 类追加。
 * 含 WIP = 存在与 dark:bg-* 无关的他人改动行（如 TeamActivity、import 等）。
 * 输出两组清单，供 git add 精确暂存。
 */
import { execSync } from 'node:child_process';

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

const PURE = []; const MIXED = [];
for (const f of files) {
  let diff;
  try { diff = execSync(`git diff -- "${f}"`, { cwd: process.cwd(), encoding: 'utf8' }); }
  catch { continue; }
  const adds = diff.split('\n').filter(l => l.startsWith('+') && !l.startsWith('+++'));
  const dels = diff.split('\n').filter(l => l.startsWith('-') && !l.startsWith('---'));
  // 我的改动特征：追加行含 dark:bg-neutral-* 且与删除行只差该追加
  const isMyAdd = (l) => /dark:bg-neutral-(?:800|900)(\/\d+)?/.test(l);
  // 是否存在「非我的」实质改动行（既不是 dark:bg 追加、也不是与删除对应的空调整）
  let hasForeign = false;
  for (const a of adds) {
    const content = a.slice(1).trim();
    if (content === '') continue;
    if (isMyAdd(a)) continue;
    // 若是纯代码行（无 dark:bg-neutral 我的追加）→ 他人 WIP
    hasForeign = true; break;
  }
  for (const d of dels) {
    const content = d.slice(1).trim();
    if (content === '') continue;
    // 删除行：若是被我 dark:bg 追加前的原行 → 合法（被 + 行替换）
    if (!/\bbg-(?:white|neutral-(?:50|100)|slate-(?:50|100))\b/.test(content)) { hasForeign = true; break; }
  }
  (hasForeign ? MIXED : PURE).push(f);
}
console.log('══ 纯净（只含我的 dark:bg-* 追加，可单独提交）══');
PURE.forEach(f => console.log('  ' + f));
console.log(`\n══ 混入他人 WIP（提交会带入 WIP，需你确认或等 WIP 合并）══`);
MIXED.forEach(f => console.log('  ' + f));
console.log(`\n小计：纯净 ${PURE.length} / 混合 ${MIXED.length}`);
