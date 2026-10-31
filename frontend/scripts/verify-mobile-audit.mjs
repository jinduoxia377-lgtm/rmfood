/**
 * 移动端审计「二次验证」脚本 v2（mobile-auditor, 2026-10-22）
 * 读取 audit-mobile-depth.mjs 生成的 mobile-audit-data.json，
 * 对每个候选问题用 Playwright 断言重新确认，排除误报：
 *  - 横向溢出：重新计算 scrollWidth，并复测记录的元素右边界
 *  - 触控目标：复测元素 boundingBox 最小边 < 44px，且元素实际位于视口内
 *  - 小字号：复测元素 computed font-size < 12px
 *  - 重叠：复测 elementFromPoint 中心点 + 悬浮层是否仍在顶部
 * 视口过滤：位于视口外（off-canvas 抽屉/侧栏）的元素不算用户可见问题。
 * 输出：scripts/mobile-audit-verified.json
 */
import { chromium, devices } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = 'http://localhost:3000';
const STORAGE_PATH = path.join(__dirname, '.mobile-audit-storage.json');
const MOBILE_CTX = {
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  userAgent: devices['iPhone 13'].userAgent,
};

const data = JSON.parse(readFileSync(path.join(__dirname, 'mobile-audit-data.json'), 'utf8'));
const browser = await chromium.launch({ headless: true });

function elLocator(page, sel) {
  return page.locator(sel).first();
}

async function verifyPage(entry) {
  const ctx = await browser.newContext({ ...MOBILE_CTX, storageState: STORAGE_PATH });
  const page = await ctx.newPage();
  const verified = { name: entry.name, route: entry.route, overflow: null, touch: [], smallFonts: [], overlays: [] };
  try {
    await page.goto(BASE + entry.route, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(2500);
    if (page.url().includes('/login')) { verified.fatal = 'redirected to login'; return verified; }
    await page.waitForSelector('main', { timeout: 20000 }).catch(() => {});
    if (entry.name === 'databases-graph') {
      await page.getByRole('tab', { name: /知识图谱/ }).first().click({ timeout: 25000 });
      await page.waitForTimeout(3000);
    }
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});

    const vw = 390;

    // 1) 横向溢出复测：scrollWidth + 每个候选元素
    const sw = await page.evaluate(() => document.documentElement.scrollWidth);
    const reOverflow = sw - vw;
    const culprits = [];
    for (const c of (entry.checks.overflowCulprits || [])) {
      try {
        const loc = elLocator(page, c.sel);
        const visible = await loc.isVisible().catch(() => false);
        if (!visible) continue;
        const rect = await loc.evaluate((el) => {
          const r = el.getBoundingClientRect();
          return { left: r.left, right: r.right, width: r.width };
        });
        const overRight = rect.right - vw;
        const overLeft = -rect.left;
        // 仅在「元素本身与视口有横向交集」且确实越界时才视为真实溢出
        const intersectsViewport = rect.right > 0 && rect.left < vw;
        if (intersectsViewport && (overRight > 2 || overLeft > 2)) {
          culprits.push({
            ...c,
            reMeasuredLeft: Math.round(rect.left),
            reMeasuredRight: Math.round(rect.right),
            reOverRight: Math.round(overRight),
            reOverLeft: Math.round(overLeft),
          });
        }
      } catch { /* 元素不存在/动态，忽略 */ }
    }
    verified.overflow = {
      reportedScrollWidth: entry.checks.overflow?.scrollWidth ?? null,
      recheckedScrollWidth: sw,
      recheckedOverflowPx: reOverflow,
      confirmed: culprits.length > 0,
      culprits,
    };

    // 2) 触控目标复测：只确认「与视口相交」的元素
    for (const t of (entry.checks.touchTargets || [])) {
      try {
        const loc = elLocator(page, t.sel);
        const visible = await loc.isVisible().catch(() => false);
        if (!visible) continue;
        const box = await loc.boundingBox();
        if (!box) continue;
        const intersectsViewport = (box.x + box.width > 0) && (box.x < vw) && (box.y + box.height > 0) && (box.y < 844);
        if (!intersectsViewport) continue;
        const minDim = Math.min(box.width, box.height);
        if (minDim < 44) {
          verified.touch.push({ ...t, reWidth: Math.round(box.width), reHeight: Math.round(box.height), reMinDim: Math.round(minDim), confirmed: true });
        }
      } catch { /* ignore */ }
    }

    // 3) 小字号复测
    for (const f of (entry.checks.smallFonts || [])) {
      try {
        const loc = elLocator(page, f.sel);
        const visible = await loc.isVisible().catch(() => false);
        if (!visible) continue;
        const fs = await loc.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
        if (!isNaN(fs) && fs < 12) {
          verified.smallFonts.push({ ...f, reFontSize: fs, confirmed: true });
        }
      } catch { /* ignore */ }
    }

    // 4) 重叠复测
    const centerTop = await page.evaluate(() => {
      const el = document.elementFromPoint(Math.round(window.innerWidth / 2), Math.round(window.innerHeight / 2));
      if (!el) return null;
      const cs = getComputedStyle(el);
      return {
        tag: el.tagName.toLowerCase(),
        cls: (el.className || '').toString().slice(0, 100),
        pos: cs.position,
        zIndex: cs.zIndex,
        text: (el.textContent || '').trim().slice(0, 40),
      };
    });
    verified.centerTop = centerTop;
    for (const o of (entry.checks.overlays || [])) {
      try {
        const loc = elLocator(page, o.sel);
        const visible = await loc.isVisible().catch(() => false);
        if (!visible) continue;
        const info = await loc.evaluate((el) => {
          const cs = getComputedStyle(el);
          const r = el.getBoundingClientRect();
          const cx = Math.round(window.innerWidth / 2);
          const cy = Math.round(window.innerHeight / 2);
          const top = document.elementFromPoint(cx, cy);
          return {
            zIndex: parseInt(cs.zIndex, 10) || 0,
            pos: cs.position,
            rect: { left: Math.round(r.left), top: Math.round(r.top), width: Math.round(r.width), height: Math.round(r.height) },
            isTopAtCenter: top === el || el.contains(top),
          };
        });
        // 悬浮层必须与视口有实际交集（排除 off-canvas 抽屉）
        const inViewport = info.rect.left < vw && (info.rect.left + info.rect.width) > 0;
        if (inViewport && info.zIndex >= 100 && (info.pos === 'fixed' || info.pos === 'sticky' || info.pos === 'absolute')) {
          verified.overlays.push({ ...o, reZIndex: info.zIndex, rePos: info.pos, reIsTopAtCenter: info.isTopAtCenter, confirmed: true });
        }
      } catch { /* ignore */ }
    }
  } catch (e) {
    verified.fatal = String(e).slice(0, 200);
  } finally {
    await ctx.close();
  }
  return verified;
}

const verifiedAll = [];
for (const entry of data) {
  if (!entry.ok) { verifiedAll.push({ name: entry.name, route: entry.route, fatal: entry.error }); continue; }
  const v = await verifyPage(entry);
  verifiedAll.push(v);
  const counts = `overflow=${v.overflow?.confirmed ? 'YES' : 'no'} touch=${v.touch.length} small=${v.smallFonts.length} overlays=${v.overlays.length}`;
  console.log(`[${v.name}] ${counts}${v.fatal ? ' FATAL:' + v.fatal : ''}`);
}

writeFileSync(path.join(__dirname, 'mobile-audit-verified.json'), JSON.stringify(verifiedAll, null, 2), 'utf8');
console.log('\n===== 二次验证完成 =====');
await browser.close();