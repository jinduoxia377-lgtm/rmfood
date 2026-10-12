/**
 * 主题配色/字体数据模型测试（执行方案阶段 A4 / A5）
 *
 * 锁定三条不可回归的约束：
 *   1. 档位内单调性 —— 主色阶在双模式下是有意反转的（亮色 100 浅→950 深，
 *      暗色 100 深→950 浅），运行时注入必须整档同向替换，否则产生断裂梯度。
 *   2. 默认绿逐档等于 L0 —— 选「默认绿」不得改变全站 1 277 处品牌绿消费。
 *   3. 标准字号档逐值等于 L0 基准 —— standard 档不得悄悄改变全站排版。
 */
import { describe, it, expect } from 'vitest';
import {
  APPLE_HIG_PALETTES,
  DEFAULT_GREEN_DARK_SCALE,
  DEFAULT_GREEN_LIGHT_SCALE,
  FONT_SCALE_KEYS,
  FONT_SCALES,
  PRIMARY_TIERS,
  buildDarkRamp,
  buildFontScale,
  buildLightRamp,
  getPaletteScales,
  mixColor,
  relLuminance,
  wrongDirectionLumaSum,
} from '../theme-palette';

describe('mixColor / relLuminance — 色相工具', () => {
  it('mixColor 端点正确且支持 3 位与 6 位 hex', () => {
    expect(mixColor('#ff0000', '#000000', 0)).toBe('#ff0000');
    expect(mixColor('#ff0000', '#000000', 1)).toBe('#000000');
    // 3 位 hex 先展开为 6 位（#f00 → #ff0000）；0xff×0.5 = 127.5，Math.round 进位为 128
    expect(mixColor('#f00', '#000', 0.5)).toBe('#800000');
    expect(mixColor('#ff0', '#000', 0.5)).toBe('#808000');
  });

  it('relLuminance 端点正确（白=1、黑=0）', () => {
    expect(relLuminance('#ffffff')).toBeCloseTo(1, 5);
    expect(relLuminance('#000000')).toBeCloseTo(0, 5);
    // 灰阶中间点应落在 0..1
    expect(relLuminance('#808080')).toBeGreaterThan(0.1);
    expect(relLuminance('#808080')).toBeLessThan(0.5);
  });
});

describe('buildLightRamp / buildDarkRamp — 双模式形态与锚点位置', () => {
  it('亮色 ramp：100 最浅、950 最深，亮度严格递减，500 = 锚点', () => {
    const ramp = buildLightRamp('#10b981');
    expect(wrongDirectionLumaSum(ramp, 'desc')).toBe(0);
    expect(ramp['500'].toLowerCase()).toBe('#10b981');
  });

  it('暗色 ramp：100 最深、950 最浅，亮度严格递增，500 = 锚点', () => {
    const ramp = buildDarkRamp('#10b981');
    expect(wrongDirectionLumaSum(ramp, 'asc')).toBe(0);
    expect(ramp['500'].toLowerCase()).toBe('#10b981');
  });

  it('暗色 ramp 不是亮色 ramp 的整体反转（10 档偶数会使锚点从 500 滑到 600）', () => {
    const light = buildLightRamp('#10b981');
    const dark = buildDarkRamp('#10b981');
    // 整体反转会让 dark['500'] = light['600']；正确实现锚点必须钉在 500
    expect(dark['500']).not.toBe(light['600']);
    expect(dark['500'].toLowerCase()).toBe('#10b981');
    // 形态相反：dark 的 100 比 dark 的 950 暗
    expect(relLuminance(dark['100'])).toBeLessThan(relLuminance(dark['950']));
  });
});

