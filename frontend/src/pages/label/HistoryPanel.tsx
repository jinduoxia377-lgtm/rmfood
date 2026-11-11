/**
 * M5 历史记录 — 侧栏/抽屉展示最近核查记录
 *
 * 仅本地 localStorage，隐私提示明确。支持复查（载入结果）/ 单条删除 / 清空。
 */
import { useTranslation } from 'react-i18next';
import { History, Trash2, RotateCcw, Lock } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, Button, Badge } from '@/components/ui';
import type { LabelCheckHistoryEntry } from './useLabelCheckHistory';

interface HistoryPanelProps {
  history: LabelCheckHistoryEntry[];
  maxEntries: number;
  onRecheck: (entry: LabelCheckHistoryEntry) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
}

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diff = Date.now() - then;
  const min = Math.floor(diff / 60000);
  if (min < 1) return '<1 min';
  if (min < 60) return `${min} min`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} h`;
  return new Date(iso).toLocaleDateString();
}

export default function HistoryPanel({ history, maxEntries, onRecheck, onRemove, onClear }: HistoryPanelProps) {
  const { t } = useTranslation();

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <History className="w-4 h-4" /> {t('pages.labelCheck.historyTitle')}
          <Badge variant="secondary">{history.length}/{maxEntries}</Badge>
        </CardTitle>
        {history.length > 0 && (
          <Button variant="ghost" size="sm" onClick={onClear}>
            <Trash2 className="w-4 h-4 mr-1" /> {t('pages.labelCheck.historyClear')}
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('pages.labelCheck.historyEmpty')}</p>
        ) : (
          history.map(entry => {
            const needsReview = entry.result?.needs_review_count;
            return (
              <div key={entry.id} className="rounded-lg border border-border bg-muted/20 p-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {entry.input.length > 60 ? `${entry.input.slice(0, 60)}...` : entry.input}
                    </p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="text-xs text-muted-foreground">{timeAgo(entry.created_at)}</span>
                      <Badge variant="outline" className="text-xs">
                        {entry.input_type === 'ocr' ? t('pages.labelCheck.historyTypeOcr') : t('pages.labelCheck.historyTypeText')}
                      </Badge>
                      {needsReview != null && (
                        <Badge variant="outline" className="text-xs">
                          {t('pages.labelCheck.needsReviewCount', { count: needsReview })}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="icon" onClick={() => onRecheck(entry)} aria-label={t('pages.labelCheck.historyRecheck')}>
                      <RotateCcw className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => onRemove(entry.id)} aria-label={t('pages.labelCheck.historyDelete')}>
                      <Trash2 className="w-4 h-4 text-danger-500" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })
        )}
        <p className="text-xs text-muted-foreground flex items-center gap-1 pt-1">
          <Lock className="w-3 h-3" /> {t('pages.labelCheck.historyPrivacy')}
        </p>
      </CardContent>
    </Card>
  );
}
