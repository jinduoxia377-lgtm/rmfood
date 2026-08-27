/**
 * FAQ 组件 v3 — 学术问答风格（多选模式）
 */
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/shadcn';
import { Reveal } from '../shared/Reveal';
import { sectionLabel, faqs } from '../data/faqs';

export default function FAQ() {
  return (
    <section id="faq" className="py-16 lg:py-20" style={{ background: '#f8fafc' }}>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <Reveal>
          <div className="text-center mb-8">
            <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest block mb-3">{sectionLabel}</span>
            <h2 className="text-xl lg:text-[1.5rem] font-bold text-slate-900">关于平台 · 常见问题</h2>
          </div>
        </Reveal>

        <Reveal>
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
        </Reveal>
      </div>
    </section>
  );
}
