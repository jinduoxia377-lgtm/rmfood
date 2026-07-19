/**
 * Features 模块统一导出 (v6.0)
 *
 * 提供统一的入口点，方便导入所有重构后的模块。
 *
 * @version 6.0.0
 */

// ===== 主组件（AI 页面的各个 Tab） =====
export { default as ChatTab } from './ChatTab'
export { GenerateTab } from './GenerateTab'
export { SafetyTab } from './SafetyTab'
export { SynergyTab } from './SynergyTab'
export { TastePredictTab } from './TastePredictTab'
export { StabilityPredictTab } from './StabilityPredictTab'

// Hooks
export { useChatMessages } from './hooks/useChatMessages'
export { useFormulaManager } from './hooks/useFormulaManager'
export { useReportGenerator } from './hooks/useReportGenerator'

// Components
export { FormulaPanel } from './components/FormulaPanel'
export { default as ChatInputArea } from './components/ChatInputArea'
export { ErrorBoundary, GlobalErrorBoundary, ModuleErrorBoundary } from './components/ErrorBoundary'
