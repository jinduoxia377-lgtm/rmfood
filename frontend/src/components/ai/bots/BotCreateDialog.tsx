/**
 * BotCreateDialog — 新建具名 Bot（人设/模型/能力白名单/可见性）
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
  Input,
  Textarea,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui';
import { botApi } from './api';
import type { AvailableModel, Bot, BotCreatePayload } from './types';

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-sm font-medium text-foreground">{children}</span>
  );
}

interface BotCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (bot: Bot) => void;
}

const CAPABILITY_OPTIONS = [
  { name: 'rag_retrieve', label: '知识检索' },
  { name: 'generate_formula', label: '配方生成' },
  { name: 'compliance_check', label: '合规检查' },
  { name: 'safety_assess', label: '安全评估' },
  { name: 'generate_experiment_plan', label: '实验方案' },
  { name: 'literature_search', label: '文献检索' },
  { name: 'ingredient_info', label: '原料查询' },
  { name: 'cost_estimate', label: '成本估算' },
  { name: 'qa_answer', label: '知识问答' },
  { name: 'formula_compare', label: '配方对比' },
  { name: 'stability_predict', label: '稳定性预测' },
  { name: 'taste_predict', label: '口感预测' },
];

export function BotCreateDialog({ open, onOpenChange, onCreate }: BotCreateDialogProps) {
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState('');
  const [description, setDescription] = useState('');
  const [persona, setPersona] = useState('');
  const [modelId, setModelId] = useState('');
  const [visibility, setVisibility] = useState<'private' | 'org'>('private');
  const [capabilities, setCapabilities] = useState<string[]>(['rag_retrieve']);
  const [models, setModels] = useState<AvailableModel[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    botApi.listAvailableModels()
      .then((items) => setModels(items))
      .catch(() => setModels([]));
  }, [open]);

  const toggleCapability = (cap: string) => {
    setCapabilities((prev) =>
      prev.includes(cap) ? prev.filter((c) => c !== cap) : [...prev, cap],
    );
  };

  const reset = () => {
    setName('');
    setAvatar('');
    setDescription('');
    setPersona('');
    setModelId('');
    setVisibility('private');
    setCapabilities(['rag_retrieve']);
    setError(null);
  };

  const handleSubmit = async () => {
    if (!name.trim() || !persona.trim()) {
      setError('名称与人设不能为空');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const payload: BotCreatePayload = {
        name: name.trim(),
        persona_prompt: persona.trim(),
        avatar: avatar.trim() || undefined,
        description: description.trim() || undefined,
        model_id: modelId || undefined,
        capabilities,
        visibility,
      };
      const bot = await botApi.create(payload);
      reset();
      onOpenChange(false);
      onCreate(bot);
    } catch (e) {
      const detail = (e as { response?: { data?: { detail?: unknown } } }).response?.data?.detail;
      setError(
        typeof detail === 'string'
          ? detail
          : (e instanceof Error ? e.message : '创建失败，请重试'),
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>新建智能体</DialogTitle>
          <DialogDescription>
            创建一个具名 AI Bot，配置人设、模型与能力白名单，它将以独立身份与你协作。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 px-6 py-2">
          {error && (
            <div className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <FieldLabel>名称 *</FieldLabel>
              <Input
                id="bot-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="如：法规专家"
                maxLength={100}
              />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>头像（图片 URL）</FieldLabel>
              <Input
                id="bot-avatar"
                value={avatar}
                onChange={(e) => setAvatar(e.target.value)}
                placeholder="如：https://example.com/bot.png"
                maxLength={100}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <FieldLabel>简介</FieldLabel>
            <Input
              id="bot-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="一句话介绍这个 Bot 的职责"
              maxLength={500}
            />
          </div>

          <div className="space-y-1.5">
            <FieldLabel>人设 System Prompt *</FieldLabel>
            <Textarea
              id="bot-persona"
              value={persona}
              onChange={(e) => setPersona(e.target.value)}
              placeholder="定义这个 Bot 的角色、职责、输出规范…"
              rows={6}
              maxLength={20000}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <FieldLabel>模型</FieldLabel>
              <Select value={modelId} onValueChange={setModelId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="跟随全局模型" />
                </SelectTrigger>
                <SelectContent>
                  {models.length === 0 && (
                    <div className="px-3 py-2 text-sm text-muted-foreground">暂无可用模型配置</div>
                  )}
                  {models.map((m) => (
                    <SelectItem key={`${m.provider}:${m.model_id}`} value={m.model_id}>
                      {m.display_name}（{m.provider}）
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <FieldLabel>可见性</FieldLabel>
              <Select
                value={visibility}
                onValueChange={(v) => setVisibility(v as 'private' | 'org')}
              >
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
            <FieldLabel>能力白名单</FieldLabel>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {CAPABILITY_OPTIONS.map((cap) => {
                const checked = capabilities.includes(cap.name);
                return (
                  <button
                    key={cap.name}
                    type="button"
                    onClick={() => toggleCapability(cap.name)}
                    className={`rounded-lg border px-2 py-1.5 text-xs transition-colors ${
                      checked
                        ? 'border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-950'
                        : 'border-border text-muted-foreground hover:border-primary-300'
                    }`}
                  >
                    {cap.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={submitting} data-testid="bot-create-submit">
            {submitting ? '创建中…' : '创建 Bot'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}