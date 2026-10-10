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
  MoreVertical,
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
  free: { label: '免费版', className: 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300' },
  pro: { label: '专业版', className: 'bg-secondary-100 text-secondary-700 dark:bg-secondary-300/25 dark:text-secondary-700' },
  enterprise: {
    label: '企业版',
    className: 'bg-accent-100 text-accent-700 dark:bg-accent-300/25 dark:text-accent-700',
  },
};

const RoleIcon = ({ role }: { role: string }) => {
  switch (role) {
    case 'owner':
      return <Crown className="w-4 h-4 text-warning-500" />;
    case 'admin':
      return <Shield className="w-4 h-4 text-secondary-500" />;
    case 'member':
    default:
      return <UserCheck className="w-4 h-4 text-success-500" />;
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
          <mark key={i} className="bg-warning-200 dark:bg-warning-800 rounded px-0.5">
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
        className={`bg-white dark:bg-neutral-900 rounded-xl border transition-all duration-200 ${
          isSelected
            ? 'border-primary-500 shadow-md ring-2 ring-primary-100 dark:ring-primary-900/50'
            : 'border-neutral-200 dark:border-neutral-700 hover:border-primary-300 hover:shadow-lg'
        } ${org.isPinned ? 'ring-2 ring-warning-300' : ''}`}
      >
        <div className="p-6">
          {/* 头部 */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => onToggleSelect(org.id)}
                className="w-4 h-4 rounded border-neutral-300 dark:border-neutral-700 text-primary-700 focus:ring-primary-500"
              />
              <div className="w-12 h-12 bg-gradient-to-br from-[var(--color-secondary-surface)] to-[var(--color-accent-surface-deep)] rounded-xl flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                {org.name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-neutral-900 dark:text-white truncate">{highlightText(org.name)}</h3>
                <p className="text-sm text-neutral-500 dark:text-neutral-400 truncate">@{highlightText(org.slug)}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 ml-2">
              <RoleIcon role={org.myRole || 'member'} />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleFavorite(org.id);
                }}
                className={`p-1.5 rounded-lg transition-colors ${org.isFavorite ? 'text-warning-500 bg-warning-50 dark:bg-warning-300/20' : 'text-neutral-400 hover:text-warning-500 hover:bg-neutral-100 dark:hover:bg-neutral-800'}`}
              >
                <Star className={`w-4 h-4 ${org.isFavorite ? 'fill-current' : ''}`} />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onTogglePin(org.id);
                }}
                className={`p-1.5 rounded-lg transition-colors ${org.isPinned ? 'text-secondary-500 bg-secondary-50 dark:bg-secondary-300/20' : 'text-neutral-400 hover:text-secondary-500 hover:bg-neutral-100 dark:hover:bg-neutral-800'}`}
              >
                <Pin className={`w-4 h-4 ${org.isPinned ? 'fill-current' : ''}`} />
              </button>
            </div>
          </div>

          {/* 计划徽章 */}
          <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium mb-4 ${planConfig.className}`}>
            {planConfig.label}
          </span>

          {/* 统计数据 */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="text-center p-3 bg-neutral-50 dark:bg-neutral-800 rounded-lg">
              <Users className="w-5 h-5 mx-auto mb-1 text-secondary-500" />
              <p className="text-lg font-bold text-neutral-900 dark:text-white">{org.memberCount}</p>
              <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">成员</p>
            </div>
            <div className="text-center p-3 bg-neutral-50 dark:bg-neutral-800 rounded-lg">
              <Settings className="w-5 h-5 mx-auto mb-1 text-success-500" />
              <p className="text-lg font-bold text-neutral-900 dark:text-white">{org.teamCount}</p>
              <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">团队</p>
            </div>
            <div className="text-center p-3 bg-neutral-50 dark:bg-neutral-800 rounded-lg">
              <Clock className="w-5 h-5 mx-auto mb-1 text-accent-500" />
              <p className="text-sm font-bold text-neutral-900 dark:text-white">
                {new Date(org.createdAt).toLocaleDateString('zh-CN', { month: 'short', year: 'numeric' })}
              </p>
              <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">创建于</p>
            </div>
          </div>

          {/* 底部操作区 */}
          <div className="pt-4 border-t border-neutral-100 dark:border-neutral-800">
            <div className="flex items-center justify-between text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mb-3">
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
            <div className="mb-3">
              <div className="h-1.5 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    storagePercent >= 90 ? 'bg-error-500' : storagePercent >= 60 ? 'bg-warning-500' : 'bg-success-500'
                  }`}
                  style={{ width: `${Math.min(storagePercent, 100)}%` }}
                />
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => onNavigateToDetail(org.id)}
                className="flex-1 px-3 py-2 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 rounded-lg transition-colors text-sm font-medium"
              >
                管理
              </button>
              {onClone && (
                <button
                  onClick={() => onClone(Number(org.id))}
                  title="克隆组织"
                  className="px-3 py-2 bg-neutral-100 dark:bg-neutral-800 hover:bg-secondary-100 dark:hover:bg-secondary-900/20 text-neutral-700 dark:text-neutral-300 hover:text-secondary-700 dark:hover:text-secondary-400 rounded-lg transition-colors text-sm"
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
          <mark key={i} className="bg-warning-200 dark:bg-warning-800 rounded px-0.5">
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
          index % 2 === 0 ? 'bg-white dark:bg-neutral-900' : 'bg-neutral-50 dark:bg-neutral-800/50'
        } ${isSelected ? 'bg-primary-50 dark:bg-primary-300/20 border-l-4 border-l-primary-500' : ''} hover:bg-neutral-100 dark:hover:bg-neutral-700/50`}
      >
        <td className="px-5 py-4">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onToggleSelect(org.id)}
            className="w-4 h-4 rounded border-neutral-300 dark:border-neutral-700 text-primary-700 focus:ring-primary-500"
          />
        </td>
        <td className="px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-[var(--color-secondary-surface)] to-[var(--color-accent-surface-deep)] rounded-lg flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
              {org.name.charAt(0)}
            </div>
            <div className="min-w-0">
              <p className="font-medium text-neutral-900 dark:text-white truncate">{highlightText(org.name)}</p>
              <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] truncate">@{org.slug}</p>
            </div>
          </div>
        </td>
        <td className="px-5 py-4">
          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${planConfig.className}`}>
            {planConfig.label}
          </span>
        </td>
        <td className="px-5 py-4 text-sm text-neutral-900 dark:text-white">{org.memberCount}</td>
        <td className="px-5 py-4 text-sm text-neutral-900 dark:text-white">{org.teamCount}</td>
        <td className="px-5 py-4">
          <div className="flex items-center gap-2">
            <div className="w-20 h-1.5 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${storagePercent >= 90 ? 'bg-error-500' : storagePercent >= 60 ? 'bg-warning-500' : 'bg-success-500'}`}
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
            className="text-primary-700 hover:text-primary-700 text-sm font-medium"
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
          <mark key={i} className="bg-warning-200 dark:bg-warning-800 rounded px-0.5">
            {part}
          </mark>
        ) : (
          part
        ),
      );
    };

    return (
      <div
        className={`flex items-center gap-4 px-4 py-3 border-b border-neutral-100 dark:border-neutral-800 last:border-0 transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800/50 ${
          isSelected ? 'bg-primary-50 dark:bg-primary-300/20' : ''
        }`}
      >
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onToggleSelect(org.id)}
          className="w-4 h-4 rounded border-neutral-300 dark:border-neutral-700 text-primary-700 focus:ring-primary-500"
        />

        <div className="w-8 h-8 bg-gradient-to-br from-[var(--color-secondary-surface)] to-[var(--color-accent-surface-deep)] rounded-lg flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
          {org.name.charAt(0)}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-neutral-900 dark:text-white truncate">{highlightText(org.name)}</p>
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
          className="text-primary-700 hover:text-primary-700 text-sm font-medium flex-shrink-0"
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
      <div className="flex items-center justify-between px-5 py-4 border-t border-neutral-100 dark:border-neutral-700">
        <div className="flex items-center gap-2 text-sm text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
          <span>每页</span>
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="px-2 py-1 border border-neutral-300 dark:border-neutral-600 rounded bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-sm"
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
            className="p-1.5 rounded hover:bg-neutral-100 dark:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed"
            title="首页"
          >
            <ChevronsLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => onPageChange(Math.max(1, page - 1))}
            disabled={page === 1}
            className="p-1.5 rounded hover:bg-neutral-100 dark:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed"
            title="上一页"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <span className="px-3 py-1 bg-primary-50 dark:bg-primary-300/25 text-primary-700 dark:text-primary-700 rounded font-medium text-sm">
            {page}
          </span>

          <button
            onClick={() => onPageChange(Math.min(totalPages, page + 1))}
            disabled={page === totalPages || totalPages === 0}
            className="p-1.5 rounded hover:bg-neutral-100 dark:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed"
            title="下一页"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => onPageChange(totalPages)}
            disabled={page === totalPages || totalPages === 0}
            className="p-1.5 rounded hover:bg-neutral-100 dark:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed"
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
  <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-700 animate-pulse">
    <div className="p-6 space-y-4">
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 bg-neutral-200 dark:bg-neutral-700 rounded-xl" />
        <div className="flex-1 space-y-2">
          <div className="h-5 bg-neutral-200 dark:bg-neutral-700 rounded w-3/4" />
          <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-1/2" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 bg-neutral-100 dark:bg-neutral-800 rounded-lg" />
        ))}
      </div>
      <div className="h-10 bg-neutral-100 dark:bg-neutral-800 rounded-lg" />
    </div>
  </div>
);

