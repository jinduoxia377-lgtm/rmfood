/**
 * 配料表核查页面 — C端「配料表核查」v2
 *
 * 输入配料表文本（OCR 或粘贴），基于公开目录做信息比对，
 * 输出成分分类、过敏原提示、风险分与注意事项。
 * 合规定位：信息比对参考，不构成合规结论 / 检验报告 / 法律意见；免责声明始终展示。
 */
import { useState, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ScanText, ShieldAlert, CheckCircle2, RotateCcw, Sparkles, Upload,
  Download, FileJson, FileText, History,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, Button, Badge, Textarea } from '@/components/ui';
import { labelCheckApi, type LabelCheckResult } from '@/api/labelCheck';
import { useToast } from '@/components/ui/Toast';
import RiskBoard from './RiskBoard';
import IngredientList from './IngredientList';
import FilterBar from './FilterBar';
import HistoryPanel from './HistoryPanel';
import TemplatePicker from './TemplatePicker';
import ParseWarnings from './ParseWarnings';
import { useLabelCheckHistory } from './useLabelCheckHistory';
import { exportMarkdown, exportJson } from './exportReport';
import { filterIngredients, DEFAULT_FILTERS, type LabelCheckFilters } from './filterLogic';
import type { LabelCheckHistoryEntry } from './useLabelCheckHistory';

