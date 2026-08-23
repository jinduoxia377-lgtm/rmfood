/**
 * 配比优化结果面板 - 展示优化结果并提供应用选项
 */
import { useState } from 'react';
import { CheckCircle2, AlertTriangle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui';
import { cn } from '@/lib/utils';

interface OptimizationResultPanelProps {
  result?: {
    feasible?: boolean;
    ratios?: Record<string, number>;
    total_dosage_g?: number;
    min_cost?: number;
    solve_time_ms?: number;
    nutrition_matrix?: Record<string, number>;
  };
  onApply?: (ratios: Record<string, number>) => void;
  loading?: boolean;
}

export function OptimizationResultPanel({ result, onApply, loading }: OptimizationResultPanelProps) {
  const [showDetails, setShowDetails] = useState(false);

  if (!result) {
    return (
      <div className="rounded-xl border border-neutral-200 dark:border-neutral-700 p-4 bg-white dark:bg-neutral-900">
        <p className="text-sm text-neutral-500 text-center">暂无优化结果</p>
      </div>
    );
  }

  if (!result.feasible) {
    return (
      <div className="rounded-xl border border-rose-200 dark:border-rose-800 p-4 bg-rose-50 dark:bg-rose-900/20">
        <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 mb-2">
          <AlertTriangle size={16} />
          <span className="font-medium">优化不可行</span>
        </div>
        <p className="text-sm text-rose-600 dark:text-rose-400">
          约束条件过紧，无法找到可行解。请放宽营养约束或调整剂量范围。
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 size={16} />
          <span className="font-medium">优化成功</span>
        </div>
        <span className="text-xs text-emerald-600 dark:text-emerald-400">
          {result.solve_time_ms?.toFixed(0) ?? 0}ms
        </span>
      </div>

      {/* 核心指标 */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="text-center">
          <p className="text-xs text-emerald-600 dark:text-emerald-400">最小成本</p>
          <p className="text-lg font-bold text-emerald-700 dark:text-emerald-300">
            ¥{result.min_cost?.toFixed(2) ?? '0.00'}
          </p>
        </div>
        <div className="text-center">
          <p className="text-xs text-emerald-600 dark:text-emerald-400">总剂量</p>
          <p className="text-lg font-bold text-emerald-700 dark:text-emerald-300">
            {result.total_dosage_g?.toFixed(0) ?? 0}g
          </p>
        </div>
        <div className="text-center">
          <p className="text-xs text-emerald-600 dark:text-emerald-400">成分数</p>
          <p className="text-lg font-bold text-emerald-700 dark:text-emerald-300">
            {result.ratios ? Object.keys(result.ratios).length : 0}
          </p>
        </div>
      </div>

      {/* 配比详情 */}
      {result.ratios && Object.keys(result.ratios).length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setShowDetails(!showDetails)}
            className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline mb-2"
          >
            {showDetails ? '收起详情' : '展开配比详情'}
          </button>
          
          {showDetails && (
            <div className="space-y-1 mb-4 max-h-40 overflow-y-auto">
              {Object.entries(result.ratios).map(([name, dose]) => (
                <div key={name} className="flex items-center justify-between text-sm">
                  <span className="text-neutral-700 dark:text-neutral-300">{name}</span>
                  <span className="text-neutral-500">
                    {dose.toFixed(1)}g ({(dose / (result.total_dosage_g || 1) * 100).toFixed(1)}%)
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* 应用按钮 */}
      {onApply && result.ratios && Object.keys(result.ratios).length > 0 && (
        <Button
          variant="primary"
          size="sm"
          icon={<CheckCircle size={14} />}
          onClick={() => onApply(result.ratios!)}
          loading={loading}
          className="w-full"
        >
          应用优化结果
        </Button>
      )}
    </div>
  );
}
