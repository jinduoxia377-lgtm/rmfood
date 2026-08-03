import { logger } from '@/utils/safeLogger';
export enum ChatState {
  Idle = 'idle',
  Validating = 'validating',
  Sending = 'sending',
  Streaming = 'streaming',
  Success = 'success',
  Error = 'error',
  RateLimited = 'rate_limited',

  Thinking = 'thinking',
  Formatting = 'formatting',
  Processing = 'processing',
  Paused = 'paused',
  Retrying = 'retrying',
}

const VALID_TRANSITIONS: Record<ChatState, ChatState[]> = {
  [ChatState.Idle]: [ChatState.Validating, ChatState.Thinking],
  [ChatState.Validating]: [ChatState.Sending, ChatState.Error, ChatState.Idle],
  [ChatState.Sending]: [ChatState.Streaming, ChatState.Thinking, ChatState.Error, ChatState.Success],
  [ChatState.Streaming]: [ChatState.Success, ChatState.Error, ChatState.Paused],
  [ChatState.Success]: [ChatState.Idle],
  [ChatState.Error]: [ChatState.Idle, ChatState.Retrying],
  [ChatState.RateLimited]: [ChatState.Idle],
  [ChatState.Thinking]: [ChatState.Sending, ChatState.Idle],
  [ChatState.Formatting]: [ChatState.Success, ChatState.Error],
  [ChatState.Processing]: [ChatState.Streaming, ChatState.Success, ChatState.Error],
  [ChatState.Paused]: [ChatState.Streaming, ChatState.Idle],
  [ChatState.Retrying]: [ChatState.Sending, ChatState.Error],
};

Object.keys(VALID_TRANSITIONS).forEach(state => {
  if (!VALID_TRANSITIONS[state as ChatState].includes(ChatState.RateLimited)) {
    VALID_TRANSITIONS[state as ChatState].push(ChatState.RateLimited);
  }
});

export interface StateMachineConfig {
  throwOnError?: boolean;
  enableDebug?: boolean;
  autoResetOnSuccess?: boolean;
  maxContextWindow?: number;
  contextCompressionThreshold?: number;
  minRelevanceScore?: number;
}

export interface IStateMachine<T> {
  readonly state: T;
  readonly previousState: T;
  readonly transitionHistory: { from: T; to: T; timestamp: number }[];

  canTransition(to: T): boolean;
  transition(to: T): boolean;
  reset(): void;
  isInState(...states: T[]): boolean;

  onStateChange?: (from: T, to: T) => void;
  onTransitionError?: (from: T, to: T, error: Error) => void;
}

export interface TransitionResult {
  success: boolean;
  from?: ChatState;
  to?: ChatState;
  error?: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  tokens: number;
  relevanceScore?: number;
  importanceTags?: string[];
  summary?: string;
}

export interface CompressedContext {
  messages: Message[];
  originalMessageCount: number;
  compressedMessageCount: number;
  compressionRatio: number;
  totalRelevanceScore: number;
  averageRelevanceScore: number;
}

export interface ContextStats {
  totalMessages: number;
  totalTokens: number;
  userMessages: number;
  assistantMessages: number;
  systemMessages: number;
  averageRelevance: number;
  contextSize: number;
}

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
  'may', 'might', 'must', 'shall', 'can', 'need', 'dare', 'ought', 'used',
  'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into',
  'through', 'during', 'before', 'after', 'above', 'below', 'between', 'under',
  'again', 'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why',
  'how', 'all', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no',
  'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just', 'or',
  'and', 'but', 'if', 'because', 'while', 'although', 'though', 'that', 'which',
  'who', 'whom', 'this', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they',
]);

