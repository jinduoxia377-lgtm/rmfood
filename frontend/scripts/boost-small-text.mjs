/**
 * 提升非图表/图谱组件中的 8-10px 小字到 12px（text-xs）
 * 保留：知识图谱浮层（database/graph/**）、图表（EffectTrendChart）、SVG 流程图（WorkflowNodeVisualizer、ThinkingVisualizerV3）
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(__dirname, '../src');

const SKIP_DIRS = ['graph'];
const SKIP_FILES = new Set([
  'EffectTrendChart.tsx',
  'WorkflowNodeVisualizer.tsx',
  'ThinkingVisualizerV3.tsx',
  'MetricsBlock.tsx',
  'CommunityLegend.tsx',
  'CentralityPanel.tsx',
  'LayoutIndicator.tsx',
  'SPathToolbar.tsx',
  'PerformancePanel.tsx',
  'AnimationPresetsControls.tsx',
]);

const files = [];
function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (!SKIP_DIRS.includes(entry)) walk(full);
    } else if (entry.endsWith('.tsx') && !SKIP_FILES.has(entry)) {
      files.push(full);
    }
  }
}
walk(SRC);

let changed = 0;
for (const file of files) {
  const original = readFileSync(file, 'utf8');
  const replaced = original
    .replace(/text-\[8px\]/g, 'text-xs')
    .replace(/text-\[9px\]/g, 'text-xs')
    .replace(/text-\[10px\]/g, 'text-xs');
  if (replaced !== original) {
    writeFileSync(file, replaced, 'utf8');
    changed++;
    console.log(`[changed] ${path.relative(SRC, file)}`);
  }
}
console.log(`\n提升文件数: ${changed}`);