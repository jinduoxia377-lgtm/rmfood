/**
 * CompactionLock - 压缩锁机制
 *
 * 基于 DeepSeek Harness 的 CompactionLock 实现：
 * - 防止并发压缩导致数据不一致
 * - 未匹配的 start 阻止所有入口点
 * - 自动超时释放
 */

import { logger } from '@/utils/safeLogger';

export type CompactionId = string;
export type TurnId = string;

export interface CompactionLock {
  /** 压缩操作唯一 ID */
  compactionId: CompactionId;
  /** 触发的 turn ID (自动压缩为数字, 手动为 null) */
  turn: TurnId | null;
  /** 锁定开始时间 */
  startedAt: number;
  /** 是否已释放 */
  released: boolean;
}

export interface CompactionLockOptions {
  /** 锁超时时间 (默认 30 秒) */
  timeoutMs?: number;
  /** 锁所有者标识 */
  owner?: string;
}

const DEFAULT_TIMEOUT_MS = 30_000;
const LOCK_SUFFIX = '-lock';

let _activeLock: CompactionLock | null = null;
let _lockCounter = 0;

/**
 * 生成唯一的压缩锁 ID
 */
function generateLockId(): CompactionId {
  _lockCounter++;
  return `compaction-lock-${Date.now()}-${_lockCounter}`;
}

/**
 * 获取当前活动的压缩锁
 */
export function getActiveCompactionLock(): CompactionLock | null {
  // 检查锁是否已超时
  if (_activeLock && _activeLock.released) {
    _activeLock = null;
  }
  if (_activeLock && Date.now() - _activeLock.startedAt > DEFAULT_TIMEOUT_MS) {
    logger.warn('[CompactionLock] Lock timed out, releasing');
    _activeLock = null;
  }
  return _activeLock;
}

/**
 * 尝试获取压缩锁
 * @returns 锁对象或 null (已被占用)
 */
export async function tryAcquireCompactionLock(
  turnId: TurnId | null = null,
  options: CompactionLockOptions = {},
): Promise<CompactionLock | null> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, owner = 'unknown' } = options;

  // 检查是否已有锁 —— 已被占用则直接返回 null（非阻塞，避免调用方无意义等待）
  const existingLock = getActiveCompactionLock();
  if (existingLock && !existingLock.released) {
    logger.warn(`[CompactionLock] Lock already held by ${existingLock.compactionId}, returning null`);
    return null;
  }

  // 创建新锁
  const lock: CompactionLock = {
    compactionId: generateLockId(),
    turn: turnId,
    startedAt: Date.now(),
    released: false,
  };

  _activeLock = lock;
  logger.info(`[CompactionLock] Acquired lock: ${lock.compactionId}, owner=${owner}`);

  // 启动超时释放
  setTimeout(() => {
    if (!lock.released) {
      logger.warn(`[CompactionLock] Auto-releasing lock due to timeout: ${lock.compactionId}`);
      releaseCompactionLock(lock.compactionId, 'timeout');
    }
  }, timeoutMs);

  return lock;
}

/**
 * 释放压缩锁
 */
export function releaseCompactionLock(
  compactionId: CompactionId,
  reason: 'completed' | 'failed' | 'timeout' | 'cancelled',
): void {
  if (_activeLock?.compactionId === compactionId) {
    _activeLock.released = true;
    logger.info(`[CompactionLock] Released lock: ${compactionId}, reason=${reason}`);
    _activeLock = null;
  } else {
    logger.warn(`[CompactionLock] Attempted to release non-active lock: ${compactionId}`);
  }
}

/**
 * 检查是否可以执行压缩
 */
export function canCompact(): boolean {
  return getActiveCompactionLock() === null;
}

/**
 * 获取锁状态信息
 */
export function getLockStatus(): {
  hasLock: boolean;
  lockId?: CompactionId;
  turnId?: TurnId;
  elapsedMs?: number;
  isExpired: boolean;
} {
  const lock = getActiveCompactionLock();
  if (!lock) {
    return { hasLock: false, isExpired: false };
  }

  const elapsed = Date.now() - lock.startedAt;
  const isExpired = elapsed > DEFAULT_TIMEOUT_MS;

  return {
    hasLock: true,
    lockId: lock.compactionId,
    turnId: lock.turn ?? undefined,
    elapsedMs: elapsed,
    isExpired,
  };
}

/**
 * 清除所有锁 (用于测试)
 */
export function clearAllCompactionLocks(): void {
  _activeLock = null;
  _lockCounter = 0;
  logger.info('[CompactionLock] All locks cleared');
}
