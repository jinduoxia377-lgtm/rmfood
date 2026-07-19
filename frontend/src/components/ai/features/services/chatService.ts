import { API_ENDPOINTS } from '@/config/apiEndpoints';
import { API, STRING_LIMITS } from '@/constants/businessRules';
import type { IEventBus } from './eventBus';
import { eventBus } from './eventBus';
import { ChatStateMachine, ChatState, createChatStateMachine } from '../utils/chatStateMachine';
import { storageService } from './storageService';
import { logger } from '@/utils/safeLogger';
import { ErrorType } from '../components/ErrorRecoveryDialog';
import { contextManager } from './contextManager';
import api from '@/api/client';

// 共享状态机实例（与 useChatMessages 共享）
let _sharedStateMachine: ChatStateMachine | null = null;

function getSharedStateMachine(): ChatStateMachine {
  if (!_sharedStateMachine) {
    _sharedStateMachine = createChatStateMachine(ChatState.Idle, { throwOnError: false });
    _sharedStateMachine.onStateChange = (from, to) => {
      logger.debug(`[ChatService] State transition: ${from} -> ${to}`);
      eventBus.emit('state:changed' as any, { newState: to, previousState: from });
    };
  }
  return _sharedStateMachine;
}

// 本地定义 ClassifiedError 接口（避免循环依赖）
interface ClassifiedError {
  type: ErrorType;
  message: string;
  originalError?: Error;
  recoverable: boolean;
  context?: Record<string, unknown>;
  userMessage?: string;
  suggestion?: string;
  canAutoRecover?: boolean;
  retryAfter?: number;
  countdown?: number;
}

export interface AIRecognizedFormula {
  name: string;
  value: number;
  unit?: string;
  confidence?: number;
}

/** 思考步骤中的配方数据（后端 AI 引擎结构化输出） */
export interface ThinkingStepFormulaData {
  /** 配方名称 */
  name?: string;
  /** 成分列表 */
  ingredients?: Array<{ name: string; dosage?: string; unit?: string }>;
  /** 原始 JSON 字符串（当无法解析时保留） */
  raw?: Record<string, unknown>;
}

export interface AIResponse {
  content: string;
  role: 'assistant';
  formulas: AIRecognizedFormula[];
  timestamp: number;
  model?: string;
  thinking_steps?: Array<{
    step: string;
    content: string;
    status: string;
    detail?: string;
    formula_data?: ThinkingStepFormulaData;
  }>;
}

export interface StreamChunk {
  content: string;
  done: boolean;
  formula?: AIRecognizedFormula;
  /** 思考步骤（用于转发到 ChatSidebar） */
  step?: { step: string; content: string; status: string; detail?: string };
}

export interface RateLimitInfo {
  remaining: number;
  resetAt: Date | null;
  limit: number;
}

export interface IChatService {
  sendMessage(question: string): Promise<AIResponse>;
  sendMessageStream(question: string, history?: Array<{ role: string; content: string }>): AsyncGenerator<StreamChunk>;
  setAuthToken(token: string): void;
  clearAuthToken(): void;
  retryLastMessage(): Promise<AIResponse>;
  getLastError(): Error | null;
  getClassifiedError(): ClassifiedError | null;
  getRateLimitStatus(): RateLimitInfo;
  getStateMachine(): ChatStateMachine;
}

class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}

interface ChatServiceConfig {
  timeout?: number;
  maxRetries?: number;
  debounceMs?: number;
  eventBus?: IEventBus;
  stateMachine?: ChatStateMachine;
  storageService?: typeof storageService;
}

export class ChatService implements IChatService {
  private authToken: string | null = null;
  private lastError: Error | null = null;
  private lastClassifiedError: ClassifiedError | null = null;
  private lastQuestion = '';
  private pendingRequest = new Map<string, AbortController>();
  private requestTimestamps = new Map<string, number>();
  private rateLimitInfo: RateLimitInfo = {
    remaining: Infinity,
    resetAt: null,
    limit: Infinity,
  };

  private readonly timeout: number;
  private readonly maxRetries: number;
  private readonly debounceMs: number;
  private readonly eventBus: IEventBus;
  private readonly stateMachine: ChatStateMachine;
  private readonly storage: typeof storageService;

