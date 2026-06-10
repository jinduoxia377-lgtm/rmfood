/**
 * 基于角色的访问控制(RBAC)工具类
 * - 管理用户权限
 * - 检查权限
 * - 权限验证
 */
import type { AccessLevel } from '@/config/dashboard'

export type CollaborationRole = 'owner' | 'editor' | 'reviewer' | 'viewer'

export interface CollaborationPermissions {
  canEdit: boolean
  canDelete: boolean
  canInvite: boolean
  canRemove: boolean
  canChangeRole: boolean
  canExport: boolean
}

const COLLABORATION_PERMISSION_MATRIX: Record<CollaborationRole, CollaborationPermissions> = {
  owner: {
    canEdit: true,
    canDelete: true,
    canInvite: true,
    canRemove: true,
    canChangeRole: true,
    canExport: true,
  },
  editor: {
    canEdit: true,
    canDelete: true,
    canInvite: false,
    canRemove: false,
    canChangeRole: false,
    canExport: true,
  },
  reviewer: {
    canEdit: false,
    canDelete: false,
    canInvite: false,
    canRemove: false,
    canChangeRole: false,
    canExport: true,
  },
  viewer: {
    canEdit: false,
    canDelete: false,
    canInvite: false,
    canRemove: false,
    canChangeRole: false,
    canExport: false,
  },
}

export const CollaborationRBAC = {
  getPermissions(role: CollaborationRole): CollaborationPermissions {
    return COLLABORATION_PERMISSION_MATRIX[role]
  },

  canEdit(role: CollaborationRole): boolean {
    return COLLABORATION_PERMISSION_MATRIX[role].canEdit
  },

  canDelete(role: CollaborationRole): boolean {
    return COLLABORATION_PERMISSION_MATRIX[role].canDelete
  },

  canInvite(role: CollaborationRole): boolean {
    return COLLABORATION_PERMISSION_MATRIX[role].canInvite
  },

  canRemove(role: CollaborationRole): boolean {
    return COLLABORATION_PERMISSION_MATRIX[role].canRemove
  },

  canChangeRole(role: CollaborationRole): boolean {
    return COLLABORATION_PERMISSION_MATRIX[role].canChangeRole
  },

  canExport(role: CollaborationRole): boolean {
    return COLLABORATION_PERMISSION_MATRIX[role].canExport
  },

  hasPermission(
    role: CollaborationRole,
    permission: keyof CollaborationPermissions,
  ): boolean {
    return COLLABORATION_PERMISSION_MATRIX[role][permission]
  },

  validateAction(
    role: CollaborationRole,
    action: keyof CollaborationPermissions,
  ): { allowed: boolean; reason?: string } {
    const permission = COLLABORATION_PERMISSION_MATRIX[role][action]

    if (!permission) {
      return {
        allowed: false,
        reason: `角色 ${role} 没有执行此操作的权限`,
      }
    }

    return { allowed: true }
  },

  getRoleDescription(role: CollaborationRole): string {
    const descriptions: Record<CollaborationRole, string> = {
      owner: '所有者 - 拥有文档的全部权限，可以管理其他参与者的角色',
      editor: '编辑者 - 可以编辑和删除内容，导出文档',
      reviewer: '审阅者 - 仅可以查看和导出文档',
      viewer: '查看者 - 仅可以查看文档，无法进行任何修改',
    }
    return descriptions[role]
  },

  getPermissionDescription(permission: keyof CollaborationPermissions): string {
    const descriptions: Record<keyof CollaborationPermissions, string> = {
      canEdit: '编辑内容',
      canDelete: '删除内容',
      canInvite: '邀请参与者',
      canRemove: '移除参与者',
      canChangeRole: '更改角色',
      canExport: '导出文档',
    }
    return descriptions[permission]
  },

  canManageParticipants(role: CollaborationRole): boolean {
    return role === 'owner'
  },

  getAvailableActions(role: CollaborationRole): string[] {
    const permissions = COLLABORATION_PERMISSION_MATRIX[role]
    return Object.entries(permissions)
      .filter(([, value]) => value === true)
      .map(([key]) => key)
  },
}

export enum PermissionAction {
  VIEW = 'view',
  EDIT = 'edit',
  DELETE = 'delete',
  SHARE = 'share',
  MANAGE_PERMISSIONS = 'manage_permissions',
  ADMIN = 'admin'
}

