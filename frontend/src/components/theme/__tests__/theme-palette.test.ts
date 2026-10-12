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
  ACCENT_PALETTES,
  APPLE_HIG_PALETTES,
  DEFAULT_ACCENT_DARK_SCALE,
  DEFAULT_ACCENT_LIGHT_SCALE,
  DEFAULT_GREEN_DARK_SCALE,
  DEFAULT_GREEN_LIGHT_SCALE,
  DEFAULT_SECONDARY_DARK_SCALE,
  DEFAULT_SECONDARY_LIGHT_SCALE,
  FONT_SCALE_KEYS,
  FONT_SCALES,
  PRIMARY_TIERS,
  RADIUS_SCALE_KEYS,
  RADIUS_SCALE_META,
  RADIUS_SCALES,
  SECONDARY_PALETTES,
  buildDarkRamp,
  buildFontScale,
  buildLightRamp,
  getBrandFamilyScales,
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

  it('色阶覆盖完整 11 档（50..950），且每档均为合法 hex', () => {
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
  // 基准值取自 base.css:9-19（亮）与 dark.css:9-19（暗）
  const L0_LIGHT = {
    '50': '#ecfdf5',
    '100': '#d1fae5', '200': '#a7f3d0', '300': '#6ee7b7', '400': '#34d399', '500': '#10b981',
    '600': '#059669', '700': '#047857', '800': '#065f46', '900': '#064e3b', '950': '#022c22',
  };
  const L0_DARK = {
    '50': '#022c22',
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

describe('RADIUS_SCALES — 圆角方案', () => {
  // 基准值取自 base.css:255-261（--radius-sm..full）
  const L0 = {
    sm: '6px', md: '8px', lg: '12px', xl: '16px', '2xl': '20px', full: '9999px',
  };
  const px = (v: string) => parseFloat(v.replace('px', ''));

  it('三个方案覆盖全部键，且均为合法 px 值', () => {
    for (const k of Object.keys(RADIUS_SCALES)) {
      for (const key of RADIUS_SCALE_KEYS) {
        expect(RADIUS_SCALES[k][key], `${k}.${key}`).toMatch(/^(0|\d+px)$/);
      }
    }
  });

  it('standard 档逐值等于 base.css L0 —— 选它等于无变化', () => {
    for (const [key, value] of Object.entries(L0)) {
      expect(RADIUS_SCALES.standard[key as keyof typeof L0], key).toBe(value);
    }
    expect(RADIUS_SCALES.standard.none).toBe('0');
  });

  it('锐利 < 标准 < 圆润 严格单调（none/full 两端钉死不变）', () => {
    // none 恒为 0、full 恒为 9999px：两端钉死，不参与排序比较
    for (const scale of Object.values(RADIUS_SCALES)) {
      expect(scale.none).toBe('0');
      expect(scale.full).toBe('9999px');
    }
    for (const key of RADIUS_SCALE_KEYS) {
      if (key === 'none' || key === 'full') continue;
      const s = px(RADIUS_SCALES.sharp[key]);
      const m = px(RADIUS_SCALES.standard[key]);
      const r = px(RADIUS_SCALES.rounded[key]);
      expect(s, `${key}/sharp<standard`).toBeLessThan(m);
      expect(m, `${key}/standard<rounded`).toBeLessThan(r);
    }
  });

  it('RADIUS_SCALE_META 与 RADIUS_SCALES 的键集一致，且各档可区分', () => {
    expect(RADIUS_SCALE_META.length).toBe(3);
    const metaKeys = RADIUS_SCALE_META.map((m) => m.key);
    expect(new Set(metaKeys).size).toBe(3);
    for (const m of RADIUS_SCALE_META) {
      expect(RADIUS_SCALES[m.key], m.key).toBeDefined();
      // 预览值必须等于该档的 lg，否则面板上的圆角方块会与实际取值不符
      expect(m.lg, m.key).toBe(RADIUS_SCALES[m.key].lg);
    }
  });

  it('全部令牌名与值都能通过 isSafeToken 白名单（注入安全边界）', async () => {
    const { isSafeToken } = await import('../../../stores/theme.presets');
    for (const scale of Object.values(RADIUS_SCALES)) {
      for (const key of RADIUS_SCALE_KEYS) {
        expect(isSafeToken(`--radius-${key}`, scale[key]), `--radius-${key}`).toBe(true);
      }
    }
  });
});

// ============================================================================
// ⑧b / ⑧c 次色 / 强调色方案（执行方案阶段 E3）
//
// 锁定与主色同级的三条约定：
//   1. 默认方案逐档等于 L0 —— 选「海洋蓝」「生物紫」不得改变全站既有渲染。
//   2. 非默认方案的 11 档亮度单调（亮色递减、暗色递增），500 档 = 锚点。
//   3. 次色 / 强调色的 500 锚点在两种模式下相同（与主色维护 light/dark 双锚点不同），
//      明暗差异完全由档位反转承载。
// ============================================================================

describe('DEFAULT_SECONDARY_*_SCALE — 与 L0 逐档一致（base.css:41-52 / dark.css:37-47）', () => {
  it('亮色档逐值等于 base.css 的 --color-secondary-<档>', () => {
    const L0: Record<PrimaryTier, string> = {
      '50': '#eff6ff', '100': '#dbeafe', '200': '#bfdbfe', '300': '#93c5fd', '400': '#60a5fa',
      '500': '#3b82f6', '600': '#2563eb', '700': '#1d4ed8', '800': '#1e40af', '900': '#1e3a8a', '950': '#172554',
    };
    expect(DEFAULT_SECONDARY_LIGHT_SCALE).toEqual(L0);
  });

  it('暗色档逐值等于 dark.css 的 --color-secondary-<档>', () => {
    const L0: Record<PrimaryTier, string> = {
      '50': '#172554', '100': '#1e3a8a', '200': '#1e40af', '300': '#1d4ed8', '400': '#2563eb',
      '500': '#3b82f6', '600': '#60a5fa', '700': '#93c5fd', '800': '#bfdbfe', '900': '#dbeafe', '950': '#eff6ff',
    };
    expect(DEFAULT_SECONDARY_DARK_SCALE).toEqual(L0);
  });

  it('暗色档是亮色档的反转且 500 锚点钉死不变', () => {
    expect(DEFAULT_SECONDARY_DARK_SCALE['50']).toBe(DEFAULT_SECONDARY_LIGHT_SCALE['950']);
    expect(DEFAULT_SECONDARY_DARK_SCALE['950']).toBe(DEFAULT_SECONDARY_LIGHT_SCALE['50']);
    expect(DEFAULT_SECONDARY_DARK_SCALE['500']).toBe(DEFAULT_SECONDARY_LIGHT_SCALE['500']);
  });
});

describe('DEFAULT_ACCENT_*_SCALE — 与 L0 逐档一致（base.css:60-70 / dark.css:55-65）', () => {
  it('亮色档逐值等于 base.css 的 --color-accent-<档>', () => {
    const L0: Record<PrimaryTier, string> = {
      '50': '#faf5ff', '100': '#f3e8ff', '200': '#e8d5ff', '300': '#c084fc', '400': '#c084fc',
      '500': '#8b5cf6', '600': '#7c3aed', '700': '#6d28d9', '800': '#5b21b6', '900': '#3b0764', '950': '#1a0542',
    };
    expect(DEFAULT_ACCENT_LIGHT_SCALE).toEqual(L0);
  });

  it('暗色档逐值等于 dark.css 的 --color-accent-<档>', () => {
    const L0: Record<PrimaryTier, string> = {
      '50': '#1a0542', '100': '#3b0764', '200': '#5b21b6', '300': '#6d28d9', '400': '#7c3aed',
      '500': '#8b5cf6', '600': '#a78bfa', '700': '#c4b5fd', '800': '#ddd6fe', '900': '#ede9fe', '950': '#faf5ff',
    };
    expect(DEFAULT_ACCENT_DARK_SCALE).toEqual(L0);
  });

  it('L0 的 300 与 400 同为 #c084fc（压平档）—— 故默认方案不得走生成器', () => {
    // 这是「选默认 = 无变化」必须由 L0 权威值承载的直接证据：
    // buildLightRamp('#8b5cf6') 会给出 300 ≠ 400，无法复现这个压平。
    expect(DEFAULT_ACCENT_LIGHT_SCALE['300']).toBe('#c084fc');
    expect(DEFAULT_ACCENT_LIGHT_SCALE['400']).toBe('#c084fc');
    expect(buildLightRamp('#8b5cf6')['400']).not.toBe(buildLightRamp('#8b5cf6')['300']);
  });
});

describe('SECONDARY_PALETTES / ACCENT_PALETTES — 方案元数据', () => {
  it('每个方案的锚点都是合法 hex，且 key 各自唯一', () => {
    for (const p of SECONDARY_PALETTES) {
      expect(/^#[0-9A-Fa-f]{6}$/.test(p.anchor), `${p.key} anchor`).toBe(true);
      expect(p.name.length, `${p.key} name`).toBeGreaterThan(0);
    }
    for (const p of ACCENT_PALETTES) {
      expect(/^#[0-9A-Fa-f]{6}$/.test(p.anchor), `${p.key} anchor`).toBe(true);
      expect(p.name.length, `${p.key} name`).toBeGreaterThan(0);
    }
    expect(new Set(SECONDARY_PALETTES.map((p) => p.key)).size).toBe(SECONDARY_PALETTES.length);
    expect(new Set(ACCENT_PALETTES.map((p) => p.key)).size).toBe(ACCENT_PALETTES.length);
  });

  it('默认方案就是 L0 锚点（#3B82F6 / #8B5CF6），选它等于无变化', () => {
    const secDefault = SECONDARY_PALETTES.find((p) => p.key === 'blue');
    const accDefault = ACCENT_PALETTES.find((p) => p.key === 'purple');
    expect(secDefault?.anchor.toLowerCase()).toBe('#3b82f6');
    expect(accDefault?.anchor.toLowerCase()).toBe('#8b5cf6');
  });

  it('所有锚点都能通过 isSafeToken 注入白名单', async () => {
    const { isSafeToken } = await import('../../../stores/theme.presets');
    for (const p of [...SECONDARY_PALETTES, ...ACCENT_PALETTES]) {
      expect(isSafeToken('--color-primary', p.anchor), `${p.key} anchor`).toBe(true);
    }
  });
});

describe('getBrandFamilyScales — 默认走 L0 权威值，其余由锚点生成', () => {
  it('默认方案返回 L0 权威值而非程序化生成值', () => {
    const sec = getBrandFamilyScales('secondary', SECONDARY_PALETTES[0]);
    const acc = getBrandFamilyScales('accent', ACCENT_PALETTES[0]);
    expect(sec.light).toBe(DEFAULT_SECONDARY_LIGHT_SCALE);
    expect(sec.dark).toBe(DEFAULT_SECONDARY_DARK_SCALE);
    expect(acc.light).toBe(DEFAULT_ACCENT_LIGHT_SCALE);
    expect(acc.dark).toBe(DEFAULT_ACCENT_DARK_SCALE);
  });

  it('非默认方案：亮色阶亮度递减、暗色阶递增，500 档 = 锚点', () => {
    for (const family of ['secondary', 'accent'] as const) {
      const list = family === 'secondary' ? SECONDARY_PALETTES : ACCENT_PALETTES;
      for (const p of list.slice(1)) {
        const { light, dark } = getBrandFamilyScales(family, p);
        expect(wrongDirectionLumaSum(light, 'desc'), `${family}/${p.key} light`).toBeLessThan(0.05);
        expect(wrongDirectionLumaSum(dark, 'asc'), `${family}/${p.key} dark`).toBeLessThan(0.05);
        expect(light['500'].toLowerCase(), `${family}/${p.key} light 500`).toBe(p.anchor.toLowerCase());
        expect(dark['500'].toLowerCase(), `${family}/${p.key} dark 500`).toBe(p.anchor.toLowerCase());
      }
    }
  });

  it('所有方案覆盖完整 11 档且每档均为合法 hex', () => {
    for (const family of ['secondary', 'accent'] as const) {
      const list = family === 'secondary' ? SECONDARY_PALETTES : ACCENT_PALETTES;
      for (const p of list) {
        const { light, dark } = getBrandFamilyScales(family, p);
        for (const tier of PRIMARY_TIERS) {
          expect(light[tier], `${family}/${p.key} light ${tier}`).toMatch(/^#[0-9a-fA-F]{6}$/);
          expect(dark[tier], `${family}/${p.key} dark ${tier}`).toMatch(/^#[0-9a-fA-F]{6}$/);
        }
      }
    }
  });

  it('生成的双模式 ramp 500 锚点相同（次色/强调色的 L0 约定）', () => {
    for (const family of ['secondary', 'accent'] as const) {
      const list = family === 'secondary' ? SECONDARY_PALETTES : ACCENT_PALETTES;
      for (const p of list.slice(1)) {
        const { light, dark } = getBrandFamilyScales(family, p);
        expect(light['500'], `${family}/${p.key}`).toBe(dark['500']);
      }
    }
  });
});
