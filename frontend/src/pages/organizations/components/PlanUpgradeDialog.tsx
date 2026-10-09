import { useState, useCallback, useEffect, useRef } from 'react';
import { useToast } from '@/components/ui/Toast';
import { Modal } from '@/components/ui/Modal';
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import api from '@/api/client';
import type { Organization } from '@/hooks/useOrganizations';

interface PlanUpgradeDialogProps {
  open: boolean;
  organization: Organization;
  onClose: () => void;
  onPlanUpdated: (plan: string) => void;
}

const PLAN_CONFIG = [
  {
    value: 'free' as const,
    label: '免费版',
    price: '免费',
    desc: '适合个人学习使用',
    maxMembers: 5,
    maxStorage: '500 MB',
    maxTeams: 1,
    maxFormulas: 50,
    features: ['基础配方管理', '团队协作', '数据导出'],
    highlight: false,
  },
  {
    value: 'pro' as const,
    label: '专业版',
    price: '¥99/月',
    desc: '适合小型团队使用',
    maxMembers: 50,
    maxStorage: '5 GB',
    maxTeams: 10,
    maxFormulas: 500,
    features: ['全部免费版功能', '高级AI分析', '优先支持', 'API接入'],
    highlight: true,
  },
  {
    value: 'enterprise' as const,
    label: '企业版',
    price: '定制报价',
    desc: '适合大型企业使用',
    maxMembers: -1,
    maxStorage: '无限',
    maxTeams: -1,
    maxFormulas: -1,
    features: ['全部专业版功能', 'SSO单点登录', '专属客户经理', '私有化部署', '自定义集成'],
    highlight: false,
  },
] as const;