// 权限矩阵
const PERMISSION_MATRIX: Record<AccessLevel, PermissionAction[]> = {
  view: [PermissionAction.VIEW],
  edit: [PermissionAction.VIEW, PermissionAction.EDIT, PermissionAction.DELETE],
  admin: [
    PermissionAction.VIEW,
    PermissionAction.EDIT,
    PermissionAction.DELETE,
    PermissionAction.SHARE,
    PermissionAction.MANAGE_PERMISSIONS,
    PermissionAction.ADMIN,
  ],
}

export interface UserPermission {
  userId: string
  accessLevel: AccessLevel
  resourceId: string
  resourceType: string
  createdAt: string
  updatedAt: string
}

export const RBAC = {
  hasPermission(accessLevel: AccessLevel, action: PermissionAction): boolean {
    const permissions = PERMISSION_MATRIX[accessLevel]
    return permissions.includes(action)
  },

  canView(accessLevel: AccessLevel): boolean {
    return this.hasPermission(accessLevel, PermissionAction.VIEW)
  },

  canEdit(accessLevel: AccessLevel): boolean {
    return this.hasPermission(accessLevel, PermissionAction.EDIT)
  },

  canDelete(accessLevel: AccessLevel): boolean {
    return this.hasPermission(accessLevel, PermissionAction.DELETE)
  },

  canShare(accessLevel: AccessLevel): boolean {
    return this.hasPermission(accessLevel, PermissionAction.SHARE)
  },

  canManagePermissions(accessLevel: AccessLevel): boolean {
    return this.hasPermission(accessLevel, PermissionAction.MANAGE_PERMISSIONS)
  },

  isAdmin(accessLevel: AccessLevel): boolean {
    return this.hasPermission(accessLevel, PermissionAction.ADMIN)
  },

  getPermissions(accessLevel: AccessLevel): PermissionAction[] {
    return PERMISSION_MATRIX[accessLevel]
  },

  getPermissionDescription(action: PermissionAction): string {
    const descriptions: Record<PermissionAction, string> = {
      [PermissionAction.VIEW]: '查看内容',
      [PermissionAction.EDIT]: '编辑内容',
      [PermissionAction.DELETE]: '删除内容',
      [PermissionAction.SHARE]: '共享资源',
      [PermissionAction.MANAGE_PERMISSIONS]: '管理权限',
      [PermissionAction.ADMIN]: '管理员权限',
    }
    return descriptions[action] || action
  },

  getAccessLevelDescription(accessLevel: AccessLevel): string {
    const descriptions: Record<AccessLevel, string> = {
      view: '查看权限 - 仅能查看仪表板内容，无修改权限',
      edit: '编辑权限 - 可修改仪表板内容，但不能更改共享设置',
      admin: '管理员权限 - 完全控制仪表板，包括共享设置和权限管理',
    }
    return descriptions[accessLevel] || accessLevel
  },

  /**
   * 检查用户是否是资源的所有者
   */
  isOwner(userId: string, ownerId: string): boolean {
    return userId === ownerId
  },

  /**
   * 检查用户对资源的访问级别
   * @param userId 用户ID
   * @param resourceOwnerId 资源所有者ID
   * @param shares 共享列表
   * @returns 访问级别
   */
  getUserAccessLevel(
    userId: string,
    resourceOwnerId: string,
    shares: { userId: string; accessLevel: AccessLevel }[],
  ): AccessLevel {
    // 所有者默认是管理员
    if (this.isOwner(userId, resourceOwnerId)) {
      return 'admin'
    }

    // 查找用户的共享权限
    const share = shares.find(s => s.userId === userId)
    return share ? share.accessLevel : 'view' // 默认是查看权限
  },

  /**
   * 验证用户对资源的操作权限
   * @param userId 用户ID
   * @param resourceOwnerId 资源所有者ID
   * @param shares 共享列表
   * @param action 要执行的操作
   * @returns 是否有权限
   */
  validatePermission(
    userId: string,
    resourceOwnerId: string,
    shares: { userId: string; accessLevel: AccessLevel }[],
    action: PermissionAction,
  ): boolean {
    const accessLevel = this.getUserAccessLevel(userId, resourceOwnerId, shares)
    return this.hasPermission(accessLevel, action)
  },
}

// 导出 RBAC 对象（作为单例使用）
export const rbac = RBAC
