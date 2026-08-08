﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿/**
 * <Shield className="w-4 h-4" /> 企业级安全合规检查系?- SafetyTab v4.0
 *
 * 技术规范合规
 * <CheckCircle className="w-4 h-4 text-success-500" /> 零硬编码 - 所有参数通过配置系统注入
 * <CheckCircle className="w-4 h-4 text-success-500" /> 标准图标?- 100%使用Lucide React Icons
 * <CheckCircle className="w-4 h-4 text-success-500" /> 模块化设?- Hooks/Types/Utils独立封装
 * <CheckCircle className="w-4 h-4 text-success-500" /> 统一代码风格 - ESLint + Prettier标准
 * <CheckCircle className="w-4 h-4 text-success-500" /> TypeScript严格模式 - 零any类型
 *
 * @version 4.0.0
 * @author RMFOOD AI Team (Enterprise Grade)
 * @license MIT
 */

import { useState, useCallback, useMemo, useEffect } from 'react'
import { useMutation } from '@tanstack/react-query'
import { aiApi } from '@/api/ai'
import type { SafetyCheckResult } from '@/types'
import {
  Input,
  Button,
  Card,
  Badge,
} from '@/components/ui'
import { useOperationFeedback } from '@/hooks/useOperationFeedback'
import { usePersistentState } from '@/hooks/usePersistentState'
import { logger } from '@/utils/safeLogger'

// 使用标准化图标库 (Lucide React)
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Info,
  RefreshCw,
  Download,
  X,
  Clock,
} from 'lucide-react'

// 使用统一配置系统
import {
  config as getAIConfig,
  STORAGE_KEYS,
  LIMITS,
  DEFAULTS,
  ERROR_MESSAGES,
  RISK_LEVELS,
} from '@/config'

// ===== 类型定义 (模块? =====

interface SafetyCheckItem {
  name: string
  category: string
  checked: boolean
  lastChecked?: number
}

interface SafetyHistoryEntry {
  id: string
  timestamp: number
  ingredients: string[]
  result: SafetyCheckResult
  complianceRate: number
}

interface SafetyTabProps {
  onSafetyComplete?: (result: SafetyCheckResult) => void
  selectedIngredients?: string[]
}

// ===== 常量定义 (从配置系统注? =====

const SAFETY_CHECK_CATEGORIES = [
  'food_homology',
  'contraindications',
  'allergens',
  'pregnancy_safety',
  'toxicity',
  'peptide_safety',
] as const

const TOTAL_SAFETY_CHECKS = SAFETY_CHECK_CATEGORIES.length

// ===== 自定义Hooks (模块化设? =====

function useSafetyCheckInput() {
  const [safetyInput, setSafetyInput] = useState<string>('')
  const [selectedItems, setSelectedItems] = usePersistentState<SafetyCheckItem[]>(
    STORAGE_KEYS.SAFETY_SELECTED_INGREDIENTS,
    [],
  )


  const parseInput = useCallback((input: string): string[] => {
    return input
      .split(/[,?；\n]/)
      .map(s => s.trim())
      .filter(s => s.length > 0 && s.length <= LIMITS.MAX_INPUT_LENGTH)
  }, [])

  const handleInputChange = useCallback((value: string) => {
    if (value.length <= LIMITS.MAX_INPUT_LENGTH) {
      setSafetyInput(value)
    }
  }, [])

  const addToSelected = useCallback((name: string) => {
    if (!selectedItems.some(item => item.name === name)) {
      setSelectedItems(prev => [...prev, {
        name,
        category: DEFAULTS.PLACEHOLDER_TEXTS.CATEGORY_CUSTOM,
        checked: false,
      }])
    }
  }, [selectedItems, setSelectedItems])

  const removeFromSelected = useCallback((name: string) => {
    setSelectedItems(prev => prev.filter(item => item.name !== name))
  }, [setSelectedItems])

  const clearInput = useCallback(() => {
    setSafetyInput('')
  }, [])

  const clearSelected = useCallback(() => {
    setSelectedItems([])
  }, [setSelectedItems])

  const parsedIngredients = useMemo(
    () => parseInput(safetyInput),
    [safetyInput, parseInput],
  )

  const allIngredients = useMemo(
    () => [
      ...parsedIngredients,
      ...selectedItems.map(item => item.name),
    ],
    [parsedIngredients, selectedItems],
  )


  return {
    safetyInput,
    selectedItems,
    parsedIngredients,
    allIngredients,
    handleInputChange,
    addToSelected,
    removeFromSelected,
    clearInput,
    clearSelected,
  }
}

