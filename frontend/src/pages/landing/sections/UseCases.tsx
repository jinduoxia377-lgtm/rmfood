/**
 * UseCases 组件 v10 — 学术案例研究风格（升级 v10）
 *
 * 升级要点（v10）：
 *   - 背景色从 #f8fafc 改为 #fff（与 DataSources 区分）
 *   - 去掉"应用场景 X"机械编号，改为场景关键词标签
 *   - 圆角 rounded-sm → rounded-md
 *   - CTA 文案强化
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

/** 场景标签映射：scenario key → 展示标签 */
const SCENARIO_LABELS: Record<Scenario, string> = {
  tcm: '药食同源',
  peptide: '生物活性肽',
  eln: '实验数据管理',
};

function ScenarioCard({ item, index }: { item: (typeof useCases)[0]; index: number }) {
  const [hovered, setHovered] = useState(false);
  const cfg = scenarioConfig[item.scenario as Scenario];
  const IconComp = getIcon(item.icon);

  return (
    <Reveal delay={`lp-reveal-delay-${index + 1}`}>
      <div
        className="lp-card-white relative overflow-hidden transition-all duration-200 cursor-default"
        style={{
          background: hovered ? '#fff' : '#fff',
          border: `1px solid ${hovered ? cfg.primary + '40' : '#e2e8f0'}`,
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* 顶部色条（极简，无渐变） */}
        <div className="h-0.5 w-full" style={{ background: cfg.primary + '50' }} />

        <div className="p-6">
          {/* 场景标识 — 关键词标签替代"应用场景 X" */}
          <div className="flex items-center gap-2.5 mb-4">
            <div
              className="w-8 h-8 rounded-md flex items-center justify-center shrink-0"
              style={{ background: cfg.primaryLight, color: cfg.primary, border: `1px solid ${cfg.primaryBorder}` }}
            >
              <IconComp size={15} strokeWidth={1.8} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <h3 className="text-[14px] font-bold text-slate-900 truncate">{item.title}</h3>
                <span
                  className="shrink-0 lp-label px-2 py-0.5 rounded-md"
                  style={{ background: cfg.primaryLight, color: cfg.primary, border: `1px solid ${cfg.primaryBorder}` }}
                >
                  {SCENARIO_LABELS[item.scenario as Scenario]}
                </span>
              </div>
            </div>
          </div>

          {/* 描述 */}
          <p className="text-[13px] leading-[1.7] text-slate-600 mb-5 min-h-[66px]">
            {item.desc}
          </p>

          {/* 工作流程（如方法学） */}
          <div className="mb-5">
            <div className="lp-caption mb-2.5">
              工作流程
            </div>
            <div className="space-y-3">
              {item.workflow.map((step, i) => (
                <div key={step.label} className="flex items-start gap-2.5">
                  <div
                    className="w-5 h-5 rounded-md flex items-center justify-center lp-tiny font-bold shrink-0 mt-0.5"
                    style={{ background: hovered ? cfg.primaryLight : '#f1f5f9', color: hovered ? cfg.primary : '#475569', border: `1px solid ${cfg.primaryBorder}` }}
                  >
                    {i + 1}
                  </div>
                  <div className="pt-0.5">
                    <div className="lp-label text-slate-800">{step.label}</div>
                    <div className="lp-caption">{step.detail}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 指标数据表 */}
          <div className="mb-5">
            <div className="lp-caption mb-2">
              核心指标
            </div>
            <table className="w-full text-[12px] border-collapse">
              <tbody>
                {item.metrics.map((m, i) => (
                  <tr key={m.label} style={{ borderBottom: i < item.metrics.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                    <td className="py-1 px-2 text-slate-500">{m.label}</td>
                    <td className="py-1 px-2 text-right font-mono font-semibold" style={{ color: '#047857' }}>
                      {m.value}
                      {m.unit && <span className="font-normal text-slate-500 ml-0.5">{m.unit}</span>}
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
                className="w-full inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-md lp-label transition-colors"
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
    <section id="use-cases" className="py-16 lg:py-20" style={{ background: 'var(--bg-canvas, #f8fafc)', borderTop: '1px solid #e2e8f0' }}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* 标题区 */}
        <Reveal>
          <div className="mb-10">
            <span className="lp-section-tag block mb-3">
              {sectionLabel}
            </span>
            <h2 className="lp-h2 mb-3">
              {titleLines.map((line, i) => (
                <span key={i}>{line}{i < titleLines.length - 1 && <br />} </span>
              ))}
            </h2>
            <p className="lp-body-sm max-w-lg text-slate-600">
              {sectionDesc}
            </p>
          </div>
        </Reveal>

        {/* 三场景卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {useCases.map((c, i) => (
            <ScenarioCard key={c.id} item={c} index={i} />
          ))}
        </div>

      </div>
    </section>
  );
}
