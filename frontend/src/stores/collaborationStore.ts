import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Author } from '@/types/academic-report';
import type {
  CollaborationConflict,
  ConflictMarker,
} from '@/utils/conflictResolver';
import {
  conflictResolver,
} from '@/utils/conflictResolver';
import type {
  CollaborationPermissions,
  CollaborationRole,
} from '@/utils/rbac';
import {
  CollaborationRBAC,
} from '@/utils/rbac';
import { useToastStore } from './toastStore';

interface CollaborationCursorPosition {
  userId: string;
  paragraphIndex?: number;
  offset?: number;
  chapterId?: string;
  color?: string;
}

interface CollaborationParticipant {
  id: string;
  user: Author;
  role: CollaborationRole;
  joinedAt: Date;
  cursor?: CollaborationCursorPosition;
  isOnline?: boolean;
  lastActivity?: Date;
}

interface Operation {
  id: string;
  userId: string;
  type: 'insert' | 'delete' | 'update' | 'format';
  target: {
    type: 'text' | 'figure' | 'table' | 'formula' | 'code';
    id: string;
  };
  before?: unknown;
  after?: unknown;
  timestamp: Date;
  version: number;
}

interface SyncStatus {
  lastSyncedAt: Date | null;
  pendingOperations: number;
  isSyncing: boolean;
  hasConflict: boolean;
}

interface CollaborationState {
  session: { id: string; documentId: string; participants: string[]; createdAt: string } | null;
  currentUser: { id: string; name: string; color: string };
  participants: CollaborationParticipant[];
  operations: Operation[];
  operationIndex: number;
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  conflicts: CollaborationConflict[];
  conflictMarkers: ConflictMarker[];
  syncStatus: SyncStatus;
  permissions: CollaborationPermissions | null;
  connect: (documentId: string) => Promise<void>;
  disconnect: () => void;
  sendOperation: (operation: Omit<Operation, 'id' | 'timestamp'>) => void;
  undo: () => void;
  redo: () => void;
  setCursorPosition: (position: { paragraphIndex: number; offset: number }) => void;
  setSelection: (start: { paragraphIndex: number; offset: number }, end: { paragraphIndex: number; offset: number }) => void;
  getActiveParticipants: () => CollaborationParticipant[];
  resolveConflict: (conflictId: string, resolution: 'keep-local' | 'keep-remote' | 'merge' | 'manual') => void;
  getPendingConflicts: () => CollaborationConflict[];
  getCurrentUserRole: () => CollaborationRole;
  getCurrentUserPermissions: () => CollaborationPermissions;
  canPerformAction: (action: keyof CollaborationPermissions) => boolean;
  updateParticipantRole: (participantId: string, newRole: CollaborationRole) => void;
  removeParticipant: (participantId: string) => void;
  clearConflictMarkers: () => void;
  syncOperations: () => void;
}

