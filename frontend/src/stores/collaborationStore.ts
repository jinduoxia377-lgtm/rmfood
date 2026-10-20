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
import { getWebSocketUrl } from '@/config/env';
import { logger } from '@/utils/safeLogger';

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
  ws: WebSocket | null;
  reconnectTimer: ReturnType<typeof setTimeout> | null;
  connect: (documentId: string) => Promise<void>;
  disconnect: () => void;
  sendOperation: (operation: Omit<Operation, 'id' | 'timestamp'>) => void;
  undo: () => void;
  redo: () => void;
  setCursorPosition: (position: { paragraphIndex: number; offset: number }) => void;
  setSelection: (start: { paragraphIndex: number; offset: number }, end: { paragraphIndex: number; offset: number }) => void;
  resolveConflict: (conflictId: string, resolution: 'keep-local' | 'keep-remote' | 'merge' | 'manual') => void;
  getActiveParticipants: () => CollaborationParticipant[];
  getPendingConflicts: () => CollaborationConflict[];
  getCurrentUserRole: () => CollaborationRole;
  getCurrentUserPermissions: () => CollaborationPermissions;
  canPerformAction: (action: keyof CollaborationPermissions) => boolean;
  updateParticipantRole: (participantId: string, newRole: CollaborationRole) => void;
  removeParticipant: (participantId: string) => void;
  clearConflictMarkers: () => void;
  syncOperations: () => void;
}

// ─── WebSocket 消息类型 ────────────────────────────────────────────────────────
type WsMessage =
  | { type: 'connected'; sessionId: string; participants: CollaborationParticipant[] }
  | { type: 'participant_joined'; participant: CollaborationParticipant }
  | { type: 'participant_left'; userId: string }
  | { type: 'operation'; op: Operation }
  | { type: 'cursor'; userId: string; position: CollaborationCursorPosition }
  | { type: 'conflict'; conflict: CollaborationConflict }
  | { type: 'synced'; timestamp: string }
  | { type: 'error'; message: string };

