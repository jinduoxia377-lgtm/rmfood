/**
 * 食品原料专家审校面板
 *
 * 供 admin/formulator 系统录入并审校安全关键字段：
 * - interactions（相互作用，List[str]）
 * - contraindications（禁忌，List[str]）
 * - 可选：origin_countries / msds_url / coa_url
 *
 * 原则：
 * - **不伪造**：表单严格以详情接口返回的当前值为初值，空的就是空的，等专家录入。
 * - **非破坏**：partial update，只提交改动的字段（后端 FoodMaterialUpdate exclude_unset）。
 * - **来源标注**：后端 interactions/contraindications 为 List[str]，来源以
 *   「（来源：X）」后缀拼进条目字符串，不改变数组类型。
 *
 * 提交：PUT /databases/food-materials/:id（axios Cookie 认证 + CSRF 自动注入）。
 */
import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  Button, Input, Badge, useToast,
} from '@/components/ui';
import {
  Plus, Trash2, ShieldCheck, Save, Info, AlertTriangle,
} from 'lucide-react';
import {
  getFoodMaterial,
  updateFoodMaterial,
  type FoodMaterialDetail,
  type FoodMaterialReviewUpdate,
} from '../../../api/searchNew';
import { useAuthStore } from '@/stores/auth';
import { logger } from '@/utils/safeLogger';

interface FoodMaterialReviewPanelProps {
  open: boolean;
  materialId: number | null;
  onClose: () => void;
  /** 保存成功后回调（父组件可据此刷新详情） */
  onSaved?: () => void;
}

/** 来源可选值（拼进条目字符串，不改变 List[str] 类型） */
const SOURCES = ['本草', '药典', '文献', '专家经验', '其他'] as const;

/** 安全地从 detail 取字符串数组（interactions/contraindications 嵌套在 safety 下） */
function toArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((v) => (typeof v === 'string' ? v : v == null ? '' : String(v)))
      .filter((s) => s.trim() !== '');
  }
  return [];
}

