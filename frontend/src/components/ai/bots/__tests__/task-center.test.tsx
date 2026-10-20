/**
 * TaskCenter 组件单测（v3.3 任务驱动自动建群）
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TaskCenter } from '../TaskCenter';
import type { Bot, TaskItem } from '../types';

const taskListMock = vi.hoisted(() => vi.fn());
const taskAutoTeamMock = vi.hoisted(() => vi.fn());
const taskGetMock = vi.hoisted(() => vi.fn());
const taskArchiveMock = vi.hoisted(() => vi.fn());
const taskRestoreMock = vi.hoisted(() => vi.fn());
const groupGetMock = vi.hoisted(() => vi.fn());

vi.mock('../api', () => ({
  taskApi: {
    list: taskListMock,
    autoTeam: taskAutoTeamMock,
    get: taskGetMock,
    archive: taskArchiveMock,
    restore: taskRestoreMock,
  },
  groupApi: {
    get: groupGetMock,
  },
}));

const chiefBot: Bot = {
  id: 1,
  tenant_id: 1,
  created_by: 1,
  name: 'Chief',
  description: '',
  persona_prompt: '',
  model_type: 'llm',
  capabilities: ['delegate'],
  is_chief: true,
  is_system: true,
  visibility: 'org',
  status: 'active',
};

const taskItem: TaskItem = {
  id: 1,
  tenant_id: 1,
  group_id: 10,
  created_by: 1,
  task_content: '设计降糖饮品并做安全审查',
  status: 'recruiting',
  created_at: '2026-10-14T00:00:00Z',
};

beforeEach(() => {
  taskListMock.mockReset();
  taskAutoTeamMock.mockReset();
  taskGetMock.mockReset();
  groupGetMock.mockReset();
});

describe('TaskCenter', () => {
  it('应渲染空状态与创建按钮', async () => {
    taskListMock.mockResolvedValue([]);
    render(<TaskCenter bots={[chiefBot]} />);
    expect(screen.getByText('研发任务中心')).toBeTruthy();
    expect(screen.getByTestId('task-create-button')).toBeTruthy();
    expect(await screen.findByText(/暂无任务/)).toBeTruthy();
  });

  it('应显示任务列表并可打开创建对话框', async () => {
    taskListMock.mockResolvedValue([taskItem]);
    render(<TaskCenter bots={[chiefBot]} />);

    expect(await screen.findByText(/设计降糖饮品/)).toBeTruthy();
    fireEvent.click(screen.getByTestId('task-create-button'));
    expect(screen.getByTestId('task-input')).toBeTruthy();
  });

  it('选择任务后应加载对应任务群并显示归档按钮', async () => {
    taskListMock.mockResolvedValue([taskItem]);
    groupGetMock.mockResolvedValue({
      id: 10,
      tenant_id: 1,
      name: '任务·设计降糖饮品',
      chief_bot_id: 1,
      created_by: 1,
      members: [{ bot_id: 1, role: 'admin' }],
      archived_at: null,
    });

    render(<TaskCenter bots={[chiefBot]} />);
    fireEvent.click(await screen.findByTestId(`task-card-${taskItem.id}`));

    expect(await screen.findByText(/归档/)).toBeTruthy();
  });
});