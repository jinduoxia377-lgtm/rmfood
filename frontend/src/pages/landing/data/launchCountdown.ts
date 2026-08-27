/**
 * Launch Countdown — 数据配置
 *
 * 修改方式：
 *   - enabled: false  → 隐藏整个模块
 *   - baseDays       → 重新倒计时天数（新访客从该值开始）
 *   - title / subtitle / ctaLabel → 文案
 */
export const LAUNCH_CONFIG = {
  /** 是否启用，设为 false 后整个模块不渲染 */
  enabled: true,

  /** 默认倒计时天数（仅首次访问时生效） */
  baseDays: 35,

  /** 主标题 */
  title: '正式版即将上线',

  /** 副标题 */
  subtitle: '提前预约，首发当天优先体验全新配方研发平台',

  /** CTA 按钮文案 */
  ctaLabel: '第一时间通知',

  /** CTA 跳转地址 */
  ctaHref: '/login',

  /** 底部小字 */
  footnote: '限量 500 个优先体验名额 · 上线后自动失效',
} as const;
