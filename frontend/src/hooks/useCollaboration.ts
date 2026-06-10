import { logger } from '@/utils/safeLogger'
import { useState, useCallback, useRef, useEffect } from 'react';
import type {
  Collaborator,
  Annotation,
  CommentThread,
  VersionInfo,
  ShareSettings,
  AccessStatistics,
  CollaborationSession,
  RealtimeEvent,
} from '../types/collaboration.types';
import { CollaborationPermission } from '../types/collaboration.types';

export interface UseCollaborationReturn {
  session: CollaborationSession | null;
  isConnected: boolean;

  collaborators: Collaborator[];
  annotations: Annotation[];
  commentThreads: CommentThread[];
  versions: VersionInfo[];

  joinSession: (reportId: string) => Promise<void>;
  leaveSession: () => void;

  addCollaborator: (email: string, permission: CollaborationPermission) => Promise<boolean>;
  removeCollaborator: (userId: string) => Promise<void>;
  updatePermission: (userId: string, permission: CollaborationPermission) => Promise<void>;

  addAnnotation: (annotation: Omit<Annotation, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Annotation>;
  updateAnnotation: (id: string, updates: Partial<Annotation>) => Promise<void>;
  deleteAnnotation: (id: string) => Promise<void>;
  resolveAnnotation: (id: string) => Promise<void>;

  addCommentThread: (thread: Omit<CommentThread, 'id' | 'createdAt' | 'updatedAt' | 'annotations'>) => Promise<CommentThread>;
  replyToComment: (threadId: string, content: string) => Promise<void>;

  saveVersion: (message?: string) => Promise<VersionInfo>;
  getVersion: (versionId: string) => Promise<VersionInfo>;
  compareVersions: (version1Id: string, version2Id: string) => Promise<VersionDiff>;
  restoreVersion: (versionId: string) => Promise<void>;

  shareSettings: ShareSettings;
  updateShareSettings: (settings: Partial<ShareSettings>) => Promise<void>;
  generateShareLink: () => Promise<string>;

  accessStats: AccessStatistics | null;
  fetchAccessStats: () => Promise<void>;

  realtimeEvents: RealtimeEvent[];
}

export interface VersionDiff {
  version1: VersionInfo;
  version2: VersionInfo;
  changes: {
    type: 'add' | 'modify' | 'delete';
    sectionId: string;
    content: string;
    highlight?: 'green' | 'red' | 'yellow';
  }[];
}

export function useCollaboration(): UseCollaborationReturn {
  const [session, setSession] = useState<CollaborationSession | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [commentThreads, setCommentThreads] = useState<CommentThread[]>([]);
  const [versions, setVersions] = useState<VersionInfo[]>([]);
  const [shareSettings, setShareSettings] = useState<ShareSettings>({
    isPublic: false,
    accessType: 'link',
    allowDownload: true,
    allowCopy: true,
    allowComment: true,
  });
  const [accessStats, setAccessStats] = useState<AccessStatistics | null>(null);
  const [realtimeEvents, setRealtimeEvents] = useState<RealtimeEvent[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const eventBufferRef = useRef<RealtimeEvent[]>([]);

  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const joinSession = useCallback(async (reportId: string): Promise<void> => {
    try {
      setIsConnected(true);

      const mockSession: CollaborationSession = {
        reportId,
        sessionId: `session-${Date.now()}`,
        collaborators: [
          {
            id: 'user-current',
            name: '当前用户',
            email: 'current@rmfood.com',
            permission: CollaborationPermission.ADMIN,
            joinedAt: new Date().toISOString(),
            lastActiveAt: new Date().toISOString(),
            isOnline: true,
          },
        ],
        activeAnnotations: [],
        currentVersion: {
          id: 'version-1',
          versionNumber: 1,
          createdBy: { id: 'user-current', name: '当前用户', email: '', permission: CollaborationPermission.ADMIN, joinedAt: '', lastActiveAt: '', isOnline: true },
          createdAt: new Date().toISOString(),
          message: '初始版本',
          changes: [],
          fileSize: 0,
          checksum: '',
        },
        cursorPositions: new Map(),
        selectionRanges: new Map(),
        lastSyncAt: new Date().toISOString(),
      };

      setSession(mockSession);
      setCollaborators(mockSession.collaborators);
      setVersions([mockSession.currentVersion]);

    } catch (error) {
      logger.error('Failed to join collaboration session:', error);
      throw error;
    }
  }, []);

  const leaveSession = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setSession(null);
    setIsConnected(false);
    setCollaborators([]);
    setAnnotations([]);
  }, []);

  const addCollaborator = useCallback(async (
    email: string,
    permission: CollaborationPermission,
  ): Promise<boolean> => {
    const newCollaborator: Collaborator = {
      id: `user-${Date.now()}`,
      name: email.split('@')[0],
      email,
      permission,
      joinedAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      isOnline: false,
    };

    setCollaborators(prev => [...prev, newCollaborator]);
    return true;
  }, []);

  const removeCollaborator = useCallback(async (userId: string): Promise<void> => {
    setCollaborators(prev => prev.filter(c => c.id !== userId));
  }, []);

  const updatePermission = useCallback(async (
    userId: string,
    permission: CollaborationPermission,
  ): Promise<void> => {
    setCollaborators(prev =>
      prev.map(c => c.id === userId ? { ...c, permission } : c),
    );
  }, []);

