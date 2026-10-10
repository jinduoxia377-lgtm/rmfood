const { chromium } = require('D:/RMFOODFP/frontend/node_modules/.pnpm/playwright-core@1.61.1/node_modules/playwright-core');

const GRID = [0, 4, 8, 16, 24, 32, 48];

(async () => {
  const browser = await chromium.launch();

  for (const vp of [{ w: 1440, h: 900, tag: 'desktop' }, { w: 390, h: 844, tag: 'mobile' }]) {
    const page = await browser.newPage({ viewport: { width: vp.w, height: vp.h } });
    await page.goto('http://127.0.0.1:3000/login', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2500);

    const collapsed = await page.evaluate((grid) => {
      const out = [];
      const sels = ['.rhine-card-header', '.rhine-form-group', '.rhine-form-options', '.rhine-submit-btn', '.rhine-preregister', '.rhine-security-note', '.rhine-footer'];
      const items = [];
      sels.forEach((sel) => {
        document.querySelectorAll(sel).forEach((el) => {
          if (sel !== '.rhine-preregister' && el.closest('.rhine-preregister')) return;
          const b = el.getBoundingClientRect();
          if (b.height > 0) items.push({ sel, top: Math.round(b.top), bottom: Math.round(b.bottom) });
        });
      });
      items.sort((a, b) => a.top - b.top);
      for (let i = 1; i < items.length; i++) {
        const gap = items[i].top - items[i - 1].bottom;
        out.push(items[i].sel.padEnd(26) + 'gap=' + String(gap).padStart(4) + (grid.indexOf(gap) >= 0 ? '  OK' : '  <-- OFF-GRID'));
      }
      const body = document.body;
      const overflow = body.scrollHeight > innerHeight;
      out.push('page: scrollH=' + body.scrollHeight + ' viewport=' + innerHeight + ' ' + (overflow ? 'scrolls' : 'fits'));
      return out.join('\n');
    }, GRID);

    console.log('=== ' + vp.tag + ' (' + vp.w + 'x' + vp.h + ') 折叠态 ===');
    console.log(collapsed);

    if (vp.tag === 'mobile') {
      const tw = await page.evaluate(() => {
        const el = document.querySelector('.rhine-preregister-toggle');
        if (!el) return 'no toggle';
        const b = el.getBoundingClientRect();
        return 'toggle w=' + Math.round(b.width) + ' h=' + Math.round(b.height) +
          ' cardW=' + Math.round(document.querySelector('.rhine-card').getBoundingClientRect().width) +
          ' viewportW=' + innerWidth;
      });
      console.log(tw);
    }

    await page.screenshot({ path: 'D:/RMFOODFP/frontend/ux-verify-' + vp.tag + '.png', fullPage: true });
    await page.close();
    console.log('');
  }

  await browser.close();
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
