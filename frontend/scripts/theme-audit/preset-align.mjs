// T-B1 配套：预设值 vs L0 静态令牌 差异比对
// 方法：对每个由 generateCSSVariables() 生成的令牌，先记录其「注入值」，
//       再临时移除 <html> 上的内联声明、读取 CSS 层（base.css/dark.css/.dark）的
//       计算值作为「L0 值」，比较后恢复。差异即为 D-2/D-3 的分叉。
import { chromium } from '@playwright/test';
import fs from 'node:fs';

const BASE = 'http://127.0.0.1:3000';
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'zh-CN', colorScheme: 'light' });
const page = await ctx.newPage();

// 直达 /login（无需登录即可加载 store 与 CSS）
await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForTimeout(3500);

const result = await page.evaluate(async () => {
  const preset = await import('/src/stores/theme.presets.ts');
  const store = await import('/src/stores/themeStore.ts');

  const root = document.documentElement;
  const out = {};

  const runMode = async (mode, themeId) => {
    store.useThemeStore.getState().setPresetTheme(themeId);
    await new Promise(r => setTimeout(r, 500));

    const theme = store.useThemeStore.getState().activeTheme;
    if (!theme) return { error: 'activeTheme 为空' };

    const injected = preset.generateCSSVariables(theme);
    const rows = [];
    for (const [name, rawVal] of Object.entries(injected)) {
      const injectedVal = String(rawVal).trim();

      // 记录当前内联值
      const inlineBefore = root.style.getPropertyValue(name);

      // 移除内联 → 读 CSS 层计算值
      root.style.removeProperty(name);
      const l0Val = getComputedStyle(root).getPropertyValue(name).trim();

      // 恢复内联
      if (inlineBefore) root.style.setProperty(name, inlineBefore);

      rows.push({
        name,
        injected: injectedVal,
        l0: l0Val,
        /** 'injected-only' = L0 无此定义；'differs' = 同名义不同值；'same' = 一致 */
        kind: l0Val === '' ? 'injected-only' : (norm(l0Val) === norm(injectedVal) ? 'same' : 'differs'),
      });
    }
    return { themeId, count: rows.length, rows };
  };

  // 归一化值写法：颜色（#hex ↔ rgb）、长度（rem/em ↔ px，基准 16px）、
  // 引号与空白。避免把「0.25rem vs 4px」这类**写法差异**误报为分叉。
  const norm = (v) => {
    let s = String(v).trim().toLowerCase().replace(/\s+/g, ' ');

    // 颜色：#hex → rgb()
    const hex = s.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/);
    if (hex) {
      let h = hex[1];
      if (h.length === 3) h = h.split('').map(c => c + c).join('');
      return `rgb(${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)})`;
    }
    const rgb = s.match(/^rgba?\(([^)]+)\)$/);
    if (rgb) {
      const p = rgb[1].split(',').map(x => x.trim());
      if (p.length === 4 && parseFloat(p[3]) === 0) return 'transparent';
      return `rgb(${p[0]},${p[1]},${p[2]})`;
    }

    // 长度：把整串中的 Nrem / Nem 统一换算为 px（16px 基准），并去掉 px 单位
    const toPx = (str) => str.replace(/(-?\d*\.?\d+)(rem|em)\b/g,
      (_, n) => `${Math.round(parseFloat(n) * 16 * 1000) / 1000}px`)
      .replace(/(-?\d*\.?\d+)px\b/g, (_, n) => `${parseFloat(n)}px`);

    // 纯长度值
    if (/^-?\d*\.?\d+(rem|em|px)$/.test(s)) return toPx(s);

    // 复合值（阴影 / 字体族链）：逐段归一长度，并统一引号
    if (/\d(rem|em|px)\b/.test(s)) s = toPx(s);

    return s.replace(/["']/g, '').replace(/\s*,\s*/g, ',');
  };

  out['light-default'] = await runMode('light', 'light-default');
  out['dark-default'] = await runMode('dark', 'dark-default');
  // 复位
  store.useThemeStore.getState().setPresetTheme('light-default');
  return out;
});

// ── 输出 ──
let grandDiffers = 0, grandInjectedOnly = 0;
for (const [mode, r] of Object.entries(result)) {
  if (r.error) { console.log(`\n══ ${mode} ══ 错误: ${r.error}`); continue; }
  const differs = r.rows.filter(x => x.kind === 'differs');
  const only = r.rows.filter(x => x.kind === 'injected-only');
  const same = r.rows.filter(x => x.kind === 'same');
  grandDiffers += differs.length;
  grandInjectedOnly += only.length;
  console.log(`\n══ ${mode}（${r.themeId}）══  生成 ${r.count} 条：一致 ${same.length} / 同义不同值 ${differs.length} / 仅注入(L0无) ${only.length}`);
  if (differs.length) {
    console.log('  ── 同义不同值（D-3 分叉）──');
    for (const d of differs.slice(0, 60)) console.log(`    ${d.name.padEnd(38)} 注入 ${d.injected.padEnd(24)} L0 ${d.l0}`);
    if (differs.length > 60) console.log(`    …（共 ${differs.length} 条）`);
  }
  if (only.length) {
    console.log('  ── 仅注入（L0 无此令牌）──');
    for (const d of only.slice(0, 40)) console.log(`    ${d.name.padEnd(38)} ${d.injected}`);
    if (only.length > 40) console.log(`    …（共 ${only.length} 条）`);
  }
}

console.log(`\n════ 合计：同义不同值 ${grandDiffers} 处；仅注入 ${grandInjectedOnly} 处 ════`);
fs.writeFileSync('D:/RMFOODFP/temp/preset-align.json', JSON.stringify(result, null, 2), 'utf8');
await ctx.close();
await browser.close();
process.exit(grandDiffers === 0 ? 0 : 1);
