export type {
  AIRecognizedFormula,
  AIResponse,
  StreamChunk,
  RateLimitInfo,
  IChatService,
  ThinkingStepFormulaData,
} from '../services/chatService';
export type { IEventBus } from '../services/eventBus';

/**
 * 统一的 ChatMessage 类型（useChatMessages 与 useExportManager 的超集）
 *
 * 设计原则：
 * - 基础字段来自 useChatMessages（消息 CRUD 核心）
 * - 扩展字段来自 useExportManager（导出/编辑/交互增强）
 * - 所有消费方应从此处导入，确保类型单一来源 (Single Source of Truth)
 */
export interface ChatMessage {
  // ===== 基础字段 (useChatMessages) =====
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  /** AI 识别的配方数据 */
  formulas?: {
    name: string;
    value: number;
    unit?: string;
    confidence?: number;
  }[];
  isLoading?: boolean;
  error?: string;
  isEdited?: boolean;
  originalContent?: string;
  isRetracted?: boolean;
  retractedAt?: number;
  /** 发送状态：sending / sent / failed */
  sendStatus?: 'sending' | 'sent' | 'failed';
  /** 重试次数 */
  retryCount?: number;
  /** 消息内容类型 */
  messageType?: 'text' | 'link' | 'code' | 'image' | 'file';
  /**
   * 回复来源标识（仅 assistant 消息）。
   *
   * 来源：后端 chat_engine.py 的 result.model 字段。
   *  - 真实模型名（如 "agnes-3.0-flash-max"）→ 大模型推理
   *  - "rule-engine-fallback" → LLM 不可用，本地规则引擎降级
   *  - "ultimate-fallback"    → 三级降级均失败，固定文案兜底
   *  - "error"                → 生成失败
   *
   * 前端必须据此展示来源徽标，否则用户无法分辨「大模型推理」与
   * 「规则引擎降级」——这是「配方设计专家」系统的能力真实性底线。
   */
  model?: string;
  /** 辨证分析（SSE dialectics 事件）：急症判定 + 体质倾向 + 证据分级 */
  dialectics?: {
    engine?: string;
    urgent?: boolean;
    constitution_tendency?: string;
    syndrome_points?: string;
    regulation_goals?: string[];
    evidence?: Array<{ claim: string; level: string; source: string }>;
    cautions?: string[];
    referral_message?: string;
  };

  // ===== 扩展字段 (useExportManager) =====
  editedAt?: number;
  isWithdrawn?: boolean;
  withdrawnAt?: number;
  withdrawReason?: string;
  replyTo?: string;
  quoteContent?: string;
  rating?: 'up' | 'down' | null;
  feedback?: string;
  isBookmarked?: boolean;
  bookmarkNote?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface ClassifiedError {
  type: any;
  originalError: Error;
  userMessage: string;
  suggestion: string;
  canAutoRecover: boolean;
  retryAfter?: number;
  countdown?: number;
}

export interface Formula {
  id: string;
  name: string;
  category: string;
  data: {
    ingredients: {
      name: string;
      percentage: number;
      unit: string;
    }[];
    nutrition: {
      calories: number;
      protein: number;
      carbs: number;
      fat: number;
    };
    process: string[];
  };
}

export interface IStorageService {
  saveMessages(messages: ChatMessage[]): Promise<void>;
  loadMessages(): Promise<ChatMessage[]>;
  saveSession(session: SessionData): Promise<void>;
  loadSession(): Promise<SessionData | null>;
  deleteSession(id: string): Promise<void>;
  listSessions(): Promise<SessionInfo[]>;
  clearAll(): Promise<void>;
  getUsageStats(): Promise<UsageStats>;
}

export interface SessionData {
  id: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

export interface SessionInfo {
  id: string;
  messageCount: number;
  createdAt: number;
  lastUpdatedAt: number;
}

export interface UsageStats {
  totalMessages: number;
  totalSessions: number;
  storageUsed: number;
  lastActivity: Date | null;
}

export interface IExportService {
  exportToPDF(messages: ChatMessage[]): Promise<Blob>;
  exportToWord(messages: ChatMessage[]): Promise<Blob>;
  exportToExcel(messages: ChatMessage[]): Promise<Blob>;
  exportToMarkdown(messages: ChatMessage[]): Promise<string>;
  exportToJSON(messages: ChatMessage[]): Promise<string>;
  cancelExport(): void;
  getExportProgress(): ExportProgressInfo;
}

export interface ExportProgressInfo {
  isExporting: boolean;
  progress: number;
  format: string | null;
}
