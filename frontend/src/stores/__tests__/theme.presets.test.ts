/**
 * 主题令牌安全校验测试（T-D2 / D-33）
 *
 * 背景：主题可经三条不可信路径进入（JSON 导入 / 文件上传 / URL 分享）。
 * 原实现把这些值拼接进 root.style.cssText，攻击者在 value 中放入 ';'
 * 即可越界注入任意 CSS 声明到 <html>。
 *
 * 本测试锁定 isSafeToken 的白名单边界，防止注入向量回归。
 */
import { describe, it, expect } from 'vitest';
import { isSafeToken } from '../theme.presets';

describe('isSafeToken — 令牌名校验', () => {
  it('接受合法的小写 kebab-case 自定义属性名', () => {
    for (const n of [
      '--color-primary',
      '--color-primary-500',
      '--text-primary',
      '--bg-surface-container-low',
      '--badge-draft-text-dark',
      '--z-modal-backdrop',
    ]) {
      expect(isSafeToken(n, '#10b981'), n).toBe(true);
    }
  });

  it('拒绝非自定义属性名与畸形命名', () => {
    for (const n of [
      'color',                 // 缺少 --
      '--',                    // 空名
      '--Color-Primary',       // 大写
      '--color_primary',       // 下划线
      '--color--primary',      // 连续连字符
      '-color-primary',        // 单连字符
      '--color primary',       // 含空格
      '--color-primary;',      // 含分隔符
      'background',            // 标准属性（越界目标）
      'position',
    ]) {
      expect(isSafeToken(n, '#10b981'), n).toBe(false);
    }
  });
});

describe('isSafeToken — 令牌值白名单', () => {
  it('接受合法颜色值', () => {
    for (const v of [
      '#10b981', '#10B981', '#fff', '#ffff', '#10b981ff',
      'rgb(16, 185, 129)', 'rgba(16, 185, 129, 0.15)',
      'rgb(16 185 129)', 'hsl(160, 84%, 39%)', 'hsla(160, 84%, 39%, 0.5)',
      'var(--color-primary-500)', 'var(--color-primary-500, #10b981)',
      'linear-gradient(135deg, #10b981, #34d399)',
      'radial-gradient(circle, rgba(148,163,184,.12) 1px, transparent 1px)',
      '#0f172a', 'none', 'auto', 'transparent', 'currentColor',
    ]) {
      expect(isSafeToken('--x', v), v).toBe(true);
    }
  });

  it('接受数值与单位', () => {
    for (const v of ['4px', '0.5rem', '200ms', '1.5', '100%', '50vh', '-1px']) {
      expect(isSafeToken('--x', v), v).toBe(true);
    }
  });

  it('拒绝所有 CSS 注入形态（D-33 回归锁）', () => {
    for (const v of [
      '#10b981; position: fixed',                       // 越界声明
      '#10b981;inset:0',
      'red; background-image: url(https://evil/x.png)', // 外部资源
      'var(--x); position: absolute',
      '#fff} body { display: none',
      '#fff { color: red }',
      'url(https://evil.example/x.png)',
      'expression(alert(1))',
      '#fff\\; color: red',
      '#fff; }',
      'red; @import "https://evil/x.css"',
    ]) {
      expect(isSafeToken('--color-primary', v), v).toBe(false);
    }
  });

  it('拒绝空值、超长值与不可打印内容', () => {
    expect(isSafeToken('--x', '')).toBe(false);
    expect(isSafeToken('--x', '   ')).toBe(false);
    expect(isSafeToken('--x', 'a'.repeat(400))).toBe(false);
    expect(isSafeToken('--x', '<script>alert(1)</script>')).toBe(false);
  });

  it('拒绝非字符串输入（防止对象/数组被字符串化后注入）', () => {
    expect(isSafeToken('--x', undefined as unknown as string)).toBe(false);
    expect(isSafeToken('--x', null as unknown as string)).toBe(false);
    expect(isSafeToken('--x', 123 as unknown as string)).toBe(false);
    expect(isSafeToken('--x', { toString: () => '#fff' } as unknown as string)).toBe(false);
    expect(isSafeToken(undefined as unknown as string, '#fff')).toBe(false);
  });
});

