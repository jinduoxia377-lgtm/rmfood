import { memo, useCallback } from 'react';
import { ChevronDown, ChevronRight, CheckCircle, XCircle, Loader2, SkipForward, Lightbulb, Cog, Eye, FileText } from 'lucide-react';
import { clsx } from 'clsx';
import type { InferenceStep } from '@/types/inference';
import { InferenceStepType, InferenceStepStatus, ToolType } from '@/types/inference';

interface InferenceStepCardProps {
  step: InferenceStep;
  isExpanded: boolean;
  onToggleExpand: (stepId: string) => void;
  isActive?: boolean;
  onClick?: (stepId: string) => void;
}

const typeConfig: Record<InferenceStepType, { icon: typeof Lightbulb; label: string; color: string }> = {
  [InferenceStepType.THOUGHT]: { icon: Lightbulb, label: '思考', color: 'bg-warning-100 text-warning-800 border-amber-200' },
  [InferenceStepType.ACTION]: { icon: Cog, label: '行动', color: 'bg-secondary-100 text-secondary-800 border-blue-200' },
  [InferenceStepType.OBSERVATION]: { icon: Eye, label: '观察', color: 'bg-success-100 text-success-800 border-green-200' },
  [InferenceStepType.SUMMARY]: { icon: FileText, label: '总结', color: 'bg-accent-100 text-accent-800 border-purple-200' },
};

const statusConfig: Record<InferenceStepStatus, { icon: typeof CheckCircle; label: string; color: string }> = {
  [InferenceStepStatus.PENDING]: { icon: ChevronRight, label: '等待', color: 'text-neutral-400' },
  [InferenceStepStatus.RUNNING]: { icon: Loader2, label: '执行中', color: 'text-secondary-500 animate-spin' },
  [InferenceStepStatus.SUCCESS]: { icon: CheckCircle, label: '成功', color: 'text-success-500' },
  [InferenceStepStatus.FAILED]: { icon: XCircle, label: '失败', color: 'text-error-500' },
  [InferenceStepStatus.SKIPPED]: { icon: SkipForward, label: '跳过', color: 'text-neutral-400' },
};

const toolTypeLabels: Record<ToolType, string> = {
  [ToolType.SEARCH]: '搜索',
  [ToolType.DATABASE_QUERY]: '数据库查询',
  [ToolType.API_CALL]: 'API调用',
  [ToolType.CALCULATOR]: '计算',
  [ToolType.FORMULA_ANALYSIS]: '配方分析',
  [ToolType.SYNERGY_ANALYSIS]: '协同分析',
  [ToolType.SAFETY_CHECK]: '安全检查',
  [ToolType.FILE_READ]: '文件读取',
  [ToolType.REPORT_GENERATION]: '报告生成',
};

