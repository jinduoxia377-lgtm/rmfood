/**
 * BotCreateDialog — 新建具名 Bot（人设/模型/能力白名单/可见性）
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
import { botApi, mcpAdminApi } from './api';
import type { AvailableModel, Bot, BotCreatePayload } from './types';
import type { McpServerItem } from './api';
import { useAuthStore } from '@/stores/auth';

function FieldLabel({ htmlFor, children }: { htmlFor?: string; children: React.ReactNode }) {
  // 关联到表单控件时用 <label htmlFor>；纯分组标题（如能力多选）保持 <span>
  if (htmlFor) {
    return <label htmlFor={htmlFor} className="text-sm font-medium text-foreground">{children}</label>;
  }
  return <span className="text-sm font-medium text-foreground">{children}</span>;
}

interface BotCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (bot: Bot) => void;
}

const CAPABILITY_OPTIONS = [
  { name: 'rag_retrieve', labelKey: 'botCapabilityRagRetrieve' },
  { name: 'generate_formula', labelKey: 'botCapabilityGenerateFormula' },
  { name: 'compliance_check', labelKey: 'botCapabilityComplianceCheck' },
  { name: 'safety_assess', labelKey: 'botCapabilitySafetyAssess' },
  { name: 'generate_experiment_plan', labelKey: 'botCapabilityGenerateExperimentPlan' },
  { name: 'literature_search', labelKey: 'botCapabilityLiteratureSearch' },
  { name: 'ingredient_info', labelKey: 'botCapabilityIngredientInfo' },
  { name: 'cost_estimate', labelKey: 'botCapabilityCostEstimate' },
  { name: 'qa_answer', labelKey: 'botCapabilityQaAnswer' },
  { name: 'formula_compare', labelKey: 'botCapabilityFormulaCompare' },
  { name: 'stability_predict', labelKey: 'botCapabilityStabilityPredict' },
  { name: 'taste_predict', labelKey: 'botCapabilityTastePredict' },
];

export function BotCreateDialog({ open, onOpenChange, onCreate }: BotCreateDialogProps) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState('');
  const [description, setDescription] = useState('');
  const [persona, setPersona] = useState('');
  const [modelId, setModelId] = useState('');
  const [visibility, setVisibility] = useState<'private' | 'org'>('private');
  const [capabilities, setCapabilities] = useState<string[]>(['rag_retrieve']);
  const [models, setModels] = useState<AvailableModel[]>([]);
  // P0-C：MCP 服务器能力（mcp:<name>）。仅 enabled 服务器；非 admin 或加载失败时为空 → 隐藏该区块，不阻塞创建。
  const [mcpServers, setMcpServers] = useState<McpServerItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    botApi.listAvailableModels()
      .then((items) => setModels(items))
      .catch(() => setModels([]));
    // MCP 列表为 admin 接口：仅 admin 请求（非 admin 必然 403，提前守卫避免无效请求）；
    // 非 admin 或加载失败时静默降级为空列表，仅隐藏 MCP 区块，不阻塞 Bot 创建。
    const role = useAuthStore.getState().user?.role;
    const isAdmin = String(role).toUpperCase() === 'ADMIN';
    if (isAdmin) {
      mcpAdminApi.list()
        .then((items) => setMcpServers(items.filter((s) => s.enabled)))
        .catch(() => setMcpServers([]));
    }
    // 非 admin：mcpServers 保持初始空数组 → MCP 区块隐藏，无需同步 setState（避免 effect 内级联渲染）。
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
      setError(t('pages.agent.botCreateNamePersonaRequired'));
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
          : (e instanceof Error ? e.message : t('pages.agent.botCreateFailed')),
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('pages.agent.botCreateTitle')}</DialogTitle>
          <DialogDescription>
            {t('pages.agent.botCreateDesc')}
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
              <FieldLabel htmlFor="bot-name">{t('pages.agent.botCreateName')}</FieldLabel>
              <Input
                id="bot-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('pages.agent.botCreateNamePlaceholder')}
                maxLength={100}
              />
            </div>
            <div className="space-y-1.5">
              <FieldLabel htmlFor="bot-avatar">{t('pages.agent.botCreateAvatar')}</FieldLabel>
              <Input
                id="bot-avatar"
                value={avatar}
                onChange={(e) => setAvatar(e.target.value)}
                placeholder={t('pages.agent.botCreateAvatarPlaceholder')}
                maxLength={100}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <FieldLabel htmlFor="bot-desc">{t('pages.agent.botCreateDescLabel')}</FieldLabel>
            <Input
              id="bot-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('pages.agent.botCreateDescPlaceholder')}
              maxLength={500}
            />
          </div>

          <div className="space-y-1.5">
            <FieldLabel htmlFor="bot-persona">{t('pages.agent.botCreatePersona')}</FieldLabel>
            <Textarea
              id="bot-persona"
              value={persona}
              onChange={(e) => setPersona(e.target.value)}
              placeholder={t('pages.agent.botCreatePersonaPlaceholder')}
              rows={6}
              maxLength={20000}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <FieldLabel htmlFor="bot-model">{t('pages.agent.botCreateModel')}</FieldLabel>
              {/* P3-32：不同 provider 可能共享同一 model_id，SelectItem 的 value 需唯一 →
                  用 `provider:model_id` 复合值；受控状态仍存原始 model_id，onValueChange 解析回原始值。 */}
              <Select
                value={
                  modelId
                    ? (() => {
                        const m = models.find((x) => x.model_id === modelId);
                        return m ? `${m.provider}:${m.model_id}` : modelId;
                      })()
                    : undefined
                }
                onValueChange={(v) => {
                  const m = models.find((x) => `${x.provider}:${x.model_id}` === v);
                  setModelId(m ? m.model_id : v);
                }}
              >
                <SelectTrigger id="bot-model" className="w-full">
                  <SelectValue placeholder={t('pages.agent.botCreateModelPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {models.length === 0 && (
                    <div className="px-3 py-2 text-sm text-muted-foreground">{t('pages.agent.botCreateModelEmpty')}</div>
                  )}
                  {models.map((m) => (
                    <SelectItem key={`${m.provider}:${m.model_id}`} value={`${m.provider}:${m.model_id}`}>
                      {m.display_name}（{m.provider}）
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <FieldLabel htmlFor="bot-visibility">{t('pages.agent.botCreateVisibility')}</FieldLabel>
              <Select
                value={visibility}
                onValueChange={(v) => setVisibility(v as 'private' | 'org')}
              >
                <SelectTrigger id="bot-visibility" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="private">{t('pages.agent.botCreateVisibilityPrivate')}</SelectItem>
                  <SelectItem value="org">{t('pages.agent.botCreateVisibilityOrg')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <FieldLabel>{t('pages.agent.botCreateCapabilities')}</FieldLabel>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2" role="group" aria-label={t('pages.agent.botCreateCapabilities')}>
              {CAPABILITY_OPTIONS.map((cap) => {
                const checked = capabilities.includes(cap.name);
                return (
                  <button
                    key={cap.name}
                    type="button"
                    onClick={() => toggleCapability(cap.name)}
                    aria-pressed={checked}
                    className={`rounded-lg border px-2 py-1.5 text-xs transition-colors ${
                      checked
                        ? 'border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-950'
                        : 'border-border text-muted-foreground hover:border-primary-300'
                    }`}
                  >
                    {t(`pages.agent.${cap.labelKey}`)}
                  </button>
                );
              })}
            </div>
          </div>

          {/* P0-C：MCP 服务器能力（mcp:<name>）。仅在有 enabled 服务器时显示；非 admin/加载失败时 mcpServers 为空 → 隐藏。 */}
          {mcpServers.length > 0 && (
            <div className="space-y-1.5">
              <FieldLabel>{t('pages.agent.botCreateMcpCapabilities')}</FieldLabel>
              <div className="text-xs text-muted-foreground">{t('pages.agent.botCreateMcpHint')}</div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2" role="group" aria-label={t('pages.agent.botCreateMcpCapabilities')}>
                {mcpServers.map((s) => {
                  const cap = `mcp:${s.name}`;
                  const checked = capabilities.includes(cap);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => toggleCapability(cap)}
                      aria-pressed={checked}
                      title={`mcp:${s.name}`}
                      className={`rounded-lg border px-2 py-1.5 text-xs transition-colors ${
                        checked
                          ? 'border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-950'
                          : 'border-border text-muted-foreground hover:border-primary-300'
                      }`}
                    >
                      {s.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t('pages.agent.botCreateCancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={submitting} data-testid="bot-create-submit">
            {submitting ? t('pages.agent.botCreateSubmitting') : t('pages.agent.botCreateSubmit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}