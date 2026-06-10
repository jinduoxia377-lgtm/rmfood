/**
 * Collaboration Store - 单元测试
 * 测试覆盖：初始状态、连接/断开、参与者管理、撤销/重做、冲突检测、权限控制
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('@/utils/safeLogger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), log: vi.fn() },
}));

vi.mock('@/stores/toastStore', () => ({
  useToastStore: {
    getState: vi.fn().mockReturnValue({
      addToast: vi.fn(),
      removeToast: vi.fn(),
      clearAll: vi.fn(),
    }),
  },
}));

vi.mock('@/utils/conflictResolver', () => {
  const listeners = new Set<(conflict: unknown) => void>();
  return {
    conflictResolver: {
      onConflictDetected: vi.fn((callback: (conflict: unknown) => void) => {
        listeners.add(callback);
        return () => {
          listeners.delete(callback);
        };
      }),
      resolveCollaborationConflict: vi.fn((conflictId: string, resolution: string, resolvedBy: string) => ({
        id: conflictId,
        status: 'resolved',
        resolution,
        resolvedBy,
        resolvedAt: Date.now(),
      })),
      detectOperationConflict: vi.fn().mockReturnValue(false),
      __listeners: listeners,
      __emitConflict: (conflict: unknown) => {
        listeners.forEach((cb) => cb(conflict));
      },
    },
  };
});

vi.mock('@/utils/rbac', () => ({
  CollaborationRBAC: {
    getPermissions: vi.fn((role: string) => {
      const matrix: Record<string, Record<string, boolean>> = {
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
      };
      return matrix[role] || matrix.viewer;
    }),
  },
}));

import { useCollaborationStore } from '../collaborationStore';
import { useToastStore } from '@/stores/toastStore';

describe('collaborationStore', () => {
  beforeEach(() => {
    // Reset to initial state
    useCollaborationStore.setState({
      session: null,
      currentUser: {
        id: 'user-test-123',
        name: 'TestUser',
        color: '#ff0000',
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
    });
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initial state', () => {
    it('should have no session', () => {
      expect(useCollaborationStore.getState().session).toBeNull();
    });

    it('should have no participants', () => {
      expect(useCollaborationStore.getState().participants).toEqual([]);
    });

    it('should not be connected', () => {
      expect(useCollaborationStore.getState().isConnected).toBe(false);
      expect(useCollaborationStore.getState().isConnecting).toBe(false);
    });

    it('should have no operations', () => {
      expect(useCollaborationStore.getState().operations).toEqual([]);
      expect(useCollaborationStore.getState().operationIndex).toBe(-1);
    });

    it('should have no conflicts', () => {
      expect(useCollaborationStore.getState().conflicts).toEqual([]);
      expect(useCollaborationStore.getState().conflictMarkers).toEqual([]);
    });

    it('should have null permissions', () => {
      expect(useCollaborationStore.getState().permissions).toBeNull();
    });

    it('should have a current user with id, name, and color', () => {
      const user = useCollaborationStore.getState().currentUser;
      expect(user.id).toBeDefined();
      expect(user.name).toBeDefined();
      expect(user.color).toBeDefined();
    });
  });

  describe('connect', () => {
    it('should set isConnecting to true during connection', async () => {
      vi.useFakeTimers();
      const connectPromise = useCollaborationStore.getState().connect('doc-123');

      expect(useCollaborationStore.getState().isConnecting).toBe(true);
      expect(useCollaborationStore.getState().error).toBeNull();

      await vi.advanceTimersByTimeAsync(1100);
      await connectPromise;
    });

    it('should set session and participants after successful connection', async () => {
      vi.useFakeTimers();
      const connectPromise = useCollaborationStore.getState().connect('doc-123');
      await vi.advanceTimersByTimeAsync(1100);
      await connectPromise;

      const state = useCollaborationStore.getState();
      expect(state.session).not.toBeNull();
      expect(state.session!.documentId).toBe('doc-123');
      expect(state.participants.length).toBeGreaterThan(0);
      expect(state.isConnected).toBe(true);
      expect(state.isConnecting).toBe(false);
    });

    it('should set permissions to owner after connection', async () => {
      vi.useFakeTimers();
      const connectPromise = useCollaborationStore.getState().connect('doc-123');
      await vi.advanceTimersByTimeAsync(1100);
      await connectPromise;

      const state = useCollaborationStore.getState();
      expect(state.permissions).not.toBeNull();
      expect(state.permissions!.canEdit).toBe(true);
      expect(state.permissions!.canRemove).toBe(true);
    });

    it('should include current user as participant with owner role', async () => {
      vi.useFakeTimers();
      const connectPromise = useCollaborationStore.getState().connect('doc-123');
      await vi.advanceTimersByTimeAsync(1100);
      await connectPromise;

      const state = useCollaborationStore.getState();
      const currentParticipant = state.participants.find((p) => p.user.id === state.currentUser.id);
      expect(currentParticipant).toBeDefined();
      expect(currentParticipant!.role).toBe('owner');
    });

    it('should show success toast after connection', async () => {
      vi.useFakeTimers();
      const connectPromise = useCollaborationStore.getState().connect('doc-123');
      await vi.advanceTimersByTimeAsync(1100);
      await connectPromise;

      expect(useToastStore.getState().addToast).toHaveBeenCalledWith(expect.objectContaining({ type: 'success' }));
    });
  });

  describe('disconnect', () => {
    it('should clear all session state', async () => {
      vi.useFakeTimers();
      const connectPromise = useCollaborationStore.getState().connect('doc-123');
      await vi.advanceTimersByTimeAsync(1100);
      await connectPromise;

      useCollaborationStore.getState().disconnect();

      const state = useCollaborationStore.getState();
      expect(state.session).toBeNull();
      expect(state.participants).toEqual([]);
      expect(state.isConnected).toBe(false);
      expect(state.permissions).toBeNull();
      expect(state.conflicts).toEqual([]);
    });

    it('should show info toast after disconnect', () => {
      useCollaborationStore.getState().disconnect();
      expect(useToastStore.getState().addToast).toHaveBeenCalledWith(expect.objectContaining({ type: 'info' }));
    });

    it('should handle disconnect when not connected', () => {
      expect(() => useCollaborationStore.getState().disconnect()).not.toThrow();
    });
  });

  describe('undo/redo operations', () => {
    beforeEach(() => {
      // Set up a connected state with owner permissions
      useCollaborationStore.setState({
        permissions: {
          canEdit: true,
          canDelete: true,
          canInvite: true,
          canRemove: true,
          canChangeRole: true,
          canExport: true,
        },
        operations: [],
        operationIndex: -1,
      });
    });

    it('should not undo when operationIndex is -1 (no operations)', () => {
      useCollaborationStore.getState().undo();
      expect(useCollaborationStore.getState().operationIndex).toBe(-1);
    });

    it('should undo by decrementing operationIndex', () => {
      // Add mock operations
      useCollaborationStore.setState({
        operations: [
          {
            id: 'op-1',
            userId: 'user-test-123',
            type: 'insert',
            target: { type: 'text', id: 't1' },
            timestamp: new Date(),
            version: 1,
          },
          {
            id: 'op-2',
            userId: 'user-test-123',
            type: 'update',
            target: { type: 'text', id: 't1' },
            timestamp: new Date(),
            version: 2,
          },
        ],
        operationIndex: 1,
      });

      useCollaborationStore.getState().undo();
      expect(useCollaborationStore.getState().operationIndex).toBe(0);
    });

    it('should undo all the way to -1', () => {
      useCollaborationStore.setState({
        operations: [
          {
            id: 'op-1',
            userId: 'user-test-123',
            type: 'insert',
            target: { type: 'text', id: 't1' },
            timestamp: new Date(),
            version: 1,
          },
        ],
        operationIndex: 0,
      });

      useCollaborationStore.getState().undo();
      expect(useCollaborationStore.getState().operationIndex).toBe(-1);
    });

    it('should not undo below -1', () => {
      useCollaborationStore.setState({
        operations: [
          {
            id: 'op-1',
            userId: 'user-test-123',
            type: 'insert',
            target: { type: 'text', id: 't1' },
            timestamp: new Date(),
            version: 1,
          },
        ],
        operationIndex: 0,
      });

      useCollaborationStore.getState().undo();
      useCollaborationStore.getState().undo();
      expect(useCollaborationStore.getState().operationIndex).toBe(-1);
    });

    it('should redo by incrementing operationIndex', () => {
      useCollaborationStore.setState({
        operations: [
          {
            id: 'op-1',
            userId: 'user-test-123',
            type: 'insert',
            target: { type: 'text', id: 't1' },
            timestamp: new Date(),
            version: 1,
          },
          {
            id: 'op-2',
            userId: 'user-test-123',
            type: 'update',
            target: { type: 'text', id: 't1' },
            timestamp: new Date(),
            version: 2,
          },
        ],
        operationIndex: 0,
      });

      useCollaborationStore.getState().redo();
      expect(useCollaborationStore.getState().operationIndex).toBe(1);
    });

    it('should not redo beyond operations length', () => {
      useCollaborationStore.setState({
        operations: [
          {
            id: 'op-1',
            userId: 'user-test-123',
            type: 'insert',
            target: { type: 'text', id: 't1' },
            timestamp: new Date(),
            version: 1,
          },
        ],
        operationIndex: 0,
      });

      useCollaborationStore.getState().redo();
      expect(useCollaborationStore.getState().operationIndex).toBe(0);
    });

    it('should prevent undo when user has no edit permission', () => {
      useCollaborationStore.setState({
        permissions: {
          canEdit: false,
          canDelete: false,
          canInvite: false,
          canRemove: false,
          canChangeRole: false,
          canExport: false,
        },
        operations: [
          {
            id: 'op-1',
            userId: 'user-test-123',
            type: 'insert',
            target: { type: 'text', id: 't1' },
            timestamp: new Date(),
            version: 1,
          },
        ],
        operationIndex: 0,
      });

      useCollaborationStore.getState().undo();
      expect(useCollaborationStore.getState().operationIndex).toBe(0);
    });

    it('should prevent redo when user has no edit permission', () => {
      useCollaborationStore.setState({
        permissions: {
          canEdit: false,
          canDelete: false,
          canInvite: false,
          canRemove: false,
          canChangeRole: false,
          canExport: false,
        },
        operations: [
          {
            id: 'op-1',
            userId: 'user-test-123',
            type: 'insert',
            target: { type: 'text', id: 't1' },
            timestamp: new Date(),
            version: 1,
          },
          {
            id: 'op-2',
            userId: 'user-test-123',
            type: 'update',
            target: { type: 'text', id: 't1' },
            timestamp: new Date(),
            version: 2,
          },
        ],
        operationIndex: 0,
      });

      useCollaborationStore.getState().redo();
      expect(useCollaborationStore.getState().operationIndex).toBe(0);
    });
  });

  describe('sendOperation', () => {
    beforeEach(() => {
      useCollaborationStore.setState({
        permissions: {
          canEdit: true,
          canDelete: true,
          canInvite: true,
          canRemove: true,
          canChangeRole: true,
          canExport: true,
        },
        operations: [],
        operationIndex: -1,
      });
    });

    it('should add operation to operations array', () => {
      useCollaborationStore.getState().sendOperation({
        userId: 'user-test-123',
        type: 'insert',
        target: { type: 'text', id: 't1' },
      });

      const state = useCollaborationStore.getState();
      expect(state.operations.length).toBe(1);
      expect(state.operationIndex).toBe(0);
      expect(state.operations[0].type).toBe('insert');
    });

    it('should increment pendingOperations in syncStatus', () => {
      useCollaborationStore.getState().sendOperation({
        userId: 'user-test-123',
        type: 'insert',
        target: { type: 'text', id: 't1' },
      });

      expect(useCollaborationStore.getState().syncStatus.pendingOperations).toBe(1);
    });

    it('should prevent sending operation without edit permission', () => {
      useCollaborationStore.setState({
        permissions: {
          canEdit: false,
          canDelete: false,
          canInvite: false,
          canRemove: false,
          canChangeRole: false,
          canExport: false,
        },
      });

      useCollaborationStore.getState().sendOperation({
        userId: 'user-test-123',
        type: 'insert',
        target: { type: 'text', id: 't1' },
      });

      expect(useCollaborationStore.getState().operations.length).toBe(0);
    });

    it('should show warning toast when no edit permission', () => {
      useCollaborationStore.setState({
        permissions: {
          canEdit: false,
          canDelete: false,
          canInvite: false,
          canRemove: false,
          canChangeRole: false,
          canExport: false,
        },
      });

      useCollaborationStore.getState().sendOperation({
        userId: 'user-test-123',
        type: 'insert',
        target: { type: 'text', id: 't1' },
      });

      expect(useToastStore.getState().addToast).toHaveBeenCalledWith(expect.objectContaining({ type: 'warning' }));
    });

    it('should truncate future operations on new send (branching undo history)', () => {
      // Add two operations, undo one, then send a new one
      useCollaborationStore.setState({
        operations: [
          {
            id: 'op-1',
            userId: 'user-test-123',
            type: 'insert',
            target: { type: 'text', id: 't1' },
            timestamp: new Date(),
            version: 1,
          },
          {
            id: 'op-2',
            userId: 'user-test-123',
            type: 'update',
            target: { type: 'text', id: 't1' },
            timestamp: new Date(),
            version: 2,
          },
        ],
        operationIndex: 0,
      });

      useCollaborationStore.getState().sendOperation({
        userId: 'user-test-123',
        type: 'format',
        target: { type: 'text', id: 't2' },
      });

      const state = useCollaborationStore.getState();
      // Should have op-1 + new op, op-2 should be truncated
      expect(state.operations.length).toBe(2);
      expect(state.operationIndex).toBe(1);
    });
  });

  describe('conflict detection', () => {
    it('should start with no conflicts', () => {
      expect(useCollaborationStore.getState().conflicts).toEqual([]);
      expect(useCollaborationStore.getState().syncStatus.hasConflict).toBe(false);
    });

    it('should resolve a pending conflict', () => {
      // Inject a mock conflict
      const mockConflict = {
        id: 'conflict-1',
        type: 'text' as const,
        originalOperation: {
          id: 'op-1',
          userId: 'user-1',
          type: 'update' as const,
          target: { type: 'text' as const, id: 't1' },
          timestamp: new Date(),
          version: 1,
        },
        incomingOperation: {
          id: 'op-2',
          userId: 'user-2',
          type: 'update' as const,
          target: { type: 'text' as const, id: 't1' },
          timestamp: new Date(),
          version: 2,
        },
        status: 'pending' as const,
      };

      useCollaborationStore.setState({
        conflicts: [mockConflict],
        syncStatus: { lastSyncedAt: null, pendingOperations: 0, isSyncing: false, hasConflict: true },
        permissions: {
          canEdit: true,
          canDelete: true,
          canInvite: true,
          canRemove: true,
          canChangeRole: true,
          canExport: true,
        },
      });

      useCollaborationStore.getState().resolveConflict('conflict-1', 'keep-local');

      const state = useCollaborationStore.getState();
      expect(state.conflicts.length).toBe(0);
      expect(state.syncStatus.hasConflict).toBe(false);
    });

    it('should show success toast when conflict is resolved', () => {
      const mockConflict = {
        id: 'conflict-1',
        type: 'text' as const,
        originalOperation: {
          id: 'op-1',
          userId: 'user-1',
          type: 'update' as const,
          target: { type: 'text' as const, id: 't1' },
          timestamp: new Date(),
          version: 1,
        },
        incomingOperation: {
          id: 'op-2',
          userId: 'user-2',
          type: 'update' as const,
          target: { type: 'text' as const, id: 't1' },
          timestamp: new Date(),
          version: 2,
        },
        status: 'pending' as const,
      };

      useCollaborationStore.setState({
        conflicts: [mockConflict],
        syncStatus: { lastSyncedAt: null, pendingOperations: 0, isSyncing: false, hasConflict: true },
        permissions: {
          canEdit: true,
          canDelete: true,
          canInvite: true,
          canRemove: true,
          canChangeRole: true,
          canExport: true,
        },
      });

      useCollaborationStore.getState().resolveConflict('conflict-1', 'merge');

      expect(useToastStore.getState().addToast).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'success', title: '冲突已解决' }),
      );
    });
  });

  describe('getPendingConflicts', () => {
    it('should return only pending conflicts', () => {
      const mockConflicts = [
        {
          id: 'c-1',
          type: 'text' as const,
          originalOperation: {
            id: 'op-1',
            userId: 'u1',
            type: 'update' as const,
            target: { type: 'text' as const, id: 't1' },
            timestamp: new Date(),
            version: 1,
          },
          incomingOperation: {
            id: 'op-2',
            userId: 'u2',
            type: 'update' as const,
            target: { type: 'text' as const, id: 't1' },
            timestamp: new Date(),
            version: 2,
          },
          status: 'pending' as const,
        },
        {
          id: 'c-2',
          type: 'format' as const,
          originalOperation: {
            id: 'op-3',
            userId: 'u1',
            type: 'format' as const,
            target: { type: 'text' as const, id: 't2' },
            timestamp: new Date(),
            version: 1,
          },
          incomingOperation: {
            id: 'op-4',
            userId: 'u2',
            type: 'format' as const,
            target: { type: 'text' as const, id: 't2' },
            timestamp: new Date(),
            version: 2,
          },
          status: 'resolved' as const,
        },
      ];

      useCollaborationStore.setState({ conflicts: mockConflicts });

      const pending = useCollaborationStore.getState().getPendingConflicts();
      expect(pending.length).toBe(1);
      expect(pending[0].id).toBe('c-1');
    });
  });

  describe('getActiveParticipants', () => {
    it('should return participants excluding current user', async () => {
      vi.useFakeTimers();
      const connectPromise = useCollaborationStore.getState().connect('doc-123');
      await vi.advanceTimersByTimeAsync(1100);
      await connectPromise;

      const active = useCollaborationStore.getState().getActiveParticipants();
      const currentUserId = useCollaborationStore.getState().currentUser.id;

      for (const p of active) {
        expect(p.user.id).not.toBe(currentUserId);
      }
    });
  });

  describe('removeParticipant', () => {
    it('should remove a non-owner participant', async () => {
      vi.useFakeTimers();
      const connectPromise = useCollaborationStore.getState().connect('doc-123');
      await vi.advanceTimersByTimeAsync(1100);
      await connectPromise;

      const stateBefore = useCollaborationStore.getState();
      const nonOwnerParticipant = stateBefore.participants.find((p) => p.role !== 'owner');
      expect(nonOwnerParticipant).toBeDefined();

      useCollaborationStore.getState().removeParticipant(nonOwnerParticipant!.id);

      const stateAfter = useCollaborationStore.getState();
      expect(stateAfter.participants.find((p) => p.id === nonOwnerParticipant!.id)).toBeUndefined();
    });

    it('should not remove the owner participant', async () => {
      vi.useFakeTimers();
      const connectPromise = useCollaborationStore.getState().connect('doc-123');
      await vi.advanceTimersByTimeAsync(1100);
      await connectPromise;

      const ownerParticipant = useCollaborationStore.getState().participants.find((p) => p.role === 'owner');
      expect(ownerParticipant).toBeDefined();

      const countBefore = useCollaborationStore.getState().participants.length;
      useCollaborationStore.getState().removeParticipant(ownerParticipant!.id);

      // Owner should not be removed
      expect(useCollaborationStore.getState().participants.length).toBe(countBefore);
    });

    it('should show error toast when trying to remove owner', async () => {
      vi.useFakeTimers();
      const connectPromise = useCollaborationStore.getState().connect('doc-123');
      await vi.advanceTimersByTimeAsync(1100);
      await connectPromise;

      const ownerParticipant = useCollaborationStore.getState().participants.find((p) => p.role === 'owner');
      useCollaborationStore.getState().removeParticipant(ownerParticipant!.id);

      expect(useToastStore.getState().addToast).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'error', title: '操作失败' }),
      );
    });
  });

  describe('clearConflictMarkers', () => {
    it('should clear conflict markers', () => {
      useCollaborationStore.setState({
        conflictMarkers: [
          { operationId: 'op-1', type: 'text', startOffset: 0, endOffset: 10, isLocal: true, timestamp: new Date() },
        ],
      });

      useCollaborationStore.getState().clearConflictMarkers();
      expect(useCollaborationStore.getState().conflictMarkers).toEqual([]);
    });
  });

  describe('syncOperations', () => {
    it('should set isSyncing to true then false after sync', () => {
      vi.useFakeTimers();
      useCollaborationStore.getState().syncOperations();

      expect(useCollaborationStore.getState().syncStatus.isSyncing).toBe(true);

      vi.advanceTimersByTimeAsync(600);

      expect(useCollaborationStore.getState().syncStatus.isSyncing).toBe(false);
      expect(useCollaborationStore.getState().syncStatus.pendingOperations).toBe(0);
    });
  });

  describe('setCursorPosition', () => {
    it('should update current user cursor position', async () => {
      vi.useFakeTimers();
      const connectPromise = useCollaborationStore.getState().connect('doc-123');
      await vi.advanceTimersByTimeAsync(1100);
      await connectPromise;

      useCollaborationStore.getState().setCursorPosition({ paragraphIndex: 5, offset: 20 });

      const state = useCollaborationStore.getState();
      const currentParticipant = state.participants.find((p) => p.user.id === state.currentUser.id);
      expect(currentParticipant?.cursor?.paragraphIndex).toBe(5);
      expect(currentParticipant?.cursor?.offset).toBe(20);
    });
  });

  describe('edge cases', () => {
    it('should handle multiple rapid connect/disconnect cycles', async () => {
      vi.useFakeTimers();
      const p1 = useCollaborationStore.getState().connect('doc-1');
      await vi.advanceTimersByTimeAsync(1100);
      await p1;

      useCollaborationStore.getState().disconnect();

      const p2 = useCollaborationStore.getState().connect('doc-2');
      await vi.advanceTimersByTimeAsync(1100);
      await p2;

      expect(useCollaborationStore.getState().isConnected).toBe(true);
      expect(useCollaborationStore.getState().session?.documentId).toBe('doc-2');
    });

    it('should not crash when resolving non-existent conflict', () => {
      expect(() => {
        useCollaborationStore.getState().resolveConflict('non-existent-id', 'keep-local');
      }).not.toThrow();
    });
  });
});
