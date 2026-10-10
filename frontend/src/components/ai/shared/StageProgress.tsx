/**
 * 执行阶段进度组件
 *
 * 展示工作流或 Agent 执行的各个阶段及其状态
 */
import React from 'react';
import type { ExecutionStage } from './types';
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
  ArrowRight,
} from 'lucide-react';

interface StageProgressProps {
  stages: ExecutionStage[];
  isRunning?: boolean;
}

export function StageProgress({ stages, isRunning = false }: StageProgressProps) {
  if (stages.length === 0 && !isRunning) {
    return null;
  }

  return (
    <div className="mt-4 p-4 bg-neutral-50 dark:bg-neutral-900 rounded-lg">
      <div className="flex items-center gap-2 mb-3">
        <Clock className="w-4 h-4 text-primary-500" />
        <span className="text-sm font-medium">执行阶段</span>
        {isRunning && (
          <span className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] animate-pulse">进行中...</span>
        )}
      </div>

      <div className="space-y-2">
        {stages.map((stage, index) => (
          <React.Fragment key={index}>
            <div className="flex items-center gap-3 p-2 rounded bg-white dark:bg-neutral-800">
              {/* 状态图标 */}
              {stage.success ? (
                <CheckCircle2 className="w-4 h-4 text-success-500 flex-shrink-0" />
              ) : !stage.success && stage.error ? (
                <XCircle className="w-4 h-4 text-error-500 flex-shrink-0" />
              ) : isRunning && index === stages.length - 1 ? (
                <Loader2 className="w-4 h-4 text-secondary-500 animate-spin flex-shrink-0" />
              ) : (
                <div className="w-4 h-4 flex-shrink-0" />
              )}

              {/* 阶段名称 */}
              <span className="text-sm flex-1">{stage.stage}</span>

              {/* 耗时 */}
              <span className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
                {stage.latencyMs > 0 ? `${stage.latencyMs}ms` : '-'}
              </span>

              {/* 进度条 */}
              {stage.progress !== undefined && (
                <div className="w-16 h-1.5 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary-500 transition-all"
                    style={{ width: `${stage.progress}%` }}
                  />
                </div>
              )}
            </div>

            {/* 错误信息 */}
            {stage.error && (
              <div className="ml-7 text-xs text-error-500">{stage.error}</div>
            )}

            {/* 连接线 */}
            {index < stages.length - 1 && (
              <div className="ml-3.5 w-px h-4 bg-neutral-200 dark:bg-neutral-700" />
            )}
          </React.Fragment>
        ))}

        {/* 空状态 */}
        {stages.length === 0 && isRunning && (
          <div className="flex items-center gap-2 text-sm text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>初始化执行阶段...</span>
          </div>
        )}
      </div>

      {/* 流程图示意 */}
      {stages.length > 1 && (
        <div className="mt-3 pt-3 border-t border-neutral-200 dark:border-neutral-700">
          <div className="flex items-center gap-1 text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] overflow-x-auto">
            {stages.map((stage, index) => (
              <React.Fragment key={index}>
                <span className="flex-shrink-0">{stage.stage.split(' ')[0]}</span>
                {index < stages.length - 1 && (
                  <ArrowRight className="w-3 h-3 flex-shrink-0" />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
