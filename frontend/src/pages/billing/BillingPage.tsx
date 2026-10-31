/**
 * /billing — 组织级订阅与账单页
 * - 当前计划 + 用量概览
 * - 升级方案对比（模拟支付）
 * - 订单历史（GET /organizations/{id}/subscription/orders）
 * - 企业版定制联系（mailto）
 * 仅组织 owner/admin 可访问（非管理员显示无权限提示）
 */
import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Building2, HardDrive, Users, FlaskConical, Zap, Sparkles,
  RefreshCw, Check, Shield, ArrowLeft, Mail, Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import api from '@/api/client';
import { useToast } from '@/components/ui/Toast';

interface OrgItem {
  id: number;
  name: string;
  slug: string;
  plan: string;
  myRole?: string;
}

interface SubscriptionInfo {
  organization_id: number;
  plan: string;
  plan_display_name: string;
  status: string;
  billing_cycle: string;
  started_at?: string | null;
  expires_at?: string | null;
  usage: Record<string, { used: number; limit: number; over: boolean }>;
}

interface OrderItem {
  id: number;
  plan: string;
  billing_cycle: string;
  amount_cents: number;
  currency: string;
  status: string;
  provider_order_id?: string;
  paid_at?: string | null;
  created_at?: string;
}

const PLAN_META: Record<string, { label: string; monthly: string; yearly: string; color: string; desc: string }> = {
  free: { label: '免费版', monthly: '¥0', yearly: '¥0', color: 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] dark:bg-[var(--bg-tertiary)] dark:text-[var(--text-muted)]', desc: '5 成员 / 2 团队 / 100 配方 / 1GB' },
  pro: { label: '专业版', monthly: '¥199/月', yearly: '¥1999/年', color: 'bg-[var(--color-primary-container)] text-[var(--color-primary-text)] dark:bg-[var(--color-primary-container)]/25 dark:text-[var(--color-primary-text)]', desc: '50 成员 / 10 团队 / 1000 配方 / 10GB' },
  enterprise: { label: '企业版', monthly: '¥1999/月起', yearly: '定制', color: 'bg-[var(--color-warning-container)] text-[var(--color-warning-text)] dark:bg-[var(--color-warning-container)]/25 dark:text-[var(--color-warning-text)]', desc: '无限资源 / SSO / 私有化部署' },
};

const USAGE_LABELS: Record<string, { label: string; icon: typeof Users }> = {
  members: { label: '成员', icon: Users },
  teams: { label: '团队', icon: Building2 },
  formulas: { label: '配方', icon: FlaskConical },
  storage: { label: '存储', icon: HardDrive },
  api_calls: { label: 'API 调用/天', icon: Zap },
  ai_generations: { label: 'AI 生成/天', icon: Sparkles },
};

function formatUsed(used: number, limit: number, key: string): string {
  if (key === 'storage') {
    return `${(used / 1024 / 1024 / 1024).toFixed(1)}GB / ${limit < 0 ? '无限' : `${(limit / 1024 / 1024 / 1024).toFixed(0)}GB`}`;
  }
  return `${used} / ${limit < 0 ? '无限' : limit}`;
}

function formatMoney(cents: number, currency: string): string {
  const sym = currency === 'CNY' ? '¥' : '$';
  return `${sym}${(cents / 100).toFixed(2)}`;
}

