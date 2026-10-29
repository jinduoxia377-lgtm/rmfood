/**
 * WorkflowNodeVisualizer — 工作流节点实时可视化组件
 *
 * 展示 Agent 工作流的执行阶段和节点状态，替代原有的 StageProgress 文字列表。
 *
 * @version 1.0.0
 */
import React, { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
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

/** 工作流类型 → pages.agent.workflowStage* 的 key（标题/描述） */
const WORKFLOW_STAGES: Record<string, { titleKey: string; descKey: string; icon: React.ReactNode }> = {
  formula_design: {
    titleKey: 'workflowStageFormula',
    descKey: 'workflowStageFormulaDesc',
    icon: <FlaskConical className="w-4 h-4" />,
  },
  compliance_check: {
    titleKey: 'workflowStageCompliance',
    descKey: 'workflowStageComplianceDesc',
    icon: <ShieldCheck className="w-4 h-4" />,
  },
  experiment_plan: {
    titleKey: 'workflowStageExperiment',
    descKey: 'workflowStageExperimentDesc',
    icon: <FileText className="w-4 h-4" />,
  },
  ingredient_lookup: {
    titleKey: 'workflowStageIngredient',
    descKey: 'workflowStageIngredientDesc',
    icon: <Search className="w-4 h-4" />,
  },
  full_pipeline: {
    titleKey: 'workflowStageFull',
    descKey: 'workflowStageFullDesc',
    icon: <FlaskConical className="w-4 h-4" />,
  },
}

/** 已知节点标签 → pages.agent.workflowNode* 的 key；未知节点回退原始值 */
const NODE_LABEL_KEYS: Record<string, string> = {
  'RAG检索': 'workflowNodeRag',
  '配方生成': 'workflowNodeFormula',
  '合规检查': 'workflowNodeCompliance',
  '报告输出': 'workflowNodeReport',
}

const STAGE_COLORS: Record<string, string> = {
  running: 'text-secondary-500 bg-secondary-50 dark:bg-secondary-300/20 border-secondary-200 dark:border-secondary-800',
  success: 'text-success-500 bg-success-50 dark:bg-success-300/20 border-success-200 dark:border-success-800',
  failed: 'text-error-500 bg-error-50 dark:bg-error-300/20 border-error-200 dark:border-error-800',
  pending: 'text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] bg-neutral-50 dark:bg-neutral-800/30 border-neutral-200 dark:border-neutral-700',
}

export function WorkflowNodeVisualizer({ stages, isRunning, workflowType }: WorkflowNodeVisualizerProps) {
  const { t } = useTranslation()
  const currentWorkflow = WORKFLOW_STAGES[workflowType] || WORKFLOW_STAGES.formula_design
  /** 节点标签本地化：已知节点用 i18n，未知回退原始 */
  const nodeLabel = (label: string) =>
    NODE_LABEL_KEYS[label] ? t(`pages.agent.${NODE_LABEL_KEYS[label]}`) : label

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
          {t(`pages.agent.${currentWorkflow.titleKey}`)}
        </span>
        {isRunning && (
          <span className="flex items-center gap-1 text-xs text-secondary-500 animate-pulse">
            <Loader2 className="w-3 h-3 animate-spin" />
            {t('pages.agent.workflowRunning')}
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
                <span className="text-xs font-medium text-center leading-tight">{nodeLabel(stage.label)}</span>
                {stage.latencyMs > 0 && (
                  <span className="text-xs opacity-60">{stage.latencyMs}ms</span>
                )}
              </div>
              {index < renderedStages.length - 1 && (
                <ChevronRight className="w-4 h-4 text-neutral-300 dark:text-neutral-400 flex-shrink-0" />
              )}
            </React.Fragment>
          )
        })}
      </div>

      {/* 执行描述 */}
      <p className="mt-3 text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
        {t(`pages.agent.${currentWorkflow.descKey}`)}
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
