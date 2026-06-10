/**
 * ============================================================
 *  RMFOOD AI 智能对话 — 视觉设计系统 v1.0
 *  三套专业级视觉方案 + 统一设计规范
 * ============================================================
 *
 *  方案 A: Academic Minimal（学术极简）
 *    - 灵感: Nature / Science / Lancet 学术期刊
 *    - 特征: 高留白、衬线/无衬线混排、克制的色彩、严谨的层级
 *    - 适用: 研究人员、配方工程师、学术用户
 *
 *  方案 B: Tech Glassmorphism（科技玻璃态）
 *    - 灵感: Apple Intelligence / Claude / Gemini
 *    - 特征: 毛玻璃效果、渐变光晕、动态状态指示、沉浸感
 *    - 适用: 科技爱好者、年轻研发人员、追求现代感用户
 *
 *  方案 C: Professional Card（专业卡片式）
 *    - 灵感: Notion / Linear / 企业级 SaaS
 *    - 特征: 清晰卡片边界、结构化信息展示、高可读性、效率优先
 *    - 适用: 生产环境、企业用户、高频操作场景
 */

// ===== 类型定义 =====

export type DesignScheme = 'academic' | 'glassmorphism' | 'professional'

export interface ColorTokens {
  // 用户消息
  userBubbleBg: string
  userBubbleText: string
  userBubbleBorder: string

  // AI 消息
  aiBubbleBg: string
  aiBubbleText: string
  aiBubbleBorder: string

  // 系统/错误
  errorBg: string
  errorText: string
  errorBorder: string

  // 背景
  pageBg: string
  chatAreaBg: string
  inputAreaBg: string

  // 强调色
  primary: string
  primaryLight: string
  primaryDark: string
  accent: string

  // 文字层级
  textPrimary: string
  textSecondary: string
  textTertiary: string
  textMuted: string

  // 边框与分割线
  border: string
  borderLight: string
  divider: string

  // 头像
  avatarUserBg: string
  avatarUserText: string
  avatarAiBg: string
  avatarAiText: string
  avatarAiGlow: string
}

export interface SpacingTokens {
  bubblePaddingX: string       // 气泡水平内边距
  bubblePaddingY: string       // 气泡垂直内边距
  bubbleGap: string            // 消息间距
  bubbleMarginBottom: string   // 气泡底部间距
  avatarSize: string           // 头像尺寸
  avatarGap: string            // 头像与气泡间距
  dateSeparatorGap: string     // 日期分隔线间距
  actionBarGap: string         // 操作栏间距
  maxBubbleWidth: string       // 气泡最大宽度
}

export interface TypographyTokens {
  fontFamily: string           // 正文字体
  fontMono: string             // 代码字体
  fontSizeBase: string         // 基础字号 (13-15px)
  fontSizeSmall: string        // 小字 (11-12px)
  fontSizeTiny: string         // 极小字 (10px)
  lineHeight: string           // 行高 (1.5-1.75)
  letterSpacing: string        // 字间距
  fontWeightNormal: string     // 常规字重
  fontWeightMedium: string     // 中等字重
  fontWeightBold: string       // 粗体
}

export interface BorderRadiusTokens {
  bubble: string               // 气泡圆角
  bubbleUser: string           // 用户气泡圆角（非对称）
  bubbleAi: string             // AI 气泡圆角（非对称）
  avatar: string               // 头像圆角
  input: string                // 输入框圆角
  card: string                 // 卡片圆角
  button: string               // 按钮圆角
}

export interface ShadowTokens {
  bubbleUser: string           // 用户气泡阴影
  bubbleAi: string             // AI 气泡阴影
  card: string                 // 卡片阴影
  input: string                // 输入框阴影
  modal: string                // 弹窗阴影
  avatarAi: string             // AI 头像光晕/阴影
}

export interface AnimationTokens {
  messageIn: string            // 消息进入动画
  bubbleHover: string          // 气泡悬停动画
  typingDots: string           // 打字机跳动动画
  avatarPulse: string          // AI 头像脉冲动画
  transitionFast: string       // 快速过渡 (150ms)
  transitionNormal: string     // 正常过渡 (200-250ms)
  transitionSlow: string       // 慢速过渡 (300-400ms)
}

export interface DesignSchemeConfig {
  name: string
  nameCN: string
  description: string
  colors: ColorTokens
  spacing: SpacingTokens
  typography: TypographyTokens
  borderRadius: BorderRadiusTokens
  shadows: ShadowTokens
  animations: AnimationTokens
  // 特殊样式类名
  userBubbleClass: string
  aiBubbleClass: string
  containerClass: string
  inputContainerClass: string
  avatarAiClass: string
  avatarUserClass: string
}