function createHash(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

function extractKeywords(text: string): string[] {
  const words = text.toLowerCase().split(/[^a-zA-Z0-9\u4e00-\u9fa5]+/).filter(w => w.length > 1 && !STOP_WORDS.has(w));
  const keywordMap = new Map<string, number>();

  words.forEach(word => {
    keywordMap.set(word, (keywordMap.get(word) || 0) + 1);
  });

  return Array.from(keywordMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(entry => entry[0]);
}

function calculateSemanticSimilarity(text1: string, text2: string): number {
  const keywords1 = new Set(extractKeywords(text1));
  const keywords2 = new Set(extractKeywords(text2));

  if (keywords1.size === 0 || keywords2.size === 0) return 0;

  let intersection = 0;
  keywords1.forEach(k => {
    if (keywords2.has(k)) intersection++;
  });

  const union = keywords1.size + keywords2.size - intersection;
  return union > 0 ? intersection / union : 0;
}

export class RelevanceScorer {
  private static instance: RelevanceScorer;
  private keywordCache = new Map<string, string[]>();
  private similarityCache = new Map<string, number>();

  private constructor() {}

  static getInstance(): RelevanceScorer {
    if (!RelevanceScorer.instance) {
      RelevanceScorer.instance = new RelevanceScorer();
    }
    return RelevanceScorer.instance;
  }

  scoreMessage(message: Message, contextMessages: Message[], currentQuery?: string): number {
    if (!message.content.trim()) return 0;

    const cacheKey = `${message.id}_${currentQuery ? createHash(currentQuery) : 'none'}`;
    if (this.similarityCache.has(cacheKey)) {
      return this.similarityCache.get(cacheKey)!;
    }

    let totalScore = 0;
    let scoreCount = 0;

    if (currentQuery) {
      const querySimilarity = calculateSemanticSimilarity(message.content, currentQuery);
      totalScore += querySimilarity * 50;
      scoreCount++;
    }

    contextMessages.forEach(ctxMsg => {
      if (ctxMsg.id !== message.id) {
        const similarity = calculateSemanticSimilarity(message.content, ctxMsg.content);
        totalScore += similarity * 25;
        scoreCount++;
      }
    });

    const recencyScore = Math.max(0, 1 - (Date.now() - message.timestamp) / (24 * 60 * 60 * 1000));
    totalScore += recencyScore * 25;
    scoreCount++;

    const finalScore = scoreCount > 0 ? Math.round((totalScore / scoreCount) * 100) : 0;

    this.similarityCache.set(cacheKey, finalScore);

    if (this.similarityCache.size > 1000) {
      const keys = Array.from(this.similarityCache.keys());
      for (let i = 0; i < 200; i++) {
        this.similarityCache.delete(keys[i]);
      }
    }

    return finalScore;
  }

  batchScore(messages: Message[], currentQuery?: string): Message[] {
    const scoredMessages = messages.map(msg => ({
      ...msg,
      relevanceScore: this.scoreMessage(msg, messages, currentQuery),
    }));
    return scoredMessages;
  }

  clearCache(): void {
    this.keywordCache.clear();
    this.similarityCache.clear();
  }
}

export class ContextCompressor {
  private scorer: RelevanceScorer;

  constructor() {
    this.scorer = RelevanceScorer.getInstance();
  }

  compress(
    messages: Message[],
    maxWindowSize = 50,
    _minRelevance = 30,
    currentQuery?: string,
  ): CompressedContext {
    const originalCount = messages.length;

    if (originalCount <= maxWindowSize) {
      const scoredMessages = this.scorer.batchScore(messages, currentQuery);
      return {
        messages: scoredMessages,
        originalMessageCount: originalCount,
        compressedMessageCount: originalCount,
        compressionRatio: 0,
        totalRelevanceScore: scoredMessages.reduce((sum, m) => sum + (m.relevanceScore || 0), 0),
        averageRelevanceScore: scoredMessages.reduce((sum, m) => sum + (m.relevanceScore || 0), 0) / originalCount,
      };
    }

    let scoredMessages = this.scorer.batchScore(messages, currentQuery);

    scoredMessages = scoredMessages.sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));

    const topMessages = scoredMessages.slice(0, Math.floor(maxWindowSize * 0.7));

    const remainingMessages = scoredMessages.slice(Math.floor(maxWindowSize * 0.7));
    const recentMessages = remainingMessages
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, Math.floor(maxWindowSize * 0.3));

    const compressed = [...topMessages, ...recentMessages]
      .sort((a, b) => a.timestamp - b.timestamp);

    const totalRelevance = compressed.reduce((sum, m) => sum + (m.relevanceScore || 0), 0);

    return {
      messages: compressed,
      originalMessageCount: originalCount,
      compressedMessageCount: compressed.length,
      compressionRatio: ((originalCount - compressed.length) / originalCount) * 100,
      totalRelevanceScore: totalRelevance,
      averageRelevanceScore: compressed.length > 0 ? totalRelevance / compressed.length : 0,
    };
  }

  generateSummary(messages: Message[]): string {
    const systemMessages = messages.filter(m => m.role === 'system');
    const userMessages = messages.filter(m => m.role === 'user');

    const keyPoints: string[] = [];

    if (systemMessages.length > 0) {
      keyPoints.push(`系统指令: ${systemMessages[0].content.slice(0, 100)}...`);
    }

    if (userMessages.length > 0) {
      const recentUser = userMessages[userMessages.length - 1];
				keyPoints.push(`最新用户提问: ${recentUser.content.slice(0, 150)}...`);
    }

    const highRelevanceMessages = messages
      .filter(m => m.relevanceScore && m.relevanceScore >= 70)
      .slice(0, 3);

    highRelevanceMessages.forEach(msg => {
      keyPoints.push(`${msg.role === 'user' ? '用户' : '助手'}: ${msg.content.slice(0, 100)}... (相关度: ${msg.relevanceScore}%)`);
    });

    return keyPoints.join(' | ');
  }
}

