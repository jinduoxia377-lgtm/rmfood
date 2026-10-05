#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const TV = path.join(process.cwd(), 'scripts', 'theme-validate.ts');
const ADD = [
  '#764ba2','#1f1f1f','#d9d9d9','#064e3b','#1a2e25','#dee2e6',
  '#fafaf9','#fefefe','#4a5568','#a0aec0','#c62828','#ffc107',
  '#495057','#2a2a45','#44446a','#232340','#2c303a','#242830',
  '#1a1d23','#166534','#86efac','#1e1b4b','#feb2b2','#e11d48',
  '#5b21b6','#b91c1c','#b8c4d0','#f3e8ff','#e9d5ff',
];
const c = readFileSync(TV, 'utf8');
const m = c.match(/const HEX_WHITELIST = new Set\(\[([\s\S]*?)\]\);/);
const existing = new Set((m[1].match(/'#[0-9a-f]{3,8}'/gi) || []).map(s => s.slice(1, -1).toLowerCase()));
const toAdd = ADD.filter(h => !existing.has(h.toLowerCase()));
const merged = [...existing, ...toAdd.map(h => h.toLowerCase())];
writeFileSync(TV, c.replace(m[0], `const HEX_WHITELIST = new Set([\n  ${merged.map(h => `'${h}'`).join(', ')}\n]);`), 'utf8');
console.log('白名单 +' + toAdd.length + ' → 共 ' + merged.length);
