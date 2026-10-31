// Minimal i18n setup
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
// 使用模块化语言包（zh-CN/index.ts 等），确保 AI 模块翻译（formula/synergy/taste/stability/report）
// 完整合并进 translation 命名空间；不要导入同名的扁平 zh-CN.ts / en-US.ts（会遮蔽模块包）。
import zhCN from './i18n/zh-CN/index'
import enUS from './i18n/en-US/index'
import deDE from './i18n/de-DE/index'

// 从 localStorage 恢复上次选择的语言（与 features/i18n 的持久化键保持一致），
// 使 /settings 语言模块的选择在应用启动时真实生效。
const savedLanguage =
  typeof window !== 'undefined' ? localStorage.getItem('rmfood-language') : null

i18n.use(initReactI18next).init({
  lng: savedLanguage || 'zh-CN',
  fallbackLng: ['zh-CN', 'en-US'],
  supportedLngs: ['zh-CN', 'en-US', 'de-DE'],
  interpolation: { escapeValue: false },
  resources: {
    'zh-CN': zhCN,
    'en-US': enUS,
    'de-DE': deDE,
  },
})

// 初始化后立即同步 <html lang>：i18next 在 init 时针对初始 lng 触发的
// languageChanged 事件早于下方监听注册，若不显式同步一次，
// 从 localStorage 恢复的非中文语言会导致 <html lang> 与实际语言不一致。
if (typeof document !== 'undefined') {
  document.documentElement.lang = i18n.language || savedLanguage || 'zh-CN'
}

// 语言变更时持久化到 localStorage 并同步 <html lang>，保证全站切换真实生效
i18n.on('languageChanged', (lng) => {
  try {
    localStorage.setItem('rmfood-language', lng)
    document.documentElement.lang = lng
  } catch {
    /* 忽略持久化失败（隐私模式等） */
  }
})

export default i18n