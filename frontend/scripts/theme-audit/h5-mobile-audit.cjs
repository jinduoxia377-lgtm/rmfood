// H5 移动端适配探针：375x812 视口下实测各页面横向溢出/触控/布局表现
const { chromium } = require('@playwright/test');

const ROUTES = [
  '/', '/dashboard', '/formulas', '/formulas/new', '/formulas/cases',
  '/databases', '/ai', '/experiments', '/organizations', '/settings',
  '/compliance', '/ingredients', '/billing',
];

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });

  // 登录
  await page.goto('http://localhost:3000/login', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  for (let i = 1; i <= 3; i++) {
    await page.fill('input[type="text"], input[name="username"], input[placeholder*="账号" i]', 'admin').catch(() => {});
    await page.fill('input[type="password"], input[name="password"]', 'admin123').catch(() => {});
    await page.click('button[type="submit"], button:has-text("进入平台")').catch(() => {});
    await page.waitForTimeout(3500);
    if (!/\/login/.test(page.url())) break;
  }
  console.log('登录后 URL:', page.url());

  for (const route of ROUTES) {
    const url = 'http://localhost:3000' + route;
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    } catch (e) {
      console.log(`\n[${route}] 加载失败: ${e.message.split('\n')[0]}`);
      continue;
    }
    // 等待内容
    await page.waitForTimeout(3500);

    const m = await page.evaluate(() => {
      const d = document.documentElement;
      const vw = window.innerWidth;
      const overflow = d.scrollWidth > vw + 1;
      const overflowAmt = d.scrollWidth - vw;
      // 找溢出元素（右边界超出视口 > 2px 且非故意离屏）
      const offenders = [];
      for (const el of document.querySelectorAll('body *')) {
        const r = el.getBoundingClientRect();
        if (r.width <= 0 || r.height <= 0) continue;
        const cs = getComputedStyle(el);
        if (cs.position === 'fixed' && (r.left < -10 || r.right > vw + 10)) {
          // fixed 抽屉/弹层：记录但不算溢出
          continue;
        }
        if (r.right > vw + 2 && cs.position !== 'fixed') {
          offenders.push({
            tag: el.tagName.toLowerCase(),
            cls: String(el.className).slice(0, 60),
            left: Math.round(r.left), right: Math.round(r.right),
          });
        }
      }
      // 触控目标：可见 button/a 高度 < 44px 的数量
      let smallTargets = 0;
      for (const el of document.querySelectorAll('button, a[href], [role="button"]')) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        if (r.height < 44 && r.height > 0) smallTargets++;
      }
      const bottomNav = !!document.querySelector('[class*="fixed bottom-0"], [class*="MobileBottomNav"]');
      const sidebarVisible = !!document.querySelector('aside, [class*="AppSidebar"]');
      return {
        vw, scrollW: d.scrollWidth, overflow, overflowAmt,
        offenders: offenders.slice(0, 6), offenderCount: offenders.length,
        smallTargets,
        bottomNav, sidebarVisible,
        bodyChildren: document.body.children.length,
      };
    });

    console.log(`\n[${route}]`);
    console.log(`  视口 ${m.vw}px / scrollWidth ${m.scrollW}px  ${m.overflow ? `❌ 横向溢出 ${m.overflowAmt}px` : '✅ 无横向溢出'}`);
    console.log(`  溢出元素 ${m.offenderCount} 个${m.offenders.length ? '：' : ''}`);
    for (const o of m.offenders.slice(0, 4)) {
      console.log(`    <${o.tag}> ${o.cls}  [${o.left}, ${o.right}]`);
    }
    console.log(`  触控目标<44px: ${m.smallTargets}  |  底部导航: ${m.bottomNav ? '有' : '无'}  侧边栏: ${m.sidebarVisible ? '可见' : '隐藏'}`);
  }

  await browser.close();
})();