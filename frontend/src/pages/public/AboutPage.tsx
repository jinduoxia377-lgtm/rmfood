/**
 * AboutPage — 关于莱茵分子
 */
import PublicLayout from './PublicLayout';
import { Building2, Users, Beaker, Award } from 'lucide-react';

const stats = [
  { icon: Building2, value: '2018', label: '成立年份' },
  { icon: Users, value: '50+', label: '研发团队' },
  { icon: Beaker, value: '128K', label: '知识图谱节点' },
  { icon: Award, value: '6', label: '重点合作院校' },
];

const milestones = [
  { year: '2018', event: '莱茵（厦门）分子生物科技有限公司成立，聚焦药食同源分子机制研究。' },
  { year: '2019', event: '建成 TCMSP 中药材数据库镜像，支持本地化联合查询。' },
  { year: '2021', event: '发布第一代 AI 配方引擎，集成 MCTS 搜索与模拟退火算法。' },
  { year: '2023', event: '完成 128K 节点知识图谱构建，覆盖药材-成分-靶点-疾病全链路。' },
  { year: '2024', event: 'RMFOOD 平台公测上线，首批 200+ 研发团队入驻。' },
  { year: '2025', event: '正式版即将上线，支持多租户协作、私有化部署及 SSO 集成。' },
];

export default function AboutPage() {
  return (
    <PublicLayout>
      {/* Hero */}
      <section style={{ background: '#fff', borderBottom: '1px solid #e2e8f0' }}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest block mb-3">关于我们</span>
          <h1 className="text-[clamp(1.75rem,4vw,2.75rem)] font-bold leading-[1.15] text-slate-900 mb-6">
            解码生命分子<br />赋能科学创新
          </h1>
          <p className="text-[15px] leading-[1.75] text-slate-600 max-w-2xl">
            莱茵（厦门）分子生物科技有限公司（简称"莱茵分子"）是一家专注于药食同源领域的生物信息学与人工智能交叉创新企业。我们融合分子生物学、计算化学与中医药现代化理论，构建从基因到配方的全链路研发平台，致力于让配方研发像对话一样简单。
          </p>
        </div>
      </section>

      {/* 核心数据 */}
      <section style={{ background: '#fafafa' }}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {stats.map((s, i) => {
              const IconComp = s.icon;
              return (
                <div key={i} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '1.25rem' }}>
                  <IconComp size={18} style={{ color: '#059669', marginBottom: 8 }} />
                  <div className="text-2xl font-bold font-mono text-slate-900">{s.value}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">{s.label}</div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 发展历程 */}
      <section style={{ background: '#fff' }}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest block mb-3">发展历程</span>
          <h2 className="text-[1.5rem] font-bold text-slate-900 mb-8">关键里程碑</h2>
          <div className="space-y-0">
            {milestones.map((m, i) => (
              <div key={i} className="flex gap-6 py-5" style={{ borderBottom: i < milestones.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                <span className="text-[13px] font-mono font-semibold w-12 shrink-0 text-slate-400 pt-0.5">{m.year}</span>
                <p className="text-[13px] text-slate-700 leading-relaxed">{m.event}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 使命愿景 */}
      <section style={{ background: '#f8fafc' }}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest block mb-3">使命</span>
              <p className="text-[14px] leading-[1.75] text-slate-700">
                以人工智能驱动药食同源研发创新，降低配方研发门槛，让每一次创新都有据可依、有章可循。
              </p>
            </div>
            <div>
              <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest block mb-3">愿景</span>
              <p className="text-[14px] leading-[1.75] text-slate-700">
                成为全球领先的药食同源数字化研发平台，连接传统智慧与现代科技，加速功能性食品创新进程。
              </p>
            </div>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
