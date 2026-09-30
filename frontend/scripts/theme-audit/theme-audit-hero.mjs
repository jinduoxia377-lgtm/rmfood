// 精确定位仪表盘欢迎横幅（hero）并实测其对比度
import { chromium } from '@playwright/test';
import fs from 'node:fs';

const BASE = 'http://127.0.0.1:3000';
const HELPERS = `(function(){
  window.__store=null;
  window.__getStore=async function(){ if(window.__store) return window.__store;
    for (const p of ['/src/stores/themeStore.ts','/src/stores/themeStore']) {
      try { const m=await import(/* @vite-ignore */ p); if(m?.useThemeStore){window.__store=m.useThemeStore; return window.__store;} } catch(e){}
    } return null; };
  window.__setTheme=async function(id){ const s=await window.__getStore(); if(!s) return false; s.getState().setPresetTheme(id); return true; };
})();`;

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport:{width:1680,height:1050}, locale:'zh-CN', colorScheme:'light' });
const page = await ctx.newPage();
await page.addInitScript(HELPERS);
await page.goto(BASE + '/login', { waitUntil:'domcontentloaded', timeout:90000 });
await page.waitForTimeout(3500);
await page.fill('#rhine-username, input[type="text"]', 'admin');
await page.fill('#rhine-password, input[type="password"]', 'admin123');
await page.locator('button[type="submit"], button:has-text("登录")').first().click();
try { await page.waitForURL(x => !x.pathname.includes('/login'), { timeout:45000 }); } catch {}
await page.waitForTimeout(4500);

// 候选：包含“欢迎回来”且背景是渐变或绿色实底的元素
const candidates = () => page.evaluate(() => {
  const isGreen = (css) => {
    const m = String(css).match(/rgba?\(([^)]+)\)/); if (!m) return false;
    const p = m[1].split(',').map(Number);
    return p.length >= 3 && p[1] > p[0] + 25 && p[1] > p[2] + 25;
  };
  const out = [];
  for (const e of document.querySelectorAll('div,section,header,article')) {
    if (!/欢迎回来/.test(e.textContent || '')) continue;
    const r = e.getBoundingClientRect();
    if (r.width < 200 || r.height < 60 || r.height > 500) continue;
    const cs = getComputedStyle(e);
    const bgImg = cs.backgroundImage;
    const hasGrad = bgImg && bgImg !== 'none' && /gradient/.test(bgImg);
    if (!hasGrad && !isGreen(cs.backgroundColor)) continue;
    const titleEl = [...e.querySelectorAll('*')].find(x => /欢迎回来/.test(x.textContent || '') && x.children.length === 0);
    const tr = titleEl ? titleEl.getBoundingClientRect() : null;
    out.push({
      tag: e.tagName, cls: (typeof e.className === 'string' ? e.className : '').slice(0, 130),
      rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
      backgroundImage: bgImg.slice(0, 160),
      backgroundColor: cs.backgroundColor,
      titleTag: titleEl?.tagName, titleCls: titleEl ? String(titleEl.className).slice(0,110) : null,
      titleColor: titleEl ? getComputedStyle(titleEl).color : null,
      titleRect: tr ? { x: Math.round(tr.x), y: Math.round(tr.y), w: Math.round(tr.width), h: Math.round(tr.height) } : null,
      depth: (() => { let d=0,c=e; while(c.parentElement){d++;c=c.parentElement;} return d; })(),
    });
  }
  return out;
});

async function samplePixels(rect) {
  const buf = await page.screenshot({ clip: { x: rect.x, y: rect.y, width: rect.w, height: rect.h } });
  const b64 = buf.toString('base64');
  const sp = await ctx.newPage();
  await sp.setContent('<canvas id="c"></canvas>');
  const res = await sp.evaluate(async ({ b64 }) => {
    const img = new Image();
    await new Promise((r, j) => { img.onload = r; img.onerror = j; img.src = 'data:image/png;base64,' + b64; });
    const c = document.getElementById('c'); c.width = img.width; c.height = img.height;
    const g = c.getContext('2d'); g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, img.width, img.height).data;
    const hist = new Map();
    for (let i = 0; i < d.length; i += 4) {
      const k = `${d[i]>>4},${d[i+1]>>4},${d[i+2]>>4}`; hist.set(k, (hist.get(k)||0)+1);
    }
    return [...hist.entries()].sort((a,b)=>b[1]-a[1]).slice(0,4)
      .map(([k,cnt]) => { const p=k.split(',').map(x=>parseInt(x)*16+8);
        return { rgb:`rgb(${p[0]}, ${p[1]}, ${p[2]})`, pct:Math.round(cnt/(d.length/4)*1000)/10 }; });
  }, { b64 });
  await sp.close();
  return res;
}

const relLum = (css) => { const m=String(css).match(/rgba?\(([^)]+)\)/); if(!m) return null;
  const p=m[1].split(',').map(s=>parseFloat(s.trim()));
  const f=v=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4);};
  return 0.2126*f(p[0])+0.7152*f(p[1])+0.0722*f(p[2]); };
const contrast = (fg,bg) => { const a=relLum(fg),b=relLum(bg); if(a===null||b===null) return null;
  const hi=Math.max(a,b),lo=Math.min(a,b); return Math.round(((hi+0.05)/(lo+0.05))*100)/100; };

const out = {};

await page.evaluate(async () => { await window.__setTheme('light-default'); });
await page.waitForTimeout(1300);
out.lightCandidates = await candidates();
const cl = out.lightCandidates[0];
if (cl) { out.lightBannerPixels = await samplePixels(cl.rect);
  if (cl.titleRect) out.lightTitlePixels = await samplePixels(cl.titleRect); }

await page.evaluate(async () => { await window.__setTheme('dark-default'); });
await page.waitForTimeout(1700);
out.darkCandidates = await candidates();
const cd = out.darkCandidates[0];
if (cd) { out.darkBannerPixels = await samplePixels(cd.rect);
  if (cd.titleRect) out.darkTitlePixels = await samplePixels(cd.titleRect); }

out.verdict = {
  light: cl ? { 横幅背景主色: out.lightBannerPixels?.[0]?.rgb, 标题文字色: cl.titleColor,
                标题区域主色: out.lightTitlePixels?.[0]?.rgb,
                对比度_文字对横幅主色: contrast(cl.titleColor, out.lightBannerPixels?.[0]?.rgb) } : null,
  dark: cd ? { 横幅背景主色: out.darkBannerPixels?.[0]?.rgb, 标题文字色: cd.titleColor,
               标题区域主色: out.darkTitlePixels?.[0]?.rgb,
               对比度_文字对横幅主色: contrast(cd.titleColor, out.darkBannerPixels?.[0]?.rgb) } : null,
};

console.log(JSON.stringify(out, null, 2));
fs.writeFileSync('D:/RMFOODFP/temp/theme-hero-contrast.json', JSON.stringify(out, null, 2), 'utf8');
await ctx.close();
await browser.close();
