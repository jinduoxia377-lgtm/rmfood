/**
 * M7 示例模板 — 从 /templates 拉取，一键填入输入框
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FileText } from 'lucide-react';
import { Button, Badge, Skeleton } from '@/components/ui';
import { labelCheckApi, type LabelCheckTemplate } from '@/api/labelCheck';

interface TemplatePickerProps {
  onPick: (text: string) => void;
}

export default function TemplatePicker({ onPick }: TemplatePickerProps) {
  const { t } = useTranslation();
  const [templates, setTemplates] = useState<LabelCheckTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // loading 初始为 true，effect 内不再同步 setState（避免级联渲染）
    labelCheckApi.getTemplates()
      .then(res => {
        if (cancelled) return;
        setTemplates(Array.isArray(res?.templates) ? res.templates : []);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <FileText className="w-3.5 h-3.5" /> {t('pages.labelCheck.templatesTitle')}
      </div>
      {loading && (
        <div className="flex gap-2 flex-wrap">
          <Skeleton className="h-9 w-40" />
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-9 w-36" />
        </div>
      )}
      {!loading && error && (
        <p className="text-xs text-muted-foreground">{t('pages.labelCheck.templatesError')}</p>
      )}
      {!loading && !error && templates.length === 0 && (
        <p className="text-xs text-muted-foreground">{t('pages.labelCheck.templatesEmpty')}</p>
      )}
      {!loading && templates.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {templates.map(tpl => (
            <Button key={tpl.id} variant="outline" size="sm" onClick={() => onPick(tpl.text)} title={tpl.description}>
              <Badge variant="secondary" className="mr-1 text-xs">{tpl.tag}</Badge>
              {tpl.name}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
