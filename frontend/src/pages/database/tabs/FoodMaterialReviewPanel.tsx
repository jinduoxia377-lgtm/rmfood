/**
 * 食品原料专家审校面板
 *
 * 供 admin/formulator 系统录入并审校安全关键字段，并记录 provenance（谁/何时/依据什么来源）。
 *
 * 提交路径（按字段是否在后端 REVIEWABLE_MATERIAL_FIELDS 白名单内分流）：
 * - interactions / contraindications（白名单内）→ **POST /food-materials/:id/review**
 *   一次一字段：{ field_name, value, source?, review_note? }，服务端写主表 + upsert 审计行，
 *   reviewed_by 由服务端从 current_user 取（客户端传身份字段会被 extra=forbid 拒 422）。
 * - origin_countries / msds_url / coa_url（**不在**白名单，POST 会 400）→ **PUT /food-materials/:id**
 *   纯存值，不留审校痕迹（UI 已标注）。
 *
 * 原则：
 * - **不伪造**：表单/历史严格来自接口返回值，空的就是空的，等专家录入。
 * - **非破坏**：只提交改动字段。
 */
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  Button, Input, Badge, useToast,
} from '@/components/ui';
import {
  Plus, Trash2, ShieldCheck, Save, Info, AlertTriangle, History,
} from 'lucide-react';
import {
  getFoodMaterial,
  updateFoodMaterial,
  reviewMaterialField,
  getMaterialReview,
  type FoodMaterialDetail,
  type FoodMaterialReviewUpdate,
  type MaterialFieldReviewCreate,
  type MaterialReviewResponse,
  type MaterialFieldReviewItem,
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

/** 来源可选值（作为 POST /review 的 source 参数，字段级 provenance） */
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

/**
 * 可审计列表编辑器（用于白名单字段 interactions/contraindications）
 * 列表条目 + 字段级「来源」下拉 + 字段级「备注」输入，一并作为 POST /review 的 provenance。
 */
const AuditedListEditor: React.FC<{
  label: string;
  fieldName: string;
  hint: string;
  items: string[];
  onChange: (next: string[]) => void;
  source: string;
  onSourceChange: (s: string) => void;
  note: string;
  onNoteChange: (s: string) => void;
}> = ({ label, fieldName, hint, items, onChange, source, onSourceChange, note, onNoteChange }) => {
  const [draft, setDraft] = useState('');

  const addItem = () => {
    const text = draft.trim();
    if (!text) return;
    onChange([...items, text]);
    setDraft('');
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
    <div className="mb-[var(--space-apple-md)] rounded-[var(--radius-Apple-sm)] border border-border p-[var(--space-apple-md)] bg-background/40">
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

      {/* 字段级 provenance：来源 + 备注 */}
      <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border/60">
        <select
          value={source}
          onChange={(e) => onSourceChange(e.target.value)}
          className="h-[44px] rounded-[var(--radius-Apple-sm)] border border-input bg-background px-2 text-sm text-muted-foreground"
          aria-label={`${label} 依据来源`}
        >
          <option value="">依据来源…</option>
          {SOURCES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <Input
          value={note}
          onChange={(e) => onNoteChange(e.target.value)}
          placeholder="审校备注（可选）"
          className="flex-1"
          aria-label={`${label} 审校备注`}
        />
      </div>
      <div className="text-[10px] text-muted-foreground mt-1">
        保存时以 <code>{fieldName}</code> 一次 POST /review 提交，记录审校人与依据来源。
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
  // 字段级 provenance（仅对白名单字段 interactions/contraindications 有意义）
  const [interactionsSource, setInteractionsSource] = useState('');
  const [interactionsNote, setInteractionsNote] = useState('');
  const [contraindicationsSource, setContraindicationsSource] = useState('');
  const [contraindicationsNote, setContraindicationsNote] = useState('');
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

  // 审校历史（provenance）：GET /review，按 reviewed_at desc
  const {
    data: reviewHistory,
    isLoading: historyLoading,
  } = useQuery<MaterialReviewResponse, Error>({
    queryKey: ['materialReview', materialId],
    queryFn: () => getMaterialReview(materialId as number),
    enabled: open && materialId != null && canReview,
  });

  const originNow = originCountriesDraft
    .split(/[、,，;；\n]+/)
    .map((s) => s.trim())
    .filter((s) => s !== '');

  // 逐字段 dirty 判定（不预填，空就是空）
  const interactionsDirty = original ? !sameArray(interactions, original.interactions) : false;
  const contraindicationsDirty = original ? !sameArray(contraindications, original.contraindications) : false;
  const originDirty = original ? !sameArray(originNow, original.originCountries) : false;
  const msdsDirty = original ? msdsUrl.trim() !== original.msdsUrl : false;
  const coaDirty = original ? coaUrl.trim() !== original.coaUrl : false;
  const isDirty = interactionsDirty || contraindicationsDirty || originDirty || msdsDirty || coaDirty;

  const dirtyLabels: string[] = [];
  if (interactionsDirty) dirtyLabels.push('interactions');
  if (contraindicationsDirty) dirtyLabels.push('contraindications');
  if (originDirty) dirtyLabels.push('origin_countries');
  if (msdsDirty) dirtyLabels.push('msds_url');
  if (coaDirty) dirtyLabels.push('coa_url');

  /**
   * 保存：白名单字段走 POST /review（存值+留痕，一次一字段），
   * 非白名单可选字段走 PUT（纯存值，不留痕）。
   */
  const saveMutation = useMutation<{ reviewed: number }, Error>({
    mutationFn: async () => {
      if (materialId == null) throw new Error('缺少原料 ID');
      const tasks: Promise<unknown>[] = [];
      let reviewed = 0;

      // ── POST /review：白名单字段（记录 provenance）──
      if (interactionsDirty) {
        const body: MaterialFieldReviewCreate = {
          field_name: 'interactions',
          value: interactions,
        };
        if (interactionsSource) body.source = interactionsSource;
        if (interactionsNote.trim()) body.review_note = interactionsNote.trim();
        tasks.push(reviewMaterialField(materialId, body));
        reviewed += 1;
      }
      if (contraindicationsDirty) {
        const body: MaterialFieldReviewCreate = {
          field_name: 'contraindications',
          value: contraindications,
        };
        if (contraindicationsSource) body.source = contraindicationsSource;
        if (contraindicationsNote.trim()) body.review_note = contraindicationsNote.trim();
        tasks.push(reviewMaterialField(materialId, body));
        reviewed += 1;
      }

      // ── PUT：非白名单可选字段（纯存值，无 provenance）──
      const putPayload: FoodMaterialReviewUpdate = {};
      if (originDirty) putPayload.origin_countries = originNow;
      if (msdsDirty) putPayload.msds_url = msdsUrl.trim();
      if (coaDirty) putPayload.coa_url = coaUrl.trim();
      if (Object.keys(putPayload).length > 0) {
        tasks.push(updateFoodMaterial(materialId, putPayload));
      }

      await Promise.all(tasks);
      return { reviewed };
    },
    onSuccess: ({ reviewed }) => {
      toast.success(reviewed > 0 ? `审校已提交（${reviewed} 字段留痕）` : '已保存');
      queryClient.invalidateQueries({ queryKey: ['foodMaterial', materialId] });
      queryClient.invalidateQueries({ queryKey: ['materialReview', materialId] });
      onSaved?.();
      // 同步本地快照，避免立即又判定为 dirty
      setOriginal({
        interactions, contraindications,
        originCountries: originNow, msdsUrl: msdsUrl.trim(), coaUrl: coaUrl.trim(),
      });
      // 清空本次录入的 provenance 备注（来源保留与否均可，这里一并清空）
      setInteractionsSource('');
      setInteractionsNote('');
      setContraindicationsSource('');
      setContraindicationsNote('');
    },
    onError: (err) => {
      toast.error(`保存失败：${err?.message ?? '请重试'}`);
      logger.error('[FoodMaterialReview] 保存失败:', err);
    },
  });

  const handleSave = () => {
    if (!isDirty || materialId == null) return;
    saveMutation.mutate(undefined);
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

            <AuditedListEditor
              label="相互作用 (interactions)"
              fieldName="interactions"
              hint="药物/食材配伍相互作用，每条一项。来源/备注为字段级 provenance。"
              items={interactions}
              onChange={setInteractions}
              source={interactionsSource}
              onSourceChange={setInteractionsSource}
              note={interactionsNote}
              onNoteChange={setInteractionsNote}
            />

            <AuditedListEditor
              label="禁忌 (contraindications)"
              fieldName="contraindications"
              hint="使用禁忌/不适宜人群，每条一项。来源/备注为字段级 provenance。"
              items={contraindications}
              onChange={setContraindications}
              source={contraindicationsSource}
              onSourceChange={setContraindicationsSource}
              note={contraindicationsNote}
              onNoteChange={setContraindicationsNote}
            />

            {/* 可选字段（非白名单，走 PUT 纯存值，不留审校痕迹） */}
            <div className="mb-[var(--space-apple-md)]">
              <div className="text-sm font-semibold mb-1">溯源信息（可选）</div>
              <div className="text-[11px] text-muted-foreground mb-2">
                以下字段不在审校白名单内，保存走 PUT 纯存值，<b>不记录审校 provenance</b>。
              </div>
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

            {/* 审校历史 (provenance) */}
            <div className="mb-[var(--space-apple-md)]">
              <div className="flex items-center gap-1.5 mb-2">
                <History className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-semibold">审校历史</span>
                {reviewHistory && (
                  <span className="text-xs text-muted-foreground">（{reviewHistory.items.length} 条）</span>
                )}
              </div>
              {historyLoading ? (
                <div className="text-xs text-muted-foreground py-2">加载审校历史...</div>
              ) : !reviewHistory || reviewHistory.items.length === 0 ? (
                <div className="text-xs text-muted-foreground rounded-[var(--radius-Apple-sm)] border border-dashed border-border p-[var(--space-apple-sm)]">
                  暂无审校记录
                </div>
              ) : (
                <div className="space-y-2">
                  {reviewHistory.items.map((it: MaterialFieldReviewItem) => (
                    <div
                      key={it.id}
                      className="rounded-[var(--radius-Apple-sm)] border border-border p-[var(--space-apple-sm)] bg-background/40"
                    >
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <Badge variant="info">{it.field_name}</Badge>
                        {it.source && <Badge variant="secondary">来源：{it.source}</Badge>}
                        <span className="text-[11px] text-muted-foreground">
                          审校人 #{it.reviewed_by}
                          {it.reviewed_at ? ` · ${it.reviewed_at.replace('T', ' ').slice(0, 19)}` : ''}
                        </span>
                      </div>
                      <div className="text-xs break-words text-foreground/90">
                        值：{Array.isArray(it.value) ? (it.value as unknown[]).join('、') : String(it.value ?? '—')}
                      </div>
                      {it.review_note && (
                        <div className="text-[11px] text-muted-foreground mt-0.5">备注：{it.review_note}</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between gap-3 pt-[var(--space-apple-sm)] border-t border-border">
              <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                {isDirty ? (
                  <>将提交 {dirtyLabels.length} 个改动字段：{dirtyLabels.join('、')}</>
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
