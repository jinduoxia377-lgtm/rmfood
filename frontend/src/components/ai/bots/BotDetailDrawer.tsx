/**
 * BotDetailDrawer — Bot 详情：人设/模型/能力 + 记忆管理 + 编辑（待完善项 1）
 */
import { useEffect, useState } from 'react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Badge,
  Input,
  Textarea,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui';
import { Pencil, Trash2, X } from 'lucide-react';
import { BotAvatar } from './BotAvatar';
import { botApi } from './api';
import type { Bot as BotType, BotMemory, BotUpdatePayload } from './types';

/** 仅接受图片地址作为头像（http(s)://、/ 相对路径、data:image/），历史 Emoji 表情不再进入编辑表单 */
function isImageUrlValue(value: string | null | undefined): boolean {
  const v = value?.trim() ?? '';
  return /^https?:\/\//i.test(v) || v.startsWith('/') || v.startsWith('data:image/');
}

interface BotDetailDrawerProps {
  bot: BotType | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated?: (bot: BotType) => void;
  onDeleted?: (bot: BotType) => void;
}

export function BotDetailDrawer({ bot, open, onOpenChange, onUpdated, onDeleted }: BotDetailDrawerProps) {
  const [memories, setMemories] = useState<BotMemory[]>([]);
  const [memoryContent, setMemoryContent] = useState('');
  const [memoryType, setMemoryType] = useState('preference');
  const [memoryImportance, setMemoryImportance] = useState(3);
  const [deleting, setDeleting] = useState(false);

  // 编辑状态
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState('');
  const [description, setDescription] = useState('');
  const [persona, setPersona] = useState('');
  const [modelId, setModelId] = useState('');
  const [visibility, setVisibility] = useState<'private' | 'org'>('private');
  const [capabilitiesText, setCapabilitiesText] = useState('');

  // 打开弹层且切换 Bot 时重置编辑表单（React 推荐：render 期间调整状态，避免 effect 同步 setState）
  const [prevBotId, setPrevBotId] = useState<number | null>(null);
  if (open && bot && prevBotId !== bot.id) {
    setPrevBotId(bot.id);
    setName(bot.name);
    const avatarValue = bot.avatar?.trim() ?? '';
    setAvatar(isImageUrlValue(avatarValue) ? avatarValue : '');
    setDescription(bot.description || '');
    setPersona(bot.persona_prompt || '');
    setModelId(bot.model_id || '');
    setVisibility(bot.visibility || 'private');
    setCapabilitiesText((bot.capabilities || []).join(', '));
    setEditing(false);
    setEditError(null);
    setMemories([]);
  }

  useEffect(() => {
    if (open && bot) {
      botApi.listMemories(bot.id).then(setMemories).catch(() => setMemories([]));
    }
  }, [open, bot]);

  const handleAddMemory = async () => {
    if (!bot || !memoryContent.trim()) return;
    const created = await botApi.addMemory(bot.id, {
      content: memoryContent.trim(),
      memory_type: memoryType,
      importance: memoryImportance,
      source: 'manual',
    });
    setMemories((prev) => [created, ...prev]);
    setMemoryContent('');
  };

  const handleDeleteMemory = async (memoryId: number) => {
    if (!bot) return;
    await botApi.deleteMemory(bot.id, memoryId);
    setMemories((prev) => prev.filter((m) => m.id !== memoryId));
  };

  const handleSaveEdit = async () => {
    if (!bot) return;
    if (!name.trim() || !persona.trim()) {
      setEditError('名称与人设不能为空');
      return;
    }
    setSaving(true);
    setEditError(null);
    try {
      const payload: BotUpdatePayload = {
        name: name.trim(),
        avatar: avatar.trim() || undefined,
        description: description.trim() || undefined,
        persona_prompt: persona.trim(),
        model_id: modelId || undefined,
        visibility,
        capabilities: capabilitiesText
          .split(',')
          .map((c) => c.trim())
          .filter(Boolean),
      };
      const updated = await botApi.update(bot.id, payload);
      setEditing(false);
      onUpdated?.(updated);
    } catch (e) {
      setEditError(e instanceof Error ? e.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteBot = async () => {
    if (!bot) return;
    if (!window.confirm(`确认删除 Bot「${bot.name}」？删除后将被归档。`)) return;
    setDeleting(true);
    try {
      await botApi.remove(bot.id);
      onDeleted?.(bot);
      onOpenChange(false);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        {bot && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 pr-12">
                <BotAvatar bot={bot} size="sm" />
                {bot.name}
                {bot.is_chief && <Badge>Chief</Badge>}
                {!editing && !bot.is_system && (
                  <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setEditing(true)}>
                    <Pencil className="mr-1 h-3.5 w-3.5" /> 编辑
                  </Button>
                )}
              </DialogTitle>
              <DialogDescription>{bot.description || '暂无简介'}</DialogDescription>
            </DialogHeader>

            {editing ? (
              /* ── 编辑表单 ── */
              <div className="space-y-4 px-6 py-2">
                {editError && (
                  <div className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {editError}
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <span className="text-sm font-medium text-foreground">名称 *</span>
                    <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} />
                  </div>
                  <div className="space-y-1.5">
                    <span className="text-sm font-medium text-foreground">头像（图片 URL）</span>
                    <Input value={avatar} onChange={(e) => setAvatar(e.target.value)} maxLength={100} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <span className="text-sm font-medium text-foreground">简介</span>
                  <Input value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} />
                </div>
                <div className="space-y-1.5">
                  <span className="text-sm font-medium text-foreground">人设 System Prompt *</span>
                  <Textarea value={persona} onChange={(e) => setPersona(e.target.value)} rows={6} maxLength={20000} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <span className="text-sm font-medium text-foreground">模型 ID（可选）</span>
                    <Input value={modelId} onChange={(e) => setModelId(e.target.value)} placeholder="如 agnes-3.0-flash" />
                  </div>
                  <div className="space-y-1.5">
                    <span className="text-sm font-medium text-foreground">可见性</span>
                    <Select value={visibility} onValueChange={(v) => setVisibility(v as 'private' | 'org')}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="private">仅自己</SelectItem>
                        <SelectItem value="org">组织共享</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <span className="text-sm font-medium text-foreground">能力白名单（逗号分隔）</span>
                  <Input
                    value={capabilitiesText}
                    onChange={(e) => setCapabilitiesText(e.target.value)}
                    placeholder="rag_retrieve, generate_formula, compliance_check"
                  />
                </div>
                <DialogFooter className="flex justify-end gap-2">
                  <Button variant="ghost" onClick={() => setEditing(false)} disabled={saving}>
                    <X className="mr-1 h-4 w-4" /> 取消
                  </Button>
                  <Button onClick={() => void handleSaveEdit()} disabled={saving}>
                    {saving ? '保存中…' : '保存修改'}
                  </Button>
                </DialogFooter>
              </div>
            ) : (
              /* ── 详情视图 ── */
              <div className="space-y-4 px-6 py-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div className="rounded-lg bg-muted/50 p-3">
                    <div className="text-xs text-muted-foreground">模型</div>
                    <div className="mt-0.5 font-medium">{bot.model_id || '跟随全局模型'}</div>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-3">
                    <div className="text-xs text-muted-foreground">可见性</div>
                    <div className="mt-0.5 font-medium">
                      {bot.visibility === 'org' ? '组织共享' : '仅自己'}
                    </div>
                  </div>
                  <div className="col-span-2 rounded-lg bg-muted/50 p-3">
                    <div className="text-xs text-muted-foreground">能力白名单</div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {(bot.capabilities || []).map((cap) => (
                        <span key={cap} className="rounded bg-background px-1.5 py-0.5 text-xs text-foreground">
                          {cap}
                        </span>
                      ))}
                      {(!bot.capabilities || bot.capabilities.length === 0) && (
                        <span className="text-xs text-muted-foreground">未配置（随全局）</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-border p-3">
                  <div className="text-sm font-medium">人设 Prompt</div>
                  <p className="mt-1 whitespace-pre-wrap rounded bg-muted/40 p-2 text-xs leading-relaxed text-muted-foreground">
                    {bot.persona_prompt}
                  </p>
                </div>

                <div className="rounded-lg border border-border p-3">
                  <div className="mb-2 text-sm font-medium">跨会话记忆（{memories.length}）</div>
                  <div className="space-y-2">
                    {memories.map((m) => (
                      <div key={m.id} className="flex items-start justify-between gap-2 rounded bg-muted/40 p-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="text-xs">{m.memory_type}</Badge>
                            <span className="text-xs text-muted-foreground">重要度 {m.importance}</span>
                          </div>
                          <p className="mt-1 text-xs text-foreground">{m.content}</p>
                        </div>
                        <button
                          className="shrink-0 text-muted-foreground hover:text-destructive"
                          onClick={() => handleDeleteMemory(m.id)}
                          title="删除记忆"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                    {memories.length === 0 && <div className="text-xs text-muted-foreground">暂无记忆</div>}
                  </div>

                  <div className="mt-3 flex flex-col gap-2">
                    <Textarea
                      value={memoryContent}
                      onChange={(e) => setMemoryContent(e.target.value)}
                      placeholder="添加一条记忆，如：用户对花生过敏"
                      rows={2}
                    />
                    <div className="flex items-center gap-2">
                      <Select value={memoryType} onValueChange={setMemoryType}>
                        <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="preference">偏好</SelectItem>
                          <SelectItem value="fact">事实</SelectItem>
                          <SelectItem value="contraindication">禁忌</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select value={String(memoryImportance)} onValueChange={(v) => setMemoryImportance(Number(v))}>
                        <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {[1, 2, 3, 4, 5].map((n) => (
                            <SelectItem key={n} value={String(n)}>重要 {n}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button size="sm" onClick={handleAddMemory} disabled={!memoryContent.trim()}>
                        添加记忆
                      </Button>
                    </div>
                  </div>
                </div>

                <DialogFooter className="flex items-center justify-between">
                  <div>
                    {!bot.is_system && (
                      <Button variant="destructive" onClick={handleDeleteBot} disabled={deleting}>
                        {deleting ? '删除中…' : '删除 Bot'}
                      </Button>
                    )}
                  </div>
                  <Button variant="ghost" onClick={() => onOpenChange(false)}>关闭</Button>
                </DialogFooter>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}