// ========== 应用配置系统 ==========
// 所有硬编码的配置项、样式值、文本内容都迁移到这里

import { CHART_TYPOGRAPHY } from '../utils/typography'
import { envConfig } from './env'

// ========== 品牌配置 ==========
export const BRAND_CONFIG = {
  name: 'RMFOOD',
  fullName: 'RMFOOD 配方设计平台',
  version: '1.0',
  description: '集成中医药知识图谱与生物活性肽数据库，为配方研发提供智能化辅助',
  slogan: '药食同源功能性食品，专业配方研发平台',
  logo: {
    icon: 'Beaker', // lucide-react icon name
    size: {
      small: 24,
      medium: 28,
      large: 32,
    },
  },
  copyright: `Copyright © ${new Date().getFullYear()} 莱茵（厦门）分子生物科技有限公司 所有权利保留`,
};

// ========== 登录页面配置 (v2.0 重设计) ==========
export const LOGIN_PAGE_CONFIG = {
  // 品牌故事 — 三段式叙述
  brandStory: {
    tagline: '药食同源 · 科学配方',
    headline: '让每一份配方\n都有科学依据',
    description: '集成传统中医药智慧与现代人工智能，为食品研发团队提供从原料筛选到配方优化的全链路数据化支撑',
    pillars: [
      {
        icon: 'Leaf',
        title: '传承',
        subtitle: '130+ 药食同源目录',
        description: '系统收录药食同源原料，构建完整中医药知识图谱',
      },
      {
        icon: 'Cpu',
        title: '科学',
        subtitle: 'AI 驱动的配方引擎',
        description: '神经网络模型 + 多目标优化，智能生成安全合规配方',
      },
      {
        icon: 'Shield',
        title: '创新',
        subtitle: '生物活性肽数据库',
        description: '食源性活性肽结构分析与分子设计，引领功能性食品创新',
      },
    ],
  },
  // 特性展示（保持向后兼容）
  features: [
    {
      icon: 'Leaf',
      title: '药食同源',
      description: '集成 130+ 药食同源目录',
    },
    {
      icon: 'Shield',
      title: '安全合规',
      description: '配伍禁忌与安全检查',
    },
    {
      icon: 'Cpu',
      title: 'AI 辅助',
      description: '智能配方生成与协同分析',
    },
  ],
  // 文案
  messages: {
    welcome: '欢迎回来',
    prompt: '请登录您的账户继续',
    usernameLabel: '用户名',
    passwordLabel: '密码',
    usernamePlaceholder: '请输入用户名',
    passwordPlaceholder: '请输入密码',
    loginButton: '登 录',
    loggingIn: '正在登录...',
    loginSuccess: '登录成功，正在跳转...',
    errorMessage: '用户名或密码错误',
    rateLimitError: '登录尝试次数过多，请稍后再试',
    networkError: '登录失败，请检查网络连接',
    defaultAdmin: '默认管理员账号',
    rememberMe: '记住我',
    forgotPassword: '忘记密码？',
    orContinueWith: '或使用以下方式登录',
    securityNote: '安全连接 · 数据加密传输',
    privacyPolicy: '隐私政策',
    termsOfService: '服务条款',
  },
  // 社交登录
  socialLogin: {
    wechat: { enabled: true, label: '微信', color: '#07C160' },
    qq: { enabled: true, label: 'QQ', color: '#12B7F5' },
    github: { enabled: true, label: 'GitHub', color: '#24292e' },
  },
  // 密码强度等级
  passwordStrength: {
    levels: ['非常弱', '弱', '中等', '强', '非常强'] as string[],
    colors: ['#ef4444', '#f97316', '#eab308', '#22c55e', '#059669'] as string[],
  },
  // 凭证 — 🔒 P0 安全修复: 移除默认凭据硬编码
  // 生产环境不显示默认凭据，仅开发环境可选启用
  credentials: {
    defaultUsername: import.meta.env?.DEV ? 'admin' : undefined,
    defaultPassword: import.meta.env?.DEV ? undefined : undefined, // 开发环境不填充密码
  },
  // 颜色令牌
  colors: {
    brand: {
      primary: '#059669',
      secondary: '#2563EB',
      accent: '#7C3AED',
    },
    loginForm: {
      background: '#f8fafc',
      cardBackground: '#ffffff',
    },
  },
  styling: {
    maxWidth: 'max-w-md',
    cardPadding: 'p-8 sm:p-10',
  },
};

