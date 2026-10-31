/**
 * HTTP 璇锋眰宸ュ叿
 * 鍩轰簬鍘熺敓 fetch 灏佽锛屾敮鎸?GET/POST/PUT/DELETE
 */

const BASE_URL = '';

export interface RequestConfig extends RequestInit {
  params?: Record<string, any>;
}

interface ApiResponse<T = any> {
  data: T;
  status: number;
  message?: string;
}

/**
 * 鏋勫缓瀹屾暣 URL锛堟敮鎸佹煡璇㈠弬鏁帮級
 */
function buildUrl(path: string, params?: Record<string, any>): string {
  const url = new URL(`${BASE_URL}${path}`, window.location.origin);
  
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, String(value));
      }
    });
  }
  
  return url.toString();
}

/**
 * 鑾峰彇 CSRF Token锛堜粠cookie璇诲彇锛? */
function getCsrfToken(): string | null {
  const match = document.cookie.match(new RegExp('(^| )' + 'csrf_token' + '=([^;]+)'));
  return match ? match[2] : null;
}

/**
 * 缁熶竴璇锋眰鏂规硶
 */
async function _request<T = any>(
  path: string,
  config: RequestConfig = {}
): Promise<ApiResponse<T>> {
  const { params, headers: customHeaders, ...restConfig } = config;
  const url = buildUrl(path, params);
  
  const csrfToken = getCsrfToken();
  const headers: Record<string, any> = {
    'Content-Type': 'application/json',
    ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
    ...customHeaders,
  };

  const response = await fetch(url, {
    ...restConfig,
    headers,
    credentials: 'include',
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const error = new Error(data?.detail || data?.message || 'Request failed') as Error & { status?: number; data?: unknown };
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return {
    data: data,
    status: response.status,
  };
}

/**
 * GET 璇锋眰
 */
export async function get<T = any>(
  path: string,
  params?: Record<string, any>
): Promise<ApiResponse<T>> {
  return _request<T>(path, { method: 'GET', params });
}

/**
 * POST 璇锋眰
 */
export async function post<T = any>(
  path: string,
  data?: any,
  config?: RequestConfig
): Promise<ApiResponse<T>> {
  return _request<T>(path, {
    method: 'POST',
    body: JSON.stringify(data),
    ...config,
  });
}

/**
 * PUT 璇锋眰
 */
export async function put<T = any>(
  path: string,
  data?: any,
  config?: RequestConfig
): Promise<ApiResponse<T>> {
  return _request<T>(path, {
    method: 'PUT',
    body: JSON.stringify(data),
    ...config,
  });
}

/**
 * DELETE 璇锋眰
 */
export async function del<T = any>(
  path: string,
  config?: RequestConfig
): Promise<ApiResponse<T>> {
  return _request<T>(path, { method: 'DELETE', ...config });
}

/**
 * PATCH 璇锋眰
 */
export async function patch<T = any>(
  path: string,
  data?: any,
  config?: RequestConfig
): Promise<ApiResponse<T>> {
  return _request<T>(path, {
    method: 'PATCH',
    body: JSON.stringify(data),
    ...config,
  });
}

// 瀵煎嚭渚挎嵎鏂规硶
export const request = {
  get,
  post,
  put,
  delete: del,
  patch,
};

export default request;

