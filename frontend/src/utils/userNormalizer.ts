/**
 * 用户对象字段规范化工具
 *
 * 后端（FastAPI/Pydantic）返回 snake_case 字段（full_name / avatar_url / last_login...），
 * 前端类型体系使用 camelCase（fullName / avatarUrl / lastLoginAt）。
 * 该工具在数据进入前端状态层时统一转换为 camelCase，
 * 同时兼容已规范化（camelCase）或 Mock 数据，避免重复转换。
 */
import type { User, UserRole } from '@/types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RawUser = Record<string, any>

/**
 * 将任意来源的用户 plan 归一化为合法 Plan 值。
 * 后端可能尚未返回 plan（Phase 1 兼容期），缺省回退 'free'，
 * 不因字段缺失崩溃；未知值一律回退 'free'。
 */
function normalizePlan(value: unknown): 'free' | 'pro' {
  return value === 'pro' ? 'pro' : 'free'
}

export function normalizeUser(raw: RawUser): User {
  return {
    id: raw.id,
    username: raw.username ?? '',
    email: raw.email ?? '',
    fullName: raw.fullName ?? raw.full_name ?? undefined,
    avatarUrl: raw.avatarUrl ?? raw.avatar_url ?? undefined,

    // 订阅计划（缺省 'free'；兼容后端尚未返回 plan 的过渡期）
    plan: normalizePlan(raw.plan ?? raw.plan_name),

    // 所属组织（白名单组织授予判定 / 租户隔离显示）
    // 后端 UserResponse 返回 snake_case organization_id / organization_name；
    // 同时兼容 camelCase（organizationId/organizationName）、orgName 与嵌套 organization 对象。
    organizationId: raw.organizationId ?? raw.organization_id ?? undefined,
    organizationName:
      raw.organizationName ??
      raw.organization_name ??
      (raw.orgName as string | undefined) ??
      ((raw.organization as { name?: string } | undefined)?.name) ??
      undefined,
    orgName: (raw.orgName as string | undefined) ?? undefined,
    organization: (raw.organization as { id?: number; name?: string } | undefined) ?? undefined,

    role: (raw.role ?? 'guest') as UserRole,
    isActive: raw.isActive ?? raw.is_active ?? true,
    department: raw.department ?? undefined,
    phone: raw.phone ?? undefined,

    // 个人资料扩展字段
    position: raw.position ?? undefined,
    bio: raw.bio ?? undefined,
    website: raw.website ?? undefined,
    github: raw.github ?? undefined,
    linkedin: raw.linkedin ?? undefined,

    // 安全信息
    lastLoginAt: raw.lastLoginAt ?? raw.last_login ?? undefined,
    loginAttempts: raw.loginAttempts ?? raw.login_attempts ?? 0,
    lockedUntil: raw.lockedUntil ?? raw.locked_until ?? null,

    preferences: raw.preferences,

    // 时间戳
    createdAt: raw.createdAt ?? raw.created_at ?? '',
    updatedAt: raw.updatedAt ?? raw.updated_at ?? '',
  }
}