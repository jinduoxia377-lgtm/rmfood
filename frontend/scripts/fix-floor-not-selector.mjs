#!/usr/bin/env node
/** A-30：把兜底规则的让位条件从 :not([class*="dark:"]) 收窄到 :not([class*="dark:text-"]) */
import fs from 'node:fs';
const f = 'src/styles/components/semantic-utils.css';
let s = fs.readFileSync(f, 'utf8');
const from = ':not([class*="dark:"])';
const to = ':not([class*="dark:text-"])';
const n = s.split(from).length - 1;
s = s.split(from).join(to);
fs.writeFileSync(f, s);
console.log(`替换 ${n} 处：${from} → ${to}`);
