const { chromium } = require('@playwright/test');

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
  await p.goto('http://localhost:3000/login', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(2500);
  for (let i = 1; i <= 3; i++) {
    await p.fill('input[type=text], input[name=username]', 'admin').catch(() => {});
    await p.fill('input[type=password]', 'admin123').catch(() => {});
    await p.click('button[type=submit]').catch(() => {});
    await p.waitForTimeout(3500);
    if (!/\/login/.test(p.url())) break;
  }
  for (const route of ['/ai', '/organizations', '/formulas/new', '/billing', '/dashboard']) {
    await p.goto('http://localhost:3000' + route, { waitUntil: 'domcontentloaded' });
    await p.waitForTimeout(4000);
    const items = await p.evaluate(() => {
      const out = [];
      for (const el of document.querySelectorAll('button, a[href], [role=button]')) {
        const r = el.getBoundingClientRect();
        if (r.width < 10 || r.height <= 0 || r.height >= 44) continue;
        if (r.top < 0 || r.bottom > window.innerHeight + 50) continue;
        out.push({
          tag: el.tagName.toLowerCase(),
          text: (el.textContent || '').trim().slice(0, 18),
          h: Math.round(r.height),
          w: Math.round(r.width),
          cls: String(el.className).slice(0, 50),
        });
      }
      return out.slice(0, 15);
    });
    console.log('\n[' + route + '] 视口内 <44px 目标 ' + items.length + ' 个（前 15）');
    for (const it of items) {
      console.log('  <' + it.tag + '> h=' + it.h + ' w=' + it.w + ' "' + it.text + '" ' + it.cls);
    }
  }
  await b.close();
})();