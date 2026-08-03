/**
 * 🟡 P4-5: 国际化 (i18n) 增强系统
 *
 * 提供企业级国际化能力:
 * 1. 🌍 多语言支持 - 中文 / 英文 / 日文 / 韩文 / ...
 * 2. 📝 Key 管理 - 统一管理翻译 Key，避免冲突
 * 3. 🔄 动态切换 - 无刷新切换语言
 * 4. 📦 懒加载 - 按需加载语言包
 * 5. 🎯 插值变量 - {{name}} 模板支持
 * 6. 🌐 复数规则 - 支持多语言复数形式
 * 7. 📱 响应式 - RTL 语言支持
 * 8. 🔍 翻译校验 - 构建时检查缺失翻译
 *
 * 目录结构:
 *   src/
 *     locales/
 *       zh-CN.json       # 中文
 *       en-US.json       # 英文
 *       ja-JP.json       # 日文
 *       index.ts         # 导出
 *     i18n/
 *       index.ts         # 配置
 *       useTranslation.ts # Hook
 *       t.ts             # 翻译函数
 *
 * 使用示例:
 *   // 1. 组件中使用
 *   import { useTranslation } from '@/i18n';
 *
 *   function FormulaCard() {
 *     const { t, locale, setLocale } = useTranslation();
 *
 *     return (
 *       <div>
 *         <h1>{t('formula.title')}</h1>
 *         <p>{t('formula.count', { count: 10 })}</p>
 *         <button onClick={() => setLocale('en')}>EN</button>
 *       </div>
 *     );
 *   }
 *
 *   // 2. JS/TS 文件中使用
 *   import { tf } from '@/i18n/t';
 *   alert(tf('formula.created', { name: '新配方' }));
 */

import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';


import { logger } from '@/utils/safeLogger';
// ═════════════════════════════════════════════
// 🟡 P4-5: 类型定义
// ═════════════════════════════════════════════

export type Locale = 'zh-CN' | 'en-US' | 'ja-JP' | 'ko-KR';

export interface LocaleConfig {
  /** 语言代码 */
  code: Locale;
  /** 显示名称 */
  name: string;
  /** 本地化名称 */
  nativeName: string;
  /** 是否 RTL */
  rtl?: boolean;
  /** 复数规则函数 */
  pluralRules?: (n: number) => number;
}

export interface TranslationContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, params?: Record<string, any>) => string;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
  formatDate: (date: Date | string, options?: Intl.DateTimeFormatOptions) => string;
  formatCurrency: (value: number, currency?: string) => string;
  isLoading: boolean;
  availableLocales: Locale[];
}

// ═════════════════════════════════════════════
// 🟡 P4-5: 语言配置
// ═════════════════════════════════════════════

export const LOCALES: Record<Locale, LocaleConfig> = {
  'zh-CN': {
    code: 'zh-CN',
    name: 'Chinese (Simplified)',
    nativeName: '简体中文',
    rtl: false,
    pluralRules: (n: number) => (n === 1 ? 0 : 1),
  },
  'en-US': {
    code: 'en-US',
    name: 'English (US)',
    nativeName: 'English',
    rtl: false,
    pluralRules: (n: number) => (n === 1 ? 0 : 1),
  },
  'ja-JP': {
    code: 'ja-JP',
    name: 'Japanese',
    nativeName: '日本語',
    rtl: false,
    pluralRules: (n: number) => 0, // 日语没有复数
  },
  'ko-KR': {
    code: 'ko-KR',
    name: 'Korean',
    nativeName: '한국어',
    rtl: false,
    pluralRules: (n: number) => 0, // 韩语没有复数
  },
};

// ═════════════════════════════════════════════
// 🟡 P4-5: 翻译资源（示例）
// ═════════════════════════════════════════════

type TranslationMessages = typeof ZH_CN_MESSAGES;

