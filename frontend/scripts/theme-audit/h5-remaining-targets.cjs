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
  const routes = ['/dashboard', '/formulas', '/formulas/new', '/formulas/cases', '/databases', '/ai', '/experiments', '/organizations', '/settings', '/compliance', '/ingredients', '/billing'];
  const all = [];
  for (const r of routes) {
    await p.goto('http://localhost:3000' + r, { waitUntil: 'domcontentloaded' });
    await p.waitForTimeout(4000);
    const items = await p.evaluate(() => {
      const out = [];
      for (const el of document.querySelectorAll('button, a[href], [role=button]')) {
        const rc = el.getBoundingClientRect();
        if (rc.width < 10 || rc.height <= 0 || rc.height >= 44) continue;
        if (rc.top < 0 || rc.bottom > window.innerHeight + 50) continue;
        let a = el.parentElement, scaled = false;
        while (a && a !== document.body) {
          const cs = getComputedStyle(a).transform;
          if (cs && cs !== 'none' && cs !== 'matrix(1, 0, 0, 1, 0, 0)') { scaled = true; break; }
          if (getComputedStyle(a).display === 'none') { scaled = true; break; }
          a = a.parentElement;
        }
        if (scaled) continue;
        out.push({
          route: location.pathname,
          tag: el.tagName.toLowerCase(),
          h: Math.round(rc.height),
          w: Math.round(rc.width),
          text: (el.textContent || '').trim().slice(0, 16),
          cls: String(el.className).slice(0, 55),
        });
      }
      return out;
    });
    all.push(...items);
  }
  console.log('排除缩放弹层后，各路由真正 <44px 的目标总数：' + all.length);
  for (const it of all) {
    console.log('  ' + it.route + '  <' + it.tag + '> h=' + it.h + ' "' + it.text + '" ' + it.cls);
  }
  await b.close();
})();