export const useCollaborationStore = create<CollaborationState>()(
  persist(
    (set, get) => ({
      session: null,
      currentUser: {
        id: 'user-' + Math.random().toString(36).substring(2, 11),
        name: '用户' + Math.floor(Math.random() * 1000),
        color: '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0'),
      },
      participants: [],
      operations: [],
      operationIndex: -1,
      isConnected: false,
      isConnecting: false,
      error: null,
      conflicts: [],
      conflictMarkers: [],
      syncStatus: {
        lastSyncedAt: null,
        pendingOperations: 0,
        isSyncing: false,
        hasConflict: false,
      },
      permissions: null,

      connect: async (documentId: string) => {
        set({ isConnecting: true, error: null });

        try {
          await new Promise(resolve => setTimeout(resolve, 1000));

          const mockAuthor1: Author = { id: 'user-1', name: '张三', email: 'zhangsan@example.com', affiliation: '示例大学' };
          const mockAuthor2: Author = { id: 'user-2', name: '李四', email: 'lisi@example.com', affiliation: '示例研究所' };

          const mockParticipants: CollaborationParticipant[] = [
            {
              id: 'part-1',
              user: mockAuthor1,
              role: 'editor',
              joinedAt: new Date(),
              cursor: { userId: 'user-1', paragraphIndex: 5, offset: 10 },
              isOnline: true,
              lastActivity: new Date(),
            },
            {
              id: 'part-2',
              user: mockAuthor2,
              role: 'editor',
              joinedAt: new Date(Date.now() - 300000),
              cursor: { userId: 'user-2', paragraphIndex: 12, offset: 20 },
              isOnline: true,
              lastActivity: new Date(Date.now() - 60000),
            },
          ];

          const newSession = {
            id: `session-${Date.now()}`,
            documentId,
            participants: mockParticipants.map(p => p.id),
            createdAt: new Date().toISOString(),
          };

          const currentUserRole: CollaborationRole = 'owner';
          const permissions = CollaborationRBAC.getPermissions(currentUserRole);

          set({
            session: newSession,
            participants: [...mockParticipants, {
              id: 'part-current',
              user: { id: get().currentUser.id, name: get().currentUser.name, email: '', affiliation: '' },
              role: 'owner',
              joinedAt: new Date(),
              cursor: { userId: get().currentUser.id, paragraphIndex: 0, offset: 0 },
              isOnline: true,
              lastActivity: new Date(),
            }],
            isConnected: true,
            isConnecting: false,
            permissions,
            syncStatus: {
              lastSyncedAt: new Date(),
              pendingOperations: 0,
              isSyncing: false,
              hasConflict: false,
            },
          });

          useToastStore.getState().addToast({
            type: 'success',
            title: '协作连接成功',
            message: '已成功连接到协作会话',
          });
        } catch {
          set({
            isConnecting: false,
            error: '连接协作会话失败',
          });
          useToastStore.getState().addToast({
            type: 'error',
            title: '连接失败',
            message: '无法连接到协作会话',
          });
        }
      },

      disconnect: () => {
        set({
          session: null,
          participants: [],
          isConnected: false,
          isConnecting: false,
          permissions: null,
          conflicts: [],
          conflictMarkers: [],
          syncStatus: {
            lastSyncedAt: null,
            pendingOperations: 0,
            isSyncing: false,
            hasConflict: false,
          },
        });
        useToastStore.getState().addToast({
          type: 'info',
          title: '已断开连接',
          message: '协作会话已结束',
        });
      },

      sendOperation: (operation) => {
        const { permissions } = get();

        if (!permissions?.canEdit) {
          useToastStore.getState().addToast({
            type: 'warning',
            title: '无权限',
            message: '您没有编辑权限',
          });
          return;
        }

        const newOperation: Operation = {
          ...operation,
          id: `op-${Date.now()}`,
          timestamp: new Date(),
          version: 1,
        };

        set(state => ({
          operations: [...state.operations.slice(0, state.operationIndex + 1), newOperation],
          operationIndex: state.operationIndex + 1,
          syncStatus: {
            ...state.syncStatus,
            pendingOperations: state.syncStatus.pendingOperations + 1,
          },
        }));

        conflictResolver.onConflictDetected((conflict) => {
          set(state => ({
            conflicts: [...state.conflicts, conflict],
            syncStatus: {
              ...state.syncStatus,
              hasConflict: true,
            },
          }));

          useToastStore.getState().addToast({
            type: 'warning',
            title: '检测到冲突',
            message: `与用户 ${conflict.incomingOperation.userId} 的操作发生冲突`,
          });
        });
      },

      undo: () => {
        const { operationIndex, permissions } = get();

        if (!permissions?.canEdit) {
          useToastStore.getState().addToast({
            type: 'warning',
            title: '无权限',
            message: '您没有编辑权限',
          });
          return;
        }

        if (operationIndex >= 0) {
          set({ operationIndex: operationIndex - 1 });
        }
      },

      redo: () => {
        const { operationIndex, operations, permissions } = get();

        if (!permissions?.canEdit) {
          return;
        }

        if (operationIndex < operations.length - 1) {
          set({ operationIndex: operationIndex + 1 });
        }
      },

      setCursorPosition: (position) => {
        const currentUserId = get().currentUser.id;
        set(state => ({
          participants: state.participants.map(p =>
            p.user.id === currentUserId
              ? { ...p, cursor: { userId: currentUserId, paragraphIndex: position.paragraphIndex, offset: position.offset }, lastActivity: new Date() }
              : p,
          ),
        }));
      },

      setSelection: (start, _end) => {
        const currentUserId = get().currentUser.id;
        set(state => ({
          participants: state.participants.map(p =>
            p.user.id === currentUserId
              ? { ...p, cursor: { userId: currentUserId, paragraphIndex: start.paragraphIndex, offset: start.offset }, lastActivity: new Date() }
              : p,
          ),
        }));
      },

      getActiveParticipants: () => {
        const { participants, currentUser } = get();
        return participants.filter(p => p.user.id !== currentUser.id);
      },

      resolveConflict: (conflictId, resolution) => {
        const { currentUser } = get();

        const conflict = conflictResolver.resolveCollaborationConflict(
          conflictId,
          resolution,
          currentUser.id,
        );

        if (conflict) {
          set(state => {
            const newConflicts = state.conflicts.filter(c => c.id !== conflictId);
            return {
              conflicts: newConflicts,
              syncStatus: {
                ...state.syncStatus,
                hasConflict: newConflicts.length > 0,
              },
            };
          });

          useToastStore.getState().addToast({
            type: 'success',
            title: '冲突已解决',
            message: `使用 "${resolution}" 策略解决了冲突`,
          });
        }
      },

      getPendingConflicts: () => {
        return get().conflicts.filter(c => c.status === 'pending');
      },

      getCurrentUserRole: (): CollaborationRole => {
        const { participants, currentUser } = get();
        const currentParticipant = participants.find(p => p.user.id === currentUser.id);
        return currentParticipant?.role || 'viewer';
      },

      getCurrentUserPermissions: (): CollaborationPermissions => {
        const role = get().getCurrentUserRole();
        return CollaborationRBAC.getPermissions(role);
      },

      canPerformAction: (action) => {
        const permissions = get().getCurrentUserPermissions();
        return permissions[action];
      },

      updateParticipantRole: (participantId, newRole) => {
        const { permissions } = get();

        if (!permissions?.canChangeRole) {
          useToastStore.getState().addToast({
            type: 'warning',
            title: '无权限',
            message: '您没有更改角色权限',
          });
          return;
        }

        const participant = get().participants.find(p => p.id === participantId);
        if (!participant) return;

        if (participant.role === 'owner') {
          useToastStore.getState().addToast({
            type: 'error',
            title: '操作失败',
            message: '无法更改所有者角色',
          });
          return;
        }

        set(state => ({
          participants: state.participants.map(p =>
            p.id === participantId ? { ...p, role: newRole } : p,
          ),
        }));

        useToastStore.getState().addToast({
          type: 'success',
          title: '角色已更新',
          message: `已将 ${participant.user.name} 的角色更改为 ${newRole}`,
        });
      },

      removeParticipant: (participantId) => {
        const { permissions } = get();

        if (!permissions?.canRemove) {
          useToastStore.getState().addToast({
            type: 'warning',
            title: '无权限',
            message: '您没有移除参与者的权限',
          });
          return;
        }

        const participant = get().participants.find(p => p.id === participantId);
        if (!participant) return;

        if (participant.role === 'owner') {
          useToastStore.getState().addToast({
            type: 'error',
            title: '操作失败',
            message: '无法移除所有者',
          });
          return;
        }

        set(state => ({
          participants: state.participants.filter(p => p.id !== participantId),
          session: state.session ? {
            ...state.session,
            participants: state.session.participants.filter(id => id !== participantId),
          } : null,
        }));

        useToastStore.getState().addToast({
          type: 'info',
          title: '参与者已移除',
          message: `${participant.user.name} 已被移出协作会话`,
        });
      },

      clearConflictMarkers: () => {
        set({ conflictMarkers: [] });
      },

      syncOperations: () => {
        set(state => ({
          syncStatus: {
            ...state.syncStatus,
            isSyncing: true,
          },
        }));

        setTimeout(() => {
          set(state => ({
            syncStatus: {
              ...state.syncStatus,
              isSyncing: false,
              lastSyncedAt: new Date(),
              pendingOperations: 0,
            },
          }));
        }, 500);
      },
    }),
    {
      name: 'collaboration-storage',
      partialize: (state) => ({
        currentUser: state.currentUser,
      }),
    },
  ),
);
