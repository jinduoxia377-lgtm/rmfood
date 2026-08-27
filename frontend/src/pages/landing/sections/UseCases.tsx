/**
 * UseCases 组件 v9 — 学术案例研究风格
 *
 * 设计理念：
 *   - 卡片如"Case Study"板块
 *   - 去渐变、去旋转、去流动线
 *   - 工作流如方法学流程图
 *   - 指标如数据表格
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { getIcon } from '../shared/iconFactory';
import { Reveal } from '../shared/Reveal';
import { cn } from '@/lib/utils';
import {
  sectionLabel, sectionTitle, sectionDesc, useCases, scenarioConfig,
} from '../data/useCases';
import type { Scenario } from '../data/useCases';
import { ChevronRight } from 'lucide-react';
import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/shadcn';

function ScenarioCard({ item, index }: { item: (typeof useCases)[0]; index: number }) {
  const [hovered, setHovered] = useState(false);
  const cfg = scenarioConfig[item.scenario as Scenario];
  const IconComp = getIcon(item.icon);

  return (
    <Reveal delay={`lp-reveal-delay-${index + 1}`}>
      <div
        className="relative rounded-sm overflow-hidden transition-all duration-200 cursor-default"
        style={{
          background: hovered ? '#fff' : '#fafafa',
          border: `1px solid ${hovered ? cfg.primary + '40' : '#e2e8f0'}`,
          boxShadow: hovered ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* 顶部色条（极简，无渐变） */}
        <div className="h-0.5 w-full" style={{ background: cfg.primary + '50' }} />

        <div className="p-5">
          {/* 场景标识 */}
          <div className="flex items-center gap-2.5 mb-4">
            <div
              className="w-8 h-8 rounded-sm flex items-center justify-center shrink-0"
              style={{ background: cfg.primaryLight, color: cfg.primary, border: `1px solid ${cfg.primaryBorder}` }}
            >
              <IconComp size={15} strokeWidth={1.8} />
            </div>
            <div>
              <h3 className="text-[14px] font-bold text-slate-900">{item.title}</h3>
              <span className="text-[11px] text-slate-400">应用场景 {index + 1}</span>
            </div>
          </div>

          {/* 描述 */}
          <p className="text-[13px] leading-[1.7] text-slate-600 mb-5 min-h-[66px]">
            {item.desc}
          </p>

          {/* 工作流程（如方法学） */}
          <div className="mb-5">
            <div className="text-[10px] font-mono text-slate-400 uppercase tracking-widest mb-2.5">
            工作流程
            </div>
            <div className="space-y-3">
              {item.workflow.map((step, i) => (
                <div key={step.label} className="flex items-start gap-2.5">
                  <div
                    className="w-5 h-5 rounded-sm flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5"
                    style={{ background: hovered ? cfg.primaryLight : '#f1f5f9', color: hovered ? cfg.primary : '#94a3b8', border: `1px solid ${cfg.primaryBorder}` }}
                  >
                    {i + 1}
                  </div>
                  <div className="pt-0.5">
                    <div className="text-[12px] font-medium text-slate-700">{step.label}</div>
                    <div className="text-[11px] text-slate-400">{step.detail}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 指标数据表 */}
          <div className="mb-5">
            <div className="text-[10px] font-mono text-slate-400 uppercase tracking-widest mb-2">
            核心指标
            </div>
            <table className="w-full text-[11px] border-collapse">
              <tbody>
                {item.metrics.map((m, i) => (
                  <tr key={m.label} style={{ borderBottom: i < item.metrics.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                    <td className="py-1 px-2 text-slate-500">{m.label}</td>
                    <td className="py-1 px-2 text-right font-mono font-semibold" style={{ color: cfg.primary }}>
                      {m.value}
                      {m.unit && <span className="font-normal text-slate-400 ml-0.5">{m.unit}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* CTA */}
          <Dialog>
            <DialogTrigger asChild>
              <button
                type="button"
                className="w-full inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-md text-[12px] font-medium transition-colors"
                style={{
                  background: hovered ? cfg.primaryLight : '#fff',
                  color: cfg.primary,
                  border: `1px solid ${cfg.primaryBorder}`,
                }}
              >
                {item.ctaText}
                <ChevronRight size={12} />
              </button>
            </DialogTrigger>
            <DialogContent size="sm">
              <DialogHeader>
                <DialogTitle>{item.title}</DialogTitle>
                <DialogDescription>{item.desc}</DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Link to="/login" className="w-full sm:w-auto">
                  <Button style={{ background: '#0f172a' }}>立即体验</Button>
                </Link>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </Reveal>
  );
}

export default function UseCases() {
  const titleLines = sectionTitle.split('\n');

  return (
    <section id="use-cases" className="py-20 lg:py-24" style={{ background: '#f8fafc' }}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* 标题区 */}
        <Reveal>
          <div className="mb-10">
            <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest block mb-3">
              {sectionLabel}
            </span>
            <h2 className="text-[clamp(2rem,4.5vw,2.5rem)] font-bold leading-[1.15] mb-3 tracking-tight text-slate-900"
                style={{ fontFamily: 'var(--font-sans)' }}>
              {titleLines.map((line, i) => (
                <span key={i}>{line}{i < titleLines.length - 1 && <br />} </span>
              ))}
            </h2>
            <p className="text-[13px] leading-relaxed max-w-lg text-slate-600">
              {sectionDesc}
            </p>
          </div>
        </Reveal>

        {/* 三场景卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {useCases.map((c, i) => (
            <ScenarioCard key={c.id} item={c} index={i} />
          ))}
        </div>

      </div>
    </section>
  );
}
