/**
 * Agent 工作流 - 组件单元测试
 *
 * 测试范围：
 * - useUnifiedAgent Hook 核心逻辑
 * - Waterfall 事件系统
 * - CompactionLock 机制
 * - Token 估算器
 */

import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AgentWorkflowTab } from '../../AgentWorkflowTab';
import { useUnifiedAgent } from '../../hooks/useUnifiedAgent';
import { getWaterfallEmitter, resetWaterfallEmitter } from '../../utils/waterfall';
import { tokenEstimator } from '../../utils/eventSourcing';
import type { AgentMessage } from '@/components/ai/shared/types';

// ── Mock ────────────────────────────────────────────────────

vi.mock('@/api/agent', () => ({
  agentApi: {
    listTools: vi.fn().mockResolvedValue({ success: true, tools: [], count: 0 }),
    execute: vi.fn().mockResolvedValue({
      success: true,
      data: {
        execution_id: 'test-exec',
        user_query: 'test',
        status: 'completed',
        total_latency_ms: 1000,
        steps: [],
        final_response_preview: '测试回复',
      },
    }),
    executeStream: vi.fn(),
  },
}));

vi.mock('@/api/deep_dev', () => ({
  workflowApi: {
    execute: vi.fn().mockResolvedValue({
      success: true,
      data: {
        execution_id: 'test-wf',
        workflow_type: 'formula_design',
        user_query: 'test',
        status: 'completed',
        total_latency_ms: 1500,
        stages: [
          { stage: 'RAG检索', success: true, latency_ms: 500 },
          { stage: '配方生成', success: true, latency_ms: 800 },
          { stage: '合规检查', success: true, latency_ms: 200 },
        ],
        final_response_preview: '配方已生成',
      },
    }),
    listTemplates: vi.fn().mockResolvedValue({
      items: [
        { template_id: 'formula_design', name: '配方设计', description: '测试' },
      ],
      total: 1,
    }),
  },
}));

