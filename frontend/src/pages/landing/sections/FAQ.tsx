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
import { sectionLabelKey, faqs } from '../data/faqs';
import { useTranslation } from 'react-i18next';

export default function FAQ() {
  const { t } = useTranslation();
  return (
    <section id="faq" aria-label={t('pages.landing.faq.ariaLabel')} className="py-16 lg:py-20 border-t" style={{ background: 'var(--bg-canvas, #f8fafc)', borderColor: 'var(--color-neutral-200, #e2e8f0)' }}>
      <div className="max-w-6xl mx-auto px-[var(--space-apple-md)] sm:px-6 lg:px-8">
        <Reveal>
          <div className="text-center mb-8">
            <div className="lp-faq-accent" />
            <span className="lp-section-tag block mb-[var(--space-apple-sm)]">{t(sectionLabelKey)}</span>
            <h2 className="lp-h2">{t('pages.landing.faq.title')}</h2>
          </div>
        </Reveal>

        <Reveal>
          <Accordion type="multiple" className="space-y-1.5">
            {faqs.map((faq, i) => (
              <AccordionItem key={i} value={`faq-${i}`}
                className="lp-card-hover rounded-[var(--radius-Apple-sm)] transition-all duration-150"
                style={{ background: 'var(--bg-surface-container)', border: '1px solid var(--color-neutral-200, #e2e8f0)' }}
              >
                <AccordionTrigger className="px-[var(--space-apple-md)] py-[var(--space-apple-md)] hover:no-underline">
                  <span className="lp-body font-normal text-left" style={{ color: 'var(--text-primary)' }}>{t(faq.qKey)}</span>
                </AccordionTrigger>
                <AccordionContent className="pb-3">
                  <p className="lp-body leading-[1.7]" style={{ color: 'var(--text-secondary)' }}>{t(faq.aKey)}</p>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </Reveal>
      </div>
    </section>
  );
}