/** 数组是否完全相同（用于 dirty 比对） */
function sameArray(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

/** 列表编辑器：每条一个可编辑 Input + 删除按钮；底部添加行（可标来源） */
const StringListEditor: React.FC<{
  label: string;
  hint: string;
  items: string[];
  onChange: (next: string[]) => void;
}> = ({ label, hint, items, onChange }) => {
  const [draft, setDraft] = useState('');
  const [source, setSource] = useState<string>('');

  const addItem = () => {
    const text = draft.trim();
    if (!text) return;
    const suffix = source ? `（来源：${source}）` : '';
    // 避免重复追加同一来源标记
    const composed = suffix && !text.includes('（来源：') ? `${text}${suffix}` : text;
    onChange([...items, composed]);
    setDraft('');
    setSource('');
  };

  const updateItem = (idx: number, value: string) => {
    const next = items.slice();
    next[idx] = value;
    onChange(next);
  };

  const removeItem = (idx: number) => {
    const next = items.slice();
    next.splice(idx, 1);
    onChange(next);
  };

  return (
    <div className="mb-[var(--space-apple-md)]">
      <div className="flex items-center justify-between mb-1">
        <label className="text-sm font-semibold">{label}</label>
        <span className="text-xs text-muted-foreground">{items.length} 条</span>
      </div>
      <div className="text-[11px] text-muted-foreground mb-2">{hint}</div>

      {/* 现有条目（可编辑 / 可删除） */}
      {items.length === 0 ? (
        <div className="text-xs text-muted-foreground rounded-[var(--radius-Apple-sm)] border border-dashed border-border p-[var(--space-apple-sm)] mb-2">
          暂无内容，等待专家录入
        </div>
      ) : (
        <div className="space-y-2 mb-2">
          {items.map((item, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <Input
                value={item}
                onChange={(e) => updateItem(idx, e.target.value)}
                className="flex-1"
                aria-label={`${label} 第 ${idx + 1} 条`}
              />
              <Button
                variant="ghost"
                size="icon"
                aria-label={`删除 ${label} 第 ${idx + 1} 条`}
                onClick={() => removeItem(idx)}
                className="h-8 w-8 min-w-[32px] min-h-[32px] text-destructive shrink-0"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* 添加行 */}
      <div className="flex items-center gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="输入新条目（如：不宜与藜芦同用）"
          className="flex-1"
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addItem(); } }}
          aria-label={`新增 ${label}`}
        />
        <select
          value={source}
          onChange={(e) => setSource(e.target.value)}
          className="h-[44px] rounded-[var(--radius-Apple-sm)] border border-input bg-background px-2 text-sm text-muted-foreground"
          aria-label={`${label} 来源`}
        >
          <option value="">来源…</option>
          {SOURCES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <Button
          variant="outline"
          size="sm"
          icon={<Plus className="h-3.5 w-3.5" />}
          onClick={addItem}
          disabled={!draft.trim()}
        >
          添加
        </Button>
      </div>
    </div>
  );
};

const FoodMaterialReviewPanel: React.FC<FoodMaterialReviewPanelProps> = ({
  open,
  materialId,
  onClose,
  onSaved,
}) => {
  const toast = useToast();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const role = (user?.role ?? '').toLowerCase();
  const canReview = role === 'admin' || role === 'formulator';

  const {
    data: detail,
    isLoading,
  } = useQuery<FoodMaterialDetail, Error>({
    queryKey: ['foodMaterial', materialId],
    queryFn: () => getFoodMaterial(materialId as number),
    enabled: open && materialId != null && canReview,
  });

  // 表单本地状态（初值严格来自接口，不预填任何编造内容）
  const [interactions, setInteractions] = useState<string[]>([]);
  const [contraindications, setContraindications] = useState<string[]>([]);
  const [originCountriesDraft, setOriginCountriesDraft] = useState('');
  const [msdsUrl, setMsdsUrl] = useState('');
  const [coaUrl, setCoaUrl] = useState('');
  // 原始快照，用于 dirty 比对
  const [original, setOriginal] = useState<{
    interactions: string[]; contraindications: string[];
    originCountries: string[]; msdsUrl: string; coaUrl: string;
  } | null>(null);
  // 已用接口值播种的原料 id（避免重复播种覆盖用户编辑）
  const [seededFor, setSeededFor] = useState<number | null>(null);

  // 详情到位后用接口真实值播种表单（render 阶段一次性 setState，React 官方推荐
  // 的「派生/重置状态」范式，替代 setState-in-effect 以满足 lint）。
  // 空字段保持为空，等专家录入，绝不预填。
  if (detail && materialId != null && seededFor !== materialId) {
    const inter = toArray(detail.safety?.interactions);
    const contra = toArray(detail.safety?.contraindications);
    const origin = toArray(detail.origin_countries);
    const msds = typeof detail.msds_url === 'string' ? detail.msds_url : '';
    const coa = typeof detail.coa_url === 'string' ? detail.coa_url : '';
    setSeededFor(materialId);
    setInteractions(inter);
    setContraindications(contra);
    setOriginCountriesDraft(origin.join('、'));
    setMsdsUrl(msds);
    setCoaUrl(coa);
    setOriginal({ interactions: inter, contraindications: contra, originCountries: origin, msdsUrl: msds, coaUrl: coa });
  }

  /** 计算改动的字段，构造 partial payload（仅提交 dirty 字段） */
  const payload = useMemo<FoodMaterialReviewUpdate>(() => {
    if (!original) return {};
    const next: FoodMaterialReviewUpdate = {};
    const originNow = originCountriesDraft
      .split(/[、,，;；\n]+/)
      .map((s) => s.trim())
      .filter((s) => s !== '');
    if (!sameArray(interactions, original.interactions)) next.interactions = interactions;
    if (!sameArray(contraindications, original.contraindications)) next.contraindications = contraindications;
    if (!sameArray(originNow, original.originCountries)) next.origin_countries = originNow;
    if (msdsUrl.trim() !== original.msdsUrl) next.msds_url = msdsUrl.trim();
    if (coaUrl.trim() !== original.coaUrl) next.coa_url = coaUrl.trim();
    return next;
  }, [interactions, contraindications, originCountriesDraft, msdsUrl, coaUrl, original]);
  const changedKeys = Object.keys(payload);
  const isDirty = changedKeys.length > 0;

  const saveMutation = useMutation<FoodMaterialDetail, Error, FoodMaterialReviewUpdate>({
    mutationFn: (data) => updateFoodMaterial(materialId as number, data),
    onSuccess: (updated) => {
      toast.success('审校已保存');
      // 刷新详情缓存（抽屉与本面板共用 queryKey）
      queryClient.invalidateQueries({ queryKey: ['foodMaterial', materialId] });
      onSaved?.();
      // 用返回值同步本地快照，避免立即又判定为 dirty
      if (updated) {
        setOriginal({
          interactions: toArray(updated.safety?.interactions),
          contraindications: toArray(updated.safety?.contraindications),
          originCountries: toArray(updated.origin_countries),
          msdsUrl: typeof updated.msds_url === 'string' ? updated.msds_url : '',
          coaUrl: typeof updated.coa_url === 'string' ? updated.coa_url : '',
        });
      }
    },
    onError: (err) => {
      toast.error(`保存失败：${err?.message ?? '请重试'}`);
      logger.error('[FoodMaterialReview] 保存失败:', err);
    },
  });

  const handleSave = () => {
    if (!isDirty || materialId == null) return;
    saveMutation.mutate(payload);
  };

  if (!open || materialId == null) return null;

  if (!canReview) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-[420px]">
          <DialogHeader>
            <DialogTitle>权限不足</DialogTitle>
          </DialogHeader>
          <div className="text-sm text-muted-foreground">专家审校需要管理员或配方师权限。</div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-[640px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 pr-8">
            <ShieldCheck className="h-5 w-5 text-primary" />
            专家审校 · {detail?.name_cn || `原料 #${materialId}`}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
            <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full" />
            <span className="text-sm">加载当前值...</span>
          </div>
        ) : (
          <>
            {/* 现状提示 */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-[var(--space-apple-sm)]">
              <Info className="h-3.5 w-3.5" />
              表单已载入该原料当前值；空字段表示尚未录入，请专家据实填写，系统不预填任何内容。
              {detail?.review_status && (
                <Badge variant="neutral" className="ml-1">审校状态：{String(detail.review_status)}</Badge>
              )}
            </div>

            <StringListEditor
              label="相互作用 (interactions)"
              hint="药物/食材配伍相互作用，每条一项。可选来源将以后缀「（来源：X）」并入条目。"
              items={interactions}
              onChange={setInteractions}
            />

            <StringListEditor
              label="禁忌 (contraindications)"
              hint="使用禁忌/不适宜人群，每条一项。可选来源将并入条目。"
              items={contraindications}
              onChange={setContraindications}
            />

            {/* 可选字段 */}
            <div className="mb-[var(--space-apple-md)]">
              <div className="text-sm font-semibold mb-1">溯源信息（可选）</div>
              <div className="text-[11px] text-muted-foreground mb-2">以下字段当前多为空，可一并补录。</div>
              <div className="space-y-2">
                <div>
                  <label className="text-xs text-muted-foreground">原产国 (origin_countries，用、或,分隔)</label>
                  <Input
                    value={originCountriesDraft}
                    onChange={(e) => setOriginCountriesDraft(e.target.value)}
                    placeholder="如：中国、蒙古"
                    className="mt-1"
                    aria-label="原产国"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">MSDS 链接</label>
                  <Input
                    value={msdsUrl}
                    onChange={(e) => setMsdsUrl(e.target.value)}
                    placeholder="https://..."
                    className="mt-1"
                    aria-label="MSDS 链接"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">COA 链接</label>
                  <Input
                    value={coaUrl}
                    onChange={(e) => setCoaUrl(e.target.value)}
                    placeholder="https://..."
                    className="mt-1"
                    aria-label="COA 链接"
                  />
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between gap-3 pt-[var(--space-apple-sm)] border-t border-border">
              <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                {isDirty ? (
                  <>将提交 {changedKeys.length} 个改动字段：{changedKeys.join('、')}</>
                ) : (
                  <><AlertTriangle className="h-3 w-3" /> 无改动</>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={onClose}>取消</Button>
                <Button
                  variant="primary"
                  size="sm"
                  icon={<Save className="h-3.5 w-3.5" />}
                  loading={saveMutation.isPending}
                  disabled={!isDirty}
                  onClick={handleSave}
                >
                  保存审校
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default FoodMaterialReviewPanel;
