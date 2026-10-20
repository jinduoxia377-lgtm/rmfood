/**
 * 组织管理模块 (Organizations) 完整 TypeScript 类型定义
 * 覆盖组织、成员、团队、权限等核心数据结构及 API/组件类型
 */

// ============ 枚举类型 ============

/** 组织内角色 */
export type Role = 'owner' | 'admin' | 'member' | 'viewer' | 'custom';

/** 订阅计划类型 */
export type PlanType = 'free' | 'pro' | 'enterprise';

/** 权限资源类型 */
export type ResourceType = 'organization' | 'team' | 'formula' | 'experiment' | 'data';

/** 权限操作动作 */
export type PermissionAction = 'create' | 'read' | 'update' | 'delete' | 'admin';

/** 组织状态 */
export type OrganizationStatus = 'active' | 'suspended' | 'archived';

/** 列表视图模式 */
export type ViewMode = 'card' | 'table' | 'compact';

/** 成员状态 */
export type MemberStatus = 'active' | 'invited' | 'suspended' | 'removed';

/** 排序字段 */
export type OrganizationSortField = 'name' | 'createdAt' | 'memberCount' | 'storageUsed';

/** 批量操作类型 */
export type BulkOperationType = 'delete' | 'archive' | 'transfer' | 'changePlan';

/** 导出格式 */
export type ExportFormat = 'csv' | 'json' | 'excel' | 'pdf';

// ============ 核心数据接口 ============

/**
 * 组织实体
 * 表示一个独立的工作空间或企业租户
 */
export interface Organization {
  /** 唯一标识符 */
  id: string;
  /** 组织显示名称 */
  name: string;
  /** URL 友好的唯一标识（用于子域名或路径） */
  slug: string;
  /** 组织描述信息 */
  description: string;
  /** 当前订阅计划 */
  plan: PlanType;
  /** 组织头像 URL */
  avatar: string | null;
  /** 成员总数 */
  memberCount: number;
  /** 团队总数 */
  teamCount: number;
  /** 已使用存储空间（字节） */
  storageUsed: number;
  /** 存储空间上限（字节） */
  storageLimit: number;
  /** 本月 API 调用次数 */
  apiCalls: number;
  /** 创建时间（ISO 8601） */
  createdAt: string;
  /** 最后更新时间（ISO 8601） */
  updatedAt: string;
  /** 组织当前状态 */
  status: OrganizationStatus;
  /** 是否被当前用户收藏 */
  isFavorite: boolean;
  /** 是否被置顶 */
  isPinned: boolean;
  /** 当前用户在此组织中的角色 */
  myRole?: string;
}

/**
 * 组织成员
 * 表示用户在某个组织内的身份与权限
 */
export interface Member {
  /** 成员记录 ID */
  id: string;
  /** 所属组织 ID */
  organizationId: string;
  /** 关联的用户 ID */
  userId: string;
  /** 成员显示名称 */
  name: string;
  /** 成员邮箱地址 */
  email: string;
  /** 头像 URL */
  avatar: string | null;
  /** 在该组织中的角色 */
  role: Role;
  /** 加入时间（ISO 8601） */
  joinedAt: string;
  /** 最后活跃时间（ISO 8601） */
  lastActiveAt: string;
  /** 成员当前状态 */
  status: MemberStatus;
}

/**
 * 团队
 * 组织内部的工作分组，支持嵌套层级
 */
export interface Team {
  /** 团队唯一标识符 */
  id: string;
  /** 所属组织 ID */
  organizationId: string;
  /** 团队名称 */
  name: string;
  /** 团队描述 */
  description: string | null;
  /** 父级团队 ID（顶级团队为 null） */
  parentId: string | null;
  /** 团队成员 ID 列表 */
  memberIds: string[];
  /** 创建时间（ISO 8601） */
  createdAt: string;
}

/**
 * 权限条目
 * 描述对某类资源可执行的操作集合
 */
export interface Permission {
  /** 资源标识符 */
  resourceId: string;
  /** 资源类型分类 */
  resourceType: ResourceType;
  /** 允许的操作列表 */
  actions: PermissionAction[];
}

/**
 * 角色权限映射
 * 定义每个角色对应的完整权限矩阵
 */
export interface RolePermissionMap {
  role: Role;
  permissions: Permission[];
  /** 自定义角色的可配置标记 */
  isCustomizable?: boolean;
}

/**
 * 组织统计摘要
 * 用于仪表盘展示的关键指标
 */
export interface OrganizationStats {
  organizationId: string;
  totalMembers: number;
  activeMembers: number;
  totalTeams: number;
  totalFormulas: number;
  totalExperiments: number;
  storageUsagePercent: number;
  apiCallsThisMonth: number;
  apiCallsLimit: number;
}

/**
 * 邀请记录
 * 追踪发送给潜在成员的邀请
 */