  const addAnnotation = useCallback(async (
    annotationData: Omit<Annotation, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<Annotation> => {
    const newAnnotation: Annotation = {
      ...annotationData,
      id: `annotation-${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setAnnotations(prev => [...prev, newAnnotation]);
    return newAnnotation;
  }, []);

  const updateAnnotation = useCallback(async (
    id: string,
    updates: Partial<Annotation>,
  ): Promise<void> => {
    setAnnotations(prev =>
      prev.map(a => a.id === id ? { ...a, ...updates, updatedAt: new Date().toISOString() } : a),
    );
  }, []);

  const deleteAnnotation = useCallback(async (id: string): Promise<void> => {
    setAnnotations(prev => prev.filter(a => a.id !== id));
  }, []);

  const resolveAnnotation = useCallback(async (id: string): Promise<void> => {
    updateAnnotation(id, {
      resolved: true,
      resolvedAt: new Date().toISOString(),
    });
  }, [updateAnnotation]);

  const addCommentThread = useCallback(async (
    threadData: Omit<CommentThread, 'id' | 'createdAt' | 'updatedAt' | 'annotations'>,
  ): Promise<CommentThread> => {
    const newThread: CommentThread = {
      ...threadData,
      id: `thread-${Date.now()}`,
      annotations: [],
      status: 'open',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setCommentThreads(prev => [...prev, newThread]);
    return newThread;
  }, []);

  const replyToComment = useCallback(async (threadId: string, content: string): Promise<void> => {
    logger.log(`Replying to thread ${threadId}:`, content);
  }, []);

  const saveVersion = useCallback(async (message?: string): Promise<VersionInfo> => {
    const newVersion: VersionInfo = {
      id: `version-${Date.now()}`,
      versionNumber: versions.length + 1,
      createdBy: collaborators[0] || { id: '', name: '', email: '', permission: CollaborationPermission.VIEW, joinedAt: '', lastActiveAt: '', isOnline: false },
      createdAt: new Date().toISOString(),
      message: message || `版本 ${versions.length + 1}`,
      changes: [],
      fileSize: Math.floor(Math.random() * 1000000),
      checksum: `hash-${Date.now()}`,
    };

    setVersions(prev => [...prev, newVersion]);
    return newVersion;
  }, [collaborators, versions.length]);

  const getVersion = useCallback(async (versionId: string): Promise<VersionInfo> => {
    return versions.find(v => v.id === versionId) || versions[0];
  }, [versions]);

  const compareVersions = useCallback(async (
    version1Id: string,
    version2Id: string,
  ): Promise<VersionDiff> => {
    const v1 = versions.find(v => v.id === version1Id);
    const v2 = versions.find(v => v.id === version2Id);

    return {
      version1: v1!,
      version2: v2!,
      changes: [
        { type: 'modify', sectionId: 'intro', content: '修改了引言部分内容', highlight: 'yellow' },
        { type: 'add', sectionId: 'new-section', content: '新增了章节', highlight: 'green' },
        { type: 'delete', sectionId: 'old-section', content: '删除了章节', highlight: 'red' },
      ],
    };
  }, [versions]);

  const restoreVersion = useCallback(async (versionId: string): Promise<void> => {
    logger.log('Restoring version:', versionId);
  }, []);

  const updateShareSettingsInternal = useCallback((settings: Partial<ShareSettings>) => {
    setShareSettings(prev => ({ ...prev, ...settings }));
  }, []);

  const updateShareSettings = useCallback(async (settings: Partial<ShareSettings>): Promise<void> => {
    updateShareSettingsInternal(settings);
  }, [updateShareSettingsInternal]);

  const generateShareLink = useCallback(async (): Promise<string> => {
    const link = `${window.location.origin}/share/report/${session?.reportId}?token=${Date.now()}`;
    updateShareSettingsInternal({ link });
    return link;
  }, [session?.reportId, updateShareSettingsInternal]);

  const fetchAccessStats = useCallback(async (): Promise<void> => {
    const mockStats: AccessStatistics = {
      totalViews: Math.floor(Math.random() * 1000),
      uniqueVisitors: Math.floor(Math.random() * 500),
      totalDownloads: Math.floor(Math.random() * 200),
      averageTimeOnPage: Math.floor(Math.random() * 300) + 60,
      viewsByDate: Array.from({ length: 7 }, (_, i) => ({
        date: new Date(Date.now() - (6 - i) * 86400000).toISOString().split('T')[0],
        count: Math.floor(Math.random() * 50),
      })),
      topReferrers: [
        { source: '直接访问', count: Math.floor(Math.random() * 200) },
        { source: '搜索引擎', count: Math.floor(Math.random() * 100) },
        { source: '社交媒体', count: Math.floor(Math.random() * 80) },
      ],
      geographicDistribution: [
        { country: '中国', count: Math.floor(Math.random() * 400) },
        { country: '美国', count: Math.floor(Math.random() * 100) },
        { country: '日本', count: Math.floor(Math.random() * 50) },
      ],
    };
    setAccessStats(mockStats);
  }, []);

  return {
    session,
    isConnected,
    collaborators,
    annotations,
    commentThreads,
    versions,

    joinSession,
    leaveSession,

    addCollaborator,
    removeCollaborator,
    updatePermission,

    addAnnotation,
    updateAnnotation,
    deleteAnnotation,
    resolveAnnotation,

    addCommentThread,
    replyToComment,

    saveVersion,
    getVersion,
    compareVersions,
    restoreVersion,

    shareSettings,
    updateShareSettings,
    generateShareLink,

    accessStats,
    fetchAccessStats,

    realtimeEvents: eventBufferRef.current,
  };
}