export function PlanUpgradeDialog({ open, organization, onClose, onPlanUpdated }: PlanUpgradeDialogProps) {
  const toast = useToast();
  const [selectedPlan, setSelectedPlan] = useState<'free' | 'pro' | 'enterprise'>(organization?.plan || 'free');
  const [confirming, setConfirming] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const canDowngrade = useCallback(() => {
    const target = PLAN_CONFIG.find(p => p.value === selectedPlan);
    if (!target) return true;
    if (target.maxMembers > 0 && organization.memberCount > target.maxMembers) return false;
    if (target.maxTeams > 0 && organization.teamCount > target.maxTeams) return false;
    return true;
  }, [selectedPlan, organization]);

  const handleSelectPlan = useCallback((plan: 'free' | 'pro' | 'enterprise') => {
    setSelectedPlan(plan);
    setError(null);
  }, []);

  const handleConfirm = useCallback(async () => {
    if (!confirmText) return;
    if (!canDowngrade()) {
      setError('当前成员数或团队数超过目标计划限制，请添加更多成员或升级后操作');
      return;
    }
    setConfirming(true);
    try {
      await api.put(`/organizations/${organization.id}/plan`, { plan: selectedPlan });
      toast.success(`计划已更新为${PLAN_CONFIG.find(p => p.value === selectedPlan)?.label}`);
      onPlanUpdated(selectedPlan);
      onClose();
    } catch (err: any) {
      setError(err.message || '操作失败');
    } finally {
      setConfirming(false);
    }
  }, [selectedPlan, confirmText, organization.id, canDowngrade, toast, onPlanUpdated, onClose]);

  const handleClose = useCallback(() => {
    setSelectedPlan(organization?.plan || 'free');
    setConfirmText('');
    setError(null);
    onClose();
  }, [organization, onClose]);

  return (
    <Modal open={open} onClose={handleClose} title="升级/变更订阅计划" size="lg">
      <div className="space-y-6">
        {/* Current Plan */}
        <div className="flex items-center gap-3 p-4 bg-neutral-50 dark:bg-neutral-900/30 rounded-xl border border-neutral-200 dark:border-neutral-800">
          <span className="text-sm text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">当前计划:</span>
          <span className="px-3 py-1 rounded-full text-sm font-medium bg-secondary-100 text-secondary-700 dark:bg-secondary-900/30 dark:text-secondary-700">
            {PLAN_CONFIG.find(p => p.value === organization?.plan)?.label || organization?.plan}
          </span>
          <span className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">· {organization?.memberCount} 成员 · {organization?.teamCount} 团队</span>
        </div>

        {/* Plan Selection */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {PLAN_CONFIG.map((plan) => (
            <button
              key={plan.value}
              onClick={() => handleSelectPlan(plan.value)}
              className={cn(
                'relative rounded-xl border-2 p-5 text-left transition-all',
                selectedPlan === plan.value
                  ? 'border-secondary-500 bg-secondary-50 dark:bg-secondary-900/20 shadow-md'
                  : 'border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 dark:border-neutral-700',
                plan.highlight && 'ring-2 ring-accent-500/30',
              )}
            >
              {plan.highlight && (
                <span className="absolute -top-2.5 left-4 px-2 py-0.5 text-xs font-medium bg-accent-container text-accent-main rounded-full">
                  推荐
                </span>
              )}
              {plan.value === organization?.plan && (
                <span className="absolute top-2 right-2 text-xs text-secondary-600">当前</span>
              )}
              <h3 className="font-semibold text-neutral-900 dark:text-white">{plan.label}</h3>
              <p className={cn('text-2xl font-bold mt-2', plan.value === 'enterprise' ? 'text-neutral-900' : 'text-secondary-600')}>
                {plan.price}
              </p>
              <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mt-1">{plan.desc}</p>
              <div className="mt-4 space-y-1.5">
                <p className="text-xs text-neutral-600 dark:text-neutral-400">
                  成员: {plan.maxMembers > 0 ? `最多 ${plan.maxMembers} 人` : '不限'}
                </p>
                <p className="text-xs text-neutral-600 dark:text-neutral-400">存储: {plan.maxStorage}</p>
                <p className="text-xs text-neutral-600 dark:text-neutral-400">团队: {plan.maxTeams > 0 ? `最多 ${plan.maxTeams} 个` : '不限'}</p>
              </div>
              <ul className="mt-4 space-y-1">
                {plan.features.map((f, i) => (
                  <li key={i} className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] flex items-center gap-1.5">
                    <CheckCircle className="w-3 h-3 text-success-500 shrink-0" />{f}
                  </li>
                ))}
              </ul>
            </button>
          ))}
        </div>

        {/* DANGER: Downgrade warning */}
        {!canDowngrade() && (
          <div className="flex items-center gap-2 text-sm text-error-600 dark:text-error-600 bg-error-50 dark:bg-error-900/20 rounded-lg px-4 py-3">
            <AlertCircle className="w-4 h-4 shrink-0" />
            当前成员数 ({organization?.memberCount}) 或团队数 ({organization?.teamCount}) 超过目标计划限制
          </div>
        )}

        {/* Confirm Text Input */}
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1.5">
            确认操作
          </label>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={`输入 "确认升级至 ${PLAN_CONFIG.find(p => p.value === selectedPlan)?.label}" 确认`}
            className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 surface-card text-sm focus:outline-none focus:ring-2 focus:ring-secondary-500"
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-2">
          <button onClick={handleClose} className="px-4 py-2 text-sm text-neutral-600 hover:bg-neutral-100 dark:bg-neutral-800 rounded-lg transition-colors">
            取消
          </button>
          <button
            onClick={handleConfirm}
            disabled={confirming || !confirmText.trim() || confirmText !== `确认升级至 ${PLAN_CONFIG.find(p => p.value === selectedPlan)?.label}` || !canDowngrade()}
            className="px-4 py-2 text-sm bg-secondary-container text-secondary-main rounded-lg hover:bg-secondary-container disabled:opacity-50 transition-colors flex items-center gap-2"
          >
            {confirming && <Loader2 className="w-4 h-4 animate-spin" />}
            确认变更
          </button>
        </div>
      </div>
    </Modal>
  );
}

export default PlanUpgradeDialog;
