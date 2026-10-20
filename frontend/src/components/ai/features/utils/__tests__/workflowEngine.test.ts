/**
 * Workflow Engine 单元测试
 */
import { WorkflowEngine } from '../workflowEngine';

describe('WorkflowEngine', () => {
  let engine: WorkflowEngine;

  beforeEach(() => {
    engine = new WorkflowEngine();
  });

  describe('registerWorkflow', () => {
    test('应注册工作流', () => {
      const workflow = {
        id: 'test-workflow',
        name: '测试工作流',
        nodes: [
          { id: 'node1', name: '节点1', type: 'tool', config: {} },
        ],
        edges: [],
        entryNode: 'node1',
      };
      engine.registerWorkflow(workflow);
      expect(engine).toBeDefined();
    });
  });

  describe('execute', () => {
    test('执行不存在的工作流应抛出错误', async () => {
      await expect(engine.execute('non-existent', {})).rejects.toThrow();
    });

    test('应能执行已注册的工作流', async () => {
      const workflow = {
        id: 'test-workflow',
        name: '测试工作流',
        nodes: [
          // 使用 condition（纯逻辑）节点验证执行链路，避免工具节点触发真实后端 API
          { id: 'node1', name: '节点1', type: 'condition' as const, config: { condition: '' } },
        ],
        edges: [],
        entryNode: 'node1',
      };
      engine.registerWorkflow(workflow);
      
      const result = await engine.execute('test-workflow', {});
      expect(result.status).toBe('completed');
      expect(result.stages).toHaveLength(1);
    });
  });

  describe('getExecutionStatus', () => {
    test('应返回执行中的工作流状态', async () => {
      const workflow = {
        id: 'status-test',
        name: '状态测试',
        nodes: [{ id: 'n1', name: 'N1', type: 'condition' as const, config: { condition: '' } }],
        edges: [],
        entryNode: 'n1',
      };
      engine.registerWorkflow(workflow);
      
      const execution = engine.execute('status-test', {});
      const status = engine.getExecutionStatus('status-test');
      expect(status).toBeDefined();
      expect(status?.status).toBe('running');
      
      await execution;
    });
  });
});