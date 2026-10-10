const { chromium } = require('D:/RMFOODFP/frontend/node_modules/.pnpm/playwright-core@1.61.1/node_modules/playwright-core');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://127.0.0.1:3000/login', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2500);

  // 折叠态测量（不点击）
  const collapsed = await page.evaluate(() => {
    const el = document.querySelector('.rhine-preregister-toggle');
    if (!el) return 'MISSING';
    const b = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return {
      size: Math.round(b.width) + 'x' + Math.round(b.height),
      bg: cs.backgroundColor,
      color: cs.color,
      border: cs.borderWidth + ' ' + cs.borderStyle,
      fontSize: cs.fontSize,
      fontWeight: cs.fontWeight,
      text: el.textContent.trim(),
    };
  });
  console.log('折叠态 toggle:', JSON.stringify(collapsed, null, 2));

  // 对比主按钮层级
  const hierarchy = await page.evaluate(() => {
    const sub = document.querySelector('.rhine-submit-btn');
    const cs = getComputedStyle(sub);
    return { submitBg: cs.backgroundColor, submitColor: cs.color, submitH: Math.round(sub.getBoundingClientRect().height) };
  });
  console.log('主按钮:', JSON.stringify(hierarchy));

  await page.screenshot({ path: 'D:/RMFOODFP/frontend/ux-collapsed.png', fullPage: true });

  // 展开态
  await page.locator('.rhine-preregister-toggle').click();
  await page.waitForTimeout(600);
  const expanded = await page.evaluate(() => {
    const out = {};
    const sub = document.querySelector('.rhine-preregister-submit');
    const can = document.querySelector('.rhine-preregister-cancel');
    const cs = getComputedStyle(can);
    out.submit = { size: Math.round(sub.getBoundingClientRect().width) + 'x' + Math.round(sub.getBoundingClientRect().height), bg: getComputedStyle(sub).backgroundColor };
    out.cancel = { size: Math.round(can.getBoundingClientRect().width) + 'x' + Math.round(can.getBoundingClientRect().height), bg: cs.backgroundColor, border: cs.borderWidth + ' ' + cs.borderColor, color: cs.color };
    out.headTitle = document.querySelector('.rhine-preregister-title').textContent.trim();
    out.headSub = document.querySelector('.rhine-preregister-sub').textContent.trim();
    return out;
  });
  console.log('展开态:', JSON.stringify(expanded, null, 2));
  await page.screenshot({ path: 'D:/RMFOODFP/frontend/ux-expanded.png', fullPage: true });

  await browser.close();
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
