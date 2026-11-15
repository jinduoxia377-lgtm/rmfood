/**
 * Hero 组件 v11 — 专业产品着陆页首屏（性能优化拆分版）
 *
 * 拆分后职责：仅保留主布局逻辑（左右文案 + 产品预览 + 底部指标）。
 * 重交互子组件全部拆出到 sections/preview/：
 *   - ProductPreview   — 产品预览窗口主体（Tab 编排）
 *   - preview/ChatPreview.tsx — 对话预览
 *   - preview/GraphTab.tsx   — 知识图谱
 *   - preview/DataTab.tsx    — 数据看板
 *   - preview/ComplianceTab.tsx — 合规检测
 * 底部指标浮标拆到 sections/HeroMetricsBar.tsx。
 */
import { Link } from 'react-router-dom';
import { ArrowRight, ChevronRight } from 'lucide-react';
import { CountdownBanner } from './LaunchCountdown';
import { Reveal } from '../shared/Reveal';
import { useAuthStore } from '@/stores/auth';
import { testimonials } from '../data/socialProof';
import ProductPreview from './preview/ProductPreview';
import HeroMetricsBar from './HeroMetricsBar';

// ── 主组件 ──────────────────────────────────────────────────────
export default function Hero() {
  const { isAuthenticated } = useAuthStore();

  return (
    <section id="hero" aria-label="平台首屏 — 产品概览与交互式演示" className="lp-grid-bg relative overflow-hidden bg-card pt-[64px]">
      <CountdownBanner />

      <div className="relative z-10 max-w-6xl mx-auto px-[var(--space-apple-md)] sm:px-6 lg:px-8 pt-12 pb-16">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-start">

          {/* 左侧文案 */}
          <div className="max-w-xl pt-[var(--space-apple-md)]">
            <Reveal>
              <div className="flex items-center gap-2 mb-[var(--space-apple-md)]">
                <span className="lp-brand text-primary-main">莱茵分子</span>
                <span className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">·</span>
                <span className="lp-caption">药食同源 AI 配方研发平台</span>
              </div>

              <h1 className="lp-h1 mb-5">
                对话式配方研发
                <br />
                <span className="text-[var(--color-primary-text)]">从想法到配方，一气呵成</span>
              </h1>

              <p className="lp-body mb-8 max-w-lg">
                AI 驱动的配方研发引擎，整合 TCMSP、DFBP 等权威数据源，
                从原料筛选到合规审查全程护航，研发团队研发周期显著缩短。
              </p>

              <Reveal delay="lp-reveal-delay-1">
                <div className="flex flex-col sm:flex-row items-start gap-[var(--space-apple-sm)] mb-10">
                  <Link to="/login" className="lp-cta-primary">
                    {isAuthenticated ? '进入工作台' : '免费开始研发'}
                    <ArrowRight size={14} />
                  </Link>
                  <Link to="#demo-area" className="lp-cta-secondary">
                    <ChevronRight size={14} />
                    产品演示
                  </Link>
                </div>
              </Reveal>

              <Reveal delay="lp-reveal-delay-2">
                <div className="flex items-center gap-[var(--space-apple-sm)] lp-label text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
                  <div className="flex -space-x-1.5">
                    {testimonials.slice(0, 4).map((t, i) => (
                      <div key={i} className="w-6 h-6 rounded-[var(--radius-pill)] border-2 border-white flex items-center justify-center text-[12px] font-bold text-white" style={{ background: t.gradient }}>
                        {t.name[0]}
                      </div>
                    ))}
                  </div>
                  <span>已服务多家研发机构</span>
                </div>
              </Reveal>
            </Reveal>
          </div>

          {/* 右侧产品预览（交互式） */}
          <div id="demo-area" className="lg:pl-4">
            <Reveal delay="lp-reveal-delay-1">
              <ProductPreview />
            </Reveal>
          </div>
        </div>

        <Reveal delay="lp-reveal-delay-2">
          <HeroMetricsBar />
        </Reveal>
      </div>
    </section>
  );
}
