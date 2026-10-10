const { chromium } = require('D:/RMFOODFP/frontend/node_modules/.pnpm/playwright-core@1.61.1/node_modules/playwright-core');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://127.0.0.1:3000/login', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2500);
  await page.locator('.rhine-preregister-toggle').click();
  await page.waitForTimeout(600);

  const out = await page.evaluate(() => {
    const lines = [];
    const pre = document.querySelector('.rhine-preregister');
    const walk = (el, depth) => {
      if (depth > 4) return;
      const b = el.getBoundingClientRect();
      if (b.height <= 0) return;
      const cs = getComputedStyle(el);
      lines.push(
        '  '.repeat(depth) +
          (el.className || el.tagName).toString().slice(0, 34).padEnd(36) +
          ' h=' + String(Math.round(b.height)).padStart(4) +
          ' mt=' + cs.marginTop.padStart(6) +
          ' mb=' + cs.marginBottom.padStart(6) +
          ' top=' + String(Math.round(b.top)).padStart(5)
      );
      for (let i = 0; i < el.children.length; i++) walk(el.children[i], depth + 1);
    };
    walk(pre, 0);
    return lines.join('\n');
  });

  console.log(out);
  await browser.close();
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