/**
 * 执行方案阶段 A1 / A2 / A3 回归锁
 *
 * A1：mergeThemeOverrides 的 colors/typography 必须两级深合并。
 *     原 category 层浅合并会用 override 整体替换同名角色 —— 覆盖 colors.primary
 *     时连带丢掉 primary.main，而 --color-primary 正是 chartTheme.ts 与 11 处
 *     L1 消费者依赖的唯一令牌（L1 缺陷）。
 * A2：色阶 fallback 路径（COLOR_MAIN_TO_L0 未命中 → --color-<cat>-<档>）
 *     必须产出合法且可被 isSafeToken 接受的令牌名。
 * A3：fontSize 键名必须 kebab 化，否则 --text-body-sm 被写成 --text-bodySm
 *     而在 :723 静默拒收，字号运行时覆盖整体失效。
 */
import { generateCSSVariables, getDefaultTheme, mergeThemeOverrides, presetThemes } from '../theme.presets';

describe('mergeThemeOverrides — A1 两级深合并', () => {
  it('覆盖 colors.primary 的某个属性时，保留 primary 的其余属性', () => {
    const base = getDefaultTheme();
    const before = base.colors.primary;
    const after = mergeThemeOverrides(base, {
      colors: { primary: { main: '#007aff' } },
    });
    // 被覆盖的属性生效
    expect(after.colors.primary.main).toBe('#007aff');
    // 未覆盖的属性全部保留（L1 回归锁）
    for (const k of Object.keys(before)) {
      if (k !== 'main') {
        expect(after.colors.primary[k], k).toBe(before[k]);
      }
    }
  });

  it('覆盖一个角色时，其余角色完全不受影响', () => {
    const base = getDefaultTheme();
    const after = mergeThemeOverrides(base, { colors: { primary: { main: '#007aff' } } });
    for (const k of Object.keys(base.colors)) {
      if (k !== 'primary') {
        expect(after.colors[k], k).toEqual(base.colors[k]);
      }
    }
  });

  it('覆盖 typography.fontSize 的一个键时，保留其余排版键', () => {
    const base = getDefaultTheme();
    const before = base.typography.fontSize;
    const after = mergeThemeOverrides(base, {
      typography: { fontSize: { body: '14px' } },
    });
    expect(after.typography.fontSize.body).toBe('14px');
    for (const k of Object.keys(before)) {
      if (k !== 'body') {
        expect(after.typography.fontSize[k], k).toBe(before[k]);
      }
    }
    // 同一 typography 下的其他维度也不受影响
    expect(after.typography.fontFamily).toEqual(base.typography.fontFamily);
  });

  it('presetThemes 全部预设经深合并后角色数不减少（结构性不回归）', () => {
    for (const [id, theme] of Object.entries(presetThemes)) {
      const after = mergeThemeOverrides(theme, {
        colors: { primary: { main: '#123456' } },
        typography: { fontSize: { body: '16px' } },
      });
      expect(Object.keys(after.colors).length, id).toBe(Object.keys(theme.colors).length);
      expect(Object.keys(after.typography.fontSize).length, id).toBe(
        Object.keys(theme.typography.fontSize).length,
      );
    }
  });
});

describe('generateCSSVariables — A2 色阶 fallback 路径', () => {
  const SCALE_TIERS = ['100', '200', '300', '400', '500', '600', '700', '800', '900', '950'];

  it('COLOR_MAIN_TO_L0 未命中的色档键产出 --color-<角色>-<档>，且全部通过 isSafeToken', () => {
    const base = getDefaultTheme();
    const colorOverrides = SCALE_TIERS.reduce<Record<string, string>>((acc, t) => {
      acc[t] = '#10b981';
      return acc;
    }, {});
    const theme = mergeThemeOverrides(base, {
      colors: { primary: { ...colorOverrides, main: '#007aff' } },
    });
    const vars = generateCSSVariables(theme);

    for (const t of SCALE_TIERS) {
      const name = `--color-primary-${t}`;
      expect(name in vars, name).toBe(true);
      expect(isSafeToken(name, vars[name]), name).toBe(true);
    }
    // primary-main 仍命中映射 → 写 --color-primary（不得被色档覆盖）
    expect(vars['--color-primary']).toBe('#007aff');
    expect(isSafeToken('--color-primary', vars['--color-primary'])).toBe(true);
  });

  it('所有生成的变量名均通过 SAFE_TOKEN_NAME 白名单', () => {
    const vars = generateCSSVariables(mergeThemeOverrides(getDefaultTheme(), {
      colors: { primary: { '100': '#d1fae5', '950': '#022c22' } },
    }));
    const rejected = Object.keys(vars).filter((n) => !isSafeToken(n, vars[n]));
    expect(rejected, `应无令牌被拒收: ${rejected.join(', ')}`).toHaveLength(0);
  });
});

