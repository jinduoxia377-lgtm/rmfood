import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  ChevronLeft, ChevronRight, SkipBack, SkipForward,
  ChevronDown, ChevronUp, Search, Filter,
  Lightbulb, Cog, Eye, FileText, Clock, CheckCircle, XCircle,
  Hash, BarChart3,
} from 'lucide-react';
import { clsx } from 'clsx';
import type {
  InferenceChain,
  InferenceStep,
  InferenceChainStats,
  FilterOptions,
} from '@/types/inference';
import {
  InferenceStepType,
  InferenceStepStatus,
} from '@/types/inference';
import InferenceStepCard from './InferenceStepCard';

interface InferenceChainVisualizerProps {
  chain: InferenceChain;
  autoScrollToActive?: boolean;
}

export default function InferenceChainVisualizer({ chain, autoScrollToActive = true }: InferenceChainVisualizerProps) {
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilter, setShowFilter] = useState(false);
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    stepTypes: Object.values(InferenceStepType),
    statuses: Object.values(InferenceStepStatus),
    searchQuery: '',
  });

  const stepsContainerRef = useRef<HTMLDivElement>(null);

  // 计算统计信息
  const stats: InferenceChainStats = useMemo(() => {
    const steps = chain.steps;
    const executionTimes = steps.filter(s => s.executionTime !== undefined).map(s => s.executionTime!);

    return {
      totalSteps: steps.length,
      thoughtCount: steps.filter(s => s.type === InferenceStepType.THOUGHT).length,
      actionCount: steps.filter(s => s.type === InferenceStepType.ACTION).length,
      observationCount: steps.filter(s => s.type === InferenceStepType.OBSERVATION).length,
      successCount: steps.filter(s => s.status === InferenceStepStatus.SUCCESS).length,
      failedCount: steps.filter(s => s.status === InferenceStepStatus.FAILED).length,
      totalExecutionTime: steps.reduce((sum, s) => sum + (s.executionTime || 0), 0),
      avgStepTime: executionTimes.length > 0
        ? Math.round(executionTimes.reduce((a, b) => a + b, 0) / executionTimes.length)
        : 0,
      maxStepTime: executionTimes.length > 0 ? Math.max(...executionTimes) : 0,
      minStepTime: executionTimes.length > 0 ? Math.min(...executionTimes) : 0,
    };
  }, [chain.steps]);

  // 过滤步骤
  const filteredSteps = useMemo(() => {
    return chain.steps.filter(step => {
      // 类型过滤
      if (!filterOptions.stepTypes.includes(step.type)) return false;
      // 状态过滤
      if (!filterOptions.statuses.includes(step.status)) return false;
      // 搜索过滤
      const searchLower = filterOptions.searchQuery.toLowerCase();
      if (searchLower) {
        const matchesTitle = step.title.toLowerCase().includes(searchLower);
        const matchesContent = step.content.toLowerCase().includes(searchLower);
        return matchesTitle || matchesContent;
      }
      return true;
    });
  }, [chain.steps, filterOptions]);

  // 切换步骤展开状态
  const handleToggleExpand = useCallback((stepId: string) => {
    setExpandedSteps(prev => {
      const newSet = new Set(prev);
      if (newSet.has(stepId)) {
        newSet.delete(stepId);
      } else {
        newSet.add(stepId);
      }
      return newSet;
    });
  }, []);

  // 展开所有步骤
  const handleExpandAll = useCallback(() => {
    const allStepIds = new Set(chain.steps.map(s => s.id));
    setExpandedSteps(allStepIds);
  }, [chain.steps]);

  // 折叠所有步骤
  const handleCollapseAll = useCallback(() => {
    setExpandedSteps(new Set());
  }, []);

  // 导航到特定步骤
  const handleNavigateTo = useCallback((stepIndex: number) => {
    if (stepIndex >= 0 && stepIndex < filteredSteps.length) {
      setCurrentStepIndex(stepIndex);
    }
  }, [filteredSteps.length]);

  // 上一步
  const handlePrevStep = useCallback(() => {
    if (currentStepIndex > 0) {
      handleNavigateTo(currentStepIndex - 1);
    }
  }, [currentStepIndex, handleNavigateTo]);

  // 下一步
  const handleNextStep = useCallback(() => {
    if (currentStepIndex < filteredSteps.length - 1) {
      handleNavigateTo(currentStepIndex + 1);
    }
  }, [currentStepIndex, filteredSteps.length, handleNavigateTo]);

  // 跳转到第一步
  const handleFirstStep = useCallback(() => {
    handleNavigateTo(0);
  }, [handleNavigateTo]);

  // 跳转到最后一步
  const handleLastStep = useCallback(() => {
    handleNavigateTo(filteredSteps.length - 1);
  }, [filteredSteps.length, handleNavigateTo]);

  // 步骤点击处理
  const handleStepClick = useCallback((stepId: string) => {
    const index = filteredSteps.findIndex(s => s.id === stepId);
    if (index !== -1) {
      setCurrentStepIndex(index);
    }
  }, [filteredSteps]);

  // 自动滚动到当前激活步骤
  useEffect(() => {
    if (autoScrollToActive && stepsContainerRef.current) {
      const activeStep = stepsContainerRef.current.querySelector('[data-active="true"]');
      if (activeStep) {
        activeStep.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [currentStepIndex, autoScrollToActive]);

  // 搜索同步
  useEffect(() => {
    setFilterOptions(prev => ({ ...prev, searchQuery }));
  }, [searchQuery]);

  // 获取当前步骤
  const currentStep: InferenceStep | undefined = filteredSteps[currentStepIndex];

  return (
    <div className="flex flex-col h-full bg-white rounded-xl border border-neutral-200 overflow-hidden">
      {/* 头部 */}
      <div className="px-6 py-4 border-b border-neutral-200 bg-gradient-to-r from-slate-50 to-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-neutral-900">{chain.title}</h2>
            {chain.description && (
              <p className="text-sm text-neutral-500 mt-1">{chain.description}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-neutral-500">
              步骤: {filteredSteps.length}/{chain.steps.length}
            </span>
          </div>
        </div>
      </div>

      {/* 统计信息栏 */}
      <div className="px-6 py-3 bg-slate-50 border-b border-neutral-200">
        <div className="flex flex-wrap items-center gap-4">
          <StatItem icon={Hash} label="总步骤" value={stats.totalSteps} />
          <StatItem icon={Lightbulb} label="思考" value={stats.thoughtCount} color="text-warning-600" />
          <StatItem icon={Cog} label="行动" value={stats.actionCount} color="text-secondary-600" />
          <StatItem icon={Eye} label="观察" value={stats.observationCount} color="text-success-600" />
          <StatItem icon={CheckCircle} label="成功" value={stats.successCount} color="text-success-500" />
          <StatItem icon={XCircle} label="失败" value={stats.failedCount} color="text-error-500" />
          <StatItem icon={Clock} label="总耗时" value={`${stats.totalExecutionTime}ms`} />
        </div>
      </div>

      {/* 工具栏 */}
      <div className="px-6 py-3 border-b border-neutral-100 flex items-center justify-between">
        {/* 导航控制 */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleFirstStep}
            disabled={currentStepIndex === 0}
            className="nav-btn"
            title="跳转到第一步"
          >
            <SkipBack className="w-4 h-4" />
          </button>
          <button
            onClick={handlePrevStep}
            disabled={currentStepIndex === 0}
            className="nav-btn"
            title="上一步"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="px-3 py-1 bg-neutral-100 rounded-full text-sm font-medium text-neutral-700 min-w-[80px] text-center">
            {currentStepIndex + 1} / {filteredSteps.length}
          </span>
          <button
            onClick={handleNextStep}
            disabled={currentStepIndex === filteredSteps.length - 1}
            className="nav-btn"
            title="下一步"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            onClick={handleLastStep}
            disabled={currentStepIndex === filteredSteps.length - 1}
            className="nav-btn"
            title="跳转到最后一步"
          >
            <SkipForward className="w-4 h-4" />
          </button>
        </div>

        {/* 操作按钮 */}
        <div className="flex items-center gap-2">
          {/* 搜索框 */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <input
              type="text"
              placeholder="搜索步骤..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-1.5 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-64"
            />
          </div>

          {/* 过滤器 */}
          <button
            onClick={() => setShowFilter(!showFilter)}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border transition-colors',
              showFilter
                ? 'bg-secondary-50 border-blue-300 text-secondary-700'
                : 'border-neutral-200 text-neutral-600 hover:bg-slate-50',
            )}
          >
            <Filter className="w-4 h-4" />
            过滤
          </button>

          {/* 展开/折叠按钮 */}
          <button
            onClick={handleExpandAll}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-neutral-200 rounded-lg text-neutral-600 hover:bg-slate-50 transition-colors"
          >
            <ChevronDown className="w-4 h-4" />
            展开全部
          </button>
          <button
            onClick={handleCollapseAll}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-neutral-200 rounded-lg text-neutral-600 hover:bg-slate-50 transition-colors"
          >
            <ChevronUp className="w-4 h-4" />
            折叠全部
          </button>
        </div>
      </div>

      {/* 过滤器面板 */}
      {showFilter && (
        <div className="px-6 py-3 bg-slate-50 border-b border-neutral-200">
          <div className="flex flex-wrap gap-6">
            {/* 类型过滤 */}
            <div>
              <label className="text-xs font-medium text-neutral-600 mb-1.5 block">步骤类型</label>
              <div className="flex flex-wrap gap-1.5">
                {Object.values(InferenceStepType).map(type => (
                  <button
                    key={type}
                    onClick={() => setFilterOptions(prev => ({
                      ...prev,
                      stepTypes: prev.stepTypes.includes(type)
                        ? prev.stepTypes.filter(t => t !== type)
                        : [...prev.stepTypes, type],
                    }))}
                    className={clsx(
                      'px-2.5 py-1 text-xs rounded-full border transition-colors',
                      filterOptions.stepTypes.includes(type)
                        ? 'bg-secondary-100 border-blue-300 text-secondary-700'
                        : 'bg-white border-neutral-200 text-neutral-500 hover:bg-slate-50',
                    )}
                  >
                    {typeLabels[type]}
                  </button>
                ))}
              </div>
            </div>

            {/* 状态过滤 */}
            <div>
              <label className="text-xs font-medium text-neutral-600 mb-1.5 block">步骤状态</label>
              <div className="flex flex-wrap gap-1.5">
                {Object.values(InferenceStepStatus).map(status => (
                  <button
                    key={status}
                    onClick={() => setFilterOptions(prev => ({
                      ...prev,
                      statuses: prev.statuses.includes(status)
                        ? prev.statuses.filter(s => s !== status)
                        : [...prev.statuses, status],
                    }))}
                    className={clsx(
                      'px-2.5 py-1 text-xs rounded-full border transition-colors',
                      filterOptions.statuses.includes(status)
                        ? 'bg-success-100 border-green-300 text-success-700'
                        : 'bg-white border-neutral-200 text-neutral-500 hover:bg-slate-50',
                    )}
                  >
                    {statusLabels[status]}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 步骤列表 */}
      <div
        ref={stepsContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50"
      >
        {filteredSteps.length > 0 ? (
          filteredSteps.map((step, index) => (
            <InferenceStepCard
              key={step.id}
              step={step}
              isExpanded={expandedSteps.has(step.id)}
              onToggleExpand={handleToggleExpand}
              isActive={index === currentStepIndex}
              onClick={handleStepClick}
              data-active={index === currentStepIndex}
            />
          ))
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-neutral-500">
            <BarChart3 className="w-12 h-12 mb-3 opacity-50" />
            <p>没有找到匹配的步骤</p>
            <p className="text-sm mt-1">请尝试调整过滤条件或搜索关键词</p>
          </div>
        )}
      </div>

      {/* 当前步骤信息栏 */}
      {currentStep && (
        <div className="px-6 py-3 border-t border-neutral-200 bg-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-neutral-700">当前步骤:</span>
              <span className="text-sm text-neutral-900">{currentStep.title}</span>
            </div>
            <div className="flex items-center gap-4 text-sm text-neutral-500">
              <span>类型: {typeLabels[currentStep.type]}</span>
              <span>状态: {statusLabels[currentStep.status]}</span>
              {currentStep.confidence !== undefined && (
                <span>置信度: {(currentStep.confidence * 100).toFixed(0)}%</span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// 类型标签
const typeLabels: Record<InferenceStepType, string> = {
  [InferenceStepType.THOUGHT]: '思考',
  [InferenceStepType.ACTION]: '行动',
  [InferenceStepType.OBSERVATION]: '观察',
  [InferenceStepType.SUMMARY]: '总结',
};

// 状态标签
const statusLabels: Record<InferenceStepStatus, string> = {
  [InferenceStepStatus.PENDING]: '等待',
  [InferenceStepStatus.RUNNING]: '执行中',
  [InferenceStepStatus.SUCCESS]: '成功',
  [InferenceStepStatus.FAILED]: '失败',
  [InferenceStepStatus.SKIPPED]: '跳过',
};

// 统计项组件
interface StatItemProps {
  icon: typeof Hash;
  label: string;
  value: number | string;
  color?: string;
}

function StatItem({ icon: Icon, label, value, color = 'text-neutral-600' }: StatItemProps) {
  return (
    <div className="flex items-center gap-1.5">
      <Icon className={clsx('w-4 h-4', color)} />
      <span className="text-xs text-neutral-500">{label}</span>
      <span className={clsx('text-sm font-semibold', color)}>{value}</span>
    </div>
  );
}
