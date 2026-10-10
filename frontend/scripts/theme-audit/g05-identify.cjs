const { chromium } = require('@playwright/test');
(async () => {
  const b = await chromium.launch({ headless: true });
  const ctx = await b.newContext({ viewport: { width: 1680, height: 1050 }, locale: 'zh-CN', colorScheme: 'light' });
  const p = await ctx.newPage();
  await p.goto('http://127.0.0.1:3000/login', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await p.waitForTimeout(3200);
  const pw = await p.$('input[type="password"]');
  if (pw) {
    await p.fill('input[type="text"]', 'admin');
    await p.fill('input[type="password"]', 'admin123');
    const btn = await p.locator('button[type="submit"], button:has-text("登录")').first();
    if (await btn.count() > 0) { await btn.click(); try { await p.waitForURL(u => !u.pathname.includes('/login'), { timeout: 45000 }); } catch {} await p.waitForTimeout(4000); }
  }
  for (const route of ['/formulas', '/analytics']) {
    await p.goto('http://127.0.0.1:3000' + route, { waitUntil: 'domcontentloaded', timeout: 70000 });
    await p.waitForTimeout(3600);
    const rows = await p.evaluate(() => {
      const out = [];
      for (const e of document.querySelectorAll('body *')) {
        const cls = (typeof e.className === 'string') ? e.className : '';
        if (!/(^|\s)text-white(\/\d+)?(\s|$)/.test(cls)) continue;
        const r = e.getBoundingClientRect();
        if (r.width < 20 || r.height < 14) continue;
        const cs = getComputedStyle(e);
        if (cs.backgroundColor === 'rgba(0, 0, 0, 0)' || cs.backgroundColor === 'transparent') continue;
        out.push({ cls: cls.slice(0, 160), bg: cs.backgroundColor, text: (e.textContent || '').trim().slice(0, 40), tag: e.tagName });
      }
      return out;
    });
    console.log('\n══ ' + route + ' light-default: ' + rows.length + ' text-white 实底元素 ══');
    rows.slice(0, 12).forEach(r => console.log('  [' + r.tag + '] bg=' + r.bg + ' · "' + r.text + '"\n      cls: ' + r.cls));
  }
  await b.close();
})().catch(e => { console.error('PROBE_ERR', e.message); process.exit(1); });