// ===== 方案 A: Academic Minimal（学术极简）=====

const academicColors: ColorTokens = {
  // 用户消息 — 深墨蓝，学术感
  userBubbleBg: '#1a365d',
  userBubbleText: '#f7fafc',
  userBubbleBorder: 'transparent',

  // AI 消息 — 米白底，纸张质感
  aiBubbleBg: '#fefefe',
  aiBubbleText: '#1a202c',
  aiBubbleBorder: '#e2e8f0',

  // 错误 — 暖红，不刺眼
  errorBg: '#fff5f5',
  errorText: '#c53030',
  errorBorder: '#feb2b2',

  // 背景
  pageBg: '#fafaf9',          // warm gray-50
  chatAreaBg: '#ffffff',
  inputAreaBg: '#ffffff',

  // 强调色 — 靛蓝
  primary: '#2c5282',
  primaryLight: '#ebf4ff',
  primaryDark: '#1a365d',
  accent: '#c05621',          // 琥珀色强调

  // 文字层级
  textPrimary: '#1a202c',
  textSecondary: '#4a5568',
  textTertiary: '#718096',
  textMuted: '#a0aec0',

  // 边框
  border: '#e2e8f0',
  borderLight: '#edf2f7',
  divider: '#e2e8f0',

  // 头像
  avatarUserBg: '#2c5282',
  avatarUserText: '#ffffff',
  avatarAiBg: '#f7fafc',
  avatarAiText: '#2c5282',
  avatarAiGlow: 'transparent',
}

const academicSpacing: SpacingTokens = {
  bubblePaddingX: '20px',
  bubblePaddingY: '14px',
  bubbleGap: '16px',
  bubbleMarginBottom: '20px',
  avatarSize: '36px',
  avatarGap: '12px',
  dateSeparatorGap: '28px',
  actionBarGap: '6px',
  maxBubbleWidth: '720px',
}

const academicTypography: TypographyTokens = {
  fontFamily: "'Inter', -apple-system, 'SF Pro Text', 'PingFang SC', 'Microsoft YaHei', sans-serif",
  fontMono: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
  fontSizeBase: '14.5px',
  fontSizeSmall: '12px',
  fontSizeTiny: '10.5px',
  lineHeight: '1.72',
  letterSpacing: '-0.01em',
  fontWeightNormal: '400',
  fontWeightMedium: '500',
  fontWeightBold: '600',
}

const academicRadius: BorderRadiusTokens = {
  bubble: '8px',
  bubbleUser: '12px 4px 12px 12px',      // 右上角尖角（指向AI）
  bubbleAi: '4px 12px 12px 12px',         // 左上角尖角（指向用户）
  avatar: '50%',
  input: '12px',
  card: '10px',
  button: '8px',
}

const academicShadows: ShadowTokens = {
  bubbleUser: '0 1px 3px rgba(26, 54, 93, 0.15)',
  bubbleAi: '0 1px 2px rgba(0, 0, 0, 0.04)',
  card: '0 1px 3px rgba(0, 0, 0, 0.06), 0 1px 2px rgba(0, 0, 0, 0.04)',
  input: '0 0 0 1px rgba(226, 232, 240, 0.8) inset',
  modal: '0 20px 60px rgba(0, 0, 0, 0.12)',
  avatarAi: 'none',
}

const academicAnimations: AnimationTokens = {
  messageIn: 'chatFadeInUp 0.25s ease-out both',
  bubbleHover: 'box-shadow 0.15s ease, transform 0.15s ease',
  typingDots: 'typingBounce 1.2s ease-in-out infinite',
  avatarPulse: 'none',
  transitionFast: '150ms ease',
  transitionNormal: '220ms ease',
  transitionSlow: '350ms ease',
}

// ===== 方案 B: Tech Glassmorphism（科技玻璃态）=====