export default function BillingPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();

  const urlOrgId = searchParams.get('org') ? Number(searchParams.get('org')) : null;
  const [orgs, setOrgs] = useState<OrgItem[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<number | null>(urlOrgId);
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [confirmUpgrade, setConfirmUpgrade] = useState<string | null>(null);
  const [upgrading, setUpgrading] = useState(false);

  // 加载组织列表
  useEffect(() => {
    let cancelled = false;
    api.get('/organizations')
      .then((res) => {
        const list = (res.data?.organizations || []).map((o: Record<string, unknown>) => ({
          id: o.id,
          name: o.name,
          slug: o.slug,
          plan: o.plan,
          myRole: o.member_role ?? o.my_role ?? 'member',
        })) as OrgItem[];
        if (cancelled) return;
        setOrgs(list);
        if (!selectedOrgId && list.length > 0) {
          setSelectedOrgId(list[0].id);
        }
      })
      .catch(() => { if (!cancelled) setError('组织列表加载失败'); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 加载订阅与订单
  useEffect(() => {
    if (!selectedOrgId) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError(null);
    Promise.all([
      api.get(`/organizations/${selectedOrgId}/subscription`),
      api.get(`/organizations/${selectedOrgId}/subscription/orders`),
    ])
      .then(([subRes, orderRes]) => {
        if (cancelled) return;
        setSubscription(subRes.data?.subscription ?? subRes.data ?? null);
        setOrders(orderRes.data?.orders ?? []);
      })
      .catch((err: any) => {
        if (!cancelled) setError(err?.response?.data?.detail || '订阅数据加载失败');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [selectedOrgId]);

  const selectedOrg = orgs.find((o) => o.id === selectedOrgId) || null;
  const canManage = selectedOrg?.myRole === 'owner' || selectedOrg?.myRole === 'admin';
  const currentPlan = subscription?.plan || selectedOrg?.plan || 'free';
  const planMeta = PLAN_META[currentPlan] || PLAN_META.free;
  const usage = subscription?.usage || {};

  const handleOrgChange = useCallback((orgId: number) => {
    setSelectedOrgId(orgId);
    setSearchParams({ org: String(orgId) }, { replace: true });
    setConfirmUpgrade(null);
  }, [setSearchParams]);

  const handleUpgrade = useCallback(async (plan: string) => {
    if (!selectedOrgId) return;
    setUpgrading(true);
    try {
      await api.post(`/organizations/${selectedOrgId}/subscription/upgrade`, { plan, billing_cycle: billingCycle });
      toast.success(`已升级至 ${PLAN_META[plan]?.label || plan}（模拟支付成功）`);
      setConfirmUpgrade(null);
      // 刷新订阅与订单
      const [subRes, orderRes] = await Promise.all([
        api.get(`/organizations/${selectedOrgId}/subscription`),
        api.get(`/organizations/${selectedOrgId}/subscription/orders`),
      ]);
      setSubscription(subRes.data?.subscription ?? subRes.data ?? null);
      setOrders(orderRes.data?.orders ?? []);
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || '升级失败，请重试');
    } finally {
      setUpgrading(false);
    }
  }, [selectedOrgId, billingCycle, toast]);

  if (!selectedOrgId) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <p className="text-sm text-[var(--text-muted)]">正在加载组织...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="max-w-[1600px] mx-auto px-[var(--space-apple-md)] sm:px-6 lg:px-8 py-[var(--space-apple-lg)] space-y-[var(--space-apple-md)]">
        {/* 顶部标题栏 */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
              <button onClick={() => navigate('/organizations')} className="flex min-h-[44px] items-center gap-1 -m-2 px-2 hover:text-[var(--text-primary)] transition-colors">
                <ArrowLeft className="w-3.5 h-3.5" /> 返回组织列表
              </button>
            </div>
            <h1 className="mt-1 text-xl font-semibold tracking-tight text-[var(--text-primary)]">组织订阅与账单</h1>
            <p className="text-sm text-[var(--text-muted)] mt-0.5">
              {canManage ? '查看组织当前计划、用量与升级方案' : '仅组织所有者或管理员可管理订阅与查看账单'}
            </p>
          </div>
          {/* 组织选择器 */}
          <select
            value={selectedOrgId}
            onChange={(e) => handleOrgChange(Number(e.target.value))}
            className="px-[var(--space-apple-sm)] py-2 rounded-[var(--radius-Apple-sm)] border border-[var(--border-color)] dark:border-neutral-700 bg-[var(--bg-secondary)] text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            aria-label="选择组织"
          >
            {orgs.map((o) => (
              <option key={o.id} value={o.id}>{o.name}（{PLAN_META[o.plan]?.label || o.plan}）</option>
            ))}
          </select>
        </div>

        {error && (
          <div className="p-[var(--space-apple-md)] rounded-[var(--radius-Apple-sm)] bg-[var(--color-error-container)] border border-[var(--color-error-border)] dark:border-[var(--color-error)] text-sm text-[var(--color-error-text)] dark:text-[var(--color-error-text)]">
            {error}
          </div>
        )}

        {!canManage ? (
          <div className="p-10 text-center bg-[var(--bg-secondary)] rounded-[var(--radius-Apple-md)] border border-[var(--border-color)] dark:border-neutral-800">
            <Shield className="w-10 h-10 mx-auto text-[var(--text-muted)] mb-[var(--space-apple-sm)]" />
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">无权限查看账单</h2>
            <p className="text-sm text-[var(--text-muted)] mt-1">仅组织所有者或管理员可管理订阅与查看账单。</p>
          </div>
        ) : (
          <>
            {/* 当前计划 + 用量 */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* 当前计划卡片 */}
              <div className="bg-[var(--bg-secondary)] rounded-[var(--radius-Apple-md)] border border-[var(--border-color)] dark:border-neutral-800 p-[var(--space-apple-lg)] shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">当前计划</span>
                  <span className={cn('px-2.5 py-0.5 rounded-[var(--radius-pill)] text-xs font-medium', planMeta.color)}>{planMeta.label}</span>
                </div>
                <p className="mt-[var(--space-apple-sm)] text-2xl font-bold text-[var(--text-primary)]">
                  {billingCycle === 'yearly' ? planMeta.yearly : planMeta.monthly}
                </p>
                <p className="text-sm text-[var(--text-muted)] mt-1">{planMeta.desc}</p>
                <p className="text-xs text-[var(--text-muted)] mt-[var(--space-apple-sm)]">
                  计费周期：{subscription?.billing_cycle === 'yearly' ? '年付' : '月付'} · 状态：{subscription?.status || 'active'}
                </p>
              </div>

              {/* 用量概览 */}
              <div className="lg:col-span-2 bg-[var(--bg-secondary)] rounded-[var(--radius-Apple-md)] border border-[var(--border-color)] dark:border-neutral-800 p-[var(--space-apple-lg)] shadow-sm">
                <div className="flex items-center justify-between mb-[var(--space-apple-md)]">
                  <h2 className="text-sm font-semibold text-[var(--text-primary)]">用量概览</h2>
                  <button
                    onClick={() => { setSelectedOrgId(selectedOrgId); }}
                    className="inline-flex min-h-[44px] items-center gap-1 -m-2 px-2 text-xs text-[var(--text-muted)] hover:text-[var(--color-primary-text)] transition-colors"
                    title="刷新"
                  >
                    <RefreshCw className="w-3 h-3" /> 刷新
                  </button>
                </div>
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 text-[var(--color-primary-text)]0 animate-spin" />
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {Object.entries(USAGE_LABELS).map(([key, meta]) => {
                      const u = usage[key] || { used: 0, limit: -1, over: false };
                      const Icon = meta.icon;
                      const pct = u.limit > 0 ? Math.min(100, Math.round((u.used / u.limit) * 100)) : 0;
                      return (
                        <div key={key}>
                          <div className="flex items-center justify-between text-xs">
                            <span className="flex items-center gap-1.5 text-[var(--text-secondary)]">
                              <Icon className="w-3.5 h-3.5" /> {meta.label}
                            </span>
                            <span className={cn('font-medium', u.over ? 'text-[var(--color-error-text)]' : 'text-[var(--text-muted)]')}>
                              {formatUsed(u.used, u.limit, key)}
                            </span>
                          </div>
                          <div className="mt-1.5 h-1.5 rounded-[var(--radius-pill)] bg-[var(--bg-tertiary)] overflow-hidden">
                            <div
                              className={cn('h-full rounded-[var(--radius-pill)] transition-all', u.over ? 'bg-[var(--color-error-container)]0' : 'bg-[var(--color-primary-container)]0')}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* 升级方案对比 */}
            <div className="bg-[var(--bg-secondary)] rounded-[var(--radius-Apple-md)] border border-[var(--border-color)] dark:border-neutral-800 p-[var(--space-apple-lg)] shadow-sm">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-sm font-semibold text-[var(--text-primary)]">升级方案</h2>
                <div className="flex items-center gap-1.5 bg-[var(--bg-tertiary)] rounded-[var(--radius-pill)] p-1">
                  {(['monthly', 'yearly'] as const).map((c) => (
                    <button
                      key={c}
                      onClick={() => setBillingCycle(c)}
                      className={cn(
                        'px-[var(--space-apple-sm)] py-1.5 text-xs font-medium rounded-[var(--radius-pill)] transition-colors min-h-[44px]',
                        billingCycle === c
                          ? 'bg-[var(--bg-secondary)] dark:bg-[var(--bg-secondary)] text-[var(--color-primary-text)] shadow-sm'
                          : 'text-[var(--text-secondary)] hover:text-neutral-800',
                      )}
                    >
                      {c === 'monthly' ? '月付' : '年付（省 17%）'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {(['free', 'pro', 'enterprise'] as const).map((p) => {
                  const meta = PLAN_META[p];
                  const isCurrent = currentPlan === p;
                  return (
                    <div
                      key={p}
                      className={cn(
                        'relative p-5 rounded-[var(--radius-Apple-md)] border-2 transition-all',
                        isCurrent
                          ? 'border-[var(--color-primary)] bg-[var(--color-primary-container)]/40 dark:bg-[var(--color-primary-container)]/10'
                          : 'border-[var(--border-color)] hover:border-[var(--border-color)] dark:hover:border-neutral-600',
                      )}
                    >
                      {p === 'pro' && (
                        <span className="absolute -top-2 right-3 px-1.5 py-0.5 rounded-[var(--radius-pill)] text-xs font-semibold bg-[var(--color-primary)] text-white">推荐</span>
                      )}
                      <p className="font-semibold text-[var(--text-primary)]">{meta.label}</p>
                      <p className="text-lg font-bold text-[var(--text-primary)] mt-1">
                        {billingCycle === 'yearly' ? meta.yearly : meta.monthly}
                      </p>
                      <p className="text-xs text-[var(--text-muted)] mt-1">{meta.desc}</p>
                      {p === 'enterprise' && (
                        <p className="text-xs text-[var(--color-warning-text)] mt-1">含 SSO / 私有化 / 自定义集成</p>
                      )}
                      {isCurrent ? (
                        <span className="inline-flex items-center gap-1 mt-[var(--space-apple-sm)] text-xs font-medium text-[var(--color-primary-text)]">
                          <Check className="w-3.5 h-3.5" /> 当前计划
                        </span>
                      ) : p === 'enterprise' ? (
                        <a
                          href="mailto:sales@rmfood.cn?subject=企业版定制咨询"
                          className="mt-[var(--space-apple-sm)] inline-flex items-center gap-1.5 min-h-[44px] px-1 -mx-1 text-sm font-medium text-[var(--color-warning-text)] hover:text-[var(--color-warning-text)] transition-colors"
                        >
                          <Mail className="w-3.5 h-3.5" /> 联系定制
                        </a>
                      ) : (
                        <button
                          onClick={() => setConfirmUpgrade(p)}
                          className="mt-[var(--space-apple-sm)] inline-flex items-center gap-1 px-[var(--space-apple-sm)] py-1.5 min-h-[44px] text-sm font-medium bg-[var(--color-primary)] text-white rounded-[var(--radius-Apple-sm)] hover:bg-[var(--color-primary)] transition-colors"
                        >
                          升级至{meta.label}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 订单历史 */}
            <div className="bg-[var(--bg-secondary)] rounded-[var(--radius-Apple-md)] border border-[var(--border-color)] dark:border-neutral-800 overflow-x-auto shadow-sm">
              <div className="px-6 py-4 border-b border-[var(--border-color)] flex items-center justify-between">
                <h2 className="text-sm font-semibold text-[var(--text-primary)]">订单历史</h2>
                <span className="text-xs text-[var(--text-muted)]">当前为演示支付，订单为模拟数据</span>
              </div>
              {orders.length === 0 ? (
                <div className="p-6 sm:p-10 text-center text-sm text-[var(--text-muted)]">暂无订单记录</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-[var(--bg-tertiary)]/50">
                    <tr>
                      <th className="px-6 py-[var(--space-apple-md)] text-left text-xs font-medium text-[var(--text-muted)] uppercase">订单号</th>
                      <th className="px-6 py-[var(--space-apple-md)] text-left text-xs font-medium text-[var(--text-muted)] uppercase">计划</th>
                      <th className="px-6 py-[var(--space-apple-md)] text-left text-xs font-medium text-[var(--text-muted)] uppercase">周期</th>
                      <th className="px-6 py-[var(--space-apple-md)] text-left text-xs font-medium text-[var(--text-muted)] uppercase">金额</th>
                      <th className="px-6 py-[var(--space-apple-md)] text-left text-xs font-medium text-[var(--text-muted)] uppercase">状态</th>
                      <th className="px-6 py-[var(--space-apple-md)] text-left text-xs font-medium text-[var(--text-muted)] uppercase">时间</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                    {orders.map((o) => (
                      <tr key={o.id}>
                        <td className="px-6 py-[var(--space-apple-md)] font-mono text-xs text-[var(--text-secondary)]">{o.provider_order_id || `#${o.id}`}</td>
                        <td className="px-6 py-[var(--space-apple-md)] text-[var(--text-primary)]">{PLAN_META[o.plan]?.label || o.plan}</td>
                        <td className="px-6 py-[var(--space-apple-md)] text-[var(--text-secondary)]">{o.billing_cycle === 'yearly' ? '年付' : '月付'}</td>
                        <td className="px-6 py-[var(--space-apple-md)] font-medium text-[var(--text-primary)]">{formatMoney(o.amount_cents, o.currency)}</td>
                        <td className="px-6 py-[var(--space-apple-md)]"><span className="px-2 py-0.5 rounded-[var(--radius-pill)] text-xs font-medium bg-[var(--color-success-container)] text-[var(--color-success-text)]">{o.status}</span></td>
                        <td className="px-6 py-[var(--space-apple-md)] text-[var(--text-muted)]">{o.paid_at ? new Date(o.paid_at).toLocaleString('zh-CN') : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
      </div>

      {/* 升级确认弹窗 */}
      {confirmUpgrade && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-[var(--space-apple-md)]">
          <div className="w-full max-w-md bg-[var(--bg-secondary)] rounded-[var(--radius-Apple-md)] shadow-lg p-[var(--space-apple-lg)]">
            <h3 className="text-lg font-semibold text-[var(--text-primary)]">确认升级</h3>
            <p className="text-sm text-[var(--text-muted)] mt-2">
              将 {selectedOrg?.name} 升级至 <strong>{PLAN_META[confirmUpgrade]?.label}</strong>（{billingCycle === 'yearly' ? '年付' : '月付'}），
              金额 {billingCycle === 'yearly' ? PLAN_META[confirmUpgrade]?.yearly : PLAN_META[confirmUpgrade]?.monthly}。
              当前为模拟支付，不会真实扣款。
            </p>
            <div className="flex justify-end gap-[var(--space-apple-sm)] mt-6">
              <button
                onClick={() => setConfirmUpgrade(null)}
                className="px-[var(--space-apple-md)] py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] rounded-[var(--radius-Apple-sm)] transition-colors"
              >
                取消
              </button>
              <button
                onClick={() => handleUpgrade(confirmUpgrade)}
                disabled={upgrading}
                className="inline-flex items-center gap-2 px-[var(--space-apple-md)] py-2 text-sm font-medium bg-[var(--color-primary)] text-white rounded-[var(--radius-Apple-sm)] hover:bg-[var(--color-primary)] disabled:opacity-50 transition-colors"
              >
                {upgrading && <Loader2 className="w-4 h-4 animate-spin" />}
                确认升级
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}