export class ChatStateMachine implements IStateMachine<ChatState> {
  private _state: ChatState;
  private _previousState: ChatState;
  private _transitionHistory: { from: ChatState; to: ChatState; timestamp: number }[];
  private _context: Message[];
  private config: StateMachineConfig;
  private transitionLock = false;
  private contextCompressor: ContextCompressor;
  private relevanceScorer: RelevanceScorer;
  private _stats: ContextStats;
  private statsUpdateTime = 0;

  public onStateChange?: (from: ChatState, to: ChatState) => void;
  public onTransitionError?: (from: ChatState, to: ChatState, error: Error) => void;
  public onContextUpdate?: (stats: ContextStats) => void;
  public onContextCompressed?: (result: CompressedContext) => void;

  constructor(initialState: ChatState = ChatState.Idle, config: StateMachineConfig = {}) {
    this._state = initialState;
    this._previousState = initialState;
    this._transitionHistory = [];
    this._context = [];
    this._stats = this.createEmptyStats();

    this.config = {
      throwOnError: false,
      enableDebug: false,
      autoResetOnSuccess: true,
      maxContextWindow: 50,
      contextCompressionThreshold: 60,
      minRelevanceScore: 30,
      ...config,
    };

    this.contextCompressor = new ContextCompressor();
    this.relevanceScorer = RelevanceScorer.getInstance();
  }

  private createEmptyStats(): ContextStats {
    return {
      totalMessages: 0,
      totalTokens: 0,
      userMessages: 0,
      assistantMessages: 0,
      systemMessages: 0,
      averageRelevance: 0,
      contextSize: 0,
    };
  }

