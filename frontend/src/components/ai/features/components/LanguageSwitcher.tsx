/**
 * LanguageSwitcher - 语言切换器组件 (v1.0)
 *
 * 提供多语言切换 UI，支持中英文双语。
 * 符合 WCAG 2.1 AA 无障碍标准。
 *
 * 功能特性：
 * - 下拉选择或按钮组切换模式
 * - 语言 flag 图标显示
 * - 实时切换无刷新
 * - 持久化语言偏好（localStorage）
 * - 响应式设计 + Dark Mode 支持
 *
 * @version 1.0.0
 * @lastUpdated 2026-05-12
 */

import React from 'react';
import { Globe, ChevronDown, Check } from 'lucide-react';
import { Button } from '@/components/ui';
import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES } from '../i18n/index';


import { logger } from '@/utils/safeLogger';
interface LanguageSwitcherProps {
  variant?: 'dropdown' | 'buttons';
  size?: 'sm' | 'md' | 'lg';
  showFlag?: boolean;
  showNativeName?: boolean;
  className?: string;
}

function LanguageSwitcher({
  variant = 'dropdown',
  size = 'md',
  showFlag = true,
  showNativeName = true,
  className = '',
}: LanguageSwitcherProps) {
  const { i18n, t } = useTranslation();
  const [isOpen, setIsOpen] = React.useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  const currentLanguage = React.useMemo(
    () => SUPPORTED_LANGUAGES.find((l: { code: string }) => l.code === i18n.language),
    [i18n.language],
  );

  /**
   * 切换语言
   */
  const handleLanguageChange = async (langCode: string) => {
    try {
      await i18n.changeLanguage(langCode);
      setIsOpen(false);
    } catch (error) {
      logger.error('[LanguageSwitcher] Failed to change language:', error);
    }
  };

  // 点击外部关闭下拉菜单
  React.useEffect(() => {
    if (!isOpen) return
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // ESC 键关闭菜单
  React.useEffect(() => {
    if (!isOpen) return
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsOpen(false);
    }

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen]);

  if (variant === 'buttons') {
    return (
      <div
        role="radiogroup"
        aria-label={t('settings.language')}
        className={`inline-flex rounded-lg border border-neutral-200 dark:border-neutral-700 p-1 ${className}`}
      >
        {SUPPORTED_LANGUAGES.map((lang: { code: string; name: string; flag: string }) => (
          <button
            key={lang.code}
            onClick={() => handleLanguageChange(lang.code)}
            role="radio"
            aria-checked={i18n.language === lang.code}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
              i18n.language === lang.code
                ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-600 shadow-sm'
                : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:text-neutral-200 dark:hover:bg-neutral-700'
            }`}
          >
            <span className="mr-1.5">{lang.flag}</span>
            {lang.name.split(' ')[0]}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      <Button
        variant="outline"
        size={size}
        icon={<Globe className="w-4 h-4" />}
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        className="gap-2"
      >
        {showFlag && <span>{currentLanguage?.flag}</span>}
        <span className="hidden sm:inline">{currentLanguage?.name || t('settings.language')}</span>
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </Button>

      {isOpen && (
        <div
          className="absolute top-full right-0 mt-2 w-56 bg-white dark:bg-neutral-800 rounded-xl shadow-xl border border-neutral-200 dark:border-neutral-700 overflow-hidden z-50 animate-in slide-in-from-top-2 fade-in duration-100"
          role="listbox"
          aria-label={t('settings.language')}
        >
          <div className="px-3 py-2 border-b border-neutral-100 dark:border-neutral-700">
            <p className="text-xs font-semibold text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] uppercase tracking-wider flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5" />
              {t('settings.language')}
            </p>
          </div>

          {SUPPORTED_LANGUAGES.map((lang: { code: string; name: string; flag: string; nativeName: string }) => (
            <button
              key={lang.code}
              onClick={() => handleLanguageChange(lang.code)}
              role="option"
              aria-selected={i18n.language === lang.code}
              className={`w-full flex items-center justify-between px-3 py-2.5 text-sm transition-colors ${
                i18n.language === lang.code
                  ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-600'
                  : 'hover:bg-slate-50 dark:hover:bg-neutral-700/50 text-neutral-700 dark:text-neutral-300'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-lg">{lang.flag}</span>
                <div className="text-left">
                  <div className="font-medium">{lang.name}</div>
                  {showNativeName && <div className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">{lang.nativeName}</div>}
                </div>
              </div>

              {i18n.language === lang.code && <Check className="w-4 h-4 text-primary-500" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export { LanguageSwitcher };
export default LanguageSwitcher;
