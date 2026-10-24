/**
 * AI 功能模块 i18n 配置 - 支持语言列表与全局 i18n 实例引用
 *
 * 说明（2026-10 收敛）：
 * - 全局 i18n 实例统一由 src/i18n.ts 初始化（语言包位于 src/i18n/{zh-CN,en-US,de-DE}/）。
 * - 本模块不再维护第二套扁平语言包，也不注册 languageChanged 监听，
 *   避免与全局资源重复、防止语言切换持久化逻辑分叉。
 * - 仅保留 AI 模块所需的支持语言列表（供 LanguageSwitcher / languageService 使用）。
 *
 * @version 2.0.0
 */

import i18n from 'i18next'

// ===== 语言包类型定义 =====

export interface LanguageConfig {
  code: string
  name: string
  nativeName: string
  flag: string
  dir: 'ltr' | 'rtl'
  dateFormat: string
}

// ===== 支持的语言列表（与全局 i18n supportedLngs 保持一致） =====

export const SUPPORTED_LANGUAGES: LanguageConfig[] = [
  {
    code: 'zh-CN',
    name: 'Chinese (Simplified)',
    nativeName: '简体中文',
    flag: '🇨🇳',
    dir: 'ltr',
    dateFormat: 'YYYY年MM月DD日',
  },
  {
    code: 'en-US',
    name: 'English (US)',
    nativeName: 'English',
    flag: '🇺🇸',
    dir: 'ltr',
    dateFormat: 'MM/DD/YYYY',
  },
  {
    code: 'de-DE',
    name: 'German',
    nativeName: 'Deutsch',
    flag: '🇩🇪',
    dir: 'ltr',
    dateFormat: 'DD.MM.YYYY',
  },
]

// ===== 默认语言 =====

export const DEFAULT_LANGUAGE = 'zh-CN'

export default i18n