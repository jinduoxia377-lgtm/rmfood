/**
 * 莱茵分子 公官网着陆页 — 模块化编排器 v7.1
 *
 * 架构：
 *   sections/  → 各业务区块组件（独立、可单独测试）
 *   data/      → 纯数据配置（文案/列表/定价，修改无需改组件逻辑）
 *   shared/    → 共享 hook 与工具（useReveal, Reveal, iconFactory, LazySection）
 *   LandingPage.css → 区块共享样式
 *
 * 此文件仅为编排层，不承载业务逻辑。
 *
 * 性能优化（v7.1）：
 *   - Hero + Navbar 保持 eager load（首屏关键渲染路径）
 *   - 其余 8 个 section 使用 React.lazy + LazySection（按需懒加载）：
 *     每 section 独立 Suspense + IntersectionObserver，滚动接近视口才挂载，
 *     避免首屏一次性拉取全部 chunk 且互不阻塞
 *   - 不引入新依赖，仅使用 React 内置 lazy/Suspense
 *
 * 布局顺序（v7.2）：
 *   Hero → PainPoints → Features → Pipeline → Algorithms → SocialProof → UseCases → DataSources → Pricing → FAQ → CTA
 */
import { lazy } from 'react';
import SEO from './SEO';
import Navbar from './sections/Navbar';
import Hero from './sections/Hero';
import Footer from './sections/Footer';
import { LazySection } from './shared/LazySection';
import './LandingPage.css';

// ── 懒加载 section 组件 ─────────────────────────────────────────
const PainPoints = lazy(() => import('./sections/PainPoints'));
const Features = lazy(() => import('./sections/Features'));
const Pipeline = lazy(() => import('./sections/Pipeline'));
const Algorithms = lazy(() => import('./sections/Algorithms'));
const SocialProof = lazy(() => import('./sections/SocialProof'));
const UseCases = lazy(() => import('./sections/UseCases'));
const DataSources = lazy(() => import('./sections/DataSources'));
const Pricing = lazy(() => import('./sections/Pricing'));
const FAQ = lazy(() => import('./sections/FAQ'));
const CTABanner = lazy(() => import('./sections/CTABanner'));

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-grid" style={{ background: 'var(--bg-canvas)', color: 'var(--text-primary)' }}>
      <a
        href="#main-content"
        className="lp-skip-link"
        style={{ position: 'absolute', left: '-9999px', top: 0, zIndex: 100 }}
        onFocus={(e) => { e.currentTarget.style.left = '16px'; e.currentTarget.style.top = '16px'; }}
        onBlur={(e) => { e.currentTarget.style.left = '-9999px'; }}
      >
        跳到主要内容
      </a>
      <SEO />
      <Navbar />
      <main id="main-content" tabIndex={-1}>
        <Hero />
        <LazySection><PainPoints /></LazySection>
        <LazySection><Features /></LazySection>
        <LazySection><Pipeline /></LazySection>
        <LazySection><Algorithms /></LazySection>
        <LazySection><SocialProof /></LazySection>
        <LazySection><UseCases /></LazySection>
        <LazySection><DataSources /></LazySection>
        <LazySection><Pricing /></LazySection>
        <LazySection><FAQ /></LazySection>
        <LazySection><CTABanner /></LazySection>
      </main>
      <Footer />
    </div>
  );
}

