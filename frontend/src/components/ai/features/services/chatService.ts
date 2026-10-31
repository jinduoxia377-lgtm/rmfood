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
import { useAuthStore } from '@/stores/auth';

// ── P0-3b: 场景模式前后端值域映射 ──
// 前端 ScenarioMode: academician/safety_off/process_eng/concise_adv
// 后端 prompt_service.py: formula_design/safety_check/general_qa
// 此前前端值域与后端无一命中，全部 fallback 到 base prompt；
// 且 chat.py:374 平台原料库检索仅在 scenario_mode=="formula_design" 触发，
// 前端默认 academician 导致平台知识库永不注入。
// 前端直接透传原始场景值，后端 YAML v1.1 已补齐所有别名映射
// (academician/safety_off/process_eng/concise_adv 均已在 scenarios 中定义)

// ── CSRF Token 管理（与 agent.ts 保持一致） ──
// CsrfProtectMiddleware 只在 GET 请求时设置 csrf_token cookie，POST 需要读取并回传
function _getCookieValue(name: string): string | null {
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? match[2] : null;
}

let _csrfToken: string | null = null;
let _csrfLoading = false;

export async function ensureCsrfToken(): Promise<string | null> {
  if (_csrfToken) return _csrfToken;
  const cookieToken = _getCookieValue('csrf_token');
  if (cookieToken) {
    _csrfToken = cookieToken;
    return _csrfToken;
  }
  if (_csrfLoading) {
    return new Promise((resolve) => {
      const check = () => {
        const t = _getCookieValue('csrf_token') || _csrfToken;
        if (t || !_csrfLoading) resolve(t);
        else setTimeout(check, 50);
      };
      check();
    });
  }
  _csrfLoading = true;
  // 发一个 GET 请求触发 CsrfProtectMiddleware 设置 csrf_token cookie
  // P1 修复：加 5s 超时，防止 CSRF 预检 fetch 挂死
  // 使用 AbortController 而非 AbortSignal.timeout（后者在部分浏览器/Vite 环境不可用）
  const csrfController = new AbortController();
  const csrfTimeoutId = setTimeout(() => csrfController.abort(), 5000);
  try {
    await fetch(API_ENDPOINTS.AI.MODELS_STATUS, {
      method: 'GET',
      credentials: 'include',
      signal: csrfController.signal,
    });
    _csrfToken = _getCookieValue('csrf_token');
    if (import.meta.env.DEV && _csrfToken) {
      logger.info('[ChatService] CSRF token initialized');
    }
  } catch {
    // 忽略错误，CSRF 初始化失败不阻断功能
  } finally {
    clearTimeout(csrfTimeoutId);
    _csrfLoading = false;
  }
  return _csrfToken;
}

// 共享状态机实例（与 useChatMessages 共享）
let _sharedStateMachine: ChatStateMachine | null = null;

