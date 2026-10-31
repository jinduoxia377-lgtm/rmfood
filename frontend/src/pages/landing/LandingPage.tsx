/**
 * 莱茵分子 公官网着陆页 — 模块化编排器 v7.0
 *
 * 架构：
 *   sections/  → 各业务区块组件（独立、可单独测试）
 *   data/      → 纯数据配置（文案/列表/定价，修改无需改组件逻辑）
 *   shared/    → 共享 hook 与工具（useReveal, Reveal, iconFactory）
 *   LandingPage.css → 区块共享样式
 *
 * 此文件仅为编排层，不承载业务逻辑。
 *
 * 性能优化（v7.0）：
 *   - Hero + Navbar 保持 eager load（首屏关键渲染路径）
 *   - 其余 8 个 section 使用 React.lazy 懒加载，Suspense fallback 为简洁骨架屏
 *   - 不引入新依赖，仅使用 React 内置 lazy/Suspense
 *
 * 布局顺序（v7）：
 *   Hero → Features → Algorithms → SocialProof → UseCases → DataSources → Pricing → FAQ → CTA
 */
import { lazy, Suspense } from 'react';
import SEO from './SEO';
import Navbar from './sections/Navbar';
import Hero from './sections/Hero';
import Footer from './sections/Footer';
import './LandingPage.css';

// ── 懒加载 section 组件 ─────────────────────────────────────────
const Features = lazy(() => import('./sections/Features'));
const Algorithms = lazy(() => import('./sections/Algorithms'));
const SocialProof = lazy(() => import('./sections/SocialProof'));
const UseCases = lazy(() => import('./sections/UseCases'));
const DataSources = lazy(() => import('./sections/DataSources'));
const Pricing = lazy(() => import('./sections/Pricing'));
const FAQ = lazy(() => import('./sections/FAQ'));
const CTABanner = lazy(() => import('./sections/CTABanner'));

// ── 骨架屏占位 ─────────────────────────────────────────────────
function SectionFallback() {
  return (
    <div
      style={{
        minHeight: '60vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div className="lp-suspense-spinner" />
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-grid" style={{ background: 'var(--bg-canvas)', color: 'var(--text-primary)' }}>
      <SEO />
      <Navbar />
      <main>
        <Hero />
        <Suspense fallback={<SectionFallback />}>
          <Features />
          <Algorithms />
          <SocialProof />
          <UseCases />
          <DataSources />
          <Pricing />
          <FAQ />
          <CTABanner />
        </Suspense>
      </main>
      <Footer />
    </div>
  );
}
