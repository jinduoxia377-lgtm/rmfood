const { chromium } = require('@playwright/test');
(async () => {
  const b = await chromium.launch({ headless: true });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, locale: 'zh-CN' });
  const p = await ctx.newPage();
  const errs = [];
  p.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 160)); });
  p.on('pageerror', (e) => errs.push('pageerror: ' + String(e).slice(0, 220)));
  await p.goto('http://127.0.0.1:3000/login', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(2500);
  await p.fill('input[type="text"]', 'admin');
  await p.fill('input[type="password"]', 'admin123');
  const btn = await p.locator('button[type="submit"], button:has-text("登录"), button:has-text("进入平台")').first();
  if (await btn.count() > 0) { await btn.click(); try { await p.waitForURL(u => !u.pathname.includes('/login'), { timeout: 40000 }); } catch {} await p.waitForTimeout(3000); }
  await p.goto('http://127.0.0.1:3000/ai', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await p.waitForTimeout(4000);
  const tabs = await p.evaluate(() => document.querySelectorAll('[role="tabpanel"]').length);
  const btns = await p.evaluate(() => document.querySelectorAll('[role="tab"]').length);
  const bodyText = await p.evaluate(() => document.body.innerText.slice(0, 260));
  console.log('URL: ' + p.url());
  console.log('tabpanels: ' + tabs + '  tabroles: ' + btns);
  console.log('BODY: ' + bodyText.replace(/\n/g, ' ~ '));
  console.log('ERRORS(' + errs.length + '):');
  errs.forEach(e => console.log('  ' + e));
  await b.close();
})().catch(e => { console.error('PROBE_ERR', e.message); process.exit(1); });
