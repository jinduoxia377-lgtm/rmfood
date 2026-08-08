/**
 * i18n 配置 - 国际化基础设施 (v1.0)
 *
 * 集成 react-i18next 实现中英文双语支持。
 *
 * 功能特性：
 * - 语言切换功能
 * - 语言包懒加载
 * - 命名空间隔离
 * - 日期/数字格式化
 * - RTL 布局预留
 * - 持久化语言偏好
 *
 * @version 1.0.0
 * @lastUpdated 2026-05-12
 */

import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { logger } from '@/utils/safeLogger'

// ===== 语言包类型定义 =====

export interface LanguageConfig {
  code: string
  name: string
  nativeName: string
  flag: string
  dir: 'ltr' | 'rtl'
  dateFormat: string
}

// ===== 支持的语言列表 =====

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
]

// ===== 默认语言 =====

const DEFAULT_LANGUAGE = 'zh-CN'

// ===== 中文语言包 =====

const zhCN = {
  translation: {
    // ===== 通用 =====
    common: {
      loading: '加载中...',
      error: '出错了',
      retry: '重试',
      cancel: '取消',
      confirm: '确认',
      save: '保存',
      delete: '删除',
      edit: '编辑',
      close: '关闭',
      search: '搜索',
      noData: '暂无数据',
      refresh: '刷新',
      more: '更多',
      back: '返回',
      next: '下一步',
      previous: '上一步',
      submit: '提交',
      success: '操作成功',
      failed: '操作失败',
      warning: '警告',
      info: '提示',
    },

    // ===== 导航 =====
    nav: {
      home: '首页',
      aiChat: '智能对话',
      formulaGen: '配方生成',
      safetyCheck: '安全检查',
      synergyAnalysis: '协同分析',
      tastePredict: '口感预测',
      stabilityPredict: '稳定性预测',
      academicReport: '学术报告',
      settings: '设置',
    },

    // ===== AI 对话模块 =====
    chat: {
      title: 'AI 智能助手',
      placeholder: '描述您的配方需求，例如：设计一款低糖饮料的甜味剂方案...',
      send: '发送',
      stopGenerating: '停止生成',
      newSession: '新会话',
      sessionHistory: '历史记录',
      exportChat: '导出对话',
      clearChat: '清空对话',

      // 斜杠命令
      commands: {
        help: {
          desc: '显示帮助信息',
          usage: '/help',
        },
        clear: {
          desc: '清空当前对话',
          usage: '/clear',
        },
        export: {
          desc: '导出对话记录',
          usage: '/export',
        },
        new: {
          desc: '创建新会话',
          usage: '/new',
        },
        settings: {
          desc: '打开设置面板',
          usage: '/settings',
        },
      },

      // API Key 配置
      apiKey: {
        title: 'API Key 配置',
        addProvider: '添加提供商',
        testConnection: '测试连接',
        connectionSuccess: '连接成功',
        connectionFailed: '连接失败',
        usageStats: '用量统计',
        monthlyCalls: '本月调用次数',
        remainingQuota: '剩余配额',
        encryptedStorage: '密钥已加密存储',
      },

      // 流式输出
      streaming: {
        typingSpeed: '打字速度',
        slow: '慢速',
        medium: '中等',
        fast: '快速',
        instant: '即时',
        interrupt: '中断输出',
        resume: '继续输出',
      },

      // ChatTab 对话面板 (v11.0)
      chatTab: {
        title: '智能对话',
        clear: '清空',
        chatError: '对话出错',
        retry: '重试',
        close: '关闭',
        resume: '继续生成',
        pause: '暂停生成',
        placeholder: '描述您的配方需求，例如：设计一款低糖饮料的甜味剂方案...',
      },
    },

    // ===== 配方生成模块 =====
    formula: {
      title: '智能配方生成',
      wizard: {
        step1: '目标功效',
        step2: '约束条件',
        step3: '高级选项',
        next: '下一步',
        prev: '上一步',
        complete: '完成配置',
        startGeneration: '开始生成',
      },
      progress: {
        preparing: '准备中...',
        generating: '候选方案生成中...',
        scoring: '评分计算中...',
        optimizing: '优化调整中...',
        sorting: '排序整理中...',
        finalizing: '最终处理...',
        completed: '生成完成',
        failed: '生成失败',
        cancelled: '已取消',
        paused: '已暂停',
        estimatedTime: '预计剩余时间',
        viewLog: '查看日志',
        pause: '暂停',
        resume: '恢复',
        cancel: '取消',
      },
      result: {
        candidateComparison: '候选方案对比',
        sensitivityAnalysis: '敏感性分析',
        whatIf: 'What-if 分析',
        exportResult: '导出结果',
        paretoFrontier: 'Pareto 最优前沿',
      },
    },

    // ===== 安全检查模块 =====
    safety: {
      title: '安全性评估',
      riskLevels: {
        low: '低风险',
        medium: '中等风险',
        high: '高风险',
      },
      batchCheck: {
        title: '批量检测',
        uploadFile: '上传文件',
        supportedFormats: '支持 CSV、Excel 格式',
        taskQueue: '任务队列',
        completed: '已完成',
        processing: '处理中',
        queued: '排队中',
        failed: '失败',
        reviewRequired: '待复核',
      },
      regulation: {
        browser: '法规浏览器',
        filterByRegion: '按地区筛选',
        filterByType: '按类型筛选',
        complianceStatus: '合规状态',
        passed: '已通过',
        pending: '待审核',
        nonCompliant: '不合规',
        updateAvailable: '有更新',
      },
      report: {
        generateReport: '生成报告',
        fdaTemplate: 'FDA 格式',
        nmpaTemplate: 'NMPA 格式',
        efsaTemplate: 'EFSA 格式',
        preview: '预览',
        downloadPDF: '下载 PDF',
      },
    },

    // ===== 协同分析模块 =====
    synergy: {
      title: '协同作用分析',
      knowledgeGraph: '知识图谱',
      recommendationPanel: '推荐参数调节',
      radarChart: '雷达图对比',
      selectAlgorithm: '选择算法',
      adjustWeights: '调整权重',
      aiRecommendation: 'AI 推荐',
      confidence: '置信度',
      savePreset: '保存预设',
      loadPreset: '加载预设',
      reset: '重置',
    },

    // ===== 口感预测模块 =====
    taste: {
      title: '口感预测',
      flavorWheel: '风味轮盘',
      preferenceLearning: '偏好学习',
      dimensions: {
        sour: '酸度',
        sweet: '甜度',
        bitter: '苦味',
        spicy: '辣度',
        umami: '鲜味',
        astringent: '涩感',
      },
      rating: {
        veryLow: '极低偏好',
        low: '较低偏好',
        medium: '中等偏好',
        high: '较高偏好',
        veryHigh: '极高偏好',
      },
      recommendations: '为您推荐的产品',
      matchRate: '匹配度',
      exportPreference: '导出偏好数据',
      resetRating: '重置评分',
      savePreference: '保存偏好',
    },

    // ===== 稳定性预测模块 =====
    stability: {
      title: '稳定性预测',
      timeSeries: '时间序列分析',
      sensitivityTornado: '敏感性分析',
      inflectionPoints: '关键拐点',
      confidenceInterval: '置信区间',
      optimalRegion: '最优区域',
      exportChart: '导出图表',
      sensitivityRanking: '敏感性排名摘要',
      peak: '峰值',
      valley: '谷值',
      inflection: '拐点',
    },

    // ===== 学术报告模块 =====
    report: {
      title: '学术报告生成',
      templateEngine: '模板引擎',
      versionHistory: '版本历史',
      templateMarket: '模板市场',
      academicReport: '学术报告模板',
      safetyReport: '安全评估报告模板',
      customTemplate: '自定义模板',
      createBranch: '创建分支',
      compareMode: '比较模式',
      diffView: 'Diff 视图',
      unifiedDiff: 'Unified Diff',
      splitView: 'Split View',
      rollbackVersion: '回滚到此版本',
      noVersions: '暂无版本记录',
    },

    // ===== 设置页面 =====
    settings: {
      title: '设置',
      general: '通用',
      appearance: '外观',
      language: '语言',
      theme: '主题',
      darkMode: '深色模式',
      lightMode: '浅色模式',
      systemDefault: '跟随系统',
      about: '关于',
      version: '版本号',
    },

    // ===== a11y =====
    a11y: {
      skipToContent: '跳转到主要内容',
      openMenu: '打开菜单',
      closeMenu: '关闭菜单',
      openSearch: '打开搜索',
      keyboardShortcuts: '快捷键列表',
      pressQuestionMark: '按 ? 显示快捷键',
    },
  },
}

