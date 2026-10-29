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
              <FieldLabel>{t('pages.agent.botCreateName')}</FieldLabel>
              <Input
                id="bot-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('pages.agent.botCreateNamePlaceholder')}
                maxLength={100}
              />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>{t('pages.agent.botCreateAvatar')}</FieldLabel>
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
            <FieldLabel>{t('pages.agent.botCreateDescLabel')}</FieldLabel>
            <Input
              id="bot-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('pages.agent.botCreateDescPlaceholder')}
              maxLength={500}
            />
          </div>

          <div className="space-y-1.5">
            <FieldLabel>{t('pages.agent.botCreatePersona')}</FieldLabel>
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
              <FieldLabel>{t('pages.agent.botCreateModel')}</FieldLabel>
              <Select value={modelId} onValueChange={setModelId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t('pages.agent.botCreateModelPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {models.length === 0 && (
                    <div className="px-3 py-2 text-sm text-muted-foreground">{t('pages.agent.botCreateModelEmpty')}</div>
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
              <FieldLabel>{t('pages.agent.botCreateVisibility')}</FieldLabel>
              <Select
                value={visibility}
                onValueChange={(v) => setVisibility(v as 'private' | 'org')}
              >
                <SelectTrigger className="w-full">
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
                    {t(`pages.agent.${cap.labelKey}`)}
                  </button>
                );
              })}
            </div>
          </div>
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