describe('generateCSSVariables — A3 字体键名 kebab 化', () => {
  it('驼峰排版键产出带连字符的 L0 令牌名', () => {
    const vars = generateCSSVariables(getDefaultTheme());
    // L0 实际消费的正文令牌（base.css --text-body / --text-body-sm / --text-caption / --text-body-lg）
    for (const n of ['--text-body', '--text-body-sm', '--text-caption', '--text-body-lg', '--text-h1']) {
      expect(n in vars, n).toBe(true);
      expect(isSafeToken(n, vars[n]), n).toBe(true);
    }
    // 不得产出未 kebab 化的孤儿名（会在 :723 被拒收）
    for (const n of ['--text-bodySm', '--text-bodyLg']) {
      expect(n in vars, n).toBe(false);
    }
  });

  it('standard 预设的 --text-body 与 base.css 的 0.9375rem 一致', () => {
    const vars = generateCSSVariables(getDefaultTheme());
    expect(vars['--text-body']).toBe('0.9375rem');
  });
});

import {
  generateModeRampCSS,
  applyThemeToDOM,
  presetThemes,
  type ThemeConfig,
} from '../theme.presets';

// ============================================================================
// C1：模式反转色阶的运行时双作用域样式表
// ----------------------------------------------------------------------------
// 为什么必须双作用域：base.css 的 --color-primary-<档> 定义在 :root，
// dark.css 的同名令牌定义在 .dark（dark.css:7）。inline setProperty 的优先级
// 高于任何非 !important 选择器，会同时压过 :root 与 .dark —— 选完配色后切到
// 暗色模式，暗色画布上仍显示亮色 ramp，形成「断裂梯度」。
// ============================================================================
describe('C1 generateModeRampCSS — 双作用域色阶', () => {
  const LIGHT = {
    '100': '#d1fae5', '200': '#a7f3d0', '300': '#6ee7b7', '400': '#34d399', '500': '#10b981',
    '600': '#059669', '700': '#047857', '800': '#065f46', '900': '#064e3b', '950': '#022c22',
  };
  const DARK = {
    '100': '#064e3b', '200': '#065f46', '300': '#047857', '400': '#059669', '500': '#34d399',
    '600': '#6ee7b7', '700': '#a7f3d0', '800': '#d1fae5', '900': '#ecfdf5', '950': '#f0fdf4',
  };

  it('同时产出 :root 与 .dark 两个块，各 10 档', () => {
    const theme: ThemeConfig = { ...presetThemes['light-default'], modeRamps: { primary: LIGHT, primaryDark: DARK } };
    const css = generateModeRampCSS(theme);
    expect(css).toContain(':root {');
    expect(css).toContain('.dark {');
    for (const [t, v] of Object.entries(LIGHT)) expect(css, t).toContain(`--color-primary-${t}: ${v}`);
    for (const [t, v] of Object.entries(DARK)) expect(css, t).toContain(`--color-primary-${t}: ${v}`);
  });

  it('两组值落在各自作用域内 —— 暗色 500 只在 .dark 块，不出现在 :root 块', () => {
    const theme: ThemeConfig = { ...presetThemes['light-default'], modeRamps: { primary: LIGHT, primaryDark: DARK } };
    const css = generateModeRampCSS(theme);
    const root = css.split('.dark')[0];
    expect(root).not.toContain('--color-primary-500: #34d399');
    expect(root).not.toContain('--color-primary-950: #f0fdf4');
    expect(css.slice(css.indexOf('.dark'))).toContain('--color-primary-500: #34d399');
  });

  it('无覆盖时返回空串', () => {
    expect(generateModeRampCSS(presetThemes['light-default'])).toBe('');
    expect(generateModeRampCSS({ ...presetThemes['light-default'], modeRamps: {} })).toBe('');
  });

  it('拒绝越界的令牌值（与 inline 通道同一安全边界）', () => {
    const theme: ThemeConfig = {
      ...presetThemes['light-default'],
      modeRamps: { primary: { '500': '#10b981; background:url(x)', '600': 'ok' } },
    };
    const css = generateModeRampCSS(theme);
    expect(css).toContain('--color-primary-600: ok');
    expect(css).not.toContain('background');
  });

  it('忽略非档位键 —— colors 角色字段仍归 generateCSSVariables', () => {
    const theme: ThemeConfig = {
      ...presetThemes['light-default'],
      modeRamps: { primary: { main: '#ff0000', container: '#00ff00', '500': '#10b981' } },
    };
    const css = generateModeRampCSS(theme);
    expect(css).toContain('--color-primary-500: #10b981');
    expect(css).not.toContain('main');
    expect(css).not.toContain('container');
  });
});

