const { chromium } = require('D:/RMFOODFP/frontend/node_modules/.pnpm/playwright-core@1.61.1/node_modules/playwright-core');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://127.0.0.1:3000/login', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2500);

  const state = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll('.rhine-input').forEach((el) => {
      const cs = getComputedStyle(el);
      out.push(
        (el.id || el.type).padEnd(22) +
          ' class="' + el.className + '"' +
          ' aria-invalid=' + (el.getAttribute('aria-invalid') || '-') +
          ' border=' + cs.borderColor
      );
    });
    const alerts = [];
    document.querySelectorAll('.rhine-alert, .rhine-error-text').forEach((el) => {
      alerts.push(el.className + ' :: ' + el.textContent.trim().slice(0, 60));
    });
    return { inputs: out, alerts, hasErrClass: !!document.querySelector('.rhine-input.error') };
  });

  console.log('--- inputs ---');
  console.log(state.inputs.join('\n') || '(none)');
  console.log('--- alerts/errors ---');
  console.log(state.alerts.join('\n') || '(none)');
  console.log('hasErrorClass:', state.hasErrClass);
  await browser.close();
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
