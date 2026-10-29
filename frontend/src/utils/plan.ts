/**
 * 订阅计划（plan）工具 — 前端租户隔离 / 免费-专业版分割
 *
 * ⚠️ 契约一致性（规格 §2.2 / §4.4）：
 *   PLAN_FEATURES 必须与 docs/tenant-isolation-segmentation-plan.md §2.2 功能矩阵
 *   以及 backend/app/core/plans.py 的 PLAN_FEATURES 完全一致（单一事实来源）。
 *   任何一方修改都必须同步更新本表。
 *
 * ⚠️ 白名单组织授予（单一事实来源 = backend/app/core/plans.py）：
 *   WHITELIST_ORG_NAME / WHITELIST_GRANTED_FEATURES 必须与后端 plans.py 一致。
 *   白名单组织「莱茵分子白名单组织」成员 plan 仍为 'free'，但对授予子集功能
 *   （ai_formula_generation / peptide_analysis / advanced_analytics）按组织授予
 *   判定为可用（免费版 + 部分专业版功能），不改 User.plan。
 *
 * 版本层级（规格 §2.3）：
 *   PLAN_RANK = { free: 0, pro: 1 }
 *   hasPlan(plan, feature) ⇔ PLAN_RANK[plan] >= PLAN_RANK[PLAN_FEATURES[feature]]
 */
import { createElement, Fragment, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { useAuthStore } from '@/stores/auth';
import type { User } from '@/types';

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

/**
 * 白名单组织名称（与后端 backend/app/core/plans.py WHITELIST_ORG_NAME 一致）。
 * 白名单获批用户归入此单一组织，plan 仍为 'free'，但授予子集功能。
 */
export const WHITELIST_ORG_NAME = '莱茵分子白名单组织';

/**
 * 白名单组织授予的功能子集（与后端 plans.py WHITELIST_GRANTED_FEATURES 一致）。
 * 仅授予 3 项核心科学功能；不授予 knowledge_graph / multi_ecommerce_sync /
 * advanced_report_export。子集可随配置调整（后端单一事实来源）。
 */
export const WHITELIST_GRANTED_FEATURES = new Set<PlanFeature>([
  'ai_formula_generation',
  'peptide_analysis',
  'advanced_analytics',
]);

/** 用户级 Plan 类型：'free' | 'pro' */
export type Plan = keyof typeof PLAN_RANK;

/** 功能 key 联合类型 */
export type PlanFeature = keyof typeof PLAN_FEATURES;

/** 将任意来源的 plan 归一化为合法 Plan（未知/缺失回退 'free'，不崩溃） */
export function toPlan(value: unknown): Plan {
  return value === 'pro' ? 'pro' : 'free';
}

/**
 * 从用户对象读取组织名（兼容多种来源字段名，归一化为 string | undefined）。
 * 优先级：organizationName（规范化字段）→ orgName（兼容别名）→ organization?.name（嵌套对象）。
 */
export function getUserOrgName(user: User | null | undefined): string | undefined {
  if (!user) return undefined;
  const nested = user.organization as { name?: string } | null | undefined;
  return user.organizationName ?? user.orgName ?? nested?.name ?? undefined;
}

/**
 * 判断某 plan（+ 可选组织名）是否满足某功能所需最低版本。
 *
 * 与后端 plans.py has_plan 对齐（单一事实来源）：
 *   1. plan 满足版本门槛 → True；
 *   2. 否则若 feature ∈ WHITELIST_GRANTED_FEATURES 且 orgName === WHITELIST_ORG_NAME → True
 *      （白名单组织 = 免费版 + 部分专业版功能）；
 *   3. 否则 False。
 *
 * @param plan    用户当前 plan
 * @param feature 功能 key
 * @param orgName 用户所属组织名（可选；无 org 时 org-grant 不生效，不破坏既有 free/pro 行为）
 */
export function hasPlan(plan: Plan, feature: PlanFeature, orgName?: string): boolean {
  const required: Plan = PLAN_FEATURES[feature];
  if (PLAN_RANK[plan] >= PLAN_RANK[required]) return true;
  // 白名单组织授予分支：组织名匹配且功能在授予子集内 → 可用（不改 User.plan）
  if (orgName === WHITELIST_ORG_NAME && WHITELIST_GRANTED_FEATURES.has(feature)) return true;
  return false;
}

/**
 * usePlan() Hook — 从 authStore 读取当前用户 plan + 组织信息并提供判定。
 * @returns { plan, isPro, orgName, hasFeature }
 */
export function usePlan(): {
  plan: Plan;
  isPro: boolean;
  orgName: string | undefined;
  hasFeature: (feature: PlanFeature) => boolean;
} {
  const user = useAuthStore((s) => s.user);
  const plan = toPlan(user?.plan);
  const orgName = getUserOrgName(user);
  return {
    plan,
    isPro: plan === 'pro',
    orgName,
    hasFeature: (feature: PlanFeature) => hasPlan(plan, feature, orgName),
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
 * 判定经 usePlan().hasFeature，白名单组织授予自动生效。
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
  const { hasFeature } = usePlan();
  if (hasFeature(feature)) return createElement(Fragment, null, children);
  return createElement(Fragment, null, fallback);
}

/**
 * PlanGate — 专业功能门控。
 * 满足最低版本渲染 children；否则渲染升级引导（锁定态 + 升级提示）。
 * 判定经 usePlan().hasFeature，白名单组织授予自动生效。
 */
export function PlanGate({ feature, children }: { feature: PlanFeature; children: ReactNode }) {
  const { hasFeature } = usePlan();
  if (hasFeature(feature)) return createElement(Fragment, null, children);
  return createElement(PlanLockedState, { feature });
}

export default {
  PLAN_RANK,
  PLAN_FEATURES,
  WHITELIST_ORG_NAME,
  WHITELIST_GRANTED_FEATURES,
  hasPlan,
  getUserOrgName,
  toPlan,
  usePlan,
  RequirePlan,
  PlanGate,
};
