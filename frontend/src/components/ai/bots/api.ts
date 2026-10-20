/**
 * 多智能体协作平台 API 客户端
 *
 * 基于全局 axios client（自动携带 Cookie / CSRF / 401 刷新 / 403 配额提示）。
 * 后端前缀：/api/v1/bots、/api/v1/bots/{id}/memories、/api/v1/bots/available-models
 */
import api from '@/api/client';
import type {
  AvailableModel,
  Bot,
  BotCreatePayload,
  BotListQuery,
  BotMemory,
  BotUpdatePayload,
  GroupCreatePayload,
  GroupMember,
  GroupMessage,
  GroupSession,
} from './types';

export interface BotListResponse {
  success: boolean;
  items: Bot[];
  total: number;
  offset: number;
  limit: number;
}

export interface BotDetailResponse {
  success: boolean;
  data: Bot;
}

export interface BotMemoryListResponse {
  success: boolean;
  items: BotMemory[];
  total: number;
}

export interface AvailableModelsResponse {
  success: boolean;
  items: AvailableModel[];
  count: number;
}

export const botApi = {
  /** Bot 列表 */
  list: async (query: BotListQuery = {}) => {
    const res = await api.get<BotListResponse>('/bots', { params: query });
    return res.data;
  },

  /** 创建 Bot */
  create: async (payload: BotCreatePayload) => {
    const res = await api.post<BotDetailResponse>('/bots', payload);
    return res.data.data;
  },

  /** Bot 详情（含记忆） */
  get: async (id: number) => {
    const res = await api.get<BotDetailResponse>(`/bots/${id}`);
    return res.data.data;
  },

  /** 更新 Bot */
  update: async (id: number, payload: BotUpdatePayload) => {
    const res = await api.put<BotDetailResponse>(`/bots/${id}`, payload);
    return res.data.data;
  },

  /** 删除（归档）Bot */
  remove: async (id: number) => {
    const res = await api.delete<{ success: boolean }>(`/bots/${id}`);
    return res.data.success;
  },

  /** 可用 LLM 模型列表 */
  listAvailableModels: async () => {
    const res = await api.get<AvailableModelsResponse>('/bots/available-models');
    return res.data.items;
  },

  /** 记忆列表 */
  listMemories: async (botId: number) => {
    const res = await api.get<BotMemoryListResponse>(`/bots/${botId}/memories`);
    return res.data.items;
  },

  /** 手动添加记忆 */
  addMemory: async (
    botId: number,
    payload: { content: string; memory_type?: string; importance?: number; source?: string },
  ) => {
    const res = await api.post<{ success: boolean; data: BotMemory }>(
      `/bots/${botId}/memories`, payload,
    );
    return res.data.data;
  },

  /** 删除记忆 */
  deleteMemory: async (botId: number, memoryId: number) => {
    const res = await api.delete<{ success: boolean }>(`/bots/${botId}/memories/${memoryId}`);
    return res.data.success;
  },

  /** Bot 对话历史（最近持续会话消息） */
  getHistory: async (botId: number) => {
    const res = await api.get<{ success: boolean; session_id: number | null; items: GroupMessage[] }>(
      `/bots/${botId}/history`,
    );
    return res.data.items;
  },
};

// ═══════════ 群聊协作（Phase 2） ═══════════

export interface GroupListResponse {
  success: boolean;
  items: GroupSession[];
  total: number;
}

export interface GroupDetailResponse {
  success: boolean;
  data: GroupSession;
}

export interface GroupPostMessageData {
  user_message: GroupMessage;
  /** @ 定向：同步返回的 Bot 回复 */
  replies?: GroupMessage[];
  /** 自主派单：立即返回的提示消息（如"⏳ Chief 正在组织团队…"） */
  pending_message?: GroupMessage;
  /** 是否异步派单（true=需要前端轮询消息流） */
  async?: boolean;
}

export interface GroupPostMessageResponse {
  success: boolean;
  data: GroupPostMessageData;
}

export interface GroupMessageListResponse {
  success: boolean;
  items: GroupMessage[];
  total: number;
}

export const groupApi = {
  /** 群聊列表 */
  list: async (params: { offset?: number; limit?: number } = {}) => {
    const res = await api.get<GroupListResponse>('/groups', { params });
    return res.data;
  },

  /** 创建群聊 */
  create: async (payload: GroupCreatePayload) => {
    const res = await api.post<GroupDetailResponse>('/groups', payload);
    return res.data.data;
  },

  /** 群聊详情 */
  get: async (groupId: number) => {
    const res = await api.get<GroupDetailResponse>(`/groups/${groupId}`);
    return res.data.data;
  },

  /** 添加成员 */
  addMembers: async (groupId: number, botIds: number[]) => {
    const res = await api.post<{ success: boolean; items: GroupMember[] }>(
      `/groups/${groupId}/members`, { bot_ids: botIds },
    );
    return res.data.items;
  },

  /** 移除成员 */
  removeMember: async (groupId: number, botId: number) => {
    const res = await api.delete<{ success: boolean }>(`/groups/${groupId}/members/${botId}`);
    return res.data.success;
  },

  /** 发言（触发 Bot 应答） */
  postMessage: async (
    groupId: number,
    payload: { content: string; mentioned_bot_ids?: number[]; reply_to?: number | null },
  ) => {
    const res = await api.post<GroupPostMessageResponse>(`/groups/${groupId}/message`, payload);
    return res.data;
  },

  /** 消息流 */
  listMessages: async (groupId: number, limit = 100) => {
    const res = await api.get<GroupMessageListResponse>(`/groups/${groupId}/messages`, {
      params: { limit },
    });
    return res.data.items;
  },

  /** 群聊列表（含归档过滤） */
  listGroups: async (params: { offset?: number; limit?: number; include_archived?: boolean } = {}) => {
    const res = await api.get<{ success: boolean; items: GroupSession[]; total: number }>('/groups', { params });
    return res.data;
  },

  /** 归档/恢复群聊 */
  archiveGroup: async (groupId: number) => {
    const res = await api.post<{ success: boolean }>(`/groups/${groupId}/archive`);
    return res.data.success;
  },
  restoreGroup: async (groupId: number) => {
    const res = await api.post<{ success: boolean }>(`/groups/${groupId}/restore`);
    return res.data.success;
  },
};

