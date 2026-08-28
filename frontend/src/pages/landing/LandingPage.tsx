/**
 * RMFOOD 公官网着陆页 — 模块化编排器 v6.0
 *
 * 架构：
 *   sections/  → 各业务区块组件（独立、可单独测试）
 *   data/      → 纯数据配置（文案/列表/定价，修改无需改组件逻辑）
 *   shared/    → 共享 hook 与工具（useReveal, Reveal, iconFactory）
 *   LandingPage.css → 区块共享样式
 *
 * 此文件仅为编排层，不承载业务逻辑。
 *
 * 布局顺序（v6）：
 *   Hero → Features → SocialProof → UseCases → DataSources → Pricing → FAQ → CTA
 */
import Navbar from './sections/Navbar';
import Hero from './sections/Hero';
import Features from './sections/Features';
import SocialProof from './sections/SocialProof';
import UseCases from './sections/UseCases';
import DataSources from './sections/DataSources';
import Pricing from './sections/Pricing';
import FAQ from './sections/FAQ';
import CTABanner from './sections/CTABanner';
import Footer from './sections/Footer';
import './LandingPage.css';

export default function LandingPage() {
  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-canvas)', color: 'var(--text-primary)' }}>
      <Navbar />
      <main>
        <Hero />
        <Features />
        <SocialProof />
        <UseCases />
        <DataSources />
        <Pricing />
        <FAQ />
        <CTABanner />
      </main>
      <Footer />
    </div>
  );
}
