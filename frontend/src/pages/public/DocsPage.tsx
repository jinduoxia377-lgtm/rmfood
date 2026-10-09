/**
 * DocsPage — 使用文档
 */
import PublicLayout from './PublicLayout';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/shadcn';

const sections = [
  {
    title: '快速开始',
    items: [
      { q: '如何注册账号？', a: '访问 http://rmfood.cn 点击"免费注册"，使用邮箱或手机号完成注册。科研版永久免费，无需信用卡。' },
      { q: '首次使用需要哪些准备？', a: '注册成功后进入工作台，建议先浏览"配方管理"和"AI 配方对话"两个核心模块。系统提供新手引导教程，约 10 分钟可完成入门。' },
      { q: '是否支持中文界面？', a: '完全支持。RMFOOD 全平台采用中文界面，所有术语均基于药食同源行业标准用语。' },
    ],
  },
  {
    title: 'AI 配方对话',
    items: [
      { q: 'AI 对话支持哪些大模型？', a: '支持 DeepSeek、GPT-4、智谱 GLM-4、通义千问等主流大模型，可在设置中切换端点并配置 API Key。' },
      { q: 'AI 生成的配方可信吗？', a: 'AI 配方基于 TCMSP、DFBP 等权威数据库生成，每条建议均附数据来源。建议结合实验验证使用。' },
      { q: '如何导出 AI 分析结果？', a: '对话结果支持 DOCX、PDF 格式导出，包含完整的配方说明、剂量建议和参考文献。' },
    ],
  },
  {
    title: '知识图谱',
    items: [
      { q: '知识图谱覆盖哪些数据？', a: '整合 TCMSP（29,361味中药材）、DFBP（5,200+ 活性肽）、Neo4j 跨库知识图谱（128K 实体节点），覆盖药材-成分-靶点-疾病全链路关联。' },
      { q: '如何使用图谱查询？', a: '在"图谱"模块输入药材或成分名称，系统将展示其关联网络，支持多维度筛选（功效、靶点、毒性等）。' },
    ],
  },
  {
    title: '合规引擎',
    items: [
      { q: '合规检测的范围是什么？', a: '实时对接卫健委药食同源目录（130+ 条目）、食品安全国家标准（GB 2760/GB 14880/GB 28050 等），检测配伍禁忌与过敏原风险。' },
      { q: '检测频率是多久同步一次？', a: '法规库实时同步卫健委及国家标准委最新公告，确保检测结果始终基于最新版本。' },
    ],
  },
  {
    title: '团队协作',
    items: [
      { q: '团队版本有何区别？', a: '专业版支持 ≤10 人协作，企业版支持多租户组织架构、SSO/LDAP 集成和私有化部署。' },
      { q: '数据是否安全隔离？', a: '采用多租户行级隔离架构，AES-256 加密存储，TLS 传输加密，完整审计日志，满足 GLP 合规要求。' },
    ],
  },
];

export default function DocsPage() {
  return (
    <PublicLayout>
      <section style={{ background: '#fff', borderBottom: '1px solid #e2e8f0' }}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <span className="text-xs font-mono text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] uppercase tracking-widest block mb-3">使用文档</span>
          <h1 className="text-[clamp(1.75rem,4vw,2.5rem)] font-bold leading-[1.15] text-slate-900 mb-4">帮助文档</h1>
          <p className="text-[14px] text-slate-600 leading-relaxed max-w-xl">
            从快速入门到高级功能，覆盖 AI 配方对话、知识图谱、合规检测、团队协作等核心模块的使用方法。
          </p>
        </div>
      </section>

      <section style={{ background: '#fafafa' }}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          {sections.map((sec, si) => (
            <div key={si} className="mb-10 last:mb-0">
              <h2 className="text-[13px] font-semibold uppercase tracking-wider mb-4 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">{sec.title}</h2>
              <Accordion type="multiple" defaultValue={[`${si}-0`]} className="space-y-1.5">
                {sec.items.map((item, ii) => (
                  <AccordionItem key={ii} value={`${si}-${ii}`} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                    <AccordionTrigger className="px-4 py-3 hover:no-underline">
                      <span className="text-[13px] font-normal text-left text-slate-800">{item.q}</span>
                    </AccordionTrigger>
                    <AccordionContent className="pb-3">
                      <p className="text-[13px] leading-[1.7] text-slate-600">{item.a}</p>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          ))}
        </div>
      </section>
    </PublicLayout>
  );
}