  constructor(config: ChatServiceConfig = {}) {
    this.timeout = config.timeout ?? API.TIMEOUT_MS;
    this.maxRetries = config.maxRetries ?? API.MAX_RETRY_COUNT;
    this.debounceMs = config.debounceMs ?? API.DEBOUNCE_DELAY_MS;
    this.eventBus = config.eventBus ?? eventBus;
    // 使用共享状态机实例，确保与 useChatMessages 的状态同步
    this.stateMachine = config.stateMachine ?? getSharedStateMachine();
    this.storage = config.storageService ?? storageService;
  }

  async sendMessage(question: string, history?: Array<{ role: string; content: string }>): Promise<AIResponse> {
    const requestId = this.generateRequestId(question);

    if (this.isDuplicateRequest(requestId)) {
      logger.warn(
        `[ChatService] 检测到重复请求，已去重: ${question.slice(0, STRING_LIMITS.REQUEST_ID_TRUNCATE_LENGTH)}...`,
      );
    }

    this.lastQuestion = question;
    this.requestTimestamps.set(requestId, Date.now());

    this.eventBus.emit('message:sending', { content: question, timestamp: Date.now() });
    this.stateMachine.transition(ChatState.Sending);

    try {
      const response = await this.executeWithRetry(() => this.fetchChatAPI(question, history));

      this.stateMachine.transition(ChatState.Success);
      this.eventBus.emit('message:received', {
        content: response.content,
        senderId: 'assistant',
        timestamp: Date.now(),
      });

      this.lastError = null;
      return response;
    } catch (error) {
      this.handleError(error as Error, question);
      throw error;
    }
  }

  async *sendMessageStream(
    question: string,
    history?: Array<{ role: string; content: string }>,
  ): AsyncGenerator<StreamChunk> {
    const requestId = this.generateRequestId(question);

    if (this.isDuplicateRequest(requestId)) {
      logger.warn(`[ChatService] 流式请求去重: ${question.slice(0, STRING_LIMITS.REQUEST_ID_TRUNCATE_LENGTH)}...`);
    }

    this.lastQuestion = question;
    this.requestTimestamps.set(requestId, Date.now());

    this.eventBus.emit('message:sending', { content: question, timestamp: Date.now() });
    this.stateMachine.transition(ChatState.Streaming);

    // ── Token 有效性预检（SSE 流式请求无法走 axios 拦截器，需手动检查）──
    // 注意：这里只做软性警告，不阻断请求。真正的 Token 有效性由后端验证。
    // 原因：前端只能检查 exp 声明（不验证签名），而后端 SECRET_KEY 可能已变更。
    const token = this.getAuthToken();
    if (token && this.isTokenExpired(token)) {
      logger.warn('[ChatService] 流式请求预检：Token exp 声明已临近过期，仍尝试发送（由后端最终验证）');
      // 不再阻断！让请求到达后端，由后端返回标准 401 并触发重新登录流程
    }

    if (!token) {
      logger.warn('[ChatService] 流式请求预检：无可用 Token');
      this.stateMachine.transition(ChatState.Error);
      const noAuthError = new Error('未登录，请先登录后再使用 AI 对话');
      this.handleError(noAuthError, question);
      throw noAuthError;
    }

    const controller = new AbortController();
    this.pendingRequest.set(requestId, controller);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      // 流式请求使用 STREAM_TIMEOUT_MS（60s），比普通请求更长
      const streamTimeout = API.STREAM_TIMEOUT_MS ?? 60_000;
      const timeoutId = setTimeout(() => controller.abort(), streamTimeout);

      const bodyData: Record<string, any> = { question };
      if (history && history.length > 0) {
        bodyData.history = history.slice(-10);
      }
      const response = await fetch(API_ENDPOINTS.AI.CHAT_STREAM, {
        method: 'POST',
        headers,
        body: JSON.stringify(bodyData),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        await this.handleStreamError(response);
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('无法获取响应流');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          yield { content: '', done: true };
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (data === '[DONE]') {
              yield { content: '', done: true };
              return;
            }

            try {
              const parsed = JSON.parse(data);

              // ── 按事件类型分发处理 ──
              const eventType = parsed.type;

              // type=error: 抛出错误让外层 catch 走标准错误处理流程
              if (eventType === 'error') {
                throw new Error(`[SSE] ${parsed.content || '生成失败'}`);
              }

              // type=formula: 后端发送 {name, value}，映射为 formula 对象
              if (eventType === 'formula') {
                yield {
                  content: '',
                  done: false,
                  formula: { name: parsed.name, value: parsed.value },
                };
                continue;
              }

              // type=step: 思考步骤，透传给 ChatSidebar
              if (eventType === 'step') {
                yield {
                  content: parsed.content || '',
                  done: false,
                  step: { step: parsed.step || '', content: parsed.content || '', status: 'thinking' },
                };
                continue;
              }

              // type=content / 默认: 文本内容
              yield {
                content: parsed.content || '',
                done: false,
                formula: parsed.formula,
              };
            } catch (e: any) {
              // JSON 解析失败或 type=error 抛出的异常
              if ((e?.message || '').includes('[SSE]')) {
                throw e; // 向上冒泡到外层 catch
              }
              logger.warn('[ChatService] 解析流式数据失败:', data);
            }
          }
        }
      }