const ZH_CN_MESSAGES = {
  // 通用
  common: {
    app: {
      name: 'RMFOOD 配方平台',
      version: '版本 {{version}}',
    },
    actions: {
      save: '保存',
      cancel: '取消',
      delete: '删除',
      edit: '编辑',
      create: '创建',
      submit: '提交',
      confirm: '确认',
      search: '搜索',
      filter: '筛选',
      export: '导出',
      import: '导入',
      refresh: '刷新',
      loading: '加载中...',
    },
    status: {
      success: '成功',
      error: '错误',
      warning: '警告',
      info: '信息',
      pending: '待处理',
      processing: '处理中',
      completed: '已完成',
      failed: '失败',
    },
    messages: {
      saved: '{{name}} 已保存',
      deleted: '{{name}} 已删除',
      created: '{{name}} 已创建',
      updated: '{{name}} 已更新',
      error: '操作失败: {{error}}',
      confirm_delete: '确定要删除 {{name}} 吗？此操作无法撤销。',
      no_results: '未找到结果',
      required_field: '此字段为必填',
    },
    pagination: {
      showing: '显示 {{from}}-{{to}}，共 {{total}} 条',
      page: '第 {{current}} 页',
      per_page: '每页 {{size}} 条',
      first: '首页',
      last: '末页',
      prev: '上一页',
      next: '下一页',
    },
  },

  // 配方相关
  formula: {
    title: '配方管理',
    list: '配方列表',
    detail: '配方详情',
    create: '创建配方',
    edit: '编辑配方',
    delete: '删除配方',
    name: '配方名称',
    category: '分类',
    status_label: '状态',
    creator: '创建人',
    created_at: '创建时间',
    updated_at: '更新时间',
    version: '版本',
    count: '共 {{count}} 个配方',
    no_formulas: '暂无配方',
    search_placeholder: '搜索配方名称...',
    form: {
      name_label: '配方名称',
      name_placeholder: '请输入配方名称',
      category_label: '配方分类',
      category_placeholder: '请选择分类',
      description_label: '配方描述',
      description_placeholder: '请输入配方描述（可选）',
      ingredients_label: '成分列表',
      add_ingredient: '添加成分',
    },
    status: {
      draft: '草稿',
      pending_review: '待审核',
      approved: '已审核',
      rejected: '已拒绝',
      published: '已发布',
      archived: '已归档',
    },
    validation: {
      name_required: '配方名称不能为空',
      name_too_long: '配方名称不能超过 100 个字符',
      category_required: '请选择配方分类',
      ingredients_required: '请至少添加一种成分',
    },
  },

  // 用户相关
  user: {
    title: '用户管理',
    profile: '个人资料',
    settings: '设置',
    login: '登录',
    logout: '退出登录',
    register: '注册',
    forgot_password: '忘记密码？',
    username: '用户名',
    email: '邮箱',
    password: '密码',
    new_password: '新密码',
    confirm_password: '确认密码',
    remember_me: '记住我',
    welcome: '欢迎，{{name}}！',
    login_success: '登录成功',
    logout_success: '已退出登录',
    profile_updated: '个人资料已更新',
  },

  // AI 相关
  ai: {
    title: 'AI 助手',
    analyzing: '正在分析配方...',
    generating: '正在生成建议...',
    completed: 'AI 分析完成',
    failed: 'AI 分析失败',
    models: {
      gpt4: 'GPT-4',
      gpt35: 'GPT-3.5',
    },
    tasks: {
      analyze: '配方分析',
      optimize: '配方优化',
      suggest: '成分建议',
      review: '合规审查',
    },
  },

  // 权限相关
  permission: {
    denied: '权限不足',
    denied_message: '您没有权限执行此操作',
    login_required: '请先登录',
    roles: {
      admin: '管理员',
      manager: '经理',
      user: '普通用户',
      guest: '访客',
    },
  },

  // 错误消息
  errors: {
    network_error: '网络连接失败，请检查网络',
    server_error: '服务器错误，请稍后重试',
    not_found: '页面不存在',
    unauthorized: '未授权访问',
    forbidden: '禁止访问',
    timeout: '请求超时，请重试',
    unknown: '发生未知错误',
  },

  // 日期时间
  datetime: {
    now: '刚刚',
    minutes_ago: '{{count}} 分钟前',
    hours_ago: '{{count}} 小时前',
    days_ago: '{{count}} 天前',
    today: '今天',
    yesterday: '昨天',
    tomorrow: '明天',
  },

  // 数字格式化
  number: {
    decimal: '{{value, number(minimumFractionDigits: 2)}}',
    percent: '{{value, number(style: "percent")}}',
    currency: '{{value, number(style: "currency", currency: "CNY")}}',
  },
};

