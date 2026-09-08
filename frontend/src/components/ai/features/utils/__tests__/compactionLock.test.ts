/**
 * CompactionLock 单元测试
 */
import {
  tryAcquireCompactionLock,
  releaseCompactionLock,
  getActiveCompactionLock,
  canCompact,
  clearAllCompactionLocks,
} from '../compactionLock';

describe('CompactionLock', () => {
  beforeEach(() => {
    clearAllCompactionLocks();
  });

  test('应能获取锁', async () => {
    const lock = await tryAcquireCompactionLock('turn-123');
    expect(lock).not.toBeNull();
    expect(lock!.turn).toBe('turn-123');
    expect(lock!.released).toBe(false);
  });

  test('已持有锁时无法再次获取', async () => {
    await tryAcquireCompactionLock('turn-123');
    const secondLock = await tryAcquireCompactionLock('turn-456');
    expect(secondLock).toBeNull();
  });

  test('释放锁后允许再次获取', async () => {
    const lock = await tryAcquireCompactionLock('turn-123');
    expect(lock).not.toBeNull();

    releaseCompactionLock(lock!.compactionId, 'completed');
    const secondLock = await tryAcquireCompactionLock('turn-456');
    expect(secondLock).not.toBeNull();
  });

  test('canCompact 正确反映锁状态', () => {
    expect(canCompact()).toBe(true);

    tryAcquireCompactionLock('turn-123').then((lock) => {
      if (lock) {
        expect(canCompact()).toBe(false);
        releaseCompactionLock(lock.compactionId, 'completed');
        expect(canCompact()).toBe(true);
      }
    });
  });

  test('getActiveCompactionLock 返回当前锁', async () => {
    const lock = await tryAcquireCompactionLock('turn-123');
    const active = getActiveCompactionLock();
    expect(active).toEqual(lock);
    expect(active?.compactionId).toBe(lock?.compactionId);
  });
});