// ===== 英文语言包 =====

const enUS = {
  translation: {
    common: {
      loading: 'Loading...',
      error: 'An error occurred',
      retry: 'Retry',
      cancel: 'Cancel',
      confirm: 'Confirm',
      save: 'Save',
      delete: 'Delete',
      edit: 'Edit',
      close: 'Close',
      search: 'Search',
      noData: 'No data available',
      refresh: 'Refresh',
      more: 'More',
      back: 'Back',
      next: 'Next',
      previous: 'Previous',
      submit: 'Submit',
      success: 'Success',
      failed: 'Failed',
      warning: 'Warning',
      info: 'Information',
    },

    nav: {
      home: 'Home',
      aiChat: 'AI Chat',
      formulaGen: 'Formula Generation',
      safetyCheck: 'Safety Check',
      synergyAnalysis: 'Synergy Analysis',
      tastePredict: 'Taste Prediction',
      stabilityPredict: 'Stability Prediction',
      academicReport: 'Academic Report',
      settings: 'Settings',
    },

    chat: {
      title: 'AI Assistant',
      placeholder: 'Describe your formula needs, e.g., Design a low-sugar beverage sweetener system...',
      send: 'Send',
      stopGenerating: 'Stop Generating',
      newSession: 'New Session',
      sessionHistory: 'History',
      exportChat: 'Export Chat',
      clearChat: 'Clear Chat',

      commands: {
        help: {
          desc: 'Show help information',
          usage: '/help',
        },
        clear: {
          desc: 'Clear current conversation',
          usage: '/clear',
        },
        export: {
          desc: 'Export conversation history',
          usage: '/export',
        },
        new: {
          desc: 'Create new session',
          usage: '/new',
        },
        settings: {
          desc: 'Open settings panel',
          usage: '/settings',
        },
      },

      apiKey: {
        title: 'API Key Configuration',
        addProvider: 'Add Provider',
        testConnection: 'Test Connection',
        connectionSuccess: 'Connection Successful',
        connectionFailed: 'Connection Failed',
        usageStats: 'Usage Statistics',
        monthlyCalls: 'Monthly Calls',
        remainingQuota: 'Remaining Quota',
        encryptedStorage: 'Key encrypted and stored securely',
      },

      streaming: {
        typingSpeed: 'Typing Speed',
        slow: 'Slow',
        medium: 'Medium',
        fast: 'Fast',
        instant: 'Instant',
        interrupt: 'Interrupt Output',
        resume: 'Resume Output',
      },

      // ChatTab dialog panel (v11.0)
      chatTab: {
        title: 'AI Chat',
        clear: 'Clear',
        chatError: 'Chat Error',
        retry: 'Retry',
        close: 'Close',
        resume: 'Resume Generation',
        pause: 'Pause Generation',
        placeholder: 'Describe your formula needs, e.g., Design a low-sugar beverage sweetener system...',
      },
    },

    formula: {
      title: 'Smart Formula Generation',
      wizard: {
        step1: 'Target Efficacy',
        step2: 'Constraints',
        step3: 'Advanced Options',
        next: 'Next',
        prev: 'Previous',
        complete: 'Complete Configuration',
        startGeneration: 'Start Generation',
      },
      progress: {
        preparing: 'Preparing...',
        generating: 'Generating candidates...',
        scoring: 'Scoring candidates...',
        optimizing: 'Optimizing...',
        sorting: 'Sorting results...',
        finalizing: 'Finalizing...',
        completed: 'Generation Complete',
        failed: 'Generation Failed',
        cancelled: 'Cancelled',
        paused: 'Paused',
        estimatedTime: 'Estimated Time Remaining',
        viewLog: 'View Log',
        pause: 'Pause',
        resume: 'Resume',
        cancel: 'Cancel',
      },
      result: {
        candidateComparison: 'Candidate Comparison',
        sensitivityAnalysis: 'Sensitivity Analysis',
        whatIf: 'What-if Analysis',
        exportResult: 'Export Results',
        paretoFrontier: 'Pareto Frontier',
      },
    },

    safety: {
      title: 'Safety Assessment',
      riskLevels: {
        low: 'Low Risk',
        medium: 'Medium Risk',
        high: 'High Risk',
      },
      batchCheck: {
        title: 'Batch Check',
        uploadFile: 'Upload File',
        supportedFormats: 'Supports CSV, Excel formats',
        taskQueue: 'Task Queue',
        completed: 'Completed',
        processing: 'Processing',
        queued: 'Queued',
        failed: 'Failed',
        reviewRequired: 'Review Required',
      },
      regulation: {
        browser: 'Regulation Browser',
        filterByRegion: 'Filter by Region',
        filterByType: 'Filter by Type',
        complianceStatus: 'Compliance Status',
        passed: 'Passed',
        pending: 'Pending Review',
        nonCompliant: 'Non-Compliant',
        updateAvailable: 'Update Available',
      },
      report: {
        generateReport: 'Generate Report',
        fdaTemplate: 'FDA Format',
        nmpaTemplate: 'NMPA Format',
        efsaTemplate: 'EFSA Format',
        preview: 'Preview',
        downloadPDF: 'Download PDF',
      },
    },

    synergy: {
      title: 'Synergy Analysis',
      knowledgeGraph: 'Knowledge Graph',
      recommendationPanel: 'Recommendation Panel',
      radarChart: 'Radar Chart Comparison',
      selectAlgorithm: 'Select Algorithm',
      adjustWeights: 'Adjust Weights',
      aiRecommendation: 'AI Recommendation',
      confidence: 'Confidence',
      savePreset: 'Save Preset',
      loadPreset: 'Load Preset',
      reset: 'Reset',
    },

    taste: {
      title: 'Taste Prediction',
      flavorWheel: 'Flavor Wheel',
      preferenceLearning: 'Preference Learning',
      dimensions: {
        sour: 'Sourness',
        sweet: 'Sweetness',
        bitter: 'Bitterness',
        spicy: 'Spiciness',
        umami: 'Umami',
        astringent: 'Astringency',
      },
      rating: {
        veryLow: 'Very Low Preference',
        low: 'Low Preference',
        medium: 'Medium Preference',
        high: 'High Preference',
        veryHigh: 'Very High Preference',
      },
      recommendations: 'Recommended for You',
      matchRate: 'Match Rate',
      exportPreference: 'Export Preferences',
      resetRating: 'Reset Ratings',
      savePreference: 'Save Preferences',
    },

    stability: {
      title: 'Stability Prediction',
      timeSeries: 'Time Series Analysis',
      sensitivityTornado: 'Sensitivity Analysis',
      inflectionPoints: 'Inflection Points',
      confidenceInterval: 'Confidence Interval',
      optimalRegion: 'Optimal Region',
      exportChart: 'Export Chart',
      sensitivityRanking: 'Sensitivity Ranking Summary',
      peak: 'Peak',
      valley: 'Valley',
      inflection: 'Inflection Point',
    },

    report: {
      title: 'Academic Report Generation',
      templateEngine: 'Template Engine',
      versionHistory: 'Version History',
      templateMarket: 'Template Marketplace',
      academicReport: 'Academic Report Template',
      safetyReport: 'Safety Assessment Report Template',
      customTemplate: 'Custom Template',
      createBranch: 'Create Branch',
      compareMode: 'Compare Mode',
      diffView: 'Diff View',
      unifiedDiff: 'Unified Diff',
      splitView: 'Split View',
      rollbackVersion: 'Rollback to This Version',
      noVersions: 'No versions available',
    },

    settings: {
      title: 'Settings',
      general: 'General',
      appearance: 'Appearance',
      language: 'Language',
      theme: 'Theme',
      darkMode: 'Dark Mode',
      lightMode: 'Light Mode',
      systemDefault: 'System Default',
      about: 'About',
      version: 'Version',
    },

    a11y: {
      skipToContent: 'Skip to main content',
      openMenu: 'Open menu',
      closeMenu: 'Close menu',
      openSearch: 'Open search',
      keyboardShortcuts: 'Keyboard shortcuts',
      pressQuestionMark: 'Press ? for shortcuts',
    },
  },
}

