/**
 * 权限精细化管理组件 - RBAC 权限矩阵 + 角色编辑器
 */
import React, { memo, useState, useCallback } from 'react'
import {
  Shield, ShieldCheck, ShieldOff, Plus, Edit2, Trash2,
  Users, Check, X, ChevronDown, Crown, Eye, Pencil,
  Key, Lock, Unlock, Loader2,
} from 'lucide-react'
import type { Role, PermissionAction } from '@/types/organization.types'

interface PermissionManagerProps {
  organizationId: number
  roles: any[]
  permissions: any[]
  onCreateRole: (data: any) => Promise<any>
  onUpdateRole: (roleId: number, data: any) => Promise<void>
  onDeleteRole: (roleId: number) => Promise<void>
}

const SYSTEM_ROLES = [
  { code: 'owner' as Role, name: 'Owner', description: '组织所有者，拥有全部权限', icon: Crown },
  { code: 'admin' as Role, name: 'Admin', description: '管理员，可管理大部分资源', icon: Shield },
  { code: 'editor' as Role, name: 'Editor', description: '编辑者，可修改内容', icon: Pencil },
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
  organizationId,
  roles = [],
  permissions = [],
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
      <div className="flex items-center gap-1.5 bg-neutral-100 dark:bg-neutral-800 rounded-lg p-1.5">
        <button
          onClick={() => setActiveTab('matrix')}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
            activeTab === 'matrix'
              ? 'bg-white dark:bg-neutral-900 text-primary-700 shadow-sm'
              : 'text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] hover:text-text-primary'
          }`}
        >
          <Shield className="w-4 h-4 mr-1.5" />
          权限矩阵
        </button>
        <button
          onClick={() => setActiveTab('roles')}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
            activeTab === 'roles'
              ? 'bg-white dark:bg-neutral-900 text-primary-700 shadow-sm'
              : 'text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] hover:text-text-primary'
          }`}
        >
          <Users className="w-4 h-4 mr-1.5" />
          角色管理 ({roles.length})
        </button>
      </div>

      {/* 权限矩阵 Tab */}
      {activeTab === 'matrix' && (
        <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px]">
              <thead className="bg-slate-50 dark:bg-neutral-800">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] uppercase w-32">角色</th>
                  {RESOURCE_TYPES.map(resource => (
                    <th key={resource.key} colSpan={resource.actions.length} className="px-3 py-3 text-center text-xs font-semibold text-neutral-500 uppercase border-l border-neutral-200 dark:border-neutral-700">
                      {resource.label}
                    </th>
                  ))}
                </tr>
                <tr className="border-t border-neutral-200 dark:border-neutral-700">
                  <th className="px-4 py-2"></th>
                  {RESOURCE_TYPES.flatMap(resource =>
                    resource.actions.map(action => (
                      <th key={`${resource.key}-${action}`} className="px-2 py-2 text-center text-xs text-neutral-400 border-l border-neutral-200 dark:border-neutral-700 w-10">
                        {action === 'create' ? '➕' : action === 'read' ? '👁' : action === 'update' ? '✏️' : action === 'delete' ? '🗑️' : '⚙️'}
                      </th>
                    )),
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {[...SYSTEM_ROLES, ...roles].map(role => (
                  <tr key={role.code} className="hover:bg-slate-50 dark:hover:bg-neutral-800/50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {role.icon && <role.icon className="w-4 h-4 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" />}
                        <span className="font-medium text-neutral-900 dark:text-white">{role.name}</span>
                      </div>
                    </td>
                    {RESOURCE_TYPES.flatMap(resource =>
                      resource.actions.map(action => {
                        const hasPermission = role.code === 'owner' ||
                          (role.code === 'admin' && !['delete'].includes(action)) ||
                          (role.code === 'editor' && ['read', 'update', 'create'].includes(action)) ||
                          (role.code === 'viewer' && action === 'read')

                        return (
                          <td key={`${resource.key}-${action}`} className="px-2 py-3 text-center border-l border-neutral-100 dark:border-neutral-700">
                            {hasPermission ? (
                              <ShieldCheck className="w-4 h-4 mx-auto text-success-500" />
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
          <div className="px-6 py-4 bg-slate-50 dark:bg-neutral-800/50 border-t border-neutral-200 dark:border-neutral-700 flex items-center gap-6 text-xs text-neutral-500">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-success-500" /> 有权限
            </div>
            <div className="flex items-center gap-1.5">
              <ShieldOff className="w-4 h-4 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" /> 无权限
            </div>
          </div>
        </div>
      )}

      {/* 角色管理 Tab */}
      {activeTab === 'roles' && (
        <div className="space-y-4">
          {/* 系统角色 */}
          <div>
            <h3 className="text-sm font-semibold text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] uppercase tracking-wider mb-3">系统预定义角色</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {SYSTEM_ROLES.map(role => {
                const Icon = role.icon
                return (
                  <div
                    key={role.code}
                    className="bg-white dark:bg-neutral-900 rounded-xl p-4 border border-neutral-200 dark:border-neutral-700 hover:shadow-md transition-shadow"
                  >
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${
                      role.code === 'owner' ? 'bg-yellow-100 dark:bg-yellow-900/30' :
                      role.code === 'admin' ? 'bg-secondary-100 dark:bg-secondary-900/30' :
                      role.code === 'editor' ? 'bg-accent-100 dark:bg-accent-900/30' :
                      'bg-neutral-100 dark:bg-neutral-800'
                    }`}>
                      <Icon className={`w-5 h-5 ${
                        role.code === 'owner' ? 'text-yellow-600' :
                        role.code === 'admin' ? 'text-secondary-600' :
                        role.code === 'editor' ? 'text-accent-600' :
                        'text-neutral-600'
                      }`} />
                    </div>
                    <h4 className="font-semibold text-neutral-900 dark:text-white mb-1">{role.name}</h4>
                    <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] line-clamp-2">{role.description}</p>
                    <div className="mt-3 pt-3 border-t border-neutral-100 dark:border-neutral-700">
                      <span className="text-xs text-primary-700 font-medium cursor-pointer hover:underline">查看详情 →</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* 自定义角色 */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] uppercase tracking-wider">自定义角色</h3>
              <button
                onClick={handleCreateRole}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-container text-primary-main text-sm font-medium rounded-lg hover:bg-primary-container transition-colors"
              >
                <Plus className="w-4 h-4" />
                创建角色
              </button>
            </div>

            {roles.length === 0 ? (
              <div className="bg-slate-50 dark:bg-neutral-800 rounded-xl p-8 text-center">
                <Key className="w-12 h-12 mx-auto text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mb-3" />
                <p className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] text-sm">暂无自定义角色</p>
                <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mt-1">点击上方按钮创建符合业务需求的定制角色</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {roles.map(role => (
                  <div
                    key={role.id || role.code}
                    className="bg-white dark:bg-neutral-900 rounded-xl p-4 border border-neutral-200 dark:border-neutral-700 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center text-white text-sm font-bold">
                        {(role.name || role.code).charAt(0)}
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleEditRole(role)}
                          className="p-1.5 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] hover:text-secondary-600 hover:bg-secondary-50 rounded transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onDeleteRole(role.id || 0)}
                          className="p-1.5 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] hover:text-error-600 hover:bg-error-50 rounded transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <h4 className="font-medium text-neutral-900 dark:text-white truncate">{role.name}</h4>
                    {role.description && (
                      <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mt-1 line-clamp-2">{role.description}</p>
                    )}
                    <div className="mt-3 flex flex-wrap gap-1">
                      {(role.permissions || []).slice(0, 3).map((perm: string, i: number) => (
                        <span key={i} className="px-2 py-0.5 bg-neutral-100 dark:bg-neutral-800 text-xs text-neutral-600 rounded">
                          {perm.split(':')[1] || perm}
                        </span>
                      ))}
                      {(role.permissions || []).length > 3 && (
                        <span className="px-2 py-0.5 bg-neutral-100 dark:bg-neutral-800 text-xs text-neutral-600 rounded">
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
              await onUpdateRole(editingRole.id || 0, data)
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
      <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-700 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">
            {role ? '编辑角色' : '创建新角色'}
          </h3>
          <button onClick={onClose} className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] hover:text-neutral-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-auto p-6 space-y-6">
          {/* 基本信息 */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
                角色名称 <span className="text-error-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="如：内容审核员"
                className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
                描述
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="简要描述此角色的职责和权限范围..."
                rows={3}
                className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 resize-none"
              />
            </div>
          </div>

          {/* 权限配置 */}
          <fieldset>
            <legend className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-3 pb-2 border-b border-neutral-200 dark:border-neutral-700">
              权限配置
            </legend>

            <div className="space-y-4">
              {RESOURCE_TYPES.map(resource => (
                <div key={resource.key} className="border border-neutral-200 dark:border-neutral-700 rounded-lg overflow-hidden">
                  <div className="bg-slate-50 dark:bg-neutral-800 px-4 py-2 border-b border-neutral-200 dark:border-neutral-700">
                    <h4 className="text-sm font-semibold text-neutral-900 dark:text-white capitalize">{resource.label}</h4>
                  </div>
                  <div className="p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                    {resource.actions.map(action => {
                      const permKey = `${resource.key}:${action}`
                      const isChecked = selectedPermissions.includes(permKey)
                      return (
                        <label
                          key={permKey}
                          className={`flex items-center gap-2 cursor-pointer p-2 rounded-lg border transition-all ${
                            isChecked
                              ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                              : 'border-neutral-200 dark:border-neutral-700 hover:border-neutral-300'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => togglePermission(permKey)}
                            className="rounded"
                          />
                          <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300 capitalize">
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

        <div className="px-6 py-4 border-t border-neutral-200 dark:border-neutral-700 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-sm text-neutral-600 hover:text-neutral-800"
          >
            取消
          </button>
          <button
            type="submit"
            form="role-editor-form"
            disabled={isSubmitting || !name.trim()}
            className="px-4 py-2 bg-primary-container text-primary-main text-sm font-medium rounded-lg hover:bg-primary-container disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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
