// F2 / 幻影令牌 取证：读运行时 CSS 变量真值 + 采样真实元素计算值
const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.goto('http://localhost:3000/login', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  await page.fill('input[type="text"]', 'admin');
  await page.fill('input[type="password"]', 'admin123');
  await page.click('button[type="submit"], button:has-text("进入平台")');
  await page.waitForTimeout(3500);
  await page.goto('http://localhost:3000/settings?tab=theme', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);

  const VARS = [
    '--color-primary-main','--color-primary','--color-primary-container','--color-primary-surface',
    '--color-primary-light','--color-primary-dark','--color-primary-contrast-text',
    '--color-text-primary','--color-text-secondary','--color-text-muted','--color-text-disabled',
    '--color-surface-default','--color-surface-elevated','--color-surface-hover','--color-surface-variant',
    '--color-surface-container','--color-background-elevated','--color-background-hover',
    '--color-border-default','--color-secondary-main','--color-accent-main','--color-warning-main',
    // shadcn 源令牌（这些应当有值）
    '--text-primary','--text-secondary','--text-muted','--text-disabled',
    '--surface-default','--surface-elevated','--surface-hover','--surface-variant','--surface-container',
    '--background-elevated','--background-hover','--background','--border-color',
  ];

  const out = await page.evaluate((VARS) => {
    const rs = getComputedStyle(document.documentElement);
    const v = {};
    for (const k of VARS) v[k] = rs.getPropertyValue(k).trim();
    return v;
  }, VARS);

  // 正确版规则检测：直接扫 cssText 文本
  const CLASSES = ['text-primary-main','bg-primary-main','text-primary-container',
    'border-primary-main','bg-primary-container','bg-primary-main/5','ring-primary-main/30',
    'ring-primary-main/50','border-primary-main/50','from-primary-main','to-primary-dark',
    'text-primary-contrast-text','bg-primary-light','text-primary-light',
    'text-secondary-main','bg-secondary-container','text-accent-main','text-warning-main',
    'bg-primary-500','text-primary-foreground','text-text-primary'];
  const rules = await page.evaluate((CLS) => {
    const res = {};
    for (const cls of CLS) {
      const esc = cls.replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&');
      const re = new RegExp('\\.' + esc + '(?:[\\s,:{>+~]|$)');
      let n = 0, sample = '';
      for (const sheet of Array.from(document.styleSheets)) {
        let rules; try { rules = sheet.cssRules; } catch { continue; }
        if (!rules) continue;
        for (const r of Array.from(rules)) {
          if (r.cssRules) { for (const r2 of Array.from(r.cssRules)) {
            const c = r2.cssText || '';
            if (re.test(c)) { n++; if (!sample) sample = c.slice(0, 120); }
          }}
          const c = r.cssText || '';
          if (re.test(c)) { n++; if (!sample) sample = c.slice(0, 120); }
        }
      }
      res[cls] = { n, sample };
    }
    return res;
  }, CLASSES);

  await browser.close();

  console.log('\n══ 运行时 CSS 变量真值 ══');
  const miss = [];
  for (const [k, val] of Object.entries(out)) {
    const m = val ? '' : '   ← 空（未定义）';
    if (!val) miss.push(k);
    console.log('  ' + k.padEnd(32) + '"' + val + '"' + m);
  }

  console.log('\n══ 类名 → 产物规则 ══');
  for (const [c, r] of Object.entries(rules)) {
    console.log('  ' + c.padEnd(26) + (r.n ? '🟢 ' + r.n + ' 条   ' + r.sample : '🔴 无规则'));
  }
  if (errs.length) console.log('\npageerror: ' + errs.slice(0, 3).join(' | '));
})();
