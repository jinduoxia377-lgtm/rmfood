/**
 * GroupChatPanel — 群聊协作面板（列表 + 新建 + 聊天）
 */
import { useCallback, useEffect, useState } from 'react';
import { Plus, Users, RefreshCw, ArrowLeft } from 'lucide-react';
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui';
import { groupApi } from './api';
import { GroupChatView } from './GroupChatView';
import type { Bot as BotType, GroupSession } from './types';

interface GroupChatPanelProps {
  bots: BotType[];
}

export function GroupChatPanel({ bots }: GroupChatPanelProps) {
  const [groups, setGroups] = useState<GroupSession[]>([]);
  const [selected, setSelected] = useState<GroupSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [chiefId, setChiefId] = useState<number | undefined>();
  const [memberIds, setMemberIds] = useState<number[]>([]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadGroups = useCallback(async () => {
    setLoading(true);
    try {
      const data = await groupApi.list({ limit: 200 });
      setGroups(data.items);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载群聊失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    groupApi.list({ limit: 200 })
      .then((data) => {
        if (!cancelled) setGroups(data.items);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : '加载群聊失败');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleMember = (botId: number) => {
    setMemberIds((prev) =>
      prev.includes(botId) ? prev.filter((id) => id !== botId) : [...prev, botId],
    );
  };

  const handleCreate = async () => {
    if (!name.trim() || !chiefId) {
      setError('群聊名称与 Chief 必填');
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const group = await groupApi.create({
        name: name.trim(),
        chief_bot_id: chiefId,
        member_bot_ids: memberIds.filter((id) => id !== chiefId),
      });
      setGroups((prev) => [group, ...prev]);
      setSelected(group);
      setCreateOpen(false);
      setName('');
      setMemberIds([]);
      setChiefId(undefined);
    } catch (e) {
      setError(e instanceof Error ? e.message : '创建群聊失败');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground">群聊协作</h2>
          <p className="text-xs text-muted-foreground">多 Bot 分工协作，@ 定向派单，Chief 默认统筹</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => void loadGroups()} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1 h-4 w-4" /> 新建群聊
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</div>
      )}

      {selected ? (
        <div className="flex min-h-0 flex-1 flex-col">
          {/* 返回列表（参考智能体：聊天面板上方一行） */}
          <div className="mb-2 flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setSelected(null)} data-testid="group-chat-back">
              <ArrowLeft className="mr-1 h-4 w-4" aria-hidden="true" />
              返回列表
            </Button>
          </div>
          <div className="flex min-h-0 flex-1 flex-col rounded-[var(--radius-Apple-md)] border border-border bg-card">
            <div className="min-h-0 flex-1">
              <GroupChatView group={selected} bots={bots} />
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {groups.map((g) => (
            <button
              key={g.id}
              onClick={() => setSelected(g)}
              className="rounded-[var(--radius-Apple-md)] border border-border bg-card p-4 text-left transition-colors hover:border-primary-300"
              data-testid="group-card"
            >
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-secondary-600" />
                <span className="text-sm font-semibold text-foreground">{g.name}</span>
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                成员 {g.members.length} 个 · 管理员 Bot#{g.chief_bot_id}
              </div>
            </button>
          ))}
          {groups.length === 0 && (
            <div className="col-span-full rounded-[var(--radius-Apple-md)] border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
              还没有群聊。点击「新建群聊」创建第一个多 Bot 协作空间。
            </div>
          )}
        </div>
      )}

      {/* 新建群聊对话框 */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>新建群聊</DialogTitle>
            <DialogDescription>指定管理员 Chief 与成员 Bot，创建多智能体协作空间。</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 px-6 py-2">
            <div className="space-y-1.5">
              <span className="text-sm font-medium text-foreground">群聊名称 *</span>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="如：降糖饮品研发群" maxLength={100} />
            </div>
            <div className="space-y-1.5">
              <span className="text-sm font-medium text-foreground">管理员（Chief）*</span>
              <Select value={chiefId ? String(chiefId) : undefined} onValueChange={(v) => setChiefId(Number(v))}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="选择 Chief Bot" />
                </SelectTrigger>
                <SelectContent>
                  {bots.map((b) => (
                    <SelectItem key={b.id} value={String(b.id)}>
                      {b.name}{b.is_chief ? '（Chief）' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <span className="text-sm font-medium text-foreground">成员 Bot（可多选，默认由 Chief 回复）</span>
              <div className="flex flex-wrap gap-2">
                {bots.filter((b) => b.id !== chiefId).map((b) => {
                  const active = memberIds.includes(b.id);
                  return (
                    <button
                      key={b.id}
                      onClick={() => toggleMember(b.id)}
                      className={`rounded-full border px-2 py-1 text-xs transition-colors ${
                        active
                          ? 'border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-950'
                          : 'border-border text-muted-foreground hover:border-primary-300'
                      }`}
                    >
                      {b.name}
                    </button>
                  );
                })}
                {bots.length === 0 && (
                  <span className="text-xs text-muted-foreground">请先创建 Bot</span>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>取消</Button>
            <Button onClick={() => void handleCreate()} disabled={creating || !name.trim() || !chiefId}>
              {creating ? '创建中…' : '创建群聊'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}