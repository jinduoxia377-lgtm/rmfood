/**
 * 增强型组织列表组件 - 支持卡片/表格/紧凑三种视图模式
 */
import React, { memo, useMemo, useCallback } from 'react';
import {
  Building2,
  Users,
  Settings,
  Clock,
  HardDrive,
  Zap,
  Star,
  Pin,
  Crown,
  Shield,
  UserCheck,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Copy,
} from 'lucide-react';
import type { ViewMode } from '@/types/organization.types';
import type { Organization } from '@/hooks/useOrganizations';

interface OrganizationListProps {
  organizations: Organization[];
  loading?: boolean;
  viewMode: ViewMode;
  search: string;
  selectedIds: Set<number>;
  onToggleSelect: (id: number) => void;
  onSelectAll: () => void;
  onNavigateToDetail: (id: number) => void;
  onToggleFavorite: (id: number) => void;
  onTogglePin: (id: number) => void;
  onClone?: (id: number) => void;
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

const PlanBadgeConfig = {
  free: { label: '免费版', className: 'bg-[var(--bg-tertiary)] text-[var(--text-primary)] dark:bg-[var(--bg-tertiary)] dark:text-[var(--text-muted)]' },
  pro: { label: '专业版', className: 'bg-[var(--color-secondary-container)] text-[var(--color-secondary-text)] dark:bg-[var(--color-secondary-container)]/25 dark:text-[var(--color-secondary-text)]' },
  enterprise: {
    label: '企业版',
    className: 'bg-[var(--color-accent-container)] text-[var(--color-accent-text)] dark:bg-[var(--color-accent-container)]/25 dark:text-[var(--color-accent-text)]',
  },
};

const RoleIcon = ({ role }: { role: string }) => {
  switch (role) {
    case 'owner':
      return <Crown className="w-4 h-4 text-[var(--color-warning-text)]0" />;
    case 'admin':
      return <Shield className="w-4 h-4 text-[var(--color-secondary-text)]0" />;
    case 'member':
    default:
      return <UserCheck className="w-4 h-4 text-[var(--color-success-text)]0" />;
  }
};

// 卡片视图项
const OrganizationCard = memo(
  ({
    org,
    isSelected,
    search,
    onToggleSelect,
    onNavigateToDetail,
    onToggleFavorite,
    onTogglePin,
    onClone,
  }: {
    org: Organization;
    isSelected: boolean;
    search: string;
    onToggleSelect: (id: number) => void;
    onNavigateToDetail: (id: number) => void;
    onToggleFavorite: (id: number) => void;
    onTogglePin: (id: number) => void;
    onClone?: (id: number) => void;
  }) => {
    const planConfig = PlanBadgeConfig[org.plan] || PlanBadgeConfig.free;

    const highlightText = (text: string) => {
      if (!search) return text;
      const regex = new RegExp(`(${search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
      const parts = text.split(regex);
      return parts.map((part, i) =>
        regex.test(part) ? (
          <mark key={i} className="bg-[var(--color-warning-container)] dark:bg-[var(--color-warning-container)] rounded px-0.5">
            {part}
          </mark>
        ) : (
          part
        ),
      );
    };

    const storagePercent = org.storageLimit > 0 ? (org.storageUsed / org.storageLimit) * 100 : 0;

    return (
      <div
        className={`bg-[var(--bg-secondary)] rounded-[var(--radius-Apple-md)] border transition-all duration-200 ${
          isSelected
            ? 'border-[var(--color-primary)] shadow-md ring-2 ring-[var(--color-primary-container)] dark:ring-primary-900/50'
            : 'border-[var(--border-color)] hover:border-[var(--color-primary-border)] hover:shadow-lg'
        } ${org.isPinned ? 'ring-2 ring-[var(--color-warning-container)]' : ''}`}
      >
        <div className="p-[var(--space-apple-lg)]">
          {/* 头部 */}
          <div className="flex items-start justify-between mb-[var(--space-apple-md)]">
            <div className="flex items-center gap-[var(--space-apple-sm)] flex-1 min-w-0">
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => onToggleSelect(org.id)}
                className="w-4 h-4 rounded border-[var(--border-color)] dark:border-neutral-700 text-[var(--color-primary-text)] focus:ring-[var(--color-primary)]"
              />
              <div className="w-12 h-12 bg-gradient-to-br from-[var(--color-secondary-surface)] to-[var(--color-accent-surface-deep)] rounded-[var(--radius-Apple-md)] flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                {org.name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-[var(--text-primary)] truncate">{highlightText(org.name)}</h3>
                <p className="text-sm text-[var(--text-muted)] truncate">@{highlightText(org.slug)}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 ml-2">
              <RoleIcon role={org.myRole || 'member'} />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleFavorite(org.id);
                }}
                className={`p-1.5 rounded-[var(--radius-Apple-sm)] transition-colors ${org.isFavorite ? 'text-[var(--color-warning-text)]0 bg-[var(--color-warning-container)]' : 'text-[var(--text-muted)] hover:text-[var(--color-warning-text)]0 hover:bg-[var(--bg-secondary)]'}`}
              >
                <Star className={`w-4 h-4 ${org.isFavorite ? 'fill-current' : ''}`} />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onTogglePin(org.id);
                }}
                className={`p-1.5 rounded-[var(--radius-Apple-sm)] transition-colors ${org.isPinned ? 'text-[var(--color-secondary-text)]0 bg-[var(--color-secondary-container)] dark:bg-[var(--color-secondary-container)]/20' : 'text-[var(--text-muted)] hover:text-[var(--color-secondary-text)]0 hover:bg-[var(--bg-secondary)]'}`}
              >
                <Pin className={`w-4 h-4 ${org.isPinned ? 'fill-current' : ''}`} />
              </button>
            </div>
          </div>

          {/* 计划徽章 */}
          <span className={`inline-block px-2.5 py-1 rounded-[var(--radius-pill)] text-xs font-medium mb-[var(--space-apple-md)] ${planConfig.className}`}>
            {planConfig.label}
          </span>

          {/* 统计数据 */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-[var(--space-apple-sm)] mb-[var(--space-apple-md)]">
            <div className="text-center p-[var(--space-apple-sm)] bg-[var(--bg-tertiary)] rounded-[var(--radius-Apple-sm)]">
              <Users className="w-5 h-5 mx-auto mb-1 text-[var(--color-secondary-text)]0" />
              <p className="text-lg font-bold text-[var(--text-primary)]">{org.memberCount}</p>
              <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">成员</p>
            </div>
            <div className="text-center p-[var(--space-apple-sm)] bg-[var(--bg-tertiary)] rounded-[var(--radius-Apple-sm)]">
              <Settings className="w-5 h-5 mx-auto mb-1 text-[var(--color-success-text)]0" />
              <p className="text-lg font-bold text-[var(--text-primary)]">{org.teamCount}</p>
              <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">团队</p>
            </div>
            <div className="text-center p-[var(--space-apple-sm)] bg-[var(--bg-tertiary)] rounded-[var(--radius-Apple-sm)]">
              <Clock className="w-5 h-5 mx-auto mb-1 text-[var(--color-accent-text)]0" />
              <p className="text-sm font-bold text-[var(--text-primary)]">
                {new Date(org.createdAt).toLocaleDateString('zh-CN', { month: 'short', year: 'numeric' })}
              </p>
              <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">创建于</p>
            </div>
          </div>

          {/* 底部操作区 */}
          <div className="pt-[var(--space-apple-md)] border-t border-[var(--border-color)]">
            <div className="flex items-center justify-between text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mb-[var(--space-apple-sm)]">
              <span className="flex items-center gap-1">
                <HardDrive className="w-3.5 h-3.5" />
                存储: {(org.storageUsed / (1024 ** 3)).toFixed(1)}GB / {(org.storageLimit / (1024 ** 3)).toFixed(1)}GB
              </span>
              <span className="flex items-center gap-1">
                <Zap className="w-3.5 h-3.5" />
                API: {(org.apiUsage / 1000).toFixed(1)}K / {(org.apiLimit / 1000).toFixed(0)}K
              </span>
            </div>

            {/* 存储进度条 */}
            <div className="mb-[var(--space-apple-sm)]">
              <div className="h-1.5 bg-[var(--border-color)] rounded-[var(--radius-pill)] overflow-hidden">
                <div
                  className={`h-full rounded-[var(--radius-pill)] transition-all ${
                    storagePercent >= 90 ? 'bg-[var(--color-error-container)]0' : storagePercent >= 60 ? 'bg-[var(--color-warning-container)]0' : 'bg-[var(--color-success-container)]0'
                  }`}
                  style={{ width: `${Math.min(storagePercent, 100)}%` }}
                />
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => onNavigateToDetail(org.id)}
                className="flex-1 px-[var(--space-apple-sm)] py-2 min-h-[44px] inline-flex items-center justify-center bg-[var(--bg-tertiary)] hover:bg-[var(--border-color)] dark:hover:bg-[var(--bg-secondary)] text-[var(--text-primary)] rounded-[var(--radius-Apple-sm)] transition-colors text-sm font-medium"
              >
                管理
              </button>
              {onClone && (
                <button
                  onClick={() => onClone(Number(org.id))}
                  title="克隆组织"
                  className="px-[var(--space-apple-sm)] py-2 min-h-[44px] inline-flex items-center justify-center bg-[var(--bg-tertiary)] hover:bg-[var(--color-secondary-container)] dark:hover:bg-[var(--color-secondary-container)]/20 text-[var(--text-primary)] hover:text-[var(--color-secondary-text)] dark:hover:text-[var(--color-secondary-text)] rounded-[var(--radius-Apple-sm)] transition-colors text-sm"
                >
                  <Copy className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  },
);

OrganizationCard.displayName = 'OrganizationCard';

// 表格视图行
const OrganizationTableRow = memo(
  ({
    org,
    isSelected,
    index,
    search,
    onToggleSelect,
    onNavigateToDetail,
  }: {
    org: Organization;
    isSelected: boolean;
    index: number;
    search: string;
    onToggleSelect: (id: number) => void;
    onNavigateToDetail: (id: number) => void;
  }) => {
    const planConfig = PlanBadgeConfig[org.plan] || PlanBadgeConfig.free;
    const storagePercent = org.storageLimit > 0 ? (org.storageUsed / org.storageLimit) * 100 : 0;

    const highlightText = (text: string) => {
      if (!search) return text;
      const regex = new RegExp(`(${search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
      const parts = text.split(regex);
      return parts.map((part, i) =>
        regex.test(part) ? (
          <mark key={i} className="bg-[var(--color-warning-container)] dark:bg-[var(--color-warning-container)] rounded px-0.5">
            {part}
          </mark>
        ) : (
          part
        ),
      );
    };

    return (
      <tr
        className={`transition-colors ${
          index % 2 === 0 ? 'bg-[var(--bg-secondary)]' : 'bg-[var(--bg-tertiary)]/50'
        } ${isSelected ? 'bg-[var(--color-primary-container)] border-l-4 border-l-primary-500' : ''} hover:bg-[var(--bg-tertiary)] dark:hover:bg-[var(--bg-secondary)]/50`}
      >
        <td className="px-5 py-4">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onToggleSelect(org.id)}
            className="w-4 h-4 rounded border-[var(--border-color)] dark:border-neutral-700 text-[var(--color-primary-text)] focus:ring-[var(--color-primary)]"
          />
        </td>
        <td className="px-5 py-4">
          <div className="flex items-center gap-[var(--space-apple-sm)]">
            <div className="w-8 h-8 bg-gradient-to-br from-[var(--color-secondary-surface)] to-[var(--color-accent-surface-deep)] rounded-[var(--radius-Apple-sm)] flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
              {org.name.charAt(0)}
            </div>
            <div className="min-w-0">
              <p className="font-medium text-[var(--text-primary)] truncate">{highlightText(org.name)}</p>
              <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] truncate">@{org.slug}</p>
            </div>
          </div>
        </td>
        <td className="px-5 py-4">
          <span className={`px-2.5 py-1 rounded-[var(--radius-pill)] text-xs font-medium ${planConfig.className}`}>
            {planConfig.label}
          </span>
        </td>
        <td className="px-5 py-4 text-sm text-[var(--text-primary)]">{org.memberCount}</td>
        <td className="px-5 py-4 text-sm text-[var(--text-primary)]">{org.teamCount}</td>
        <td className="px-5 py-4">
          <div className="flex items-center gap-2">
            <div className="w-20 h-1.5 bg-[var(--border-color)] rounded-[var(--radius-pill)] overflow-hidden">
              <div
                className={`h-full rounded-[var(--radius-pill)] ${storagePercent >= 90 ? 'bg-[var(--color-error-container)]0' : storagePercent >= 60 ? 'bg-[var(--color-warning-container)]0' : 'bg-[var(--color-success-container)]0'}`}
                style={{ width: `${Math.min(storagePercent, 100)}%` }}
              />
            </div>
            <span className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">{storagePercent.toFixed(0)}%</span>
          </div>
        </td>
        <td className="px-5 py-4">
          <RoleIcon role={org.myRole || 'member'} />
        </td>
        <td className="px-5 py-4 text-sm text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">{new Date(org.createdAt).toLocaleDateString('zh-CN')}</td>
        <td className="px-5 py-4">
          <button
            onClick={() => onNavigateToDetail(org.id)}
            className="text-[var(--color-primary-text)] hover:text-[var(--color-primary-text)] text-sm font-medium"
          >
            管理
          </button>
        </td>
      </tr>
    );
  },
);

OrganizationTableRow.displayName = 'OrganizationTableRow';

// 紧凑视图项
const OrganizationCompactItem = memo(
  ({
    org,
    isSelected,
    search,
    onToggleSelect,
    onNavigateToDetail,
  }: {
    org: Organization;
    isSelected: boolean;
    search: string;
    onToggleSelect: (id: number) => void;
    onNavigateToDetail: (id: number) => void;
  }) => {
    const highlightText = (text: string) => {
      if (!search) return text;
      const regex = new RegExp(`(${search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
      const parts = text.split(regex);
      return parts.map((part, i) =>
        regex.test(part) ? (
          <mark key={i} className="bg-[var(--color-warning-container)] dark:bg-[var(--color-warning-container)] rounded px-0.5">
            {part}
          </mark>
        ) : (
          part
        ),
      );
    };

    return (
      <div
        className={`flex items-center gap-4 px-[var(--space-apple-md)] py-[var(--space-apple-md)] border-b border-[var(--border-color)] last:border-0 transition-colors hover:bg-[var(--bg-tertiary)] dark:hover:bg-[var(--bg-tertiary)]/50 ${
          isSelected ? 'bg-[var(--color-primary-container)]' : ''
        }`}
      >
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onToggleSelect(org.id)}
          className="w-4 h-4 rounded border-[var(--border-color)] dark:border-neutral-700 text-[var(--color-primary-text)] focus:ring-[var(--color-primary)]"
        />

        <div className="w-8 h-8 bg-gradient-to-br from-[var(--color-secondary-surface)] to-[var(--color-accent-surface-deep)] rounded-[var(--radius-Apple-sm)] flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
          {org.name.charAt(0)}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-[var(--text-primary)] truncate">{highlightText(org.name)}</p>
        </div>

        <div className="hidden sm:flex items-center gap-6 text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
          <span className="flex items-center gap-1">
            <Users className="w-3.5 h-3.5" /> {org.memberCount}
          </span>
          <span className="flex items-center gap-1">
            <Settings className="w-3.5 h-3.5" /> {org.teamCount}
          </span>
          <span>{(org.storageUsed / 1024).toFixed(1)}GB</span>
        </div>

        <button
          onClick={() => onNavigateToDetail(org.id)}
          className="text-[var(--color-primary-text)] hover:text-[var(--color-primary-text)] text-sm font-medium flex-shrink-0"
        >
          管理
        </button>
      </div>
    );
  },
);

OrganizationCompactItem.displayName = 'OrganizationCompactItem';

// 分页组件
const Pagination = memo(
  ({
    page,
    pageSize,
    total,
    onPageChange,
    onPageSizeChange,
  }: {
    page: number;
    pageSize: number;
    total: number;
    onPageChange: (page: number) => void;
    onPageSizeChange: (size: number) => void;
  }) => {
    const totalPages = Math.ceil(total / pageSize);

    return (
      <div className="flex items-center justify-between px-5 py-4 border-t border-[var(--border-color)] dark:border-neutral-700">
        <div className="flex items-center gap-2 text-sm text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
          <span>每页</span>
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="px-2 py-1 border border-[var(--border-color)] rounded bg-[var(--bg-secondary)] text-[var(--text-primary)] text-sm"
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
          </select>
          <span>条</span>
          <span className="ml-4">
            共 {total} 条，第 {page}/{totalPages} 页
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onPageChange(1)}
            disabled={page === 1}
            className="p-1.5 rounded hover:bg-[var(--bg-tertiary)] disabled:opacity-50 disabled:cursor-not-allowed"
            title="首页"
          >
            <ChevronsLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => onPageChange(Math.max(1, page - 1))}
            disabled={page === 1}
            className="p-1.5 rounded hover:bg-[var(--bg-tertiary)] disabled:opacity-50 disabled:cursor-not-allowed"
            title="上一页"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <span className="px-[var(--space-apple-sm)] py-1 bg-[var(--color-primary-container)] dark:bg-[var(--color-primary-container)]/25 text-[var(--color-primary-text)] rounded font-medium text-sm">
            {page}
          </span>

          <button
            onClick={() => onPageChange(Math.min(totalPages, page + 1))}
            disabled={page === totalPages || totalPages === 0}
            className="p-1.5 rounded hover:bg-[var(--bg-tertiary)] disabled:opacity-50 disabled:cursor-not-allowed"
            title="下一页"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => onPageChange(totalPages)}
            disabled={page === totalPages || totalPages === 0}
            className="p-1.5 rounded hover:bg-[var(--bg-tertiary)] disabled:opacity-50 disabled:cursor-not-allowed"
            title="末页"
          >
            <ChevronsRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  },
);

Pagination.displayName = 'Pagination';

// Loading 骨架屏
const CardSkeleton = () => (
  <div className="bg-[var(--bg-secondary)] rounded-[var(--radius-Apple-md)] border border-[var(--border-color)] animate-pulse">
    <div className="p-[var(--space-apple-lg)] space-y-[var(--space-apple-md)]">
      <div className="flex items-start gap-[var(--space-apple-sm)]">
        <div className="w-12 h-12 bg-[var(--border-color)] rounded-[var(--radius-Apple-md)]" />
        <div className="flex-1 space-y-2">
          <div className="h-5 bg-[var(--border-color)] rounded w-3/4" />
          <div className="h-4 bg-[var(--border-color)] rounded w-1/2" />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-[var(--space-apple-sm)]">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 bg-[var(--bg-tertiary)] rounded-[var(--radius-Apple-sm)]" />
        ))}
      </div>
      <div className="h-10 bg-[var(--bg-tertiary)] rounded-[var(--radius-Apple-sm)]" />
    </div>
  </div>
);

const TableSkeleton = () => (
  <div className="animate-pulse">
    <div className="h-12 bg-[var(--bg-tertiary)] border-b border-[var(--border-color)]" />
    {[1, 2, 3, 4, 5].map((i) => (
      <div key={i} className="h-14 border-b border-[var(--border-color)]" />
    ))}
  </div>
);

const CompactSkeleton = () => (
  <div className="animate-pulse">
    {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
      <div key={i} className="h-14 border-b border-[var(--border-color)]" />
    ))}
  </div>
);

// Empty 空状态
const EmptyState = () => (
  <div className="text-center py-16">
    <Building2 className="w-16 h-16 mx-auto text-[var(--text-muted)] dark:text-[var(--text-muted)] mb-[var(--space-apple-md)]" />
    <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">暂无组织</h3>
    <p className="text-[var(--text-muted)] mb-6">创建您的第一个组织开始使用</p>
    <button className="px-6 py-2.5 bg-primary-container text-[var(--color-primary)] rounded-[var(--radius-Apple-sm)] hover:bg-primary-container transition-colors inline-flex items-center gap-2">
      <Building2 className="w-4 h-4" />
      创建组织
    </button>
  </div>
);

export const OrganizationList: React.FC<OrganizationListProps> = ({
  organizations,
  loading = false,
  viewMode = 'card',
  search = '',
  selectedIds,
  onToggleSelect,
  onSelectAll,
  onNavigateToDetail,
  onToggleFavorite,
  onTogglePin,
  onClone = () => {},
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
}) => {
  // 排序：置顶优先，然后按名称
  const sortedOrganizations = useMemo(() => {
    return [...organizations].sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [organizations]);

  const handleSelectAll = useCallback(() => {
    onSelectAll();
  }, [onSelectAll]);

  if (loading) {
    return (
      <div>
        {viewMode === 'card' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        )}
        {viewMode === 'table' && <TableSkeleton />}
        {viewMode === 'compact' && <CompactSkeleton />}
      </div>
    );
  }

  if (!loading && organizations.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="space-y-[var(--space-apple-md)]">
      {/* 结果计数和全选 */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-[var(--space-apple-sm)] text-sm text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              onChange={handleSelectAll}
              className="w-4 h-4 rounded border-[var(--border-color)] dark:border-neutral-700 text-[var(--color-primary-text)] focus:ring-[var(--color-primary)]"
            />
            全选
          </label>
          <span>共找到 {total} 个组织</span>
          {selectedIds.size > 0 && <span className="text-[var(--color-primary-text)] font-medium">已选择 {selectedIds.size} 个</span>}
        </div>
      </div>

      {/* 列表内容 */}
      {viewMode === 'card' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {sortedOrganizations.map((org) => (
            <OrganizationCard
              key={org.id}
              org={org}
              isSelected={selectedIds.has(org.id)}
              search={search}
              onToggleSelect={onToggleSelect}
              onNavigateToDetail={onNavigateToDetail}
              onToggleFavorite={onToggleFavorite}
              onTogglePin={onTogglePin}
              onClone={onClone}
            />
          ))}
        </div>
      )}

      {viewMode === 'table' && (
        <div className="bg-[var(--bg-secondary)] rounded-[var(--radius-Apple-md)] border border-[var(--border-color)] overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[var(--bg-tertiary)] sticky top-0 z-10">
              <tr>
                <th className="px-5 py-4 text-left text-xs font-medium text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] uppercase tracking-wider w-12"></th>
                <th className="px-5 py-4 text-left text-xs font-medium text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] uppercase tracking-wider">名称</th>
                <th className="px-5 py-4 text-left text-xs font-medium text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] uppercase tracking-wider">计划</th>
                <th className="px-5 py-4 text-left text-xs font-medium text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] uppercase tracking-wider">成员</th>
                <th className="px-5 py-4 text-left text-xs font-medium text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] uppercase tracking-wider">团队</th>
                <th className="px-5 py-4 text-left text-xs font-medium text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] uppercase tracking-wider">存储</th>
                <th className="px-5 py-4 text-left text-xs font-medium text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] uppercase tracking-wider">角色</th>
                <th className="px-5 py-4 text-left text-xs font-medium text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] uppercase tracking-wider">
                  创建时间
                </th>
                <th className="px-5 py-4 text-left text-xs font-medium text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] uppercase tracking-wider">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-700">
              {sortedOrganizations.map((org, index) => (
                <OrganizationTableRow
                  key={org.id}
                  org={org}
                  isSelected={selectedIds.has(org.id)}
                  index={index}
                  search={search}
                  onToggleSelect={onToggleSelect}
                  onNavigateToDetail={onNavigateToDetail}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {viewMode === 'compact' && (
        <div className="bg-[var(--bg-secondary)] rounded-[var(--radius-Apple-md)] border border-[var(--border-color)] divide-y divide-neutral-100 dark:divide-neutral-800">
          {sortedOrganizations.map((org) => (
            <OrganizationCompactItem
              key={org.id}
              org={org}
              isSelected={selectedIds.has(org.id)}
              search={search}
              onToggleSelect={onToggleSelect}
              onNavigateToDetail={onNavigateToDetail}
            />
          ))}
        </div>
      )}

      {/* 分页 */}
      {total > pageSize && (
        <Pagination
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
        />
      )}
    </div>
  );
};

export default OrganizationList;
