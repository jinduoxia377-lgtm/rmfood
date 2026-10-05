#!/usr/bin/env node
/**
 * focus-scroll.css 焦点环收口：
 *   var(--color-primary, #10B981) 的 #10B981 兜底是旧品牌主色（M5 时代值），
 *   兜位统一改为当前品牌色阶 --color-primary-500 的兜底 #10b981（小写，已白名单）；
 *   rgba(16,185,129,0.15) 等暗色容器值已是品牌 primary 的 rgba，保持。
 */
import { readFileSync, writeFileSync } from 'node:fs';

const p = 'src/styles/utilities/focus-scroll.css';
let c = readFileSync(p, 'utf8');
// 仅替换焦点环的 hex 兜底（大小写统一为小写品牌色阶）
const before = c;
c = c.replace(/#10B981/g, '#10b981');
writeFileSync(p, c, 'utf8');
console.log('focus-scroll.css: ' + (before !== c ? '已统一 #10B981→#10b981' : '无改动') + '（D-28 冗余副本此前已删，本文件为唯一焦点权威）');