export const useCollaborationStore = create<CollaborationState>()(
  persist(
    (set, get) => ({
      session: null,
      currentUser: {
        id: 'user-' + Math.random().toString(36).substring(2, 11),
        name: '用户' + Math.floor(Math.random() * 1000),
        color: '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0'),
      },
      ws: null,
      reconnectTimer: null,
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
          // 获取当前用户信息（从 auth store 或本地）
          const userId = get().currentUser.id;
          const userName = get().currentUser.name;
          const wsUrl = getWebSocketUrl();

          logger.info('[Collaboration] 连接 WebSocket', { url: wsUrl, documentId });

          // 建立 WebSocket 连接
          const ws = new WebSocket(wsUrl);
          set({ ws });

          ws.onopen = () => {
            logger.info('[Collaboration] WebSocket 已连接');
            set({ isConnected: true, isConnecting: false, error: null });

            // 发送加入文档消息
            ws.send(JSON.stringify({
              type: 'join_document',
              documentId,
              userId,
              userName,
            }));
          };

          ws.onmessage = (event) => {
            try {
              const msg: WsMessage = JSON.parse(event.data);
              handleWsMessage(msg);
            } catch (e) {
              logger.error('[Collaboration] 解析 WebSocket 消息失败', e);
            }
          };

          ws.onerror = (event) => {
            logger.error('[Collaboration] WebSocket 错误', event);
            set({ error: '连接错误，请检查网络' });
          };

          ws.onclose = () => {
            logger.info('[Collaboration] WebSocket 断开');
            set({ isConnected: false, ws: null });
            // 自动重连（3秒后）
            const timer = setTimeout(() => {
              const state = get();
              if (state.session?.documentId && !state.isConnecting) {
                logger.info('[Collaboration] 尝试重连...');
                get().connect(state.session.documentId);
              }
            }, 3000);
            set({ reconnectTimer: timer });
          };

          // ─── 消息处理器 ───────────────────────────────────────────────
          function handleWsMessage(msg: WsMessage) {
            switch (msg.type) {
              case 'connected': {
                set({
                  session: {
                    id: msg.sessionId,
                    documentId,
                    participants: msg.participants.map(p => p.id),
                    createdAt: new Date().toISOString(),
                  },
                  participants: msg.participants,
                  permissions: CollaborationRBAC.getPermissions('owner' as CollaborationRole),
                });
                useToastStore.getState().addToast({
                  type: 'success',
                  title: '已连接',
                  message: `实时协作已启用`,
                });
                break;
              }
              case 'participant_joined':
                set(state => ({
                  participants: [...state.participants, msg.participant],
                  session: state.session ? {
                    ...state.session,
                    participants: [...state.session.participants, msg.participant.id],
                  } : null,
                }));
                break;
              case 'participant_left':
                set(state => ({
                  participants: state.participants.filter(p => p.id !== msg.userId),
                  session: state.session ? {
                    ...state.session,
                    participants: state.session.participants.filter(id => id !== msg.userId),
                  } : null,
                }));
                break;
              case 'operation':
                set(state => ({
                  operations: [...state.operations, msg.op],
                  operationIndex: state.operationIndex + 1,
                }));
                break;
              case 'conflict':
                set(state => ({
                  conflicts: [...state.conflicts, msg.conflict],
                  syncStatus: { ...state.syncStatus, hasConflict: true },
                }));
                break;
              case 'synced':
                set(state => ({
                  syncStatus: {
                    ...state.syncStatus,
                    lastSyncedAt: new Date(msg.timestamp),
                    pendingOperations: 0,
                    isSyncing: false,
                  },
                }));
                break;
              case 'error':
                set({ error: msg.message });
                break;
            }
          }

        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : '连接失败';
          set({ error: errorMsg, isConnecting: false });
          logger.error('[Collaboration] 连接失败', err);
        }
      },

      disconnect: () => {
        const { ws, reconnectTimer } = get();
        if (ws) {
          ws.close();
          set({ ws: null, isConnected: false, session: null, participants: [], permissions: null });
        }
        if (reconnectTimer) {
          clearTimeout(reconnectTimer);
          set({ reconnectTimer: null });
        }
        useToastStore.getState().addToast({
          type: 'info',
          title: '已断开连接',
          message: '协作会话已结束',
        });
      },

      sendOperation: (operation) => {
        const { permissions, ws } = get();

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
            isSyncing: true,
          },
        }));

        conflictResolver.onConflictDetected((conflict) => {
          set(state => ({
            conflicts: [...state.conflicts, conflict],
            syncStatus: { ...state.syncStatus, hasConflict: true },
          }));
        });

        // 通过 WebSocket 广播操作
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: 'operation',
            operation: newOperation,
          }));
        }
      },

      undo: () => {
        const { operationIndex, permissions } = get();
        if (!permissions?.canEdit) return;
        if (operationIndex < 0) return;
        set({
          operationIndex: operationIndex - 1,
          syncStatus: { ...get().syncStatus, pendingOperations: Math.max(0, get().syncStatus.pendingOperations - 1) },
        });
      },

      redo: () => {
        const { operations, operationIndex, permissions } = get();
        if (!permissions?.canEdit) return;
        if (operationIndex >= operations.length - 1) return;
        set({
          operationIndex: operationIndex + 1,
        });
      },

      setCursorPosition: (position) => {
        const { ws, currentUser } = get();
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: 'cursor',
            userId: currentUser.id,
            position,
          }));
        }
        set(state => ({
          participants: state.participants.map(p =>
            p.id === currentUser.id
              ? { ...p, cursor: { ...position, userId: currentUser.id, color: currentUser.color } }
              : p,
          ),
        }));
      },

      setSelection: (start, end) => {
        const { ws, currentUser } = get();
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: 'selection',
            userId: currentUser.id,
            start,
            end,
          }));
        }
      },

      resolveConflict: (conflictId, resolution) => {
        const { conflicts } = get();
        const conflict = conflicts.find(c => c.id === conflictId);
        if (!conflict) return;

        const strategyMap: Record<string, 'server_wins' | 'client_wins' | 'merge'> = {
          'keep-local': 'client_wins',
          'keep-remote': 'server_wins',
          'merge': 'merge',
          'manual': 'server_wins',
        };
        conflictResolver.resolveConflict(
          { clientData: null, serverData: null, timestamp: Date.now(), entityType: 'document', entityId: conflict.id },
          strategyMap[resolution] || 'server_wins',
        );
        set(state => ({
          conflicts: state.conflicts.filter(c => c.id !== conflictId),
          syncStatus: {
            ...state.syncStatus,
            hasConflict: state.conflicts.filter(c => c.id !== conflictId).length > 0,
          },
        }));

        useToastStore.getState().addToast({
          type: 'success',
          title: '冲突已解决',
          message: `已采用 ${resolution === 'keep-local' ? '本地' : resolution === 'keep-remote' ? '远程' : '合并'} 版本`,
        });
      },

      getActiveParticipants: (): CollaborationParticipant[] => {
        const { participants, currentUser } = get();
        // 活跃参与者：在线且非当前用户（与测试/语义约定一致）
        return participants.filter(p => p.isOnline !== false && p.user.id !== currentUser.id);
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

        set(state => ({
          participants: state.participants.map(p =>
            p.id === participantId ? { ...p, role: newRole } : p,
          ),
        }));

        useToastStore.getState().addToast({
          type: 'success',
          title: '角色已更新',
          message: `已将参与者角色更改为 ${newRole}`,
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

        // 通知其他参与者
        const { ws } = get();
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: 'participant_removed',
            userId: participantId,
          }));
        }
      },

      clearConflictMarkers: () => {
        set({ conflictMarkers: [] });
      },

      syncOperations: () => {
        const { operations, ws } = get();
        if (operations.length === 0) return;

        set(state => ({
          syncStatus: { ...state.syncStatus, isSyncing: true },
        }));

        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: 'sync',
            operations: operations.slice(get().operationIndex + 1),
          }));
        }

        // 模拟同步完成
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
      name: 'collaboration-state',
      partialize: (state) => ({
        session: state.session,
        currentUser: state.currentUser,
        participants: state.participants,
        operations: state.operations.slice(-100), // 仅持久化最近100条
        operationIndex: state.operationIndex,
      }),
    },
  ),
);
