/**
 * CareersPage — 加入我们
 */
import PublicLayout from './PublicLayout';
import { MapPin, Clock, DollarSign } from 'lucide-react';

const openings = [
  {
    title: '高级 AI 工程师',
    department: '技术研发中心',
    location: '厦门',
    type: '全职',
    desc: '负责 MCTS 搜索算法优化、多模型混合推理架构设计，以及知识图谱推理引擎的迭代升级。',
    requirements: ['3年以上 NLP/推荐系统经验', '熟悉 PyTorch / Transformers', '有医药或生物信息学背景者优先'],
  },
  {
    title: '中医药数据工程师',
    department: '数据平台组',
    location: '厦门',
    type: '全职',
    desc: '负责 TCMSP、DFBP 等权威数据库的本地化部署、Cypher 查询优化及实体关系抽取。',
    requirements: ['熟悉 Neo4j / Cypher', '了解中医药基础理论', '有数据清洗 ETL 经验'],
  },
  {
    title: '产品经理（研发工具方向）',
    department: '产品部',
    location: '厦门',
    type: '全职',
    desc: '负责 RMFOOD 平台的用户需求调研、功能规划及跨团队协作，推动产品迭代与商业化落地。',
    requirements: ['2年以上 B 端产品经理经验', '对 AI+生物领域有浓厚兴趣', '具备良好的数据分析能力'],
  },
  {
    title: 'UI/UX 设计师',
    department: '设计团队',
    location: '厦门（可远程）',
    type: '全职 / 兼职',
    desc: '负责平台交互设计与视觉系统建设，提升研发人员的使用体验与工作效率。',
    requirements: ['3年以上 B 端产品设计经验', '熟练使用 Figma', '有数据密集型工具设计经验者优先'],
  },
];

export default function CareersPage() {
  return (
    <PublicLayout>
      {/* Hero */}
      <section style={{ background: '#fff', borderBottom: '1px solid #e2e8f0' }}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <span className="text-xs font-mono text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] uppercase tracking-widest block mb-3">加入我们</span>
          <h1 className="text-[clamp(1.75rem,4vw,2.75rem)] font-bold leading-[1.15] text-neutral-900 mb-6">
            与最优秀的人<br />一起做最有意义的事
          </h1>
          <p className="text-[15px] leading-[1.75] text-neutral-600 max-w-2xl">
            莱茵分子是一家深度融合中医药智慧与人工智能的创新企业。我们在厦门拥有 50+ 人的研发团队，与全国 6 所重点中医药院校及 Top 50 药企建立合作。如果你渴望用技术改变研发范式，欢迎加入我们。
          </p>
        </div>
      </section>

      {/* 在莱茵工作 */}
      <section style={{ background: '#fafafa' }}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <h2 className="text-sm font-semibold uppercase tracking-wider mb-6 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">在莱茵分子工作</h2>
          <div className="grid sm:grid-cols-3 gap-4">
            {[
              { title: '跨学科团队', desc: '来自中医药、计算生物学、AI 等领域的专业人士共同协作。' },
              { title: '学术氛围', desc: '与高校联合研究，鼓励发表高水平论文与技术报告。' },
              { title: '成长空间', desc: '扁平化管理，快速决策，每一位成员都有明确的成长路径。' },
            ].map((item, i) => (
              <div key={i} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '1.25rem' }}>
                <h3 className="text-sm font-semibold text-neutral-800 mb-2">{item.title}</h3>
                <p className="text-[12px] text-neutral-600 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 开放职位 */}
      <section style={{ background: '#fff' }}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <h2 className="text-sm font-semibold uppercase tracking-wider mb-6 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">开放职位</h2>
          <div className="space-y-3">
            {openings.map((job, i) => (
              <div key={i} style={{ border: '1px solid #e2e8f0', borderRadius: '6px', overflow: 'hidden' }}>
                <div className="px-5 py-4 flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-[14px] font-semibold text-neutral-900">{job.title}</h3>
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">{job.department}</span>
                      <span className="text-neutral-300 dark:text-neutral-500">·</span>
                      <span className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] flex items-center gap-1"><MapPin size={11} />{job.location}</span>
                      <span className="text-neutral-300 dark:text-neutral-500">·</span>
                      <span className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">{job.type}</span>
                    </div>
                  </div>
                  <button className="shrink-0 text-[12px] font-medium px-4 py-2 rounded-md border transition-colors"
                    style={{ borderColor: '#e2e8f0', color: '#475569' }}
                    onClick={(e) => {
                      const req = (e.currentTarget as HTMLButtonElement).nextElementSibling;
                      if (req) req.classList.toggle('hidden');
                    }}
                  >
                    查看详情
                  </button>
                </div>
                <div className="hidden px-5 pb-4">
                  <p className="text-[12px] text-neutral-600 leading-relaxed mb-3">{job.desc}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {job.requirements.map(r => (
                      <span key={r} className="text-xs px-2 py-0.5 rounded-sm" style={{ background: '#f1f5f9', color: '#64748b', border: '1px solid #e2e8f0' }}>{r}</span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ background: '#0f172a' }}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center">
          <h2 className="text-[1.25rem] font-bold text-white mb-3">没有找到合适的职位？</h2>
          <p className="text-sm text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mb-6 max-w-md mx-auto">
            我们持续关注优秀人才。请将简历发送至 contact@rmfood.cn，我们会在收到后 5 个工作日内回复。
          </p>
          <a href="mailto:contact@rmfood.cn" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md text-sm font-semibold text-neutral-900 transition-opacity hover:opacity-90" style={{ background: '#fff' }}>
            发送邮件
          </a>
        </div>
      </section>
    </PublicLayout>
  );
}
