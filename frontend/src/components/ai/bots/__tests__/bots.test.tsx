/**
 * 多智能体协作平台组件单测（DS Bot 移植）
 *
 * 覆盖：
 * - botChatStream：SSE 流式解析（meta/content/[DONE]）+ 请求体带 bot_id
 * - botChat：非流式对话请求体携带 bot_id
 * - BotCard：渲染名称/Chief 徽标
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BotCard } from '../BotCard';
import { botChatStream, botChat } from '../botChatService';
import type { Bot } from '../types';

// ── mock axios 客户端（hoisted，供 vi.mock 工厂使用）──
const apiMocks = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock('@/api/client', () => ({
  default: { post: apiMocks.post },
}));

beforeEach(() => {
  apiMocks.post.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ── 流式响应 mock ──
function mockFetchStream(chunks: string[]): { reader: { read: () => Promise<{ done: boolean; value?: Uint8Array }> } } {
  let i = 0;
  const encoder = new TextEncoder();
  return {
    reader: {
      read: async () => {
        if (i < chunks.length) {
          return { done: false, value: encoder.encode(chunks[i++]) };
        }
        return { done: true };
      },
    },
  };
}

describe('botChatStream', () => {
  it('应解析 meta 与 content 事件，并在 [DONE] 后回调 onDone', async () => {
    const body = [
      'event: meta\ndata: {"model": "agnes-3.0-flash"}\n\n',
      'event: content\ndata: {"content": "你好"}\n\n',
      'event: content\ndata: {"content": "，我是Bot"}\n\n',
      'data: [DONE]\n\n',
    ];
    const reader = mockFetchStream(body).reader;
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      body: { getReader: () => reader },
    }));

    const metas: string[] = [];
    let content = '';
    let done = false;
    botChatStream(2, '你好', [], {
      onMeta: (m) => metas.push(m),
      onContent: (c) => { content += c; },
      onDone: () => { done = true; },
      onError: () => {},
    });

    await new Promise((r) => setTimeout(r, 50));
    expect(metas).toContain('agnes-3.0-flash');
    expect(content).toBe('你好，我是Bot');
    expect(done).toBe(true);
  });

  it('应构造带 bot_id 的 SSE 请求体', async () => {
    const reader = mockFetchStream(['data: [DONE]\n\n']).reader;
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      body: { getReader: () => reader },
    });
    vi.stubGlobal('fetch', fetchMock);

    botChatStream(7, '问题', [], { onContent: () => {}, onDone: () => {}, onError: () => {} });
    await new Promise((r) => setTimeout(r, 50));

    const call = fetchMock.mock.calls[0];
    const parsed = JSON.parse(call[1].body);
    expect(parsed.bot_id).toBe(7);
    expect(parsed.question).toBe('问题');
    expect(parsed.stream).toBe(true);
  });
});

describe('botChat', () => {
  it('应通过 axios 客户端发送带 bot_id 的非流式请求', async () => {
    apiMocks.post.mockResolvedValue({
      data: { content: '回复', model: 'agnes-3.0-flash', success: true },
    });
    const result = await botChat(3, '你好', [{ role: 'user', content: '你好' }]);
    expect(apiMocks.post).toHaveBeenCalledWith('/ai/chat', {
      question: '你好',
      history: [{ role: 'user', content: '你好' }],
      stream: false,
      bot_id: 3,
    });
    expect(result.content).toBe('回复');
  });
});

const sampleBot: Bot = {
  id: 1,
  tenant_id: 1,
  created_by: 1,
  name: '配方专家',
  description: '负责配方设计',
  persona_prompt: '你是配方专家',
  model_type: 'llm',
  capabilities: ['rag_retrieve'],
  is_chief: false,
  is_system: false,
  visibility: 'private',
  status: 'active',
};

describe('BotCard', () => {
  it('应渲染 Bot 名称与简介', () => {
    render(<BotCard bot={sampleBot} onOpen={() => {}} />);
    expect(screen.getAllByText('配方专家').length).toBeGreaterThan(0);
    expect(screen.getAllByText('负责配方设计').length).toBeGreaterThan(0);
  });

  it('Chief Bot 应显示 Chief 徽标', () => {
    render(<BotCard bot={{ ...sampleBot, is_chief: true, name: 'Chief' }} onOpen={() => {}} />);
    expect(screen.getAllByText('Chief').length).toBeGreaterThan(0);
  });
});