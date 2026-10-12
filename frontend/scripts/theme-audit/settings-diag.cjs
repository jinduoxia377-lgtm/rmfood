// 诊断：/settings 是否可达、主题面板是否渲染
const { chromium } = require('@playwright/test');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:3000/settings?tab=theme', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  console.log('finalURL:', page.url());
  console.log('title:', await page.title());
  const text = (await page.evaluate(() => document.body.innerText || '')).slice(0, 600);
  console.log('--- body text (600) ---\n' + text);
  console.log('--- h2/h3 ---');
  console.log(await page.evaluate(() => [...document.querySelectorAll('h1,h2,h3')].map(e=>e.tagName+':'+e.textContent.trim().slice(0,40)).slice(0,30)));
  console.log('radiogroups:', await page.evaluate(() =>
    [...document.querySelectorAll('[role="radiogroup"]')].map(g => g.getAttribute('aria-label'))));
  console.log('sections:', await page.evaluate(() =>
    [...document.querySelectorAll('section')].length));
  console.log('palette tabs:', await page.evaluate(() =>
    [...document.querySelectorAll('button,a')].map(b=>b.textContent.trim()).filter(t=>t==='主题'||t==='账户'||t==='安全').slice(0,10)));
  await browser.close();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