describe('APPLE_HIG_PALETTES — 五个方案双模式色阶', () => {
  it('每个方案的亮色阶亮度递减、暗色阶亮度递增，且 500 档 = 各自锚点', () => {
    for (const p of APPLE_HIG_PALETTES) {
      const { light, dark } = getPaletteScales(p);
      expect(wrongDirectionLumaSum(light, 'desc'), `${p.key}/light`).toBeLessThan(0.05);
      expect(wrongDirectionLumaSum(dark, 'asc'), `${p.key}/dark`).toBeLessThan(0.05);
      // L0 约定：500 档即该模式的锚点（base.css:14 / dark.css:14 均如此）
      expect(light['500'].toLowerCase(), `${p.key}/light/500`).toBe(p.light.toLowerCase());
      expect(dark['500'].toLowerCase(), `${p.key}/dark/500`).toBe(p.dark.toLowerCase());
    }
  });

  it('非默认方案的色阶由各自锚点生成，互不串色', () => {
    const green = getPaletteScales(APPLE_HIG_PALETTES[0]).light;
    const blue = getPaletteScales(APPLE_HIG_PALETTES[1]).light;
    // 蓝方案的 500 必须是 blue 锚点，绝不能残留 green 的绿
    expect(blue['500'].toLowerCase()).toBe('#007aff');
    expect(green['500'].toLowerCase()).toBe('#10b981');
    expect(blue['100']).not.toBe(green['100']);
    expect(blue['950']).not.toBe(green['950']);
  });

  it('色阶覆盖完整 10 档，且每档均为合法 hex', () => {
    for (const p of APPLE_HIG_PALETTES) {
      for (const { light, dark } of [getPaletteScales(p)]) {
        for (const tier of PRIMARY_TIERS) {
          expect(light[tier], `${p.key}/light/${tier}`).toMatch(/^#[0-9a-f]{6}$/i);
          expect(dark[tier], `${p.key}/dark/${tier}`).toMatch(/^#[0-9a-f]{6}$/i);
        }
      }
    }
  });
});

describe('DEFAULT_GREEN_*_SCALE — 与 L0 逐档一致', () => {
  // 基准值取自 base.css:10-19（亮）与 dark.css:10-19（暗）
  const L0_LIGHT = {
    '100': '#d1fae5', '200': '#a7f3d0', '300': '#6ee7b7', '400': '#34d399', '500': '#10b981',
    '600': '#059669', '700': '#047857', '800': '#065f46', '900': '#064e3b', '950': '#022c22',
  };
  const L0_DARK = {
    '100': '#064e3b', '200': '#065f46', '300': '#047857', '400': '#059669', '500': '#34d399',
    '600': '#6ee7b7', '700': '#a7f3d0', '800': '#d1fae5', '900': '#ecfdf5', '950': '#f0fdf4',
  };

  it('亮色档逐值等于 base.css 的 --color-primary-<档>', () => {
    for (const tier of PRIMARY_TIERS) {
      expect(DEFAULT_GREEN_LIGHT_SCALE[tier].toLowerCase(), tier).toBe(L0_LIGHT[tier]);
    }
  });

  it('暗色档逐值等于 dark.css 的 --color-primary-<档>', () => {
    for (const tier of PRIMARY_TIERS) {
      expect(DEFAULT_GREEN_DARK_SCALE[tier].toLowerCase(), tier).toBe(L0_DARK[tier]);
    }
  });

  it('getPaletteScales 对 green 返回 L0 权威值而非程序化生成值', () => {
    const { light, dark } = getPaletteScales(APPLE_HIG_PALETTES.find((p) => p.key === 'green')!);
    for (const tier of PRIMARY_TIERS) {
      expect(light[tier].toLowerCase(), `light/${tier}`).toBe(L0_LIGHT[tier]);
      expect(dark[tier].toLowerCase(), `dark/${tier}`).toBe(L0_DARK[tier]);
    }
  });
});

describe('FONT_SCALES — 完整 L0 排版档', () => {
  it('每个方案覆盖全部 L0 排版令牌键', () => {
    for (const k of Object.keys(FONT_SCALES)) {
      for (const key of FONT_SCALE_KEYS) {
        expect(FONT_SCALES[k][key], `${k}.${key}`).toMatch(/^[\d.]+rem$/);
      }
    }
  });

  it('standard 档逐值等于 L0 基准（base.css --text-*）', () => {
    // 基准：body 15px / bodySm 14px / caption 12px / bodyLg 16px / h1 36 / h2 28 / h3 24 / h4 22 / h5 18 / h6 16
    const L0 = {
      body: '0.9375rem', bodySm: '0.875rem', caption: '0.75rem', bodyLg: '1rem',
      overline: '0.75rem', tiny: '0.75rem',
      h1: '2.25rem', h2: '1.75rem', h3: '1.5rem', h4: '1.375rem', h5: '1.125rem', h6: '1rem',
    };
    for (const key of FONT_SCALE_KEYS) {
      expect(FONT_SCALES.standard[key], key).toBe(L0[key]);
    }
  });

  it('三档间保持严格排序：compact < standard < relaxed（正文族）', () => {
    const px = (v: string) => parseFloat(v.replace('rem', '')) * 16;
    for (const key of FONT_SCALE_KEYS) {
      const c = px(FONT_SCALES.compact[key]);
      const s = px(FONT_SCALES.standard[key]);
      const r = px(FONT_SCALES.relaxed[key]);
      expect(c, `${key}/compact`).toBeLessThan(s);
      expect(s, `${key}/standard`).toBeLessThan(r);
    }
  });

  it('标题档施加阻尼：relaxed 档 h1 不放大到 43.2px（36×1.2），而是 41.04px（36×1.14）', () => {
    const h1 = parseFloat(FONT_SCALES.relaxed.h1.replace('rem', '')) * 16;
    expect(h1).toBeCloseTo(36 * 1.14, 0);
    // 正文族不阻尼：relaxed body = 18px
    expect(parseFloat(FONT_SCALES.relaxed.body.replace('rem', '')) * 16).toBe(18);
  });

  it('buildFontScale 对任意基准字号保持比例关系', () => {
    const s = buildFontScale(20);
    expect(parseFloat(s.body.replace('rem', '')) * 16).toBe(20);
    expect(parseFloat(s.bodySm.replace('rem', '')) * 16).toBeCloseTo(14 * (20 / 15), 0);
  });
});