describe('C1 generateCSSVariables — 让位模式反转令牌', () => {
  it('落在 modeRamps 覆盖范围内的档位令牌不出现在 inline 通道（避免 inline 压过 .dark）', () => {
    const LIGHT = { '100': '#d1fae5', '500': '#10b981', '950': '#022c22' };
    const base = presetThemes['light-default'];
    const theme: ThemeConfig = {
      ...base,
      colors: {
        ...base.colors,
        primary: { ...base.colors.primary, '100': '#d1fae5', '500': '#10b981', '950': '#022c22' },
      },
      modeRamps: { primary: LIGHT },
    };
    const vars = generateCSSVariables(theme);
    for (const t of ['100', '500', '950']) expect(vars[`--color-primary-${t}`], t).toBeUndefined();
    // C1.5：primary 语义族同为模式相关令牌（base.css / dark.css 各一份），
    // 一并让位给运行时 <style> 双作用域块 —— 否则选配色后切模式会出现容器底色
    // 仍是上一模式值的混排（实测：选蓝色后 --color-primary-container 仍为品牌绿）。
    expect(vars['--color-primary']).toBeUndefined();
    expect(vars['--color-primary-container']).toBeUndefined();
    expect(vars['--color-primary-text']).toBeUndefined();
    expect(vars['--color-primary-rgb']).toBeUndefined();
    // 非 primary 族的角色令牌不受影响，仍走 inline
    expect(vars['--color-secondary']).toBe(base.colors.secondary.main);
  });

  it('无 modeRamps 时档位令牌照旧进入 inline 通道（导入主题等既有路径不变）', () => {
    const base = presetThemes['light-default'];
    const theme: ThemeConfig = {
      ...base,
      colors: {
        ...base.colors,
        primary: { ...base.colors.primary, '500': '#ff0000' },
      },
    };
    const vars = generateCSSVariables(theme);
    expect(vars['--color-primary-500']).toBe('#ff0000');
  });
});

describe('C1 mergeThemeOverrides — modeRamps 合并', () => {
  it('亮/暗两组作用域各自独立合并', () => {
    const base: ThemeConfig = { ...presetThemes['light-default'], modeRamps: { primary: { '500': '#10b981' } } };
    const merged = mergeThemeOverrides(base, { modeRamps: { primaryDark: { '500': '#34d399' } } });
    expect(merged.modeRamps?.primary?.['500']).toBe('#10b981');
    expect(merged.modeRamps?.primaryDark?.['500']).toBe('#34d399');
  });

  it('换方案时整组替换，不残留上一方案的档位', () => {
    const base: ThemeConfig = {
      ...presetThemes['light-default'],
      modeRamps: { primary: { '100': '#aaaaaa', '500': '#10b981', '950': '#111111' } },
    };
    const merged = mergeThemeOverrides(base, { modeRamps: { primary: { '500': '#007aff', '950': '#001a4d' } } });
    expect(merged.modeRamps?.primary?.['500']).toBe('#007aff');
    expect(merged.modeRamps?.primary?.['950']).toBe('#001a4d');
    expect(merged.modeRamps?.primary?.['100']).toBeUndefined();
  });
});

