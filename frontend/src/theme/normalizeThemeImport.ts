/**
 * normalizeThemeImport — 主题配置导入的纯规范化层（无 React、无 store 依赖）
 *
 * 为什么独立成模块：导入规范化此前写死在 `ThemeImport.tsx` 组件内，而
 * `stores/themeStore.ts` 的 `importTheme()` 是**另一条并行通道** —— 它把导入
 * 配置塞进 `customThemes` 并写 `imported-${Date.now()}` 作为 activeThemeId。
 * 那个 id 在冷启动 `initialize()` 里查不到表 → 回退 light-default，正是 R1 的
 * 同型缺陷（且 `customThemes` 没有任何 UI 删除入口）。
 *
 * 两条通道合一：store 与组件都调用本模块的 normalizeImportedConfig，
 * 再由 store 单通道 applyCustomTheme 落地（方案基线 1）。
 *
 * 纯函数要求：baseTheme 作为参数注入而非内部读 store，使本模块可被 store
 * 反向依赖而不形成循环。
 */
import type { ThemeConfig } from '../types/theme.types';

/** 规范化结果：覆盖对象 + 可选的 UI 选中态 */
export interface NormalizedImport {
  overrides: Record<string, unknown>;
  meta?: Record<string, string>;
}

/** 从 v2 导出快照中回收的选中态键（E3 新增次色 / 强调色） */
export const IMPORT_META_KEYS = [
  'paletteKey',
  'secondaryPaletteKey',
  'accentPaletteKey',
  'fontScale',
  'radiusScale',
] as const;

/** 十六进制颜色（3/4/6/8 位） */
export const isHexColor = (v: unknown): v is string =>
  typeof v === 'string' && /^#[0-9A-Fa-f]{3,8}$/.test(v.trim());

/** 相对亮度（WCAG 2.1）→ 为新 main 选一个 AA 达标的前景色 */
export const pickContrastText = (bg: string): string => {
  const h = bg.replace('#', '');
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  const [r, g, b] = [0, 2, 4]
    .map(i => parseInt(full.slice(i, i + 2), 16) / 255)
    .map(s => (s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)));
  const L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return 1.05 / (L + 0.05) >= (L + 0.05) / 0.05 ? '#ffffff' : '#052e16';
};

/**
 * 对外字段名 → 内部角色名（accent 对外、tertiary 对内）。
 * 只登记 `SemanticColors` 上真实存在的角色，避免拼错静默丢字段。
 */
export const IMPORT_ROLE_MAP: Array<[string, keyof ThemeConfig['colors']]> = [
  ['primary', 'primary'],
  ['secondary', 'secondary'],
  ['accent', 'tertiary'],
  ['success', 'success'],
  ['warning', 'warning'],
  ['error', 'error'],
  ['info', 'info'],
];

/**
 * 规范化导入内容 → 覆盖对象 + 选中态。
 *
 * 三种被接受的形态：
 *   1. 新版导出（v2）`{ runtimeOverrides, paletteKey, fontScale, radiusScale }`
 *      —— 原样回放，可还原整档色阶与选中态。
 *   2. 嵌套形态 `{ colors: { role: { main } } }` —— 直接当覆盖用。
 *   3. 扁平形态 `{ primary, secondary, accent, ... }` —— 映射到 colors 并补 contrastText。
 *
 * 扁平形态**必须**规范化（D-36）：mergeThemeOverrides 只读 `overrides.colors`，
 * 直接传扁平对象会**静默无任何效果** —— 用户以为导入成功了，实际什么都没变。
 *
 * @param raw 解析后的 JSON
 * @param baseTheme 当前激活主题（扁平形态需要它补齐角色对象的其余字段）
 * @returns 规范化结果；无法识别的形态返回 null（调用方据此提示错误）
 */
export function normalizeImportedConfig(
  raw: Record<string, unknown>,
  baseTheme: ThemeConfig | null,
): NormalizedImport | null {
  // 1. 新版导出：runtimeOverrides 是用户实际的选择，原样回放
  if (raw.runtimeOverrides && typeof raw.runtimeOverrides === 'object') {
    const meta: Record<string, string> = {};
    for (const k of IMPORT_META_KEYS) {
      if (typeof raw[k] === 'string' && (raw[k] as string)) meta[k] = raw[k] as string;
    }
    return {
      overrides: raw.runtimeOverrides as Record<string, unknown>,
      meta: Object.keys(meta).length ? meta : undefined,
    };
  }

  // 2. 嵌套形态：原样透传（落地时逐令牌过 isSafeToken）
  if (raw.colors && typeof raw.colors === 'object') return { overrides: raw };

  // 3. 扁平形态：映射为嵌套覆盖
  if (!baseTheme?.colors) return null;

  const colors: Record<string, unknown> = {};
  for (const [field, role] of IMPORT_ROLE_MAP) {
    const v = raw[field];
    if (!isHexColor(v)) continue;
    // 浅合并语义：必须给出**完整**角色对象，否则会丢字段
    colors[role] = {
      ...(baseTheme.colors[role] as Record<string, unknown>),
      main: v.trim(),
      contrastText: pickContrastText(v.trim()),
    };
  }

  return Object.keys(colors).length ? { overrides: { colors } } : null;
}
