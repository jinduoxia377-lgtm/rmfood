import { useState, useMemo, useCallback, memo } from 'react'
import {
  Plus,
  Pencil,
  Trash2,
  ChevronRight,
  ChevronDown,
  FolderOpen,
  Folder,
  Users,
  Loader2,
  X,
  Check,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import type { Member, Team, Role } from '@/hooks/useOrganizationDetail'

interface TeamsTabProps {
  organizationId: number
  members: Member[]
  teams: Team[]
  memberCount: number
  teamCount: number
  organization: any
  onInvite?: (email: string, role?: Role) => Promise<void>
  onRemoveMember?: (memberId: number) => Promise<void>
  onUpdateRole?: (memberId: number, role: Role) => Promise<void>
  onCreateTeam?: (data: Partial<Team>) => Promise<Team>
  onUpdateTeam?: (teamId: number, data: Partial<Team>) => Promise<void>
  onDeleteTeam?: (teamId: number) => Promise<void>
  onRefresh?: () => void
}

function getMemberById(members: Member[], memberId: number): Member | undefined {
  return members.find((m) => m.userId === memberId)
}

function MiniAvatar({ name, size = 24 }: { name: string; size?: number }) {
  return (
    <div
      className={cn(
        'rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-xs font-medium border-2 border-white dark:border-slate-800 shrink-0 -ml-1 first:ml-0',
      )}
      style={{ width: size, height: size }}
      title={name}
    >
      {name?.charAt(0)?.toUpperCase()}
    </div>
  )
}

interface TeamTreeNodeProps {
  team: Team
  allTeams: Team[]
  members: Member[]
  depth: number
  expandedTeams: Set<number>
  selectedTeamId: number | null
  onToggleExpand: (id: number) => void
  onSelectTeam: (id: number | null) => void
  onEdit: (team: Team) => void
  onDelete: (team: Team) => void
  onCreateChild: (parentId: number) => void
}

const TeamTreeNode = memo(function TeamTreeNode({
  team,
  allTeams,
  members,
  depth,
  expandedTeams,
  selectedTeamId,
  onToggleExpand,
  onSelectTeam,
  onEdit,
  onDelete,
  onCreateChild,
}: TeamTreeNodeProps) {
  const children = useMemo(
    () => allTeams.filter((t) => t.id === team.id ? false : t.slug.startsWith(team.slug + '-') || allTeams.some(parent => parent.id === team.id && t.name.includes(team.name))),
    [allTeams, team],
  )

  const childTeams = useMemo(() => allTeams.filter(t => t.slug.startsWith(team.slug + '/')), [allTeams, team.slug])
  const isExpanded = expandedTeams.has(team.id)
  const isSelected = selectedTeamId === team.id
  const hasChildren = childTeams.length > 0
  const teamMembers = team.memberIds.map((id) => getMemberById(members, id)).filter(Boolean) as Member[]

  return (
    <div role="treeitem" aria-expanded={hasChildren ? isExpanded : undefined}>
      <div
        className={cn(
          'flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer transition-all group',
          isSelected
            ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800'
            : 'hover:bg-slate-50 dark:hover:bg-slate-700/30 border border-transparent',
          depth > 0 && 'ml-6',
        )}
        style={{ paddingLeft: `${depth * 24 + 12}px` }}
        onClick={() => onSelectTeam(isSelected ? null : team.id)}
      >
        {/* Expand/Collapse Toggle */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            if (hasChildren) onToggleExpand(team.id)
          }}
          className={cn(
            'w-5 h-5 flex items-center justify-center rounded transition-colors shrink-0',
            hasChildren ? 'text-slate-400 hover:text-slate-600' : 'invisible',
          )}
          aria-label={isExpanded ? '收起' : '展开'}
        >
          {hasChildren ? (
            isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />
          ) : (
            <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-600" />
          )}
        </button>

        {/* Icon */}
        {isExpanded || !hasChildren ? (
          <FolderOpen className="w-4.5 h-4.5 text-blue-500 shrink-0" />
        ) : (
          <Folder className="w-4.5 h-4.5 text-slate-400 shrink-0" />
        )}

        {/* Name */}
        <span className="flex-1 font-medium text-sm text-slate-900 dark:text-white truncate min-w-0">
          {team.name}
        </span>

        {/* Member Count & Avatars */}
        <div className="flex items-center gap-2 shrink-0">
          {teamMembers.length > 0 && (
            <div className="flex items-center">
              {teamMembers.slice(0, 4).map((m) => (
                <MiniAvatar key={m.userId} name={m.displayName} size={22} />
              ))}
              {teamMembers.length > 4 && (
                <span className="ml-1 text-xs text-slate-400 w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center -ml-1 border-2 border-white dark:border-slate-800">
                  +{teamMembers.length - 4}
                </span>
              )}
            </div>
          )}
          <span className="inline-flex items-center gap-1 text-xs text-slate-400">
            <Users className="w-3.5 h-3.5" />
            {team.memberIds.length}
          </span>

          {/* Action Buttons */}
          <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition-opacity">
            <button
              onClick={(e) => { e.stopPropagation(); onCreateChild(team.id) }}
              className="p-1 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20"
              title="添加子团队"
              aria-label={`在 ${team.name} 下创建子团队`}
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(team) }}
              className="p-1 rounded text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
              title="编辑团队"
              aria-label={`编辑 ${team.name}`}
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(team) }}
              className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
              title="删除团队"
              aria-label={`删除 ${team.name}`}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Children */}
      {hasChildren && isExpanded && (
        <div role="group">
          {childTeams.map((child) => (
            <TeamTreeNode
              key={child.id}
              team={child}
              allTeams={allTeams}
              members={members}
              depth={depth + 1}
              expandedTeams={expandedTeams}
              selectedTeamId={selectedTeamId}
              onToggleExpand={onToggleExpand}
              onSelectTeam={onSelectTeam}
              onEdit={onEdit}
              onDelete={onDelete}
              onCreateChild={onCreateChild}
            />
          ))}
        </div>
      )}
    </div>
  )
})

