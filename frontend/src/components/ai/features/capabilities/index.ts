/**
 * Capabilities 层导出入口
 *
 * 参照 DeepSeek Harness Capability Seam 设计：
 * 每个 capability 是独立可插拔的能力单元
 */

// ===== Storage Capability =====
export { chatStorageService, type ChatStorageCapability, type SessionMeta, type SessionSummary } from './storage/ChatStorageService'
export { chatEventLog, type ChatEventLog, type SessionEvent, type SessionEventType } from './storage/ChatEventLog'

// ===== Streaming Capability =====
export { tokenBudgetManager, type TokenBudgetManager, type TokenEstimate } from './streaming/TokenBudgetManager'
export { contextCompactionEngine, type ContextCompactionEngine, type CompactionResult } from './streaming/ContextCompaction'

// ===== Session Capability =====
export { sessionCapability, type SessionCapability, type SessionForkOptions, type SessionResumeResult } from './session/SessionCapability'

// ===== Command Capability =====
export { slashCommandHandler, type SlashCommandHandlerService, type SlashCommandResult, type SlashCommandContext } from './command/SlashCommandHandler'

// ===== Delegation Capability =====
export { subagentDelegation, type SubagentDelegationService, type SubTask, type DelegationResult } from './delegation/SubagentDelegation'
