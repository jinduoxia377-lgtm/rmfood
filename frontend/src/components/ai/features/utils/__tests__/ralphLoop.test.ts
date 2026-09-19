/**
 * Ralph Loop 单元测试
 */
import { RalphLoopEngine, parseHandoffFromText, formatHandoffForInput, runRalphLoop } from '../ralphLoop';
import type { RalphHandoff } from '../ralphLoop';

describe('RalphLoopEngine', () => {
  test('应执行单轮循环', async () => {
    const engine = new RalphLoopEngine();
    const result = await engine.execute('Test objective', { maxRounds: 1 }, async (handoff, round) => {
      return {
        status: 'completed',
        summary: 'Done',
        evidence: [],
        nextSteps: [],
        round,
      };
    });
    expect(result.success).toBe(true);
    expect(result.rounds).toBe(1);
  });

  test('应处理阻塞状态', async () => {
    const engine = new RalphLoopEngine();
    const result = await engine.execute('Test', { maxRounds: 3 }, async () => {
      return {
        status: 'blocked',
        summary: 'Blocked',
        evidence: [],
        nextSteps: [],
        blocker: 'No progress',
      };
    });
    expect(result.success).toBe(false);
    expect(result.finalHandoff.status).toBe('blocked');
  });

  test('应达到预算上限', async () => {
    const engine = new RalphLoopEngine();
    const result = await engine.execute('Test', { maxRounds: 2 }, async () => {
      return {
        status: 'in_progress',
        summary: 'Continuing',
        evidence: [],
        nextSteps: ['Next step'],
      };
    });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Budget exceeded');
  });
});

describe('parseHandoffFromText', () => {
  test('应解析 JSON 格式', () => {
    const json = JSON.stringify({
      status: 'completed',
      summary: 'Summary text',
      evidence: [{ type: 'text', text: 'Evidence' }],
      nextSteps: ['Step1', 'Step2'],
      round: 2,
    });
    const handoff = parseHandoffFromText(json);
    expect(handoff.status).toBe('completed');
    expect(handoff.summary).toBe('Summary text');
    expect(handoff.round).toBe(2);
  });
});

describe('formatHandoffForInput', () => {
  test('应格式化 handoff', () => {
    const handoff: RalphHandoff = {
      status: 'in_progress',
      summary: 'Summary',
      evidence: [],
      nextSteps: ['Step'],
      round: 1,
    };
    const formatted = formatHandoffForInput(handoff);
    const parsed = JSON.parse(formatted);
    expect(parsed.status).toBe('in_progress');
  });
});

describe('runRalphLoop', () => {
  test('应执行简化循环', async () => {
    const result = await runRalphLoop('Test objective', async () => ({
      status: 'completed',
      summary: 'Done',
      evidence: [],
      nextSteps: [],
    }), 3);
    expect(result.success).toBe(true);
  });
});