describe('C1 applyThemeToDOM — 运行时样式表生命周期', () => {
  it('带 modeRamps 的主题写入 #rmfood-runtime-theme，且 <html> 内联无主色档位令牌', () => {
    const LIGHT = { '100': '#d1fae5', '500': '#10b981', '950': '#022c22' };
    const DARK = { '100': '#064e3b', '500': '#34d399', '950': '#f0fdf4' };
    applyThemeToDOM({
      ...presetThemes['light-default'],
      id: 'custom-runtime',
      isPreset: false,
      modeRamps: { primary: LIGHT, primaryDark: DARK },
    });

    const el = document.getElementById('rmfood-runtime-theme');
    expect(el).toBeTruthy();
    expect(el?.textContent).toContain(':root {');
    expect(el?.textContent).toContain('.dark {');
    // 关键：inline 不得出现档位令牌，否则暗色模式会错用亮色 ramp
    const root = document.documentElement;
    for (const t of ['100', '500', '950']) {
      expect(root.style.getPropertyValue(`--color-primary-${t}`)).toBe('');
    }
    // C1.5：primary 语义族同为模式相关令牌，也不得走 inline
    //（inline 压过 .dark 会让容器底色停留在上一模式的值）
    expect(root.style.getPropertyValue('--color-primary')).toBe('');
    expect(root.style.getPropertyValue('--color-primary-container')).toBe('');
  });

  it('运行时样式表按作用域推导 primary 语义族（C1.5），默认绿与 L0 逐值对齐', () => {
    // 完整 11 档默认绿 ramp：取自 base.css / dark.css 的 L0 权威值
    const LIGHT: Record<string, string> = {
      '50': '#ecfdf5', '100': '#d1fae5', '200': '#a7f3d0', '300': '#6ee7b7', '400': '#34d399',
      '500': '#10b981', '600': '#059669', '700': '#047857', '800': '#065f46', '900': '#064e3b', '950': '#022c22',
    };
    const DARK: Record<string, string> = {
      '50': '#022c22', '100': '#064e3b', '200': '#065f46', '300': '#047857', '400': '#059669',
      '500': '#34d399', '600': '#6ee7b7', '700': '#a7f3d0', '800': '#d1fae5', '900': '#ecfdf5', '950': '#f0fdf4',
    };
    const css = generateModeRampCSS({
      ...presetThemes['light-default'],
      id: 'custom-runtime',
      isPreset: false,
      modeRamps: { primary: LIGHT, primaryDark: DARK },
    });

    const split = (sel: string) =>
      css.slice(css.indexOf(`${sel} {`)).split('}')[0].trim();

    const light = split(':root');
    // 与 base.css:26-39 的 L0 定义逐值对齐
    // --color-primary 走 pickAATextTier：green 的 700 档对白底 4.83 / 对 container 4.84，
    // 均达 AA，故选 700 —— 与 L0 的 D-58 裁决（primary-500 → primary-700）一致。
    // 若此处返回 #10b981（500 档，白底仅 2.54），则是 D-58 回退。
    expect(light).toContain('--color-primary: #047857;');
    expect(light).not.toContain('--color-primary: #10b981;');
    expect(light).toContain('--color-primary-rgb: 16, 185, 129;');
    expect(light).toContain('--color-primary-container: #d1fae5;');
    expect(light).toContain('--color-primary-surface: #047857;');
    expect(light).toContain('--color-primary-surface-hover: #065f46;');
    expect(light).toContain('--color-primary-hover: #059669;');
    expect(light).toContain('--color-primary-text: #059669;');
    expect(light).toContain('--color-on-primary-surface: #ffffff;');

    const dark = split('.dark');
    // 与 dark.css:22-37 的 L0 定义逐值对齐
    expect(dark).toContain('--color-primary: #34d399;');
    expect(dark).toContain('--color-primary-rgb: 52, 211, 153;');
    expect(dark).toContain('--color-primary-container: rgba(52, 211, 153, 0.15);');
    expect(dark).toContain('--color-primary-surface: #065f46;');
    expect(dark).toContain('--color-primary-surface-hover: #047857;');
    expect(dark).toContain('--color-primary-text: #6ee7b7;');

    // 作用域隔离：亮色块不得泄漏暗色语义值，反之亦然
    //（注意 #34d399 是亮色档 400 的合法值，故按「声明」而非「字面」断言）
    expect(light).not.toContain('--color-primary-container: rgba(');
    expect(light).not.toContain('--color-primary-surface: #065f46;');
    expect(dark).not.toContain('--color-primary: #10b981;');
    expect(dark).not.toContain('--color-primary-container: #d1fae5;');
    expect(dark).not.toContain('--color-primary-surface: #047857;');
  });

  it('语义族从非绿配色正确推导（修复「选蓝后容器仍是品牌绿」的混排）', () => {
    const BLUE_LIGHT: Record<string, string> = {
      '100': '#d1e9ff', '200': '#b3d9ff', '300': '#8cc5ff', '400': '#60afff', '500': '#007aff',
      '600': '#0066cc', '700': '#0055aa', '800': '#004488', '900': '#003366',
    };
    const css = generateModeRampCSS({
      ...presetThemes['light-default'],
      id: 'custom-runtime',
      isPreset: false,
      modeRamps: { primary: BLUE_LIGHT },
    });
    const light = css.slice(css.indexOf(':root {')).split('}')[0];
    // 容器底色必须随配色变为蓝色系，而非 L0 品牌绿 #d1fae5
    expect(light).toContain('--color-primary-container: #d1e9ff;');
    expect(light).not.toContain('--color-primary-container: #d1fae5;');
    // --color-primary 按 AA 选档：blue 的 700 档（#0055aa）白底 7.30 / container 5.84，
    // 故选 700 而非 500（#007aff 白底仅 4.02，不达标）
    expect(light).toContain('--color-primary: #0055aa;');
    expect(light).not.toContain('--color-primary: #007aff;');
  });

  it('选档不足时逐级加深：橙色的 700 档压不过自己的 container，须落到 800（F2 收口）', () => {
    // 橙色是唯一 700 档不达标的配色：白底 4.85 ✅ 但 container 4.39 ❌（差 0.11）
    const ORANGE_LIGHT: Record<string, string> = {
      '50': '#fff5eb', '100': '#fff2e0', '200': '#ffdcb0', '300': '#ffc578', '400': '#ffaf42',
      '500': '#ff9500', '600': '#e68600', '700': '#a66100', '800': '#663c00',
      '900': '#331f00', '950': '#2a1a00',
    };
    const css = generateModeRampCSS({
      ...presetThemes['light-default'],
      id: 'custom-runtime',
      isPreset: false,
      modeRamps: { primary: ORANGE_LIGHT },
    });
    const light = css.slice(css.indexOf(':root {')).split('}')[0];
    // 700 对 container 仅 4.39（差 0.11），必须加深到 800（container 7.11 ✅）
    expect(light).not.toContain('--color-primary: #a66100;');
    expect(light).toContain('--color-primary: #663c00;');
  });

  it('切回内置纯净预设时移除运行时样式表，回到 L0 基线', () => {
    expect(document.getElementById('rmfood-runtime-theme')).toBeTruthy();

    applyThemeToDOM(presetThemes['light-default']);

    expect(document.getElementById('rmfood-runtime-theme')).toBeNull();
    expect(document.documentElement.style.getPropertyValue('--color-primary')).toBe('');
  });
});