const TeamsTab = memo(({ teams, members, onCreateTeam, onUpdateTeam, onDeleteTeam }: TeamsTabProps) => {
  const toast = useToast()
  const [expandedTeams, setExpandedTeams] = useState<Set<number>>(new Set())
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null)

  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [parentTeamId, setParentTeamId] = useState<number | null>(null)
  const [editingTeam, setEditingTeam] = useState<Team | null>(null)
  const [deletingTeam, setDeletingTeam] = useState<Team | null>(null)

  const [formName, setFormName] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const rootTeams = useMemo(() => teams.filter((t) => !t.slug.includes('/')), [teams])

  const selectedTeamMembers = useMemo(() => {
    if (!selectedTeamId) return []
    const team = teams.find((t) => t.id === selectedTeamId)
    if (!team) return []
    return team.memberIds.map((id) => getMemberById(members, id)).filter(Boolean) as Member[]
  }, [selectedTeamId, teams, members])

  const toggleExpand = useCallback((id: number) => {
    setExpandedTeams((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const handleCreate = useCallback(async () => {
    if (!formName.trim()) {
      toast.warning('请输入团队名称')
      return
    }
    setSubmitting(true)
    try {
      await onCreateTeam?.({
        name: formName.trim(),
        description: formDescription.trim() || undefined,
      })
      toast.success('团队创建成功')
      setShowCreateModal(false)
      setFormName('')
      setFormDescription('')
      setParentTeamId(null)
    } catch (err: any) {
      toast.error(err.message || '创建失败')
    } finally {
      setSubmitting(false)
    }
  }, [formName, formDescription, onCreateTeam, toast])

  const handleUpdate = useCallback(async () => {
    if (!editingTeam || !formName.trim()) return
    setSubmitting(true)
    try {
      await onUpdateTeam?.(editingTeam.id, {
        name: formName.trim(),
        description: formDescription.trim() || undefined,
      })
      toast.success('团队信息已更新')
      setShowEditModal(false)
      setEditingTeam(null)
      setFormName('')
      setFormDescription('')
    } catch (err: any) {
      toast.error(err.message || '更新失败')
    } finally {
      setSubmitting(false)
    }
  }, [editingTeam, formName, formDescription, onUpdateTeam, toast])

  const handleDelete = useCallback(async () => {
    if (!deletingTeam) return
    setSubmitting(true)
    try {
      await onDeleteTeam?.(deletingTeam.id)
      toast.success(`团队 "${deletingTeam.name}" 已删除`)
      setShowDeleteModal(false)
      setDeletingTeam(null)
      if (selectedTeamId === deletingTeam.id) setSelectedTeamId(null)
    } catch (err: any) {
      toast.error(err.message || '删除失败')
    } finally {
      setSubmitting(false)
    }
  }, [deletingTeam, onDeleteTeam, toast, selectedTeamId])

  const openCreateModal = useCallback((parentId?: number | null) => {
    setParentTeamId(parentId ?? null)
    setFormName('')
    setFormDescription('')
    setShowCreateModal(true)
  }, [])

  const openEditModal = useCallback((team: Team) => {
    setEditingTeam(team)
    setFormName(team.name)
    setFormDescription(team.description || '')
    setShowEditModal(true)
  }, [])

  const openDeleteModal = useCallback((team: Team) => {
    setDeletingTeam(team)
    setShowDeleteModal(true)
  }, [])

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">团队管理</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">共 {teamCount} 个团队</p>
        </div>
        <button
          onClick={() => openCreateModal(null)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium shadow-sm shadow-blue-500/25"
        >
          <Plus className="w-4 h-4" />
          创建团队
        </button>
      </div>

      {/* Main Layout: Tree + Detail Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Tree View */}
        <div className="lg:col-span-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4" role="tree" aria-label="团队树形结构">
          {rootTeams.length === 0 ? (
            <div className="py-12 text-center">
              <Folder className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
              <p className="text-slate-500 dark:text-slate-400 font-medium">暂无团队</p>
              <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">点击上方按钮创建第一个团队</p>
            </div>
          ) : (
            <div className="space-y-0.5">
              {rootTeams.map((team) => (
                <TeamTreeNode
                  key={team.id}
                  team={team}
                  allTeams={teams}
                  members={members}
                  depth={0}
                  expandedTeams={expandedTeams}
                  selectedTeamId={selectedTeamId}
                  onToggleExpand={toggleExpand}
                  onSelectTeam={setSelectedTeamId}
                  onEdit={openEditModal}
                  onDelete={openDeleteModal}
                  onCreateChild={openCreateModal}
                />
              ))}
            </div>
          )}
        </div>

        {/* Detail Panel */}
        <div className="lg:col-span-2 space-y-4">
          {/* Selected Team Info */}
          {selectedTeamId ? (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 animate-fade-in">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-slate-900 dark:text-white">
                    {teams.find((t) => t.id === selectedTeamId)?.name}
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                    {teams.find((t) => t.id === selectedTeamId)?.description || '暂无描述'}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedTeamId(null)}
                  className="p-1 rounded text-slate-400 hover:text-slate-600"
                  aria-label="关闭详情面板"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Members in Team */}
              <div>
                <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                  团队成员 ({selectedTeamMembers.length})
                </h4>
                {selectedTeamMembers.length > 0 ? (
                  <div className="grid grid-cols-2 gap-2">
                    {selectedTeamMembers.map((m) => (
                      <div
                        key={m.userId}
                        className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-700/50"
                      >
                        <MiniAvatar name={m.displayName} size={28} />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{m.displayName}</p>
                          <p className="text-xs text-slate-400 truncate">{m.email}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-400 dark:text-slate-500 py-4 text-center">
                    该团队暂无成员
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-8 text-center">
              <Users className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
              <p className="text-sm text-slate-500 dark:text-slate-400">选择一个团队查看详情</p>
            </div>
          )}
        </div>
      </div>

      {/* Create Modal */}
      <Modal
        open={showCreateModal}
        onClose={() => { setShowCreateModal(false); setFormName('') }}
        title={parentTeamId ? '创建子团队' : '创建新团队'}
        size="md"
      >
        <div className="space-y-4">
          <div>
            <label htmlFor="team-name" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              团队名称 <span className="text-red-500">*</span>
            </label>
            <input
              id="team-name"
              type="text"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="例如：研发部"
              className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              autoFocus
            />
          </div>
          <div>
            <label htmlFor="team-desc" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              描述（可选）
            </label>
            <textarea
              id="team-desc"
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              placeholder="简要描述团队的职责..."
              rows={3}
              className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => { setShowCreateModal(false); setFormName('') }}
              className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleCreate}
              disabled={submitting || !formName.trim()}
              className={cn(
                'inline-flex items-center gap-2 px-4 py-2 text-sm rounded-lg transition-colors',
                submitting || !formName.trim()
                  ? 'bg-slate-200 dark:bg-slate-700 text-slate-400 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700',
              )}
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              创建
            </button>
          </div>
        </div>
      </Modal>

      {/* Edit Modal */}
      <Modal
        open={showEditModal}
        onClose={() => { setShowEditModal(false); setEditingTeam(null) }}
        title="编辑团队"
        size="md"
      >
        <div className="space-y-4">
          <div>
            <label htmlFor="edit-team-name" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              团队名称 <span className="text-red-500">*</span>
            </label>
            <input
              id="edit-team-name"
              type="text"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              autoFocus
            />
          </div>
          <div>
            <label htmlFor="edit-team-desc" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              描述（可选）
            </label>
            <textarea
              id="edit-team-desc"
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => { setShowEditModal(false); setEditingTeam(null) }}
              className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleUpdate}
              disabled={submitting || !formName.trim()}
              className={cn(
                'inline-flex items-center gap-2 px-4 py-2 text-sm rounded-lg transition-colors',
                submitting || !formName.trim()
                  ? 'bg-slate-200 dark:bg-slate-700 text-slate-400 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700',
              )}
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              保存更改
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        open={showDeleteModal}
        onClose={() => { setShowDeleteModal(false); setDeletingTeam(null) }}
        title="删除团队"
        size="sm"
      >
        <div className="space-y-4">
          <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3">
            <p className="text-sm text-red-800 dark:text-red-200">
              确定要删除团队 <strong>"{deletingTeam?.name}"</strong> 吗？此操作不可撤销。
            </p>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => { setShowDeleteModal(false); setDeletingTeam(null) }}
              className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleDelete}
              disabled={submitting}
              className={cn(
                'px-4 py-2 text-sm rounded-lg transition-colors',
                submitting
                  ? 'bg-slate-200 dark:bg-slate-700 text-slate-400 cursor-not-allowed'
                  : 'bg-red-600 text-white hover:bg-red-700',
              )}
            >
              {submitting ? <Loader2 className="w-4 h-4 inline animate-spin mr-1" /> : null}
              确认删除
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
})

export default TeamsTab
