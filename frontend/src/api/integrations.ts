/**
 * 集成管理 API — Webhook / API密钥 / 第三方集成
 *
 * 封装 /api/v1/integrations 端点的所有操作
 */
import api from './client';

// ─── 类型定义 ─────────────────────────────────────────────

export interface APIKeySummary {
  id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  last_used_at: string | null;
  created_at: string;
  expires_at: string | null;
  is_revoked: boolean;
}

export interface APIKeyFull {
  id: string;
  name: string;
  key_prefix: string;
  key: string; // 仅创建时返回
  scopes: string[];
  last_used_at: string | null;
  created_at: string;
  expires_at: string | null;
  is_revoked: boolean;
}

export interface WebhookItem {
  id: string;
  name: string;
  url: string;
  events: string[];
  status: 'active' | 'inactive' | 'paused';
  secret: string | null;
  headers: Record<string, string> | null;
  success_count: number;
  failure_count: number;
  last_trigger_at: string | null;
  created_at: string;
}

export interface ThirdPartyPlatform {
  type: string;
  name: string;
  icon: string;
  config_fields: Array<{
    name: string;
    label: string;
    type: string;
    required: boolean;
    help: string;
  }>;
  features: string[];
}

export interface IntegrationItem {
  id: string;
  type: string;
  name: string;
  is_active: boolean;
  config: Record<string, unknown>;
  events: string[];
  created_at: string;
  last_triggered_at: string | null;
  success_count: number;
  failure_count: number;
}

export interface WebhookEventDef {
  value: string;
  category: string;
  action: string;
  description: string;
}

export interface ScopeDef {
  value: string;
  label: string;
  description: string;
}

export interface TestWebhookResult {
  success: boolean;
  status_code?: number;
  duration_ms?: number;
  response_body?: string;
  error?: string;
}

// ─── API 函数 ─────────────────────────────────────────────

/**
 * ========== Webhook CRUD ==========
 */

export async function listWebhooks(): Promise<{ webhooks: WebhookItem[] }> {
  const { data } = await api.get<{ webhooks: WebhookItem[] }>('/integrations/webhooks');
  return data;
}

export async function createWebhook(payload: {
  name: string;
  url: string;
  events: string[];
  secret?: string;
  headers?: Record<string, string>;
}): Promise<{ success: boolean; webhook: WebhookItem }> {
  const { data } = await api.post('/integrations/webhooks', payload);
  return data as unknown as { success: boolean; webhook: WebhookItem };
}

export async function updateWebhook(
  webhookId: string,
  payload: { name?: string; url?: string; status?: string },
): Promise<{ success: boolean }> {
  const { data } = await api.put(`/integrations/webhooks/${webhookId}`, payload);
  return data as { success: boolean };
}

export async function deleteWebhook(webhookId: string): Promise<{ success: boolean }> {
  const { data } = await api.delete(`/integrations/webhooks/${webhookId}`);
  return data as { success: boolean };
}

export async function getWebhookDetail(webhookId: string): Promise<{ webhook: WebhookItem }> {
  const { data } = await api.get(`/integrations/webhooks/${webhookId}`);
  return data as { webhook: WebhookItem };
}

export async function testWebhook(url: string, secret?: string): Promise<TestWebhookResult> {
  const { data } = await api.post('/integrations/webhooks/test', { url, secret });
  return data as TestWebhookResult;
}

export async function listWebhookEvents(): Promise<{ events: WebhookEventDef[] }> {
  const { data } = await api.get('/integrations/webhooks/events');
  return data as { events: WebhookEventDef[] };
}

/**
 * ========== API Key CRUD ==========
 */

export async function listAPIKeys(): Promise<{ keys: APIKeySummary[] }> {
  const { data } = await api.get('/integrations/api-keys');
  return data as { keys: APIKeySummary[] };
}

export async function createAPIKey(payload: {
  name: string;
  scopes: string[];
  expires_in_days?: number;
}): Promise<{ success: boolean; api_key: APIKeyFull; warning: string }> {
  const { data } = await api.post('/integrations/api-keys', payload);
  return data as unknown as { success: boolean; api_key: APIKeyFull; warning: string };
}

export async function revokeAPIKey(keyId: string): Promise<{ success: boolean }> {
  const { data } = await api.delete(`/integrations/api-keys/${keyId}`);
  return data as { success: boolean };
}

export async function listScopes(): Promise<{ scopes: ScopeDef[] }> {
  const { data } = await api.get('/integrations/api-keys/scopes');
  return data as { scopes: ScopeDef[] };
}

/**
 * ========== Third-party Integrations ==========
 */

export async function listPlatforms(): Promise<{ platforms: ThirdPartyPlatform[] }> {
  const { data } = await api.get('/integrations/third-party/platforms');
  return data as { platforms: ThirdPartyPlatform[] };
}

export async function listThirdPartyIntegrations(): Promise<{ integrations: IntegrationItem[] }> {
  const { data } = await api.get('/integrations/third-party');
  return data as { integrations: IntegrationItem[] };
}

export async function createThirdPartyIntegration(payload: {
  type: string;
  name: string;
  config: Record<string, unknown>;
  events?: string[];
}): Promise<{ success: boolean; integration: IntegrationItem }> {
  const { data } = await api.post('/integrations/third-party', payload);
  return data as unknown as { success: boolean; integration: IntegrationItem };
}

export async function toggleThirdPartyIntegration(
  integrationId: string,
  active: boolean,
): Promise<{ success: boolean }> {
  const { data } = await api.put(`/integrations/third-party/${integrationId}`, { is_active: active });
  return data as { success: boolean };
}

export async function deleteThirdPartyIntegration(integrationId: string): Promise<{ success: boolean }> {
  const { data } = await api.delete(`/integrations/third-party/${integrationId}`);
  return data as { success: boolean };
}

/**
 * ========== Integration Stats ==========
 */

export interface IntegrationStats {
  total_webhooks: number;
  active_webhooks: number;
  total_api_keys: number;
  active_api_keys: number;
  total_third_party: number;
  connected_third_party: number;
  total_success_events: number;
  total_failure_events: number;
}

export async function getIntegrationStats(): Promise<IntegrationStats> {
  const [wh, keys, third] = await Promise.allSettled([listWebhooks(), listAPIKeys(), listThirdPartyIntegrations()]);

  const whData = wh.status === 'fulfilled' ? wh.value.webhooks : [];
  const keyData = keys.status === 'fulfilled' ? keys.value.keys : [];
  const thirdData = third.status === 'fulfilled' ? third.value.integrations : [];

  const totalSuccess = whData.reduce((s, w) => s + (w.success_count ?? 0), 0);
  const totalFailure = whData.reduce((s, w) => s + (w.failure_count ?? 0), 0);

  return {
    total_webhooks: whData.length,
    active_webhooks: whData.filter((w: WebhookItem) => w.status === 'active').length,
    total_api_keys: keyData.length,
    active_api_keys: keyData.filter((k: APIKeySummary) => !k.is_revoked).length,
    total_third_party: thirdData.length,
    connected_third_party: thirdData.filter((t: IntegrationItem) => t.is_active).length,
    total_success_events: totalSuccess,
    total_failure_events: totalFailure,
  };
}