// ============================================================================
// E3：次色 / 强调色的双作用域注入
// ----------------------------------------------------------------------------
// 三个品牌族（primary / secondary / accent）共享同一套模式反转机制：
//   档位令牌与语义族令牌都写进运行时 <style> 的 :root / .dark 块，
//   generateCSSVariables 对已选择过的族让位。
//
// 关键不变量：用【L0 默认色阶】喂入注入器，推导出的语义族取值必须与
// base.css / dark.css 的逐条定义完全一致 —— 这既证明「选默认 = 无变化」，
// 也证明 E3 的档位规则表没有偏离 L0。
// ============================================================================

describe('E3 generateModeRampCSS — 次色族', () => {
  // L0 权威值（base.css:41-52 亮 / dark.css:37-47 暗）
  const SEC_LIGHT: Record<string, string> = {
    '50': '#eff6ff', '100': '#dbeafe', '200': '#bfdbfe', '300': '#93c5fd', '400': '#60a5fa',
    '500': '#3b82f6', '600': '#2563eb', '700': '#1d4ed8', '800': '#1e40af', '900': '#1e3a8a', '950': '#172554',
  };
  const SEC_DARK: Record<string, string> = {
    '50': '#172554', '100': '#1e3a8a', '200': '#1e40af', '300': '#1d4ed8', '400': '#2563eb',
    '500': '#3b82f6', '600': '#60a5fa', '700': '#93c5fd', '800': '#bfdbfe', '900': '#dbeafe', '950': '#eff6ff',
  };

  it('只选了次色时产出次色块，且不触碰主色与强调色（按族独立判定）', () => {
    const css = generateModeRampCSS({
      ...presetThemes['light-default'],
      modeRamps: { secondary: SEC_LIGHT, secondaryDark: SEC_DARK },
    });
    expect(css).toContain(':root {');
    expect(css).toContain('.dark {');
    for (const [t, v] of Object.entries(SEC_LIGHT)) {
      expect(css, `secondary-${t}`).toContain(`--color-secondary-${t}: ${v}`);
    }
    // 未选择的族不得被写入运行时覆盖（否则会把「没动过」的族变成运行时态）
    expect(css).not.toContain('--color-primary-');
    expect(css).not.toContain('--color-accent-');
  });

  it('亮色块语义族与 base.css 逐条一致（container/surface 随色族走，不再残留上一模式值）', () => {
    const css = generateModeRampCSS({
      ...presetThemes['light-default'],
      id: 'custom-runtime', isPreset: false,
      modeRamps: { secondary: SEC_LIGHT, secondaryDark: SEC_DARK },
    });
    const light = css.slice(css.indexOf(':root {')).split('\n}')[0];
    // base.css:54 --color-secondary: var(--color-secondary-700)
    expect(light).toContain('--color-secondary: #1d4ed8;');
    // base.css:55 --color-secondary-rgb: 59, 130, 246（取 500 档）
    expect(light).toContain('--color-secondary-rgb: 59, 130, 246;');
    // base.css:56 --color-secondary-hover: var(--color-secondary-700)
    expect(light).toContain('--color-secondary-hover: #1d4ed8;');
    // base.css:57 --color-secondary-container: #dbeafe（100 档实色浅底）
    expect(light).toContain('--color-secondary-container: #dbeafe;');
    // base.css:135 --color-secondary-surface: var(--color-secondary-700)
    expect(light).toContain('--color-secondary-surface: #1d4ed8;');
    // base.css:136 --color-secondary-surface-deep: var(--color-secondary-800)
    expect(light).toContain('--color-secondary-surface-deep: #1e40af;');
  });

  it('暗色块语义族与 dark.css 逐条一致（main/rgb 取 600，container 为 rgba(600,.15)）', () => {
    const css = generateModeRampCSS({
      ...presetThemes['light-default'],
      id: 'custom-runtime', isPreset: false,
      modeRamps: { secondary: SEC_LIGHT, secondaryDark: SEC_DARK },
    });
    const dark = css.slice(css.indexOf('.dark {')).split('\n}')[0];
    // dark.css:49 --color-secondary: var(--color-secondary-600)
    expect(dark).toContain('--color-secondary: #60a5fa;');
    // dark.css:50 --color-secondary-rgb: 96, 165, 250
    expect(dark).toContain('--color-secondary-rgb: 96, 165, 250;');
    // dark.css:51 --color-secondary-hover: var(--color-secondary-700)
    expect(dark).toContain('--color-secondary-hover: #93c5fd;');
    // dark.css:52 --color-secondary-container: rgba(96, 165, 250, 0.15)
    expect(dark).toContain('--color-secondary-container: rgba(96, 165, 250, 0.15);');
    // dark.css:91/92 surface=200 / surface-deep=100
    expect(dark).toContain('--color-secondary-surface: #1e40af;');
    expect(dark).toContain('--color-secondary-surface-deep: #1e3a8a;');
    // 作用域隔离：暗色块不得出现亮色实色容器
    expect(dark).not.toContain('--color-secondary-container: #dbeafe;');
  });
});

