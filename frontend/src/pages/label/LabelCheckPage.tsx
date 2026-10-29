/**
 * 配料表核查页面 — C端「配料表核查」MVP
 *
 * 输入配料表文本（OCR 或粘贴），基于公开目录做信息比对，
 * 输出成分分类、过敏原提示与注意事项（信息参考，不构成合规结论）。
 */
import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ScanText,
  ShieldAlert,
  Info,
  AlertTriangle,
  CheckCircle2,
  RotateCcw,
  Sparkles,
  Upload,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, Button, Badge, Textarea } from '@/components/ui';
import { labelCheckApi, type LabelCheckResult } from '@/api/labelCheck';
import { useToast } from '@/components/ui/Toast';

const LEVEL_META: Record<string, { labelKey: string; variant: string; icon: any }> = {
  info: { labelKey: 'pages.labelCheck.levelInfo', variant: 'info', icon: Info },
  note: { labelKey: 'pages.labelCheck.levelNote', variant: 'warning', icon: AlertTriangle },
  warning: { labelKey: 'pages.labelCheck.levelWarning', variant: 'danger', icon: ShieldAlert },
};

export default function LabelCheckPage() {
  const { t } = useTranslation();
  const { addToast } = useToast();
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<LabelCheckResult | null>(null);
  const [ocrText, setOcrText] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCheck = async () => {
    const trimmed = text.trim();
    if (!trimmed) {
      addToast({ type: 'warning', message: t('pages.labelCheck.toastInputRequired') });
      return;
    }
    setLoading(true);
    try {
      const res = await labelCheckApi.checkText(trimmed);
      if (res.success) {
        setResult(res.data);
        setOcrText('');
        addToast({ type: 'success', message: t('pages.labelCheck.toastRecognized', { count: res.data.ingredients.length }) });
      } else {
        addToast({ type: 'error', message: t('pages.labelCheck.toastFailed') });
      }
    } catch (e: any) {
      addToast({ type: 'error', message: String(e?.message ?? e) });
    } finally {
      setLoading(false);
    }
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    try {
      const res = await labelCheckApi.checkOcr(file);
      if (res.success && res.data) {
        setResult(res.data);
        setOcrText(res.ocr_text ?? '');
        addToast({ type: 'success', message: t('pages.labelCheck.toastOcrSuccess', { count: res.data.ingredients.length }) });
      } else {
        addToast({ type: 'warning', message: res.message ?? t('pages.labelCheck.toastOcrUnavailable') });
      }
    } catch (err: any) {
      addToast({ type: 'error', message: String(err?.message ?? err) });
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleReset = () => {
    setText('');
    setOcrText('');
    setResult(null);
  };

  return (
    <div className="space-y-4">
      {/* 欢迎横幅 */}
      <div className="rounded-xl bg-gradient-to-r from-[var(--color-primary-surface)] to-[var(--color-accent-surface)] p-4 sm:p-6 text-white shadow-md">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-white/15 flex items-center justify-center">
            <ScanText className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold">{t('pages.labelCheck.title')}</h1>
            <p className="text-sm text-white/80 mt-1">
              {t('pages.labelCheck.subtitle')}
            </p>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary-600" />
            {t('pages.labelCheck.inputTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t('pages.labelCheck.placeholder')}
            rows={5}
            className="w-full min-h-[120px]"
          />
          <div className="flex items-center gap-3 flex-wrap">
            <Button onClick={handleCheck} loading={loading} disabled={!text.trim()}>
              {t('pages.labelCheck.startCheck')}
            </Button>
            <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={loading}>
              <Upload className="w-4 h-4 mr-1" /> {t('pages.labelCheck.uploadImage')}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              aria-label={t('pages.labelCheck.uploadAria')}
              className="hidden"
              onChange={handleFile}
            />
            <Button variant="ghost" onClick={handleReset} disabled={loading}>
              <RotateCcw className="w-4 h-4 mr-1" /> {t('pages.labelCheck.clear')}
            </Button>
          </div>
          {ocrText && (
            <p className="text-xs text-muted-foreground mt-2">
              {t('pages.labelCheck.ocrText')}{ocrText.length > 120 ? `${ocrText.slice(0, 120)}...` : ocrText}
            </p>
          )}
        </CardContent>
      </Card>

      {result && (
        <>
          {/* 结果摘要 */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex-1 min-w-[240px]">
                  <h3 className="font-semibold flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-success-500" />
                    {t('pages.labelCheck.resultTitle')}
                  </h3>
                  <p className="text-sm mt-1">{result.summary}</p>
                  <p className="text-xs mt-2 text-muted-foreground">{t('pages.labelCheck.reportId', { id: result.report_id })}</p>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {Object.entries(result.category_counts).map(([key, count]) => (
                    <Badge key={key} variant="outline">
                      {key === 'food_homology' ? t('pages.labelCheck.categoryFoodHomology') :
                        key === 'new_food_resource' ? t('pages.labelCheck.categoryNewFood') :
                        key === 'food_additive' ? t('pages.labelCheck.categoryAdditive') :
                        key === 'ordinary_food' ? t('pages.labelCheck.categoryOrdinary') :
                        key === 'nutrition_enricher' ? t('pages.labelCheck.categoryEnricher') :
                        key === 'prohibited' ? t('pages.labelCheck.categoryProhibited') : t('pages.labelCheck.categoryUnknown')} {count}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 成分明细 */}
          <Card>
            <CardHeader>
              <CardTitle>{t('pages.labelCheck.ingredientDetails')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {result.ingredients.map((ing, idx) => {
                const meta = LEVEL_META[ing.level] ?? LEVEL_META.info;
                const Icon = meta.icon;
                return (
                  <div
                    key={`${ing.name}-${idx}`}
                    className={`flex items-start gap-3 p-3 rounded-xl border ${
                      ing.level === 'warning'
                        ? 'border-danger-200 bg-danger-50 dark:bg-danger-900/10'
                        : ing.level === 'note'
                          ? 'border-warning-200 bg-warning-50 dark:bg-warning-900/10'
                          : 'border-border bg-muted/30'
                    }`}
                  >
                    <Icon className={`w-4 h-4 mt-0.5 ${
                      ing.level === 'warning'
                        ? 'text-danger-500'
                        : ing.level === 'note'
                          ? 'text-warning-500'
                          : 'text-info-500'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{ing.name}</span>
                        <Badge variant={meta.variant as "info"|"warning"|"danger"}>{ing.category_label}</Badge>
                        {ing.allergen && (
                          <Badge variant="warning">{t('pages.labelCheck.allergen', { group: ing.allergen_group })}</Badge>
                        )}
                      </div>
                      <p className="text-sm mt-1 text-muted-foreground">{ing.message}</p>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* 免责声明 */}
          <div className="rounded-xl border border-warning-200 bg-warning-50 dark:bg-warning-900/10 p-4 text-xs text-muted-foreground">
            <p className="flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0 text-warning-500" />
              <span>{result.disclaimer}</span>
            </p>
          </div>
        </>
      )}
    </div>
  );
}