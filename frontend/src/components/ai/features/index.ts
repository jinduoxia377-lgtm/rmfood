/**
 * Features 模块统一导出 (v7.0)
 *
 * 精简说明 (2026-07-22):
 * - AIAssistantPage.tsx 的 lazy import 已改为直接路径（避免 barrel export 链导致 Tree-shaking 失效）
 * - 仅保留外部消费者实际依赖的导出项
 * - 移除未使用的组件/Hook 重导出（GenerateTab, SafetyTab, SynergyTab 等已被 direct path 替代）
 *
 * @version 7.0.0
 */

// ===== 主组件（AI 页面直接导入） =====
export { default as ChatTab } from './ChatTab'

// ===== 通用组件 =====
export { FormulaPanel } from './components/FormulaPanel'
export { default as ChatInputArea } from './components/ChatInputArea'
export { ErrorBoundary, GlobalErrorBoundary, ModuleErrorBoundary } from './components/ErrorBoundary'