      this.stateMachine.transition(ChatState.Success);
    } catch (error: any) {
      // ERR_ABORTED / AbortError: 请求被主动取消（用户重复发送/页面导航/超时）
      // 不再是静默退出 — yield done 让上游知道流已结束
      const errMsg = error?.message || '';
      if (error?.name === 'AbortError' || errMsg.includes('aborted') || errMsg.includes('ERR_ABORTED')) {
        logger.info('[ChatService] 流式请求被取消（非错误）:', {
          reason: errMsg.substring(0, 100),
          requestId,
        });
        this.stateMachine.transition(ChatState.Idle);
        yield { content: '', done: true }; // 通知上游流已结束
        return;
      }

      this.handleError(error as Error, question);
      throw error;
    } finally {
      this.pendingRequest.delete(requestId);
    }
  }

  setAuthToken(token: string): void {
    this.authToken = token;
    try {
      localStorage.setItem('access_token', token);
    } catch (e) {
      logger.warn('[ChatService] 保存 Token 到存储失败:', e);
    }
  }

  clearAuthToken(): void {
    this.authToken = null;
    try {
      localStorage.removeItem('access_token');
    } catch (e) {
      logger.warn('[ChatService] 清除 Token 失败:', e);
    }
  }

  async retryLastMessage(): Promise<AIResponse> {
    if (!this.lastQuestion) {
      throw new Error('没有可重试的消息');
    }
    return this.sendMessage(this.lastQuestion);
  }

  getLastError(): Error | null {
    return this.lastError;
  }

  getClassifiedError(): ClassifiedError | null {
    return this.lastClassifiedError;
  }

  getRateLimitStatus(): RateLimitInfo {
    return { ...this.rateLimitInfo };
  }

  /**
   * 获取状态机实例（用于与 useChatMessages 共享状态）
   */
  getStateMachine(): ChatStateMachine {
    return this.stateMachine;
  }

  private async fetchChatAPI(
    question: string,
    history?: Array<{ role: string; content: string }>,
  ): Promise<AIResponse> {
    const context = contextManager.getContextPrompt();
    const isFollowUp = contextManager.isFollowUpQuestion(question);
    const contextSummary = contextManager.getContextSummary();

    const requestBody: Record<string, any> = {
      question,
      context,
      isFollowUp,
      contextSummary,
      timestamp: Date.now(),
    };
    if (history && history.length > 0) {
      requestBody.history = history.slice(-10);
    }

    try {
      // ── 使用 axios api 客户端（走认证拦截器，自动处理 401/Token 刷新）──
      // NOTE: API_ENDPOINTS 包含 /api/v1 前缀，而 axios baseURL 也是 /api/v1，
      // 使用 API_ENDPOINTS 会导致 URL 变为 /api/v1/api/v1/ai/chat → 404！
      // 因此使用相对路径 /ai/chat
      const response = await api.post<AIResponse>('/ai/chat', requestBody, {
        timeout: this.timeout,
      });

      return {
        content: response.data?.content || '',
        role: 'assistant',
        formulas: response.data?.formulas || [],
        timestamp: Date.now(),
        model: response.data?.model,
        thinking_steps: response.data?.thinking_steps || [],
      };
    } catch (error: any) {
      // axios 错误标准化：区分网络层错误 vs HTTP 响应错误
      if (!error.response) {
        // 无响应 = 网络层失败（ERR_ABORTED / ECONNREFUSED / 超时）
        if (error.code === 'ERR_ABORTED' || error.message?.includes('aborted')) {
          throw new Error('net::ERR_ABORTED: 请求被中止（可能为 Token 过期导致认证链路中断）');
        }
        if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
          throw new TimeoutError(`请求超时 (${this.timeout}ms)`);
        }
        // Failed to fetch / NetworkError 等底层网络错误
        throw new TypeError(`Failed to fetch: ${error.message || '网络连接失败'}`);
      }

      // 有 HTTP 响应但状态码非 2xx
      const status = error.response?.status;
      const detail = error.response?.data?.detail || error.response?.data?.message || '';

      if (status === 401) {
        // 用户认证失败（JWT 无效/过期/SECRET_KEY 变更）→ 触发重新登录
        logger.warn('[ChatService] 🔒 fetchChatAPI 认证失败 (401)', {
          detail,
          hasToken: !!this.getAuthToken(),
        });
        this.eventBus.emit('auth:required' as any, {} as any);
        throw new Error(`HTTP 错误 (401): ${detail || '认证失败，Token 可能已过期'}`);
      }
      if (status === 429) {
        throw new Error(`请求过于频繁 (429): ${detail}`);
      }
      if (status >= 500) {
        throw new Error(`服务器错误 (${status}): ${detail || '服务器内部错误'}`);
      }

      throw new Error(`HTTP 错误 (${status || 'unknown'}): ${detail || error.message}`);
    }
  }

  private async executeWithRetry<T>(fn: () => Promise<T>, retries: number = this.maxRetries): Promise<T> {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        const isLastAttempt = attempt === retries;
        const shouldRetry = this.shouldRetry(error as Error);

        if (isLastAttempt || !shouldRetry) {
          throw error;
        }

        const delay = Math.pow(2, attempt) * API.RETRY_BASE_DELAY_MS;
        logger.warn(`[ChatService] 重试第 ${attempt + 1} 次 (${delay}ms 后)...`);
        await this.sleep(delay);
      }
    }
    throw new Error('重试次数耗尽');
  }

  private shouldRetry(error: Error): boolean {
    if (error instanceof TimeoutError) return true;

    const message = error.message.toLowerCase();
    if (message.includes('network') || message.includes('fetch')) return true;

    const statusMatch = /\((\d{3})\)/.exec(error.message);
    if (statusMatch) {
      const status = parseInt(statusMatch[1] ?? '');
      return status >= 500 && status < 600;
    }

    return false;
  }

  private async handleHTTPError(response: Response): Promise<never> {
    const errorText = await response.text().catch(() => '');

    // 尝试解析 JSON 错误详情
    let errorDetail = null;
    try {
      if (errorText) {
        const parsed = JSON.parse(errorText);
        errorDetail = parsed.detail || parsed;
      }
    } catch {
      // 非 JSON 格式，使用原始文本
    }

    switch (response.status) {
      case 401:
        // 区分两种 401 错误：用户认证 vs API Key 无效
        if (errorDetail?.error === 'API_KEY_INVALID') {
          // AI 服务 API Key 配置问题
          logger.error('[ChatService] ❌ AI 服务 API Key 无效', { detail: errorDetail });

          this.eventBus.emit(
            'ai:config_error' as any,
            {
              type: 'api_key_invalid',
              message: errorDetail.message,
              suggestion: errorDetail.suggestion,
            } as any,
          );

          throw new Error(`AI服务配置错误 (401): ${errorDetail.message || 'API Key 无效'}`);
        } else {
          // 用户认证失败（JWT 无效或过期）
          logger.warn('[ChatService] 🔒 用户认证失败', {
            detail: errorDetail,
            hasToken: !!this.getAuthToken(),
          });

          this.eventBus.emit('auth:required' as any, {} as any);
          throw new Error(`认证失败 (401): ${errorText || '未授权访问'}`);
        }

      case 429:
        const resetHeader = response.headers.get('X-RateLimit-Reset');
        const remainingHeader = response.headers.get('X-RateLimit-Remaining');
        const limitHeader = response.headers.get('X-RateLimit-Limit');

        this.rateLimitInfo = {
          remaining: remainingHeader ? parseInt(remainingHeader) : 0,
          resetAt: resetHeader ? new Date(parseInt(resetHeader) * 1000) : null,
          limit: limitHeader ? parseInt(limitHeader) : 0,
        };

        this.stateMachine.transition(ChatState.RateLimited);
        throw new Error(`请求过于频繁 (429): 剩余 ${this.rateLimitInfo.remaining} 次`);

      case 400:
      case 403:
      case 422:
        throw new Error(`客户端错误 (${response.status}): ${errorText}`);

      default:
        if (response.status >= 500) {
          throw new Error(`服务器错误 (${response.status}): ${errorText}`);
        }
        throw new Error(`HTTP 错误 (${response.status}): ${errorText}`);
    }
  }

  private async handleStreamError(response: Response): Promise<void> {
    await this.handleHTTPError(response);
  }

  private handleError(error: Error, _question: string): void {
    this.lastError = error;
    this.lastClassifiedError = this.classifyError(error);
    this.stateMachine.transition(ChatState.Error);

    // 创建可序列化的错误对象
    const serializableError = {
      ...error,
      stack: error.stack,
    };
    this.eventBus.emit('message:error', { error: serializableError, messageId: undefined });

    logger.error(`[ChatService] 错误发生 [${this.lastClassifiedError.type}]:`, {
      errorType: this.lastClassifiedError.type,
      userMessage: this.lastClassifiedError.userMessage,
      canAutoRecover: this.lastClassifiedError.canAutoRecover,
      originalError: error.message,
      stack: error.stack,
    });
  }

  private classifyError(error: Error): ClassifiedError {
    const errorMessage = error.message.toLowerCase();
    const errorName = error.name;

    // ── 网络不可达：后端未启动 / 代理连接失败 / DNS 解析失败 ──
    // Failed to fetch / ERR_ABORTED / TypeError (when fetch itself fails)
    const isNetworkUnreachable =
      errorMessage.includes('failed to fetch') ||
      errorMessage.includes('err_aborted') ||
      errorMessage.includes('aborted') ||
      errorMessage.includes('networkerror') ||
      errorMessage.includes('无法连接') ||
      errorMessage.includes('网络不可达') ||
      (errorName === 'TypeError' && (errorMessage.includes('fetch') || errorMessage.includes('network')));

    if (isNetworkUnreachable) {
      return {
        type: ErrorType.NetworkUnreachable,
        message: error.message,
        originalError: error,
        recoverable: true,
        userMessage: '无法连接到 AI 服务，请检查后端服务是否已启动',
        suggestion: '确认后端服务运行在 localhost:8000，或检查 Vite 代理配置',
        canAutoRecover: true,
        retryAfter: 3000,
      };
    }

    if (errorName === 'TimeoutError' || errorMessage.includes('timeout')) {
      return {
        type: ErrorType.NetworkTimeout,
        message: error.message,
        originalError: error,
        recoverable: true,
        userMessage: '网络连接超时，正在尝试重新连接...',
        suggestion: '请检查您的网络连接后重试',
        canAutoRecover: true,
        retryAfter: 1000,
      };
    }

    // 区分：AI 服务配置错误 vs 用户认证失败
    if (
      errorMessage.includes('ai服务配置错误') ||
      errorMessage.includes('api_key_invalid') ||
      errorMessage.includes('api key 无效')
    ) {
      return {
        type: ErrorType.Unauthorized, // 复用现有类型，但消息不同
        message: error.message,
        originalError: error,
        recoverable: false,
        userMessage: 'AI 服务未正确配置：API Key 无效或已过期',
        suggestion: '请在系统设置中重新配置有效的 API Key（支持 OpenAI、DeepSeek、智谱AI等）',
        canAutoRecover: false,
      };
    }

    // 用户认证失败（JWT 问题）
    if (errorMessage.includes('401') || errorMessage.includes('unauthorized') || errorMessage.includes('认证失败')) {
      return {
        type: ErrorType.Unauthorized,
        message: error.message,
        originalError: error,
        recoverable: false,
        userMessage: '您的登录会话已过期',
        suggestion: '请重新登录以继续使用',
        canAutoRecover: false,
      };
    }

    if (errorMessage.includes('429') || errorMessage.includes('请求过于频繁')) {
      const countdownMatch = /剩余\s*(\d+)/.exec(error.message);
      const countdown = countdownMatch ? parseInt(countdownMatch[1] ?? '') : 60;

      return {
        type: ErrorType.RateLimited,
        message: error.message,
        originalError: error,
        recoverable: true,
        userMessage: '请求过于频繁，请等待 ' + countdown + 's',
        suggestion: '请稍等片刻后再发送消息',
        canAutoRecover: false,
        countdown,
      };
    }

    if (errorMessage.includes('500') || errorMessage.includes('服务器错误') || errorMessage.includes('server error')) {
      return {
        type: ErrorType.ServerError,
        message: error.message,
        originalError: error,
        recoverable: true,
        userMessage: '服务器暂时无法处理请求',
        suggestion: '我们正在努力修复，请稍后重试',
        canAutoRecover: true,
        retryAfter: 2000,
      };
    }

    if (errorMessage.includes('流式') || errorMessage.includes('stream') || errorMessage.includes('中断')) {
      return {
        type: ErrorType.StreamInterrupted,
        message: error.message,
        originalError: error,
        recoverable: true,
        userMessage: 'AI 响应在传输过程中被中断',
        suggestion: '网络连接不稳定，是否重新生成响应？',
        canAutoRecover: true,
        retryAfter: 500,
      };
    }

    return {
      type: ErrorType.Unknown,
      message: error.message,
      originalError: error,
      recoverable: true,
      userMessage: '发生了未知错误',
      suggestion: '请稍后重试或联系客服获取帮助',
      canAutoRecover: true,
      retryAfter: 2000,
    };
  }

  private getAuthToken(): string | null {
    if (this.authToken) return this.authToken;

    try {
      // 策略1: 从 storageService 读取（兼容 storageService 格式）
      const storedToken = this.storage.get<string>('access_token');
      if (storedToken) {
        this.authToken = storedToken;
        return storedToken;
      }

      // 策略2: 直接从 localStorage 读取（兼容 auth store 的纯字符串格式）
      const rawToken = localStorage.getItem('access_token');
      if (rawToken) {
        // 验证是否为有效的 JWT 格式（三段式，用.分隔）
        if (rawToken.split('.').length === 3) {
          this.authToken = rawToken;
          return rawToken;
        }
      }
    } catch (e) {
      logger.warn('[ChatService] 读取 Token 失败:', e);
    }

    return null;
  }

  /**
   * 检查 JWT Token 是否已过期（不验证签名，仅检查 exp 声明）
   * 用于流式请求的预检，避免携带过期 Token 导致 ERR_ABORTED
   */
  private isTokenExpired(token: string): boolean {
    try {
      const payload = token.split('.')[1];
      if (!payload) return true;
      const decoded = JSON.parse(atob(payload));
      const exp = decoded.exp;
      if (!exp) return false;
      // 提前 60s 判定过期，留出网络传输余量
      return Date.now() / 1000 > exp - 60;
    } catch {
      // 解析失败视为无效 Token
      return true;
    }
  }

  private generateRequestId(question: string): string {
    return `${question.slice(0, STRING_LIMITS.REQUEST_ID_TRUNCATE_LENGTH)}_${Date.now()}`;
  }

  private isDuplicateRequest(requestId: string): boolean {
    const now = Date.now();
    const lastTimestamp = this.requestTimestamps.get(requestId);

    if (lastTimestamp && now - lastTimestamp < this.debounceMs) {
      return true;
    }

    return false;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export const chatService = new ChatService();
export default chatService;

// ═══ Phase 1 Enhancement: AI LLM Error Taxonomy ═══

/**
 * AI LLM 细粒度错误响应模板
 * 用于将后端返回的结构化错误码映射为前端可消费的错误信息
 */
export interface ErrorResponseTemplate {
  /** 错误类型标识（对应 ErrorType 或扩展类型） */
  type: string;
  /** 面向用户的中文提示信息 */
  userMessage: string;
  /** 是否可恢复（可重试/可修复） */
  recoverable: boolean;
  /** 冷却时间（毫秒），仅限速率限制等场景 */
  cooldownMs?: number;
}

/** AI LLM 细粒度错误码 → 响应模板 映射表 */
export const AI_LLM_ERROR_MAP: Record<string, ErrorResponseTemplate> = {
  // ── 认证类 (AUTH) ──
  AI_LLM_AUTH_001: { type: 'AuthError', userMessage: 'API Key 格式无效', recoverable: false },
  AI_LLM_AUTH_002: { type: 'AuthExpiredError', userMessage: 'API Key 已过期或被撤销', recoverable: false },

  // ── 配额类 (QUOTA) ──
  AI_LLM_QUOTA_001: {
    type: 'RateLimitedError',
    userMessage: '请求过于频繁，请稍后再试',
    recoverable: true,
    cooldownMs: 60_000,
  },
  AI_LLM_QUOTA_003: { type: 'QuotaExhaustedError', userMessage: 'API 余额不足', recoverable: false },

  // ── 模型类 (MODEL) ──
  AI_LLM_MODEL_001: { type: 'ModelNotFoundError', userMessage: '指定的模型不存在', recoverable: true },

  // ── 网络类 (NET) ──
  AI_LLM_NET_002: { type: 'ConnectionTimeoutError', userMessage: '连接 AI 服务超时', recoverable: true },
};
