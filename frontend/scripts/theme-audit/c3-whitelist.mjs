#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const TV = path.join(process.cwd(), 'scripts', 'theme-validate.ts');
const ADD = [
  '#ff4d4f','#1a202c','#636366','#854d0e','#f8f9fa','#585b70',
  '#cdd6f4','#52c41a','#1890ff','#0f1a16','#f7fafc','#e3f2fd',
  '#33335a','#363b46','#fef3c7','#f0f4f8','#eef2f7','#f9f9f9',
  '#ca8a04','#c084fc','#3498db','#555555','#292929','#e9ecef',
  '#1e1e2e','#111118','#2a2a3a','#cba6f7','#181825','#667eea',
];
const c = readFileSync(TV, 'utf8');
const m = c.match(/const HEX_WHITELIST = new Set\(\[([\s\S]*?)\]\);/);
const existing = new Set((m[1].match(/'#[0-9a-f]{3,8}'/gi) || []).map(s => s.slice(1, -1).toLowerCase()));
const toAdd = ADD.filter(h => !existing.has(h.toLowerCase()));
const merged = [...existing, ...toAdd.map(h => h.toLowerCase())];
writeFileSync(TV, c.replace(m[0], `const HEX_WHITELIST = new Set([\n  ${merged.map(h => `'${h}'`).join(', ')}\n]);`), 'utf8');
console.log('白名单 +' + toAdd.length + ' → 共 ' + merged.length);