// ── 任务中心（v3.3）──

export interface TaskItem {
  id: number;
  tenant_id: number;
  group_id: number;
  created_by: number;
  task_content: string;
  status: 'recruiting' | 'dispatching' | 'completed' | 'failed' | 'archived';
  error_message?: string;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface AutoTeamResult {
  task_id: number;
  group_id: number;
  group_name: string;
  members: number[];
  roles: { role_key: string; task: string; matched_bot_id: number | null }[];
  async: boolean;
}

export const taskApi = {
  /** 创建研发任务（自动配人+建群+派单） */
  autoTeam: async (content: string, constraints?: Record<string, unknown>) => {
    const res = await api.post<{ success: boolean; data: AutoTeamResult }>('/tasks/auto-team', {
      content,
      constraints,
    });
    return res.data.data;
  },
  /** 任务列表 */
  list: async (status?: string) => {
    const res = await api.get<{ success: boolean; items: TaskItem[]; total: number }>('/tasks', {
      params: status ? { status } : {},
    });
    return res.data.items;
  },
  /** 任务详情 */
  get: async (taskId: number) => {
    const res = await api.get<{ success: boolean; data: TaskItem }>(`/tasks/${taskId}`);
    return res.data.data;
  },
  /** 归档任务 */
  archive: async (taskId: number) => {
    const res = await api.post<{ success: boolean }>(`/tasks/${taskId}/archive`);
    return res.data.success;
  },
  /** 恢复任务 */
  restore: async (taskId: number) => {
    const res = await api.post<{ success: boolean }>(`/tasks/${taskId}/restore`);
    return res.data.success;
  },
  /** 重新派单（失败任务重试） */
  retry: async (taskId: number) => {
    const res = await api.post<{ success: boolean }>(`/tasks/${taskId}/retry`);
    return res.data.success;
  },
};

// ── MCP 服务器管理（v3.3）──

export interface McpServerItem {
  id: number;
  tenant_id: number;
  name: string;
  transport: 'http' | 'sse' | 'stdio';
  url: string | null;
  command?: string | null;
  headers: Record<string, string>;
  auth_token_configured: boolean;
  enabled: boolean;
  allow_tools: string[];
  visibility: 'org' | 'private';
  created_at?: string | null;
  updated_at?: string | null;
}

export interface McpServerPayload {
  name: string;
  transport?: 'http' | 'sse' | 'stdio';
  url?: string;
  headers?: Record<string, string>;
  auth_token?: string;
  enabled?: boolean;
  allow_tools?: string[];
  visibility?: 'org' | 'private';
}

export const mcpAdminApi = {
  /** 列表 */
  list: async () => {
    const res = await api.get<{ success: boolean; items: McpServerItem[] }>('/admin/mcp-servers');
    return res.data.items;
  },
  /** 新增 */
  create: async (payload: McpServerPayload) => {
    const res = await api.post<{ success: boolean; data: McpServerItem }>('/admin/mcp-servers', payload);
    return res.data.data;
  },
  /** 更新 */
  update: async (id: number, payload: Partial<McpServerPayload>) => {
    const res = await api.put<{ success: boolean; data: McpServerItem }>(`/admin/mcp-servers/${id}`, payload);
    return res.data.data;
  },
  /** 删除 */
  remove: async (id: number) => {
    const res = await api.delete<{ success: boolean }>(`/admin/mcp-servers/${id}`);
    return res.data.success;
  },
  /** 测试连接并列出工具 */
  test: async (id: number) => {
    const res = await api.post<{ success: boolean; tool_count: number; tools: string[] }>(`/admin/mcp-servers/${id}/test`);
    return res.data;
  },
};

// ── AI 用量统计（Phase 3）──

export interface UsageStats {
  today: { prompt_tokens: number; completion_tokens: number; total_tokens: number; calls: number };
  week: { prompt_tokens: number; completion_tokens: number; total_tokens: number; calls: number };
  by_bot: { bot_id: number | null; prompt_tokens: number; completion_tokens: number; total_tokens: number; calls: number }[];
}

export const usageApi = {
  /** 用量汇总 */
  stats: async () => {
    const res = await api.get<{ success: boolean; today: UsageStats['today']; week: UsageStats['week']; by_bot: UsageStats['by_bot'] }>(
      '/usage/stats',
    );
    return res.data;
  },
};