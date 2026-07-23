import { logger } from '@/utils/safeLogger';
import { envConfig } from '@/config/env';

/**
 * Analytics Service - 统一数据服务层
 * 提供数据获取、缓存、转换、实时更新的完整解决方案
 */

// ─── 类型定义 ───
export interface KPIData {
  id: string;
  name: string;
  value: number;
  unit: string;
  change_percent: number;
  change_direction: 'up' | 'down' | 'neutral';
  target?: number;
  icon?: string;
}

export interface TimeSeriesDataPoint {
  timestamp: string;
  value: number;
  label?: string;
  category?: string;
}

export interface ChartConfig {
  type: 'line' | 'bar' | 'pie' | 'area' | 'radar' | 'scatter' | 'heatmap';
  title: string;
  data: any[];
  options?: Record<string, any>;
  xAxis?: string;
  yAxis?: string[];
}

export interface FilterOptions {
  timeRange: '7d' | '30d' | '90d' | '1y' | 'custom';
  startDate?: Date;
  endDate?: Date;
  categories?: string[];
  status?: string[];
  users?: string[];
  tags?: string[];
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface AnalyticsResponse<T> {
  success: boolean;
  data: T;
  timestamp: string;
  meta?: {
    total: number;
    page: number;
    pageSize: number;
    filtersApplied: FilterOptions;
  };
}

// ─── 数据缓存管理器 ───
class DataCacheManager {
  private cache = new Map<string, { data: any; timestamp: number; ttl: number }>();

  private defaultTTL = 30_000; // 30秒默认缓存时间

  set(key: string, data: any, ttl: number = this.defaultTTL) {
    this.cache.set(key, { data, timestamp: Date.now(), ttl });
  }

  get(key: string): any | null {
    const item = this.cache.get(key);
    if (!item) return null;

    if (Date.now() - item.timestamp > item.ttl) {
      this.cache.delete(key);
      return null;
    }

    return item.data;
  }

  invalidate(pattern?: string) {
    if (!pattern) {
      this.cache.clear();
      return;
    }

    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    }
  }

  getStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }
}

export const cacheManager = new DataCacheManager();

// ─── 核心数据服务类 ───
class AnalyticsService {
  private baseUrl = `${envConfig.api.baseUrl}/analytics`;
  private wsUrl = import.meta.env?.VITE_WS_ANALYTICS_URL || `ws://localhost:8000/api/v1/ws/analytics`;
  private ws: WebSocket | null = null;
  private listeners = new Map<string, Set<Function>>();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  // ─── HTTP API 方法 ───

  async fetchKPIs(filters?: FilterOptions): Promise<AnalyticsResponse<KPIData[]>> {
    const cacheKey = `kpis-${JSON.stringify(filters)}`;
    const cached = cacheManager.get(cacheKey);
    if (cached) return cached;

    try {
      const params = new URLSearchParams();
      if (filters?.timeRange) params.append('range', filters.timeRange);
      if (filters?.categories?.length) params.append('categories', filters.categories.join(','));

      const response = await fetch(`${this.baseUrl}/dashboard/kpi?${params}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('access_token') || ''}` },
      });

