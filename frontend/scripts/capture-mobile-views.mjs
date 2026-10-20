/**
 * iPhone 13 真机视口截图（登录态）— 供 Lead 逐页视觉评估
 * 用法: node scripts/capture-mobile-views.mjs
 */
import { chromium, devices } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = 'http://localhost:3000';
const iPhone13 = devices['iPhone 13'];
const OUT = path.join(__dirname, 'mobile-shots');

const ROUTES = [
  ['dashboard', '/dashboard'],
  ['formulas', '/formulas'],
  ['formulas-new', '/formulas/new'],
  ['experiments', '/experiments'],
  ['batches', '/batches'],
  ['doe', '/doe'],
  ['stability', '/stability'],
  ['documents', '/documents'],
  ['compliance', '/compliance'],
  ['label-check', '/label-check'],
  ['ingredient-analysis', '/ingredient-analysis'],
  ['labels', '/labels'],
  ['ai', '/ai'],
  ['databases', '/databases'],
  ['regulations', '/regulations'],
  ['terminology', '/terminology'],
  ['workflows', '/workflows'],
  ['agent', '/agent'],
  ['analytics', '/analytics'],
  ['organizations', '/organizations'],
  ['settings', '/settings'],
  ['users', '/users'],
  ['audit-logs', '/audit-logs'],
  ['billing', '/billing'],
  ['notifications', '/notifications'],
  ['academic-report', '/academic-report'],
  ['peptide-structure', '/peptide-structure'],
  ['integrations', '/integrations'],
  ['tokens', '/tokens'],
];

import { mkdirSync } from 'node:fs';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ ...iPhone13 });
const page = await context.newPage();

async function login() {
  for (let i = 0; i < 3; i += 1) {
    try {
      await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.fill('#rhine-username', 'admin');
      await page.fill('#rhine-password', 'admin123');
      await page.click('button[type="submit"]');
      await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 20000 });
      await page.waitForTimeout(1500);
      return true;
    } catch { /* retry */ }
  }
  return false;
}

const ok = await login();
if (!ok) { console.log('LOGIN_OK=false'); process.exit(1); }
console.log('LOGIN_OK=true');

for (const [name, route] of ROUTES) {
  try {
    await page.goto(BASE + route, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(2500);
    if (page.url().includes('/login')) {
      await login();
      await page.goto(BASE + route, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.waitForTimeout(2500);
    }
    await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: false });
    console.log(`[ok] ${name}`);
  } catch (e) {
    console.log(`[ERR] ${name} ${String(e).slice(0, 80)}`);
  }
}
await browser.close();
console.log('DONE');