// 浏览器环境 Polyfills - 必须在所有其他导入之前
import { logger } from '@/utils/safeLogger'
import './polyfills'

// 性能监控初始化 - 在应用启动时立即启动
import { initWebVitals, webVitalsMonitor } from './utils/webVitals'
initWebVitals()

// 🔒 P3-4: 增强版前端性能监控（Web Vitals + 自定义指标 + 批量上报
import { initPerformanceMonitoring } from './utils/performance'
initPerformanceMonitoring({
  enabled: true,
  endpoint: '/api/v1/metrics/client-perf',
  sampleRate: process.env.NODE_ENV === 'production' ? 0.3 : 1.0,
  batchSize: 10,
  batchInterval: 5000,
  debug: process.env.NODE_ENV === 'development',
})

// 开发环境下自动输出性能报告

// 开发环境下自动输出性能报告
if (process.env.NODE_ENV === 'development') {
  setTimeout(() => {
    webVitalsMonitor.logReport()
  }, 3000)
}

// i18n 国际化配置 - 必须在App导入之前
import './i18n'

// NLP配置外部化初始化 - 在应用启动时预加载关键配置
import { initializeNLPConfigs } from './config/nlp'

// 异步初始化NLP配置（不阻塞应用启动）
initializeNLPConfigs({
  preLoad: [true, true], // 预加载文本规范化和功能宣称模式配置
}).then(() => {
  logger.log('[Main] ✅ NLP配置初始化完成')
}).catch((error) => {
  logger.warn('[Main] ⚠️ NLP配置初始化失败，将使用降级模式:', error)
})

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'
import './styles/theme.css'
import './styles/wcag-component-styles.css'

// 新的专业级主题系统会自动在 ThemeProvider 中初始化
// 包括：系统偏好检测、持久化配置加载、主题应用等
// 无需在此处手动处理主题逻辑

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
