import React, { useRef, useState } from 'react';
import { Upload, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useThemeStore } from '@/stores/themeStore';
import { normalizeImportedConfig } from './normalizeThemeImport';

/**
 * ThemeImport — 主题配置导入控件
 *
 * 从 JSON 文件导入配色配置，经【校验 + 规范化】后走 applyCustomTheme 单通道落地。
 * 不得在此直写 root.style.setProperty（方案基线 1 / GATE-17）。
 *
 * 规范化逻辑在 ./normalizeThemeImport（纯模块），与 stores/themeStore.ts 的
 * importTheme() 共用同一实现 —— 两条导入路径不得分叉。
 *
 * 三种被接受的输入形态（见 normalizeImportedConfig）：
 *   1. 新版导出 v2 `{ runtimeOverrides, paletteKey, fontScale, radiusScale }`
 *   2. 嵌套形态 `{ colors: { primary: { main: '#xxx' }, ... } }`
 *   3. 扁平形态 `{ primary: '#xxx', secondary: '#xxx', accent: '#xxx', ... }`
 */

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
      const result = normalizeImportedConfig(raw, useThemeStore.getState().activeTheme);

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
