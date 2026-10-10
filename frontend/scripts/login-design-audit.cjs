const { chromium } = require('D:/RMFOODFP/frontend/node_modules/.pnpm/playwright-core@1.61.1/node_modules/playwright-core');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const warnings = [];
  page.on('console', (m) => { if (m.type() === 'warning' || m.type() === 'error') warnings.push(m.type() + ': ' + m.text().slice(0, 200)); });

  await page.goto('http://127.0.0.1:3000/login', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);
  await page.locator('.rhine-preregister-toggle').click();
  await page.waitForTimeout(600);

  const report = await page.evaluate(() => {
    const out = [];
    const c = (sel, prop) => {
      const el = document.querySelector(sel);
      return el ? getComputedStyle(el)[prop] : 'MISSING';
    };
    const r = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return 'MISSING';
      const b = el.getBoundingClientRect();
      return Math.round(b.width) + 'x' + Math.round(b.height);
    };

    out.push('--- 字号层级 ---');
    out.push('页面标题 h2          ' + c('.rhine-card-header h2', 'fontSize') + ' / lh ' + c('.rhine-card-header h2', 'lineHeight'));
    out.push('副标题 sub           ' + c('.rhine-card-header p', 'fontSize'));
    out.push('表单标签 label       ' + c('.rhine-label', 'fontSize'));
    out.push('输入框 input         ' + c('.rhine-input', 'fontSize'));
    out.push('主按钮 submit        ' + c('.rhine-submit-btn', 'fontSize'));
    out.push('预注册标题           ' + c('.rhine-preregister-title', 'fontSize'));
    out.push('预注册说明 sub       ' + c('.rhine-preregister-sub', 'fontSize'));
    out.push('预注册入口 toggle    ' + c('.rhine-preregister-toggle', 'fontSize'));
    out.push('安全提示             ' + c('.rhine-security-note', 'fontSize'));
    out.push('页脚链接             ' + c('.rhine-footer-links', 'fontSize'));

    out.push('--- 触控目标 (>=44px) ---');
    out.push('主登录按钮           ' + r('.rhine-submit-btn'));
    out.push('预注册入口           ' + r('.rhine-preregister-toggle'));
    out.push('预注册提交           ' + r('.rhine-preregister-submit'));
    out.push('预注册返回           ' + r('.rhine-preregister-cancel'));
    out.push('邮箱输入框           ' + r('#rhine-prereg-email'));

    out.push('--- 颜色 ---');
    out.push('主按钮底/字          ' + c('.rhine-submit-btn', 'backgroundColor') + ' / ' + c('.rhine-submit-btn', 'color'));
    out.push('预注册提交底/字      ' + c('.rhine-preregister-submit', 'backgroundColor') + ' / ' + c('.rhine-preregister-submit', 'color'));
    out.push('预注册入口字         ' + c('.rhine-preregister-toggle', 'color'));
    out.push('预注册入口底         ' + c('.rhine-preregister-toggle', 'backgroundColor'));
    out.push('卡片底/边            ' + c('.rhine-card', 'backgroundColor') + ' / ' + c('.rhine-card', 'borderColor'));
    out.push('页面底               ' + c('.rhine-form-panel', 'backgroundColor'));
    out.push('输入框边             ' + c('.rhine-input', 'borderColor'));

    out.push('--- 圆角 ---');
    out.push('卡片                 ' + c('.rhine-card', 'borderRadius'));
    out.push('按钮                 ' + c('.rhine-submit-btn', 'borderRadius'));
    out.push('输入框               ' + c('.rhine-input', 'borderRadius'));

    return out.join('\n');
  });

  console.log(report);
  console.log('\n--- 控制台告警/错误 (' + warnings.length + ') ---');
  console.log(warnings.slice(0, 15).join('\n') || '(无)');
  await browser.close();
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
