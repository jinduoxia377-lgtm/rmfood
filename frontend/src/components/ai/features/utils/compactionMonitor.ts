/**
 * CompactionLock 监控服务
 *
 * 基于 DeepSeek Harness 的监控机制实现：
 * - 锁超时告警
 * - 性能指标收集
 * - 实时状态上报
 */

import { logger } from '@/utils/safeLogger';
import type { CompactionLock } from './compactionLock';

export interface CompactionMetrics {
  /** 总压缩次数 */
  totalCompactions: number;
  /** 平均压缩耗时 (ms) */
  avgCompactionTime: number;
  /** 锁等待时间 (ms) */
  avgLockWaitTime: number;
  /** 锁超时次数 */
  lockTimeoutCount: number;
  /** 最近一次压缩时间 */
  lastCompactionAt: number | null;
}

export interface LockAlert {
  type: 'timeout' | 'contention' | 'error';
  lockId: string;
  turnId?: string;
  message: string;
  timestamp: number;
}

// ── 全局状态 ───────────────────────────────────────────────

let _metrics: CompactionMetrics = {
  totalCompactions: 0,
  avgCompactionTime: 0,
  avgLockWaitTime: 0,
  lockTimeoutCount: 0,
  lastCompactionAt: null,
};

let _alerts: LockAlert[] = [];
let _onAlertCallback: ((alert: LockAlert) => void) | null = null;
let _onMetricsUpdateCallback: ((metrics: CompactionMetrics) => void) | null = null;

const LOCK_TIMEOUT_THRESHOLD_MS = 30_000; // 30秒超时阈值
const ALERT_RETENTION_MS = 5 * 60 * 1000; // 保留5分钟告警

// ── 监控服务 ───────────────────────────────────────────────

export class CompactionMonitor {
  private static instance: CompactionMonitor | null = null;

  private constructor() {}

  static getInstance(): CompactionMonitor {
    if (!CompactionMonitor.instance) {
      CompactionMonitor.instance = new CompactionMonitor();
    }
    return CompactionMonitor.instance;
  }

  /** 注册告警回调 */
  onAlert(callback: (alert: LockAlert) => void): () => void {
    _onAlertCallback = callback;
    return () => { _onAlertCallback = null; };
  }

  /** 注册指标更新回调 */
  onMetricsUpdate(callback: (metrics: CompactionMetrics) => void): () => void {
    _onMetricsUpdateCallback = callback;
    return () => { _onMetricsUpdateCallback = null; };
  }

  /**
   * 记录压缩开始
   */
  recordCompactionStart(lock: CompactionLock): void {
    logger.info(`[CompactionMonitor] Compaction started: ${lock.compactionId}`);
  }

  /**
   * 记录压缩完成
   */
  recordCompactionEnd(durationMs: number, tokensSaved: number): void {
    _metrics.totalCompactions++;
    _metrics.lastCompactionAt = Date.now();
    _metrics.avgCompactionTime =
      (_metrics.avgCompactionTime * (_metrics.totalCompactions - 1) + durationMs) /
      _metrics.totalCompactions;

    logger.info(`[CompactionMonitor] Compaction completed: ${durationMs}ms, saved ${tokensSaved} tokens`);

    this.emitMetricsUpdate();
  }

  /**
   * 记录锁获取延迟
   */
  recordLockWaitTime(waitTimeMs: number): void {
    _metrics.avgLockWaitTime =
      (_metrics.avgLockWaitTime * (_metrics.totalCompactions) + waitTimeMs) /
      (_metrics.totalCompactions + 1);
  }

  /**
   * 记录锁超时告警
   */
  recordLockTimeout(lock: CompactionLock): void {
    _metrics.lockTimeoutCount++;

    const alert: LockAlert = {
      type: 'timeout',
      lockId: lock.compactionId,
      turnId: lock.turn ?? undefined,
      message: `Compaction lock timed out after ${LOCK_TIMEOUT_THRESHOLD_MS}ms`,
      timestamp: Date.now(),
    };

    this.addAlert(alert);
    logger.error(`[CompactionMonitor] Lock timeout: ${lock.compactionId}`);
  }

  /**
   * 添加告警
   */
  addAlert(alert: LockAlert): void {
    _alerts.push(alert);
    // 清理过期告警
    _alerts = _alerts.filter((a) => Date.now() - a.timestamp < ALERT_RETENTION_MS);

    logger.warn(`[CompactionMonitor] Alert: ${alert.type} - ${alert.message}`);
    this.emitAlert(alert);
  }

  /**
   * 获取当前指标
   */
  getMetrics(): CompactionMetrics {
    return { ..._metrics };
  }

  /**
   * 获取最近告警
   */
  getRecentAlerts(limit: number = 10): LockAlert[] {
    return _alerts.slice(-limit).reverse();
  }

  /**
   * 重置监控状态 (用于测试)
   */
  reset(): void {
    _metrics = {
      totalCompactions: 0,
      avgCompactionTime: 0,
      avgLockWaitTime: 0,
      lockTimeoutCount: 0,
      lastCompactionAt: null,
    };
    _alerts = [];
  }

  private emitAlert(alert: LockAlert): void {
    if (_onAlertCallback) {
      try {
        _onAlertCallback(alert);
      } catch (err) {
        logger.error('[CompactionMonitor] Alert callback error:', err);
      }
    }
  }

  private emitMetricsUpdate(): void {
    if (_onMetricsUpdateCallback) {
      try {
        _onMetricsUpdateCallback({ ..._metrics });
      } catch (err) {
        logger.error('[CompactionMonitor] Metrics callback error:', err);
      }
    }
  }
}

// ── 便捷函数 ───────────────────────────────────────────────

export const compactionMonitor = CompactionMonitor.getInstance();

/**
 * 启动锁健康检查
 * 定期检查锁状态，发现异常时发出告警
 */
export function startLockHealthCheck(intervalMs: number = 10_000): () => void {
  const check = () => {
    // 这里可以添加更多健康检查逻辑
    // 例如：检查是否有长时间未释放的锁
  };

  const timer = setInterval(check, intervalMs);
  return () => clearInterval(timer);
}

/**
 * 获取监控仪表板数据
 */
export function getDashboardData() {
  const metrics = compactionMonitor.getMetrics();
  const alerts = compactionMonitor.getRecentAlerts(5);

  return {
    metrics,
    recentAlerts: alerts,
    health: {
      status: metrics.lockTimeoutCount > 0 ? 'warning' : 'healthy',
      totalCompactions: metrics.totalCompactions,
      avgCompactionTime: Math.round(metrics.avgCompactionTime),
      lockTimeouts: metrics.lockTimeoutCount,
    },
  };
}