// ===== 初始化 i18n =====

// 全局 i18n 实例已在 src/i18n/index.ts 完成初始化（含 ai.* 命名空间）。
// 若在此处再次调用 init() 会覆盖全局 resources，导致 ai.chat.chatTab.* 等键丢失。
// 因此：未初始化时才 init 兜底；已初始化时以非覆盖方式合并本模块的扁平键，
// 保留全局的 ai.* 命名空间。
if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    resources: {
      'zh-CN': zhCN,
      'en-US': enUS,
    },
    lng: localStorage.getItem('rmfood-language') || DEFAULT_LANGUAGE,
    fallbackLng: DEFAULT_LANGUAGE,
    interpolation: {
      escapeValue: false,
    },
    react: {
      useSuspense: false,
    },
  })
} else {
  i18n.addResourceBundle('zh-CN', 'translation', zhCN.translation, true, false)
  i18n.addResourceBundle('en-US', 'translation', enUS.translation, true, false)
}

// 监听语言变更并持久化
i18n.on('languageChanged', (lng) => {
  localStorage.setItem('rmfood-language', lng)

  // 更新 HTML lang 属性
  document.documentElement.lang = lng

  // 更新 dir 属性（RTL 支持）
  const langConfig = SUPPORTED_LANGUAGES.find(l => l.code === lng)
  if (langConfig) {
    document.documentElement.dir = langConfig.dir
  }

  logger.info(`[i18n] Language changed to: ${lng}`)
})

export default i18n
