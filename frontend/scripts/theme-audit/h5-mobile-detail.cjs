// H5 移动端精化探针：判定溢出元素是否可见/被裁剪 + 截图
const { chromium } = require('@playwright/test');

const ROUTES = ['/ai', '/settings', '/organizations', '/databases', '/compliance', '/'];

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });

  await page.goto('http://localhost:3000/login', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  for (let i = 1; i <= 3; i++) {
    await page.fill('input[type="text"], input[name="username"]', 'admin').catch(() => {});
    await page.fill('input[type="password"]', 'admin123').catch(() => {});
    await page.click('button[type="submit"]').catch(() => {});
    await page.waitForTimeout(3500);
    if (!/\/login/.test(page.url())) break;
  }

  for (const route of ROUTES) {
    try {
      await page.goto('http://localhost:3000' + route, { waitUntil: 'domcontentloaded', timeout: 30000 });
    } catch (e) { continue; }
    await page.waitForTimeout(4000);

    const m = await page.evaluate(() => {
      const vw = window.innerWidth;
      const out = [];
      for (const el of document.querySelectorAll('body *')) {
        const r = el.getBoundingClientRect();
        if (r.width <= 0 || r.height <= 0 || r.right <= vw + 2) continue;
        if (getComputedStyle(el).position === 'fixed') continue;
        // 向上找是否有 overflow hidden/auto 祖先（会被裁剪/滚动）
        let a = el.parentElement, clipped = false, scrollable = false;
        while (a && a !== document.body) {
          const o = getComputedStyle(a).overflowX;
          if (o === 'hidden') clipped = true;
          if (o === 'auto' || o === 'scroll') { scrollable = true; break; }
          a = a.parentElement;
        }
        out.push({
          tag: el.tagName.toLowerCase(),
          cls: String(el.className).slice(0, 50),
          right: Math.round(r.right), left: Math.round(r.left),
          clipped, scrollable,
        });
      }
      return { vw, out: out.slice(0, 20), count: out.length };
    });

    console.log(`\n[${route}] 超界元素 ${m.count} 个（视口 ${m.vw}px）`);
    for (const o of m.out) {
      console.log(`  <${o.tag}> ${o.cls} [${o.left},${o.right}] ${o.clipped ? '(被裁剪)' : ''}${o.scrollable ? '(可滚动父级)' : '(⚠️ 可能可见溢出)'}`);
    }

    // 截图
    await page.screenshot({ path: `scripts/theme-audit/h5-${route.replace(/\//g, '_') || 'root'}.png`, fullPage: false });
  }

  await browser.close();
})();