const glassColors: ColorTokens = {
  // 用户消息 — 渐变紫蓝
  userBubbleBg: 'rgba(99, 102, 241, 0.9)',
  userBubbleText: '#ffffff',
  userBubbleBorder: 'rgba(255, 255, 255, 0.2)',

  // AI 消息 — 毛玻璃
  aiBubbleBg: 'rgba(255, 255, 255, 0.65)',
  aiBubbleText: '#1e293b',
  aiBubbleBorder: 'rgba(255, 255, 255, 0.5)',

  // 错误
  errorBg: 'rgba(239, 68, 68, 0.08)',
  errorText: '#dc2626',
  errorBorder: 'rgba(239, 68, 68, 0.2)',

  // 背景 — 渐变
  pageBg: '#0f172a',
  chatAreaBg: 'linear-gradient(180deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)',
  inputAreaBg: 'rgba(255, 255, 255, 0.06)',

  // 强调色 — 电光紫
  primary: '#818cf8',
  primaryLight: 'rgba(129, 140, 248, 0.15)',
  primaryDark: '#6366f1',
  accent: '#34d399',              // 荧光绿

  // 文字层级
  textPrimary: '#f1f5f9',
  textSecondary: '#cbd5e1',
  textTertiary: '#94a3b8',
  textMuted: '#64748b',

  // 边框
  border: 'rgba(255, 255, 255, 0.1)',
  borderLight: 'rgba(255, 255, 255, 0.05)',
  divider: 'rgba(255, 255, 255, 0.08)',

  // 头像
  avatarUserBg: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
  avatarUserText: '#ffffff',
  avatarAiBg: 'rgba(255, 255, 255, 0.1)',
  avatarAiText: '#818cf8',
  avatarAiGlow: '0 0 20px rgba(129, 140, 248, 0.4), 0 0 40px rgba(129, 140, 248, 0.15)',
}

const glassSpacing: SpacingTokens = {
  bubblePaddingX: '18px',
  bubblePaddingY: '13px',
  bubbleGap: '14px',
  bubbleMarginBottom: '18px',
  avatarSize: '38px',
  avatarGap: '10px',
  dateSeparatorGap: '24px',
  actionBarGap: '5px',
  maxBubbleWidth: '720px',
}

const glassTypography: TypographyTokens = {
  fontFamily: "'Inter', -apple-system, 'SF Pro Display', 'PingFang SC', sans-serif",
  fontMono: "'JetBrains Mono', 'SF Mono', Consolas, monospace",
  fontSizeBase: '14px',
  fontSizeSmall: '11.5px',
  fontSizeTiny: '10px',
  lineHeight: '1.65',
  letterSpacing: '-0.005em',
  fontWeightNormal: '400',
  fontWeightMedium: '500',
  fontWeightBold: '600',
}

const glassRadius: BorderRadiusTokens = {
  bubble: '18px',
  bubbleUser: '20px 6px 20px 20px',
  bubbleAi: '6px 20px 20px 20px',
  avatar: '50%',
  input: '16px',
  card: '16px',
  button: '12px',
}

const glassShadows: ShadowTokens = {
  bubbleUser: '0 4px 16px rgba(99, 102, 241, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.1) inset',
  bubbleAi: '0 4px 24px rgba(0, 0, 0, 0.06), 0 0 0 1px rgba(255, 255, 255, 0.3) inset',
  card: '0 8px 32px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(255, 255, 255, 0.08) inset',
  input: '0 0 0 1px rgba(255, 255, 255, 0.1) inset, 0 4px 16px rgba(0, 0, 0, 0.08)',
  modal: '0 32px 64px rgba(0, 0, 0, 0.4)',
  avatarAi: '0 0 20px rgba(129, 140, 248, 0.35), 0 0 40px rgba(129, 140, 248, 0.12)',
}

const glassAnimations: AnimationTokens = {
  messageIn: 'chatGlassIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) both',
  bubbleHover: 'box-shadow 0.2s ease, transform 0.2s ease, backdrop-filter 0.2s ease',
  typingDots: 'typingBounce 1.2s ease-in-out infinite',
  avatarPulse: 'avatarGlow 3s ease-in-out infinite alternate',
  transitionFast: '150ms cubic-bezier(0.4, 0, 0.2, 1)',
  transitionNormal: '250ms cubic-bezier(0.4, 0, 0.2, 1)',
  transitionSlow: '400ms cubic-bezier(0.4, 0, 0.2, 1)',
}

// ===== 方案 C: Professional Card（专业卡片式）=====

