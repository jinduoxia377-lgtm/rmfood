/**
 * FaqsPage — 常见问题独立页面
 */
import PublicLayout from './PublicLayout';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/shadcn';

const faqs = [
  { q: 'RMFOOD 适合哪些用户？', a: '食品科学研究人员、药食同源产品研发工程师、保健品企业研发团队及中医药院校师生。无论您是个人研究者还是企业团队，都能找到合适的方案。' },
  { q: '数据安全如何保障？', a: '采用 AES-256 加密存储、RBAC 五级权限控制、多租户行级数据隔离、TLS 传输加密，并保留完整操作审计日志，满足 GLP 合规要求。' },
  { q: 'AI 引擎的工作原理是什么？', a: '整合 MCTS（蒙特卡洛树搜索）与模拟退火算法，在 TCMSP 数据库与 Neo4j 知识图谱的基础上，于安全约束下自动搜索最优配方组合，支持梯度下降求解器。' },
  { q: 'AI 生成的配方有多可靠？', a: 'AI 配方基于权威数据库（TCMSP、DFBP 等）生成，每条建议均附数据来源和安全性评分。建议作为研发辅助工具，最终方案需结合实验验证。' },
  { q: '是否支持私有化部署？', a: '企业版提供私有化部署选项，可完整部署至自有服务器，支持 SSO/LDAP 集成、SLA 99.9% 保障及定制化开发服务。请联系销售团队获取方案。' },
  { q: '科研版免费，有哪些限制？', a: '科研版免费且永久有效，限制包括：每个账号最多 3 个配方项目、每日 20 次 AI 对话、仅支持 TCMSP 中药材检索。升级专业版可解除所有限制。' },
  { q: '如何升级套餐？', a: '在"工作台 → 设置 → 订阅管理"中可随时升级或降级套餐。年付方案享 17% 折扣，升级即时生效，差价按剩余天数折算。' },
  { q: '是否提供技术支持？', a: '专业版用户享邮件优先支持（24 小时内响应），企业版用户享 7×24 专属技术支持及 SLA 保障。常见问题也可在本文档或 FAQ 中找到答案。' },
];

export default function FaqsPage() {
  return (
    <PublicLayout>
      <section style={{ background: '#fff', borderBottom: '1px solid #e2e8f0' }}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest block mb-3">FAQ</span>
          <h1 className="text-[clamp(1.75rem,4vw,2.5rem)] font-bold leading-[1.15] text-slate-900 mb-4">常见问题</h1>
          <p className="text-[14px] text-slate-600 leading-relaxed max-w-xl">
            关于产品功能、数据安全、定价方案及技术支持的常见问题解答。
          </p>
        </div>
      </section>

      <section style={{ background: '#fafafa' }}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <Accordion type="multiple" defaultValue={['0']} className="space-y-1.5">
            {faqs.map((faq, i) => (
              <AccordionItem key={i} value={`faq-${i}`} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                <AccordionTrigger className="px-4 py-3 hover:no-underline">
                  <span className="text-[13px] font-medium text-left text-slate-800">{faq.q}</span>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-3">
                  <p className="text-[13px] leading-[1.7] text-slate-600">{faq.a}</p>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>

          <div className="mt-10 p-5 rounded-sm" style={{ background: '#fff', border: '1px solid #e2e8f0' }}>
            <p className="text-[13px] font-medium text-slate-700 mb-1">还有疑问？</p>
            <p className="text-[12px] text-slate-500">请联系我们的支持团队，或通过 <a href="mailto:contact@rmfood.cn" className="text-emerald-600 hover:underline">contact@rmfood.cn</a> 发送邮件。</p>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
