// T-A1 视觉回归复核：对比 before/after 截图，量化差异面
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import { readdirSync } from 'node:fs';

const DIR = 'D:/RMFOODFP/temp/theme-shots';
const A = `${DIR}/before`, B = `${DIR}/after`;
const files = readdirSync(A).filter(f => f.endsWith('.png'));

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext();
const page = await ctx.newPage();
await page.setContent('<canvas id="c"></canvas>');

const rows = [];
for (const f of files) {
  const pa = `${A}/${f}`, pb = `${B}/${f}`;
  if (!fs.existsSync(pb)) { rows.push({ file: f, status: 'MISSING_AFTER' }); continue; }
  const a64 = fs.readFileSync(pa).toString('base64');
  const b64 = fs.readFileSync(pb).toString('base64');
  const r = await page.evaluate(async ([x, y]) => {
    const load = async (d) => { const i = new Image(); await new Promise((s, j) => { i.onload = s; i.onerror = j; i.src = 'data:image/png;base64,' + d; }); return i; };
    const ia = await load(x), ib = await load(y);
    const W = Math.min(ia.width, ib.width), H = Math.min(ia.height, ib.height);
    const c = document.getElementById('c'); c.width = W; c.height = H;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(ia, 0, 0); const da = g.getImageData(0, 0, W, H).data;
    g.clearRect(0, 0, W, H); g.drawImage(ib, 0, 0); const db = g.getImageData(0, 0, W, H).data;
    let diff = 0, big = 0;
    const n = W * H;
    for (let i = 0; i < da.length; i += 4) {
      const d = Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2]);
      if (d > 12) diff++;
      if (d > 120) big++;
    }
    return { w: W, h: H, diffPct: Math.round((diff / n) * 1000) / 10, bigPct: Math.round((big / n) * 1000) / 10 };
  }, [a64, b64]);
  rows.push({ file: f, ...r });
}

console.log('文件'.padEnd(28), '差异像素%', '显著差异%');
for (const r of rows) {
  if (r.status) { console.log(r.file.padEnd(28), r.status); continue; }
  console.log(r.file.padEnd(28), String(r.diffPct).padStart(7), String(r.bigPct).padStart(9));
}
const darks = rows.filter(r => r.file.includes('-dark') && !r.status);
const lights = rows.filter(r => r.file.includes('-light') && !r.status);
const avg = (a) => a.length ? Math.round(a.reduce((s, x) => s + x.diffPct, 0) / a.length * 10) / 10 : 0;
console.log('\n暗色模式平均差异:', avg(darks) + '%');
console.log('亮色模式平均差异:', avg(lights) + '%');
console.log('\n解读：T-A1 预期主要影响【暗色】截图（激活此前未生效的 dark: 类）；');
console.log('      亮色模式差异应显著较小（值为系统浅色时 dark: 本就不该生效）。');

fs.writeFileSync('D:/RMFOODFP/temp/theme-visual-diff.json', JSON.stringify(rows, null, 2), 'utf8');
await ctx.close();
await browser.close();