describe('E3 generateModeRampCSS — 强调色族', () => {
  // L0 权威值（base.css:60-70 亮 / dark.css:55-65 暗）
  const ACC_LIGHT: Record<string, string> = {
    '50': '#faf5ff', '100': '#f3e8ff', '200': '#e8d5ff', '300': '#c084fc', '400': '#c084fc',
    '500': '#8b5cf6', '600': '#7c3aed', '700': '#6d28d9', '800': '#5b21b6', '900': '#3b0764', '950': '#1a0542',
  };
  const ACC_DARK: Record<string, string> = {
    '50': '#1a0542', '100': '#3b0764', '200': '#5b21b6', '300': '#6d28d9', '400': '#7c3aed',
    '500': '#8b5cf6', '600': '#a78bfa', '700': '#c4b5fd', '800': '#ddd6fe', '900': '#ede9fe', '950': '#faf5ff',
  };

  it('亮色块语义族与 base.css 逐条一致', () => {
    const css = generateModeRampCSS({
      ...presetThemes['light-default'],
      id: 'custom-runtime', isPreset: false,
      modeRamps: { accent: ACC_LIGHT, accentDark: ACC_DARK },
    });
    const light = css.slice(css.indexOf(':root {')).split('\n}')[0];
    // base.css:72 accent=700 / :73 rgb=139,92,246（500）/ :74 hover=600 / :75 container=100
    expect(light).toContain('--color-accent: #6d28d9;');
    expect(light).toContain('--color-accent-rgb: 139, 92, 246;');
    expect(light).toContain('--color-accent-hover: #7c3aed;');
    expect(light).toContain('--color-accent-container: #f3e8ff;');
    // base.css:79 surface=700 / :145 surface-deep=800
    expect(light).toContain('--color-accent-surface: #6d28d9;');
    expect(light).toContain('--color-accent-surface-deep: #5b21b6;');
  });

  it('暗色块语义族与 dark.css 逐条一致', () => {
    const css = generateModeRampCSS({
      ...presetThemes['light-default'],
      id: 'custom-runtime', isPreset: false,
      modeRamps: { accent: ACC_LIGHT, accentDark: ACC_DARK },
    });
    const dark = css.slice(css.indexOf('.dark {')).split('\n}')[0];
    // dark.css:67 accent=600 / :68 rgb=167,139,250 / :69 hover=700 / :70 container=rgba(600,.15)
    expect(dark).toContain('--color-accent: #a78bfa;');
    expect(dark).toContain('--color-accent-rgb: 167, 139, 250;');
    expect(dark).toContain('--color-accent-hover: #c4b5fd;');
    expect(dark).toContain('--color-accent-container: rgba(167, 139, 250, 0.15);');
    // dark.css:74 surface=200 / :101 surface-deep=100
    expect(dark).toContain('--color-accent-surface: #5b21b6;');
    expect(dark).toContain('--color-accent-surface-deep: #3b0764;');
  });
});

