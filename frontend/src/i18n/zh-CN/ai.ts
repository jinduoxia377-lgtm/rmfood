export default {
  // ===== AI 对话模块 =====
  chat: {
    title: 'AI 智能助手',
    placeholder: '输入您的问题...',
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

    // ChatTab 组件
    chatTab: {
      title: '智能对话',
      offlineMode: '离线模式',
      clear: '清空',
      chatError: '对话出错',
      retry: '重试',
      close: '关闭',
      resume: '继续生成',
      pause: '暂停生成',
      welcomeTitle: '欢迎使用智能配方助手',
      welcomeSubtitle: '选择下方问题快速开始，或直接输入您的配方需求',
      placeholder: '描述您的配方需求，例如：设计一款低糖饮料的甜味剂方案...',
      offlineBannerTitle: '规则兜底模式',
      offlineBannerDesc: '未检测到大模型 API Key，当前回答基于内置规则引擎。前往「配置管理」标签页配置 API Key 后可启用完整 AI 能力。',
      startNewChat: '开始新对话',
      chatDescription: '输入您的问题或需求，AI 将为您提供专业的配方建议和分析。',
      ragNotSeededTitle: '知识库尚未初始化',
      ragNotSeededDesc: '知识库检索已开启，但向量库暂无数据，RAG 检索将不会返回结果。点击下方按钮注入内置知识后即可生效。',
      ragSeedNow: '初始化知识库',
      ragSeeding: '初始化中...',
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

    // GenerateTab 组件
    generateTab: {
      loading: '加载中...',
      formulaDetails: '配方详情',
      close: '关闭',
      allCategories: '全部分类',
      score: '评分',
      synergy: '协同',
      export: '导出',
      json: 'JSON',
      csv: 'CSV',
      pdf: 'PDF',
      pdfDeveloping: 'PDF (开发中)',
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

    // SynergyTab 组件
    synergyTab: {
      title: '协同作用分析',
      inputDescription: '输入药材名称，用逗号分隔。分析成分间协同/拮抗关系。',
      inputPlaceholder: '如: 黄芪, 党参, 枸杞子, 山药',
      analyze: '分析',
      analyzeFailed: '分析失败：',
      retryTip: '请检查输入后重试',
      synergyScore: '协同评分: ',
      antagonismWarning: '拮抗预警',
      relationshipMatrix: '关系矩阵',
      synergy: '协同',
      antagonism: '拮抗',
      noData: '无数据',
      sharedPathways: '共有通路: ',
    },
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
}
