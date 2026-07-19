/**
 * CSS 变量生成器
 *
 * 从 design-tokens.ts 自动生成 CSS 自定义属性
 * 支持亮色/暗色主题切换
 *
 * 使用方法:
 *   npx tsx scripts/generate-css-variables.ts
 *
 * 输出:
 *   src/styles/generated/tokens.css — 亮色主题变量
 *   src/styles/generated/tokens-dark.css — 暗色主题变量
 */

import fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 导入设计 token
import {
  BRAND_COLORS,
  SECONDARY_COLORS,
  ACCENT_COLORS,
  NEUTRAL_COLORS,
  FUNCTIONAL_COLORS,
  FONT_SIZES,
  LINE_HEIGHTS,
  FONT_WEIGHTS,
  LETTER_SPACING,
  SPACING,
  BORDER_RADIUS,
  SHADOWS,
  ANIMATION,
} from '../src/types/design-tokens';

// 颜色转换工具
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return { r: 0, g: 0, b: 0 };
  return {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  };
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b);
  let h = 0,
    s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return { h: h * 360, s: s * 100, l: l * 100 };
}

function invertLightness(hex: string): string {
  const rgb = hexToRgb(hex);
  const { h, s, l } = rgbToHsl(rgb.r, rgb.g, rgb.b);
  // 反转亮度，保持色相和饱和度
  const newL = Math.max(0, Math.min(100, 100 - l));

  // 简单的 HSL 到 Hex 转换
  const sDecimal = s / 100;
  const lDecimal = newL / 100;

  const c = (1 - Math.abs(2 * lDecimal - 1)) * sDecimal;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = lDecimal - c / 2;

  let r1 = 0,
    g1 = 0,
    b1 = 0;
  if (h >= 0 && h < 60) {
    r1 = c;
    g1 = x;
    b1 = 0;
  } else if (h >= 60 && h < 120) {
    r1 = x;
    g1 = c;
    b1 = 0;
  } else if (h >= 120 && h < 180) {
    r1 = 0;
    g1 = c;
    b1 = x;
  } else if (h >= 180 && h < 240) {
    r1 = 0;
    g1 = x;
    b1 = c;
  } else if (h >= 240 && h < 300) {
    r1 = x;
    g1 = 0;
    b1 = c;
  } else {
    r1 = c;
    g1 = 0;
    b1 = x;
  }

  const rf = Math.round((r1 + m) * 255);
  const gf = Math.round((g1 + m) * 255);
  const bf = Math.round((b1 + m) * 255);

  return `#${rf.toString(16).padStart(2, '0')}${gf.toString(16).padStart(2, '0')}${bf.toString(16).padStart(2, '0')}`;
}