const proColors: ColorTokens = {
  // 用户消息 — 主色调实心
  userBubbleBg: '#1976d2',
  userBubbleText: '#ffffff',
  userBubbleBorder: 'transparent',

  // AI 消息 — 浅灰卡片
  aiBubbleBg: '#f8f9fa',
  aiBubbleText: '#212529',
  aiBubbleBorder: '#dee2e6',

  // 错误
  errorBg: '#fff3cd',
  errorText: '#856404',
  errorBorder: '#ffc107',

  // 背景
  pageBg: '#f4f6f9',
  chatAreaBg: '#ffffff',
  inputAreaBg: '#ffffff',

  // 强调色 — 经典蓝
  primary: '#1976d2',
  primaryLight: '#e3f2fd',
  primaryDark: '#1565c0',
  accent: '#00897b',              // 青绿

  // 文字层级
  textPrimary: '#212529',
  textSecondary: '#495057',
  textTertiary: '#868e96',
  textMuted: '#adb5bd',

  // 边框
  border: '#dee2e6',
  borderLight: '#e9ecef',
  divider: '#dee2e6',

  // 头像
  avatarUserBg: '#1976d2',
  avatarUserText: '#ffffff',
  avatarAiBg: '#f0f2f5',
  avatarAiText: '#1976d2',
  avatarAiGlow: 'none',
}

const proSpacing: SpacingTokens = {
  bubblePaddingX: '16px',
  bubblePaddingY: '12px',
  bubbleGap: '14px',
  bubbleMarginBottom: '16px',
  avatarSize: '34px',
  avatarGap: '10px',
  dateSeparatorGap: '24px',
  actionBarGap: '4px',
  maxBubbleWidth: '720px',
}

const proTypography: TypographyTokens = {
  fontFamily: "'Inter', -apple-system, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif",
  fontMono: "'JetBrains Mono', 'Cascadia Code', Consolas, monospace",
  fontSizeBase: '14px',
  fontSizeSmall: '12px',
  fontSizeTiny: '10.5px',
  lineHeight: '1.65',
  letterSpacing: '-0.008em',
  fontWeightNormal: '400',
  fontWeightMedium: '500',
  fontWeightBold: '600',
}

const proRadius: BorderRadiusTokens = {
  bubble: '10px',
  bubbleUser: '14px 4px 14px 14px',
  bubbleAi: '4px 14px 14px 14px',
  avatar: '50%',
  input: '10px',
  card: '8px',
  button: '6px',
}

const proShadows: ShadowTokens = {
  bubbleUser: '0 2px 8px rgba(25, 118, 210, 0.2)',
  bubbleAi: '0 1px 3px rgba(0, 0, 0, 0.06)',
  card: '0 1px 3px rgba(0, 0, 0, 0.08)',
  input: '0 0 0 1px #dee2e6',
  modal: '0 16px 48px rgba(0, 0, 0, 0.15)',
  avatarAi: 'none',
}

const proAnimations: AnimationTokens = {
  messageIn: 'chatSlideIn 0.2s ease-out both',
  bubbleHover: 'box-shadow 0.15s ease, border-color 0.15s ease',
  typingDots: 'typingBounce 1.2s ease-in-out infinite',
  avatarPulse: 'none',
  transitionFast: '120ms ease',
  transitionNormal: '200ms ease',
  transitionSlow: '300ms ease',
}

// ===== 完整方案配置 =====

export const DESIGN_SCHEMES: Record<DesignScheme, DesignSchemeConfig> = {
  academic: {
    name: 'Academic Minimal',
    nameCN: '学术极简',
    description: '灵感源自 Nature/Lancet 学术期刊，高留白、克制色彩、严谨层级',
    colors: academicColors,
    spacing: academicSpacing,
    typography: academicTypography,
    borderRadius: academicRadius,
    shadows: academicShadows,
    animations: academicAnimations,
    userBubbleClass: 'chat-bubble-user-academic',
    aiBubbleClass: 'chat-bubble-ai-academic',
    containerClass: 'chat-container-academic',
    inputContainerClass: 'chat-input-academic',
    avatarAiClass: 'avatar-ai-academic',
    avatarUserClass: 'avatar-user-academic',
  },
  glassmorphism: {
    name: 'Tech Glassmorphism',
    nameCN: '科技玻璃态',
    description: '毛玻璃效果 + 渐变光晕 + 动态状态，Apple/Claude 级沉浸体验',
    colors: glassColors,
    spacing: glassSpacing,
    typography: glassTypography,
    borderRadius: glassRadius,
    shadows: glassShadows,
    animations: glassAnimations,
    userBubbleClass: 'chat-bubble-user-glass',
    aiBubbleClass: 'chat-bubble-ai-glass',
    containerClass: 'chat-container-glass',
    inputContainerClass: 'chat-input-glass',
    avatarAiClass: 'avatar-ai-glass',
    avatarUserClass: 'avatar-user-glass',
  },
  professional: {
    name: 'Professional Card',
    nameCN: '专业卡片式',
    description: 'Notion/Linear 风格，清晰边界、结构化信息、效率优先的企业级设计',
    colors: proColors,
    spacing: proSpacing,
    typography: proTypography,
    borderRadius: proRadius,
    shadows: proShadows,
    animations: proAnimations,
    userBubbleClass: 'chat-bubble-user-pro',
    aiBubbleClass: 'chat-bubble-ai-pro',
    containerClass: 'chat-container-pro',
    inputContainerClass: 'chat-input-pro',
    avatarAiClass: 'avatar-ai-pro',
    avatarUserClass: 'avatar-user-pro',
  },
}

