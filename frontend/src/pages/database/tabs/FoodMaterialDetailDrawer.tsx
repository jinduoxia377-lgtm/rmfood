/**
 * 食品原料详情抽屉
 *
 * 右侧滑出面板，分区展示食品原料全字段：
 * 身份 / 分类 / 功效 / 安全 / 法规 / 药代 / 成分 / 描述。
 *
 * 设计：项目无现成 Drawer/Sheet，这里用 React Portal + 固定定位实现右侧抽屉，
 * 遵循 Apple 设计规范间距/圆角令牌（--space-apple-* / --radius-Apple-*）。
 * 合规徽章：regulatory.status 有值按值显示；空 → 「状态未知·待评估」中性徽章。
 */
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Badge, Button,
} from '@/components/ui';
import {
  X, Star, AlertTriangle, ShieldCheck, FlaskConical, Leaf, Pill,
  Scale, Info,
} from 'lucide-react';
import { getFoodMaterial, type FoodMaterialDetail } from '../../../api/searchNew';

interface FoodMaterialDetailDrawerProps {
  open: boolean;
  materialId: number | null;
  onClose: () => void;
  /** 当前原料是否已收藏（由父组件的 Pantry 状态驱动） */
  isFavorited: boolean;
  /** 收藏/取消收藏（乐观更新由父组件处理） */
  onToggleFavorite: (id: number) => void;
  favoriteLoading?: boolean;
}

/** 把后端可能为 string / string[] / object[] / null 的字段归一为字符串数组 */
function asArray(value: unknown): string[] {
  if (value == null) return [];
  if (Array.isArray(value)) {
    return value.map((item) => {
      if (typeof item === 'string') return item;
      if (typeof item === 'number') return String(item);
      if (item && typeof item === 'object') {
        const obj = item as Record<string, unknown>;
        const label = obj.name ?? obj.text ?? obj.title ?? obj.value;
        return label != null ? String(label) : '';
      }
      return String(item);
    }).filter((s) => s !== '');
  }
  if (typeof value === 'string') {
    // 长字符串按常见分隔符拆分
    return value
      .split(/[;；,，、\n]+/)
      .map((s) => s.trim())
      .filter((s) => s !== '');
  }
  return [String(value)];
}

/** 单值文本：null/undefined/空串 → '—' */
function text(value: unknown): string {
  if (value == null) return '—';
  const s = String(value).trim();
  return s === '' ? '—' : s;
}

/** 数组字段：空数组 → '无' */
function arrayText(value: unknown): string {
  const arr = asArray(value);
  return arr.length === 0 ? '无' : arr.join('、');
}

/** 分区容器 */
const Section: React.FC<{
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, icon, children }) => (
  <div className="mb-[var(--space-apple-md)]">
    <div className="flex items-center gap-1.5 mb-[var(--space-apple-sm)]">
      {icon}
      <span className="text-sm font-semibold">{title}</span>
    </div>
    <div className="rounded-[var(--radius-Apple-sm)] border border-border p-[var(--space-apple-md)] bg-background/50">
      {children}
    </div>
  </div>
);

/** 信息行 */
const InfoRow: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="flex justify-between gap-4 py-1.5 border-b border-border/50 text-sm last:border-b-0">
    <span className="text-muted-foreground shrink-0">{label}</span>
    <span className="font-medium text-right break-words">{value}</span>
  </div>
);

/** 法规状态 → 徽章 variant */
function regulatoryBadge(status: string | undefined): { label: string; variant: 'success' | 'warning' | 'destructive' | 'info' | 'neutral' } {
  if (!status || status.trim() === '') {
    return { label: '状态未知·待评估', variant: 'neutral' };
  }
  const s = status.toLowerCase();
  if (s.includes('禁') || s.includes('未批准') || s.includes('banned') || s.includes('prohibited') || s.includes('rejected')) {
    return { label: status, variant: 'destructive' };
  }
  if (s.includes('合规') || s.includes('批准') || s.includes('enabled') || s.includes('approved') || s.includes('legal')) {
    return { label: status, variant: 'success' };
  }
  if (s.includes('评估') || s.includes('pending') || s.includes('review')) {
    return { label: status, variant: 'warning' };
  }
  return { label: status, variant: 'info' };
}

