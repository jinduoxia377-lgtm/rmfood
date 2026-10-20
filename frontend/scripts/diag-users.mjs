import { chromium } from '@playwright/test';

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  const pageErrors = [];
  page.on('pageerror', e => pageErrors.push(String(e && e.message || e)));
  const failedReqs = [];
  page.on('response', r => { if (r.status() >= 400) failedReqs.push(`${r.status()} ${r.url()}`); });

  // capture network calls to admin users
  const apiCalls = [];
  page.on('response', r => {
    const u = r.url();
    if (/admin\/users|\/users\?|api\/v1\/users/.test(u)) apiCalls.push(`${r.status()} ${u.replace('http://localhost:3000','')}`);
  });

  await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });
  await page.waitForSelector('input#rhine-username', { timeout: 20000 }).catch(()=>{});
  if (await page.$('input#rhine-username')) {
    await page.fill('input#rhine-username', 'admin');
    await page.fill('input#rhine-password', 'admin123');
    await Promise.all([
      page.waitForResponse(r => /auth\/login/.test(r.url()), { timeout: 20000 }).catch(()=>{}),
      page.click('button[type=submit]').catch(()=>{}),
    ]);
    await page.waitForURL('**/dashboard**', { timeout: 25000 }).catch(()=>{});
  }
  await page.goto('http://localhost:3000/users', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  const h1 = await page.locator('h1:has-text("用户管理")').count().catch(()=>0);
  const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 1500));
  const tableCard = await page.evaluate(() => {
    const el = document.getElementById('user-table-card');
    if (!el) return { exists:false, text: '' };
    return { exists:true, text: el.innerText.slice(0,500) };
  });
  const rows = await page.evaluate(() => document.querySelectorAll('#user-table-card tbody tr').length);
  const pills = await page.evaluate(() => [...document.querySelectorAll('#user-table-card span.rounded-full')].map(s=>s.textContent.trim()));
  const errorText = await page.evaluate(() => {
    const m = document.body.innerText.match(/(出错了|加载失败|网络错误|无法|Error|error|500|403|401)/gi);
    return m ? m.slice(0,20) : [];
  });
  console.log(JSON.stringify({
    currentUrl: page.url(),
    h1count: h1,
    rows,
    pills,
    errorText,
    pageErrors: pageErrors.slice(0,10),
    apiCalls: apiCalls.slice(0,30),
    failedReqs: failedReqs.slice(0,20),
    bodySnippet: bodyText,
    tableCard: tableCard.text || '(no #user-table-card)'
  }, null, 2));

  await page.screenshot({ path: 'D:/RMFOODFP/users-current.png', fullPage: true });
  await b.close();
})();
