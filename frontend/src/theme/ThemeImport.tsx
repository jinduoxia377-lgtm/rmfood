import React, { useRef, useState } from 'react';
import { Upload, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useThemeStore } from '@/stores/themeStore';

/**
 * ThemeImport — 主题配置导入控件
 *
 * 从 JSON 文件导入配色配置，经【校验 + 规范化】后走 applyCustomTheme 单通道落地。
 * 不得在此直写 root.style.setProperty（方案基线 1 / GATE-17）。
 *
 * 三种被接受的输入形态（见 normalizeImportedConfig）：
 *   1. 新版导出 v2 `{ runtimeOverrides, paletteKey, fontScale, radiusScale }`
 *   2. 嵌套形态 `{ colors: { primary: { main: '#xxx' }, ... } }`
 *   3. 扁平形态 `{ primary: '#xxx', secondary: '#xxx', accent: '#xxx', ... }`
 */

/** 十六进制颜色（3/4/6/8 位） */
export const isHexColor = (v: unknown): v is string =>
  typeof v === 'string' && /^#[0-9A-Fa-f]{3,8}$/.test(v.trim());

/** WCAG 相对亮度与对比度：为新 main 选一个 AA 达标的前景色 */
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
 * 规范化导入内容 → 覆盖对象 + 选中态。
 *
 * 三种被接受的形态：
 *   1. 新版导出（v2）`{ runtimeOverrides, paletteKey, fontScale, radiusScale }`
 *      —— 原样回放，可还原整档色阶与选中态。
 *   2. 嵌套形态 `{ colors: { role: { main } } }` —— 直接当覆盖用。
 *   3. 扁平形态 `{ primary, secondary, accent, ... }` —— 映射到 colors 并补 contrastText。
 *
 * 扁平形态必须规范化（D-36）：mergeThemeOverrides 只读 `overrides.colors`，
 * 直接传扁平对象会**静默无任何效果** —— 用户以为导入成功了，实际什么都没变。
 */
export function normalizeImportedConfig(
  raw: Record<string, unknown>,
): { overrides: Record<string, unknown>; meta?: Record<string, string> } | null {
  // 1. 新版导出：runtimeOverrides 是用户实际的选择，原样回放
  if (raw.runtimeOverrides && typeof raw.runtimeOverrides === 'object') {
    const meta: Record<string, string> = {};
    for (const k of ['paletteKey', 'fontScale', 'radiusScale'] as const) {
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
  const base = useThemeStore.getState().activeTheme;
  if (!base) return null;

  // 对外字段名 → 内部角色名（accent 对外，tertiary 对内）
  const map: Array<[string, keyof typeof base.colors]> = [
    ['primary', 'primary'],
    ['secondary', 'secondary'],
    ['accent', 'tertiary'],
    ['success', 'success'],
    ['warning', 'warning'],
    ['error', 'error'],
    ['info', 'info'],
  ];

  const colors: Record<string, unknown> = {};
  for (const [field, role] of map) {
    const v = raw[field];
    if (!isHexColor(v)) continue;
    // 浅合并语义：必须给出**完整**角色对象，否则会丢字段
    colors[role] = {
      ...(base.colors[role] as Record<string, unknown>),
      main: v.trim(),
      contrastText: pickContrastText(v.trim()),
    };
  }

  return Object.keys(colors).length ? { overrides: { colors } } : null;
}

interface ThemeImportProps {
  onImport?: (success: boolean) => void;
  /** 提示文字（用于区分「当前配置」与「外部文件」两种导入语境） */
  hint?: string;
}

export const ThemeImport: React.FC<ThemeImportProps> = ({ onImport, hint }) => {
  const applyCustomTheme = useThemeStore(s => s.applyCustomTheme);
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<{ kind: 'error' | 'ok'; text: string } | null>(null);

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = ''; // 允许重选同名文件
    if (!file) return;

    try {
      const raw = JSON.parse(await file.text()) as Record<string, unknown>;
      const result = normalizeImportedConfig(raw);

      if (result) {
        applyCustomTheme(
          result.overrides as Parameters<typeof applyCustomTheme>[0],
          result.meta,
        );
        setMessage({ kind: 'ok', text: '已导入并应用（刷新后保留）' });
        onImport?.(true);
      } else {
        setMessage({
          kind: 'error',
          text: '无效的主题配置：需含 primary/secondary/accent 十六进制色，或 colors 对象',
        });
        onImport?.(false);
      }
    } catch {
      setMessage({ kind: 'error', text: '文件格式错误：请上传有效的 JSON 文件' });
      onImport?.(false);
    }
  };

  const Icon = message?.kind === 'ok' ? CheckCircle2 : AlertCircle;

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-neutral-300 px-4 py-2.5 text-sm text-neutral-700 transition-colors hover:border-primary-main hover:text-primary-main dark:border-neutral-600 dark:text-neutral-300 dark:hover:border-primary-main dark:hover:text-primary-main focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50"
      >
        <Upload size={16} aria-hidden />
        <span>{hint ?? '导入主题配置'}</span>
      </button>
      <input
        ref={fileRef}
        type="file"
        accept=".json,application/json"
        aria-label="选择主题配置 JSON 文件"
        onChange={handleFile}
        className="hidden"
        aria-hidden
        tabIndex={-1}
      />
      {message && (
        <p
          className={`flex items-center gap-2 text-xs ${message.kind === 'ok' ? 'text-success-600' : 'text-error-500'}`}
          aria-live="polite"
        >
          <Icon size={14} aria-hidden />
          <span>{message.text}</span>
        </p>
      )}
    </div>
  );
};

export default ThemeImport;