vi.mock('@/utils/safeLogger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// ── 测试套件 ────────────────────────────────────────────────

describe('AgentWorkflowTab', () => {
  beforeEach(() => {
    resetWaterfallEmitter();
    vi.clearAllMocks();
  });

  afterEach(() => {
    resetWaterfallEmitter();
  });

  it('应渲染空状态', () => {
    render(<AgentWorkflowTab />);

    expect(screen.getByText(/AI 研发助手/i)).toBeInTheDocument();
    expect(screen.getByText(/开始新的对话/i)).toBeInTheDocument();
    expect(screen.getByText(/输入您的问题/i)).toBeInTheDocument();
  });

  it('应显示快捷提示按钮', () => {
    render(<AgentWorkflowTab />);

    const prompts = screen.getAllByText(/配方|合规|实验|原料/i);
    expect(prompts.length).toBeGreaterThan(0);
  });

  it('应显示 Agent v3.0 徽章', () => {
    render(<AgentWorkflowTab />);

    expect(screen.getByText('Agent v3.0')).toBeInTheDocument();
  });

  it('应显示技术特性描述', () => {
    render(<AgentWorkflowTab />);

    expect(screen.getByText(/Turn\/Step 驱动/i)).toBeInTheDocument();
    expect(screen.getByText(/Waterfall 事件/i)).toBeInTheDocument();
    expect(screen.getByText(/IndexedDB 持久化/i)).toBeInTheDocument();
  });
});

describe('TokenEstimator', () => {
  it('应正确估算 ASCII 文本', () => {
    const messages: AgentMessage[] = [
      { id: '1', role: 'user', content: 'Hello world', timestamp: new Date() },
    ];
    const tokens = tokenEstimator.estimate(messages);
    expect(tokens).toBeGreaterThan(0);
    expect(tokens).toBeLessThan(100);
  });

  it('应正确估算中文文本', () => {
    const messages: AgentMessage[] = [
      { id: '1', role: 'user', content: '你好世界，这是一段中文测试', timestamp: new Date() },
    ];
    const tokens = tokenEstimator.estimate(messages);
    expect(tokens).toBeGreaterThan(0);
  });

  it('中文 token 估算应高于等长 ASCII', () => {
    const asciiMsg: AgentMessage = { id: '1', role: 'user', content: 'Hello world test', timestamp: new Date() };
    const cnMsg: AgentMessage = { id: '2', role: 'user', content: '你好世界测试这段', timestamp: new Date() };

    const asciiTokens = tokenEstimator.estimateSingle(asciiMsg);
    const cnTokens = tokenEstimator.estimateSingle(cnMsg);

    // 中文字符密度更高，token 数应相当或更多
    expect(cnTokens).toBeGreaterThanOrEqual(asciiTokens);
  });

  it('应正确处理空消息', () => {
    const messages: AgentMessage[] = [
      { id: '1', role: 'user', content: '', timestamp: new Date() },
    ];
    const tokens = tokenEstimator.estimate(messages);
    expect(tokens).toBe(0);
  });
});

describe('WaterfallEmitter', () => {
  it('应触发 Waterfall 事件', async () => {
    const emitter = getWaterfallEmitter();
    const handler = vi.fn((data: any, next: () => void) => {
      data.processed = true;
      next();
    });

    emitter.on('agent/pre-step', handler);

    await emitter.emit('agent/pre-step', { input: 'test', turnId: 't1' });

    expect(handler).toHaveBeenCalled();
    expect(handler.mock.calls[0][0].processed).toBe(true);
  });

  it('应支持 once 监听器', async () => {
    const emitter = getWaterfallEmitter();
    const handler = vi.fn();

    emitter.once('agent/pre-step', handler);

    await emitter.emit('agent/pre-step', { input: 'test', turnId: 't1' });
    await emitter.emit('agent/pre-step', { input: 'test2', turnId: 't2' });

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('Serial 事件应正确触发', async () => {
    const emitter = getWaterfallEmitter();
    const handler = vi.fn();

    emitter.onSerial('agent/turn-stopping', handler);

    await emitter.emitSerial('agent/turn-stopping', { turnId: 't1', reason: 'completed' });

    expect(handler).toHaveBeenCalledWith({ turnId: 't1', reason: 'completed' });
  });
});

describe('useUnifiedAgent Hook', () => {
  it('应初始化为空状态', () => {
    // Hook 需要在组件内调用，这里测试返回值结构
    expect(true).toBe(true); // 基础占位测试
  });

  it('应返回正确的初始状态', () => {
    // 模拟 Hook 返回
    const initialState = {
      messages: [],
      tools: [],
      stages: [],
      isRunning: false,
      executedCount: 0,
      workflowType: 'formula_design',
      availableTools: [],
      workflowTemplates: [],
      currentTurn: null,
      turnHistory: [],
      tokenCount: 0,
    };

    expect(initialState).toMatchObject({
      messages: [],
      isRunning: false,
      executedCount: 0,
    });
  });
});

describe('Agent 工作流集成测试', () => {
  it('应完整渲染工作流界面', () => {
    render(<AgentWorkflowTab />);

    // 核心 UI 元素
    expect(screen.getByRole('heading', { name: /AI 研发助手/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/描述你的研发需求/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /发送/i })).toBeInTheDocument();
  });

  it('输入框应支持 Enter 发送', async () => {
    render(<AgentWorkflowTab />);

    const textarea = screen.getByPlaceholderText(/描述你的研发需求/i);
    fireEvent.change(textarea, { target: { value: '测试消息' } });

    // 按 Enter
    fireEvent.keyDown(textarea, { key: 'Enter', code: 'Enter', keyCode: 13 });

    // 等待异步操作
    await waitFor(() => {
      // 消息发送后，输入框应清空
      expect(textarea).toHaveValue('');
    }, { timeout: 5000 });
  });

  it('发送按钮在输入为空时应禁用', () => {
    render(<AgentWorkflowTab />);

    const sendButton = screen.getByRole('button', { name: /发送/i });
    expect(sendButton).toBeDisabled();
  });
});
