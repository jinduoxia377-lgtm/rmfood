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
          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
          : 'bg-gray-100 text-gray-400 dark:bg-gray-700 dark:text-gray-500'
      }`}
    >
      <Icon size={12} />
      <span>{label}</span>
    </div>
  );
}

function RoleBadge({ role }: { role: CollaborationRole }) {
  const config: Record<CollaborationRole, { icon: typeof Crown; label: string; className: string }> = {
    owner: { icon: Crown, label: '所有者', className: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
    editor: { icon: Edit3, label: '编辑者', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
    reviewer: { icon: Eye, label: '审阅者', className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
    viewer: { icon: EyeOff, label: '查看者', className: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400' },
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
    <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
      <div className="flex items-center gap-2 mb-2">
        <AlertTriangle className="w-4 h-4 text-amber-600" />
        <span className="text-sm font-medium text-amber-800 dark:text-amber-200">
          检测到 {conflicts.length} 个冲突
        </span>
      </div>
      <div className="space-y-2">
        {conflicts.slice(0, 3).map((conflict) => (
          <div key={conflict.id} className="text-xs bg-white dark:bg-amber-900/30 p-2 rounded">
            <div className="flex items-center justify-between">
              <span className="text-amber-700 dark:text-amber-300">
                冲突类型: {conflict.type}
              </span>
              <div className="flex gap-1">
                <button
                  onClick={() => onResolve(conflict.id, 'keep-local')}
                  className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                >
                  保留本地
                </button>
                <button
                  onClick={() => onResolve(conflict.id, 'keep-remote')}
                  className="px-2 py-0.5 bg-green-100 text-green-700 rounded hover:bg-green-200"
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
        <div className="flex items-center gap-1 text-blue-600">
          <RefreshCw className="w-3 h-3 animate-spin" />
          <span>同步中...</span>
        </div>
      ) : status.hasConflict ? (
        <div className="flex items-center gap-1 text-amber-600">
          <AlertTriangle className="w-3 h-3" />
          <span>存在冲突</span>
        </div>
      ) : status.pendingOperations > 0 ? (
        <div className="flex items-center gap-1 text-yellow-600">
          <RefreshCw className="w-3 h-3" />
          <span>{status.pendingOperations} 个待同步</span>
        </div>
      ) : (
        <div className="flex items-center gap-1 text-green-600">
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
      color: p.user.id === 'user-1' ? '#ef4444' : '#3b82f6',
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
    <div className="border rounded-lg p-4 bg-white dark:bg-gray-800">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-primary-500" />
          <h3 className="font-semibold">实时协作</h3>
        </div>
        {isConnecting ? (
          <span className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded-full dark:bg-blue-900/30 dark:text-blue-400">连接中...</span>
        ) : isConnected ? (
          <span className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded-full dark:bg-green-900/30 dark:text-green-400">已连接</span>
        ) : (
          <span className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded-full dark:bg-gray-700 dark:text-gray-300">未连接</span>
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

          <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full" style={{ backgroundColor: '#6366f1' }} />
                <div>
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {useCollaborationStore.getState().currentUser.name}
                    <span className="ml-2 text-xs text-gray-500">(您)</span>
                  </div>
                  <RoleBadge role={currentRole} />
                </div>
              </div>
              <button
                onClick={() => setShowPermissions(!showPermissions)}
                className="text-xs text-primary-600 hover:text-primary-700"
              >
                {showPermissions ? '隐藏权限' : '查看权限'}
              </button>
            </div>

            {showPermissions && currentPermissions && (
              <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t border-gray-200 dark:border-gray-600">
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
            <div className="text-xs text-gray-500">在线参与者 ({activeUsers.length + 1}人)</div>
            <div className="flex flex-col gap-2">
              {activeUsers.map((user) => (
                <div
                  key={user.userId}
                  className="flex items-center justify-between p-2 bg-gray-100 dark:bg-gray-700 rounded-lg"
                >
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <div className="w-6 h-6 rounded-full" style={{ backgroundColor: user.color }} />
                      {user.isOnline && (
                        <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white dark:border-gray-800" />
                      )}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {user.name}
                      </div>
                      <RoleBadge role={user.role} />
                    </div>
                  </div>
                  <div className="text-xs text-gray-500">
                    {user.isOnline ? '在线' : '离线'}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 p-3 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
            <div className="w-6 h-6 rounded-full" style={{ backgroundColor: '#6366f1' }} />
            <div>
              <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                您的光标
              </div>
              <div className="text-xs text-gray-500">
                当前用户
              </div>
            </div>
          </div>

          <button
            onClick={disconnect}
            className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <WifiOff className="w-4 h-4" />
            断开连接
          </button>
        </>
      )}

      {session && (
        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
          <div className="text-xs text-gray-500 space-y-1">
            <p><span className="font-medium">会话ID：</span>{session.id}</p>
            <p><span className="font-medium">文档ID：</span>{session.documentId}</p>
            <p><span className="font-medium">创建时间：</span>{new Date(session.createdAt).toLocaleString()}</p>
          </div>
        </div>
      )}

      {!isConnected && (
        <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-xs text-blue-600 dark:text-blue-400">
          <p className="font-medium mb-1">提示</p>
          <p>连接协作后，您可以与其他用户实时编辑同一文档，所有更改会即时同步。</p>
        </div>
      )}
    </div>
  );
}