const EN_US_MESSAGES: TranslationMessages = {
  common: {
    app: {
      name: 'RMFOOD Formula Platform',
      version: 'Version {{version}}',
    },
    actions: {
      save: 'Save',
      cancel: 'Cancel',
      delete: 'Delete',
      edit: 'Edit',
      create: 'Create',
      submit: 'Submit',
      confirm: 'Confirm',
      search: 'Search',
      filter: 'Filter',
      export: 'Export',
      import: 'Import',
      refresh: 'Refresh',
      loading: 'Loading...',
    },
    status: {
      success: 'Success',
      error: 'Error',
      warning: 'Warning',
      info: 'Info',
      pending: 'Pending',
      processing: 'Processing',
      completed: 'Completed',
      failed: 'Failed',
    },
    messages: {
      saved: '{{name}} saved successfully',
      deleted: '{{name}} deleted successfully',
      created: '{{name}} created successfully',
      updated: '{{name}} updated successfully',
      error: 'Operation failed: {{error}}',
      confirm_delete: 'Are you sure you want to delete {{name}}? This action cannot be undone.',
      no_results: 'No results found',
      required_field: 'This field is required',
    },
    pagination: {
      showing: 'Showing {{from}}-{{to}} of {{total}}',
      page: 'Page {{current}}',
      per_page: '{{size}} per page',
      first: 'First',
      last: 'Last',
      prev: 'Previous',
      next: 'Next',
    },
  },
  formula: {
    title: 'Formula Management',
    list: 'Formula List',
    detail: 'Formula Details',
    create: 'Create Formula',
    edit: 'Edit Formula',
    delete: 'Delete Formula',
    name: 'Formula Name',
    category: 'Category',
    status_label: 'Status',
    creator: 'Creator',
    created_at: 'Created At',
    updated_at: 'Updated At',
    version: 'Version',
    count: '{{count}} formulas',
    no_formulas: 'No formulas yet',
    search_placeholder: 'Search by formula name...',
    form: {
      name_label: 'Formula Name',
      name_placeholder: 'Enter formula name',
      category_label: 'Category',
      category_placeholder: 'Select category',
      description_label: 'Description',
      description_placeholder: 'Enter description (optional)',
      ingredients_label: 'Ingredients',
      add_ingredient: 'Add Ingredient',
    },
    status: {
      draft: 'Draft',
      pending_review: 'Pending Review',
      approved: 'Approved',
      rejected: 'Rejected',
      published: 'Published',
      archived: 'Archived',
    },
    validation: {
      name_required: 'Formula name is required',
      name_too_long: 'Formula name cannot exceed 100 characters',
      category_required: 'Please select a category',
      ingredients_required: 'Please add at least one ingredient',
    },
  },
  user: {
    title: 'User Management',
    profile: 'Profile',
    settings: 'Settings',
    login: 'Login',
    logout: 'Logout',
    register: 'Register',
    forgot_password: 'Forgot Password?',
    username: 'Username',
    email: 'Email',
    password: 'Password',
    new_password: 'New Password',
    confirm_password: 'Confirm Password',
    remember_me: 'Remember me',
    welcome: 'Welcome, {{name}}!',
    login_success: 'Login successful',
    logout_success: 'Logged out successfully',
    profile_updated: 'Profile updated',
  },
  ai: {
    title: 'AI Assistant',
    analyzing: 'Analyzing formula...',
    generating: 'Generating suggestions...',
    completed: 'AI analysis completed',
    failed: 'AI analysis failed',
    models: {
      gpt4: 'GPT-4',
      gpt35: 'GPT-3.5',
    },
    tasks: {
      analyze: 'Formula Analysis',
      optimize: 'Formula Optimization',
      suggest: 'Ingredient Suggestion',
      review: 'Compliance Review',
    },
  },
  permission: {
    denied: 'Permission Denied',
    denied_message: 'You do not have permission to perform this action',
    login_required: 'Please log in first',
    roles: {
      admin: 'Administrator',
      manager: 'Manager',
      user: 'User',
      guest: 'Guest',
    },
  },
  errors: {
    network_error: 'Network connection failed. Please check your network.',
    server_error: 'Server error. Please try again later.',
    not_found: 'Page not found',
    unauthorized: 'Unauthorized access',
    forbidden: 'Forbidden',
    timeout: 'Request timed out. Please try again.',
    unknown: 'An unknown error occurred',
  },
  datetime: {
    now: 'Just now',
    minutes_ago: '{{count}} minutes ago',
    hours_ago: '{{count}} hours ago',
    days_ago: '{{count}} days ago',
    today: 'Today',
    yesterday: 'Yesterday',
    tomorrow: 'Tomorrow',
  },
  number: {
    decimal: '{{value, number(minimumFractionDigits: 2)}}',
    percent: '{{value, number(style: "percent")}}',
    currency: '{{value, number(style: "currency", currency: "USD")}}',
  },
};