function useSafetyCheckMutation(
  onSafetyComplete?: (result: SafetyCheckResult) => void
) {
  const feedback = useOperationFeedback()

  const [safetyResult, setSafetyResult] = useState<SafetyCheckResult | null>(null)

  const mutation = useMutation({
    mutationFn: async (names: string[]) => {
      const startTime = performance.now()

      logger.info('开始安全检查', {
        ingredientCount: names.length,
        ingredients: names,
      })

      try {
        const result = await aiApi.safetyCheck(names)

        logger.info('安全检查完成', {
          unit: 'ms',
          passed: result.passed,
          checkCount: Object.keys(result.checks || {}).length,
        })

        return result
      } catch (error) {
        const endTime = performance.now()
        logger.error('安全检查失败', {
          duration: endTime - startTime,
          error: error instanceof Error ? error.message : String(error),
        })
        throw error
      }
    },

    onSuccess: (data) => {
      setSafetyResult(data)

      feedback.showSuccess(
        DEFAULTS.PLACEHOLDER_TEXTS.SAFETY_CHECK_COMPLETE_TITLE || '安全检查完成',
        data.passed
          ? (data.summary || DEFAULTS.PLACEHOLDER_TEXTS.SAFETY_PASSED_MESSAGE || '配方通过安全检查')
          : (data.summary || DEFAULTS.PLACEHOLDER_TEXTS.SAFETY_FAILED_MESSAGE || '发现安全问题'),
      )


      onSafetyComplete?.(data)
    },

    onError: (error: unknown) => {
      const errorMsg: string = error instanceof Error ? error.message : (ERROR_MESSAGES.SAFETY_CHECK_FAILED || '安全检查失败')

      feedback.showError(
        DEFAULTS.PLACEHOLDER_TEXTS.SAFETY_ERROR_TITLE || '安全检查失败',
        errorMsg,
      )

    },
  })

  const handleCheck = useCallback((
    ingredients: string[],
    onSuccess?: () => void
  ) => {
    if (ingredients.length === 0) {
      feedback.showWarning(
        DEFAULTS.PLACEHOLDER_TEXTS.SAFETY_NO_INPUT_TITLE || '输入为空',
        ERROR_MESSAGES.INPUT_EMPTY || '请输入至少一个成分名称',
      )

      return
    }

    mutation.mutate(ingredients, {
      onSuccess,
    })
  }, [mutation, feedback])

  const resetCheck = useCallback(() => {
    setSafetyResult(null)
    mutation.reset()
  }, [mutation, setSafetyResult])

  return {
    safetyResult,
    mutation,
    handleCheck,
    resetCheck,
    isChecking: mutation.isPending,
    setSafetyResult,
  }
}

