/**
 * WaterfallEmitter 单元测试
 */
import { WaterfallEmitter, resetWaterfallEmitter } from '../waterfall';

describe('WaterfallEmitter', () => {
  let emitter: WaterfallEmitter;

  beforeEach(() => {
    resetWaterfallEmitter();
    emitter = new WaterfallEmitter();
  });

  test('emit 应调用所有监听器并返回数据', async () => {
    const handler1 = jest.fn((data: any, next: () => void) => {
      data.value = (data.value ?? 0) + 1;
      next();
    });
    const handler2 = jest.fn((data: any, next: () => void) => {
      data.value = (data.value ?? 0) + 10;
      next();
    });

    emitter.on('agent/pre-step', handler1);
    emitter.on('agent/request', handler2);

    const result = await emitter.emit('agent/pre-step', { input: 'test', turnId: 't1' });
    expect(handler1).toHaveBeenCalled();
    expect(result).toHaveProperty('input', 'test');
  });

  test('监听器不调用 next 时应自动继续', async () => {
    const handler1 = jest.fn((data: any, next: () => void) => {
      // 不调用 next
    });
    const handler2 = jest.fn((data: any, next: () => void) => {
      data.called = true;
      next();
    });

    emitter.on('agent/pre-step', handler1);
    emitter.on('agent/pre-step', handler2);

    await emitter.emit('agent/pre-step', { input: 'test', turnId: 't1' });
    expect(handler2).toHaveBeenCalled();
  });

  test('once 应只调用一次', async () => {
    const handler = jest.fn();
    emitter.once('agent/pre-step', handler);

    await emitter.emit('agent/pre-step', { input: 'test', turnId: 't1' });
    await emitter.emit('agent/pre-step', { input: 'test2', turnId: 't2' });

    expect(handler).toHaveBeenCalledTimes(1);
  });

  test('off 应移除监听器', async () => {
    const handler = jest.fn();
    const unsubscribe = emitter.on('agent/pre-step', handler);

    unsubscribe();
    await emitter.emit('agent/pre-step', { input: 'test', turnId: 't1' });
    expect(handler).not.toHaveBeenCalled();
  });

  test('emitSerial 应调用 Serial 监听器', async () => {
    const handler = jest.fn();
    emitter.onSerial('agent/turn-stopping', handler);

    await emitter.emitSerial('agent/turn-stopping', { turnId: 't1', reason: 'completed' });
    expect(handler).toHaveBeenCalledWith({ turnId: 't1', reason: 'completed' });
  });

  test('setEnabled(false) 应阻止事件', async () => {
    const handler = jest.fn();
    emitter.on('agent/pre-step', handler);
    emitter.setEnabled(false);

    await emitter.emit('agent/pre-step', { input: 'test', turnId: 't1' });
    expect(handler).not.toHaveBeenCalled();
  });

  test('stats 应返回正确的监听器数量', () => {
    emitter.on('agent/pre-step', () => {});
    emitter.on('agent/request', () => {});
    emitter.onSerial('agent/turn-stopping', () => {});

    const stats = emitter.stats;
    expect(stats.totalListeners).toBe(3);
    expect(stats.waterfallEvents).toBe(2);
    expect(stats.serialEvents).toBe(1);
  });

  test('clear 应清除所有监听器', () => {
    emitter.on('agent/pre-step', () => {});
    emitter.on('agent/request', () => {});
    emitter.clear();

    expect(emitter.stats.totalListeners).toBe(0);
  });
});
