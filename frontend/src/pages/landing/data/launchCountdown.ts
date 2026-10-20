/**
 * Launch Countdown — 数据配置
 *
 * v2 修复（P0 真实数据原则）：
 *   - 目标日期改为服务端固定锚点 anchorDate，全用户一致，不再随访客首次访问时间漂移
 *   - 删除 baseDays（localStorage 漂移机制已废弃）
 */
export const LAUNCH_CONFIG = {
  /** 是否启用，设为 false 后整个模块不渲染 */
  enabled: true,

  /** 固定上线日期锚点（ISO 格式，全用户统一）
   *  2026-11-01 = 自 2026-10-16 起 15 天，倒计时显示 15 天 */
  anchorDate: '2026-11-01T00:00:00+08:00',

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
