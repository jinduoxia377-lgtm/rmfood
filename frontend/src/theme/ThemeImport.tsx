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

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const config = JSON.parse(text) as {
        primary?: string;
        secondary?: string;
        accent?: string;
      };

      if (config.primary || config.secondary || config.accent) {
        applyCustomTheme(config as Record<string, unknown>);
        setError('');
        onImport?.(true);
      } else {
        setError('无效的主题配置文件');
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



