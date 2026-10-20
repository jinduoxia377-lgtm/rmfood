/**
 * 群聊组件单测（DS Bot 移植 Phase 2）
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GroupChatView } from '../GroupChatView';
import type { Bot, GroupMessage, GroupSession } from '../types';

const listMessagesMock = vi.hoisted(() => vi.fn());
const postMessageMock = vi.hoisted(() => vi.fn());

vi.mock('../api', () => ({
  groupApi: {
    listMessages: listMessagesMock,
    postMessage: postMessageMock,
  },
}));

const memberBot: Bot = {
  id: 2,
  tenant_id: 1,
  created_by: 1,
  name: '安全专家',
  description: '',
  persona_prompt: '',
  model_type: 'llm',
  capabilities: [],
  is_chief: false,
  is_system: false,
  visibility: 'org',
  status: 'active',
};

const chiefBot: Bot = {
  id: 1,
  tenant_id: 1,
  created_by: 1,
  name: 'Chief',
  description: '',
  persona_prompt: '',
  model_type: 'llm',
  capabilities: [],
  is_chief: true,
  is_system: true,
  visibility: 'org',
  status: 'active',
};

const group: GroupSession = {
  id: 10,
  tenant_id: 1,
  name: '测试群',
  chief_bot_id: 1,
  created_by: 1,
  members: [
    { id: 1, group_id: 10, bot_id: 1, role: 'admin' },
    { id: 2, group_id: 10, bot_id: 2, role: 'member' },
  ],
};

const userMsg: GroupMessage = {
  id: 1,
  group_id: 10,
  sender_type: 'user',
  sender_user_id: 1,
  content: '请审查配方安全性',
  mentioned_bot_ids: [],
  created_at: '2026-10-13T00:00:00Z',
};

const botReply: GroupMessage = {
  id: 2,
  group_id: 10,
  sender_type: 'bot',
  sender_bot_id: 2,
  content: '安全审查完成',
  mentioned_bot_ids: [],
  task_execution_id: 'exec-1',
  created_at: '2026-10-13T00:00:01Z',
};

beforeEach(() => {
  listMessagesMock.mockReset();
  postMessageMock.mockReset();
});

describe('GroupChatView', () => {
  it('应渲染群聊名称与消息流', async () => {
    listMessagesMock.mockResolvedValue([userMsg, botReply]);

    render(<GroupChatView group={group} bots={[chiefBot, memberBot]} />);

    expect(screen.getByText('测试群')).toBeTruthy();
    // 等待异步消息加载
    expect(await screen.findByText('请审查配方安全性')).toBeTruthy();
    expect(await screen.findByText('安全审查完成')).toBeTruthy();
    expect(screen.getAllByText('安全专家').length).toBeGreaterThan(0);
  });

  it('发送消息应调用 postMessage 并追加回复', async () => {
    listMessagesMock.mockResolvedValue([]);
    postMessageMock.mockResolvedValue({
      data: {
        user_message: userMsg,
        replies: [botReply],
      },
    });

    render(<GroupChatView group={group} bots={[chiefBot, memberBot]} />);
    await screen.findByText('测试群');

    const textarea = screen.getByTestId('group-input');
    fireEvent.change(textarea, { target: { value: '请审查配方安全性' } });
    fireEvent.keyDown(textarea, { key: 'Enter' });

    expect(await screen.findByText('请审查配方安全性')).toBeTruthy();
    expect(await screen.findByText('安全审查完成')).toBeTruthy();
    expect(postMessageMock).toHaveBeenCalled();
  });

  it('异步自主派单：追加 pending 消息并轮询增量直到【汇总】', async () => {
    const pendingMsg: GroupMessage = {
      id: 100,
      group_id: 10,
      sender_type: 'bot',
      sender_bot_id: 1,
      content: '⏳ Chief 正在组织团队…',
      mentioned_bot_ids: [],
      created_at: '2026-10-13T00:00:02Z',
    };
    const planMsg: GroupMessage = {
      id: 101,
      group_id: 10,
      sender_type: 'bot',
      sender_bot_id: 1,
      content: '【派单计划】①配方设计 ②安全审查',
      mentioned_bot_ids: [],
      created_at: '2026-10-13T00:00:03Z',
    };
    const resultMsg: GroupMessage = {
      id: 102,
      group_id: 10,
      sender_type: 'bot',
      sender_bot_id: 2,
      content: '配方专家输出结果',
      mentioned_bot_ids: [],
      task_execution_id: 'exec-1',
      created_at: '2026-10-13T00:00:04Z',
    };
    const summaryMsg: GroupMessage = {
      id: 103,
      group_id: 10,
      sender_type: 'bot',
      sender_bot_id: 1,
      content: '【汇总】自主派单完成',
      mentioned_bot_ids: [],
      created_at: '2026-10-13T00:00:05Z',
    };

    // 初始加载为空
    listMessagesMock.mockResolvedValueOnce([]);
    // 发送后返回异步结构（user + pending，无 replies）
    postMessageMock.mockResolvedValue({
      data: {
        user_message: userMsg,
        pending_message: pendingMsg,
        async: true,
      },
    });
    // 轮询第一次：返回完整消息序列（增量合并）
    listMessagesMock.mockResolvedValue([userMsg, pendingMsg, planMsg, resultMsg, summaryMsg]);

    render(<GroupChatView group={group} bots={[chiefBot, memberBot]} />);
    await screen.findByText('测试群');

    const textarea = screen.getByTestId('group-input');
    fireEvent.change(textarea, { target: { value: '请审查配方安全性' } });
    fireEvent.keyDown(textarea, { key: 'Enter' });

    expect(await screen.findByText('请审查配方安全性')).toBeTruthy();
    expect(await screen.findByText('⏳ Chief 正在组织团队…')).toBeTruthy();
    // pollOnce 立即执行，增量追加派单过程消息并检测【汇总】停止
    expect(await screen.findByText('配方专家输出结果')).toBeTruthy();
    expect(await screen.findByText('【汇总】自主派单完成')).toBeTruthy();
    expect(postMessageMock).toHaveBeenCalled();
  });
});