function cssVarName(key: string): string {
  return `--${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
}

// 生成颜色变量
function generateColorVars(colors: Record<string, any>, prefix: string): string[] {
  const vars: string[] = [];

  for (const [group, shades] of Object.entries(colors)) {
    if (typeof shades === 'object' && !Array.isArray(shades)) {
      for (const [shade, value] of Object.entries(shades)) {
        if (typeof value === 'string' && value.startsWith('#')) {
          // 使用简洁的变量名: --color-{prefix}-{shade}
          vars.push(`  --color-${prefix}-${shade}: ${value};`);
        }
      }
    }
  }

  return vars;
}

// 生成功能色变量（特殊处理，因为 FUNCTIONAL_COLORS 结构不同）
function generateFunctionalColorVars(): string[] {
  const vars: string[] = [];
  const functionalNames = ['success', 'warning', 'error', 'info'];

  for (const funcName of functionalNames) {
    const funcColors = FUNCTIONAL_COLORS[funcName as keyof typeof FUNCTIONAL_COLORS];
    if (funcColors && typeof funcColors === 'object') {
      for (const [shade, value] of Object.entries(funcColors)) {
        if (typeof value === 'string' && value.startsWith('#')) {
          vars.push(`  --color-${funcName}-${shade}: ${value};`);
        }
      }
    }
  }

  return vars;
}

// 生成主 CSS 文件
function generateLightTheme(): string {
  const lines: string[] = [
    '/* ═══════════════════════════════════════════════════════════════',
    '   RMFOOD Design Tokens - CSS Variables (Auto-generated)',
    '   请勿手动编辑此文件，运行 `npm run tokens:generate` 重新生成',
    '   ═══════════════════════════════════════════════════════════════ */',
    '',
    ':root {',
    '',
    '  /* ═══ 品牌主色 - Emerald Green ═══ */',
    ...generateColorVars(BRAND_COLORS, 'primary'),
    '',
    '  /* ═══ 品牌辅色 - Ocean Blue ═══ */',
    ...generateColorVars(SECONDARY_COLORS, 'secondary'),
    '',
    '  /* ═══ 品牌强调色 - Bio Purple ═══ */',
    ...generateColorVars(ACCENT_COLORS, 'accent'),
    '',
    '  /* ═══ 中性色 - Slate ═══ */',
    ...generateColorVars(NEUTRAL_COLORS, 'slate'),
    '',
    '  /* ═══ 功能色 ═══ */',
    ...generateFunctionalColorVars(),
    '',
    '  /* ═══ 字体系统 ═══ */',
    '  --font-sans: "Noto Sans SC", system-ui, -apple-system, sans-serif;',
    '  --font-serif: "Noto Serif SC", Georgia, serif;',
    '  --font-mono: "JetBrains Mono", "Fira Code", monospace;',
    '',
    '  /* 字体大小 */',
    ...Object.entries(FONT_SIZES).map(([key, value]) => `  --text-${key}: ${value};`),
    '',
    '  /* 行高 */',
    ...Object.entries(LINE_HEIGHTS).map(([key, value]) => `  --line-height-${key}: ${value};`),
    '',
    '  /* 字重 */',
    ...Object.entries(FONT_WEIGHTS).map(([key, value]) => `  --font-weight-${key}: ${value};`),
    '',
    '  /* 字间距 */',
    ...Object.entries(LETTER_SPACING).map(([key, value]) => `  --letter-spacing-${key}: ${value};`),
    '',
    '  /* ═══ 间距系统 (4pt 网格) ═══ */',
    ...Object.entries(SPACING).map(([key, value]) => `  --spacing-${key}: ${value};`),
    '',
    '  /* ═══ 圆角系统 ═══ */',
    ...Object.entries(BORDER_RADIUS).map(([key, value]) => `  --radius-${key}: ${value};`),
    '',
    '  /* ═══ 阴影系统 ═══ */',
    ...Object.entries(SHADOWS).map(([key, value]) => `  --shadow-${key}: ${value};`),
    '',
    '  /* ═══ 动效系统 ═══ */',
    '  --duration-fast: 100ms;',
    '  --duration-normal: 200ms;',
    '  --duration-slow: 300ms;',
    '  --duration-very-slow: 500ms;',
    '',
    '  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);',
    '  --ease-in: cubic-bezier(0.7, 0, 0.84, 1);',
    '  --ease-in-out: cubic-bezier(0.87, 0, 0.13, 1);',
    '  --ease-spring: cubic-bezier(0.175, 0.885, 0.32, 1.275);',
    '',
    '  /* ═══ 背景色 ═══ */',
    '  --bg-primary: #FFFFFF;',
    '  --bg-secondary: #F8FAFC;',
    '  --bg-tertiary: #F1F5F9;',
    '',
    '  /* ═══ 文本色 ═══ */',
    '  --text-primary: #0F172A;',
    '  --text-secondary: #334155;',
    '  --text-tertiary: #64748B;',
    '  --text-disabled: #94A3B8;',
    '',
    '  /* ═══ 边框色 ═══ */',
    '  --border-default: #CBD5E1;',
    '  --border-focus: #2563EB;',
    '',
    '}',
  ];

  return lines.join('\n');
}

// 生成暗色主题变量
function generateDarkTheme(): string {
  const lines: string[] = [
    '/* ═══════════════════════════════════════════════════════════════',
    '   RMFOOD Design Tokens - Dark Theme (Auto-generated)',
    '   ═══════════════════════════════════════════════════════════════ */',
    '',
    '.dark {',
    '',
    '  /* ═══ 背景色反转 ═══ */',
    '  --bg-primary: #0F172A;',
    '  --bg-secondary: #1E293B;',
    '  --bg-tertiary: #334155;',
    '',
    '  /* ═══ 文本色反转 ═══ */',
    '  --text-primary: #F1F5F9;',
    '  --text-secondary: #CBD5E1;',
    '  --text-tertiary: #94A3B8;',
    '  --text-disabled: #64748B;',
    '',
    '  /* ═══ 边框色调整 ═══ */',
    '  --border-default: #475569;',
    '  --border-focus: #60A5FA;',
    '',
    '  /* ═══ 阴影调整 (暗色模式降低阴影强度) ═══ */',
    '  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.3);',
    '  --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.25);',
    '  --shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.2);',
    '  --shadow-xl: 0 20px 25px rgba(0, 0, 0, 0.15);',
    '',
    '}',
  ];

  return lines.join('\n');
}

// 主函数
function main() {
  const outputDir = path.join(__dirname, '../src/styles/generated');

  // 确保输出目录存在
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // 生成亮色主题
  const lightTheme = generateLightTheme();
  fs.writeFileSync(path.join(outputDir, 'tokens.css'), lightTheme, 'utf-8');
  console.log('✓ Generated tokens.css');

  // 生成暗色主题
  const darkTheme = generateDarkTheme();
  fs.writeFileSync(path.join(outputDir, 'tokens-dark.css'), darkTheme, 'utf-8');
  console.log('✓ Generated tokens-dark.css');

  console.log('\n设计 Token 生成完成！');
  console.log(`输出目录: ${outputDir}`);
}

main();
