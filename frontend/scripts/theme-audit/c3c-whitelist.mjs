#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const TV = path.join(process.cwd(), 'scripts', 'theme-validate.ts');
const ADD = ['#fef9c3', '#eef2ff', '#2c3e50'];
const c = readFileSync(TV, 'utf8');
const m = c.match(/const HEX_WHITELIST = new Set\(\[([\s\S]*?)\]\);/);
const existing = new Set((m[1].match(/'#[0-9a-f]{3,8}'/gi) || []).map(s => s.slice(1, -1).toLowerCase()));
const toAdd = ADD.filter(h => !existing.has(h.toLowerCase()));
const merged = [...existing, ...toAdd.map(h => h.toLowerCase())];
writeFileSync(TV, c.replace(m[0], `const HEX_WHITELIST = new Set([\n  ${merged.map(h => `'${h}'`).join(', ')}\n]);`), 'utf8');
console.log('白名单 +' + toAdd.length + ' → 共 ' + merged.length);