export default function LabelCheckPage() {
  const { t } = useTranslation();
  const { addToast } = useToast();
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<LabelCheckResult | null>(null);
  const [ocrText, setOcrText] = useState('');
  const [filters, setFilters] = useState<LabelCheckFilters>(DEFAULT_FILTERS);
  const [showHistory, setShowHistory] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { history, addEntry, removeEntry, clearAll, maxEntries } = useLabelCheckHistory();

  // 历史记录仅在本地保存最近文本，作为下次快速填入的候选（不自动提交）
  const saveLocalDraft = (raw: string) => {
    try {
      window.localStorage.setItem('rmfoodfp.labelCheck.draft', raw);
    } catch {
      // 隐私模式 / 配额限制：忽略
    }
  };

  const acceptResult = (data: LabelCheckResult, input: string, inputType: 'text' | 'ocr') => {
    setResult(data);
    setFilters(DEFAULT_FILTERS);
    addEntry(input, inputType, data);
    saveLocalDraft(input);
  };

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
        acceptResult(res.data, trimmed, 'text');
        setOcrText('');
        addToast({ type: 'success', message: t('pages.labelCheck.toastRecognized', { count: res.data.ingredients.length }) });
      } else {
        addToast({ type: 'error', message: t('pages.labelCheck.toastFailed') });
      }
    } catch (e: unknown) {
      addToast({ type: 'error', message: String((e as Error)?.message ?? e) });
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
        acceptResult(res.data, res.ocr_text ?? file.name, 'ocr');
        setOcrText(res.ocr_text ?? '');
        addToast({ type: 'success', message: t('pages.labelCheck.toastOcrSuccess', { count: res.data.ingredients.length }) });
      } else {
        addToast({ type: 'warning', message: res.message ?? t('pages.labelCheck.toastOcrUnavailable') });
      }
    } catch (err: unknown) {
      addToast({ type: 'error', message: String((err as Error)?.message ?? err) });
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleReset = () => {
    setText('');
    setOcrText('');
    setResult(null);
    setFilters(DEFAULT_FILTERS);
  };

  const handlePickTemplate = (tpl: string) => {
    setText(tpl);
    addToast({ type: 'info', message: t('pages.labelCheck.toastTemplatePicked') });
  };

  // 历史复查：填入输入框并载入结果（不重新请求）
  const handleRecheck = (entry: LabelCheckHistoryEntry) => {
    setText(entry.input);
    setResult(entry.result);
    setFilters(DEFAULT_FILTERS);
    setOcrText(entry.input_type === 'ocr' ? entry.input : '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const filtered = useMemo(
    () => (result ? filterIngredients(result.ingredients, filters) : []),
    [result, filters],
  );

  const categories = useMemo(
    () => (result ? Object.keys(result.category_counts ?? {}) : []),
    [result],
  );

  return (
    <div className="space-y-4">
      {/* 欢迎横幅 — 三色语义：配料表核查非 AI 功能，仅用 Forest Green(primary) 单色系深浅渐变，
          不引入 Bio Purple(accent)。端点用【不参与暗色反转】的 surface 令牌
          (--color-primary-surface / --color-primary-surface-hover)：亮 #047857→#065f46、
          暗 #065f46→#047857，两态均为深绿底白字 ≥5.55:1。阴影按 Elevation 用微阴影 shadow-sm。 */}
      <div className="rounded-xl bg-gradient-to-r from-[var(--color-primary-surface)] to-[var(--color-primary-surface-hover)] p-4 sm:p-6 text-white shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-white/15 flex items-center justify-center">
            <ScanText className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold">{t('pages.labelCheck.title')}</h1>
            {/* 副标题用纯白，保证渐变绿底上 ≥5.5:1（AA）；不用 text-white/80 */}
            <p className="text-sm text-white mt-1">{t('pages.labelCheck.subtitle')}</p>
          </div>
          <Button variant="glass" size="sm" onClick={() => setShowHistory(s => !s)} className="hidden sm:inline-flex">
            <History className="w-4 h-4 mr-1" /> {t('pages.labelCheck.historyToggle')}
          </Button>
        </div>
      </div>

      {/* 输入区 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary-600" />
            {t('pages.labelCheck.inputTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <TemplatePicker onPick={handlePickTemplate} />
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
            <Button variant="ghost" onClick={() => setShowHistory(s => !s)} className="sm:hidden">
              <History className="w-4 h-4 mr-1" /> {t('pages.labelCheck.historyToggle')}
            </Button>
          </div>
          {ocrText && (
            <p className="text-xs text-muted-foreground mt-2">
              {t('pages.labelCheck.ocrText')}{ocrText.length > 120 ? `${ocrText.slice(0, 120)}...` : ocrText}
            </p>
          )}
        </CardContent>
      </Card>

      {/* 历史记录（抽屉式，按需展开） */}
      {showHistory && (
        <HistoryPanel
          history={history}
          maxEntries={maxEntries}
          onRecheck={handleRecheck}
          onRemove={removeEntry}
          onClear={clearAll}
        />
      )}

      {result && (
        <>
          {/* 解析告警 */}
          <ParseWarnings result={result} />

          {/* 结果摘要 */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex-1 min-w-[240px]">
                  <h3 className="font-semibold flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-success-600" />
                    {t('pages.labelCheck.resultTitle')}
                  </h3>
                  <p className="text-[15px] mt-1">{result.summary}</p>
                  <p className="text-xs mt-2 text-muted-foreground">{t('pages.labelCheck.reportId', { id: result.report_id })}</p>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {Object.entries(result.category_counts ?? {}).map(([key, count]) => (
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
              {/* 导出 */}
              <div className="flex items-center gap-2 mt-4 pt-4 border-t border-border flex-wrap">
                <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <Download className="w-3.5 h-3.5" /> {t('pages.labelCheck.exportTitle')}
                </span>
                <Button variant="outline" size="sm" onClick={() => exportMarkdown(result)}>
                  <FileText className="w-4 h-4 mr-1" /> {t('pages.labelCheck.exportMarkdown')}
                </Button>
                <Button variant="outline" size="sm" onClick={() => exportJson(result)}>
                  <FileJson className="w-4 h-4 mr-1" /> {t('pages.labelCheck.exportJson')}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* M3 风险看板 */}
          <RiskBoard result={result} />

          {/* M8 过滤 / 搜索 + M4 成分明细 */}
          <Card>
            <CardHeader>
              <CardTitle>{t('pages.labelCheck.ingredientDetails')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FilterBar
                filters={filters}
                onChange={setFilters}
                categories={categories}
                shown={filtered.length}
                total={result.ingredients.length}
              />
              <IngredientList ingredients={filtered} />
            </CardContent>
          </Card>

          {/* 免责声明（始终展示）— 合规红线文本，用 14px 保证可读性 */}
          <div className="rounded-xl border border-warning-200 bg-warning-50 dark:bg-warning-900/10 p-4 text-sm text-muted-foreground">
            <p className="flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0 text-warning-600 dark:text-warning-500" />
              <span>{result.disclaimer ?? t('pages.labelCheck.disclaimerFallback')}</span>
            </p>
          </div>
        </>
      )}

      {/* 未核查时也始终展示免责声明（合规红线：不可省略） */}
      {!result && (
        <div className="rounded-xl border border-warning-200 bg-warning-50 dark:bg-warning-900/10 p-4 text-sm text-muted-foreground">
          <p className="flex items-start gap-2">
            <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0 text-warning-600 dark:text-warning-500" />
            <span>{t('pages.labelCheck.disclaimerFallback')}</span>
          </p>
        </div>
      )}
    </div>
  );
}
