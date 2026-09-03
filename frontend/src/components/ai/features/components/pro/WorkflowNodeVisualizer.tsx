/**
 * WorkflowNodeVisualizer — 工作流节点实时可视化组件
 *
 * 展示 Agent 工作流的执行阶段和节点状态，替代原有的 StageProgress 文字列表。
 *
 * @version 1.0.0
 */
import React, { useMemo } from 'react'
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
  Search,
  FlaskConical,
  ShieldCheck,
  FileText,
  Circle,
} from 'lucide-react'
import type { ExecutionStage } from '@/components/ai/shared/types'

interface WorkflowNodeVisualizerProps {
  stages: ExecutionStage[]
  isRunning: boolean
  workflowType: string
}

const WORKFLOW_STAGES: Record<string, { label: string; icon: React.ReactNode; desc: string }> = {
  formula_design: {
    label: '配方设计',
    icon: <FlaskConical className="w-4 h-4" />,
    desc: 'RAG检索 → 配方生成 → 合规检查 → 报告输出',
  },
  compliance_check: {
    label: '合规预审',
    icon: <ShieldCheck className="w-4 h-4" />,
    desc: '多维度合规检查 + 自动修复建议',
  },
  experiment_plan: {
    label: '实验方案',
    icon: <FileText className="w-4 h-4" />,
    desc: '配方 → 体外/体内实验设计 → 指标体系',
  },
  ingredient_lookup: {
    label: '原料查询',
    icon: <Search className="w-4 h-4" />,
    desc: '药材功效/法规/配伍禁忌查询',
  },
  full_pipeline: {
    label: '全流程',
    icon: <FlaskConical className="w-4 h-4" />,
    desc: 'RAG→配方→合规→实验→报告完整链路',
  },
}

const STAGE_COLORS: Record<string, string> = {
  running: 'text-blue-500 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
  success: 'text-success-500 bg-success-50 dark:bg-success-900/20 border-success-200 dark:border-success-800',
  failed: 'text-error-500 bg-error-50 dark:bg-error-900/20 border-error-200 dark:border-error-800',
  pending: 'text-neutral-400 bg-neutral-50 dark:bg-neutral-800/30 border-neutral-200 dark:border-neutral-700',
}

export function WorkflowNodeVisualizer({ stages, isRunning, workflowType }: WorkflowNodeVisualizerProps) {
  const currentWorkflow = WORKFLOW_STAGES[workflowType] || WORKFLOW_STAGES.formula_design

  const renderedStages = useMemo(() => {
    if (stages.length === 0) {
      // 默认阶段列表
      const defaults = ['RAG检索', '配方生成', '合规检查', '报告输出']
      return defaults.map((label, i) => ({
        label,
        icon: i === 0 ? <Search className="w-4 h-4" /> : i === 1 ? <FlaskConical className="w-4 h-4" /> : i === 2 ? <ShieldCheck className="w-4 h-4" /> : <FileText className="w-4 h-4" />,
        status: isRunning && i === 0 ? 'running' : !isRunning && i === 0 ? 'pending' : 'pending',
        latencyMs: 0,
      }))
    }
    return stages.map((s) => {
      const status = s.success ? 'success' : s.error ? 'failed' : isRunning ? 'running' : 'pending'
      return { label: s.stage, icon: <Clock className="w-4 h-4" />, status, latencyMs: s.latencyMs }
    })
  }, [stages, isRunning])

  if (!isRunning && renderedStages.every((s) => s.status === 'pending')) {
    return null
  }

  return (
    <div className="mt-4 p-4 bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700">
      {/* 工作流标题 */}
      <div className="flex items-center gap-2 mb-4">
        {currentWorkflow.icon}
        <span className="text-sm font-semibold text-neutral-900 dark:text-white">
          {currentWorkflow.label}工作流
        </span>
        {isRunning && (
          <span className="flex items-center gap-1 text-xs text-blue-500 animate-pulse">
            <Loader2 className="w-3 h-3 animate-spin" />
            执行中
          </span>
        )}
      </div>

      {/* 节点流程图 */}
      <div className="flex items-center gap-1 overflow-x-auto pb-2">
        {renderedStages.map((stage, index) => {
          const colorClass = STAGE_COLORS[stage.status] || STAGE_COLORS.pending
          return (
            <React.Fragment key={index}>
              <div
                className={`flex flex-col items-center gap-1.5 px-3 py-2 rounded-lg border min-w-[80px] transition-all duration-300 ${colorClass}`}
              >
                {stage.status === 'success' && <CheckCircle2 className="w-4 h-4" />}
                {stage.status === 'failed' && <XCircle className="w-4 h-4" />}
                {stage.status === 'running' && <Loader2 className="w-4 h-4 animate-spin" />}
                {stage.status === 'pending' && <Circle className="w-4 h-4" />}
                <span className="text-[11px] font-medium text-center leading-tight">{stage.label}</span>
                {stage.latencyMs > 0 && (
                  <span className="text-[9px] opacity-60">{stage.latencyMs}ms</span>
                )}
              </div>
              {index < renderedStages.length - 1 && (
                <ChevronRight className="w-4 h-4 text-neutral-300 dark:text-neutral-600 flex-shrink-0" />
              )}
            </React.Fragment>
          )
        })}
      </div>

      {/* 执行描述 */}
      <p className="mt-3 text-xs text-neutral-400 dark:text-neutral-500">
        {currentWorkflow.desc}
      </p>
    </div>
  )
}

function ChevronRight({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  )
}
