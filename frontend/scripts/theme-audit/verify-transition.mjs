// T-D4 验证：主题切换不得在 <html> 上写入 inline opacity / transform（D-8）
// 同时检查 .theme-transition 类的挂载与卸载
import { chromium } from '@playwright/test';
import fs from 'node:fs';

const BASE = 'http://127.0.0.1:3000';
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 }, locale: 'zh-CN', colorScheme: 'light' });
const page = await ctx.newPage();
await page.addInitScript(`(function(){
  window.__store=null;
  window.__getStore=async function(){ if(window.__store) return window.__store;
    for (const p of ['/src/stores/themeStore.ts','/src/stores/themeStore']) {
      try{const m=await import(/* @vite-ignore */ p); if(m&&m.useThemeStore){window.__store=m.useThemeStore;return window.__store;}}catch(e){}
    } return null; };
  window.__setAll=async function(id, tt){
    const s=await window.__getStore(); if(!s) return false;
    s.getState().setTransitionType(tt);
    s.getState().setPresetTheme(id);
    return true;
  };
})();`);
await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForTimeout(4000);

const out = await page.evaluate(async () => {
  const de = document.documentElement;
  const snap = () => ({
    opacity: de.style.opacity || '(未设置)',
    transform: de.style.transform || '(未设置)',
    hasClass: de.classList.contains('theme-transition'),
  });

  const log = [];
  // 显式使用 fade / slide / scale 三种过渡（它们此前分别是 opacity / transform 实现）
  for (const tt of ['fade', 'slide', 'scale']) {
    for (const theme of ['dark-default', 'light-default']) {
      await window.__setAll(theme, tt);
      await new Promise(r => setTimeout(r, 120));           // 过渡进行中
      const during = snap();
      await new Promise(r => setTimeout(r, 400));           // 过渡结束
      const after = snap();
      log.push({ transitionType: tt, theme, during, after });
    }
  }
  // 复位
  await window.__setAll('light-default', 'none');
  await new Promise(r => setTimeout(r, 300));

  const violations = log.filter(x =>
    (x.during.opacity !== '(未设置)') || (x.during.transform !== '(未设置)') ||
    (x.after.opacity !== '(未设置)')  || (x.after.transform !== '(未设置)'));
  const classStuck = log.filter(x => x.after.hasClass);

  return {
    samples: log,
    violations: violations.length,
    classStuckAfterTransition: classStuck.length,
    verdict: {
      'switch 次数': log.length,
      '出现 inline opacity/transform 的次数（应为 0）': violations.length,
      '过渡结束后 .theme-transition 仍残留（应为 0）': classStuck.length,
      '过渡进行中是否挂载 .theme-transition': log.some(x => x.during.hasClass) ? '✅ 是' : '❌ 否',
    },
  };
});

console.log(JSON.stringify(out.verdict, null, 2));
if (out.violations) {
  console.log('\n违规明细:');
  out.samples.filter(x => x.during.opacity !== '(未设置)' || x.during.transform !== '(未设置)')
    .forEach(x => console.log(' ', JSON.stringify(x)));
}
const pass = out.violations === 0 && out.classStuckAfterTransition === 0;
console.log('\n结论:', pass ? '✅ 通过（无全页 opacity/transform 过渡）' : '❌ 存在违规');
fs.writeFileSync('D:/RMFOODFP/temp/theme-d8-verify.json', JSON.stringify({ ...out, pass }, null, 2), 'utf8');
await ctx.close();
await browser.close();
process.exit(pass ? 0 : 1);