describe('E3 generateCSSVariables — 按族让位模式相关令牌', () => {
  // 让位边界说明：`--color-<族>-container` / `-surface` / `-surface-deep` / `-hover` /
  // `-rgb` 从不由 generateCSSVariables 产出 —— SemanticColors 的品牌角色只有
  // { main, light, dark, contrastText } 四个字段，这些令牌只存在于 L0 的
  // base.css / dark.css 里。inline 通道因此与它们没有直接冲突；让位的作用是把
  // `--color-<族>`（= main 的映射目标）从 inline 手里移交给运行时 <style>，
  // 使「主令牌 + 语义族 + 整档色阶」三者都按同一模式取值，不会出现选完配色
  // 后切模式时主令牌与容器底色各属于一个模式的混排。
  const SEC_LIGHT: Record<string, string> = { '100': '#dbeafe', '500': '#3b82f6', '950': '#172554' };

  it('选了次色时次色档位与语义令牌让位；主色 / 强调色不受影响（按族独立）', () => {
    const base = presetThemes['light-default'];
    const theme: ThemeConfig = {
      ...base,
      colors: {
        ...base.colors,
        secondary: { ...base.colors.secondary, '500': '#3b82f6', '950': '#172554' },
      },
      modeRamps: { secondary: SEC_LIGHT },
    };
    const vars = generateCSSVariables(theme);
    // 次色：档位 + 语义族全部让位给运行时 <style>
    for (const t of ['100', '500', '950']) expect(vars[`--color-secondary-${t}`], t).toBeUndefined();
    expect(vars['--color-secondary']).toBeUndefined();
    expect(vars['--color-secondary-container']).toBeUndefined();
    expect(vars['--color-secondary-surface']).toBeUndefined();
    expect(vars['--color-secondary-rgb']).toBeUndefined();
    // 未选择的族照旧走 inline（不因次色被选而被牵连）
    expect(vars['--color-primary']).toBeDefined();
    expect(vars['--color-accent']).toBeDefined();
  });

  it('未选任何族时三族全部照旧走 inline（既有路径零回归）', () => {
    const base = presetThemes['light-default'];
    const vars = generateCSSVariables(base);
    expect(vars['--color-primary']).toBeDefined();
    expect(vars['--color-secondary']).toBe(base.colors.secondary.main);
    expect(vars['--color-accent']).toBeDefined();
  });

  it('只选主色时次色 / 强调色不被牵连让位（C1.5 的按族边界在 E3 后仍成立）', () => {
    const base = presetThemes['light-default'];
    const theme: ThemeConfig = {
      ...base,
      modeRamps: { primary: { '500': '#10b981' } },
    };
    const vars = generateCSSVariables(theme);
    expect(vars['--color-primary']).toBeUndefined();
    expect(vars['--color-secondary']).toBe(base.colors.secondary.main);
    expect(vars['--color-accent']).toBeDefined();
  });

  it('三族同时选择时全部让位，且三族块都出现在运行时样式表', () => {
    const base = presetThemes['light-default'];
    const theme: ThemeConfig = {
      ...base,
      modeRamps: {
        primary: { '500': '#10b981' },
        secondary: { '500': '#3b82f6' },
        accent: { '500': '#8b5cf6' },
      },
    };
    const vars = generateCSSVariables(theme);
    for (const fam of ['primary', 'secondary', 'accent']) {
      expect(vars[`--color-${fam}`], fam).toBeUndefined();
      expect(vars[`--color-${fam}-container`], `${fam}-container`).toBeUndefined();
      expect(vars[`--color-${fam}-rgb`], `${fam}-rgb`).toBeUndefined();
    }
    const css = generateModeRampCSS(theme);
    expect(css).toContain('--color-primary-500: #10b981');
    expect(css).toContain('--color-secondary-500: #3b82f6');
    expect(css).toContain('--color-accent-500: #8b5cf6');
  });
});