// ========== 仪表盘页面配置 ==========
export const DASHBOARD_PAGE_CONFIG = {
  greeting: {
    title: '欢迎回来',
    subtitle: '开始您今天的配方研发工作',
  },
  aiStatus: {
    label: 'AI 就绪',
    icon: 'Sparkles',
  },
  export: {
    label: '导出数据',
    icon: 'Download',
    filenamePrefix: '仪表盘数据',
  },
  statsCards: [
    {
      label: '配方总数',
      icon: 'FlaskConical',
      variant: 'primary',
      key: 'formulas.total',
    },
    {
      label: '实验总数',
      icon: 'TestTubes',
      variant: 'secondary',
      key: 'experiments.total',
    },
    {
      label: '进行中实验',
      icon: 'TrendingUp',
      variant: 'info',
      key: 'experiments.by_status.in_progress',
    },
    {
      label: '已完成实验',
      icon: 'CheckCircle2',
      variant: 'success',
      key: 'experiments.by_status.completed',
    },
  ],
  charts: {
    trends: {
      title: '研发趋势',
      icon: 'BarChart3',
      height: 280,
    },
    pie: {
      title: '配方状态分布',
      height: 280,
    },
    bar: {
      title: '实验状态统计',
      height: 280,
    },
  },
  quickActions: [
    {
      title: '新建配方',
      description: '药食同源配方',
      icon: 'Plus',
      to: '/formulas/new',
      color: 'from-primary-500 to-primary-600',
    },
    {
      title: '实验管理',
      description: '查看所有实验',
      icon: 'TestTubes',
      to: '/experiments',
      color: 'from-violet-500 to-purple-600',
    },
    {
      title: '待审核配方',
      description: '审核配方方案',
      icon: 'Clock',
      to: '/formulas?status=pending_review',
      color: 'from-amber-500 to-orange-500',
    },
    {
      title: 'AI 智能助手',
      description: '配方生成/分析',
      icon: 'Brain',
      to: '/ai',
      color: 'from-primary-500 to-teal-600',
    },
    {
      title: '数据库检索',
      description: 'TCMSP / DFBP',
      icon: 'Database',
      to: '/databases',
      color: 'from-sky-500 to-blue-600',
    },
  ],
  recentItems: {
    formulas: {
      title: '最近配方',
      viewAllLink: '/formulas',
      viewAllText: '查看全部',
      emptyMessage: '暂无配方数据',
    },
    experiments: {
      title: '最近实验',
      viewAllLink: '/experiments',
      viewAllText: '查看全部',
      emptyMessage: '暂无实验数据',
    },
    todos: {
      title: '待办事项',
      icon: 'ClipboardList',
      emptyMessage: '暂无待办事项',
      maxItems: 6,
    },
    reviewQueue: {
      title: '待审核配方',
      icon: 'AlertTriangle',
      emptyMessage: '暂无待审核配方',
      maxItems: 6,
    },
    timeline: {
      title: '最近动态',
      icon: 'Activity',
      emptyMessage: '暂无动态',
      maxItems: 8,
    },
  },
  periodOptions: [
    { key: '7d' as const, label: '7天' },
    { key: '30d' as const, label: '30天' },
    { key: '90d' as const, label: '90天' },
  ],
};

// 简化的仪表盘配置，用于 DashboardPage.tsx
export const DASHBOARD_CONFIG = {
  periodOptions: DASHBOARD_PAGE_CONFIG.periodOptions,
  statCardLabels: {
    formulas: '配方总数',
    experiments: '实验总数',
    inProgressExperiments: '进行中实验',
    completedExperiments: '已完成实验',
  },
  chartLabels: {
    newFormulas: '新增配方',
    newExperiments: '新增实验',
    approvedFormulas: '批准配方',
  },
  messages: {
    welcomeBack: '欢迎回来',
    startWork: '开始您今天的配方研发工作',
    aiReady: 'AI 就绪',
    exportData: '导出数据',
  },
};

// ========== 状态配置 ==========
export const STATUS_CONFIG = {
  colors: {
    draft: 'var(--color-neutral-500, #475569)',
    pending_review: 'var(--color-warning, #D97706)',
    approved: 'var(--color-success, #059669)',
    rejected: 'var(--color-danger-600, #DC2626)',
    archived: 'var(--color-neutral-600, #475569)',
    planned: 'var(--color-info, #0284C7)',
    in_progress: 'var(--color-purple-600, #7C3AED)',
    completed: 'var(--color-success, #059669)',
    failed: 'var(--color-danger-600, #DC2626)',
    cancelled: 'var(--color-neutral-600, #475569)',
  },
  labels: {
    draft: '草稿',
    pending_review: '待审核',
    approved: '已通过',
    rejected: '已驳回',
    archived: '已归档',
    planned: '计划中',
    in_progress: '进行中',
    completed: '已完成',
    failed: '已失败',
    cancelled: '已取消',
  },
};

// ========== 布局配置 ==========
export const LAYOUT_CONFIG = {
  dashboard: {
    containerMaxWidth: 'max-w-7xl',
    containerPadding: 'px-4 sm:px-6 lg:px-8',
    sectionSpacing: 'space-y-4',
  },
  cards: {
    defaultHeight: 'h-56',
    defaultPadding: 'px-6 py-4',
  },
};

// ========== 工具配置 ==========
export const UTILS_CONFIG = {
  export: {
    csvColumns: ['类别', '名称', '数值'],
    bom: '\uFEFF',
    mimeType: 'text/csv;charset=utf-8',
  },
};

