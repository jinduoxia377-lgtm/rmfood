/**
 * TrustSignals — 安全合规与信任标识数据
 *
 * 用于 Footer 底部渲染安全认证标识与合规信息。
 * 数据仅用于展示，不含任何逻辑。
 */
export interface TrustSignal {
  /** 标识名称 */
  name: string;
  /** 简短描述 */
  desc: string;
  /** 图标标识（lucide-react 图标名） */
  icon: string;
  /** 颜色 */
  color: string;
  /** 认证日期/有效期 */
  date: string;
}

/**
 * 安全合规信任标识（治理/设计层面如实表述，非"已认证"承诺）
 * 说明：以下标识描述平台按相关要求进行的架构设计与数据治理，
 * 不代表已取得第三方认证证书；证书信息以官网公示为准。
 * 本数组全部徽章均为「设计口径」表述，不代表已取得对应第三方认证证书；如取得认证将另行公示并更新。如需改变对外宣称须经法务书面复核。
 */
export const trustSignals: TrustSignal[] = [
  {
    name: '等保三级设计',
    desc: '已按网络安全等级保护三级要求开展架构设计与数据治理；未取得第三方认证',
    icon: 'ShieldCheck',
    color: 'var(--color-primary-700, #047857)',
    date: '—',
  },
  {
    name: 'ISO 27001 设计',
    desc: '已按 ISO 27001 要求开展信息安全管理体系设计；未取得第三方认证',
    icon: 'Award',
    color: 'var(--color-secondary-700, #1d4ed8)',
    date: '—',
  },
  {
    name: 'SOC 2 设计',
    desc: '已按 SOC 2 Type II 要求开展安全与合规治理设计；未取得第三方认证',
    icon: 'FileCheck',
    color: 'var(--color-accent-700, #6d28d9)',
    date: '—',
  },
  {
    name: 'PIPL 要求遵循',
    desc: '按《个人信息保护法》要求开展数据治理与合规设计；未取得官方合规认证',
    icon: 'UserCheck',
    color: 'var(--color-warning-700, #b45309)',
    date: '—',
  },
];

/**
 * ICP 备案号配置
 * 真实备案号已由业务确认（2026-11-15）：闽ICP备2025096032号，页脚正常渲染。
 */
export const ICP_CONFIG = {
  /** ICP 备案号（业务确认真实值，页脚渲染） */
  icp: '闽ICP备2025096032号',
  /** 网络经营备案信息 */
  businessLicense: '公安备案信息以官网公示为准',
} as const;