      const result = await response.json();
      cacheManager.set(cacheKey, result);
      return result;
    } catch (error) {
      logger.error('[AnalyticsService] Failed to fetch KPIs:', error);
      throw error;
    }
  }

  async fetchTimeSeries(
    metric: string,
    filters?: FilterOptions,
    granularity: 'hourly' | 'daily' | 'weekly' | 'monthly' = 'daily',
  ): Promise<AnalyticsResponse<TimeSeriesDataPoint[]>> {
    const cacheKey = `timeseries-${metric}-${granularity}-${JSON.stringify(filters)}`;
    const cached = cacheManager.get(cacheKey);
    if (cached) return cached;

    try {
      const params = new URLSearchParams({
        metric,
        granularity,
        ...(filters?.timeRange && { range: filters.timeRange }),
        ...(filters?.startDate && { start: filters.startDate.toISOString() }),
        ...(filters?.endDate && { end: filters.endDate.toISOString() }),
      });

      const response = await fetch(`${this.baseUrl}/charts/timeseries?${params}`);
      const result = await response.json();

      cacheManager.set(cacheKey, result, 15_000); // 时间序列数据15秒缓存
      return result;
    } catch (error) {
      logger.error('[AnalyticsService] Failed to fetch time series:', error);
      throw error;
    }
  }

  async fetchDistribution(
    dimension: string,
    filters?: FilterOptions,
  ): Promise<AnalyticsResponse<{ label: string; value: number; percentage: number }[]>> {
    const cacheKey = `distribution-${dimension}-${JSON.stringify(filters)}`;
    const cached = cacheManager.get(cacheKey);
    if (cached) return cached;

    try {
      const params = new URLSearchParams({
        dimension,
        ...(filters &&
          Object.fromEntries(
            Object.entries(filters)
              .filter(([_, v]) => v != null)
              .map(([k, v]) => [k, String(v)]),
          )),
      });
      const response = await fetch(`${this.baseUrl}/charts/distribution?${params}`);
      const result = await response.json();

      cacheManager.set(cacheKey, result, 60_000); // 分布数据60秒缓存
      return result;
    } catch (error) {
      logger.error('[AnalyticsService] Failed to fetch distribution:', error);
      throw error;
    }
  }

  async fetchRecentActivity(
    limit = 20,
    filters?: FilterOptions,
  ): Promise<
    AnalyticsResponse<
      {
        id: string;
        type: 'create' | 'update' | 'delete' | 'export' | 'review' | 'comment';
        title: string;
        description?: string;
        author: string;
        timestamp: string;
        metadata?: Record<string, any>;
      }[]
    >
  > {
    try {
      const params = new URLSearchParams({
        limit: limit.toString(),
        ...(filters &&
          Object.fromEntries(
            Object.entries(filters)
              .filter(([_, v]) => v != null)
              .map(([k, v]) => [k, String(v)]),
          )),
      });
      const response = await fetch(`${this.baseUrl}/activity/recent?${params}`);
      return await response.json();
    } catch (error) {
      logger.error('[AnalyticsService] Failed to fetch recent activity:', error);
      throw error;
    }
  }

  async exportData(format: 'csv' | 'excel' | 'pdf', filters?: FilterOptions, includeCharts = true): Promise<Blob> {
    try {
      const params = new URLSearchParams({
        format,
        includeCharts: includeCharts.toString(),
        ...(filters && JSON.parse(JSON.stringify(filters))),
      });

      const response = await fetch(`${this.baseUrl}/export?${params}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('access_token') || ''}` },
      });

      if (!response.ok) {
        throw new Error(`Export failed: ${response.statusText}`);
      }

      return await response.blob();
    } catch (error) {
      logger.error('[AnalyticsService] Export failed:', error);
      throw error;
    }
  }

  // ─── WebSocket 实时数据方法 ───

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.wsUrl);

        this.ws.onopen = () => {
          logger.info('[AnalyticsService] WebSocket connected');
          this.reconnectAttempts = 0;
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            this.handleWSMessage(message);
          } catch (error) {
            logger.error('[AnalyticsService] Failed to parse WS message:', error);
          }
        };

        this.ws.onerror = (error) => {
          logger.error('[AnalyticsService] WebSocket error:', error);
          reject(error);
        };

        this.ws.onclose = () => {
          logger.info('[AnalyticsService] WebSocket disconnected');
          this.scheduleReconnect();
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.listeners.clear();
  }

  subscribe(eventType: string, callback: Function): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType)!.add(callback);

    // 返回取消订阅函数
    return () => {
      this.listeners.get(eventType)?.delete(callback);
    };
  }

  private scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.warn('[AnalyticsService] Max reconnect attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);

    setTimeout(() => {
      logger.info(
        `[AnalyticsService] Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`,
      );
      this.connect().catch(console.error);
    }, delay);
  }

  private handleWSMessage(message: { type: string; data: any; timestamp: string }) {
    const callbacks = this.listeners.get(message.type);
    if (callbacks) {
      callbacks.forEach((callback) => {
        try {
          callback(message.data, message.timestamp);
        } catch (error) {
          logger.error('[AnalyticsService] Error in WS listener:', error);
        }
      });
    }

    // 更新相关缓存
    cacheManager.invalidate(message.type);
  }

  // ─── 数据转换工具方法 ───

  static transformToChartFormat(rawData: any[], config: ChartConfig): any[] {
    switch (config.type) {
      case 'line':
      case 'area':
        return rawData.map((item) => ({
          x: item[config.xAxis || 'timestamp'],
          y: item[config.yAxis?.[0] || 'value'],
          ...item,
        }));

      case 'bar':
        return rawData.map((item) => ({
          name: item[config.xAxis || 'name'],
          value: item[config.yAxis?.[0] || 'value'],
          ...item,
        }));

      case 'pie':
        return rawData.map((item) => ({
          name: item.name || item.label,
          value: item.value || item.count,
          ...item,
        }));

      default:
        return rawData;
    }
  }

  static calculateAggregates(data: number[]): {
    sum: number;
    avg: number;
    min: number;
    max: number;
    count: number;
    median: number;
    percentile90: number;
    percentile95: number;
  } {
    if (!data.length) {
      return { sum: 0, avg: 0, min: 0, max: 0, count: 0, median: 0, percentile90: 0, percentile95: 0 };
    }

    const sorted = [...data].sort((a, b) => a - b);
    const sum = data.reduce((acc, val) => acc + val, 0);

    return {
      sum,
      avg: sum / data.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      count: data.length,
      median: sorted[Math.floor(sorted.length / 2)],
      percentile90: sorted[Math.floor(sorted.length * 0.9)],
      percentile95: sorted[Math.floor(sorted.length * 0.95)],
    };
  }

  static detectAnomalies(data: TimeSeriesDataPoint[], threshold = 2): TimeSeriesDataPoint[] {
    if (data.length < 10) return [];

    const values = data.map((d) => d.value);
    const { avg, percentile95 } = AnalyticsService.calculateAggregates(values);
    const stdDev = Math.sqrt(values.reduce((acc, val) => acc + Math.pow(val - avg, 2), 0) / values.length);

    return data.filter((point) => Math.abs(point.value - avg) > threshold * stdDev || point.value > percentile95 * 1.5);
  }
}

// ─── 导出单例实例 ───
export const analyticsService = new AnalyticsService();