// ===== 工具函数 =====

/** 获取当前方案的完整配置 */
export function getScheme(scheme: DesignScheme): DesignSchemeConfig {
  return DESIGN_SCHEMES[scheme]
}

/** 获取 CSS 变量字符串（用于 :root 或 scoped style） */
export function generateCSSVariables(scheme: DesignScheme): string {
  const s = DESIGN_SCHEMES[scheme].colors
  return `
    --chat-user-bg: ${s.userBubbleBg};
    --chat-user-text: ${s.userBubbleText};
    --chat-user-border: ${s.userBubbleBorder};
    --chat-ai-bg: ${s.aiBubbleBg};
    --chat-ai-text: ${s.aiBubbleText};
    --chat-ai-border: ${s.aiBubbleBorder};
    --chat-error-bg: ${s.errorBg};
    --chat-error-text: ${s.errorText};
    --chat-error-border: ${s.errorBorder};
    --chat-page-bg: ${s.pageBg};
    --chat-primary: ${s.primary};
    --chat-primary-light: ${s.primaryLight};
    --chat-text-primary: ${s.textPrimary};
    --chat-text-secondary: ${s.textSecondary};
    --chat-text-muted: ${s.textMuted};
    --chat-border: ${s.border};
    --chat-avatar-ai-bg: ${s.avatarAiBg};
    --chat-avatar-ai-text: ${s.avatarAiText};
    --chat-avatar-ai-glow: ${s.avatarAiGlow};
  `.trim()
}

// ===== 头像组件规范 =====

export interface AvatarSpec {
  size: number                  // px
  borderRadius: string          // CSS value
  fontSize: string              // 字母/图标大小
  /** 用户默认头像 */
  userDefault: {
    bg: string
    text: string
    letter: string              // 默认显示字母
  }
  /** AI 头像 */
  aiDefault: {
    bg: string
    text: string
    icon: string                 // SVG icon path 或组件名
    glow?: string               // box-shadow 光晕
  }
  /** 在线/思考/离线 状态 */
  statusIndicator: {
    size: number                // px
    online: string              // color
    thinking: string            // color
    offline: string             // color
    position: string            // bottom-right 等
  }
}

export function getAvatarSpec(scheme: DesignScheme): AvatarSpec {
  const config = DESIGN_SCHEMES[scheme]
  const c = config.colors
  const sp = config.spacing

  switch (scheme) {
    case 'academic':
      return {
        size: parseInt(sp.avatarSize),
        borderRadius: '50%',
        fontSize: '13px',
        userDefault: { bg: c.avatarUserBg, text: c.avatarUserText, letter: 'U' },
        aiDefault: {
          bg: c.avatarAiBg,
          text: c.avatarAiText,
          icon: 'brain',  // lucide-react Brain icon
        },
        statusIndicator: {
          size: 9,
          online: '#48bb78',
          thinking: '#ecc94b',
          offline: '#a0aec0',
          position: 'bottom-right',
        },
      }
    case 'glassmorphism':
      return {
        size: parseInt(sp.avatarSize),
        borderRadius: '50%',
        fontSize: '14px',
        userDefault: { bg: c.avatarUserBg, text: c.avatarUserText, letter: 'U' },
        aiDefault: {
          bg: c.avatarAiBg,
          text: c.avatarAiText,
          icon: 'sparkles',
          glow: c.avatarAiGlow,
        },
        statusIndicator: {
          size: 10,
          online: '#34d399',
          thinking: '#fbbf24',
          offline: '#475569',
          position: 'bottom-right',
        },
      }
    case 'professional':
      return {
        size: parseInt(sp.avatarSize),
        borderRadius: '50%',
        fontSize: '12px',
        userDefault: { bg: c.avatarUserBg, text: c.avatarUserText, letter: 'U' },
        aiDefault: {
          bg: c.avatarAiBg,
          text: c.avatarAiText,
          icon: 'bot',
        },
        statusIndicator: {
          size: 8,
          online: '#10b981',
          thinking: '#f59e0b',
          offline: '#d1d5db',
          position: 'bottom-right',
        },
      }
  }
}

