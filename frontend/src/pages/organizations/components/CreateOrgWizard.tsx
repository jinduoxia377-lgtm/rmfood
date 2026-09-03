import { useState, useCallback } from 'react';
import { X, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { Modal, Button } from '@/components/ui';
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
        {/* 步骤指示器 */}
        <div className="flex items-center gap-2">
          {(['basic', 'details', 'members', 'confirm'] as const).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium ${
                step === s ? 'bg-secondary-600 text-white' :
                step !== 'basic' && ['basic', 'details', 'members', 'confirm'].indexOf(step) > i ? 'bg-success-500 text-white' :
                'bg-neutral-200 text-neutral-500'
              }`}>
                {['basic', 'details', 'members', 'confirm'].indexOf(step) > i ? <CheckCircle className="w-4 h-4" /> : i + 1}
              </div>
              <span className={`text-sm ${step === s ? 'text-secondary-600 font-medium' : 'text-neutral-500'}`}>
                {i === 0 ? '基本信息' : i === 1 ? '详细设置' : i === 2 ? '邀请成员' : '确认创建'}
              </span>
              {i < 3 && <div className="w-6 h-px bg-neutral-200" />}
            </div>
          ))}
        </div>

        {step === 'basic' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1.5">
                组织名称 <span className="text-error-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="例如：RMFOOD 研发中心"
                className="w-full px-3 py-2 rounded-lg border border-neutral-300 surface-card text-neutral-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-secondary-500"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-medium text-neutral-700">
                  标识符 <span className="text-error-500">*</span>
                </label>
                <label className="flex items-center gap-1 text-xs text-neutral-500 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoSlug}
                    onChange={(e) => setAutoSlug(e.target.checked)}
                    className="rounded border-neutral-300"
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
                className="w-full px-3 py-2 rounded-lg border border-neutral-300 surface-card text-neutral-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-secondary-500 disabled:opacity-50"
              />
              <p className="text-xs text-neutral-400 mt-1">仅支持小写字母、数字和连字符</p>
            </div>
          </div>
        )}

        {step === 'details' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1.5">组织头像（可选）</label>
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center text-white font-bold text-2xl shadow-lg">
                  {logoUrl ? (
                    <img src={logoUrl} alt="Logo" className="w-full h-full object-cover rounded-xl" />
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
                  }} />
                  <div className="px-4 py-2 border-2 border-dashed border-neutral-300 dark:border-neutral-600 rounded-lg text-center hover:border-secondary-500 transition-colors">
                    <p className="text-sm text-neutral-500">点击上传 Logo</p>
                    <p className="text-xs text-neutral-400 mt-0.5">支持 JPG、PNG，建议 200×200px</p>
                  </div>
                </label>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1.5">描述（可选）</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="描述这个组织的用途..."
                className="w-full px-3 py-2 rounded-lg border border-neutral-300 surface-card text-neutral-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-secondary-500 resize-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">订阅计划</label>
              <div className="grid grid-cols-3 gap-3">
                {([
                  { value: 'free' as const, label: '免费版', desc: '最多5人，500MB', price: '¥0' },
                  { value: 'pro' as const, label: '专业版', desc: '最多50人，5GB', price: '¥99/月' },
                  { value: 'enterprise' as const, label: '企业版', desc: '不限人数，无限存储', price: '定制' },
                ]).map((p) => (
                  <button
                    key={p.value}
                    onClick={() => setPlan(p.value)}
                    className={`p-3 rounded-xl border-2 text-left transition-all ${
                      plan === p.value
                        ? 'border-secondary-500 bg-secondary-50 dark:bg-secondary-900/20'
                        : 'border-neutral-200 hover:border-neutral-300'
                    }`}
                  >
                    <p className="font-medium text-sm text-neutral-900 dark:text-white">{p.label}</p>
                    <p className="text-xs text-neutral-500 mt-0.5">{p.desc}</p>
                    <p className="text-sm font-semibold text-secondary-600 mt-1">{p.price}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 'members' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1.5">邀请首名成员（可选）</label>
              <div className="flex gap-3">
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="member@example.com"
                  className="flex-1 px-3 py-2 rounded-lg border border-neutral-300 surface-card text-neutral-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-secondary-500"
                />
                <button
                  onClick={() => setInviteEmail('')}
                  className="px-3 py-2 text-sm text-neutral-500 hover:bg-neutral-100 rounded-lg transition-colors"
                >
                  清空
                </button>
              </div>
              <p className="text-xs text-neutral-400 mt-1.5">创建组织后可在设置中继续邀请更多成员</p>
            </div>
          </div>
        )}

        {step === 'confirm' && (
          <div className="space-y-4">
            <div className="surface-card rounded-xl border border-neutral-200 p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center text-white font-bold text-lg overflow-hidden shadow-lg">
                  {logoUrl ? (
                    <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" />
                  ) : name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-semibold text-neutral-900 dark:text-white">{name}</p>
                  <p className="text-sm text-neutral-500">@{slug}</p>
                </div>
              </div>
              {description && <p className="text-sm text-neutral-600 dark:text-neutral-400">{description}</p>}
              <div className="flex items-center gap-2 pt-2 border-t border-neutral-100 dark:border-neutral-800">
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-secondary-100 text-secondary-700 dark:bg-secondary-900/30 dark:text-secondary-400">
                  {plan === 'free' ? '免费版' : plan === 'pro' ? '专业版' : '企业版'}
                </span>
              </div>
            </div>
          </div>
        )}

        {step === 'success' && (
          <div className="text-center py-6">
            <div className="w-16 h-16 bg-success-100 dark:bg-success-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-success-500" />
            </div>
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-2">组织创建成功！</h3>
            <p className="text-sm text-neutral-500">您可以开始邀请成员并配置组织设置</p>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 text-sm text-error-600 dark:text-error-400 bg-error-50 dark:bg-error-900/20 rounded-lg px-3 py-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {/* 操作按钮 */}
        <div className="flex justify-between gap-3 pt-2">
          {step !== 'basic' && step !== 'success' ? (
            <button onClick={() => { const steps: WizardStep[] = ['basic', 'details', 'members', 'confirm']; const idx = steps.indexOf(step); if (idx > 0) setStep(steps[idx - 1]); }} className="px-4 py-2 text-sm text-neutral-600 hover:bg-neutral-100 rounded-lg transition-colors">
              上一步
            </button>
          ) : <div />}
          {step === 'success' ? (
            <button onClick={handleClose} className="px-6 py-2 text-sm bg-secondary-600 text-white rounded-lg hover:bg-secondary-700 transition-colors">
              完成
            </button>
          ) : step === 'confirm' ? (
            <button
              onClick={handleCreate}
              disabled={loading}
              className="px-6 py-2 text-sm bg-secondary-600 text-white rounded-lg hover:bg-secondary-700 disabled:opacity-50 transition-colors flex items-center gap-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              确认创建
            </button>
          ) : (
            <button onClick={() => setStep(step === 'basic' ? 'details' : step === 'details' ? 'members' : 'confirm')} className="px-6 py-2 text-sm bg-secondary-600 text-white rounded-lg hover:bg-secondary-700 transition-colors">
              下一步
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}

export default CreateOrgWizard;
