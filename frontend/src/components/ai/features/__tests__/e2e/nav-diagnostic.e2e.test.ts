import { test } from '@playwright/test';

test.describe('导航栏诊断测试', () => {
  test('桌面端导航栏功能诊断', async ({ page }) => {
    // 登录
    await page.goto('/login', { waitUntil: 'networkidle' });

    // 使用正确的选择器
    await page.waitForSelector('input#rhine-username', { timeout: 15000 });
    await page.fill('input#rhine-username', 'admin');
    await page.fill('input#rhine-password', 'rmfood2024!@#');
    await page.click('button[type="submit"]');

    // 等待登录成功（检查 URL 变化）
    await page.waitForURL('**/dashboard**', { timeout: 15000 });

    // 桌面端视图
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.waitForTimeout(1000);

    // 诊断导航栏状态
    const desktopInfo = await page.evaluate(() => {
      const sidebar = document.querySelector('aside');
      const header = document.querySelector('header');
      const hamburger = document.querySelector('[aria-label="打开菜单"]');
      const collapseBtn = document.querySelector('[aria-label="折叠导航栏"]');
      const overlay = document.querySelector('[aria-label="导航菜单遮罩"]');

      return {
        // 基本元素存在性
        sidebarExists: !!sidebar,
        sidebarVisible: sidebar ? sidebar.offsetParent !== null : false,
        sidebarWidth: sidebar ? Math.round(sidebar.getBoundingClientRect().width) : 0,
        sidebarTranslateX: sidebar ? getComputedStyle(sidebar).transform : 'N/A',
        sidebarPosition: sidebar ? getComputedStyle(sidebar).position : 'N/A',

        headerExists: !!header,
        headerHeight: header ? Math.round(header.getBoundingClientRect().height) : 0,

        hamburgerExists: !!hamburger,
        hamburgerVisible: hamburger ? hamburger.offsetParent !== null : false,
        hamburgerLeft: hamburger ? Math.round(hamburger.getBoundingClientRect().left) : 0,

        collapseBtnExists: !!collapseBtn,
        collapseBtnVisible: collapseBtn ? collapseBtn.offsetParent !== null : false,

        overlayExists: !!overlay,
        overlayVisible: overlay ? overlay.style.opacity !== '0' : false,

        // 实际可见性检查
        bodyPaddingLeft: getComputedStyle(document.body).paddingLeft,
        mainContentVisible: !!document.querySelector('main'),
      };
    });

    console.log('桌面端导航栏状态:', JSON.stringify(desktopInfo, null, 2));
    await page.screenshot({ path: 'D:/RMFOODFP/nav_diagnostic_desktop.png', fullPage: false });

    // 检查汉堡按钮点击
    if (desktopInfo.hamburgerExists) {
      await page.click('[aria-label="打开菜单"]');
      await page.waitForTimeout(500);

      const afterHamburgerClick = await page.evaluate(() => {
        const sidebar = document.querySelector('aside');
        return {
          sidebarTranslateX: sidebar ? getComputedStyle(sidebar).transform : 'N/A',
          sidebarWidth: sidebar ? Math.round(sidebar.getBoundingClientRect().width) : 0,
        };
      });
      console.log('点击汉堡后:', JSON.stringify(afterHamburgerClick, null, 2));
    }

    // 检查折叠按钮
    if (desktopInfo.collapseBtnExists) {
      await page.click('[aria-label="折叠导航栏"]');
      await page.waitForTimeout(500);

      const afterCollapse = await page.evaluate(() => {
        const sidebar = document.querySelector('aside');
        return {
          sidebarWidth: sidebar ? Math.round(sidebar.getBoundingClientRect().width) : 0,
          sidebarTranslateX: sidebar ? getComputedStyle(sidebar).transform : 'N/A',
        };
      });
      console.log('点击折叠后:', JSON.stringify(afterCollapse, null, 2));
      await page.screenshot({ path: 'D:/RMFOODFP/nav_diagnostic_collapsed.png', fullPage: false });

      // 恢复展开
      await page.click('[aria-label="展开导航栏"]');
      await page.waitForTimeout(300);
    }
  });

  test('移动端导航栏功能诊断', async ({ page }) => {
    // 登录
    await page.goto('/login', { waitUntil: 'networkidle' });
    await page.waitForSelector('input#rhine-username', { timeout: 15000 });
    await page.fill('input#rhine-username', 'admin');
    await page.fill('input#rhine-password', 'rmfood2024!@#');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard**', { timeout: 15000 });

    // 移动端视图
    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(1000);

    const mobileInfo = await page.evaluate(() => {
      const sidebar = document.querySelector('aside');
      const hamburger = document.querySelector('[aria-label="打开菜单"]');
      const overlay = document.querySelector('[aria-label="导航菜单遮罩"]');

      return {
        sidebarExists: !!sidebar,
        sidebarWidth: sidebar ? Math.round(sidebar.getBoundingClientRect().width) : 0,
        sidebarTranslateX: sidebar ? getComputedStyle(sidebar).transform : 'N/A',
        sidebarPosition: sidebar ? getComputedStyle(sidebar).position : 'N/A',
        sidebarDisplay: sidebar ? getComputedStyle(sidebar).display : 'N/A',

        hamburgerExists: !!hamburger,
        hamburgerVisible: hamburger ? hamburger.offsetParent !== null : false,
        hamburgerLeft: hamburger ? Math.round(hamburger.getBoundingClientRect().left) : 0,
        hamburgerTop: hamburger ? Math.round(hamburger.getBoundingClientRect().top) : 0,

        overlayExists: !!overlay,
        overlayVisible: overlay ? overlay.style.opacity !== '0' : false,
        overlayOpacity: overlay ? overlay.style.opacity : 'N/A',

        bodyPaddingLeft: getComputedStyle(document.body).paddingLeft,
      };
    });

    console.log('移动端导航栏状态:', JSON.stringify(mobileInfo, null, 2));
    await page.screenshot({ path: 'D:/RMFOODFP/nav_diagnostic_mobile.png', fullPage: false });

    // 点击汉堡按钮
    if (mobileInfo.hamburgerExists) {
      console.log('点击汉堡按钮...');
      await page.click('[aria-label="打开菜单"]');
      await page.waitForTimeout(500);

      const afterClick = await page.evaluate(() => {
        const sidebar = document.querySelector('aside');
        const overlay = document.querySelector('[aria-label="导航菜单遮罩"]');
        return {
          sidebarTranslateX: sidebar ? getComputedStyle(sidebar).transform : 'N/A',
          sidebarWidth: sidebar ? Math.round(sidebar.getBoundingClientRect().width) : 0,
          overlayOpacity: overlay ? overlay.style.opacity : 'N/A',
          bodyPaddingLeft: getComputedStyle(document.body).paddingLeft,
        };
      });
      console.log('点击汉堡后:', JSON.stringify(afterClick, null, 2));
      await page.screenshot({ path: 'D:/RMFOODFP/nav_diagnostic_mobile_open.png', fullPage: false });

      // 关闭侧边栏
      console.log('关闭侧边栏...');
      await page.click('[aria-label="关闭菜单"]');
      await page.waitForTimeout(500);

      const afterClose = await page.evaluate(() => {
        const sidebar = document.querySelector('aside');
        return {
          sidebarTranslateX: sidebar ? getComputedStyle(sidebar).transform : 'N/A',
        };
      });
      console.log('关闭后:', JSON.stringify(afterClose, null, 2));
    } else {
      console.log('错误：未找到汉堡按钮！');
    }
  });

  test('平板端导航栏功能诊断', async ({ page }) => {
    // 登录
    await page.goto('/login', { waitUntil: 'networkidle' });
    await page.waitForSelector('input#rhine-username', { timeout: 15000 });
    await page.fill('input#rhine-username', 'admin');
    await page.fill('input#rhine-password', 'rmfood2024!@#');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard**', { timeout: 15000 });

    // 平板端视图
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(1000);

    const tabletInfo = await page.evaluate(() => {
      const sidebar = document.querySelector('aside');
      const hamburger = document.querySelector('[aria-label="打开菜单"]');
      const overlay = document.querySelector('[aria-label="导航菜单遮罩"]');

      return {
        sidebarExists: !!sidebar,
        sidebarWidth: sidebar ? Math.round(sidebar.getBoundingClientRect().width) : 0,
        sidebarTranslateX: sidebar ? getComputedStyle(sidebar).transform : 'N/A',
        sidebarPosition: sidebar ? getComputedStyle(sidebar).position : 'N/A',

        hamburgerExists: !!hamburger,
        hamburgerVisible: hamburger ? hamburger.offsetParent !== null : false,

        overlayExists: !!overlay,
        overlayVisible: overlay ? overlay.style.opacity !== '0' : false,
      };
    });

    console.log('平板端导航栏状态:', JSON.stringify(tabletInfo, null, 2));
    await page.screenshot({ path: 'D:/RMFOODFP/nav_diagnostic_tablet.png', fullPage: false });
  });
});