export interface Invitation {
  id: string;
  organizationId: string;
  inviterId: string;
  inviteeEmail: string;
  role: Role;
  token: string;
  expiresAt: string;
  acceptedAt: string | null;
  status: 'pending' | 'accepted' | 'expired' | 'revoked';
  createdAt: string;
}

// ============ API 请求 / 响应类型 ============

/**
 * 获取组织列表请求参数
 */
export interface GetOrganizationsRequest {
  /** 当前页码（从 1 开始） */
  page?: number;
  /** 每页条数 */
  pageSize?: number;
  /** 搜索关键词（匹配名称、描述） */
  search?: string;
  /** 筛选条件 */
  filters?: OrganizationFilters;
  /** 排序字段 */
  sortBy?: OrganizationSortField;
  /** 排序方向 */
  sortOrder?: 'asc' | 'desc';
}

/**
 * 组织列表筛选条件
 */
export interface OrganizationFilters {
  /** 按订阅计划筛选 */
  plan?: PlanType[];
  /** 按状态筛选 */
  status?: OrganizationStatus[];
  /** 仅查看收藏 */
  favoriteOnly?: boolean;
  /** 仅查看我拥有的 */
  ownedOnly?: boolean;
  /** 按创建日期范围筛选 */
  dateRange?: { start: string; end: string };
}

/**
 * 获取组织列表响应
 */
