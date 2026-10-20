/**
 * 团队仪表板共享管理组件
 * - 管理仪表板的共享设置
 * - 邀请团队成员
 * - 设置访问权限
 * - 查看共享状态
 */
import { useState, useEffect } from 'react'
import { Users, Share2, UserPlus, Shield, Edit, Eye, Lock } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent, Button, Input, Select, Badge } from '@/components/ui'
import type { DashboardLayout, AccessLevel } from '@/config/dashboard'
import DashboardConfigManager from '@/config/dashboard'
import { RBAC } from '@/utils/rbac'
import { useAuthStore } from '@/stores/auth'

interface TeamDashboardShareProps {
  dashboard: DashboardLayout
  onUpdate: (dashboard: DashboardLayout) => void
  className?: string
}

export function TeamDashboardShare({ dashboard, onUpdate, className }: TeamDashboardShareProps) {
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false)
  const [newUserEmail, setNewUserEmail] = useState('')
  const [newUserAccess, setNewUserAccess] = useState<AccessLevel>('view')
  const [users, setUsers] = useState<{
    id: string
    name: string
    email: string
    avatar: string
  }[]>([])

  // 获取当前用户信息
  const currentUserId = useAuthStore.getState().user?.id?.toString() || 'current-user'

  // 计算当前用户的访问级别
  const currentUserAccessLevel = RBAC.getUserAccessLevel(
    currentUserId,
    dashboard.ownerId,
    dashboard.shares,
  )

  // 检查权限
  const canShare = RBAC.canShare(currentUserAccessLevel)

  useEffect(() => {
    // 模拟获取团队成员列表
    const mockUsers = [
      { id: 'user1', name: '张三', email: 'zhangsan@example.com', avatar: 'https://ui-avatars.com/api/?name=张三&background=random' },
      { id: 'user2', name: '李四', email: 'lisi@example.com', avatar: 'https://ui-avatars.com/api/?name=李四&background=random' },
      { id: 'user3', name: '王五', email: 'wangwu@example.com', avatar: 'https://ui-avatars.com/api/?name=王五&background=random' },
      { id: 'user4', name: '赵六', email: 'zhaoliu@example.com', avatar: 'https://ui-avatars.com/api/?name=赵六&background=random' },
    ]
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUsers(mockUsers)
  }, [])

  const handleShare = () => {
    if (!newUserEmail) return

    const user = users.find(u => u.email === newUserEmail)
    if (user) {
      DashboardConfigManager.shareDashboard(
        dashboard.id,
        user.id,
        user.email,
        user.name,
        newUserAccess,
      )

      // 刷新仪表板数据
      const updatedDashboard = DashboardConfigManager.getCurrentLayout()
      onUpdate(updatedDashboard)
      setIsShareDialogOpen(false)
      setNewUserEmail('')
      setNewUserAccess('view')
    }
  }

  const getAccessIcon = (accessLevel: AccessLevel) => {
    switch (accessLevel) {
      case 'admin':
        return <Shield size={16} className="text-secondary-600" />
      case 'edit':
        return <Edit size={16} className="text-success-700" />
      case 'view':
        return <Eye size={16} className="text-neutral-600" />
    }
  }

  const getAccessLabel = (accessLevel: AccessLevel) => {
    switch (accessLevel) {
      case 'admin':
        return '管理员'
      case 'edit':
        return '编辑'
      case 'view':
        return '查看'
    }
  }

  const getAccessColor = (accessLevel: AccessLevel) => {
    switch (accessLevel) {
      case 'admin':
        return 'bg-secondary-100 text-secondary-800 dark:bg-secondary-300/20 dark:text-secondary-700'
      case 'edit':
        return 'bg-success-100 text-success-800 dark:bg-success-300/20 dark:text-success-600'
      case 'view':
        return 'bg-neutral-100 text-neutral-800 dark:bg-neutral-800/50 dark:text-neutral-400'
    }
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Users size={20} className="text-secondary-600 dark:text-secondary-700" />
            <CardTitle as="h2" className="text-sm font-semibold">团队共享</CardTitle>
          </div>
          <Badge size="sm">
            {dashboard.isShared ? '已共享' : '未共享'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {/* 所有者信息 */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-8 h-8 rounded-full bg-secondary-100 dark:bg-secondary-900 flex items-center justify-center">
            <span className="text-sm font-medium text-secondary-600 dark:text-secondary-700">
              {dashboard.ownerName.charAt(0)}
            </span>
          </div>
          <div>
            <p className="text-sm font-medium">{dashboard.ownerName}</p>
            <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">所有者</p>
          </div>
          <Badge className="ml-auto bg-secondary-100 text-secondary-800 dark:bg-secondary-300/20 dark:text-secondary-700">
            管理员
          </Badge>
        </div>

        {/* 共享成员列表 */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">共享成员</h4>
              <Badge className="bg-neutral-100 text-neutral-800 dark:bg-neutral-800/50 dark:text-neutral-400">
                您的权限: {RBAC.getAccessLevelDescription(currentUserAccessLevel).split(' - ')[0]}
              </Badge>
            </div>
            {canShare && (
              <Button
                variant="secondary"
                size="sm"
                icon={<UserPlus size={16} />}
                onClick={() => setIsShareDialogOpen(true)}
              >
                邀请成员
              </Button>
            )}
            {!canShare && (
              <div title="您没有邀请成员的权限">
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<Lock size={16} />}
                  disabled
                >
                  邀请成员
                </Button>
              </div>
            )}
          </div>

          {dashboard.shares.length === 0 ? (
            <div className="text-center py-6">
              <Share2 size={48} className="mx-auto text-neutral-300 dark:text-neutral-400 mb-2" />
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                此仪表板尚未共享给其他成员
              </p>
            </div>
          ) : (
            <div className="border rounded-lg">
              {dashboard.shares.map((share) => (
                <div key={share.id} className="py-3 px-4 border-b last:border-b-0">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
                      <span className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
                        {share.userName.charAt(0)}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium truncate">{share.userName}</p>
                        <Badge className={getAccessColor(share.accessLevel)}>
                          <div className="flex items-center gap-1">
                            {getAccessIcon(share.accessLevel)}
                            {getAccessLabel(share.accessLevel)}
                          </div>
                        </Badge>
                      </div>
                      <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] truncate">{share.userEmail}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 共享信息 */}
        {dashboard.isShared && (
          <div className="mt-6 p-3 rounded-lg bg-secondary-50 dark:bg-secondary-300/15 border border-secondary-100 dark:border-secondary-800/30">
            <div className="flex items-start gap-3">
              <Share2 size={18} className="text-secondary-600 dark:text-secondary-700 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-medium text-secondary-800 dark:text-secondary-700 mb-1">共享信息</h4>
                <ul className="text-xs text-secondary-600 dark:text-secondary-700 space-y-1">
                  <li>• 此仪表板已共享给 {dashboard.shares.length} 位成员</li>
                  <li>• 最后更新: {new Date(dashboard.lastModifiedAt).toLocaleString()}</li>
                  <li>• 由 {dashboard.lastModifiedBy} 修改</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* 邀请成员对话框 */}
        {isShareDialogOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-neutral-800 rounded-lg p-6 max-w-md w-full">
              <h3 className="text-lg font-medium mb-4">邀请团队成员</h3>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">成员邮箱</label>
                  <Input
                    placeholder="输入成员邮箱"
                    value={newUserEmail}
                    onChange={(e) => setNewUserEmail(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">访问权限</label>
                  <Select
                    value={newUserAccess}
                    onChange={(v) => setNewUserAccess(v as AccessLevel)}
                  >
                    <option value="view">查看 - 仅能查看仪表板内容</option>
                    <option value="edit">编辑 - 可修改仪表板内容</option>
                    <option value="admin">管理员 - 完全控制仪表板</option>
                  </Select>
                </div>
              </div>
              <div className="flex gap-2 mt-6 justify-end">
                <Button variant="secondary" onClick={() => setIsShareDialogOpen(false)}>
                  取消
                </Button>
                <Button variant="primary" onClick={handleShare} disabled={!newUserEmail}>
                  邀请
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
