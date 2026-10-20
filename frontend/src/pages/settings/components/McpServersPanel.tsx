/**
 * McpServersPanel — MCP 服务器管理（v3.3 P2 演进项）
 *
 * 管理外部 MCP 服务器：列表、新增/编辑、测试连接、启停、工具白名单、删除。
 * 这些服务器作为 AI 员工的外部能力（Bot capabilities 中 mcp:<server>）。
 */
import { useCallback, useEffect, useState } from 'react';
import { Plus, Plug, Trash2, Power, PowerOff, RefreshCw, Server } from 'lucide-react';
import { Button, Badge, Input } from '@/components/ui';
import { mcpAdminApi } from '@/components/ai/bots/api';
import type { McpServerItem } from '@/components/ai/bots/api';

const EMPTY_FORM = {
  name: '',
  transport: 'http' as 'http' | 'sse' | 'stdio',
  url: '',
  headers: '',
  auth_token: '',
  allow_tools: '',
  visibility: 'org' as 'org' | 'private',
};

export function McpServersPanel() {
  const [servers, setServers] = useState<McpServerItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<McpServerItem | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ tools: string[] } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const items = await mcpAdminApi.list();
      setServers(items);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载 MCP 服务器失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM });
    setTestResult(null);
    setShowForm(true);
  };

  const openEdit = (s: McpServerItem) => {
    setEditing(s);
    setForm({
      name: s.name,
      transport: s.transport,
      url: s.url ?? '',
      headers: s.headers ? JSON.stringify(s.headers) : '',
      auth_token: '',
      allow_tools: (s.allow_tools || []).join(', '),
      visibility: s.visibility,
    });
    setTestResult(null);
    setShowForm(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      let headers: Record<string, string> = {};
      try {
        headers = form.headers.trim() ? JSON.parse(form.headers) : {};
      } catch {
        setError('请求头必须是合法 JSON 对象');
        setSaving(false);
        return;
      }
      const payload = {
        name: form.name,
        transport: form.transport,
        url: form.url,
        headers,
        visibility: form.visibility,
        auth_token: form.auth_token || undefined,
        allow_tools: form.allow_tools.split(',').map((s) => s.trim()).filter(Boolean),
      };
      if (editing) {
        await mcpAdminApi.update(editing.id, payload);
      } else {
        await mcpAdminApi.create(payload);
      }
      setShowForm(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!editing) return;
    setTesting(true);
    setError(null);
    try {
      const res = await mcpAdminApi.test(editing.id);
      setTestResult({ tools: res.tools });
    } catch (e) {
      setError(e instanceof Error ? e.message : '连接失败');
    } finally {
      setTesting(false);
    }
  };

  const handleToggle = async (s: McpServerItem) => {
    try {
      await mcpAdminApi.update(s.id, { enabled: !s.enabled });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '启停失败');
    }
  };

  const handleDelete = async (s: McpServerItem) => {
    if (!window.confirm(`确认删除 MCP 服务器「${s.name}」？`)) return;
    try {
      await mcpAdminApi.remove(s.id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '删除失败');
    }
  };

  return (
    <div className="space-y-[var(--space-apple-md)]">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground">MCP 服务器</h2>
          <p className="text-xs text-muted-foreground">
            配置外部 MCP 服务器（HTTP/SSE），作为 AI 员工的外部能力（Bot capabilities 中 mcp:&lt;server&gt;）。
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button size="sm" onClick={openCreate}>
            <Plus className="mr-1 h-4 w-4" /> 新增服务器
          </Button>
        </div>
      </div>

      {error && <div className="rounded-[var(--radius-Apple-sm)] bg-destructive/10 px-[var(--space-apple-sm)] py-2 text-sm text-destructive">{error}</div>}

      {/* 表单 */}
      {showForm && (
        <div className="rounded-[var(--radius-Apple-md)] border border-border p-[var(--space-apple-md)]">
          <div className="mb-[var(--space-apple-sm)] text-sm font-medium text-foreground">
            {editing ? `编辑：${editing.name}` : '新增 MCP 服务器'}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-[var(--space-apple-sm)]">
            <div className="space-y-1.5">
              <span className="text-xs font-medium text-foreground">名称 *</span>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="如 pubmed" disabled={!!editing} />
            </div>
            <div className="space-y-1.5">
              <span className="text-xs font-medium text-foreground">传输类型</span>
              <select
                value={form.transport}
                onChange={(e) => setForm({ ...form, transport: e.target.value as 'http' | 'sse' })}
                className="w-full rounded-[var(--radius-Apple-sm)] border border-border bg-background px-2 py-2 text-sm text-foreground outline-none"
              >
                <option value="http">HTTP</option>
                <option value="sse">SSE</option>
              </select>
            </div>
            <div className="col-span-2 space-y-1.5">
              <span className="text-xs font-medium text-foreground">URL *</span>
              <Input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://mcp.example.com/mcp" />
            </div>
            <div className="col-span-2 space-y-1.5">
              <span className="text-xs font-medium text-foreground">请求头（JSON，可选）</span>
              <Input value={form.headers} onChange={(e) => setForm({ ...form, headers: e.target.value })} placeholder='{"X-Custom": "value"}' />
            </div>
            <div className="space-y-1.5">
              <span className="text-xs font-medium text-foreground">认证 Token（可选）</span>
              <Input type="password" value={form.auth_token} onChange={(e) => setForm({ ...form, auth_token: e.target.value })} placeholder={editing?.auth_token_configured ? '已配置（留空不变）' : 'Bearer Token'} />
            </div>
            <div className="space-y-1.5">
              <span className="text-xs font-medium text-foreground">可见性</span>
              <select
                value={form.visibility}
                onChange={(e) => setForm({ ...form, visibility: e.target.value as 'org' | 'private' })}
                className="w-full rounded-[var(--radius-Apple-sm)] border border-border bg-background px-2 py-2 text-sm text-foreground outline-none"
              >
                <option value="org">组织共享</option>
                <option value="private">仅自己</option>
              </select>
            </div>
            <div className="col-span-2 space-y-1.5">
              <span className="text-xs font-medium text-foreground">工具白名单（逗号分隔，空=全部）</span>
              <Input value={form.allow_tools} onChange={(e) => setForm({ ...form, allow_tools: e.target.value })} placeholder="search, lookup" />
            </div>
          </div>
          <div className="mt-[var(--space-apple-sm)] flex items-center gap-2">
            <Button size="sm" onClick={() => void handleSave()} disabled={saving || !form.name.trim() || !form.url.trim()}>
              {saving ? '保存中…' : '保存'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowForm(false)} disabled={saving}>取消</Button>
            {editing && (
              <Button size="sm" variant="secondary" onClick={() => void handleTest()} disabled={testing}>
                <Plug className="mr-1 h-3.5 w-3.5" /> {testing ? '测试中…' : '测试连接'}
              </Button>
            )}
          </div>
          {testResult && (
            <div className="mt-2 rounded-[var(--radius-Apple-sm)] bg-muted/50 p-2 text-xs text-muted-foreground">
              连接成功，可用工具（{testResult.tools.length}）：{testResult.tools.join(', ') || '无'}
            </div>
          )}
        </div>
      )}

      {/* 列表 */}
      <div className="space-y-2">
        {servers.length === 0 && !loading && (
          <div className="py-10 text-center text-xs text-muted-foreground">
            尚未配置 MCP 服务器。新增后，角色模板可通过 required_mcp_servers 绑定。
          </div>
        )}
        {servers.map((s) => (
          <div key={s.id} className="flex items-center justify-between rounded-[var(--radius-Apple-md)] border border-border px-[var(--space-apple-sm)] py-2.5">
            <div className="flex min-w-0 items-center gap-2">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--radius-pill)] bg-[var(--color-secondary-container)] dark:bg-[var(--color-secondary-container)]">
                <Server className="h-3.5 w-3.5 text-[var(--color-secondary-text)]" />
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  {s.name}
                  {!s.enabled && <Badge variant="secondary" className="text-xs">已停用</Badge>}
                  <span className="text-xs text-muted-foreground">{s.transport}</span>
                </div>
                <div className="truncate text-xs text-muted-foreground">{s.url || s.command}</div>
                {s.name.startsWith('github_') && !s.enabled && (
                  <div className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                    🤖 来自 GitHub 自动识别，确认命令安全后可点击右侧 ⏻ 启用。
                  </div>
                )}
                {(s.allow_tools || []).length > 0 && (
                  <div className="mt-0.5 flex flex-wrap gap-1">
                    {(s.allow_tools || []).slice(0, 5).map((t) => (
                      <span key={t} className="rounded bg-muted px-1 py-0.5 text-xs text-muted-foreground">{t}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button
                className="rounded p-1.5 text-muted-foreground hover:bg-muted"
                onClick={() => void handleToggle(s)}
                title={s.enabled ? '停用' : '启用'}
              >
                {s.enabled ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
              </button>
              <button className="rounded p-1.5 text-muted-foreground hover:bg-muted" onClick={() => openEdit(s)}>
                <RefreshCw className="h-4 w-4" />
              </button>
              <button className="rounded p-1.5 text-muted-foreground hover:text-destructive" onClick={() => void handleDelete(s)}>
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}