// ===== 排版工具函数 =====

export interface TypograpyRules {
  body: React.CSSProperties
  codeBlock: React.CSSProperties
  inlineCode: React.CSSProperties
  link: React.CSSProperties
  heading: React.CSSProperties      // AI 回复中的标题
  timestamp: React.CSSProperties
  systemMessage: React.CSSProperties
}

export function getTypographyRules(scheme: DesignScheme): TypograpyRules {
  const t = DESIGN_SCHEMES[scheme].typography
  const c = DESIGN_SCHEMES[scheme].colors

  return {
    body: {
      fontFamily: t.fontFamily,
      fontSize: t.fontSizeBase,
      lineHeight: t.lineHeight,
      letterSpacing: t.letterSpacing,
      color: c.textPrimary,
      wordBreak: 'break-word',
    },
    codeBlock: {
      fontFamily: t.fontMono,
      fontSize: '12.5px',
      lineHeight: '1.6',
      background: scheme === 'glassmorphism' ? 'rgba(0,0,0,0.25)' : '#f1f3f5',
      color: scheme === 'glassmorphism' ? '#e2e8f0' : '#1a202c',
      padding: '12px 16px',
      borderRadius: '8px',
      overflowX: 'auto',
    },
    inlineCode: {
      fontFamily: t.fontMono,
      fontSize: '0.88em',
      background: scheme === 'glassmorphism' ? 'rgba(0,0,0,0.2)' : '#f1f3f5',
      color: scheme === 'glassmorphism' ? '#c084fc' : '#c05621',
      padding: '2px 6px',
      borderRadius: '4px',
    },
    link: {
      color: c.primary,
      textDecoration: 'underline',
      textUnderlineOffset: '2px',
      textDecorationThickness: '1px',
    },
    heading: {
      fontFamily: t.fontFamily,
      fontWeight: t.fontWeightBold,
      fontSize: '16px',
      lineHeight: '1.45',
      marginTop: '16px',
      marginBottom: '8px',
      color: c.textPrimary,
    },
    timestamp: {
      fontFamily: t.fontFamily,
      fontSize: t.fontSizeTiny,
      fontWeight: t.fontWeightNormal,
      color: c.textMuted,
      letterSpacing: '0.02em',
    },
    systemMessage: {
      fontFamily: t.fontFamily,
      fontSize: t.fontSizeSmall,
      fontStyle: 'italic',
      color: c.textTertiary,
    },
  }
}

// ===== 全局 CSS 注入（关键帧动画等）=====

export const GLOBAL_CHAT_STYLES = `
  /* ===== 消息入场动画 ===== */
  @keyframes chatFadeInUp {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
  }

  @keyframes chatSlideIn {
    from { opacity: 0; transform: translateX(-10px); }
    to { opacity: 1; transform: translateX(0); }
  }

  @keyframes chatGlassIn {
    from {
      opacity: 0;
      transform: translateY(12px) scale(0.97);
      backdrop-filter: blur(0px);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
      backdrop-filter: blur(12px);
    }
  }

  @keyframes typingBounce {
    0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
    40% { transform: translateY(-5px); opacity: 1; }
  }

  @keyframes avatarGlow {
    from { box-shadow: 0 0 15px rgba(129, 140, 248, 0.2); }
    to { box-shadow: 0 0 25px rgba(129, 140, 248, 0.5), 0 0 50px rgba(129, 140, 248, 0.15); }
  }

  /* ===== 打字机光标闪烁 ===== */
  @keyframes cursorBlink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0; }
  }

  .chat-typing-cursor::after {
    content: '|';
    animation: cursorBlink 0.8s step-end infinite;
    margin-left: 1px;
    color: currentColor;
  }

  /* ===== 消息通用基础样式 ===== */
  .chat-message-enter {
    animation: chatFadeInUp 0.25s ease-out both;
  }

  /* ===== 减少动效偏好 ===== */
  @media (prefers-reduced-motion: reduce) {
    .chat-message-enter { animation: none; opacity: 1; }
    .chat-typing-cursor::after { animation: none; content: ''; }
    [class*="avatar-ai"] { animation: none !important; }
  }
`

export default DESIGN_SCHEMES
