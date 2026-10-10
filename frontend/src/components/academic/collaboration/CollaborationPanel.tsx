import { useEffect, useState } from 'react';
import { useCollaborationStore } from '@/stores/collaborationStore';
import type { CollaborationRole } from '@/utils/rbac';
import {
  Users,
  Wifi,
  WifiOff,
  AlertTriangle,
  Check,
  RefreshCw,
  Edit3,
  Trash2,
  UserPlus,
  UserMinus,
  Settings,
  Download,
  Crown,
  Eye,
  EyeOff,
} from 'lucide-react';

interface ParticipantDisplay {
  userId: string;
  name: string;
  color: string;
  joinedAt: string;
  role: CollaborationRole;
  isOnline: boolean;
  isCurrentUser?: boolean;
}

interface PermissionBadgeProps {
  permission: string;
  hasPermission: boolean;
}

function PermissionBadge({ permission, hasPermission }: PermissionBadgeProps) {
  const icons: Record<string, typeof Edit3> = {
    canEdit: Edit3,
    canDelete: Trash2,
    canInvite: UserPlus,
    canRemove: UserMinus,
    canChangeRole: Settings,
    canExport: Download,
  };

  const labels: Record<string, string> = {
    canEdit: '编辑',
    canDelete: '删除',
    canInvite: '邀请',
    canRemove: '移除',
    canChangeRole: '改角色',
    canExport: '导出',
  };

  const Icon = icons[permission];
  const label = labels[permission];

  if (!Icon || !label) return null;

  return (
    <div
      className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs ${
        hasPermission
          ? 'bg-success-100 text-success-700 dark:bg-success-300/25 dark:text-success-600'
          : 'bg-neutral-100 text-neutral-400 dark:bg-neutral-700 dark:text-neutral-400'
      }`}
    >
      <Icon size={12} />
      <span>{label}</span>
    </div>
  );
}

function RoleBadge({ role }: { role: CollaborationRole }) {
  const config: Record<CollaborationRole, { icon: typeof Crown; label: string; className: string }> = {
    owner: { icon: Crown, label: '所有者', className: 'bg-accent-100 text-accent-700 dark:bg-accent-300/25 dark:text-accent-700' },
    editor: { icon: Edit3, label: '编辑者', className: 'bg-secondary-100 text-secondary-700 dark:bg-secondary-300/25 dark:text-secondary-700' },
    reviewer: { icon: Eye, label: '审阅者', className: 'bg-warning-100 text-warning-700 dark:bg-warning-300/25 dark:text-warning-700' },
    viewer: { icon: EyeOff, label: '查看者', className: 'bg-neutral-100 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-400' },
  };

  const { icon: Icon, label, className } = config[role];

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${className}`}>
      <Icon size={12} />
      {label}
    </span>
  );
}

