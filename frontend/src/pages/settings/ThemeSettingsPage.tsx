import React, { useState, useRef } from 'react';
import {
  Sun,
  Moon,
  Monitor,
  Palette,
  Save,
  RotateCcw,
  CheckCircle2,
  Eye,
  Download,
  Upload,
  Share2,
  Settings,
  Sparkles,
  Search,
  Bell,
  User,
  Home,
  FileText,
  Accessibility,
  BookOpen,
} from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { Section } from '@/components/common';
import {
  useTheme,
  useThemeStore,
  useThemeColors,
  useIsDarkMode,
  type ThemeMode,
  type AccessibilityMode,
  presetThemes,
  type PresetThemeId,
  type ThemeConfig,
} from '@/theme';

const ThemeSettingsPage: React.FC = () => {
  const {
    mode,
    accessibilityMode,
    setThemeMode,
    setPresetTheme,
    setAccessibilityMode,
    resetToDefault,
  } = useTheme();

  const {
    motionPreferences,
    setMotionPreferences,
  } = useThemeStore();

  const colors = useThemeColors();
  const isDark = useIsDarkMode();

  const [expandedSections, setExpandedSections] = useState({
    theme: true,
    preview: true,
    presets: true,
    accessibility: false,
    importExport: false,
  });

  const [selectedPreset, setSelectedPreset] = useState<string>('light-default');

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section as keyof typeof prev],
    }));
  };

  const handlePresetApply = (presetId: string) => {
    setSelectedPreset(presetId);
    setPresetTheme(presetId as PresetThemeId);
  };

  // 导出主题配置
  const exportThemeConfig = () => {
    const config = {
      mode,
      accessibilityMode,
      selectedPreset,
      motionPreferences,
      exportDate: new Date().toISOString(),
      version: '2.0',
    };
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rmfood-theme-v2-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // 导入主题配置
  const fileInputRef = useRef<HTMLInputElement>(null);
  const handleImportTheme = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target?.result as string);
        if (imported && typeof imported === 'object') {
          if (imported.mode) setThemeMode(imported.mode);
          if (imported.accessibilityMode) setAccessibilityMode(imported.accessibilityMode);
          if (imported.selectedPreset) setPresetTheme(imported.selectedPreset);
          alert('✅ 主题配置导入成功！');
        }
      } catch {
        alert('❌ 导入失败：无效的主题配置文件');
      }
    };
    reader.readAsText(file);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-6 sm:py-8 px-3 sm:px-4">
      {/* 页面标题 */}
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-text-primary">
          主题设置
        </h1>
        <p className="text-sm sm:text-base mt-2 text-text-secondary">
          自定义 RMFOOD 平台的外观和交互体验，支持无障碍访问
        </p>
      </div>

      <div className="space-y-4 sm:space-y-6 mb-6 sm:mb-8">
        {/* ==================== 1. 主题模式选择 ==================== */}
        <Section
          id="theme"
          title="主题模式"
          icon={Palette}
          isExpanded={expandedSections.theme}
          onToggle={toggleSection}
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            {[
              { mode: 'light' as ThemeMode, icon: Sun, label: '浅色模式', desc: '明亮清爽，适合白天使用' },
              { mode: 'dark' as ThemeMode, icon: Moon, label: '深色模式', desc: '护眼沉浸，适合夜间使用' },
              { mode: 'system' as ThemeMode, icon: Monitor, label: '跟随系统', desc: '自动适配操作系统偏好' },
            ].map(({ mode: modeOption, icon: Icon, label, desc }) => (
              <button
                key={modeOption}
                onClick={() => setThemeMode(modeOption)}
                className={`
                  flex flex-col items-center justify-center p-6 rounded-xl border-2 transition-all duration-200
                  ${mode === modeOption
                    ? 'border-primary-main bg-primary-main/5 dark:bg-primary-main/10'
                    : 'border-border-default hover:border-border-hover bg-background-elevated'
                  }
                  focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-main/50
                `}
              >
                <div className={`
                  w-12 h-12 rounded-full flex items-center justify-center mb-3
                  ${mode === modeOption
                    ? 'bg-primary-main text-primary-contrast-text'
                    : 'bg-background-hover text-text-secondary'
                  }
                `}>
                  <Icon size={24} />
                </div>
                <span className="font-semibold text-text-primary">{label}</span>
                <span className="text-xs mt-1 text-text-secondary">{desc}</span>
              </button>
            ))}
          </div>
        </Section>

        {/* ==================== 2. 实时预览 ==================== */}
        <Section
          id="preview"
          title="效果预览"
          icon={Eye}
          isExpanded={expandedSections.preview}
          onToggle={toggleSection}
        >
          <ThemePreview isDark={isDark} />
        </Section>

        {/* ==================== 3. 预设主题 ==================== */}
        <Section
          id="presets"
          title="预设主题"
          icon={Palette}
          isExpanded={expandedSections.presets}
          onToggle={toggleSection}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(['light-default', 'dark-default'] as PresetThemeId[]).map((id) => {
              const theme = presetThemes[id];
              const isActive = selectedPreset === id;
              const primaryColor = theme.colors.primary.main;

              return (
                <button
                  key={id}
                  onClick={() => handlePresetApply(id)}
                  className={`
                    text-left p-5 rounded-xl border-2 transition-all duration-200
                    ${isActive
                      ? 'border-primary-main bg-primary-main/5 shadow-md'
                      : 'border-border-default hover:border-border-hover bg-background-elevated hover:shadow-sm'
                    }
                    focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-main/50
                  `}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div
                      className="w-10 h-10 rounded-lg shadow-sm"
                      style={{ backgroundColor: primaryColor }}
                    />
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-text-primary truncate">{theme.name}</h4>
                      <p className="text-xs text-text-secondary line-clamp-1">{theme.description}</p>
                    </div>
                    {isActive && (
                      <CheckCircle2 size={20} className="text-primary-main flex-shrink-0" />
                    )}
                  </div>

                  {/* 颜色条预览 */}
                  <div className="flex gap-1.5 h-6 rounded-lg overflow-hidden">
                    <div className="flex-[2]" style={{ backgroundColor: theme.colors.primary.main }} />
                    <div className="flex-[1.5]" style={{ backgroundColor: theme.colors.secondary.main }} />
                    <div className="flex-[1]" style={{ backgroundColor: theme.colors.success.main }} />
                  </div>

                  {/* 标签 */}
                  <div className="flex gap-2 mt-3">
                    {theme.mode === 'dark' && (
                      <span className="px-2 py-0.5 text-xs rounded-full bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900">
                        Dark
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </Section>

        {/* ==================== 4. 无障碍功能 ==================== */}
        <Section
          id="accessibility"
          title="无障碍功能"
          icon={Accessibility}
          isExpanded={expandedSections.accessibility}
          onToggle={toggleSection}
        >
          <div className="space-y-6">
            {/* 辅助功能模式 */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-3">
                辅助功能模式
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { mode: 'normal' as AccessibilityMode, icon: Eye, label: '标准', desc: '默认模式' },
                  { mode: 'high-contrast' as AccessibilityMode, icon: ContrastIcon, label: '高对比度', desc: 'WCAG AAA' },
                  { mode: 'reading' as AccessibilityMode, icon: BookOpen, label: '阅读模式', desc: '护眼色调' },
                  { mode: 'color-blind' as AccessibilityMode, icon: Palette, label: '色盲友好', desc: '色觉优化' },
                ].map(({ mode: accMode, icon: Icon, label, desc }) => (
                  <button
                    key={accMode}
                    onClick={() => setAccessibilityMode(accMode)}
                    className={`
                      p-4 rounded-xl border-2 transition-all text-center
                      ${accessibilityMode === accMode
                        ? 'border-primary-main bg-primary-main/5'
                        : 'border-border-default hover:border-border-hover bg-background-elevated'
                      }
                      focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-main/50
                    `}
                  >
                    <Icon size={24} className={`mx-auto mb-2 ${
                      accessibilityMode === accMode ? 'text-primary-main' : 'text-text-secondary'
                    }`} />
                    <div className="font-medium text-sm text-text-primary">{label}</div>
                    <div className="text-xs text-text-secondary">{desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Reduced Motion 开关 */}
            <div className="flex items-center justify-between p-4 rounded-xl border border-border-default bg-background-elevated">
              <div>
                <div className="font-medium text-text-primary">减少动画</div>
                <div className="text-sm text-text-secondary">减少或禁用动态效果（符合用户系统偏好）</div>
              </div>
              <button
                onClick={() => setMotionPreferences({ reducedMotion: !motionPreferences.reducedMotion })}
                className={`
                  relative w-14 h-8 rounded-full transition-colors duration-200
                  ${motionPreferences.reducedMotion ? 'bg-primary-main' : 'bg-border-default'}
                `}
                aria-label="切换减少动画"
              >
                <span
                  className={`
                    absolute top-1 left-1 w-6 h-6 rounded-full bg-white transition-transform duration-200 shadow-md
                    ${motionPreferences.reducedMotion ? 'translate-x-6' : 'translate-x-0'}
                  `}
                />
              </button>
            </div>
          </div>
        </Section>

        {/* ==================== 5. 导入/导出 ==================== */}
        <Section
          id="importExport"
          title="导入 / 导出"
          icon={Share2}
          isExpanded={expandedSections.importExport}
          onToggle={toggleSection}
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* 导出 */}
            <button
              onClick={exportThemeConfig}
              className="flex flex-col items-center justify-center p-6 rounded-xl border-2 border-border-default hover:border-primary-main hover:bg-primary-main/5 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-main/50"
            >
              <div className="w-12 h-12 rounded-full bg-secondary-100 dark:bg-secondary-900/30 flex items-center justify-center mb-3">
                <Download size={24} className="text-secondary-600 dark:text-secondary-400" />
              </div>
              <span className="font-semibold text-text-primary">导出配置</span>
              <span className="text-xs text-text-secondary mt-1">保存为 JSON 文件</span>
            </button>

            {/* 导入 */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center justify-center p-6 rounded-xl border-2 border-border-default hover:border-primary-main hover:bg-primary-main/5 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-main/50"
            >
              <div className="w-12 h-12 rounded-full bg-success-100 dark:bg-success-900/30 flex items-center justify-center mb-3">
                <Upload size={24} className="text-success-600 dark:text-success-400" />
              </div>
              <span className="font-semibold text-text-primary">导入配置</span>
              <span className="text-xs text-text-secondary mt-1">从文件恢复设置</span>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleImportTheme}
                className="hidden"
              />
            </button>

            {/* 分享 */}
            <button
              onClick={() => {
                navigator.clipboard.writeText(window.location.href).then(() => {
                  alert('🔗 页面链接已复制到剪贴板');
                });
              }}
              className="flex flex-col items-center justify-center p-6 rounded-xl border-2 border-border-default hover:border-primary-main hover:bg-primary-main/5 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-main/50"
            >
              <div className="w-12 h-12 rounded-full bg-accent-100 dark:bg-accent-900/30 flex items-center justify-center mb-3">
                <Share2 size={24} className="text-accent-600 dark:text-accent-400" />
              </div>
              <span className="font-semibold text-text-primary">分享页面</span>
              <span className="text-xs text-text-secondary mt-1">复制当前链接</span>
            </button>
          </div>
        </Section>
      </div>

      {/* 底部操作栏 */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4 pt-6 border-t border-border-divider">
        <Button
          variant="ghost"
          onClick={resetToDefault}
          icon={<RotateCcw size={16} />}
          size="sm"
        >
          重置默认设置
        </Button>
        <Button
          variant="primary"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          icon={<Save size={16} />}
          size="sm"
        >
          完成设置
        </Button>
      </div>
    </div>
  );
};

// ==================== 子组件 ====================

/** 主题预览组件 */
const ThemePreview: React.FC<{ isDark: boolean }> = ({ isDark }) => (
  <div className="rounded-2xl overflow-hidden border border-border-default shadow-lg" style={{ maxWidth: '800px', margin: '0 auto' }}>
    {/* 模拟导航栏 */}
    <div className="flex items-center justify-between px-6 py-4 border-b border-border-divider bg-surface-default">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-main to-primary-dark flex items-center justify-center text-white">
          <Sparkles size={16} />
        </div>
        <span className="font-semibold text-text-primary">RMFOOD</span>
      </div>
      <div className="flex items-center gap-3">
        <div className="relative hidden sm:block">
          <input
            type="text"
            placeholder="搜索配方..."
            className="pl-9 pr-4 py-2 rounded-lg text-sm border border-border-default bg-background-elevated text-text-primary placeholder:text-text-disabled focus:border-primary-main focus:outline-none focus:ring-1 focus:ring-primary-main/30"
          />
          <Search size={16} className="absolute left-3 top-2.5 text-text-disabled" />
        </div>
        <button className="p-2 rounded-lg hover:bg-background-hover transition-colors">
          <Bell size={18} className="text-text-secondary" />
        </button>
        <button className="p-2 rounded-lg hover:bg-background-hover transition-colors">
          <User size={18} className="text-text-secondary" />
        </button>
      </div>
    </div>

    {/* 主内容区 */}
    <div className="p-6 bg-background-default space-y-6">
      {/* 欢迎横幅 */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-primary-main to-primary-dark text-white">
        <h2 className="text-2xl font-bold mb-2">欢迎回来 👋</h2>
        <p className="text-white/80">开始您今天的配方研发工作</p>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-2 gap-4">
        <div className="p-5 rounded-xl border border-border-default bg-surface-default shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-lg bg-primary-main/10 flex items-center justify-center">
              <FileText size={20} className="text-primary-main" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-text-primary">128</span>
            <span className="text-sm text-text-secondary">配方总数</span>
          </div>
        </div>
        <div className="p-5 rounded-xl border border-border-default bg-surface-default shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-lg bg-secondary-main/10 flex items-center justify-center">
              <Home size={20} className="text-secondary-main" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-text-primary">32</span>
            <span className="text-sm text-text-secondary">实验总数</span>
          </div>
        </div>
      </div>

      {/* 按钮预览 */}
      <div>
        <h3 className="text-sm font-medium text-text-secondary mb-3">按钮样式</h3>
        <div className="flex flex-wrap gap-3">
          <button className="px-5 py-2.5 rounded-lg font-medium bg-primary-main text-primary-contrast-text hover:bg-primary-light transition-colors shadow-sm">
            主要按钮
          </button>
          <button className="px-5 py-2.5 rounded-lg font-medium border-2 border-primary-main text-primary-main hover:bg-primary-main/5 transition-colors">
            次要按钮
          </button>
          <button className="px-5 py-2.5 rounded-lg font-medium text-primary-main hover:bg-primary-main/10 transition-colors">
            文本按钮
          </button>
        </div>
      </div>

      {/* 输入框预览 */}
      <div>
        <h3 className="text-sm font-medium text-text-secondary mb-3">输入框样式</h3>
        <input
          type="text"
          placeholder="请输入内容..."
          className="w-full px-4 py-3 rounded-lg border border-border-default bg-surface-default text-text-primary placeholder:text-text-disabled focus:border-primary-main focus:outline-none focus:ring-2 focus:ring-primary-main/20"
        />
      </div>
    </div>
  </div>
);

/** 自定义对比度图标 */
const ContrastIcon: React.FC<{ size?: number; className?: string }> = ({ size = 24, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 2a10 10 0 0 1 0 20z" fill="currentColor" />
  </svg>
);

export default ThemeSettingsPage;
