/**
 * ============================================================
 *  RMFOOD AI 智能对话 — 视觉设计系统 v2.0（统一主题）
 *  基于项目设计令牌，品牌翠绿 #10B981
 * ============================================================
 *
 *  设计理念：
 *  - 专业、简洁、循证（符合药食同源配方平台定位）
 *  - 完全使用项目 CSS 变量，不引入额外主题色
 *  - 头像：用户品牌绿渐变 + 首字母，AI 药草叶图标
 *  - 气泡：用户右侧绿色渐变，AI 左侧干净卡片
 *  - 排版：14-15px 基础字号，1.65-1.72 行高，中文友好
 */

// ===== 类型定义 =====

export type DesignScheme = 'unified'

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
// 与项目品牌色对齐：翠绿 #10B981

const academicColors: ColorTokens = {
  // 用户消息 — 翠绿深色
  userBubbleBg: '#047857',
  userBubbleText: '#f7fafc',
  userBubbleBorder: 'transparent',

  // AI 消息 — 米白底，纸张质感
  aiBubbleBg: '#fefefe',
  aiBubbleText: '#1a202c',
  aiBubbleBorder: '#E5E7EB',

  // 错误 — 暖红，不刺眼
  errorBg: '#fff5f5',
  errorText: '#c53030',
  errorBorder: '#feb2b2',

  // 背景
  pageBg: '#fafaf9',
  chatAreaBg: '#ffffff',
  inputAreaBg: '#ffffff',

  // 强调色 — 项目翠绿统一
  primary: '#10b981',
  primaryLight: '#d1fae5',
  primaryDark: '#047857',
  accent: '#047857',

  // 文字层级
  textPrimary: '#1a202c',
  textSecondary: '#4a5568',
  textTertiary: '#718096',
  textMuted: '#a0aec0',

  // 边框
  border: '#E5E7EB',
  borderLight: '#edf2f7',
  divider: '#E5E7EB',

  // 头像
  avatarUserBg: '#047857',
  avatarUserText: '#ffffff',
  avatarAiBg: '#f7fafc',
  avatarAiText: '#047857',
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
  // 用户消息 — 翠绿渐变
  userBubbleBg: 'rgba(16, 185, 129, 0.9)',
  userBubbleText: '#ffffff',
  userBubbleBorder: 'rgba(255, 255, 255, 0.2)',

  // AI 消息 — 毛玻璃
  aiBubbleBg: 'rgba(255, 255, 255, 0.65)',
  aiBubbleText: '#1F2937',
  aiBubbleBorder: 'rgba(255, 255, 255, 0.5)',

  // 错误
  errorBg: 'rgba(239, 68, 68, 0.08)',
  errorText: '#B91C1C',
  errorBorder: 'rgba(239, 68, 68, 0.2)',

  // 背景 — 翠绿深色渐变
  pageBg: '#0f1a16',
  chatAreaBg: 'linear-gradient(180deg, #0f1a16 0%, #1a2e25 50%, #0f1a16 100%)',
  inputAreaBg: 'rgba(255, 255, 255, 0.06)',

  // 强调色 — 翠绿发光
  primary: '#10b981',
  primaryLight: 'rgba(16, 185, 129, 0.15)',
  primaryDark: '#047857',
  accent: '#059669',

  // 文字层级
  textPrimary: '#F3F4F6',
  textSecondary: '#D1D5DB',
  textTertiary: '#9CA3AF',
  textMuted: '#6B7280',

  // 边框
  border: 'rgba(255, 255, 255, 0.1)',
  borderLight: 'rgba(255, 255, 255, 0.05)',
  divider: 'rgba(255, 255, 255, 0.08)',

  // 头像
  avatarUserBg: 'linear-gradient(135deg, #059669, #10b981)',
  avatarUserText: '#ffffff',
  avatarAiBg: 'rgba(255, 255, 255, 0.1)',
  avatarAiText: '#34d399',
  avatarAiGlow: '0 0 20px rgba(16, 185, 129, 0.4), 0 0 40px rgba(16, 185, 129, 0.15)',
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
  bubbleUser: '0 4px 16px rgba(16, 185, 129, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.1) inset',
  bubbleAi: '0 4px 24px rgba(0, 0, 0, 0.06), 0 0 0 1px rgba(255, 255, 255, 0.3) inset',
  card: '0 8px 32px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(255, 255, 255, 0.08) inset',
  input: '0 0 0 1px rgba(255, 255, 255, 0.1) inset, 0 4px 16px rgba(0, 0, 0, 0.08)',
  modal: '0 32px 64px rgba(0, 0, 0, 0.4)',
  avatarAi: '0 0 20px rgba(16, 185, 129, 0.35), 0 0 40px rgba(16, 185, 129, 0.12)',
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
// 与项目品牌色对齐：翠绿 #10B981

const proColors: ColorTokens = {
  // 用户消息 — 翠绿实心
  userBubbleBg: '#059669',
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
  pageBg: '#f8fafc',
  chatAreaBg: '#ffffff',
  inputAreaBg: '#ffffff',

  // 强调色 — 项目翠绿统一
  primary: '#10b981',
  primaryLight: '#d1fae5',
  primaryDark: '#047857',
  accent: '#047857',

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
  avatarUserBg: '#059669',
  avatarUserText: '#ffffff',
  avatarAiBg: '#f0f2f5',
  avatarAiText: '#059669',
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
  bubbleUser: '0 2px 8px rgba(5, 150, 105, 0.2)',
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

// ===== 完整方案配置（统一品牌主题）=====

export const DESIGN_SCHEMES: Record<DesignScheme, DesignSchemeConfig> = {
  unified: {
    name: 'RMFOOD Unified',
    nameCN: '品牌统一',
    description: '基于项目设计令牌，品牌翠绿 #10B981，专业级药食同源配方平台风格',
    colors: {
      // 用户消息 — 品牌翠绿渐变
      userBubbleBg: 'linear-gradient(135deg, #059669 0%, #10b981 50%, #34d399 100%)',
      userBubbleText: '#ffffff',
      userBubbleBorder: 'transparent',
      // AI 消息 — 干净卡片
      aiBubbleBg: 'var(--card-bg-solid, #ffffff)',
      aiBubbleText: 'var(--text-primary, #1e293b)',
      aiBubbleBorder: 'var(--border-color, #e2e8f0)',
      // 错误
      errorBg: 'var(--color-error-bg, #fef2f2)',
      errorText: 'var(--color-error-text, #991b1b)',
      errorBorder: '#fecaca',
      // 背景
      pageBg: 'var(--bg-canvas, #f8fafc)',
      chatAreaBg: 'var(--bg-primary, #f8fafc)',
      inputAreaBg: 'var(--card-bg-solid, #ffffff)',
      // 强调色
      primary: 'var(--color-primary-500, #10b981)',
      primaryLight: 'var(--color-primary-100, #d1fae5)',
      primaryDark: 'var(--color-primary-700, #047857)',
      accent: 'var(--color-primary-600, #059669)',
      // 文字层级
      textPrimary: 'var(--text-primary, #1e293b)',
      textSecondary: 'var(--text-secondary, #64748b)',
      textTertiary: '#94a3b8',
      textMuted: 'var(--text-muted, #94a3b8)',
      // 边框
      border: 'var(--border-color, #e2e8f0)',
      borderLight: '#f1f5f9',
      divider: 'var(--border-color, #e2e8f0)',
      // 头像
      avatarUserBg: 'linear-gradient(135deg, #059669, #10b981)',
      avatarUserText: '#ffffff',
      avatarAiBg: 'var(--color-primary-50, #ecfdf5)',
      avatarAiText: 'var(--color-primary-700, #047857)',
      avatarAiGlow: '0 0 16px rgba(16, 185, 129, 0.2)',
    },
    spacing: {
      bubblePaddingX: '16px',
      bubblePaddingY: '13px',
      bubbleGap: '14px',
      bubbleMarginBottom: '16px',
      avatarSize: '36px',
      avatarGap: '10px',
      dateSeparatorGap: '20px',
      actionBarGap: '4px',
      maxBubbleWidth: '720px',
    },
    typography: {
      fontFamily: "'Inter', -apple-system, 'SF Pro Text', 'PingFang SC', 'Microsoft YaHei', sans-serif",
      fontMono: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
      fontSizeBase: '14.5px',
      fontSizeSmall: '12px',
      fontSizeTiny: '12px',
      lineHeight: '1.72',
      letterSpacing: '-0.01em',
      fontWeightNormal: '400',
      fontWeightMedium: '500',
      fontWeightBold: '600',
    },
    borderRadius: {
      bubble: '10px',
      bubbleUser: '14px 4px 14px 14px',
      bubbleAi: '4px 14px 14px 14px',
      avatar: '50%',
      input: '12px',
      card: '10px',
      button: '8px',
    },
    shadows: {
      bubbleUser: '0 2px 8px rgba(5, 150, 105, 0.2), 0 0 0 1px rgba(5, 150, 105, 0.1)',
      bubbleAi: '0 1px 3px rgba(0, 0, 0, 0.06), 0 0 0 1px rgba(0, 0, 0, 0.03)',
      card: '0 1px 3px rgba(0, 0, 0, 0.06)',
      input: '0 0 0 1px var(--border-color, #e2e8f0)',
      modal: '0 20px 60px rgba(0, 0, 0, 0.12)',
      avatarAi: '0 0 12px rgba(16, 185, 129, 0.15)',
    },
    animations: {
      messageIn: 'chatFadeInUp 0.25s ease-out both',
      bubbleHover: 'box-shadow 0.15s ease, transform 0.15s ease',
      typingDots: 'typingBounce 1.2s ease-in-out infinite',
      avatarPulse: 'avatarPulse 3s ease-in-out infinite alternate',
      transitionFast: '120ms ease',
      transitionNormal: '200ms ease',
      transitionSlow: '350ms ease',
    },
    userBubbleClass: 'chat-bubble-user',
    aiBubbleClass: 'chat-bubble-ai',
    containerClass: 'chat-container-unified',
    inputContainerClass: 'chat-input-unified',
    avatarAiClass: 'avatar-ai',
    avatarUserClass: 'avatar-user',
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

  return {
    size: parseInt(sp.avatarSize),
    borderRadius: '50%',
    fontSize: '13px',
    userDefault: { bg: c.avatarUserBg, text: c.avatarUserText, letter: 'U' },
    aiDefault: {
      bg: c.avatarAiBg,
      text: c.avatarAiText,
      icon: 'leaf',  // lucide-react Leaf icon（药草叶）
      glow: c.avatarAiGlow,
    },
    statusIndicator: {
      size: 9,
      online: '#10b981',
      thinking: '#f59e0b',
      offline: '#94a3b8',
      position: 'bottom-right',
    },
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
      background: '#f1f3f5',
      color: '#1a202c',
      padding: '12px 16px',
      borderRadius: '8px',
      overflowX: 'auto',
    },
    inlineCode: {
      fontFamily: t.fontMono,
      fontSize: '0.88em',
      background: '#f1f3f5',
      color: '#c05621',
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
