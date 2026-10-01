import React, { useState } from 'react';

// CSS 变量安全过滤
const sanitizeCSSVariables = (obj: Record<string, string>): Record<string, string> => {
  const sanitized: Record<string, string> = {};
  for (const [key, value] of Object.entries(obj)) {
    // 只允许合法的颜色值
    if (/^#[0-9A-Fa-f]{3,8}$|^rgb\(.*\)^|^rgba\(.*\)^|^hsl\(.*\)^|^var\(--.*\)$/.test(value)) {
      sanitized[key] = value;
    }
  }
  return sanitized;
};

import { useThemeStore } from '@/theme';
import { Upload, AlertCircle } from 'lucide-react';

interface ThemeImportProps {
  onImport?: (success: boolean) => void;
}

export const ThemeImport: React.FC<ThemeImportProps> = ({ onImport }) => {
  const { applyCustomTheme } = useThemeStore();
  const [error, setError] = useState<string>('');

  const isHexColor = (v: unknown): v is string =>
    typeof v === 'string' && /^#[0-9A-Fa-f]{3,8}$/.test(v);

  /** 相对亮度与对比度，用于为新 main 选一个 AA 达标的前景色 */
  const pickContrastText = (bg: string): string => {
    const h = bg.replace('#', '');
    const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
    const [r, g, b] = [0, 2, 4]
      .map(i => parseInt(full.slice(i, i + 2), 16) / 255)
      .map(s => (s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)));
    const L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    // 与白色 / 近黑前景比较，取对比度更高者
    const withWhite = 1.05 / (L + 0.05);
    const withDark = (L + 0.05) / 0.05;
    return withWhite >= withDark ? '#ffffff' : '#052e16';
  };

  /** 扁平导入格式 `{primary:'#x', secondary:'#x', accent:'#x'}` → 完整嵌套覆盖对象 */
  const normalizeImportedConfig = (raw: Record<string, unknown>): Record<string, unknown> | null => {
    // 已是嵌套格式：原样透传
    if (raw.colors && typeof raw.colors === 'object') return raw;

    const base = useThemeStore.getState().activeTheme;
    if (!base) return null;

    const map: Array<[string, keyof typeof base.colors]> = [
      ['primary', 'primary'],
      ['secondary', 'secondary'],
      ['accent', 'tertiary'],   // 对外用 accent，内部角色名是 tertiary
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
        main: v,
        contrastText: pickContrastText(v),
      };
    }

    return Object.keys(colors).length ? { colors } : null;
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const raw = JSON.parse(text) as Record<string, unknown>;

      // D-36 修复：原实现把扁平对象 `{primary, secondary, accent}` 直接传给
      // applyCustomTheme，而 mergeThemeOverrides 只读 `overrides.colors` →
      // 导入**静默无任何效果**。此处规范化为 `{ colors: { role: {...} } }`。
      const overrides = normalizeImportedConfig(raw);

      if (overrides) {
        applyCustomTheme(overrides as Parameters<typeof applyCustomTheme>[0]);
        setError('');
        onImport?.(true);
      } else {
        setError('无效的主题配置文件（需含 primary/secondary/accent 十六进制色，或 colors 对象）');
        onImport?.(false);
      }
    } catch (err) {
      setError('文件格式错误，请上传有效的 JSON 文件');
      onImport?.(false);
    }
  };

  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 px-4 py-2 rounded-[var(--radius-lg,18px)] border-2 border-dashed border-gray-300 hover:border-green-500 cursor-pointer transition-colors">
        <Upload size={16} />
        <span className="text-sm">导入主题配置</span>
        <input
          type="file"
          accept=".json"
          onChange={handleFileChange}
          className="hidden"
        />
      </label>
      {error && (
        <div className="flex items-center gap-2 text-sm text-red-500">
          <AlertCircle size={14} />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};



