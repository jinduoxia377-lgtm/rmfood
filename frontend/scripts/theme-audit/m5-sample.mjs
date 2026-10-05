#!/usr/bin/env node
// 抽查 m5-fix 的替换安全性：对比替换前后 diff
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const FE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SRC = path.join(FE, 'src');
const samples = [
  'App.tsx',
  'components/ai/charts/PieChart.tsx',
  'types/knowledge-graph-colors.ts',
  'utils/reportTemplates.ts',
  'index.css',
];
for (const rel of samples) {
  const f = path.join(SRC, ...rel.split('/'));
  if (!readFileSync.toString) break;
  const content = readFileSync(f, 'utf8');
  console.log('\n── ' + rel + ' 中含禁用色的行（替换前）：');
  const forbidden = ['#34c759','#007aff','#af52de','#28a745','#22c55e','#0891b2','#f5f5f7','#1c1c1e','#2c2c2e','#3a3a3c'];
  content.split('\n').forEach((l, i) => {
    if (forbidden.some(h => l.toLowerCase().includes(h))) {
      console.log('  L' + (i+1) + ': ' + l.trim().slice(0, 90));
    }
  });
}
