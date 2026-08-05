/**
 * 通知中心页面
 * 全部通知列表 | 筛选 | 已读/未读管理
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, Check, CheckCheck, ExternalLink, Filter, Inbox, BellOff, Clock, Zap } from 'lucide-react';
import { notificationApi } from '@/api/admin';
import type { Notification } from '@/types';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { Button, PageHeader, EmptyState, Skeleton, Pagination } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';

const TYPE_CONFIG: Record<string, { label: string; color: string; icon: typeof Bell }> = {
  system: { label: '系统', color: 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300', icon: Zap },
  formula_review: {
    label: '审核',
    color: 'bg-warning-100 text-warning-700 dark:bg-warning-900/30 dark:text-warning-400',
    icon: Check,
  },
  experiment_complete: {
    label: '实验',
    color: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
    icon: Inbox,
  },
  ai_task_done: {
    label: 'AI',
    color: 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400',
    icon: Zap,
  },
  data_sync: {
    label: '数据',
    color: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
    icon: Clock,
  },
};

const STATUS_FILTERS = [
  { key: '', label: '全部' },
  { key: 'unread', label: '未读' },
  { key: 'read', label: '已读' },
];

export default function NotificationPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { addToast } = useToast();

  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['notifications', page, 20, statusFilter],
    queryFn: () => notificationApi.list({ page, page_size: 20, status: statusFilter || undefined }),
  });

  const notifications = data?.items ?? [];
  const total = data?.total ?? 0;
  const unreadCount = data?.unread_count ?? 0;

  const markReadMutation = useMutation({
    mutationFn: (id: number) => notificationApi.markRead(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => notificationApi.markAllRead(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      addToast({ type: 'success', message: '已全部标记为已读' });
    },
  });

  const handleNotifClick = (notif: Notification) => {
    if (!notif.isRead) {
      markReadMutation.mutate(notif.id);
    }
    if (notif.actionUrl) {
      navigate(notif.actionUrl);
    }
  };

  const filteredNotifications = typeFilter ? notifications.filter((n) => n.type === typeFilter) : notifications;

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <PageHeader title="通知中心" description="查看系统通知、审核反馈和任务完成提醒" />

      {/* 统计栏 */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-primary-50 dark:bg-primary-900/20 border border-primary-100 dark:border-primary-800/40">
          <Bell size={14} className="text-primary-600 dark:text-primary-400" />
          <span className="text-sm font-medium text-primary-700 dark:text-primary-300">{unreadCount} 条未读</span>
        </div>

        <div className="flex-1" />

        {unreadCount > 0 && (
          <Button
            variant="secondary"
            size="sm"
            icon={<CheckCheck className="w-4 h-4" />}
            loading={markAllReadMutation.isPending}
            onClick={() => markAllReadMutation.mutate()}
          >
            全部已读
          </Button>
        )}
      </div>

      {/* 筛选栏 */}
      <div className="flex flex-wrap items-center gap-2">
        {/* 状态筛选 */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-neutral-100 dark:bg-neutral-800">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => {
                setStatusFilter(f.key);
                setPage(1);
              }}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                statusFilter === f.key
                  ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-sm'
                  : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* 类型筛选 */}
        <div className="flex items-center gap-1.5">
          <Filter size={14} className="text-neutral-400" />
          {Object.entries(TYPE_CONFIG).map(([key, cfg]) => (
            <button
              key={key}
              onClick={() => {
                setTypeFilter(typeFilter === key ? '' : key);
              }}
              className={cn(
                'px-2 py-1 rounded-lg text-xs font-medium transition-all',
                typeFilter === key
                  ? cn(cfg.color, 'ring-1 ring-current/30')
                  : 'bg-slate-50 dark:bg-neutral-800/50 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300',
              )}
            >
              {cfg.label}
            </button>
          ))}
        </div>
      </div>

      {/* 通知列表 */}
      <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200/60 dark:border-neutral-800/60 overflow-hidden divide-y divide-slate-100 dark:divide-slate-800/40">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="px-5 py-4">
              <Skeleton className="h-4 w-3/4 mb-2" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          ))
        ) : filteredNotifications.length === 0 ? (
          <EmptyState
            icon={<BellOff className="w-10 h-10 text-neutral-300 dark:text-neutral-600" />}
            title="暂无通知"
            description={statusFilter ? '该筛选条件下没有通知' : '当前没有新通知'}
          />
        ) : (
          filteredNotifications.map((notif) => {
            const typeCfg = TYPE_CONFIG[notif.type] || TYPE_CONFIG.system;
            const Icon = typeCfg.icon;
            return (
              <button
                key={notif.id}
                onClick={() => handleNotifClick(notif)}
                className={cn(
                  'w-full text-left px-5 py-4 transition-colors',
                  'hover:bg-neutral-50 dark:hover:bg-neutral-800/40',
                  notif.isRead === false && 'bg-primary-50/30 dark:bg-primary-900/10',
                )}
              >
                <div className="flex items-start gap-3.5">
                  {/* 类型图标 */}
                  <div
                    className={cn('shrink-0 w-9 h-9 rounded-xl flex items-center justify-center mt-0.5', typeCfg.color)}
                  >
                    <Icon size={16} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p
                        className={cn(
                          'text-sm truncate',
                          !notif.isRead
                            ? 'font-semibold text-neutral-900 dark:text-white'
                            : 'text-neutral-600 dark:text-neutral-300',
                        )}
                      >
                        {notif.title}
                      </p>
                      {notif.actionUrl && <ExternalLink size={12} className="shrink-0 text-neutral-400" />}
                      {!notif.isRead && (
                        <span className="shrink-0 w-2 h-2 rounded-full bg-primary-500" />
                      )}
                    </div>
                    {notif.message && (
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 line-clamp-2">{notif.message}</p>
                    )}
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className={cn('px-1.5 py-0.5 rounded text-[10px] font-medium', typeCfg.color)}>
                        {typeCfg.label}
                      </span>
                      <span className="text-[11px] text-neutral-400 dark:text-neutral-500">
                        {notif.createdAt && format(new Date(notif.createdAt), 'yyyy-MM-dd HH:mm', { locale: zhCN })}
                      </span>
                    </div>
                  </div>

                  {/* 单条已读按钮 */}
                  {!notif.isRead && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        markReadMutation.mutate(notif.id);
                      }}
                      className="shrink-0 p-1.5 rounded-lg text-neutral-400 hover:text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
                      title="标记已读"
                      aria-label="标记已读"
                    >
                      <Check size={14} />
                    </button>
                  )}
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* 分页 */}
      {totalPages > 1 && <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />}
    </div>
  );
}