function ConflictWarning({ conflicts, onResolve }: { conflicts: any[]; onResolve: (id: string, resolution: string) => void }) {
  if (conflicts.length === 0) return null;

  return (
    <div className="p-3 bg-warning-50 dark:bg-warning-300/20 border border-warning-200 dark:border-warning-800 rounded-lg">
      <div className="flex items-center gap-2 mb-2">
        <AlertTriangle className="w-4 h-4 text-warning-600" />
        <span className="text-sm font-medium text-warning-800 dark:text-warning-200">
          检测到 {conflicts.length} 个冲突
        </span>
      </div>
      <div className="space-y-2">
        {conflicts.slice(0, 3).map((conflict) => (
          <div key={conflict.id} className="text-xs bg-white dark:bg-warning-300/25 p-2 rounded">
            <div className="flex items-center justify-between">
              <span className="text-warning-700 dark:text-warning-700">
                冲突类型: {conflict.type}
              </span>
              <div className="flex gap-1">
                <button
                  onClick={() => onResolve(conflict.id, 'keep-local')}
                  className="px-2 py-0.5 bg-secondary-100 text-secondary-700 rounded hover:bg-secondary-200"
                >
                  保留本地
                </button>
                <button
                  onClick={() => onResolve(conflict.id, 'keep-remote')}
                  className="px-2 py-0.5 bg-success-100 text-success-700 rounded hover:bg-success-200"
                >
                  保留远程
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SyncStatusIndicator({ status }: { status: { isSyncing: boolean; hasConflict: boolean; pendingOperations: number; lastSyncedAt: Date | null } }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      {status.isSyncing ? (
        <div className="flex items-center gap-1 text-secondary-600">
          <RefreshCw className="w-3 h-3 animate-spin" />
          <span>同步中...</span>
        </div>
      ) : status.hasConflict ? (
        <div className="flex items-center gap-1 text-warning-600">
          <AlertTriangle className="w-3 h-3" />
          <span>存在冲突</span>
        </div>
      ) : status.pendingOperations > 0 ? (
        <div className="flex items-center gap-1 text-warning-600">
          <RefreshCw className="w-3 h-3" />
          <span>{status.pendingOperations} 个待同步</span>
        </div>
      ) : (
        <div className="flex items-center gap-1 text-success-600">
          <Check className="w-3 h-3" />
          <span>
            {status.lastSyncedAt
              ? `已同步 ${new Date(status.lastSyncedAt).toLocaleTimeString()}`
              : '已同步'}
          </span>
        </div>
      )}
    </div>
  );
}

export function CollaborationPanel() {
  const {
    session,
    participants,
    isConnected,
    isConnecting,
    connect,
    disconnect,
    getActiveParticipants,
    syncStatus,
    conflicts,
    resolveConflict,
    getCurrentUserRole,
    getCurrentUserPermissions,
  } = useCollaborationStore();

  const [activeUsers, setActiveUsers] = useState<ParticipantDisplay[]>([]);
  const [showPermissions, setShowPermissions] = useState(false);

  const currentRole = getCurrentUserRole();
  const currentPermissions = getCurrentUserPermissions();

  useEffect(() => {
    const active = getActiveParticipants();
    setActiveUsers(active.map(p => ({
      userId: p.user.id,
      name: p.user.name,
      color: p.user.id === 'user-1' ? '#FF3B30' : 'var(--color-secondary-500)',
      joinedAt: typeof p.joinedAt === 'string' ? p.joinedAt : p.joinedAt.toISOString(),
      role: p.role,
      isOnline: p.isOnline ?? true,
    })));
  }, [participants, getActiveParticipants]);

  const handleConnect = async () => {
    await connect('current-document');
  };

  const handleResolveConflict = (conflictId: string, resolution: string) => {
    resolveConflict(conflictId, resolution as 'keep-local' | 'keep-remote' | 'merge' | 'manual');
  };

  const pendingConflicts = conflicts.filter(c => c.status === 'pending');

  return (
    <div className="border rounded-lg p-4 bg-white dark:bg-neutral-800">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-primary-500" />
          <h3 className="font-semibold">实时协作</h3>
        </div>
        {isConnecting ? (
          <span className="px-2 py-1 text-xs bg-secondary-100 text-secondary-700 rounded-full dark:bg-secondary-300/25 dark:text-secondary-700">连接中...</span>
        ) : isConnected ? (
          <span className="px-2 py-1 text-xs bg-success-100 text-success-700 rounded-full dark:bg-success-300/25 dark:text-success-600">已连接</span>
        ) : (
          <span className="px-2 py-1 text-xs bg-neutral-100 text-neutral-700 rounded-full dark:bg-neutral-700 dark:text-neutral-300">未连接</span>
        )}
      </div>

      {!isConnected && !isConnecting && (
        <button
          onClick={handleConnect}
          className="w-full mb-4 flex items-center justify-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
        >
          <Wifi className="w-4 h-4" />
          连接协作
        </button>
      )}

      {isConnected && (
        <>
          {pendingConflicts.length > 0 && (
            <div className="mb-4">
              <ConflictWarning conflicts={pendingConflicts} onResolve={handleResolveConflict} />
            </div>
          )}

          <div className="mb-4">
            <SyncStatusIndicator status={syncStatus} />
          </div>

          <div className="mb-4 p-3 bg-neutral-50 dark:bg-neutral-700/50 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full" style={{ backgroundColor: 'var(--color-tertiary, var(--color-accent-500))' }} />
                <div>
                  <div className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                    {useCollaborationStore.getState().currentUser.name}
                    <span className="ml-2 text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">(您)</span>
                  </div>
                  <RoleBadge role={currentRole} />
                </div>
              </div>
              <button
                onClick={() => setShowPermissions(!showPermissions)}
                className="text-xs text-primary-700 hover:text-primary-700"
              >
                {showPermissions ? '隐藏权限' : '查看权限'}
              </button>
            </div>

            {showPermissions && currentPermissions && (
              <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t border-neutral-200 dark:border-neutral-600">
                <PermissionBadge permission="canEdit" hasPermission={currentPermissions.canEdit} />
                <PermissionBadge permission="canDelete" hasPermission={currentPermissions.canDelete} />
                <PermissionBadge permission="canInvite" hasPermission={currentPermissions.canInvite} />
                <PermissionBadge permission="canRemove" hasPermission={currentPermissions.canRemove} />
                <PermissionBadge permission="canChangeRole" hasPermission={currentPermissions.canChangeRole} />
                <PermissionBadge permission="canExport" hasPermission={currentPermissions.canExport} />
              </div>
            )}
          </div>

          <div className="space-y-2 mb-4">
            <div className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">在线参与者 ({activeUsers.length + 1}人)</div>
            <div className="flex flex-col gap-2">
              {activeUsers.map((user) => (
                <div
                  key={user.userId}
                  className="flex items-center justify-between p-2 bg-neutral-100 dark:bg-neutral-700 rounded-lg"
                >
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <div className="w-6 h-6 rounded-full" style={{ backgroundColor: user.color }} />
                      {user.isOnline && (
                        <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-success-500 rounded-full border-2 border-white dark:border-neutral-800" />
                      )}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                        {user.name}
                      </div>
                      <RoleBadge role={user.role} />
                    </div>
                  </div>
                  <div className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
                    {user.isOnline ? '在线' : '离线'}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 p-3 bg-primary-50 dark:bg-primary-300/20 rounded-lg">
            <div className="w-6 h-6 rounded-full" style={{ backgroundColor: 'var(--color-tertiary, var(--color-accent-500))' }} />
            <div>
              <div className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                您的光标
              </div>
              <div className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
                当前用户
              </div>
            </div>
          </div>

          <button
            onClick={disconnect}
            className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors"
          >
            <WifiOff className="w-4 h-4" />
            断开连接
          </button>
        </>
      )}

      {session && (
        <div className="mt-4 pt-4 border-t border-neutral-100 dark:border-neutral-700">
          <div className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] space-y-1">
            <p><span className="font-medium">会话ID：</span>{session.id}</p>
            <p><span className="font-medium">文档ID：</span>{session.documentId}</p>
            <p><span className="font-medium">创建时间：</span>{new Date(session.createdAt).toLocaleString()}</p>
          </div>
        </div>
      )}

      {!isConnected && (
        <div className="mt-4 p-3 bg-secondary-50 dark:bg-secondary-300/20 rounded-lg text-xs text-secondary-600 dark:text-secondary-700">
          <p className="font-medium mb-1">提示</p>
          <p>连接协作后，您可以与其他用户实时编辑同一文档，所有更改会即时同步。</p>
        </div>
      )}
    </div>
  );
}
