export enum CollaborationPermission {
  VIEW = 'view',
  COMMENT = 'comment',
  EDIT = 'edit',
  ADMIN = 'admin'
}

export enum ShareAccessType {
  LINK = 'link',
  EMAIL = 'email',
  EMBED = 'embed'
}

export interface Collaborator {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  permission: CollaborationPermission;
  joinedAt: string;
  lastActiveAt: string;
  isOnline: boolean;
  role?: string;
}

export interface Annotation {
  id: string;
  type: 'text' | 'drawing' | 'highlight';
  author: Collaborator;
  content: string;
  position: {
    page?: number;
    sectionId?: string;
    x: number;
    y: number;
  };
  createdAt: string;
  updatedAt: string;
  resolved: boolean;
  resolvedBy?: Collaborator;
  resolvedAt?: string;
  mentions?: string[];
  replies?: AnnotationReply[];
}

export interface AnnotationReply {
  id: string;
  author: Collaborator;
  content: string;
  createdAt: string;
}

export interface CommentThread {
  id: string;
  targetSectionId: string;
  targetParagraphIndex?: number;
  title: string;
  annotations: Annotation[];
  status: 'open' | 'resolved' | 'closed';
  createdAt: string;
  updatedAt: string;
}

export interface VersionInfo {
  id: string;
  versionNumber: number;
  createdBy: Collaborator;
  createdAt: string;
  message: string;
  changes: VersionChange[];
  fileSize: number;
  checksum: string;
}

export interface VersionChange {
  type: 'add' | 'modify' | 'delete' | 'move';
  sectionId?: string;
  description: string;
  details?: Record<string, any>;
}

export interface ShareSettings {
  isPublic: boolean;
  accessType: ShareAccessType;
  link?: string;
  password?: string;
  expiresAt?: string | null;
  maxViews?: number | null;
  allowDownload: boolean;
  allowCopy: boolean;
  allowComment: boolean;
  allowedDomains?: string[];
}

export interface AccessStatistics {
  totalViews: number;
  uniqueVisitors: number;
  totalDownloads: number;
  averageTimeOnPage: number;
  viewsByDate: { date: string; count: number }[];
  topReferrers: { source: string; count: number }[];
  geographicDistribution: { country: string; count: number }[];
}

export interface CollaborationSession {
  reportId: string;
  sessionId: string;
  collaborators: Collaborator[];
  activeAnnotations: Annotation[];
  currentVersion: VersionInfo;
  cursorPositions: Map<string, { x: number; y: number; page: number }>;
  selectionRanges: Map<string, { start: number; end: number }>;
  lastSyncAt: string;
}

export interface RealtimeEvent {
  type: 'cursor_move' | 'selection_change' | 'annotation_add' |
       'annotation_update' | 'annotation_delete' | 'version_save' |
       'user_join' | 'user_leave' | 'typing';
  userId: string;
  timestamp: number;
  payload: any;
}
