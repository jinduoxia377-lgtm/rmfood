#!/usr/bin/env node
/**
 * 深色漏配补漏：同行多个亮色类实例，逐个判定「其后 40 字符内无 dark:bg-」才追加。
 * 幂等（已配对实例跳过），对 top20 文件全量补漏。
 */
import { readFileSync, writeFileSync } from 'node:fs';

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

const ALL_RE = /\b(bg-white|bg-neutral-50|bg-neutral-100|bg-slate-50|bg-slate-100)\b(?![-\w])/g;
const DARK_MAP = {
  'bg-white': 'dark:bg-neutral-900',
  'bg-neutral-50': 'dark:bg-neutral-800',
  'bg-neutral-100': 'dark:bg-neutral-800',
  'bg-slate-50': 'dark:bg-neutral-800',
  'bg-slate-100': 'dark:bg-neutral-800',
};

let total = 0;
const perFile = [];
for (const rel of files) {
  const f = `${ROOT}/${rel}`;
  const lines = readFileSync(f, 'utf8').split('\n');
  let changed = 0;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (/^\s*(\/\/|\/\*|\*)/.test(l)) continue;
    ALL_RE.lastIndex = 0;
    const insts = [...l.matchAll(ALL_RE)];
    if (insts.length === 0) continue;

    let patched = '';
    let last = 0;
    let anyMissing = false;
    for (const m of insts) {
      const after = l.slice(m.index + m[0].length, m.index + m[0].length + 40);
      if (/dark:bg-/.test(after)) {
        patched += l.slice(last, m.index + m[0].length);
        last = m.index + m[0].length;
        continue;
      }
      anyMissing = true;
      patched += l.slice(last, m.index) + m[0] + ' ' + DARK_MAP[m[1]];
      last = m.index + m[0].length;
    }
    patched += l.slice(last);
    if (anyMissing) {
      lines[i] = patched;
      changed++;
      total++;
    }
  }
  if (changed > 0) {
    writeFileSync(f, lines.join('\n'));
    perFile.push(`${rel} (+${changed} 行)`);
  }
}
console.log(`补漏完成：${perFile.length} 文件 / ${total} 行`);
perFile.forEach(c => console.log('  ' + c));
