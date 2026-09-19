/**
 * Agent Teams 单元测试
 */
import { TaskDAG, DurableMailbox, TeamManager, TeamStateRebuilder } from '../agentTeams';
import type { TeamTaskSnapshot, TeamMessageSnapshot, TeamMemberSnapshot } from '../agentTeams';

describe('TaskDAG', () => {
  let dag: TaskDAG;

  beforeEach(() => {
    dag = new TaskDAG();
  });

  test('应添加任务', () => {
    const task: TeamTaskSnapshot = {
      id: 'task-1',
      revision: 1,
      subject: 'Test Task',
      description: 'Description',
      status: 'pending',
      blockedBy: [],
      writeScopes: [],
    };
    dag.addTask(task);
    expect(dag.count()).toBe(1);
  });

  test('应更新任务状态', () => {
    const task: TeamTaskSnapshot = {
      id: 'task-1',
      revision: 1,
      subject: 'Test',
      description: '',
      status: 'pending',
      blockedBy: [],
      writeScopes: [],
    };
    dag.addTask(task);
    dag.updateTask('task-1', { status: 'completed' });
    const updated = dag.getAllTasks()[0];
    expect(updated.status).toBe('completed');
    expect(updated.revision).toBe(2);
  });

  test('getReadyTasks 应返回无依赖的任务', () => {
    dag.addTask({ id: 't1', revision: 1, subject: 'A', description: '', status: 'pending', blockedBy: [], writeScopes: [] });
    dag.addTask({ id: 't2', revision: 1, subject: 'B', description: '', status: 'pending', blockedBy: [], writeScopes: [] });
    dag.addTask({ id: 't3', revision: 1, subject: 'C', description: '', status: 'pending', blockedBy: ['t1'], writeScopes: [] });

    const ready = dag.getReadyTasks();
    expect(ready).toHaveLength(2);
    expect(ready.map(t => t.id)).toEqual(expect.arrayContaining(['t1', 't2']));
  });

  test('应检测循环依赖', () => {
    dag.addTask({ id: 'a', revision: 1, subject: 'A', description: '', status: 'pending', blockedBy: ['b'], writeScopes: [] });
    dag.addTask({ id: 'b', revision: 1, subject: 'B', description: '', status: 'pending', blockedBy: ['a'], writeScopes: [] });
    expect(dag.hasCycle()).toBe(true);
  });

  test('拓扑排序应返回有效顺序', () => {
    dag.addTask({ id: 'a', revision: 1, subject: 'A', description: '', status: 'pending', blockedBy: [], writeScopes: [] });
    dag.addTask({ id: 'b', revision: 1, subject: 'B', description: '', status: 'pending', blockedBy: ['a'], writeScopes: [] });
    dag.addTask({ id: 'c', revision: 1, subject: 'C', description: '', status: 'pending', blockedBy: ['b'], writeScopes: [] });

    const sorted = dag.topologicalSort();
    expect(sorted).toEqual(['a', 'b', 'c']);
  });
});

describe('DurableMailbox', () => {
  let mailbox: DurableMailbox;

  beforeEach(() => {
    mailbox = new DurableMailbox();
  });

  test('应发送消息', () => {
    const msg: TeamMessageSnapshot = {
      id: 'msg-1',
      senderId: 'user-1' as any,
      senderName: 'User',
      targetId: 'agent-1' as any,
      content: [{ type: 'text', text: 'Hello' }],
    };
    mailbox.send(msg);
    expect(mailbox.totalMessages()).toBe(1);
  });

  test('应获取待处理消息', () => {
    const msg: TeamMessageSnapshot = {
      id: 'msg-1',
      senderId: 'user-1' as any,
      senderName: 'User',
      targetId: 'agent-1' as any,
      content: [{ type: 'text', text: 'Hello' }],
    };
    mailbox.send(msg);
    const pending = mailbox.getPendingMessages('agent-1' as any);
    expect(pending).toHaveLength(1);
  });

  test('应标记消息为已读', () => {
    mailbox.send({ id: 'msg-1', senderId: 'u1' as any, senderName: 'U', targetId: 'a1' as any, content: [] });
    mailbox.markAsRead('a1' as any, 'msg-1');
    expect(mailbox.totalMessages()).toBe(0);
  });
});

describe('TeamManager', () => {
  test('应创建团队', () => {
    const team = new TeamManager('team-1' as any);
    expect(team).toBeDefined();
  });

  test('应添加入成员', () => {
    const team = new TeamManager('team-1' as any);
    team.addMember({
      id: 'member-1' as any,
      name: 'Agent1',
      description: 'Test agent',
      provider: 'deepseek',
      context: 'fresh',
      phase: 'active',
    });
    const stats = team.getStats();
    expect(stats.members).toBe(1);
  });

  test('应添加任务', () => {
    const team = new TeamManager('team-1' as any);
    team.addTask({
      id: 'task-1',
      revision: 1,
      subject: 'Test',
      description: '',
      status: 'pending',
      blockedBy: [],
      writeScopes: [],
    });
    const stats = team.getStats();
    expect(stats.tasks).toBe(1);
  });
});

describe('TeamStateRebuilder', () => {
  test('应处理团队事件', () => {
    const rebuilder = new TeamStateRebuilder();
    rebuilder.processEvent({
      type: 'team/task/create',
      data: {
        task: { id: 't1', revision: 1, subject: 'Test', description: '', status: 'pending', blockedBy: [], writeScopes: [] },
      },
    });
    const state = rebuilder.buildState();
    expect(state.tasks.size).toBe(1);
  });
});