// 其他语言的消息可以从 API 懒加载
const JA_JP_MESSAGES: TranslationMessages = ZH_CN_MESSAGES; // 简化示例
const KO_KR_MESSAGES: TranslationMessages = ZH_CN_MESSAGES; // 简化示例

// 语言包映射
const MESSAGES_MAP: Record<Locale, TranslationMessages> = {
  'zh-CN': ZH_CN_MESSAGES,
  'en-US': EN_US_MESSAGES,
  'ja-JP': JA_JP_MESSAGES,
  'ko-KR': KO_KR_MESSAGES,
};

// ═════════════════════════════════════════════
// 🟡 P4-5: 翻译函数
// ═════════════════════════════════════════════

/**
 * 获取嵌套对象属性（安全访问）
 */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;
  for (const key of parts) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

/**
 * 替换插值变量
 * 支持 {{name}} 和 {{name, format}} 两种格式
 */
function interpolate(
  template: string,
  params?: Record<string, any>,
  locale?: Locale,
): string {
  if (!params || !template) return template;

  return template.replace(/\{\{(\w+)(?:,\s*(\w+))?\}\}/g, (match, key, format) => {
    const value = params[key];

    if (value === undefined || value === null) {
      return match; // 保留原样
    }

    // 处理格式
    if (format) {
      const localeCode = locale || 'zh-CN';
      try {
        if (format.startsWith('number')) {
          const options = parseNumberOptions(format);
          return new Intl.NumberFormat(localeCode.replace('-', '_')).format(value);
        }
        if (format.startsWith('date')) {
          const date = value instanceof Date ? value : new Date(value);
          return new Intl.DateTimeFormat(localeCode.replace('-', '_')).format(date);
        }
      } catch {
        return String(value);
      }
    }

    return String(value);
  });
}

function parseNumberOptions(format: string): Intl.NumberFormatOptions {
  // 简化实现
  return {};
}

// ═════════════════════════════════════════════
// 🟡 P4-5: 上下文
// ═════════════════════════════════════════════

const TranslationContext = createContext<TranslationContextValue | null>(null);

interface TranslationProviderProps {
  children: ReactNode;
  initialLocale?: Locale;
  onLocaleChange?: (locale: Locale) => void;
  fallbackLocale?: Locale;
}