// ========== 图表配置 ==========
export const CHART_CONFIG = {
  tooltip: {
    contentStyle: {
      backgroundColor: 'rgba(255,255,255,0.98)',
      backdropFilter: 'blur(16px)',
      borderRadius: '14px',
      border: '1px solid rgba(226,232,240,0.9)',
      boxShadow: '0 12px 40px rgba(0,0,0,0.12)',
      padding: '14px 18px',
      fontSize: CHART_TYPOGRAPHY.tooltipContent.fontSize + 'px',
    },
    itemStyle: { padding: '4px 0' },
    labelStyle: {
      fontWeight: CHART_TYPOGRAPHY.tooltipTitle.fontWeight,
      marginBottom: 6,
      color: 'var(--color-text-primary, #1e293b)',
    },
  },
  pie: {
    innerRadius: 50,
    outerRadius: 80,
    paddingAngle: 3,
  },
  bar: {
    barSize: 28,
    borderRadius: [0, 6, 6, 0],
  },
};

// ========== 主题配置扩展 ==========
export const THEME_CONFIG = {
  loginPage: {
    brandGradient: 'from-primary-700 via-primary-800 to-primary-950',
    moleculeOpacity: 'opacity-[0.07]',
    cardSpacing: 'space-y-5',
    errorPadding: 'p-3',
  },
  dashboard: {
    welcomeBanner: {
      gradient: 'from-primary-600 via-primary-700 to-primary-800',
      borderRadius: 'rounded-3xl',
      padding: 'p-8',
    },
  },
};

// ========== 莱茵分子 (Rhine Molecular) 品牌配置 ==========
export const RHINE_BRAND_CONFIG = {
  name: '莱茵分子',
  nameEn: 'Rhine Molecular',
  fullName: '莱茵（厦门）分子生物科技有限公司',
  tagline: '解码生命分子 · 赋能科学创新',
  description: '融合分子生物学、人工智能与功能性食品科学，构建从基因到配方的全链路研发平台',
  copyright: `© ${new Date().getFullYear()} 莱茵（厦门）分子生物科技有限公司 所有权利保留`,
  pillars: [
    {
      icon: 'Dna',
      title: '基因组学',
      subtitle: 'Genomics',
      description: '高通量测序与生物信息学分析，解码功能性成分的分子机制',
    },
    {
      icon: 'BoxSelect',
      title: '蛋白质组学',
      subtitle: 'Proteomics',
      description: '活性肽结构预测与分子动力学模拟，精准设计功能性配方',
    },
    {
      icon: 'BrainCircuit',
      title: '人工智能',
      subtitle: 'AI-Powered',
      description: '深度学习驱动的分子生成与多目标优化，加速科学发现',
    },
  ],
};

export const RHINE_LOGIN_CONFIG = {
  messages: {
    welcome: '欢迎回来',
    prompt: '登录您的莱茵分子账户',
    usernameLabel: '用户名',
    passwordLabel: '密码',
    usernamePlaceholder: '请输入用户名',
    passwordPlaceholder: '请输入密码',
    loginButton: '进入平台',
    loggingIn: '验证中...',
    loginSuccess: '身份验证通过，正在进入...',
    errorAuth: '用户名或密码错误',
    errorRateLimit: '验证请求过于频繁，请稍后再试',
    errorNetwork: '网络连接异常，请检查网络',
    rememberMe: '保持登录',
    forgotPassword: '忘记密码？',
    orContinueWith: '或使用以下方式登录',
    securityNote: '安全加密传输 · 数据隔离保护',
    privacyPolicy: '隐私政策',
    termsOfService: '服务条款',
    defaultAdmin: '默认管理员',
  },
  socialLogin: {
    wechat: { enabled: true, label: '微信登录', color: '#07C160', oauthUrl: 'https://open.weixin.qq.com/connect/qrconnect' },
    qq: { enabled: true, label: 'QQ登录', color: '#12B7F5', oauthUrl: 'https://graph.qq.com/oauth2.0/authorize' },
    github: { enabled: true, label: 'GitHub', color: '#f0f6fc', oauthUrl: 'https://github.com/login/oauth/authorize' },
  },
  passwordStrength: {
    levels: ['非常弱', '弱', '中等', '强', '非常强'] as string[],
    // 使用项目功能色: error #dc2626 → warning #ca8a04 → success #16a34a → primary #059669
    colors: ['#dc2626', '#ca8a04', '#ca8a04', '#16a34a', '#059669'] as string[],
  },
  credentials: {
    defaultUsername: import.meta.env?.DEV ? 'admin' : undefined,
    defaultPassword: import.meta.env?.DEV ? undefined : undefined,
  },
};

export default {
  BRAND_CONFIG,
  LOGIN_PAGE_CONFIG,
  RHINE_BRAND_CONFIG,
  RHINE_LOGIN_CONFIG,
  DASHBOARD_PAGE_CONFIG,
  DASHBOARD_CONFIG,
  STATUS_CONFIG,
  LAYOUT_CONFIG,
  UTILS_CONFIG,
  CHART_CONFIG,
  THEME_CONFIG,
};