const MemoizedInferenceStepCard = memo(({
  step,
  isExpanded,
  onToggleExpand,
  isActive = false,
  onClick,
}: InferenceStepCardProps) => {
  const { type, status, index, title, content, toolCall, toolResult, confidence, executionTime, depth = 0 } = step;

  const typeInfo = typeConfig[type];
  const statusInfo = statusConfig[status];
  const StatusIcon = statusInfo.icon;
  const TypeIcon = typeInfo.icon;

  const handleToggle = useCallback(() => {
    onToggleExpand(step.id);
  }, [step.id, onToggleExpand]);

  const handleClick = useCallback(() => {
    onClick?.(step.id);
  }, [onClick, step.id]);

  return (
    <div
      className={clsx(
        'group rounded-lg border transition-all duration-200 cursor-pointer',
        isActive ? 'border-blue-400 bg-secondary-50 shadow-md' : 'border-neutral-200 bg-white dark:bg-neutral-900 hover:border-neutral-300 hover:shadow-sm',
        depth > 0 && 'ml-6 border-l-4',
      )}
      onClick={handleClick}
    >
      {/* 头部 - 可点击区域 */}
      <div
        className="flex items-center gap-3 p-4"
         role="button" tabIndex={0} onClick={handleToggle}
      >
        {/* 折叠/展开指示器 */}
        <button
          className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            handleToggle();
          }}
        >
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-neutral-600" />
          ) : (
            <ChevronRight className="w-4 h-4 text-neutral-600" />
          )}
        </button>

        {/* 步骤索引 */}
        <span className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-800 text-sm font-medium text-neutral-600">
          {index + 1}
        </span>

        {/* 类型标签 */}
        <span className={clsx(
          'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border',
          typeInfo.color,
        )}>
          <TypeIcon className="w-3 h-3" />
          {typeInfo.label}
        </span>

        {/* 状态指示器 */}
        <StatusIcon className={clsx('w-4 h-4 flex-shrink-0', statusInfo.color)} />

        {/* 标题 */}
        <span className="flex-1 font-medium text-neutral-800 truncate group-hover:text-secondary-600 transition-colors">
          {title}
        </span>

        {/* 置信度 */}
        {confidence !== undefined && (
          <span className="flex-shrink-0 text-xs text-neutral-500">
            {(confidence * 100).toFixed(0)}%
          </span>
        )}

        {/* 执行耗时 */}
        {executionTime !== undefined && (
          <span className="flex-shrink-0 text-xs text-neutral-400">
            {executionTime}ms
          </span>
        )}
      </div>

      {/* 展开内容 */}
      <div
        className={clsx(
          'overflow-hidden transition-all duration-300',
          isExpanded ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0',
        )}
      >
        <div className="px-4 pb-4 pt-0">
          {/* 内容区域 */}
          <div className="pl-15 mt-3 p-3 bg-slate-50 dark:bg-neutral-800 rounded-lg">
            <p className="text-sm text-neutral-700 leading-relaxed whitespace-pre-wrap">
              {content}
            </p>
          </div>

          {/* 工具调用信息（仅Action类型） */}
          {type === InferenceStepType.ACTION && toolCall && (
            <div className="mt-3 pl-15">
              <div className="p-3 bg-secondary-50 rounded-lg border border-blue-100">
                <div className="flex items-center gap-2 mb-2">
                  <Cog className="w-4 h-4 text-secondary-600" />
                  <span className="text-sm font-medium text-secondary-800">工具调用</span>
                </div>
                <div className="text-sm text-neutral-700">
                  <div className="font-medium">{toolCall.toolName}</div>
                  <div className="text-xs text-neutral-500 mt-1">
                    类型: {toolTypeLabels[toolCall.toolType]}
                  </div>
                  {toolCall.description && (
                    <div className="text-xs text-neutral-600 mt-2">{toolCall.description}</div>
                  )}
                  {/* 参数列表 */}
                  {toolCall.parameters.length > 0 && (
                    <div className="mt-2">
                      <div className="text-xs font-medium text-neutral-600 mb-1">参数:</div>
                      <div className="space-y-1">
                        {toolCall.parameters.map((param, idx) => (
                          <div key={idx} className="flex items-start gap-2 text-xs">
                            <span className="font-medium text-neutral-700">{param.name}:</span>
                            <span className="text-neutral-600">
                              {typeof param.value === 'object'
                                ? JSON.stringify(param.value, null, 2)
                                : String(param.value)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 工具执行结果 */}
          {toolResult && (
            <div className="mt-3 pl-15">
              <div className={clsx(
                'p-3 rounded-lg border',
                toolResult.success
                  ? 'bg-success-50 border-green-100'
                  : 'bg-error-50 border-red-100',
              )}>
                <div className="flex items-center gap-2 mb-2">
                  {toolResult.success ? (
                    <CheckCircle className="w-4 h-4 text-success-600" />
                  ) : (
                    <XCircle className="w-4 h-4 text-error-600" />
                  )}
                  <span className={clsx(
                    'text-sm font-medium',
                    toolResult.success ? 'text-success-800' : 'text-error-800',
                  )}>
                    {toolResult.success ? '执行成功' : '执行失败'}
                  </span>
                </div>
                {toolResult.message && (
                  <div className="text-sm text-neutral-700">{toolResult.message}</div>
                )}
                {toolResult.error && (
                  <div className="text-sm text-error-600">{toolResult.error}</div>
                )}
                {toolResult.data && (
                  <div className="mt-2">
                    <div className="text-xs font-medium text-neutral-600 mb-1">返回数据:</div>
                    <pre className="text-xs text-neutral-700 bg-white dark:bg-neutral-900 p-2 rounded border overflow-x-auto max-h-48 overflow-y-auto">
                      {JSON.stringify(toolResult.data, null, 2)}
                    </pre>
                  </div>
                )}
                {toolResult.executionTime && (
                  <div className="mt-2 text-xs text-neutral-500">
                    执行耗时: {toolResult.executionTime}ms
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

export default MemoizedInferenceStepCard;
