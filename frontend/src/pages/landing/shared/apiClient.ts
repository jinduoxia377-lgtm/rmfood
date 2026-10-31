/**
 * Landing Page — 共享 API 客户端
 *
 * 提供：
 *   - fetchWithTimeout：带 10s 超时的 fetch 包装（AbortController）
 *   - friendlyError：错误消息人性化映射（网络异常/超时/HTTP 状态）
 *   - LRUCache：通用 LRU 内存缓存，避免重复请求
 *   - submitDemoBooking：预约演示提交（POST /api/v1/leads/demo-booking）
 *   - cachedDemoChat：带 LRU 缓存的演示对话（POST /api/v1/ai/demo/chat）
 *
 * 所有 fetch 调用均使用 try/catch + 10s 超时，后端不可用时优雅降级。
 */

// ── 默认超时（10 秒） ──────────────────────────────────────────
const DEFAULT_TIMEOUT_MS = 10_000;

/**
 * 带超时控制的 fetch 包装。
 * 超过 timeoutMs 自动 abort，抛出 "请求超时" 错误。
 */
export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('请求超时，请稍后重试');
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 将底层错误映射为用户友好的错误消息。
 */
export function friendlyError(err: unknown, fallback = '操作失败，请稍后重试'): string {
  if (err instanceof TypeError && /failed to fetch|network|load|offline/i.test(err.message)) {
    return '网络异常，请检查连接后重试';
  }
  if (err instanceof Error) {
    if (/超时|timeout/i.test(err.message)) return err.message;
    if (/HTTP\s+\d+/i.test(err.message)) {
      const code = err.message.match(/\d+/)?.[0];
      if (code === '404') return '请求的资源不存在';
      if (code === '429') return '请求过于频繁，请稍后再试';
      if (code === '500' || code === '502' || code === '503') return '服务暂时不可用，请稍后重试';
    }
    if (err.message) return err.message;
  }
  return fallback;
}

// ── LRU Cache ──────────────────────────────────────────────────

/**
 * 简单 LRU 缓存，用于避免重复 API 请求。
 * 当缓存条目超过 maxSize 时，自动淘汰最久未使用的条目。
 */
export class LRUCache<K, V> {
  private store = new Map<K, V>();

  constructor(private readonly maxSize: number) {}

  get(key: K): V | undefined {
    if (!this.store.has(key)) return undefined;
    const value = this.store.get(key)!;
    // 移动到末尾（最近使用）
    this.store.delete(key);
    this.store.set(key, value);
    return value;
  }

  set(key: K, value: V): void {
    if (this.store.has(key)) {
      this.store.delete(key);
    }
    this.store.set(key, value);
    if (this.store.size > this.maxSize) {
      const firstKey = this.store.keys().next().value;
      if (firstKey !== undefined) this.store.delete(firstKey);
    }
  }

  has(key: K): boolean {
    return this.store.has(key);
  }

  get size(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }
}

// ── 预约演示 ───────────────────────────────────────────────────

export interface DemoBookingPayload {
  name: string;
  email: string;
  company?: string;
  industry?: string;
  budget?: string;
  notes?: string;
}

export interface DemoBookingResponse {
  success: boolean;
  id: string;
}

/**
 * 提交预约演示表单。
 * POST /api/v1/leads/demo-booking
 */
export async function submitDemoBooking(
  payload: DemoBookingPayload,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<DemoBookingResponse> {
  const res = await fetchWithTimeout(
    '/api/v1/leads/demo-booking',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    },
    timeoutMs,
  );
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  return res.json() as Promise<DemoBookingResponse>;
}

// ── 演示对话（带缓存） ─────────────────────────────────────────

export interface DemoChatResponse {
  reply: string;
  confidence: number;
}

/** 演示对话 LRU 缓存（最多 20 条预设问题） */
const demoChatCache = new LRUCache<string, DemoChatResponse>(20);

/**
 * 带 LRU 缓存的演示对话调用。
 * 相同问题不会重复请求后端。
 */
export async function cachedDemoChat(
  message: string,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<DemoChatResponse> {
  const key = message.trim().toLowerCase();
  if (!key) throw new Error('消息不能为空');

  const cached = demoChatCache.get(key);
  if (cached) return cached;

  const res = await fetchWithTimeout(
    '/api/v1/ai/demo/chat',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ message }),
    },
    timeoutMs,
  );

  if (!res.ok) {
    const error = await res.json().catch(() => ({} as Record<string, unknown>));
    const detail = (error as { detail?: { message?: string } }).detail;
    throw new Error(detail?.message || '请求失败，请稍后重试');
  }

  const result = (await res.json()) as DemoChatResponse;
  demoChatCache.set(key, result);
  return result;
}
