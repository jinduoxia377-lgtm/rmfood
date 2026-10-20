/**
 * 权限精细化管理组件 - RBAC 权限矩阵 + 角色编辑器
 */
import React, { memo, useState, useCallback } from 'react'
import {
  Shield, ShieldCheck, ShieldOff, Plus, Edit2, Trash2,
  Users, X, Crown, Eye, Pencil, UserCheck, Settings,
  Key, Loader2,
} from 'lucide-react'
import type { Role, PermissionAction } from '@/types/organization.types'

interface PermissionManagerProps {
  organizationId: number
  roles: any[]
  permissions: any[]
  onCreateRole: (data: any) => Promise<any>
  onUpdateRole: (roleId: string | number, data: any) => Promise<void>
  onDeleteRole: (roleId: string | number) => Promise<void>
}

const SYSTEM_ROLES = [
  { code: 'owner' as Role, name: 'Owner', description: '组织所有者，拥有全部权限', icon: Crown },
  { code: 'admin' as Role, name: 'Admin', description: '管理员，可管理大部分资源', icon: Shield },
  { code: 'member' as Role, name: '成员', description: '标准成员权限，可参与协作', icon: UserCheck },
  { code: 'viewer' as Role, name: 'Viewer', description: '查看者，只读权限', icon: Eye },
]

const RESOURCE_TYPES = [
  { key: 'organization', label: '组织', actions: ['create', 'read', 'update', 'delete', 'admin'] as PermissionAction[] },
  { key: 'team', label: '团队', actions: ['create', 'read', 'update', 'delete', 'admin'] },
  { key: 'formula', label: '配方', actions: ['create', 'read', 'update', 'delete'] },
  { key: 'experiment', label: '实验', actions: ['create', 'read', 'update', 'delete'] },
  { key: 'data', label: '数据', actions: ['create', 'read', 'update', 'delete'] },
  { key: 'setting', label: '设置', actions: ['read', 'update'] },
]