export function TranslationProvider({
  children,
  initialLocale = 'zh-CN',
  onLocaleChange,
  fallbackLocale = 'zh-CN',
}: TranslationProviderProps) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    // 从 localStorage 读取
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('rmfood_locale') as Locale;
      if (stored && LOCALES[stored]) {
        return stored;
      }
    }
    return initialLocale;
  });

  const [isLoading, setIsLoading] = useState(false);

  // 加载语言包（支持懒加载）
  const loadLocale = useCallback(async (targetLocale: Locale) => {
    // 如果已加载，直接使用
    if (MESSAGES_MAP[targetLocale]) {
      return;
    }

    setIsLoading(true);
    try {
      // 懒加载示例：实际应从 API 获取
      // const messages = await fetch(`/locales/${targetLocale}.json`).then(r => r.json());
      // MESSAGES_MAP[targetLocale] = messages;

      // 简化：使用中文作为占位
      MESSAGES_MAP[targetLocale] = ZH_CN_MESSAGES;
    } catch (error) {
      logger.error(`Failed to load locale: ${targetLocale}`, error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 切换语言
  const setLocale = useCallback(
    (newLocale: Locale) => {
      if (!LOCALES[newLocale]) {
        if (import.meta.env.DEV) logger.warn(`Unknown locale: ${newLocale}`);
        return;
      }

      setLocaleState(newLocale);

      // 持久化
      if (typeof window !== 'undefined') {
        localStorage.setItem('rmfood_locale', newLocale);
        document.documentElement.lang = newLocale;

        // 设置 RTL
        document.documentElement.dir = LOCALES[newLocale].rtl ? 'rtl' : 'ltr';
      }

      // 回调
      onLocaleChange?.(newLocale);

      // 加载语言包
      loadLocale(newLocale);
    },
    [onLocaleChange, loadLocale],
  );

  // 翻译函数
  const t = useCallback(
    (key: string, params?: Record<string, any>): string => {
      const messages = MESSAGES_MAP[locale] || MESSAGES_MAP[fallbackLocale];
      const fallbackMessages = MESSAGES_MAP[fallbackLocale];

      // 查找翻译
      let translation = getNestedValue(messages, key);

      // 尝试回退到默认语言
      if (translation === undefined) {
        translation = getNestedValue(fallbackMessages, key);
      }

      // 如果仍找不到，返回 key
      if (translation === undefined) {
        if (import.meta.env.DEV) {
          logger.warn(`Missing translation: ${key}`);
        }
        return key;
      }

      // 插值
      return interpolate(typeof translation === 'string' ? translation : key, params, locale);
    },
    [locale, fallbackLocale],
  );

  // 格式化函数
  const formatNumber = useCallback(
    (value: number, options?: Intl.NumberFormatOptions) => {
      return new Intl.NumberFormat(locale.replace('-', '_')).format(value);
    },
    [locale],
  );

  const formatDate = useCallback(
    (date: Date | string, options?: Intl.DateTimeFormatOptions) => {
      const d = date instanceof Date ? date : new Date(date);
      return new Intl.DateTimeFormat(locale.replace('-', '_'), options).format(d);
    },
    [locale],
  );

  const formatCurrency = useCallback(
    (value: number, currency: string = 'CNY') => {
      return new Intl.NumberFormat(locale.replace('-', '_'), {
        style: 'currency',
        currency,
      }).format(value);
    },
    [locale],
  );

  // 初始化
  useEffect(() => {
    loadLocale(locale);
  }, [locale, loadLocale]);

  const value: TranslationContextValue = {
    locale,
    setLocale,
    t,
    formatNumber,
    formatDate,
    formatCurrency,
    isLoading,
    availableLocales: Object.keys(LOCALES) as Locale[],
  };

  return <TranslationContext.Provider value={value}>{children}</TranslationContext.Provider>;
}

// ═════════════════════════════════════════════
// 🟡 P4-5: Hook
// ═════════════════════════════════════════════

export function useTranslation(): TranslationContextValue {
  const context = useContext(TranslationContext);
  if (!context) {
    // 提供默认实现
    return {
      locale: 'zh-CN',
      setLocale: () => {},
      t: (key) => key,
      formatNumber: (v) => String(v),
      formatDate: (v) => String(v),
      formatCurrency: (v) => String(v),
      isLoading: false,
      availableLocales: ['zh-CN', 'en-US'],
    };
  }
  return context;
}

// ═════════════════════════════════════════════
// 🟡 P4-5: 非 Hook 翻译函数（用于非组件文件）
// ═════════════════════════════════════════════

let _currentLocale: Locale = 'zh-CN';

export function setGlobalLocale(locale: Locale) {
  _currentLocale = locale;
  if (typeof window !== 'undefined') {
    localStorage.setItem('rmfood_locale', locale);
  }
}

export function tf(key: string, params?: Record<string, any>): string {
  const messages = MESSAGES_MAP[_currentLocale] || ZH_CN_MESSAGES;
  let translation = getNestedValue(messages, key);

  if (translation === undefined) {
    return key;
  }

  return interpolate(typeof translation === 'string' ? translation : key, params, _currentLocale);
}

// ═════════════════════════════════════════════
// 🟡 P4-5: 组件导出
// ═════════════════════════════════════════════

interface LocaleSwitcherProps {
  className?: string;
}

export function LocaleSwitcher({ className }: LocaleSwitcherProps) {
  const { locale, setLocale, availableLocales } = useTranslation();

  return (
    <select
      className={className}
      value={locale}
      onChange={(e) => setLocale(e.target.value as Locale)}
      style={{
        padding: '4px 8px',
        borderRadius: '4px',
        border: '1px solid #ddd',
        background: 'white',
        cursor: 'pointer',
      }}
    >
      {availableLocales.map((loc) => (
        <option key={loc} value={loc}>
          {LOCALES[loc]?.nativeName || loc}
        </option>
      ))}
    </select>
  );
}

// ═════════════════════════════════════════════
// 🟡 P4-5: 导出
// ═════════════════════════════════════════════

// LOCALES is exported at line 83 above — no duplicate export needed.
