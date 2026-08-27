/**
 * Hero 组件 v7 — 专业产品着陆页首屏
 *
 * 设计理念：
 *   - 标题简洁有力，信息层次清晰
 *   - 描述如产品简介，直接传达价值
 *   - 产品预览展示真实界面
 *   - 去所有渐变、发光、脉冲装饰
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ChevronRight, Bell } from 'lucide-react';
import { CountdownBanner } from './LaunchCountdown';
import { Reveal } from '../shared/Reveal';
import { useAuthStore } from '@/stores/auth';
import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/shadcn';

// ── 演示阶段常量 ────────────────────────────────────────────────
const STAGE_DURATION = 2800;
const TOTAL_STAGES = 4;

/** 每个阶段对应的侧边栏激活项索引（0=对话 1=图谱 2=数据库 3=合规） */
const STAGE_SIDEBAR_INDEX: Record<number, number> = { 0: 0, 1: 1, 2: 2, 3: 3 };

// ── 产品预览窗口 ──────────────────────────────────────────────
function ProductPreview({ stage }: { stage: number }) {
  const isQuery    = stage === 0;
  const isLoading  = stage === 1;
  const showResult = stage === 2;
  const showComply = stage === 3;

  return (
    <div className="relative">
      <div
        className="rounded-sm overflow-hidden border border-slate-200"
        style={{ background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
      >
        {/* 标题栏（仿浏览器） */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-200" style={{ background: '#f8fafc' }}>
          <div className="flex gap-1.5">
            <div className="w-2 h-2 rounded-full bg-slate-300" />
            <div className="w-2 h-2 rounded-full bg-slate-300" />
            <div className="w-2 h-2 rounded-full bg-slate-300" />
          </div>
          <div className="flex-1 text-center">
            <span className="text-[10px] text-slate-400 font-mono">rmfood.cn</span>
          </div>
        </div>

        {/* 主体内容 */}
        <div className="flex min-h-[280px]">
          {/* 侧边栏（功能导航） */}
          <div className="w-10 border-r border-slate-200 p-2 flex flex-col gap-2" style={{ background: '#f8fafc' }}>
            {['对话', '图谱', '数据库', '合规'].map((label, i) => (
              <div
                key={label}
                className="w-full h-7 rounded flex items-center justify-center text-[9px] font-medium transition-colors cursor-default"
                style={{
                  background: STAGE_SIDEBAR_INDEX[stage] === i ? '#fff' : 'transparent',
                  color: STAGE_SIDEBAR_INDEX[stage] === i ? '#059669' : '#94a3b8',
                  border: STAGE_SIDEBAR_INDEX[stage] === i ? '1px solid #e2e8f0' : '1px solid transparent',
                  fontSize: 9,
                }}
                onMouseEnter={(e) => {
                  if (STAGE_SIDEBAR_INDEX[stage] !== i) {
                    e.currentTarget.style.background = '#f1f5f9';
                    e.currentTarget.style.color = '#475569';
                  }
                }}
                onMouseLeave={(e) => {
                  if (STAGE_SIDEBAR_INDEX[stage] !== i) {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = '#94a3b8';
                  }
                }}
              >
                {label}
              </div>
            ))}
          </div>

          {/* 对话/分析区域 */}
          <div className="flex-1 p-3 flex flex-col gap-2.5">
            {/* Stage 0: 用户提问 */}
            {isQuery && (
              <div className="flex justify-end">
                <div
                  className="max-w-[85%] px-3 py-2 text-[11px] leading-relaxed rounded-sm"
                  style={{ background: '#0f172a', color: '#f8fafc' }}
                >
                  请帮我设计一款具有抗氧化和增强免疫双重功效的药食同源功能性饮料配方。
                </div>
              </div>
            )}

            {/* Stage 1: 加载中 */}
            {isLoading && (
              <div className="flex flex-col items-center justify-center gap-2 py-8">
                <div className="w-5 h-5 border-2 border-slate-200 border-t-emerald-600 rounded-full animate-spin" />
                <span className="text-[10px] text-slate-400 font-mono">MCTS 搜索中 · 匹配 12,847 条规则</span>
              </div>
            )}

            {/* Stage 2: AI 配方结果 */}
            {showResult && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="w-5 h-5 rounded-sm flex items-center justify-center" style={{ background: '#059669' }}>
                    <span className="text-[9px] text-white font-bold">R</span>
                  </div>
                  <span className="text-[10px] font-medium text-slate-700">推荐配方方案</span>
                  <span className="text-[9px] text-slate-400 font-mono">MCTS 搜索结果</span>
                </div>

                <table className="w-full text-[10px] border-collapse">
                  <thead>
                    <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <th className="text-left py-1.5 px-2 font-semibold text-slate-500">原料</th>
                      <th className="text-center py-1.5 px-2 font-semibold text-slate-500">剂量</th>
                      <th className="text-right py-1.5 px-2 font-semibold text-slate-500">功效</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { name: '枸杞多糖', dose: '3.2 g/d', level: 'high' },
                      { name: '黄芪皂苷', dose: '1.5 g/d', level: 'high' },
                      { name: '茯苓多糖', dose: '2.0 g/d', level: 'medium' },
                    ].map((row, i) => (
                      <tr key={row.name} style={{ borderBottom: i < 2 ? '1px solid #f1f5f9' : 'none' }}>
                        <td className="py-1.5 px-2 font-medium text-slate-800">{row.name}</td>
                        <td className="py-1.5 px-2 text-center font-mono text-slate-500">{row.dose}</td>
                        <td className="py-1.5 px-2 text-right">
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${
                            row.level === 'high' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                          }`}>
                            {row.level === 'high' ? '强效' : '中效'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="flex items-center gap-2 pt-1">
                  <span className="text-[9px] px-2 py-0.5 rounded-sm bg-emerald-50 text-emerald-700 border border-emerald-200">
                    已检测：无配伍禁忌
                  </span>
                  <span className="text-[9px] px-2 py-0.5 rounded-sm bg-blue-50 text-blue-700 border border-blue-200">
                    符合卫健委标准
                  </span>
                </div>
              </div>
            )}

            {/* Stage 3: 合规检查 */}
            {showComply && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-5 h-5 rounded-sm flex items-center justify-center" style={{ background: '#059669' }}>
                    <span className="text-[9px] text-white font-bold">✓</span>
                  </div>
                  <span className="text-[10px] font-medium text-slate-700">合规审查报告</span>
                  <span className="text-[9px] text-slate-400 font-mono">卫健委目录 · 实时</span>
                </div>

                <div className="space-y-1.5">
                  {[
                    { label: '药食同源目录匹配', status: 'pass', detail: '3/3 原料通过' },
                    { label: '配伍禁忌检测',       status: 'pass', detail: '未发现禁忌组合' },
                    { label: '过敏原标注',       status: 'pass', detail: '无致敏风险' },
                    { label: 'GB 标准符合性',    status: 'pass', detail: '符合 GB 2760' },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center justify-between py-1.5 px-2 rounded-sm" style={{ background: '#f8fafc', border: '1px solid #f1f5f9' }}>
                      <span className="text-[10px] text-slate-600">{item.label}</span>
                      <span className="text-[9px] font-medium text-emerald-600 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                        {item.detail}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 输入框 */}
            <div className="mt-auto flex items-center gap-2 pt-2 border-t border-slate-100">
              <div className="flex-1 h-7 rounded-sm flex items-center px-3 text-[10px] text-slate-400" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                {isLoading ? '系统分析中…' : '输入您的研发需求…'}
              </div>
              <div className="w-7 h-7 rounded-sm flex items-center justify-center" style={{ background: '#0f172a' }}>
                <ArrowRight size={12} color="white" />
              </div>
            </div>
          </div>
        </div>

        {/* 底部状态栏 */}
        <div className="flex items-center justify-between px-3 py-1.5 border-t border-slate-200 text-[10px] text-slate-400 font-mono" style={{ background: '#f8fafc' }}>
          <span>
            {isQuery    && '就绪'}
            {isLoading  && '搜索中…'}
            {showResult && '生成完成 · 3 条配方'}
            {showComply && '合规通过'}
          </span>
          <span>最后更新：刚刚</span>
        </div>
      </div>

      {/* 演示进度指示 */}
      <div className="flex items-center justify-center gap-1.5 mt-3">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="w-1.5 h-1.5 rounded-sm transition-all duration-300"
            style={{ background: stage === i ? '#0f172a' : '#e2e8f0' }}
          />
        ))}
      </div>
    </div>
  );
}

// ── 主组件 ──────────────────────────────────────────────────────
export default function Hero() {
  const { isAuthenticated } = useAuthStore();
  const [stage, setStage] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setStage((s) => (s + 1) % TOTAL_STAGES), STAGE_DURATION);
    return () => clearInterval(id);
  }, []);

  return (
    <section className="relative overflow-hidden" style={{ background: '#fff', borderTop: '1px solid #e2e8f0' }}>
      <CountdownBanner />

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-20">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-start">

          {/* 左侧文案 */}
          <div className="max-w-xl pt-4">
            <Reveal>
              {/* 分类标签（学术风格） */}
              <div className="flex items-center gap-2 mb-4">
                <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">RMFOOD</span>
                <span className="text-slate-300">·</span>
                <span className="text-[10px] text-slate-400">药食同源 AI 配方研发平台</span>
              </div>

              {/* 主标题（论文标题风格） */}
              <h1 className="text-[clamp(2.25rem,5vw,3.25rem)] font-bold leading-[1.12] mb-5 tracking-tight text-slate-900" style={{ fontFamily: 'var(--font-sans)' }}>
                让配方研发
                <br />
                <span className="text-slate-600">像对话一样简单</span>
              </h1>

              {/* 副标题 */}
              <p className="text-[15px] leading-relaxed mb-8 text-slate-600 max-w-lg">
                整合 TCMSP、DFBP、知识图谱等五大权威数据源，
                为研发团队提供从原料筛选到合规审查的完整工作流。
              </p>

              {/* CTA 按钮组 */}
              <Reveal delay="lp-reveal-delay-1">
                <div className="flex flex-col sm:flex-row items-start gap-3 mb-10">
                  <Link
                    to="/login"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-sm text-[14px] font-semibold text-white transition-opacity hover:opacity-90"
                    style={{ background: '#0f172a' }}
                  >
                    {isAuthenticated ? '进入工作台' : '立即体验'}
                    <ArrowRight size={13} />
                  </Link>
                  <Dialog>
                <DialogTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md text-[13px] font-medium text-slate-600 transition-colors hover:text-slate-900 hover:bg-slate-50"
                  >
                    <ChevronRight size={14} />
                    预约演示
                  </button>
                </DialogTrigger>
                <DialogContent size="sm">
                  <DialogHeader>
                    <DialogTitle>预约产品演示</DialogTitle>
                    <DialogDescription>留下您的联系方式，我们的顾问将在 24 小时内与您联系，为您安排专属的产品演示。</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-3">
                    <div>
                      <label className="text-[12px] font-medium text-slate-700 mb-1 block">姓名</label>
                      <input className="w-full h-9 px-3 text-[13px] rounded-md border border-slate-200 bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-300" placeholder="请输入您的姓名" />
                    </div>
                    <div>
                      <label className="text-[12px] font-medium text-slate-700 mb-1 block">邮箱</label>
                      <input className="w-full h-9 px-3 text-[13px] rounded-md border border-slate-200 bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-300" placeholder="company@example.com" type="email" />
                    </div>
                    <div>
                      <label className="text-[12px] font-medium text-slate-700 mb-1 block">公司名称</label>
                      <input className="w-full h-9 px-3 text-[13px] rounded-md border border-slate-200 bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-300" placeholder="请输入公司名称" />
                    </div>
                  </div>
                  <DialogFooter>
                    <Link to="/login" className="w-full sm:w-auto"><Button style={{ background: '#0f172a' }}>提交预约</Button></Link>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
                </div>
              </Reveal>

              {/* 信任背书 */}
              <Reveal delay="lp-reveal-delay-2">
                <div className="flex items-center gap-4 text-[12px] text-slate-500">
                  <div className="flex -space-x-1.5">
                    {['#059669', '#2563eb', '#7c3aed', '#d97706'].map((c, i) => (
                      <div key={i} className="w-6 h-6 rounded-md border-2 border-white flex items-center justify-center text-[9px] font-bold text-white" style={{ background: c }}>
                        {['张', '李', '王', '陈'][i]}
                      </div>
                    ))}
                  </div>
                  <span>已有 200+ 研发团队入驻</span>
                </div>
              </Reveal>
            </Reveal>
          </div>

          {/* 右侧产品预览 */}
          <div id="demo-area" className="lg:pl-4">
            <Reveal delay="lp-reveal-delay-1">
              <ProductPreview stage={stage} />
            </Reveal>
          </div>
        </div>
      </div>

      {/* 数据源展示（独立 section，不在 Hero 内） */}
    </section>
  );
}
