import React, { useState, useCallback } from 'react';
import { useThemeStore } from '@/theme';
import { Save, RefreshCw, Download, Eye } from 'lucide-react';

interface CustomTheme {
  id: string;
  name: string;
  primary: string;
  secondary: string;
  accent: string;
  mode: 'light' | 'dark';
}

export const ThemeEditor: React.FC = () => {
  const { activeThemeId, setPresetTheme, applyCustomTheme } = useThemeStore();
  const [customTheme, setCustomTheme] = useState<CustomTheme>({
    id: 'custom-1',
    name: '自定义主题',
    primary: 'var(--color-primary)',
    secondary: 'var(--color-secondary)',
    accent: 'var(--color-accent)',
    mode: 'light',
  });
  const [isPreview, setIsPreview] = useState(false);

  const handleColorChange = (key: keyof CustomTheme, value: string) => {
    setCustomTheme(prev => ({ ...prev, [key]: value }));
  };

  const handleApply = () => {
    applyCustomTheme({ primary: customTheme.primary, secondary: customTheme.secondary, accent: customTheme.accent } as any);
    setIsPreview(false);
  };

  const handleExport = useCallback(() => {
    const blob = new Blob([JSON.stringify(customTheme, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'rmfood-custom-theme-' + customTheme.id + '.json';
    a.click();
    URL.revokeObjectURL(url);
  }, [customTheme]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">自定义主题编辑器</h2>
        <button
          onClick={() => setIsPreview(!isPreview)}
          className="px-4 py-2 rounded-[var(--radius-lg,18px)] bg-secondary-main text-white hover:bg-secondary-dark transition-colors"
        >
          <Eye size={16} className="inline mr-2" />
          {isPreview ? '退出预览' : '预览'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-2">
            主色
          </label>
          <input
            type="color"
            value={customTheme.primary}
            onChange={(e) => handleColorChange('primary', e.target.value)}
            className="w-full h-10 rounded border border-border-default"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-2">
            辅色
          </label>
          <input
            type="color"
            value={customTheme.secondary}
            onChange={(e) => handleColorChange('secondary', e.target.value)}
            className="w-full h-10 rounded border border-border-default"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-2">
            强调色
          </label>
          <input
            type="color"
            value={customTheme.accent}
            onChange={(e) => handleColorChange('accent', e.target.value)}
            className="w-full h-10 rounded border border-border-default"
          />
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={handleApply}
          className="flex-1 px-4 py-2 rounded-[var(--radius-lg,18px)] bg-primary-main text-white hover:bg-primary-dark transition-colors"
        >
          <Save size={16} className="inline mr-2" />
          应用主题
        </button>
        <button
          onClick={handleExport}
          className="flex-1 px-4 py-2 rounded-[var(--radius-lg,18px)] bg-neutral-main text-white hover:bg-neutral-dark transition-colors"
        >
          <Download size={16} className="inline mr-2" />
          导出配置
        </button>
        <button
          onClick={() => setPresetTheme('light-default')}
          className="flex-1 px-4 py-2 rounded-[var(--radius-lg,18px)] border border-border-default hover:border-primary-main transition-colors"
        >
          <RefreshCw size={16} className="inline mr-2" />
          重置默认
        </button>
      </div>
    </div>
  );
};