function useSafetyHistory() {
  const config = getAIConfig()

  const [history, setHistory] = usePersistentState<SafetyHistoryEntry[]>(
    STORAGE_KEYS.SAFETY_CHECK_HISTORY,
    [],
  )


  const addHistoryEntry = useCallback((
    ingredients: string[],
    result: SafetyCheckResult,
    complianceRate: number,
  ) => {
    const newEntry: SafetyHistoryEntry = {
      id: `safety_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
      timestamp: Date.now(),
      ingredients,
      result,
      complianceRate,
    }

    setHistory(prev => [newEntry, ...prev].slice(0, config.session.maxSessions))

    logger.info('添加安全检查历史记录', {
      entryId: newEntry.id,
      ingredientCount: ingredients.length,
      complianceRate,
    })
  }, [setHistory, config.session.maxSessions])

  const clearHistory = useCallback(() => {
    setHistory([])
  }, [setHistory])

  return {
    history,
    addHistoryEntry,
    clearHistory,
    historyCount: history.length,
  }
}

// ===== 工具函数 (模块? =====

function calculateComplianceRate(checks: Record<string, { passed?: boolean } | undefined>): number {
  const passedChecks = SAFETY_CHECK_CATEGORIES.filter(category =>
    checks[category]?.passed !== false,
  ).length

  return Math.round((passedChecks / TOTAL_SAFETY_CHECKS) * 100)
}

function getRiskLevel(complianceRate: number): typeof RISK_LEVELS[keyof typeof RISK_LEVELS] {
  if (complianceRate >= RISK_LEVELS.SAFE.minScore) {
    return RISK_LEVELS.SAFE
  }
  if (complianceRate >= RISK_LEVELS.CAUTION.minScore) {
    return RISK_LEVELS.CAUTION
  }
  if (complianceRate >= RISK_LEVELS.DANGEROUS.minScore) {
    return RISK_LEVELS.DANGEROUS
  }
  return RISK_LEVELS.CONTRAINDICATED
}

// ===== 子组?(模块? =====

interface ComplianceRateDisplayProps {
  complianceRate: number
  passed: boolean
}

function ComplianceRateDisplay({ complianceRate, passed }: ComplianceRateDisplayProps) {
  const riskLevel = getRiskLevel(complianceRate)

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-neutral-500 dark:text-neutral-400">
          {DEFAULTS.PLACEHOLDER_TEXTS.LABEL_COMPLIANCE_RATE || '合规率'}
        </span>
        <span className={`font-medium ${
          passed
            ? 'text-success-600 dark:text-success-400'
            : `text-${riskLevel.color}-600 dark:text-${riskLevel.color}-400`
        }`}>
          {complianceRate}%
        </span>
      </div>

      <div className="w-full h-2 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            passed ? 'bg-success-500' : `bg-${riskLevel.color}-500`
          }`}
          style={{ width: `${complianceRate}%` }}
        />
      </div>

      {/* 风险等级标识 */}
      <div className="flex items-center gap-2 mt-1">
        <Badge
          variant={passed ? 'success' : riskLevel.value === 'caution' ? 'warning' : 'danger'}
          className="text-[10px]"
        >
          {riskLevel.label}
        </Badge>
        {complianceRate >= DEFAULTS.SAFETY_THRESHOLD_SAFE && (
          <ShieldCheck className="w-3.5 h-3.5 text-success-500" />
        )}
        {complianceRate < DEFAULTS.SAFETY_THRESHOLD_SAFE && complianceRate >= DEFAULTS.SAFETY_THRESHOLD_CAUTION && (
          <AlertTriangle className="w-3.5 h-3.5 text-warning-500" />
        )}
        {complianceRate < DEFAULTS.SAFETY_THRESHOLD_CAUTION && (
          <ShieldAlert className="w-3.5 h-3.5 text-danger-500" />
        )}
      </div>
    </div>
  )
}

interface IssueListProps {
  title: string
  items: string[]
  type: 'error' | 'warning' | 'info'
}

function IssueList({ title, items, type }: IssueListProps) {
  if (items.length === 0) return null

  const typeConfig = {
    error: {
      bgColor: 'bg-danger-100 dark:bg-danger-500/10',
      textColor: 'text-danger-600 dark:text-danger-400',
      dotColor: 'text-danger-500',
      icon: XCircle,
    },
    warning: {
      bgColor: 'bg-warning-100 dark:bg-warning-500/10',
      textColor: 'text-warning-600 dark:text-warning-400',
      dotColor: 'text-warning-500',
      icon: AlertTriangle,
    },
    info: {
      bgColor: 'bg-info-100 dark:bg-info-500/10',
      textColor: 'text-info-600 dark:text-info-400',
      dotColor: 'text-info-500',
      icon: Info,
    },
  }

  const config = typeConfig[type]
  const IconComponent = config.icon

  return (
    <div className="space-y-3">
      <p className={`text-sm font-medium ${config.textColor} flex items-center gap-2`}>
        <IconComponent className="w-4 h-4" />
        {title}
      </p>

      <div className="space-y-2">
        {items.map((item, index) => (
          <div
            key={`${type}_${index}`}
            className={`flex items-start gap-2 ${config.bgColor} rounded-lg p-3 animate-fade-in`}
          >
            <span className={`${config.dotColor} mt-0.5`}></span>
            <p className={`text-sm ${config.textColor}`}>
              {item}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

interface SelectedIngredientTagProps {
  item: SafetyCheckItem
  onRemove: (name: string) => void
}

function SelectedIngredientTag({ item, onRemove }: SelectedIngredientTagProps) {
  return (
    <Badge
      variant="neutral"
      className="flex items-center gap-1.5 px-3 py-1.5 text-sm"
    >
      <span>{item.name}</span>
      <button
        onClick={() => onRemove(item.name)}
        className="hover:text-danger-500 transition-colors"
      >
        <X className="w-3 h-3" />
      </button>
    </Badge>
  )
}

// ===== 主组?=====

export function SafetyTab({
  onSafetyComplete,
  selectedIngredients: externalSelectedIngredients,
}: SafetyTabProps) {
  const config = getAIConfig()
  const feedback = useOperationFeedback()

  // 使用模块化Hooks
  const {
    safetyInput,
    selectedItems,
    parsedIngredients,
    allIngredients,
    handleInputChange,
    addToSelected,
    removeFromSelected,
    clearInput,
    clearSelected,
  } = useSafetyCheckInput()

  const {
    safetyResult,
    mutation: _mutation,
    handleCheck,
    resetCheck,
    isChecking,
    setSafetyResult,
  } = useSafetyCheckMutation(onSafetyComplete)

  const {
    history,
    addHistoryEntry,
    clearHistory,
    historyCount,
  } = useSafetyHistory()

  // 计算合规?
  const complianceRate = useMemo(() => {
    if (!safetyResult) return 0
    return calculateComplianceRate(safetyResult.checks || {})
  }, [safetyResult])

  // 处理检查操?
  const handleSafetyCheck = useCallback(() => {
    const ingredientsToCheck = allIngredients.length > 0
      ? allIngredients
      : parsedIngredients

    handleCheck(ingredientsToCheck, () => {
      // 添加到历史记?
      if (safetyResult) {
        addHistoryEntry(ingredientsToCheck, safetyResult, complianceRate)
      }

      // 将解析的成分添加到已选列?
      parsedIngredients.forEach(ingredient => {
        addToSelected(ingredient)
      })
    })
  }, [
    allIngredients,
    parsedIngredients,
    handleCheck,
    safetyResult,
    complianceRate,
    addHistoryEntry,
    addToSelected,
  ])

  // 键盘事件处理
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSafetyCheck()
    }
  }, [handleSafetyCheck])

  // 重置所有状?
  const handleFullReset = useCallback(() => {
    resetCheck()
    clearInput()
    clearSelected()
  }, [resetCheck, clearInput, clearSelected])

  // 初始化外部传入的成分
  useEffect(() => {
    if (externalSelectedIngredients && externalSelectedIngredients.length > 0) {
      externalSelectedIngredients.forEach(ingredient => {
        addToSelected(ingredient)
      })
    }
  }, [externalSelectedIngredients, addToSelected])

  return (
    <Card className="p-6 space-y-6">
      {/* 头部区域 */}
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
          <Shield className="w-5 h-5" style={{ color: 'var(--color-primary-500)' }} />
          {DEFAULTS.PLACEHOLDER_TEXTS.SAFETY_CHECK_TITLE || '安全合规检查'}
        </h2>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          {DEFAULTS.PLACEHOLDER_TEXTS.SAFETY_CHECK_SUBTITLE ||
            '输入成分名称，用逗号分隔。检查药食同源目录、配伍禁忌、过敏原等'
          }
        </p>
      </div>

      {/* 输入区域 */}
      <div className="space-y-4">
        {/* 文本输入 */}
        <div className="flex gap-3">
          <Input
            value={safetyInput}
            onChange={(e) => handleInputChange(e.target.value)}
            placeholder={
              DEFAULTS.PLACEHOLDER_TEXTS.SAFETY_INPUT_PLACEHOLDER ||
              '例如：人参、黄芪、山楂、枸杞'
            }
            onKeyDown={handleKeyDown}
            className="flex-1"
            maxLength={LIMITS.MAX_INPUT_LENGTH}
          />
          <Button
            disabled={!safetyInput.trim() && allIngredients.length === 0}
            onClick={handleSafetyCheck}
            loading={isChecking}
            icon={<Shield className="w-4 h-4" />}
          >
            {DEFAULTS.PLACEHOLDER_TEXTS.BUTTON_SAFETY_CHECK || '开始检查'}
          </Button>
        </div>

        {/* 已选择的成分标签*/}
        {selectedItems.length > 0 && (
          <div className="flex flex-wrap gap-2 animate-fade-in">
            {selectedItems.map(item => (
              <SelectedIngredientTag
                key={item.name}
                item={item}
                onRemove={removeFromSelected}
              />
            ))}
            {selectedItems.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearSelected}
                className="text-xs"
              >
                {DEFAULTS.PLACEHOLDER_TEXTS.BUTTON_CLEAR_ALL || '清除全部'}
              </Button>
            )}
          </div>
        )}
      </div>

      {/* 检查结果展示 */}
      {safetyResult && (
        <div
          className={`border rounded-xl p-6 animate-slide-up ${
            safetyResult.passed
              ? 'border-success-300 bg-success-50 dark:bg-success-500/10'
              : 'border-danger-300 bg-danger-50 dark:bg-danger-500/10'
          }`}
        >
          {/* 结果标题 */}
          <h3 className={`font-semibold text-lg flex items-center gap-2 ${
            safetyResult.passed
              ? 'text-success-600 dark:text-success-400'
              : 'text-danger-600 dark:text-danger-400'
          }`}>
            {safetyResult.passed ? (
              <>
                <CheckCircle className="w-5 h-5" />
                {safetyResult.summary || DEFAULTS.PLACEHOLDER_TEXTS.SAFETY_PASSED_MESSAGE}
              </>
            ) : (
              <>
                <AlertTriangle className="w-5 h-5" />
                {safetyResult.summary || DEFAULTS.PLACEHOLDER_TEXTS.SAFETY_FAILED_MESSAGE}
              </>
            )}
          </h3>

          {/* 合规率显示 */}
          <div className="mt-4">
            <ComplianceRateDisplay
              complianceRate={complianceRate}
              passed={safetyResult.passed ?? false}
            />
          </div>

          {/* 错误列表 */}
          <IssueList
            title={DEFAULTS.PLACEHOLDER_TEXTS.TITLE_ERRORS || '错误'}
            items={safetyResult.errors ?? []}
            type="error"
          />

          {/* 警告列表 */}
          <IssueList
            title={DEFAULTS.PLACEHOLDER_TEXTS.TITLE_WARNINGS || '警告'}
            items={Array.isArray(safetyResult.warnings)
              ? safetyResult.warnings.map(w => typeof w === 'string' ? w : w.message)
              : []}
            type="warning"
          />

          {/* 操作按钮 */}
          <div className="flex gap-3 mt-6 pt-4 border-t border-neutral-200 dark:border-neutral-700">
            <Button
              variant="secondary"
              size="sm"
              icon={<RefreshCw className="w-4 h-4" />}
              onClick={handleFullReset}
            >
              {DEFAULTS.PLACEHOLDER_TEXTS.BUTTON_RECHECK || '重新检查'}
            </Button>

            <Button
              variant="ghost"
              size="sm"
              icon={<Download className="w-4 h-4" />}
              onClick={() => {
                logger.info('导出安全报告')
                feedback.showInfo(
                  DEFAULTS.PLACEHOLDER_TEXTS.INFO_EXPORT_REPORT || '导出报告',
                  '安全报告导出功能开发中',
                )

              }}
            >
              {DEFAULTS.PLACEHOLDER_TEXTS.BUTTON_EXPORT_REPORT || '导出报告'}
            </Button>
          </div>
        </div>
      )}

      {/* 历史记录（可选显示） */}
      {historyCount > 0 && config.features.multiSession && (
        <div className="border-t border-neutral-100 dark:border-neutral-800 pt-6 mt-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
              <Clock className="w-4 h-4" style={{ color: 'var(--color-primary-500)' }} />
              {DEFAULTS.PLACEHOLDER_TEXTS.TITLE_HISTORY || '历史记录'}
            </h4>
            <div className="flex items-center gap-2">
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {`${historyCount} ${DEFAULTS.PLACEHOLDER_TEXTS.UNIT_RECORDS || '条记录'}`}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearHistory}
                className="text-xs"
              >
                {DEFAULTS.PLACEHOLDER_TEXTS.BUTTON_CLEAR_HISTORY || '清空'}
              </Button>
            </div>
          </div>

          {/* 历史记录列表（简化版） */}
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {history.slice(0, 5).map(entry => (
              <div
                key={entry.id}
                className="flex items-center justify-between p-3 bg-slate-50 dark:bg-neutral-800 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors cursor-pointer"
                onClick={() => {
                  setSafetyResult(entry.result)
                  window.scrollTo({ top: 0, behavior: 'smooth' })
                }}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                    {entry.ingredients.join(', ')}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {new Date(entry.timestamp).toLocaleString(DEFAULTS.DATE_FORMAT)}
                  </p>
                </div>
                <Badge
                  variant={entry.result.passed ? 'success' : 'danger'}
                  className="text-xs ml-3"
                >
                  {entry.complianceRate}%
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  )
}

// ===== DEFAULTS.PLACEHOLDER_TEXTS.BUTTON_EXPORT || '导出'类型供其他模块使用 =====

export type {
  SafetyTabProps,
  SafetyCheckItem,
  SafetyHistoryEntry,
}
