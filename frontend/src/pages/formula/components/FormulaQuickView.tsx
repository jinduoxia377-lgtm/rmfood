/**
 * 配方快速预览组件
 * 在列表页弹窗显示配方核心信息，无需跳转到详情页
 */
import { useMemo, useRef, useEffect } from 'react';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { X, ArrowRight, Zap } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { formulaApi } from '@/api/formula';
import { StatusBadge, Skeleton } from '@/components/ui/Common';
import { Button, Badge } from '@/components/ui';
import { CompositionChart } from './CompositionChart';
import { cn } from '@/lib/utils';

interface FormulaQuickViewProps {
  formulaId: number | null;
  onClose: () => void;
  onNavigate: (id: number) => void;
}

export function FormulaQuickView({ formulaId, onClose, onNavigate }: FormulaQuickViewProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(panelRef, !!formulaId, onClose);

  const { data: formula, isLoading } = useQuery({
    queryKey: ['formula', formulaId],
    queryFn: () => formulaApi.get(formulaId!),
    enabled: !!formulaId,
  });

  const ingredientList = useMemo(() => {
    if (!formula?.composition || typeof formula.composition !== 'object') return [];
    const comp = formula.composition as Record<string, unknown>;
    const list = comp.ingredients ?? comp.components;
    if (!Array.isArray(list)) return [];
    return list.map((item: Record<string, unknown>, idx: number) => ({
      name: (item.name ?? item.name ?? `成分${idx + 1}`) as string,
      category: (item.category ?? item.classification ?? '-') as string,
      is_food_homology: item.is_food_homology === true || item.is_medical_food === true,
      dosage: (item.dosage ?? item.amount ?? '-') as string,
      role: (item.role ?? '') as string,
    }));
  }, [formula?.composition]);

  const safetyPassed = useMemo(() => {
    if (!formula?.safety_check || typeof formula.safety_check !== 'object') return null;
    const sc = formula.safety_check as Record<string, unknown>;
    return sc.passed ?? sc.is_passed ?? null;
  }, [formula?.safety_check]);

  const synergyScore = useMemo(() => {
    if (!formula?.synergy_analysis || typeof formula.synergy_analysis !== 'object') return null;
    const sa = formula.synergy_analysis as Record<string, unknown>;
    return (sa.score ?? sa.overall_score ?? null) as number | null;
  }, [formula?.synergy_analysis]);

  if (!formulaId) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm"  role="button" tabIndex={0} onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="quick-view-title"
        className="relative w-full max-w-2xl max-h-[85vh] bg-white dark:bg-neutral-900 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-200 dark:border-neutral-700">
          <div className="flex items-center gap-2">
            {isLoading ? (
              <Skeleton className="w-8 h-8 rounded-lg" />
            ) : (
              <div className="w-8 h-8 rounded-lg bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center">
                <Zap size={16} className="text-primary-500" />
              </div>
            )}
            <div>
              {isLoading ? (
                <>
                  <Skeleton className="w-28 h-4 mb-1" />
                  <Skeleton className="w-16 h-3.5" />
                </>
              ) : (
                <>
                  <h2 id="quick-view-title" className="text-base font-semibold text-neutral-900 dark:text-white">{formula?.name}</h2>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-sm text-neutral-500">{formula?.code}</span>
                    <StatusBadge status={formula!.status} />
                  </div>
                </>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 hover:text-neutral-600 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto max-h-[calc(85vh-120px)] p-4">
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="w-full h-20" />
              <Skeleton className="w-full h-40" />
              <Skeleton className="w-full h-28" />
            </div>
          ) : formula ? (
            <div className="space-y-4">
              {formula.description && (
                <p className="text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed">{formula.description}</p>
              )}

              {formula.targetEffects && formula.targetEffects.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-2">
                    目标功效
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {formula.targetEffects.map((effect) => {
                      const label = typeof effect === 'string' ? effect : effect.effectName;
                      return (
                        <Badge key={label} variant="primary" size="sm">
                          {label}
                        </Badge>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-3 gap-2">
                <div className="bg-slate-50 dark:bg-neutral-800/50 rounded-lg p-2.5 text-center">
                  <p className="text-xs text-neutral-500 mb-1">安全检查</p>
                  <p
                    className={cn(
                      'text-base font-semibold',
                      safetyPassed === true
                        ? 'text-success-600'
                        : safetyPassed === false
                          ? 'text-error-600'
                          : 'text-neutral-400',
                    )}
                  >
                    {safetyPassed === null ? '未检测' : safetyPassed ? '通过' : '未通过'}
                  </p>
                </div>
                <div className="bg-slate-50 dark:bg-neutral-800/50 rounded-lg p-2.5 text-center">
                  <p className="text-xs text-neutral-500 mb-1">协同评分</p>
                  <p className="text-base font-semibold text-primary-600">
                    {synergyScore !== null ? synergyScore : '-'}
                  </p>
                </div>
                <div className="bg-slate-50 dark:bg-neutral-800/50 rounded-lg p-2.5 text-center">
                  <p className="text-xs text-neutral-500 mb-1">成分数量</p>
                  <p className="text-base font-semibold text-neutral-700 dark:text-neutral-300">{ingredientList.length}</p>
                </div>
              </div>

              {ingredientList.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-2">
                    成分组成
                  </h4>
                  <CompositionChart ingredients={ingredientList} compact />
                  <div className="mt-2 max-h-28 overflow-y-auto">
                    <table className="w-full text-sm">
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {ingredientList.map((ing, i) => (
                          <tr key={i}>
                            <td className="py-1.5">
                              <span className="font-medium text-neutral-700 dark:text-neutral-300">{ing.name}</span>
                              {ing.role && (
                                <Badge variant="info" size="sm" className="ml-1">
                                  {ing.role}
                                </Badge>
                              )}
                            </td>
                            <td className="py-1.5 text-right text-neutral-500">{ing.dosage}</td>
                            <td className="py-1.5 text-right">
                              {ing.is_food_homology && (
                                <Badge variant="success" size="sm">
                                  药食同源
                                </Badge>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: '服用剂量', value: formula.dosage },
                  { label: '加工工艺', value: formula.processing_method },
                  { label: '储藏条件', value: formula.storage_conditions },
                  { label: '保质期', value: formula.shelf_life ? `${formula.shelf_life} 天` : null },
                ]
                  .filter((p) => p.value)
                  .map(({ label, value }) => (
                    <div key={label} className="bg-slate-50 dark:bg-neutral-800/50 rounded-lg p-2">
                      <p className="text-xs text-neutral-400">{label}</p>
                      <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mt-0.5">{value}</p>
                    </div>
                  ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-6 text-neutral-500">配方不存在</div>
          )}
        </div>

        <div className="flex items-center justify-between px-4 py-3 border-t border-neutral-200 dark:border-neutral-700 bg-slate-50/50 dark:bg-neutral-800/50">
          <span className="text-xs text-neutral-400">
            {isLoading
              ? ''
              : `版本 v${formula?.version} · 创建于 ${formula ? new Date(formula.createdAt).toLocaleDateString('zh-CN') : ''}`}
          </span>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => onNavigate(formulaId)}>
              复制
            </Button>
            <Button
              size="sm"
              icon={<ArrowRight size={14} />}
              onClick={() => {
                onClose();
                onNavigate(formulaId);
              }}
            >
              查看详情
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