export interface GetOrganizationsResponse {
  data: Organization[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * 创建组织请求体
 */
export interface CreateOrganizationRequest {
  name: string;
  slug?: string;
  description?: string;
  plan?: PlanType;
  avatar?: string;
}

/**
 * 更新组织请求体
 */
export interface UpdateOrganizationRequest extends Partial<CreateOrganizationRequest> {
  id: string;
  status?: OrganizationStatus;
  isFavorite?: boolean;
  isPinned?: boolean;
}

/**
 * 批量操作请求
 */
export interface BulkOperationRequest {
  ids: string[];
  operation: BulkOperationType;
  payload?: Record<string, unknown>;
}

/**
 * 批量操作响应
 */
export interface BulkOperationResponse {
  success: boolean;
  succeeded: string[];
  failed: { id: string; reason: string }[];
  totalProcessed: number;
}

/**
 * 数据导出请求
 */
export interface ExportRequest {
  organizationIds?: string[];
  format: ExportFormat;
  includeMembers?: boolean;
  includeTeams?: boolean;
  includeStats?: boolean;
  dateRange?: { start: string; end: string };
}

/**
 * 数据导出响应
 */
export interface ExportResponse {
  downloadUrl: string;
  fileName: string;
  fileSize: number;
  expiresAt: string;
  recordCount: number;
}

/**
 * 获取成员列表请求
 */
export interface GetMembersRequest {
  organizationId: string;
  page?: number;
  pageSize?: number;
  search?: string;
  role?: Role;
  status?: MemberStatus;
  sortBy?: 'name' | 'role' | 'joinedAt' | 'lastActiveAt';
  sortOrder?: 'asc' | 'desc';
}

/**
 * 获取成员列表响应
 */
export interface GetMembersResponse {
  data: Member[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * 邀请成员请求
 */
export interface InviteMemberRequest {
  organizationId: string;
  emails: string[];
  role: Role;
  message?: string;
}

/**
 * 更新成员角色请求
 */
export interface UpdateMemberRoleRequest {
  organizationId: string;
  memberId: string;
  role: Role;
}

/**
 * 移除成员请求
 */
export interface RemoveMemberRequest {
  organizationId: string;
  memberId: string;
  transferOwnershipTo?: string;
}

/**
 * 获取团队列表请求
 */
export interface GetTeamsRequest {
  organizationId: string;
  parentId?: string | null;
  includeMembers?: boolean;
}

/**
 * 获取团队列表响应
 */
export interface GetTeamsResponse {
  data: Team[];
  total: number;
}

/**
 * 创建团队请求
 */
export interface CreateTeamRequest {
  organizationId: string;
  name: string;
  description?: string;
  parentId?: string | null;
  memberIds?: string[];
}

/**
 * 更新团队请求
 */
export interface UpdateTeamRequest {
  teamId: string;
  name?: string;
  description?: string;
  parentId?: string | null;
  memberIds?: string[];
}

/**
 * 获取权限矩阵请求
 */
export interface GetPermissionsRequest {
  organizationId: string;
  roleId?: Role;
}

/**
 * 获取权限矩阵响应
 */
export interface GetPermissionsResponse {
  roles: RolePermissionMap[];
  resourceTypes: ResourceType[];
}

/**
 * 更新自定义角色权限请求
 */
export interface UpdateCustomRolePermissionsRequest {
  organizationId: string;
  roleId: string;
  permissions: Permission[];
}

// ============ 组件 Props 类型 ============

/**
 * 组织列表组件 Props
 */
export interface OrganizationListProps {
  organizations: Organization[];
  loading?: boolean;
  viewMode?: ViewMode;
  selectedIds?: string[];
  onSelect?: (ids: string[]) => void;
  onRefresh?: () => void;
  onCreate?: () => void;
  onDelete?: (ids: string[]) => void;
  onExport?: (format: ExportFormat) => void;
  onViewDetail?: (organizationId: string) => void;
  pagination?: {
    current: number;
    pageSize: number;
    total: number;
    onChange: (page: number, pageSize: number) => void;
  };
  searchable?: boolean;
  filterable?: boolean;
  selectable?: boolean;
}

/**
 * 组织卡片组件 Props
 */
export interface OrganizationCardProps {
  organization: Organization;
  selected?: boolean;
  onSelect?: (id: string, selected: boolean) => void;
  onClick?: (id: string) => void;
  onFavorite?: (id: string, favorite: boolean) => void;
  onPin?: (id: string, pinned: boolean) => void;
  showActions?: boolean;
  compact?: boolean;
}

/**
 * 组织详情组件 Props
 */
export interface OrganizationDetailProps {
  organization: Organization;
  stats?: OrganizationStats;
  loading?: boolean;
  onEdit?: (data: UpdateOrganizationRequest) => void;
  onDelete?: () => void;
  onLeave?: () => void;
  onInviteMember?: (request: InviteMemberRequest) => void;
  onChangePlan?: (plan: PlanType) => void;
  onExportData?: (request: ExportRequest) => void;
  editable?: boolean;
  showTabs?: string[];
  activeTab?: string;
  onTabChange?: (tab: string) => void;
}

/**
 * 成员列表组件 Props
 */
export interface MemberListProps {
  members: Member[];
  loading?: boolean;
  currentUserId?: string;
  currentUserRole?: Role;
  onInvite?: () => void;
  onUpdateRole?: (memberId: string, role: Role) => void;
  onRemove?: (memberId: string) => void;
  onViewProfile?: (userId: string) => void;
  searchable?: boolean;
  filterableByRole?: boolean;
  showLastActive?: boolean;
  pagination?: {
    current: number;
    pageSize: number;
    total: number;
    onChange: (page: number, pageSize: number) => void;
  };
}

/**
 * 权限矩阵组件 Props
 */
export interface PermissionMatrixProps {
  roles: RolePermissionMap[];
  resourceTypes: ResourceType[];
  editable?: boolean;
  onChange?: (roleId: string, permissions: Permission[]) => void;
  onReset?: (roleId: string) => void;
  collapsed?: boolean;
  showInherited?: boolean;
}

/**
 * 角色编辑器组件 Props
 */
export interface RoleEditorProps {
  role: RolePermissionMap;
  resourceTypes: ResourceType[];
  allActions: PermissionAction[];
  onSave: (permissions: Permission[]) => void;
  onCancel?: () => void;
  readonly?: boolean;
}

/**
 * 团队树形组件 Props
 */
export interface TeamTreeProps {
  teams: Team[];
  selectedTeamId?: string | null;
  onSelect?: (teamId: string) => void;
  onCreate?: (parentId: string | null) => void;
  onRename?: (teamId: string, name: string) => void;
  onDelete?: (teamId: string) => void;
  onMove?: (teamId: string, newParentId: string | null) => void;
  draggable?: boolean;
  expandable?: boolean;
}

/**
 * 组织表单组件 Props（创建/编辑）
 */
export interface OrganizationFormProps {
  mode: 'create' | 'edit';
  initialValues?: Partial<Organization>;
  loading?: boolean;
  onSubmit: (data: CreateOrganizationRequest | UpdateOrganizationRequest) => void;
  onCancel?: () => void;
  planOptions?: { value: PlanType; label: string; description?: string }[];
}

/**
 * 组织筛选栏组件 Props
 */
export interface OrganizationFilterProps {
  filters: OrganizationFilters;
  viewMode: ViewMode;
  resultCount: number;
  onFiltersChange: (filters: OrganizationFilters) => void;
  onViewModeChange: (mode: ViewMode) => void;
  onSearch?: (keyword: string) => void;
  planOptions?: { value: PlanType; label: string }[];
  exportable?: boolean;
  onExport?: (format: ExportFormat) => void;
}

/**
 * 存储用量指示器 Props
 */
export interface StorageUsageIndicatorProps {
  used: number;
  limit: number;
  showLabel?: boolean;
  showDetails?: boolean;
  size?: 'small' | 'medium' | 'large';
  onClick?: () => void;
}

/**
 * 邀请对话框组件 Props
 */
export interface InviteDialogProps {
  open: boolean;
  organizationId: string;
  availableRoles: { value: Role; label: string; description?: string }[];
  onInvite: (request: InviteMemberRequest) => void;
  onClose: () => void;
  loading?: boolean;
}
