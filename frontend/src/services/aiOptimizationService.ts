interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expires: number;
}

class AIOptimizationService {
  private responseCache = new Map<string, CacheEntry<any>>();
  private requestQueue: {
    id: string;
    promise: Promise<any>;
    timestamp: number;
  }[] = [];

  private readonly CACHE_TTL = 5 * 60 * 1000;
  private readonly MAX_QUEUE_SIZE = 10;

  async cachedRequest<T>(
    key: string,
    requestFn: () => Promise<T>,
    ttl: number = this.CACHE_TTL,
  ): Promise<T> {
    const cached = this.responseCache.get(key);

    if (cached && Date.now() < cached.expires) {
      return cached.data;
    }

    const result = await requestFn();

    this.responseCache.set(key, {
      data: result,
      timestamp: Date.now(),
      expires: Date.now() + ttl,
    });

    this.cleanupCache();

    return result;
  }

  optimizeRequest<T>(
    id: string,
    requestFn: () => Promise<T>,
  ): Promise<T> {
    const startTime = performance.now();

    const promise = requestFn().finally(() => {
      this.requestQueue = this.requestQueue.filter(req => req.id !== id);
    });

    this.requestQueue.push({ id, promise, timestamp: startTime });

    if (this.requestQueue.length > this.MAX_QUEUE_SIZE) {
      this.requestQueue.shift();
    }

    return promise;
  }

  private cleanupCache() {
    const now = Date.now();
    for (const [key, entry] of this.responseCache.entries()) {
      if (now > entry.expires) {
        this.responseCache.delete(key);
      }
    }
  }

  getStats() {
    return {
      cacheSize: this.responseCache.size,
      queueSize: this.requestQueue.length,
    };
  }

  clearCache() {
    this.responseCache.clear();
    this.requestQueue = [];
  }
}

export const aiOptimizationService = new AIOptimizationService();

export const debounce = <F extends (...args: any[]) => any>(
  func: F,
  wait: number,
) => {
  let timeout: any = null;

  return function executedFunction(...args: any[]) {
    const later = () => {
      timeout = null;
      func(...args);
    };

    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

export const throttle = <F extends (...args: any[]) => any>(
  func: F,
  limit: number,
) => {
  let inThrottle: boolean;

  return function(this: any, ...args: any[]) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
};