  private updateStats(): void {
    const now = Date.now();
    if (now - this.statsUpdateTime < 100) return;

    const stats = {
      totalMessages: this._context.length,
      totalTokens: this._context.reduce((sum, m) => sum + m.tokens, 0),
      userMessages: this._context.filter(m => m.role === 'user').length,
      assistantMessages: this._context.filter(m => m.role === 'assistant').length,
      systemMessages: this._context.filter(m => m.role === 'system').length,
      averageRelevance: this._context.length > 0
        ? this._context.reduce((sum, m) => sum + (m.relevanceScore || 0), 0) / this._context.length
        : 0,
      contextSize: JSON.stringify(this._context).length,
    };

    this._stats = stats;
    this.statsUpdateTime = now;

    this.onContextUpdate?.(stats);
  }

  get state(): ChatState {
    return this._state;
  }

  get previousState(): ChatState {
    return this._previousState;
  }

  get transitionHistory(): { from: ChatState; to: ChatState; timestamp: number }[] {
    return [...this._transitionHistory];
  }

  get context(): Message[] {
    return [...this._context];
  }

  get stats(): ContextStats {
    this.updateStats();
    return { ...this._stats };
  }

  canTransition(to: ChatState): boolean {
    if (this.transitionLock) {
      if (this.config.enableDebug) {
        logger.debug('[ChatStateMachine] 状态转换被锁定: 当前状态 %s', this._state);
      }
      return false;
    }

    const allowedTransitions = VALID_TRANSITIONS[this._state] || [];
    return allowedTransitions.includes(to);
  }

  transition(to: ChatState): boolean {
    if (!this.canTransition(to)) {
      const errorMessage = `无效的状态转换: '${this._state}' -> '${to}'. 允许的转换: ${VALID_TRANSITIONS[this._state]?.join(', ') || '无'}`;

      if (this.config.throwOnError) {
        const error = new Error(errorMessage);
        this.onTransitionError?.(this._state, to, error);
        throw error;
      }

      if (this.config.enableDebug) {
        logger.warn(`[ChatStateMachine] ${errorMessage}`);
      }
      this.onTransitionError?.(this._state, to, new Error(errorMessage));
      return false;
    }

    const previousState = this._state;
    this._previousState = previousState;
    this._state = to;

    this._transitionHistory.push({
      from: previousState,
      to,
      timestamp: Date.now(),
    });

    if (this._transitionHistory.length > 500) {
      this._transitionHistory = this._transitionHistory.slice(-500);
    }

    if (this.config.enableDebug) {
      logger.debug('[ChatStateMachine] 状态转换: %s -> %s', previousState, to);
    }

    if (this.onStateChange) {
      try {
        this.onStateChange(previousState, to);
      } catch (callbackError) {
        logger.error(`[ChatStateMachine] onStateChange 回调执行失败:`, callbackError);
      }
    }

    if (this.config.autoResetOnSuccess && to === ChatState.Success) {
      setTimeout(() => {
        if (this._state === ChatState.Success) {
          this.transition(ChatState.Idle);
        }
      }, 2000);
    }

    return true;
  }

  reset(): void {
    this._state = ChatState.Idle;
    this._previousState = ChatState.Idle;
    this._transitionHistory = [];
    this._context = [];
    this._stats = this.createEmptyStats();
    if (this.config.enableDebug) {
      logger.debug('[ChatStateMachine] 已重置状态');
    }
  }

  isInState(...states: ChatState[]): boolean {
    return states.includes(this._state);
  }

  setTransitionLock(locked: boolean): void {
    this.transitionLock = locked;
    if (this.config.enableDebug) {
      logger.debug('[ChatStateMachine] 转换锁 %s', locked ? '已锁定' : '已解锁');
    }
  }

  getStateDuration(): number {
    const lastTransition = this._transitionHistory[this._transitionHistory.length - 1];
    if (!lastTransition) return 0;
    return Date.now() - lastTransition.timestamp;
  }

  getTransitionCount(from?: ChatState, to?: ChatState): number {
    return this._transitionHistory.filter(t => {
      const fromMatch = !from || t.from === from;
      const toMatch = !to || t.to === to;
      return fromMatch && toMatch;
    }).length;
  }

