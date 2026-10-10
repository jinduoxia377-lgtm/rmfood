const { chromium } = require('D:/RMFOODFP/frontend/node_modules/.pnpm/playwright-core@1.61.1/node_modules/playwright-core');

const GRID = [0, 4, 8, 16, 24, 32, 48];

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://127.0.0.1:3000/login', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2500);
  await page.locator('.rhine-preregister-toggle').click();
  await page.waitForTimeout(600);

  const rows = await page.evaluate((grid) => {
    const items = [];

    // 卡片顶层直属块
    const topSelectors = [
      '.rhine-card-header',
      '.rhine-form-group',
      '.rhine-form-options',
      '.rhine-submit-btn',
      '.rhine-preregister',
      '.rhine-security-note',
      '.rhine-footer',
    ];

    topSelectors.forEach(function (sel) {
      document.querySelectorAll(sel).forEach(function (el) {
        // 预注册内部元素跳过顶层采集
        if (sel !== '.rhine-preregister' && el.closest('.rhine-preregister')) return;
        const b = el.getBoundingClientRect();
        if (b.height > 0) items.push({ sel: sel, top: Math.round(b.top), bottom: Math.round(b.bottom) });
      });
    });

    items.sort(function (a, b) { return a.top - b.top; });

    const out = [];
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (i === 0) {
        out.push(it.sel.padEnd(28) + 'top=' + it.top);
        continue;
      }
      const gap = it.top - items[i - 1].bottom;
      const ok = grid.indexOf(gap) >= 0;
      out.push(it.sel.padEnd(28) + 'gap=' + String(gap).padStart(4) + (ok ? '  OK' : '  <-- OFF-GRID'));
    }

    // 预注册模块内部节奏（只取 form 直属子块，避免把 head 的子元素误判为兄弟）
    const inner = [];
    const preForm = document.querySelector('.rhine-preregister-form');
    if (preForm) {
      const pitems = [];
      for (let i = 0; i < preForm.children.length; i++) {
        const el = preForm.children[i];
        const b = el.getBoundingClientRect();
        if (b.height > 0) pitems.push({ sel: String(el.className).split(' ')[0], top: Math.round(b.top), bottom: Math.round(b.bottom) });
      }
      for (let i = 1; i < pitems.length; i++) {
        const gap = pitems[i].top - pitems[i - 1].bottom;
        const ok = grid.indexOf(gap) >= 0;
        inner.push('  [pre] ' + pitems[i].sel.padEnd(30) + 'gap=' + String(gap).padStart(4) + (ok ? '  OK' : '  <-- OFF-GRID'));
      }
    }

    return out.concat(['--- 预注册模块内部 ---'], inner).join('\n');
  }, GRID);

  console.log(rows);
  await browser.close();
})().catch(function (e) { console.error('FAILED:', e.message); process.exit(1); });
