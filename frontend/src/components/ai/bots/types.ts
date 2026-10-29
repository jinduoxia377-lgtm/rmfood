/**
 * 多智能体协作平台类型定义（DS Bot 移植 Phase 1）
 */

/** 研发任务（v3.3 任务驱动自动建群） */
export interface TaskItem {
  id: number;
  tenant_id: number;
  group_id: number;
  created_by: number;
  task_content: string;
  status: 'recruiting' | 'dispatching' | 'completed' | 'failed' | 'archived';
  error_message?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface Bot {
  id: number;
  tenant_id: number;
  created_by: number;
  name: string;
  avatar?: string | null;
  description?: string | null;
  persona_prompt?: string;
  model_config_id?: number | null;
  model_type: string;
  provider?: string | null;
  model_id?: string | null;
  temperature: number;
  max_tokens: number;
  capabilities: string[];
  is_chief: boolean;
  is_system: boolean;
  visibility: 'private' | 'org';
  status: 'active' | 'disabled' | 'archived';
  deleted_at?: string | null;
  created_at?: string;
  updated_at?: string;
  memories?: BotMemory[];
  memory_count?: number;
}

export interface BotMemory {
  id: number;
  bot_id: number;
  user_id: number;
  memory_type: 'preference' | 'fact' | 'contraindication';
  content: string;
  importance: number;
  source?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface AvailableModel {
  provider: string;
  model_id: string;
  display_name: string;
  model_type: string;
}

export interface BotChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  model?: string;
  isLoading?: boolean;
  error?: string;
}

/**
 * Bot 持续会话历史记录（后端 ChatMessage.to_dict() 结构）。
 * P1-F1 修复：后端返回 role/timestamp（非 GroupMessage 的 sender_type/created_at），
 * 此前误用 GroupMessage 类型导致历史消息全渲染为 AI 侧、时间戳回退。
 */
export interface BotHistoryMessage {
  id: number;
  session_id: number;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
}

export interface BotListQuery {
  status?: string;
  offset?: number;
  limit?: number;
}

export interface BotCreatePayload {
  name: string;
  persona_prompt: string;
  avatar?: string | null;
  description?: string | null;
  model_config_id?: number | null;
  model_type?: string;
  provider?: string | null;
  model_id?: string | null;
  temperature?: number;
  max_tokens?: number;
  capabilities?: string[];
  visibility?: 'private' | 'org';
  is_chief?: boolean;
}

export interface BotUpdatePayload {
  name?: string;
  persona_prompt?: string;
  avatar?: string | null;
  description?: string | null;
  model_config_id?: number | null;
  model_type?: string;
  provider?: string | null;
  model_id?: string | null;
  temperature?: number;
  max_tokens?: number;
  capabilities?: string[];
  visibility?: 'private' | 'org';
  status?: 'active' | 'disabled' | 'archived';
}

// ═══════════ 群聊协作（Phase 2） ═══════════

export interface GroupMember {
  id: number;
  group_id: number;
  bot_id: number;
  role: 'admin' | 'member';
  joined_at?: string;
}

export interface GroupSession {
  id: number;
  tenant_id: number;
  name: string;
  chief_bot_id: number;
  created_by: number;
  members: GroupMember[];
  archived_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface GroupMessage {
  id: number;
  group_id: number;
  sender_type: 'user' | 'bot';
  sender_user_id?: number | null;
  sender_bot_id?: number | null;
  sender_bot_name?: string | null;
  content: string;
  reply_to?: number | null;
  mentioned_bot_ids: number[];
  task_execution_id?: string | null;
  created_at?: string;
}

export interface GroupCreatePayload {
  name: string;
  chief_bot_id: number;
  member_bot_ids: number[];
}