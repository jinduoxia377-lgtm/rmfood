#!/usr/bin/env node
/**
 * DIVERGENT 裁决工具：从 base.css/dark.css 提取 23 项暗色值，
 * 自动找「暗色 primitive 色阶中 == 暗色语义值的档位」（若有），
 * 输出裁决表供人工确认档位方向。
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

const TOKENS = path.join(process.cwd(), 'src', 'styles', 'tokens');
const SCALES = ['primary', 'secondary', 'accent', 'success', 'warning', 'danger', 'info', 'neutral'];

function parseTokens(file) {
  const text = readFileSync(path.join(TOKENS, file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const map = new Map();
  const re = /--([a-zA-Z0-9_-]+)\s*:\s*([^;]+);/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (!map.has('--' + m[1])) map.set('--' + m[1], m[2].trim());
  }
  return map;
}

// 暗色块 = .dark { ... } 内的（dark.css 全部）；base.css 的 primitive = :root 块
const darkAll = parseTokens('dark.css');
const baseAll = parseTokens('base.css');

// 暗色 primitive 档位值表（dark.css 直接定义）
const darkScale = {};
for (const s of SCALES) {
  darkScale[s] = {};
  for (let d = 50; d <= 950; d += 100) {
    const key = `--color-${s}-${d}`;
    if (darkAll.has(key)) darkScale[s][d] = darkAll.get(key);
  }
}
// 亮色 primitive 档位值表
const lightScale = {};
for (const s of SCALES) {
  lightScale[s] = {};
  for (let d = 50; d <= 950; d += 100) {
    const key = `--color-${s}-${d}`;
    if (baseAll.has(key)) lightScale[s][d] = baseAll.get(key);
  }
}

const DIVERGENT = [
  '--color-primary-container', '--color-primary-text', '--color-primary-surface',
  '--color-primary-surface-hover', '--color-secondary-container', '--color-accent-hover',
  '--color-accent-container', '--color-info-bg', '--bg-tertiary', '--bg-surface-elevated',
  '--text-secondary', '--text-muted', '--text-disabled', '--border-color', '--focus-ring',
  '--color-info-text', '--color-tertiary', '--color-tertiary-hover', '--bg-gradient-end',
  '--border-default',
];

function norm(v) { return String(v).toLowerCase().trim(); }

console.log('══ DIVERGENT 20 项裁决表（暗色语义值 → 暗色 primitive 档位匹配）══');
console.log('token | 亮值 | 暗值 | 暗色匹配档位 | 裁决建议');
console.log('---');
for (const t of DIVERGENT) {
  const lv = baseAll.get(t);
  const dv = darkAll.get(t);
  if (dv == null) { console.log(`${t} | ${lv} | (dark 无定义→继承亮) | - | INHERIT`); continue; }
  // 若暗值已是 var()（Phase A 改过），跳过
  if (dv.startsWith('var(')) { console.log(`${t} | ${lv} | ${dv} | 已是 var() | 跳过`); continue; }
  // 在暗色所有 primitive 档位中找同值
  const matches = [];
  for (const s of SCALES) {
    for (const [d, v] of Object.entries(darkScale[s])) {
      if (norm(v) === norm(dv)) matches.push(`--color-${s}-${d}`);
    }
  }
  // 亮值是否等于亮 primitive 档位（验证 light 侧）
  const lightMatches = [];
  for (const s of SCALES) {
    for (const [d, v] of Object.entries(lightScale[s])) {
      if (norm(v) === norm(lv)) lightMatches.push(`--color-${s}-${d}`);
    }
  }
  const matchStr = matches.length ? matches.join(' / ') : '✗ 无档位匹配（rgba/独立设计值）';
  const lightStr = lightMatches.length ? lightMatches.slice(0, 3).join(' / ') : '✗';
  console.log(`${t}\n  亮=${lv}（亮档位=${lightStr}）\n  暗=${dv} → ${matchStr}`);
}