const FoodMaterialDetailDrawer: React.FC<FoodMaterialDetailDrawerProps> = ({
  open,
  materialId,
  onClose,
  isFavorited,
  onToggleFavorite,
  favoriteLoading = false,
}) => {
  const [showAllIngredients, setShowAllIngredients] = useState(false);

  const {
    data: detail,
    isLoading,
    isError,
    error,
  } = useQuery<FoodMaterialDetail, Error>({
    queryKey: ['foodMaterial', materialId],
    queryFn: () => getFoodMaterial(materialId as number),
    enabled: open && materialId != null,
  });

  // 每次打开/切换原料时重置「展开全部成分」
  useEffect(() => {
    setShowAllIngredients(false);
  }, [materialId, open]);

  // Esc 关闭
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || materialId == null) return null;

  const reg = regulatoryBadge(detail?.regulatory?.status);
  const ingredients = asArray(detail?.active_ingredients);
  const INGREDIENT_PREVIEW = 6;
  const shownIngredients = showAllIngredients ? ingredients : ingredients.slice(0, INGREDIENT_PREVIEW);

  const safeDose = (() => {
    const min = detail?.safety?.safe_dose_min;
    const max = detail?.safety?.safe_dose_max;
    if (min == null && max == null) return '—';
    if (min != null && max != null) return `${min} ~ ${max}`;
    return text(min ?? max);
  })();

  const name = text(detail?.name_cn) !== '—' ? String(detail?.name_cn) : text(detail?.name_en);
  const latin = detail?.name_latin;
  const nameEn = detail?.name_en;

  const drawer = (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label={`食品原料详情: ${name}`}>
      <style>{`
        @keyframes fmDrawerSlideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        @keyframes fmDrawerFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
      {/* 遮罩 */}
      <div
        className="absolute inset-0 bg-black/40"
        style={{ animation: 'fmDrawerFadeIn 180ms ease-out' }}
        onClick={onClose}
      />
      {/* 右侧面板 */}
      <div
        className="absolute right-0 top-0 h-full w-full max-w-[560px] bg-background shadow-2xl flex flex-col border-l border-border"
        style={{ animation: 'fmDrawerSlideIn 240ms cubic-bezier(0.32, 0.72, 0, 1)' }}
      >
        {/* 头部 */}
        <div className="shrink-0 border-b border-border p-[var(--space-apple-md)] flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-semibold truncate">{name}</h2>
              {detail?.food_homology === true && (
                <Badge variant="success">药食同源</Badge>
              )}
              <Badge variant={reg.variant}>{reg.label}</Badge>
            </div>
            {(latin || nameEn) && (
              <div className="text-xs text-muted-foreground mt-1 truncate">
                {latin ? String(latin) : ''}{latin && nameEn ? ' · ' : ''}{nameEn ? String(nameEn) : ''}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant={isFavorited ? 'warning' : 'outline'}
              size="sm"
              icon={<Star className={`h-3.5 w-3.5 ${isFavorited ? 'fill-current' : ''}`} />}
              loading={favoriteLoading}
              onClick={() => onToggleFavorite(materialId)}
            >
              {isFavorited ? '已收藏' : '收藏'}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="关闭"
              onClick={onClose}
              className="h-9 w-9 min-w-[36px] min-h-[36px]"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* 内容 */}
        <div className="flex-1 overflow-y-auto p-[var(--space-apple-md)]">
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-16 gap-[var(--space-apple-sm)] text-muted-foreground">
              <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
              <span className="text-sm">加载详情...</span>
            </div>
          )}

          {isError && (
            <div className="flex flex-col items-center justify-center py-16 gap-2 text-center">
              <AlertTriangle className="h-8 w-8 text-destructive" />
              <div className="text-sm font-medium text-destructive">详情加载失败</div>
              <div className="text-xs text-muted-foreground max-w-[320px] break-words">
                {error?.message || '请稍后重试'}
              </div>
              <Button variant="outline" size="sm" onClick={() => onClose()}>关闭</Button>
            </div>
          )}

          {!isLoading && !isError && detail && (
            <>
              {/* 身份 */}
              <Section title="身份" icon={<Leaf className="h-4 w-4 text-success" />}>
                <InfoRow label="中文名" value={text(detail.name_cn)} />
                <InfoRow label="英文名" value={text(detail.name_en)} />
                <InfoRow label="拉丁名" value={text(detail.name_latin)} />
                <InfoRow label="别名" value={arrayText(detail.aliases)} />
              </Section>

              {/* 分类 */}
              <Section title="分类" icon={<Info className="h-4 w-4 text-info" />}>
                <InfoRow label="类别" value={text(detail.category)} />
                <InfoRow label="子类" value={text(detail.sub_category)} />
                <InfoRow
                  label="药食同源"
                  value={
                    detail.food_homology === true
                      ? <Badge variant="success">是</Badge>
                      : detail.food_homology === false
                        ? <Badge variant="neutral">否</Badge>
                        : '—'
                  }
                />
                <InfoRow label="毒性等级" value={detail.toxicity_class ? <Badge variant={String(detail.toxicity_class) === '无毒' ? 'success' : 'warning'}>{String(detail.toxicity_class)}</Badge> : '—'} />
              </Section>

              {/* 功效 */}
              <Section title="功效与适应症" icon={<Pill className="h-4 w-4 text-primary" />}>
                <InfoRow label="功效" value={arrayText(detail.effects)} />
                <InfoRow label="适应症" value={arrayText(detail.indications)} />
              </Section>

              {/* 安全 */}
              <Section title="安全性" icon={<ShieldCheck className="h-4 w-4 text-warning" />}>
                <InfoRow label="安全剂量范围" value={safeDose} />
                <InfoRow label="禁忌" value={arrayText(detail.safety?.contraindications)} />
                <InfoRow label="相互作用" value={arrayText(detail.safety?.interactions)} />
              </Section>

              {/* 法规 */}
              <Section title="法规" icon={<Scale className="h-4 w-4 text-info" />}>
                <InfoRow
                  label="法规状态"
                  value={<Badge variant={reg.variant}>{reg.label}</Badge>}
                />
                <InfoRow label="批准地区" value={arrayText(detail.regulatory?.approved_regions)} />
                <InfoRow label="最大日摄入量" value={text(detail.regulatory?.max_daily_intake)} />
              </Section>

              {/* 药代 */}
              <Section title="药代动力学" icon={<FlaskConical className="h-4 w-4 text-primary" />}>
                <InfoRow label="OB% (口服生物利用度)" value={detail.ob_percent != null ? `${Number(detail.ob_percent).toFixed(2)}%` : '—'} />
                <InfoRow label="DL (类药性)" value={detail.dl_value != null ? Number(detail.dl_value).toFixed(3) : '—'} />
                <InfoRow label="生物利用度评分" value={detail.bioavailability_score != null ? Number(detail.bioavailability_score).toFixed(2) : '—'} />
                {detail.ob_percent != null || detail.dl_value != null ? (
                  <div className="text-[11px] text-muted-foreground mt-2 flex items-start gap-1">
                    <Info className="h-3 w-3 mt-0.5 shrink-0" />
                    {detail.source_db === 'tcm_sp' ? (
                      <span>
                        数据来源：TCMSP（中药系统药理学数据库）。以上为该原料活性化合物的
                        <strong> in-silico 预测值</strong>（非人体实测），按 ADME 阈值
                        （OB≥30% 且 DL≥0.18）筛选后聚合，属原料整体参考口径，非绝对实测。
                      </span>
                    ) : (
                      <span>口径说明：以上药代数值为参考口径，非原料整体实测值，仅供参考。</span>
                    )}
                  </div>
                ) : null}
              </Section>

              {/* 成分 */}
              <Section title={`活性成分${ingredients.length > 0 ? `（${ingredients.length}）` : ''}`} icon={<FlaskConical className="h-4 w-4 text-success" />}>
                {ingredients.length === 0 ? (
                  <div className="text-sm text-muted-foreground">无</div>
                ) : (
                  <div>
                    <div className="flex flex-wrap gap-1.5">
                      {shownIngredients.map((ing, idx) => (
                        <Badge key={`${ing}-${idx}`} variant="secondary">{ing}</Badge>
                      ))}
                    </div>
                    {ingredients.length > INGREDIENT_PREVIEW && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mt-2 h-7 text-xs"
                        onClick={() => setShowAllIngredients((v) => !v)}
                      >
                        {showAllIngredients ? '收起' : `展开全部 ${ingredients.length} 项`}
                      </Button>
                    )}
                  </div>
                )}
              </Section>

              {/* 描述 */}
              {detail.description && String(detail.description).trim() !== '' && (
                <Section title="描述" icon={<Info className="h-4 w-4 text-muted-foreground" />}>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                    {String(detail.description)}
                  </p>
                </Section>
              )}

              {/* 元数据 */}
              <div className="text-[11px] text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 pt-[var(--space-apple-sm)] border-t border-border">
                {detail.source_db && <span>来源: {String(detail.source_db)}</span>}
                {detail.data_quality != null && <span>数据质量: {(Number(detail.data_quality) * 100).toFixed(0)}%</span>}
                {detail.review_status && <span>审核状态: {String(detail.review_status)}</span>}
              </div>
            </>
          )}

          {!isLoading && !isError && !detail && (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Info className="h-8 w-8" />
              <div className="text-sm mt-2">暂无详情数据</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // Portal 到 body，避免被父级 overflow 裁剪
  if (typeof document === 'undefined') return null;
  return createPortal(drawer, document.body);
};

export default FoodMaterialDetailDrawer;
