/**
 * Landing Page — Navbar 配置
 *
 * Logo 配置：
 *   - logoPath：相对 public/ 的路径，如 '/logos/logo.svg'
 *   - logoSize.image：图片容器尺寸（含 padding），默认 32px
 *   - logoSize.icon：纯图标模式下的 Lucide 尺寸，默认 16px
 *   - 若 logoPath 为空或文件不存在，自动降级为 BRAND_CONFIG.logo.icon
 */
import { BRAND_CONFIG } from '@/config';

export interface NavLink {
  label: string;
  href: string;
}

export const navLinks: NavLink[] = [
  { label: '功能', href: '#features' },
  { label: '算法', href: '#algorithms' },
  { label: '场景', href: '#use-cases' },
  { label: '数据', href: '#data-sources' },
  { label: '定价', href: '#pricing' },
  { label: '常见问题', href: '#faq' },
];

export interface NavbarCTA {
  loginLabel?: string;
  trialLabel: string;
  dashboardLabel: string;
}

export const navbarCTA: NavbarCTA = {
  trialLabel: '免费开始研发',
  dashboardLabel: '工作台',
};

// ── Logo 配置 ───────────────────────────────────────────────────
export const logoPath = BRAND_CONFIG.logo.path ?? '';

export const logoSize = {
  /** 图片模式：容器尺寸（w/h），含内边距
   *  P0 触控热区修复：原 36px < HIG 44px，logo 区点击高度不足。
   *  44px 容器 + 44px 文字行高（h-[44px] items-center）保证整条 logo 命中区达标。 */
  image: 44,
  /** 图标模式：lucide-react 尺寸 */
  icon: 24,
};

/**
 * 判断是否使用图片 logo（路径非空）
 */
export const isImageLogo = logoPath.length > 0;
