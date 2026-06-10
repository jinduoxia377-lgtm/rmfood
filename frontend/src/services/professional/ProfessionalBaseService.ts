import type { ProfessionalServiceConfig, ApiResponse, ErrorResponse } from '../../types/professional';

export class ProfessionalBaseService {
  protected baseURL: string;
  protected timeout: number;
  protected retries: number;
  protected cacheEnabled: boolean;
  protected cacheDuration: number;
  protected cache: Map<string, { data: any; timestamp: number }>;
  protected abortControllers: Map<string, AbortController>;

  constructor(config: ProfessionalServiceConfig = {}) {
    this.baseURL = config.baseURL || '/api';
    this.timeout = config.timeout || 30000;
    this.retries = config.retries || 3;
    this.cacheEnabled = config.cacheEnabled !== false;
    this.cacheDuration = config.cacheDuration || 5 * 60 * 1000;
    this.cache = new Map();
    this.abortControllers = new Map();
  }

  protected getCacheKey(endpoint: string, params?: any): string {
    return `${endpoint}:${params ? JSON.stringify(params) : ''}`;
  }

  protected getFromCache(key: string): any | null {
    if (!this.cacheEnabled) return null;

    const cached = this.cache.get(key);
    if (!cached) return null;

    const now = Date.now();
    if (now - cached.timestamp > this.cacheDuration) {
      this.cache.delete(key);
      return null;
    }

    return cached.data;
  }

  protected setCache(key: string, data: any): void {
    if (!this.cacheEnabled) return;

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }

  protected clearCache(): void {
    this.cache.clear();
  }

  protected clearCacheByPattern(pattern: string): void {
    const keysToDelete: string[] = [];
    this.cache.forEach((_, key) => {
      if (key.includes(pattern)) {
        keysToDelete.push(key);
      }
    });
    keysToDelete.forEach(key => this.cache.delete(key));
  }

  protected async fetchWithTimeout(
    url: string,
    options: RequestInit = {},
    timeout: number = this.timeout,
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  protected async request<T>(
    endpoint: string,
    options: RequestInit = {},
    useCache = true,
    cacheKey?: string,
  ): Promise<T> {
    const key = cacheKey || this.getCacheKey(endpoint, options.body);

    if (useCache && (options.method === 'GET' || !options.method)) {
      const cached = this.getFromCache(key);
      if (cached) {
        return cached as T;
      }
    }

    const url = `${this.baseURL}${endpoint}`;
    const requestOptions: RequestInit = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    };

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.retries; attempt++) {
      try {
        const response = await this.fetchWithTimeout(url, requestOptions);

        if (!response.ok) {
          const errorData: ErrorResponse = await response.json().catch(() => ({
            error: 'Unknown error',
            message: response.statusText,
            status: response.status,
          }));

          throw new Error(errorData.message || `HTTP ${response.status}`);
        }

        const data: ApiResponse<T> = await response.json();

        if (useCache && (options.method === 'GET' || !options.method)) {
          this.setCache(key, data);
        }

        return data.data;
      } catch (error) {
        lastError = error as Error;

        if (error instanceof Error && error.name === 'AbortError') {
          throw new Error('Request timeout');
        }

        if (attempt < this.retries - 1) {
          await this.delay(Math.pow(2, attempt) * 1000);
        }
      }
    }

    throw lastError || new Error('Request failed');
  }

  protected async get<T>(endpoint: string, params?: any, useCache = true): Promise<T> {
    const queryString = params ? '?' + new URLSearchParams(params).toString() : '';
    return this.request<T>(`${endpoint}${queryString}`, {
      method: 'GET',
    }, useCache);
  }

  protected async post<T>(endpoint: string, data: any, useCache = false): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    }, useCache);
  }

  protected async put<T>(endpoint: string, data: any, useCache = false): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    }, useCache);
  }

  protected async delete<T>(endpoint: string, useCache = false): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'DELETE',
    }, useCache);
  }

  protected async patch<T>(endpoint: string, data: any, useCache = false): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }, useCache);
  }

  protected async upload<T>(
    endpoint: string,
    file: File | Blob,
    additionalData?: Record<string, string>,
    onProgress?: (progress: number) => void,
  ): Promise<T> {
    const formData = new FormData();
    formData.append('file', file);

    if (additionalData) {
      Object.entries(additionalData).forEach(([key, value]) => {
        formData.append(key, value);
      });
    }

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      if (onProgress) {
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const progress = (event.loaded / event.total) * 100;
            onProgress(progress);
          }
        };
      }

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const response = JSON.parse(xhr.responseText);
            resolve(response.data);
          } catch {
            resolve(xhr.responseText as any);
          }
        } else {
          reject(new Error(`Upload failed: ${xhr.statusText}`));
        }
      };

      xhr.onerror = () => {
        reject(new Error('Network error'));
      };

      xhr.open('POST', `${this.baseURL}${endpoint}`);
      xhr.send(formData);
    });
  }

  protected cancelRequest(key: string): void {
    const controller = this.abortControllers.get(key);
    if (controller) {
      controller.abort();
      this.abortControllers.delete(key);
    }
  }

  protected cancelAllRequests(): void {
    this.abortControllers.forEach((controller) => {
      controller.abort();
    });
    this.abortControllers.clear();
  }

  protected delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  protected validateResponse<T>(data: any): T {
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid response data');
    }
    return data as T;
  }

  protected formatError(error: any): Error {
    if (error instanceof Error) {
      return error;
    }

    if (typeof error === 'string') {
      return new Error(error);
    }

    if (error?.message) {
      return new Error(error.message);
    }

    return new Error('Unknown error occurred');
  }

  protected async retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxRetries = 3,
    baseDelay = 1000,
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = this.formatError(error);

        if (attempt < maxRetries - 1) {
          const delay = baseDelay * Math.pow(2, attempt);
          await this.delay(delay);
        }
      }
    }

    throw lastError;
  }

  protected getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }

  protected optimizeCache(maxSize = 100): void {
    if (this.cache.size > maxSize) {
      const entries = Array.from(this.cache.entries());
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);

      const toDelete = entries.slice(0, entries.length - maxSize);
      toDelete.forEach(([key]) => this.cache.delete(key));
    }
  }
}

export default ProfessionalBaseService;
