/**
 * FAQ 组件 v5 — 学术问答风格（升级 v5）
 *
 * 升级要点（v5）：
 *   - max-w-4xl → max-w-6xl，与其他 section 对齐
 *   - 默认全部折叠
 *   - 标题优化
 */
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/shadcn';
import { Reveal } from '../shared/Reveal';
import { sectionLabel, faqs } from '../data/faqs';

export default function FAQ() {
  return (
    <section id="faq" className="py-16 lg:py-20 border-t lp-grid-bg" style={{ background: '#fff', borderTop: '3px solid #059669' }}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <Reveal>
          <div className="text-center mb-8">
            <span className="lp-section-tag block mb-3">{sectionLabel}</span>
            <h2 className="lp-h2">常见问题</h2>
          </div>
        </Reveal>

        <Reveal>
          <Accordion type="multiple" className="space-y-1.5">
            {faqs.map((faq, i) => (
              <AccordionItem key={i} value={`faq-${i}`}
                className="rounded-md transition-all duration-150"
                style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '4px' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = '#cbd5e1'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = '#e2e8f0'}
              >
                <AccordionTrigger className="px-4 py-3 hover:no-underline">
                  <span className="lp-body font-medium text-left text-slate-800">{faq.q}</span>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-3">
                  <p className="lp-body leading-[1.7] text-slate-600">{faq.a}</p>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </Reveal>
      </div>
    </section>
  );
}