export const PermissionManager: React.FC<PermissionManagerProps> = memo(({
  roles = [],
  onCreateRole,
  onUpdateRole,
  onDeleteRole,
}) => {
  const [activeTab, setActiveTab] = useState<'matrix' | 'roles'>('matrix')
  const [showRoleEditor, setShowRoleEditor] = useState(false)
  const [editingRole, setEditingRole] = useState<any | null>(null)

  const handleCreateRole = useCallback(() => {
    setEditingRole(null)
    setShowRoleEditor(true)
  }, [])

  const handleEditRole = useCallback((role: any) => {
    setEditingRole(role)
    setShowRoleEditor(true)
  }, [])

  return (
    <div className="space-y-8">
      {/* Tab 导航 */}
      <div className="flex items-center gap-1.5 bg-[var(--bg-tertiary)] rounded-[var(--radius-Apple-sm)] p-1.5">
        <button
          onClick={() => setActiveTab('matrix')}
          className={`px-[var(--space-apple-md)] py-2 text-sm font-medium rounded-[var(--radius-Apple-sm)] transition-all ${
            activeTab === 'matrix'
              ? 'bg-[var(--bg-secondary)] text-[var(--color-primary-text)] shadow-sm'
              : 'text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          <Shield className="w-4 h-4 mr-1.5" />
          权限矩阵
        </button>
        <button
          onClick={() => setActiveTab('roles')}
          className={`px-[var(--space-apple-md)] py-2 text-sm font-medium rounded-[var(--radius-Apple-sm)] transition-all ${
            activeTab === 'roles'
              ? 'bg-[var(--bg-secondary)] text-[var(--color-primary-text)] shadow-sm'
              : 'text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          <Users className="w-4 h-4 mr-1.5" />
          角色管理 ({roles.length})
        </button>
      </div>

      {/* 权限矩阵 Tab */}
      {activeTab === 'matrix' && (
        <div className="bg-[var(--bg-secondary)] rounded-[var(--radius-Apple-md)] border border-[var(--border-color)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px]">
              <thead className="bg-[var(--bg-tertiary)]">
                <tr>
                  <th className="px-[var(--space-apple-md)] py-[var(--space-apple-md)] text-left text-xs font-semibold text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] uppercase w-32">角色</th>
                  {RESOURCE_TYPES.map(resource => (
                    <th key={resource.key} colSpan={resource.actions.length} className="px-[var(--space-apple-sm)] py-[var(--space-apple-md)] text-center text-xs font-semibold text-[var(--text-muted)] uppercase border-l border-[var(--border-color)]">
                      {resource.label}
                    </th>
                  ))}
                </tr>
                <tr className="border-t border-[var(--border-color)]">
                  <th className="px-[var(--space-apple-md)] py-2"></th>
                  {RESOURCE_TYPES.flatMap(resource =>
                    resource.actions.map(action => (
                      <th key={`${resource.key}-${action}`} className="px-2 py-2 text-center text-xs text-[var(--text-muted)] border-l border-[var(--border-color)] w-10">
                        {action === 'create' ? <Plus className="w-3.5 h-3.5 inline" aria-label="创建" /> : action === 'read' ? <Eye className="w-3.5 h-3.5 inline" aria-label="查看" /> : action === 'update' ? <Pencil className="w-3.5 h-3.5 inline" aria-label="更新" /> : action === 'delete' ? <Trash2 className="w-3.5 h-3.5 inline" aria-label="删除" /> : <Settings className="w-3.5 h-3.5 inline" aria-label="管理" />}
                      </th>
                    )),
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                {[...SYSTEM_ROLES, ...roles].map(role => (
                  <tr key={role.code} className="hover:bg-[var(--bg-tertiary)] dark:hover:bg-[var(--bg-tertiary)]/50">
                    <td className="px-[var(--space-apple-md)] py-[var(--space-apple-md)]">
                      <div className="flex items-center gap-2">
                        {role.icon && <role.icon className="w-4 h-4 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" />}
                        <span className="font-medium text-[var(--text-primary)]">{role.name}</span>
                      </div>
                    </td>
                    {RESOURCE_TYPES.flatMap(resource =>
                      resource.actions.map(action => {
                        const hasPermission = role.code === 'owner' ||
                          (role.code === 'admin' && !['delete'].includes(action)) ||
                          (role.code === 'member' && ['read', 'update', 'create'].includes(action)) ||
                          (role.code === 'viewer' && action === 'read')

                        return (
                          <td key={`${resource.key}-${action}`} className="px-2 py-[var(--space-apple-md)] text-center border-l border-[var(--border-color)] dark:border-neutral-700">
                            {hasPermission ? (
                              <ShieldCheck className="w-4 h-4 mx-auto text-[var(--color-success-text)]0" />
                            ) : (
                              <ShieldOff className="w-4 h-4 mx-auto text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" />
                            )}
                          </td>
                        )
                      }),
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 图例 */}
          <div className="px-6 py-4 bg-[var(--bg-tertiary)]/50 border-t border-[var(--border-color)] flex items-center gap-6 text-xs text-[var(--text-muted)]">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-[var(--color-success-text)]0" /> 有权限
            </div>
            <div className="flex items-center gap-1.5">
              <ShieldOff className="w-4 h-4 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" /> 无权限
            </div>
          </div>
        </div>
      )}

      {/* 角色管理 Tab */}
      {activeTab === 'roles' && (
        <div className="space-y-[var(--space-apple-md)]">
          {/* 系统角色 */}
          <div>
            <h3 className="text-sm font-semibold text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] uppercase tracking-wider mb-[var(--space-apple-sm)]">系统预定义角色</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {SYSTEM_ROLES.map(role => {
                const Icon = role.icon
                return (
                  <div
                    key={role.code}
                    className="bg-[var(--bg-secondary)] rounded-[var(--radius-Apple-md)] p-[var(--space-apple-md)] border border-[var(--border-color)] hover:shadow-md transition-shadow"
                  >
                    <div className={`w-10 h-10 rounded-[var(--radius-Apple-sm)] flex items-center justify-center mb-[var(--space-apple-sm)] ${
                      role.code === 'owner' ? 'bg-[var(--color-warning-container)] dark:bg-[var(--color-warning-container)]/25' :
                      role.code === 'admin' ? 'bg-[var(--color-secondary-container)] dark:bg-[var(--color-secondary-container)]/25' :
                      role.code === 'member' ? 'bg-[var(--color-accent-container)] dark:bg-[var(--color-accent-container)]/25' :
                      'bg-[var(--bg-tertiary)]'
                    }`}>
                      <Icon className={`w-5 h-5 ${
                        role.code === 'owner' ? 'text-[var(--color-warning-text)]' :
                        role.code === 'admin' ? 'text-[var(--color-secondary-text)]' :
                        role.code === 'member' ? 'text-[var(--color-accent-text)]' :
                        'text-[var(--text-secondary)]'
                      }`} />
                    </div>
                    <h4 className="font-semibold text-[var(--text-primary)] mb-1">{role.name}</h4>
                    <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] line-clamp-2">{role.description}</p>
                    <div className="mt-[var(--space-apple-sm)] pt-3 border-t border-[var(--border-color)] dark:border-neutral-700">
                      <span className="text-xs text-[var(--color-primary-text)] font-medium cursor-pointer hover:underline">查看详情 →</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* 自定义角色 */}
          <div>
            <div className="flex items-center justify-between mb-[var(--space-apple-sm)]">
              <h3 className="text-sm font-semibold text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] uppercase tracking-wider">自定义角色</h3>
              <button
                onClick={handleCreateRole}
                className="flex items-center gap-1.5 px-[var(--space-apple-sm)] py-1.5 bg-primary-container text-[var(--color-primary)] text-sm font-medium rounded-[var(--radius-Apple-sm)] hover:bg-primary-container transition-colors"
              >
                <Plus className="w-4 h-4" />
                创建角色
              </button>
            </div>

            {roles.length === 0 ? (
              <div className="bg-[var(--bg-tertiary)] rounded-[var(--radius-Apple-md)] p-8 text-center">
                <Key className="w-12 h-12 mx-auto text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mb-[var(--space-apple-sm)]" />
                <p className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] text-sm">暂无自定义角色</p>
                <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mt-1">点击上方按钮创建符合业务需求的定制角色</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {roles.map(role => (
                  <div
                    key={role.id || role.code}
                    className="bg-[var(--bg-secondary)] rounded-[var(--radius-Apple-md)] p-[var(--space-apple-md)] border border-[var(--border-color)] hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="w-8 h-8 bg-gradient-to-br from-[var(--color-accent-surface)] to-[var(--color-accent-surface-deep)] rounded-[var(--radius-Apple-sm)] flex items-center justify-center text-white text-sm font-bold">
                        {(role.name || role.code).charAt(0)}
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleEditRole(role)}
                          className="p-1.5 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] hover:text-[var(--color-secondary-text)] hover:bg-[var(--color-secondary-container)] rounded transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onDeleteRole(role.id ?? role.code)}
                          className="p-1.5 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] hover:text-[var(--color-error-text)] hover:bg-[var(--color-error-container)] rounded transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <h4 className="font-medium text-[var(--text-primary)] truncate">{role.name}</h4>
                    {role.description && (
                      <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mt-1 line-clamp-2">{role.description}</p>
                    )}
                    <div className="mt-[var(--space-apple-sm)] flex flex-wrap gap-1">
                      {(role.permissions || []).slice(0, 3).map((perm: string, i: number) => (
                        <span key={i} className="px-2 py-0.5 bg-[var(--bg-tertiary)] text-xs text-[var(--text-secondary)] rounded">
                          {perm.split(':')[1] || perm}
                        </span>
                      ))}
                      {(role.permissions || []).length > 3 && (
                        <span className="px-2 py-0.5 bg-[var(--bg-tertiary)] text-xs text-[var(--text-secondary)] rounded">
                          +{(role.permissions.length - 3)}...
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 角色编辑器 Modal */}
      {showRoleEditor && (
        <RoleEditorModal
          role={editingRole}
          onClose={() => setShowRoleEditor(false)}
          onSave={async (data) => {
            if (editingRole) {
              await onUpdateRole(editingRole.id ?? editingRole.code, data)
            } else {
              await onCreateRole(data)
            }
            setShowRoleEditor(false)
          }}
        />
      )}
    </div>
  )
})

// 角色编辑器 Modal
const RoleEditorModal: React.FC<{
  role: any | null
  onClose: () => void
  onSave: (data: any) => void
}> = ({ role, onClose, onSave }) => {
  const [name, setName] = useState(role?.name || '')
  const [description, setDescription] = useState(role?.description || '')
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>(role?.permissions || [])
  const [isSubmitting, setIsSubmitting] = useState(false)

  const togglePermission = (perm: string) => {
    setSelectedPermissions(prev =>
      prev.includes(perm) ? prev.filter(p => p !== perm) : [...prev, perm],
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      await onSave({ name, description, permissions: selectedPermissions })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-[var(--bg-secondary)] rounded-[var(--radius-Apple-md)] shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-[var(--border-color)] flex items-center justify-between">
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">
            {role ? '编辑角色' : '创建新角色'}
          </h3>
          <button onClick={onClose} className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] hover:text-[var(--text-secondary)]">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form id="role-editor-form" onSubmit={handleSubmit} className="flex-1 overflow-auto p-[var(--space-apple-lg)] space-y-6">
          {/* 基本信息 */}
          <div className="space-y-[var(--space-apple-md)]">
            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">
                角色名称 <span className="text-[var(--color-error-text)]0">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="如：内容审核员"
                className="w-full px-[var(--space-apple-sm)] py-2 border border-[var(--border-color)] rounded-[var(--radius-Apple-sm)] bg-[var(--bg-secondary)] text-neutral-900 focus:ring-2 focus:ring-[var(--color-primary)]"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">
                描述
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="简要描述此角色的职责和权限范围..."
                rows={3}
                className="w-full px-[var(--space-apple-sm)] py-2 border border-[var(--border-color)] rounded-[var(--radius-Apple-sm)] bg-[var(--bg-secondary)] text-neutral-900 resize-none"
              />
            </div>
          </div>

          {/* 权限配置 */}
          <fieldset>
            <legend className="text-sm font-medium text-[var(--text-primary)] mb-[var(--space-apple-sm)] pb-2 border-b border-[var(--border-color)]">
              权限配置
            </legend>

            <div className="space-y-[var(--space-apple-md)]">
              {RESOURCE_TYPES.map(resource => (
                <div key={resource.key} className="border border-[var(--border-color)] rounded-[var(--radius-Apple-sm)] overflow-hidden">
                  <div className="bg-[var(--bg-tertiary)] px-[var(--space-apple-md)] py-2 border-b border-[var(--border-color)]">
                    <h4 className="text-sm font-semibold text-[var(--text-primary)] capitalize">{resource.label}</h4>
                  </div>
                  <div className="p-[var(--space-apple-md)] grid grid-cols-1 sm:grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-[var(--space-apple-sm)]">
                    {resource.actions.map(action => {
                      const permKey = `${resource.key}:${action}`
                      const isChecked = selectedPermissions.includes(permKey)
                      return (
                        <label
                          key={permKey}
                          className={`flex items-center gap-2 cursor-pointer p-2 rounded-[var(--radius-Apple-sm)] border transition-all ${
                            isChecked
                              ? 'border-[var(--color-primary)] bg-[var(--color-primary-container)]'
                              : 'border-[var(--border-color)] hover:border-[var(--border-color)]'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => togglePermission(permKey)}
                            className="rounded"
                          />
                          <span className="text-xs font-medium text-[var(--text-primary)] capitalize">
                            {action === 'create' ? '创建' : action === 'read' ? '查看' : action === 'update' ? '编辑' : action === 'delete' ? '删除' : '管理'}
                          </span>
                        </label>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </fieldset>
        </form>

        <div className="px-6 py-4 border-t border-[var(--border-color)] flex items-center justify-end gap-[var(--space-apple-sm)]">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-[var(--space-apple-md)] py-2 text-sm text-[var(--text-secondary)] hover:text-neutral-800"
          >
            取消
          </button>
          <button
            type="submit"
            form="role-editor-form"
            disabled={isSubmitting || !name.trim()}
            className="px-[var(--space-apple-md)] py-2 bg-primary-container text-[var(--color-primary)] text-sm font-medium rounded-[var(--radius-Apple-sm)] hover:bg-primary-container disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {role ? '保存更改' : '创建角色'}
          </button>
        </div>
      </div>
    </div>
  )
}

PermissionManager.displayName = 'PermissionManager'
export default PermissionManager
