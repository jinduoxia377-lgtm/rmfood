/**
 * M1 解析告警展示 — 展示后端 parse_warnings（如未闭合括号、嵌套截断）
 */
import { useTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react';
import type { LabelCheckResult } from '@/api/labelCheck';

export default function ParseWarnings({ result }: { result: LabelCheckResult }) {
  const { t } = useTranslation();
  const warnings = result.parse_warnings ?? [];
  if (warnings.length === 0) return null;

  return (
    <div className="rounded-xl border border-warning-200 bg-warning-50 dark:bg-warning-900/10 p-3">
      <p className="text-sm font-semibold text-warning-700 dark:text-warning-300 flex items-center gap-1">
        <AlertTriangle className="w-3.5 h-3.5" /> {t('pages.labelCheck.parseWarnings')}
      </p>
      <ul className="mt-1 space-y-0.5 list-disc list-inside text-sm text-muted-foreground">
        {warnings.map((w, i) => (
          <li key={i}>{w}</li>
        ))}
      </ul>
    </div>
  );
}