function getSharedStateMachine(): ChatStateMachine {
  if (!_sharedStateMachine) {
    _sharedStateMachine = createChatStateMachine(ChatState.Idle, { throwOnError: false });
    _sharedStateMachine.onStateChange = (from, to) => {
      logger.debug(`[ChatService] State transition: ${from} -> ${to}`);
      eventBus.emit('state:changed', { newState: to, previousState: from });
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
  /**
   * 回复来源（由后端 SSE `meta` 事件携带）。
   *  - 真实模型名 → 大模型推理
   *  - "rule-engine-fallback" → LLM 不可用，规则引擎降级
   * 前端据此渲染来源徽标，避免规则引擎冒充大模型。
   */
  model?: string;
  /** 辨证分析（由后端 SSE `dialectics` 事件携带）：急症判定 + 体质倾向 + 证据分级 */
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
  /** 实时进度（由后端 SSE `progress` 事件携带） */
  progress?: {
    stage: 'preparing' | 'rag_retrieving' | 'dialectics' | 'llm_start' | 'generating' | 'safety_check' | 'finalizing' | 'done';
    percent: number;
    chars?: number;
  };
}

export interface RateLimitInfo {
  remaining: number;
  resetAt: Date | null;
  limit: number;
}

export interface IChatService {
  sendMessage(question: string, history?: Array<{ role: string; content: string }>, options?: SendMessageOptions): Promise<AIResponse>;
  sendMessageStream(question: string, history?: Array<{ role: string; content: string }>, allowRetry?: boolean, options?: SendMessageOptions): AsyncGenerator<StreamChunk>;
  setAuthToken(token: string): void;
  clearAuthToken(): void;
  retryLastMessage(): Promise<AIResponse>;
  getLastError(): Error | null;
  getClassifiedError(): ClassifiedError | null;
  getRateLimitStatus(): RateLimitInfo;
  getStateMachine(): ChatStateMachine;
}

/** 发送消息的可选参数：允许调用方临时指定模型、温度、采样上限与场景模式 */
export interface SendMessageOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  /** 场景模式（formula_design/academician/safety_off/process_eng/concursive_adv 等），透传到后端 system prompt 注入 */
  scenarioMode?: string;
  /** RAG 知识库检索结果（chunks 内容列表），后端注入 system prompt 作为【用户知识库参考】 */
  ragContext?: string[];
  /** 前端本地会话 ID（session-<ts>-<rand>），后端按 (user_id, client_session_id) 隔离会话记录 */
  clientSessionId?: string;
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

  async sendMessage(question: string, history?: Array<{ role: string; content: string }>, options?: SendMessageOptions): Promise<AIResponse> {
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
      const response = await this.executeWithRetry(() => this.fetchChatAPI(question, history, options));

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
    _allowRetry = true,
    options?: SendMessageOptions,
  ): AsyncGenerator<StreamChunk> {
    const requestId = this.generateRequestId(question);

    if (this.isDuplicateRequest(requestId)) {
      logger.warn(`[ChatService] 流式请求去重: ${question.slice(0, STRING_LIMITS.REQUEST_ID_TRUNCATE_LENGTH)}...`);
    }

    this.lastQuestion = question;
    this.requestTimestamps.set(requestId, Date.now());

    this.eventBus.emit('message:sending', { content: question, timestamp: Date.now() });
    this.stateMachine.transition(ChatState.Streaming);

    // ── 认证预检（SSE 流式请求使用 fetch，依赖浏览器自动携带 HttpOnly Cookie）──
    if (!this.isAuthenticated()) {
      // 页面刚加载时 auth store 可能尚未从 Cookie 恢复（首次发送常见）。
      // 允许重试时等待 1 秒让登录态就绪后再试一次，避免误报「对话服务暂时不可用」。
      if (_allowRetry) {
        logger.warn('[ChatService] 流式请求预检未认证，等待 1 秒后重试:', { requestId });
        this.stateMachine.transition(ChatState.Idle);
        await new Promise((resolve) => setTimeout(resolve, 1000));
        yield* this.sendMessageStream(question, history, false, options);
        return;
      }
      logger.warn('[ChatService] 流式请求预检：用户未认证');
      this.stateMachine.transition(ChatState.Error);
      const noAuthError = new Error('未登录，请先登录后再使用 AI 对话');
      this.handleError(noAuthError, question);
      throw noAuthError;
    }

    const controller = new AbortController();
    this.pendingRequest.set(requestId, controller);
    // 自动重试由 _allowRetry 控制（递归重试时传 false 防止无限循环）

    // P2 修复：在 try 之前声明，使 finally 可访问
    const streamTimeout = API.STREAM_TIMEOUT_MS ?? 180_000;
    const timeoutId = setTimeout(() => controller.abort(), streamTimeout);
    let idleTimerId: ReturnType<typeof setTimeout> | undefined;

    try {

      const bodyData: Record<string, any> = { question };
      if (history && history.length > 0) {
        bodyData.history = history.slice(-10);
      }
      // 场景模式透传：直接传递前端原始场景值，后端 YAML v1.1 已补齐所有别名
      if (options?.scenarioMode) {
        bodyData.scenario_mode = options.scenarioMode;
      }
      // 模型覆盖透传：前端模型切换器指定 LLM 模型名称
      if (options?.model) {
        bodyData.model = options.model;
      }
      // RAG 知识库检索结果透传：后端注入 system prompt 作为【用户知识库参考】
      if (options?.ragContext && options.ragContext.length > 0) {
        bodyData.rag_context = options.ragContext;
      }
      // P2 统一会话 ID：透传前端本地会话标识，后端按 (user_id, client_session_id) 隔离会话记录
      if (options?.clientSessionId) {
        bodyData.client_session_id = options.clientSessionId;
      }
      // ── Task 3: 注入用户画像上下文（跨会话个性化）──
      try {
        const { userProfileManager } = await import('./userProfileService')
        const profileSummary = userProfileManager.generatePromptSummary()
        // 后端 ChatRequest.user_profile_context 上限 2000 字符；超长会导致 422
        //（真实用户画像较长时会触发「对话服务暂时不可用」误报），此处截断对齐。
        bodyData.user_profile_context = profileSummary ? profileSummary.slice(0, 2000) : '' // 与后端 schema 对齐
      } catch { /* 画像服务不可用时静默降级 */ }
      // RAG 注入统一由 useChatSendMessage 的 ragAugment 回调处理（受 TopBar 开关控制），
      // 以及后端 retrieve_herb_knowledge（受 scenario_mode 控制）。避免三重注入导致双倍 embedding 调用。
      // 🔒 CSRF token 初始化：确保 cookie 已设置后再发 POST
      const csrfToken = await ensureCsrfToken()
      const response = await fetch(API_ENDPOINTS.AI.CHAT_STREAM, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
        },
        body: JSON.stringify(bodyData),
        credentials: 'include',
        signal: controller.signal,
      });

      if (!response.ok) {
        clearTimeout(timeoutId);
        // HTTP 非 2xx：可恢复状态码（500/502/503/429/422）且允许重试 → 自动重试一次。
        // 422 通常是 user_profile_context 超长等可自愈的参数问题，重试时会以截断后的画像重发。
        if (_allowRetry && [500, 502, 503, 429, 422].includes(response.status)) {
          logger.warn('[ChatService] 流式请求返回可恢复状态码，600ms 后自动重试:', {
            status: response.status,
            requestId,
          });
          this.stateMachine.transition(ChatState.Idle);
          await new Promise((resolve) => setTimeout(resolve, 600));
          yield* this.sendMessageStream(question, history, false, options);
          return;
        }
        await this.handleStreamError(response);
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        clearTimeout(timeoutId);
        throw new Error('无法获取响应流');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      // ── P0 修复：SSE 流读取超时保护 ──
      // 180s 总时限由 timeoutId 保持（不再提前 clearTimeout）。
      // 额外增加 60s 空闲超时：每次 reader.read() 前重置，60s 无新数据则 abort。
      // 防止后端 LLM 停顿 / 连接半开导致 reader.read() 永久阻塞。
      const IDLE_TIMEOUT = 60_000;

      while (true) {
        // 每次读取前重置空闲超时
        if (idleTimerId) clearTimeout(idleTimerId);
        idleTimerId = setTimeout(() => controller.abort(), IDLE_TIMEOUT);

        const { done, value } = await reader.read();

        // 收到数据，清除空闲超时（下一次循环会重置）
        if (idleTimerId) { clearTimeout(idleTimerId); idleTimerId = undefined; }

        if (done) {
          clearTimeout(timeoutId); // 流正常结束，清除总时限
          yield { content: '', done: true };
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        let currentEventType = '';
        for (const line of lines) {
          if (line.startsWith('event:')) {
            currentEventType = line.slice(6).trim();
            continue;
          }
          if (line.startsWith('data:')) {
            const data = line.slice(5).trim();
            if (data === '[DONE]') {
              this.stateMachine.transition(ChatState.Success); // P1 修复：确保状态机正确归零
              yield { content: '', done: true };
              return;
            }

            try {
              const parsed = JSON.parse(data);

              // ── 按事件类型分发处理 ──
              const eventType = currentEventType || (parsed.type === "text" ? "content" : parsed.type === "thinking" ? "step" : parsed.type);

              // type=error: 抛出错误让外层 catch 走标准错误处理流程
              if (eventType === 'error') {
                // P0 修复：兼容后端两种错误字段 — 后端部分端点发 {"message": "..."},
                // 部分发 {"content": "..."}。原实现只读 parsed.content，导致后端
                // message 字段被丢弃、错误消息降级为无信息的"生成失败"。
                const errMsg = parsed.message || parsed.content || '生成失败'
                const sseErr: any = new Error(`[SSE] ${errMsg}`)
                sseErr.retryable = parsed.retryable === true; // 后端标记可重试（如 503 服务繁忙）
                throw sseErr;
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
              // P2 修复：后端 SSE 事件携带 status（如 "complete"），原实现硬编码
              // 'thinking' 导致步骤完成后侧栏仍显示思考中。透传 parsed.status，缺省回退 'thinking'。
              if (eventType === 'step') {
                yield {
                  content: parsed.content || '',
                  done: false,
                  step: { step: parsed.step || '', content: parsed.content || '', status: parsed.status || 'thinking' },
                };
                continue;
              }

               // type=meta: 回复来源标识（model / reason），供 MessageBubble 展示来源徽标
               if (eventType === 'meta') {
                 yield { content: '', done: false, model: parsed.model };
                 continue;
               }

               // type=dialectics: 辨证分析（急症判定 + 体质倾向 + 证据分级）
               if (eventType === 'dialectics') {
                 yield {
                   content: '',
                   done: false,
                   dialectics: {
                     engine: parsed.engine,
                     urgent: parsed.urgent,
                     constitution_tendency: parsed.constitution_tendency,
                     syndrome_points: parsed.syndrome_points,
                     regulation_goals: parsed.regulation_goals,
                     evidence: parsed.evidence,
                     cautions: parsed.cautions,
                     referral_message: parsed.referral_message,
                   },
                 };
                 continue;
               }

               // type=progress: 实时进度事件（阶段 + 锚点百分比 + 已生成字符数）
               if (eventType === 'progress') {
                 yield {
                   content: '',
                   done: false,
                   progress: {
                     stage: parsed.stage,
                     percent: Number(parsed.percent) || 0,
                     chars: parsed.chars,
                   },
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

      // ── 单次自动重试：可恢复错误（网络/超时/5xx/后端 retryable）时自动重试一次 ──
      if (_allowRetry && this._isRecoverableStreamError(error, errMsg)) {
        logger.warn('[ChatService] 流式请求遇可恢复错误，600ms 后自动重试:', {
          reason: errMsg.substring(0, 120),
          requestId,
        });
        this.stateMachine.transition(ChatState.Idle);
        await new Promise((resolve) => setTimeout(resolve, 600));
        // 递归重新发起流式请求（新的 requestId/controller），成功后正常 yield；若再次失败则走下方错误处理
        yield* this.sendMessageStream(question, history, false, options);
        return;
      }

      this.handleError(error as Error, question);
      throw error;
    } finally {
      // P2 修复：清除所有定时器，防止资源泄漏
      clearTimeout(timeoutId);
      if (idleTimerId) clearTimeout(idleTimerId);
      this.pendingRequest.delete(requestId);
    }
  }

  /** 判断流式错误是否「可恢复」（可自动重试一次）。401/认证错误与用户取消不重试。 */
  private _isRecoverableStreamError(error: any, errMsg: string): boolean {
    // 用户主动取消/认证错误不重试
    if (error?.name === 'AbortError' || errMsg.includes('aborted') || errMsg.includes('ERR_ABORTED')) return false;
    if (errMsg.includes('401') || errMsg.includes('认证') || errMsg.includes('Token') || errMsg.includes('未授权')) return false;

    // 后端 SSE error 事件显式标记 retryable（如 503 服务繁忙）
    if (error && error.retryable === true) return true;
    if (errMsg.includes('[SSE]')) {
      try {
        const parsed = JSON.parse(errMsg.replace('[SSE] ', ''));
        if (parsed && parsed.retryable === true) return true;
      } catch { /* 非 JSON，忽略 */ }
      return false;
    }

    // 网络中断/超时/连接失败/5xx（502/503/500）视为可恢复
    return /network|fetch|ECONN|ERR_|timeout|超时|无法连接|响应中断|502|503|500/.test(errMsg);
  }

  setAuthToken(token: string): void {
    this.authToken = token;
  }

  clearAuthToken(): void {
    this.authToken = null;
  }

  /** 关闭所有 pending 的流式请求（用于组件 unmount 时的 SSE 连接清理） */
  closeAllPendingRequests(): void {
    for (const [requestId, controller] of this.pendingRequest.entries()) {
      logger.info('[ChatService] Unmount cleanup: aborting pending request:', requestId);
      controller.abort();
      this.pendingRequest.delete(requestId);
    }
  }

  /** 中止当前所有流式请求（暂停/停止生成时调用，真正断开 SSE 连接） */
  abortCurrentStream(): void {
    for (const [requestId, controller] of this.pendingRequest.entries()) {
      logger.info('[ChatService] 暂停生成：aborting SSE request:', requestId);
      controller.abort();
      this.pendingRequest.delete(requestId);
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
    options?: SendMessageOptions,
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
    // 场景模式透传：直接传递前端原始场景值，后端 YAML v1.1 已补齐所有别名
    if (options?.scenarioMode) requestBody.scenario_mode = options.scenarioMode;
    // 模型覆盖透传：前端模型切换器指定 LLM 模型名称（后端 ChatRequest.model 已声明）
    if (options?.model) requestBody.model = options.model;
    // RAG 知识库检索结果透传：后端注入 system prompt 作为【用户知识库参考】
    if (options?.ragContext && options.ragContext.length > 0) requestBody.rag_context = options.ragContext;
    // P2 统一会话 ID：透传前端本地会话标识，后端按 (user_id, client_session_id) 隔离会话记录
    if (options?.clientSessionId) requestBody.client_session_id = options.clientSessionId;
    // ── Task 3: 注入用户画像上下文 ──
    try {
      const { userProfileManager } = await import('./userProfileService')
      const profileSummary = userProfileManager.generatePromptSummary()
      requestBody.user_profile_context = profileSummary ? profileSummary.slice(0, 2000) : ''
    } catch { /* 画像服务不可用时静默降级 */ }
    // RAG 注入统一由 ragAugment 回调 + 后端 retrieve_herb_knowledge 处理

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
          hasToken: !!this.isAuthenticated(),
        });
        this.eventBus.emit('auth:required', {});
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
            'ai:config_error',
            {
              type: 'api_key_invalid',
              message: errorDetail.message,
              suggestion: errorDetail.suggestion,
            },
          );

          throw new Error(`AI服务配置错误 (401): ${errorDetail.message || 'API Key 无效'}`);
        } else {
          // 用户认证失败（JWT 无效或过期）
          logger.warn('[ChatService] 🔒 用户认证失败', {
            detail: errorDetail,
            hasToken: !!this.isAuthenticated(),
          });

          this.eventBus.emit('auth:required', {});
          throw new Error(`认证失败 (401): ${errorText || '未授权访问'}`);
        }

      case 429: {
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
      }

      case 400:
      case 422: {
        // 直接展示后端 422 原始响应体（通常为 {"success":false,"detail":[{loc,msg},...]}），
        // 避免前端解析坏（如 [object object]），便于用户反馈与定位。
        const rawBody = errorText || ''
        const snippet = rawBody.length > 400 ? rawBody.slice(0, 400) + '…' : rawBody
        throw new Error(`请求参数异常 (422): ${snippet}`);
      }

      case 403: {
        // 区分 CSRF token 缺失 vs 真正的权限不足
        const isCsrfError = errorText.includes('CSRF') || errorText.includes('csrf');
        if (isCsrfError) {
          logger.warn('[ChatService] CSRF token 缺失，尝试重新初始化...');
          _csrfToken = null; // 清除缓存，下次请求会重新获取
          // 重试一次：先初始化 CSRF，再发请求
          const freshToken = await ensureCsrfToken();
          if (freshToken) {
            // 重发请求（通过上层调用方自动重试机制）
            throw new Error(`CSRF token 已重新获取，请重试请求`);
          }
        }
        throw new Error(`权限不足 (${response.status}): ${errorText}`);
      }

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
    void _question;
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

    // 403 权限不足 — 触发重新登录
    if (errorMessage.includes('403') || errorMessage.includes('forbidden') || errorMessage.includes('权限')) {
      this.eventBus.emit('auth:required', {});
      return {
        type: ErrorType.Forbidden,
        message: error.message,
        originalError: error,
        recoverable: false,
        userMessage: '权限不足，请重新登录后重试',
        suggestion: '您的登录会话已失效或权限不足，请重新登录',
        canAutoRecover: false,
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

  /**
   * 检查是否已认证（用于流式请求预检）
   * 实际请求依赖浏览器自动携带 HttpOnly Cookie
   */
  private isAuthenticated(): boolean {
    // 从 auth store 读取认证状态（静态导入，避免 Vite ESM 下 require 不可用导致恒为 false）
    try {
      return useAuthStore.getState().isAuthenticated
    } catch {
      // 如果 auth store 不可用，回退到 authToken 检查
      return !!this.authToken
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
