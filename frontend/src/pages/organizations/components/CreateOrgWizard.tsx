import { useState, useCallback } from 'react';
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { Modal } from '@/components/ui';
import type { CreateOrganizationRequest } from '@/hooks/useOrganizations';

interface CreateOrgWizardProps {
  open: boolean;
  onClose: () => void;
  onCreate: (data: CreateOrganizationRequest) => Promise<void>;
}

type WizardStep = 'basic' | 'details' | 'members' | 'confirm' | 'success';

export function CreateOrgWizard({ open, onClose, onCreate }: CreateOrgWizardProps) {
  const [step, setStep] = useState<WizardStep>('basic');
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [plan, setPlan] = useState<'free' | 'pro' | 'enterprise'>('free');
  const [autoSlug, setAutoSlug] = useState(true);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleNameChange = useCallback((value: string) => {
    setName(value);
    if (autoSlug) {
      const generated = value
        .toLowerCase()
        .trim()
        .replace(/[\s_]+/g, '-')
        .replace(/[^\w\u4e00-\u9fff-]/g, '')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
      setSlug(generated);
    }
  }, [autoSlug]);

  const handleCreate = useCallback(async () => {
    if (!name.trim()) {
      setError('组织名称不能为空');
      return;
    }
    if (!slug.trim()) {
      setError('标识符不能为空');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await onCreate({ name: name.trim(), slug: slug.trim(), description: description.trim() || undefined, plan });
      setStep('success');
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || '创建失败，请重试');
    } finally {
      setLoading(false);
    }
  }, [name, slug, description, plan, onCreate]);

  const handleClose = useCallback(() => {
    setStep('basic');
    setName('');
    setSlug('');
    setDescription('');
    setPlan('free');
    setAutoSlug(true);
    setLogoUrl(null);
    setInviteEmail('');
    setError(null);
    onClose();
  }, [onClose]);

  return (
    <Modal open={open} onClose={handleClose} title="创建新组织" size="md">
      <div className="space-y-6">
        {/* 步骤指示器（紧凑型） */}
        <div className="flex items-center gap-1.5">
          {(['basic', 'details', 'members', 'confirm'] as const).map((s, i) => (
            <div key={s} className="flex items-center gap-1.5">
              <div className={`w-6 h-6 rounded-[var(--radius-pill)] flex items-center justify-center text-xs font-medium ${
                step === s ? 'bg-[var(--color-primary)] text-white' :
                ['basic', 'details', 'members', 'confirm'].indexOf(step) > i ? 'bg-[var(--color-success-container)]0 text-white' :
                'bg-[var(--border-color)] text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]'
              }`}>
                {['basic', 'details', 'members', 'confirm'].indexOf(step) > i ? <CheckCircle className="w-3.5 h-3.5" /> : i + 1}
              </div>
              <span className={`text-xs ${step === s ? 'text-[var(--color-primary-text)] font-medium' : 'text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]'}`}>
                {i === 0 ? '基本信息' : i === 1 ? '详细设置' : i === 2 ? '邀请成员' : '确认创建'}
              </span>
              {i < 3 && <div className="w-5 h-px bg-[var(--border-color)]" />}
            </div>
          ))}
        </div>

        {step === 'basic' && (
          <div className="space-y-[var(--space-apple-md)]">
            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">
                组织名称 <span className="text-[var(--color-error-text)]0">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="例如：RMFOOD 研发中心"
                className="w-full px-[var(--space-apple-sm)] py-2 rounded-[var(--radius-Apple-sm)] border border-[var(--border-color)] surface-card text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-secondary)]"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-medium text-[var(--text-primary)]">
                  标识符 <span className="text-[var(--color-error-text)]0">*</span>
                </label>
                <label className="flex items-center gap-1 text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoSlug}
                    onChange={(e) => setAutoSlug(e.target.checked)}
                    className="rounded border-[var(--border-color)] dark:border-neutral-700"
                  />
                  自动生成
                </label>
              </div>
              <input
                type="text"
                value={slug}
                onChange={(e) => { setSlug(e.target.value); setAutoSlug(false); }}
                disabled={autoSlug}
                placeholder="rmfood-r&D-center"
                className="w-full px-[var(--space-apple-sm)] py-2 rounded-[var(--radius-Apple-sm)] border border-[var(--border-color)] surface-card text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-secondary)] disabled:opacity-50"
              />
              <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mt-1">仅支持小写字母、数字和连字符</p>
            </div>
          </div>
        )}

        {step === 'details' && (
          <div className="space-y-[var(--space-apple-md)]">
            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">组织头像（可选）</label>
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-gradient-to-br from-[var(--color-secondary-surface)] to-[var(--color-accent-surface-deep)] rounded-[var(--radius-Apple-md)] flex items-center justify-center text-white font-bold text-2xl shadow-lg">
                  {logoUrl ? (
                    <img src={logoUrl} alt="Logo" className="w-full h-full object-cover rounded-[var(--radius-Apple-md)]" />
                  ) : name.charAt(0).toUpperCase()}
                </div>
                <label className="flex-1 cursor-pointer">
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) {
                      const reader = new FileReader()
                      reader.onloadend = () => setLogoUrl(reader.result as string)
                      reader.readAsDataURL(file)
                    }
                  }} aria-hidden="true" tabIndex={-1} />
                  <div className="px-[var(--space-apple-md)] py-2 border-2 border-dashed border-[var(--border-color)] rounded-[var(--radius-Apple-sm)] text-center hover:border-[var(--color-secondary)] transition-colors">
                    <p className="text-sm text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">点击上传 Logo</p>
                    <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mt-0.5">支持 JPG、PNG，建议 200×200px</p>
                  </div>
                </label>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">描述（可选）</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="描述这个组织的用途..."
                className="w-full px-[var(--space-apple-sm)] py-2 rounded-[var(--radius-Apple-sm)] border border-[var(--border-color)] surface-card text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-secondary)] resize-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">订阅计划</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-[var(--space-apple-sm)]">
                {([
                  { value: 'free' as const, label: '免费版', desc: '最多 5 人 · 500MB', price: '¥0', recommended: false },
                  { value: 'pro' as const, label: '专业版', desc: '最多 50 人 · 5GB', price: '¥99/月', recommended: true },
                  { value: 'enterprise' as const, label: '企业版', desc: '不限人数 · 无限存储', price: '定制', recommended: false },
                ]).map((p) => (
                  <button
                    key={p.value}
                    onClick={() => setPlan(p.value)}
                    className={`relative p-[var(--space-apple-md)] rounded-[var(--radius-Apple-md)] border-2 text-left transition-all ${
                      plan === p.value
                        ? 'border-[var(--color-primary)] bg-[var(--color-primary-container)] ring-1 ring-[var(--color-primary)]/30'
                        : 'border-[var(--border-color)] hover:border-[var(--border-color)] dark:hover:border-neutral-600'
                    }`}
                  >
                    {p.recommended && (
                      <span className="absolute -top-2 right-3 px-1.5 py-0.5 rounded-[var(--radius-pill)] text-xs font-semibold bg-[var(--color-primary)] text-white">
                        推荐
                      </span>
                    )}
                    <p className="font-semibold text-sm text-[var(--text-primary)]">{p.label}</p>
                    <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mt-1 leading-relaxed">{p.desc}</p>
                    <p className={`text-base font-bold mt-2 ${plan === p.value ? 'text-[var(--color-primary-text)]' : 'text-[var(--text-primary)]'}`}>{p.price}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 'members' && (
          <div className="space-y-[var(--space-apple-md)]">
            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">邀请首名成员（可选）</label>
              <div className="flex gap-[var(--space-apple-sm)]">
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="member@example.com"
                  className="flex-1 px-[var(--space-apple-sm)] py-2 rounded-[var(--radius-Apple-sm)] border border-[var(--border-color)] surface-card text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-secondary)]"
                />
                <button
                  onClick={() => setInviteEmail('')}
                  className="px-[var(--space-apple-sm)] py-2 text-sm text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)] rounded-[var(--radius-Apple-sm)] transition-colors"
                >
                  清空
                </button>
              </div>
              <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mt-1.5">创建组织后可在设置中继续邀请更多成员</p>
            </div>
          </div>
        )}

        {step === 'confirm' && (
          <div className="space-y-[var(--space-apple-md)]">
            <div className="surface-card rounded-[var(--radius-Apple-md)] border border-[var(--border-color)] p-[var(--space-apple-md)] space-y-[var(--space-apple-sm)]">
              <div className="flex items-center gap-[var(--space-apple-sm)]">
                <div className="w-12 h-12 bg-gradient-to-br from-[var(--color-secondary-surface)] to-[var(--color-accent-surface-deep)] rounded-[var(--radius-Apple-md)] flex items-center justify-center text-white font-bold text-lg overflow-hidden shadow-lg">
                  {logoUrl ? (
                    <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" />
                  ) : name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-semibold text-[var(--text-primary)]">{name}</p>
                  <p className="text-sm text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">@{slug}</p>
                </div>
              </div>
              {description && <p className="text-sm text-[var(--text-secondary)]">{description}</p>}
              <div className="flex items-center gap-2 pt-2 border-t border-[var(--border-color)]">
                <span className="px-2 py-0.5 rounded-[var(--radius-pill)] text-xs font-medium bg-[var(--color-primary-container)] text-[var(--color-primary-text)] dark:bg-[var(--color-primary-container)]/25 dark:text-[var(--color-primary-text)]">
                  {plan === 'free' ? '免费版' : plan === 'pro' ? '专业版' : '企业版'}
                </span>
              </div>
            </div>
          </div>
        )}

        {step === 'success' && (
          <div className="text-center py-[var(--space-apple-lg)]">
            <div className="w-16 h-16 bg-[var(--color-success-container)] dark:bg-[var(--color-success-container)]/25 rounded-[var(--radius-pill)] flex items-center justify-center mx-auto mb-[var(--space-apple-md)]">
              <CheckCircle className="w-8 h-8 text-[var(--color-success-text)]0" />
            </div>
            <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">组织创建成功！</h3>
            <p className="text-sm text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">您可以开始邀请成员并配置组织设置</p>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 text-sm text-[var(--color-error-text)] dark:text-[var(--color-error-text)] bg-[var(--color-error-container)] rounded-[var(--radius-Apple-sm)] px-[var(--space-apple-sm)] py-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {/* 操作按钮（主次分明：主按钮用品牌 primary，次按钮用 ghost） */}
        <div className="flex justify-between gap-[var(--space-apple-sm)] pt-2">
          {step !== 'basic' && step !== 'success' ? (
            <button onClick={() => { const steps: WizardStep[] = ['basic', 'details', 'members', 'confirm']; const idx = steps.indexOf(step); if (idx > 0) setStep(steps[idx - 1]); }} className="px-[var(--space-apple-md)] py-2 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] rounded-[var(--radius-Apple-sm)] transition-colors">
              上一步
            </button>
          ) : <div />}
          {step === 'success' ? (
            <button onClick={handleClose} className="px-6 py-2 text-sm font-medium bg-[var(--color-primary)] text-white rounded-[var(--radius-Apple-sm)] hover:bg-[var(--color-primary)] transition-colors">
              完成
            </button>
          ) : step === 'confirm' ? (
            <button
              onClick={handleCreate}
              disabled={loading}
              className="px-6 py-2 text-sm font-medium bg-[var(--color-primary)] text-white rounded-[var(--radius-Apple-sm)] hover:bg-[var(--color-primary)] disabled:opacity-50 transition-colors flex items-center gap-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              确认创建
            </button>
          ) : (
            <button onClick={() => setStep(step === 'basic' ? 'details' : step === 'details' ? 'members' : 'confirm')} className="px-6 py-2 text-sm font-medium bg-[var(--color-primary)] text-white rounded-[var(--radius-Apple-sm)] hover:bg-[var(--color-primary)] transition-colors">
              下一步
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}

export default CreateOrgWizard;
