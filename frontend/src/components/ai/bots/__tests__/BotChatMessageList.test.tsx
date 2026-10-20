/**
 * BotChatMessageList 单元测试 — 对话内容专业渲染版
 *
 * 覆盖：
 * - 用户消息保持纯文本（不解析 Markdown 符号）
 * - AI 消息渲染专业 Markdown（标题/加粗/表格）
 * - 空状态提示
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BotChatMessageList } from '../BotChatMessageList';
import type { Bot, BotChatMessage } from '../types';

vi.mock('@/components/ai/shared/UserAvatar', () => ({
  UserAvatar: () => <span data-testid="user-avatar" />,
}));

const bot: Bot = {
  id: 1,
  tenant_id: 1,
  created_by: 1,
  name: '配方专家',
  description: '负责配方设计',
  persona_prompt: '你是配方专家',
  model_type: 'llm',
  capabilities: ['generate_formula'],
  is_chief: false,
  is_system: false,
  visibility: 'private',
  status: 'active',
};

const userMsg: BotChatMessage = {
  id: 'u1',
  role: 'user',
  content: '帮我设计配方 **加粗不应解析**',
  timestamp: Date.now(),
};

const assistantMsg: BotChatMessage = {
  id: 'a1',
  role: 'assistant',
  content:
    '## 一、配方设计方案\n\n**茯苓** 30g\n\n| 原料 | 用量 |\n| --- | --- |\n| 茯苓 | 30g |',
  timestamp: Date.now(),
};

describe('BotChatMessageList', () => {
  it('用户消息保持纯文本（清洗 Markdown 符号，不渲染富文本）', () => {
    const { container } = render(<BotChatMessageList bot={bot} messages={[userMsg]} isStreaming={false} />);

    // cleanAgentContent 会剥离 ** 符号，以纯文本呈现
    expect(screen.getByText('帮我设计配方 加粗不应解析')).toBeInTheDocument();
    // 不应被渲染为 <strong> 加粗
    expect(container.querySelector('strong')).toBeNull();
  });

  it('AI 消息渲染专业 Markdown：标题、加粗、表格', () => {
    const { container } = render(
      <BotChatMessageList bot={bot} messages={[assistantMsg]} isStreaming={false} />,
    );

    // 标题层级
    expect(container.querySelector('h2')?.textContent).toBe('一、配方设计方案');
    // 加粗
    expect(container.querySelector('strong')?.textContent).toBe('茯苓');
    // 表格
    expect(container.querySelector('table')).not.toBeNull();
    expect(container.querySelector('th')?.textContent).toBe('原料');
  });

  it('空状态显示开始对话提示', () => {
    render(<BotChatMessageList bot={bot} messages={[]} isStreaming={false} />);

    expect(screen.getByText(/开始与 配方专家 对话/)).toBeInTheDocument();
  });
});