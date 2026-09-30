/**
 * CSRF Token 管理工具
 * 从 document.cookie 读取 csrf_token，供所有直接使用 fetch 的模块复用
 */

export function getCsrfToken(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp('(^| )' + 'csrf_token' + '=([^;]+)'));
  return match ? match[2] : null;
}

export interface FetchOptionsWithCsrf extends RequestInit {
  path: string;
}

/**
 * 带 CSRF token 的 fetch 请求
 * 自动从 cookie 读取 csrf_token 并注入 X-CSRF-Token 头
 */
export async function fetchWithCsrf<T = unknown>(
  url: string,
  options: RequestInit = {},
): Promise<T> {
  const csrfToken = getCsrfToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> ?? {}),
  };
  if (csrfToken && ['POST', 'PUT', 'PATCH', 'DELETE'].includes((options.method ?? 'GET').toUpperCase())) {
    headers['X-CSRF-Token'] = csrfToken;
  }
  const res = await fetch(url, { ...options, headers, credentials: 'include' });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}