const TableSkeleton = () => (
  <div className="animate-pulse">
    <div className="h-12 bg-neutral-100 dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700" />
    {[1, 2, 3, 4, 5].map((i) => (
      <div key={i} className="h-14 border-b border-neutral-100 dark:border-neutral-800" />
    ))}
  </div>
);

const CompactSkeleton = () => (
  <div className="animate-pulse">
    {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
      <div key={i} className="h-14 border-b border-neutral-100 dark:border-neutral-800" />
    ))}
  </div>
);

// Empty 空状态
const EmptyState = () => (
  <div className="text-center py-16">
    <Building2 className="w-16 h-16 mx-auto text-neutral-300 dark:text-neutral-400 mb-4" />
    <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-2">暂无组织</h3>
    <p className="text-neutral-500 dark:text-neutral-400 mb-6">创建您的第一个组织开始使用</p>
    <button className="px-6 py-2.5 bg-primary-container text-primary-main rounded-lg hover:bg-primary-container transition-colors inline-flex items-center gap-2">
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
    <div className="space-y-4">
      {/* 结果计数和全选 */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-3 text-sm text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              onChange={handleSelectAll}
              className="w-4 h-4 rounded border-neutral-300 dark:border-neutral-700 text-primary-700 focus:ring-primary-500"
            />
            全选
          </label>
          <span>共找到 {total} 个组织</span>
          {selectedIds.size > 0 && <span className="text-primary-700 font-medium">已选择 {selectedIds.size} 个</span>}
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
        <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-700 overflow-hidden">
          <table className="w-full">
            <thead className="bg-neutral-50 dark:bg-neutral-800 sticky top-0 z-10">
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
        <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-700 divide-y divide-neutral-100 dark:divide-neutral-800">
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
