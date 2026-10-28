/**
 * 订阅计划（plan）工具 — 前端租户隔离 / 免费-专业版分割
 *
 * ⚠️ 契约一致性（规格 §2.2 / §4.4）：
 *   PLAN_FEATURES 必须与 docs/tenant-isolation-segmentation-plan.md §2.2 功能矩阵
 *   以及 backend/app/core/plans.py 的 PLAN_FEATURES 完全一致（单一事实来源）。
 *   任何一方修改都必须同步更新本表。
 *
 * 版本层级（规格 §2.3）：
 *   PLAN_RANK = { free: 0, pro: 1 }
 *   hasPlan(plan, feature) ⇔ PLAN_RANK[plan] >= PLAN_RANK[PLAN_FEATURES[feature]]
 */
import { createElement, Fragment, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { useAuthStore } from '@/stores/auth';

/** 版本层级：免费 0 / 专业 1（enterprise 保留给组织级 Subscription.plan，Phase 1 不引入用户级） */
export const PLAN_RANK = { free: 0, pro: 1 } as const;

/** 功能矩阵（与规格 §2.2 及后端 core/plans.py 完全一致） */
export const PLAN_FEATURES = {
  ai_formula_generation: 'pro',
  peptide_analysis: 'pro',
  advanced_analytics: 'pro',
  knowledge_graph: 'pro',
  multi_ecommerce_sync: 'pro',
  advanced_report_export: 'pro',
} as const;

/** 用户级 Plan 类型：'free' | 'pro' */
export type Plan = keyof typeof PLAN_RANK;

/** 功能 key 联合类型 */
export type PlanFeature = keyof typeof PLAN_FEATURES;

/** 将任意来源的 plan 归一化为合法 Plan（未知/缺失回退 'free'，不崩溃） */
export function toPlan(value: unknown): Plan {
  return value === 'pro' ? 'pro' : 'free';
}

/**
 * 判断某 plan 是否满足某功能所需最低版本。
 * @param plan    用户当前 plan
 * @param feature 功能 key
 */
export function hasPlan(plan: Plan, feature: PlanFeature): boolean {
  const required: Plan = PLAN_FEATURES[feature];
  return PLAN_RANK[plan] >= PLAN_RANK[required];
}

/**
 * usePlan() Hook — 从 authStore 读取当前用户 plan 并提供判定。
 * @returns { plan, isPro, hasFeature }
 */
export function usePlan(): { plan: Plan; isPro: boolean; hasFeature: (feature: PlanFeature) => boolean } {
  const user = useAuthStore((s) => s.user);
  const plan = toPlan(user?.plan);
  return {
    plan,
    isPro: plan === 'pro',
    hasFeature: (feature: PlanFeature) => hasPlan(plan, feature),
  };
}

/**
 * 锁定态 + 升级引导（PlanGate / RequirePlan 的默认不满足态）。
 * 无组织上下文时自包含：展示锁定提示与「查看专业版方案」按钮（跳转 /billing）。
 */
function PlanLockedState({ feature }: { feature: PlanFeature }) {
  const navigate = useNavigate();
  return createElement(
    'div',
    {
      className:
        'flex flex-col items-center justify-center gap-3 rounded-[var(--radius-Apple-md)] border border-dashed ' +
        'border-[var(--border-color)] dark:border-neutral-700 bg-[var(--bg-tertiary)]/50 dark:bg-[var(--bg-secondary)]/30 ' +
        'px-6 py-10 text-center',
      role: 'status',
    },
    createElement(Lock, { className: 'w-8 h-8 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]', 'aria-hidden': true }),
    createElement(
      'p',
      { className: 'text-sm font-medium text-[var(--text-primary)]' },
      '专业版功能',
    ),
    createElement(
      'p',
      { className: 'text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] max-w-sm' },
      `该功能（${feature}）为专业版专属。升级到专业版即可解锁全部高级能力。`,
    ),
    createElement(
      'button',
      {
        type: 'button',
        onClick: () => navigate('/billing'),
        className:
          'mt-1 inline-flex items-center gap-2 rounded-[var(--radius-Apple-sm)] px-4 py-2 text-sm font-medium ' +
          'bg-secondary-container text-secondary-main hover:bg-secondary-container/80 transition-colors',
      },
      '查看专业版方案',
    ),
  );
}

/**
 * RequirePlan — 条件渲染包裹。
 * 不满足最低版本时渲染 fallback（含升级提示，缺省为 null）。
 */
export function RequirePlan({
  feature,
  children,
  fallback = null,
}: {
  feature: PlanFeature;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const { plan } = usePlan();
  if (hasPlan(plan, feature)) return createElement(Fragment, null, children);
  return createElement(Fragment, null, fallback);
}

/**
 * PlanGate — 专业功能门控。
 * 满足最低版本渲染 children；否则渲染升级引导（锁定态 + 升级提示）。
 */
export function PlanGate({ feature, children }: { feature: PlanFeature; children: ReactNode }) {
  const { plan } = usePlan();
  if (hasPlan(plan, feature)) return createElement(Fragment, null, children);
  return createElement(PlanLockedState, { feature });
}

export default { PLAN_RANK, PLAN_FEATURES, hasPlan, toPlan, usePlan, RequirePlan, PlanGate };
