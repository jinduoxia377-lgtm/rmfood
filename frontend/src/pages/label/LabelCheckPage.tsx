/**
 * 配料表核查页面 — C端「配料表核查」MVP
 *
 * 输入配料表文本（OCR 或粘贴），基于公开目录做信息比对，
 * 输出成分分类、过敏原提示与注意事项（信息参考，不构成合规结论）。
 */
import { useState, useRef } from 'react';
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

const LEVEL_META: Record<string, { label: string; variant: string; icon: any }> = {
  info: { label: '提示', variant: 'info', icon: Info },
  note: { label: '注意', variant: 'warning', icon: AlertTriangle },
  warning: { label: '警示', variant: 'danger', icon: ShieldAlert },
};

export default function LabelCheckPage() {
  const { addToast } = useToast();
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<LabelCheckResult | null>(null);
  const [ocrText, setOcrText] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCheck = async () => {
    const trimmed = text.trim();
    if (!trimmed) {
      addToast({ type: 'warning', message: '请输入配料表内容' });
      return;
    }
    setLoading(true);
    try {
      const res = await labelCheckApi.checkText(trimmed);
      if (res.success) {
        setResult(res.data);
        setOcrText('');
        addToast({ type: 'success', message: `已识别 ${res.data.ingredients.length} 项配料` });
      } else {
        addToast({ type: 'error', message: '核查失败，请稍后重试' });
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
        addToast({ type: 'success', message: `OCR 识别成功，共 ${res.data.ingredients.length} 项配料` });
      } else {
        addToast({ type: 'warning', message: res.message ?? 'OCR 识别不可用，请粘贴文本' });
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
      <div className="rounded-xl bg-gradient-to-r from-[var(--color-primary-surface)] to-[var(--color-accent-surface)] p-6 text-white shadow-md">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-white/15 flex items-center justify-center">
            <ScanText className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold">配料表核查</h1>
            <p className="text-sm text-white/80 mt-1">
              粘贴或扫描配料表文本，基于药食同源目录 / GB 2760 / GB 14880 等公开标准做信息比对
            </p>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary-600" />
            输入配料表
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={'例如：\n配料：水、白砂糖、植脂末（葡萄糖浆、氢化植物油）、山梨酸钾、小麦粉'}
            rows={5}
            className="w-full min-h-[120px]"
          />
          <div className="flex items-center gap-3 flex-wrap">
            <Button onClick={handleCheck} loading={loading} disabled={!text.trim()}>
              开始核查
            </Button>
            <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={loading}>
              <Upload className="w-4 h-4 mr-1" /> 上传图片识别
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              aria-label="上传配料表图片"
              className="hidden"
              onChange={handleFile}
            />
            <Button variant="ghost" onClick={handleReset} disabled={loading}>
              <RotateCcw className="w-4 h-4 mr-1" /> 清空
            </Button>
          </div>
          {ocrText && (
            <p className="text-xs text-muted-foreground mt-2">
              OCR 识别文本：{ocrText.length > 120 ? `${ocrText.slice(0, 120)}...` : ocrText}
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
                    核查结果
                  </h3>
                  <p className="text-sm mt-1">{result.summary}</p>
                  <p className="text-xs mt-2 text-muted-foreground">报告编号：{result.report_id}</p>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {Object.entries(result.category_counts).map(([key, count]) => (
                    <Badge key={key} variant="outline">
                      {key === 'food_homology' ? '药食同源' :
                        key === 'new_food_resource' ? '新食品原料' :
                        key === 'food_additive' ? '添加剂' :
                        key === 'ordinary_food' ? '常规原料' :
                        key === 'nutrition_enricher' ? '营养强化' :
                        key === 'prohibited' ? '禁用/风险' : '未收录'} {count}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 成分明细 */}
          <Card>
            <CardHeader>
              <CardTitle>成分明细</CardTitle>
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
                        <Badge variant={meta.variant as any}>{ing.category_label}</Badge>
                        {ing.allergen && (
                          <Badge variant="warning">过敏原：{ing.allergen_group}</Badge>
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