  addMessage(message: Omit<Message, 'id' | 'timestamp' | 'relevanceScore'>): Message {
    const newMessage: Message = {
      ...message,
      id: `${message.role}_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
      timestamp: Date.now(),
      relevanceScore: undefined,
    };

    this._context.push(newMessage);

    if (this._context.length > this.config.maxContextWindow!) {
      const result = this.compressContext();
      if (this.config.enableDebug) {
        logger.debug('[ChatStateMachine] 上下文已压缩: %d -> %d', result.originalMessageCount, result.compressedMessageCount);
      }
    }

    this.updateStats();

    return newMessage;
  }

  addMessages(messages: Omit<Message, 'id' | 'timestamp' | 'relevanceScore'>[]): Message[] {
    const addedMessages: Message[] = [];

    messages.forEach(msg => {
      addedMessages.push(this.addMessage(msg));
    });

    return addedMessages;
  }

  removeMessage(messageId: string): boolean {
    const index = this._context.findIndex(m => m.id === messageId);
    if (index !== -1) {
      this._context.splice(index, 1);
      this.updateStats();
      return true;
    }
    return false;
  }

  clearContext(): void {
    this._context = [];
    this.updateStats();
  }

  compressContext(currentQuery?: string): CompressedContext {
    const result = this.contextCompressor.compress(
      this._context,
      this.config.maxContextWindow,
      this.config.minRelevanceScore,
      currentQuery,
    );

    this._context = result.messages;
    this.updateStats();

    this.onContextCompressed?.(result);

    return result;
  }

  scoreContextRelevance(currentQuery?: string): number {
    const scored = this.relevanceScorer.batchScore(this._context, currentQuery);
    const avgScore = scored.reduce((sum, m) => sum + (m.relevanceScore || 0), 0) / scored.length;
    return Math.round(avgScore);
  }

  getContextSummary(): string {
    return this.contextCompressor.generateSummary(this._context);
  }

  getMessagesByRole(role: Message['role']): Message[] {
    return this._context.filter(m => m.role === role);
  }

  getHighRelevanceMessages(minScore = 70): Message[] {
    return this._context
      .filter(m => m.relevanceScore && m.relevanceScore >= minScore)
      .sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));
  }

  static getValidTransitions(): Record<ChatState, ChatState[]> {
    return { ...VALID_TRANSITIONS };
  }

  static getAllStates(): ChatState[] {
    return Object.values(ChatState);
  }

  static getInitialStates(): ChatState[] {
    return [ChatState.Idle];
  }

  static getTerminalStates(): ChatState[] {
    return [ChatState.Success, ChatState.Error, ChatState.RateLimited];
  }

  static getActiveStates(): ChatState[] {
    return [ChatState.Validating, ChatState.Sending, ChatState.Streaming,
            ChatState.Thinking, ChatState.Formatting, ChatState.Processing,
            ChatState.Retrying];
  }
}

export function createChatStateMachine(
  initialState?: ChatState,
  config?: StateMachineConfig,
): ChatStateMachine {
  return new ChatStateMachine(initialState, config);
}

export interface TransitionRule {
  from: ChatState;
  to: ChatState;
  isValid: boolean;
}

export function getTransitionRules(): TransitionRule[] {
  const rules: TransitionRule[] = [];
  const states = ChatStateMachine.getAllStates();

  for (const from of states) {
    const validTargets = VALID_TRANSITIONS[from] || [];

    for (const to of states) {
      rules.push({
        from,
        to,
        isValid: validTargets.includes(to),
      });
    }
  }

  return rules;
}

export function validateTransitionSequence(states: ChatState[]): boolean {
  for (let i = 0; i < states.length - 1; i++) {
    const from = states[i];
    const to = states[i + 1];
    if (!VALID_TRANSITIONS[from]?.includes(to)) {
      return false;
    }
  }
  return true;
}
