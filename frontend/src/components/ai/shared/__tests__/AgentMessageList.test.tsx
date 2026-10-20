/**
 * AgentMessageList 单元测试 — 对话内容专业渲染版
 *
 * 覆盖：
 * - AI 消息渲染专业 Markdown（标题/有序列表/加粗）
 * - 用户消息保持纯文本
 * - 空状态提示
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AgentMessageList } from '../AgentMessageList';
import type { AgentMessage } from '../types';

vi.mock('../UserAvatar', () => ({
  UserAvatar: () => <span data-testid="user-avatar" />,
}));

vi.mock('../RealAIAvatar', () => ({
  RealAIAvatar: () => <span data-testid="real-ai-avatar" />,
}));

const assistantMsg: AgentMessage = {
  id: 'a1',
  role: 'assistant',
  content: '### 建议配方\n\n1. **茯苓** 30g\n2. 山药 20g',
  timestamp: new Date(),
};

const userMsg: AgentMessage = {
  id: 'u1',
  role: 'user',
  content: '请设计 **不要解析**',
  timestamp: new Date(),
};

describe('AgentMessageList', () => {
  it('AI 消息渲染 Markdown 标题与有序列表', () => {
    const { container } = render(<AgentMessageList messages={[assistantMsg]} />);

    expect(container.querySelector('h3')?.textContent).toBe('建议配方');
    // MarkdownRenderer 的有序列表项使用 .chat-md-ol-item 容器（非语义 <ol>）
    expect(container.querySelector('.chat-md-ol-item')).not.toBeNull();
    expect(container.querySelector('strong')?.textContent).toBe('茯苓');
  });

  it('用户消息保持纯文本（清洗 Markdown 符号，不渲染富文本）', () => {
    const { container } = render(<AgentMessageList messages={[userMsg]} />);

    // cleanAgentContent 会剥离 ** 符号，以纯文本呈现
    expect(screen.getByText('请设计 不要解析')).toBeInTheDocument();
    expect(container.querySelector('strong')).toBeNull();
  });

  it('空状态显示开始对话提示', () => {
    render(<AgentMessageList messages={[]} />);

    expect(screen.getByText('开始新的对话')).toBeInTheDocument();
  });
});