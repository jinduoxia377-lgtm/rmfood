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
 * 安全合规认证标识
 * 覆盖数据分级、信息安全、质量管理的完整信任链条
 */
export const trustSignals: TrustSignal[] = [
  {
    name: '等保三级',
    desc: '网络安全等级保护三级认证',
    icon: 'ShieldCheck',
    color: 'var(--color-primary-700, #047857)',
    date: '2025.06',
  },
  {
    name: 'ISO 27001',
    desc: '信息安全管理体系认证',
    icon: 'Award',
    color: 'var(--color-secondary-700, #1d4ed8)',
    date: '2025.09',
  },
  {
    name: 'SOC 2 Type II',
    desc: '安全与合规审计报告',
    icon: 'FileCheck',
    color: 'var(--color-accent-700, #6d28d9)',
    date: '2025.12',
  },
  {
    name: 'PIPL 合规',
    desc: '《个人信息保护法》合规认证',
    icon: 'UserCheck',
    color: 'var(--color-warning-700, #b45309)',
    date: '2026.01',
  },
];

/**
 * ICP 备案号配置
 * 用于 Footer 底部渲染
 */
export const ICP_CONFIG = {
  /** ICP 备案号（闽ICP备XXXXXXX号-1 格式） */
  icp: '闽ICP备2025001号-1',
  /** 网络经营备案信息 */
  businessLicense: '闽公网安备 35020302000XXX 号',
} as const;