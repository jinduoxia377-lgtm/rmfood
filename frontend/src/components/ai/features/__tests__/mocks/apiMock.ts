import { vi } from 'vitest';

export interface MockApiResponse<T = unknown> {
  statusCode: number;
  data: T;
  message: string;
  timestamp: string;
}

export interface MockApiError {
  statusCode: number;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  timestamp: string;
}

export interface MockDelayOptions {
  min?: number;
  max?: number;
  fixed?: number;
}

type MockHandler<T> = (params?: Record<string, unknown>) => Promise<MockApiResponse<T>>;

class ApiMockService {
  private handlers = new Map<string, MockHandler<unknown>>();
  private defaultDelay: MockDelayOptions = { min: 50, max: 200 };

  setDefaultDelay(options: MockDelayOptions) {
    this.defaultDelay = options;
    return this;
  }

  register<T>(endpoint: string, handler: MockHandler<T>) {
    this.handlers.set(endpoint, handler as MockHandler<unknown>);
    return this;
  }

  async request<T>(endpoint: string, params?: Record<string, unknown>): Promise<MockApiResponse<T>> {
    const handler = this.handlers.get(endpoint);
    if (!handler) {
      throw new Error(`No mock handler registered for endpoint: ${endpoint}`);
    }
    await this.simulateDelay();
    return handler(params) as Promise<MockApiResponse<T>>;
  }

  unregister(endpoint: string) {
    this.handlers.delete(endpoint);
  }

  clearAll() {
    this.handlers.clear();
  }

  private async simulateDelay(): Promise<void> {
    const { min = 0, max = 0, fixed } = this.defaultDelay;
    const delay = fixed ?? Math.floor(Math.random() * (max - min + 1)) + min;
    return new Promise(resolve => setTimeout(resolve, delay));
  }

  createSuccessResponse<T>(data: T, message = 'Success'): MockApiResponse<T> {
    return {
      statusCode: 200,
      data,
      message,
      timestamp: new Date().toISOString(),
    };
  }

  createErrorResponse(statusCode: number, code: string, message: string, details?: Record<string, unknown>): MockApiError {
    return {
      statusCode,
      error: { code, message, details },
      timestamp: new Date().toISOString(),
    };
  }
}

export const apiMock = new ApiMockService();

export function createDynamicDelay(delayMs: MockDelayOptions): () => Promise<void> {
  const { min = 0, max = 0, fixed } = delayMs;
  return () => new Promise(resolve => {
    const delay = fixed ?? Math.floor(Math.random() * (max - min + 1)) + min;
    setTimeout(resolve, delay);
  });
}

export const mockScenarios = {
  success: <T>(data: T, message = '操作成功') =>
    apiMock.createSuccessResponse(data, message),

  unauthorized: () =>
    apiMock.createErrorResponse(401, 'UNAUTHORIZED', '认证失败，请重新登录', {
      reason: 'token_expired',
    }),

  rateLimited: (retryAfter = 60) =>
    apiMock.createErrorResponse(429, 'RATE_LIMITED', '请求过于频繁，请稍后再试', {
      retryAfter,
      remaining: 0,
    }),

  serverError: (status = 500) =>
    apiMock.createErrorResponse(status, 'INTERNAL_ERROR', '服务器内部错误，请稍后重试'),

  networkTimeout: (): never => {
    const error = new Error('Network timeout');
    error.name = 'TimeoutError';
    throw error;
  },

  networkError: (): never => {
    const error = new Error('Failed to fetch');
    error.name = 'NetworkError';
    throw error;
  },
};

export function createFetchMock() {
  const originalFetch = globalThis.fetch;
  const mockResponses = new Map<string, Response>();

  return {
    mockGet(url: string, response: Response) {
      mockResponses.set(url, response);
    },
    
    mockPost(url: string, response: Response) {
      mockResponses.set(url, response);
    },

    restore() {
      globalThis.fetch = originalFetch;
    },

    install() {
      globalThis.fetch = vi.fn(async (input: RequestInfo | URL): Promise<Response> => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
        
        for (const [mockUrl, response] of mockResponses) {
          if (url.includes(mockUrl)) {
            return response.clone();
          }
        }
        
        return originalFetch(input);
      });
    },
  };
}

apiMock.register('/api/auth/login', async (params) => ({
  statusCode: 200,
  data: {
    token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.signature',
    user: {
      id: params?.userId || 'user-001',
      username: params?.username || 'testuser',
      role: 'admin',
    },
    expiresIn: 3600,
  },
  message: '登录成功',
  timestamp: new Date().toISOString(),
}));

apiMock.register('/api/ai/chat/send', async (params) => ({
  statusCode: 200,
  data: {
    id: crypto.randomUUID(),
    content: `关于"${params?.message || ''}"的AI回复内容`,
    role: 'assistant',
    model: 'gpt-4-turbo',
    formulas: [],
    timestamp: Date.now(),
  },
  message: 'success',
  timestamp: new Date().toISOString(),
}));

apiMock.register('/api/formulas/list', async () => ({
  statusCode: 200,
  data: [
    {
      id: 'fmt-001',
      name: '胶原蛋白肽配方',
      category: '功能性成分',
      createdAt: new Date().toISOString(),
    },
  ],
  message: 'success',
  timestamp: new Date().toISOString(),
}));

apiMock.register('/api/reports/generate', async () => ({
  statusCode: 200,
  data: {
    reportId: crypto.randomUUID(),
    downloadUrl: '/api/reports/download/test-report.pdf',
    format: 'pdf',
  },
  message: '报告生成成功',
  timestamp: new Date().toISOString(),
}));
