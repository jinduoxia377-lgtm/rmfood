import type { User } from './index'
/**
 * 统一 API 类型定义
 * 用于减少代码中的 `any` 使用，提高类型安全性
 */

// ============ 基础类型 ============

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface PaginationParams {
  page?: number
  pageSize?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

// ============ 用户相关（从 index.ts 导入完整定义） ============

export type { User, UserRole } from './index'

export interface LoginRequest {
  username: string
  password: string
}

export interface LoginResponse {
  token: string
  refreshToken: string
  user: User
  expiresIn: number
}

// ============ 配方相关 ============

export interface Formula {
  id: string
  name: string
  description?: string
  status: FormulaStatus
  category: string
  tags: string[]
  ingredients: Ingredient[]
  effects: string[]
  scores: FormulaScores
  creatorId: string
  createdAt: string
  updatedAt: string
}

export type FormulaStatus = 'draft' | 'active' | 'archived' | 'deleted'

export interface Ingredient {
  id: string
  name: string
  dosage: string
  role: IngredientRole
  properties?: Record<string, unknown>
}

export type IngredientRole = 'monarch' | 'minister' | 'assistant' | 'courier'

export interface FormulaScores {
  synergy: number
  taste: number
  stability: number
  overall: number
}

export interface CreateFormulaRequest {
  name: string
  description?: string
  ingredients: Omit<Ingredient, 'id'>[]
  category?: string
  tags?: string[]
}

export type UpdateFormulaRequest = Partial<CreateFormulaRequest>;

// ============ 实验相关 ============

export interface Experiment {
  formula_name?: string;
  id: string
  formulaId: string
  name: string
  status: ExperimentStatus
  results?: ExperimentResult
  notes?: string
  startDate?: string
  endDate?: string
  createdAt: string
  updatedAt: string
}

export type ExperimentStatus = 'planned' | 'in_progress' | 'completed' | 'cancelled'

export interface ExperimentResult {
  successRate: number
  observations: string[]
  metrics?: Record<string, number>
}

// ============ 数据库记录相关 ============

export interface DatabaseRecord {
  id: string
  name: string
  category: DatabaseCategory
  alias?: string[]
  source?: string
  properties: Record<string, unknown>
  content?: string
  createdAt: string
  updatedAt: string
}

export type DatabaseCategory =
  | 'herb'
  | 'peptide'
  | 'compound'
  | 'prescription'
  | 'literature'
  | 'other'

export interface DatabaseSearchParams {
  keyword?: string
  category?: DatabaseCategory
  tags?: string[]
  pagination?: PaginationParams
}

// ============ AI 模型相关 ============

export interface AIModel {
  id: string
  name: string
  type: AIModelType
  provider: string
  version: string
  status: AIModelStatus
  config: AIModelConfig
}

export type AIModelType = 'llm' | 'ml' | 'custom'

export type AIModelStatus = 'online' | 'offline' | 'training' | 'error'

export interface AIModelConfig {
  temperature?: number
  maxTokens?: number
  topP?: number
  parameters?: Record<string, unknown>
}

export interface ModelGenerationRequest {
  modelType: AIModelType
  prompt: string
  parameters?: Record<string, unknown>
  options?: GenerationOptions
}

export interface GenerationOptions {
  temperature?: number
  maxTokens?: number
  stream?: boolean
}

export interface ModelGenerationResponse {
  id: string
  result: string
  metadata?: GenerationMetadata
  usage?: TokenUsage
}

export interface GenerationMetadata {
  model: string
  provider: string
  latency: number
}

export interface TokenUsage {
  promptTokens: number
  completionTokens: number
  totalTokens: number
}

// ============ 学术报告相关 ============

export interface AcademicReport {
  id: string
  title: string
  abstract: string
  type: ReportType
  chapters: Chapter[]
  references: Citation[]
  authorId: string
  formulaId?: string
  status: ReportStatus
  createdAt: string
  updatedAt: string
}

export type ReportType = 'research' | 'review' | 'case_study' | 'other'

export type ReportStatus = 'draft' | 'in_review' | 'published' | 'archived'

export interface Chapter {
  id: string
  title: string
  order: number
  content: string
  type: ChapterType
}

export type ChapterType = 'introduction' | 'methodology' | 'results' | 'discussion' | 'conclusion' | 'other'

export interface Citation {
  id: string
  authors: string[]
  title: string
  year: number
  journal?: string
  doi?: string
  url?: string
}

// ============ 通知相关 ============

export interface Notification {
  id: string
  userId: string
  title: string
  message: string
  type: NotificationType
  read: boolean
  actionUrl?: string
  createdAt: string
}

export type NotificationType = 'info' | 'success' | 'warning' | 'error'

// ============ 文件上传相关 ============

export interface UploadFile {
  id: string
  name: string
  size: number
  type: string
  url: string
  uploadedAt: string
}

export interface UploadOptions {
  maxSize?: number
  allowedTypes?: string[]
  multiple?: boolean
}

// ============ WebSocket 相关 ============

export interface WebSocketMessage {
  type: MessageType
  payload: Record<string, unknown>
  timestamp: string
  senderId?: string
}

export type MessageType =
  | 'connection'
  | 'data_update'
  | 'notification'
  | 'error'
  | 'pong'

export interface WebSocketConfig {
  url: string
  reconnectAttempts?: number
  reconnectInterval?: number
  heartbeatInterval?: number
}

// ============ 通用工具类型 ============

export interface SelectOption<T = string> {
  value: T
  label: string
  disabled?: boolean
}

export interface DateRange {
  start: string
  end: string
}

export interface SortOption {
  field: string
  direction: 'asc' | 'desc'
}
