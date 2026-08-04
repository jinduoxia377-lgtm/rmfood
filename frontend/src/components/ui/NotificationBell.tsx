/**
 * 通知铃铛组件
 * 顶栏通知入口：显示未读数角标 + 通知弹出面板
 */
import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCheck, ExternalLink } from 'lucide-react';
import { notificationApi } from '@/api/admin';
import type { Notification } from '@/types';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

const TYPE_COLORS: Record<string, string> = {
  system: 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300',
  formula_review: 'bg-warning-100 text-warning-700 dark:bg-warning-900/30 dark:text-warning-400',
  experiment_complete: 'bg-secondary-100 text-secondary-700 dark:bg-secondary-900/30 dark:text-secondary-400',
  ai_task_done: 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400',
  data_sync: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
};

const TYPE_LABELS: Record<string, string> = {
  system: '系统',
  formula_review: '审核',
  experiment_complete: '实验',
  ai_task_done: 'AI',
  data_sync: '数据',
};

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();
  const navigate = useNavigate();

  const { data: notifData } = useQuery({
    queryKey: ['notifications', 1, 10],
    queryFn: () => notificationApi.list({ page: 1, page_size: 10 }),
    refetchInterval: 30_000, // 30s 自动刷新
  });

  const notifications = notifData?.items ?? [];
  const unreadCount = notifData?.unread_count ?? 0;

  const markReadMutation = useMutation({
    mutationFn: (id: number) => notificationApi.markRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => notificationApi.markAllRead(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  // 点击外部关闭
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleNotificationClick = (notif: Notification) => {
    if (!notif.isRead) {
      markReadMutation.mutate(notif.id);
    }
    if (notif.actionUrl) {
      window.location.href = notif.actionUrl;
    }
  };

  return (
    <div className="relative" ref={panelRef}>
      {/* 铃铛按钮 */}
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-lg text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
        title="通知"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center
                         px-1 rounded-full bg-error-500 text-white text-[10px] font-bold leading-none"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* 通知弹出面板 */}
      {open && (
        <div
          className="absolute right-0 top-full mt-2 w-96 max-h-[480px] flex flex-col
                        bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl border border-neutral-200
                        dark:border-neutral-700 z-50 overflow-hidden"
        >
          {/* 头部 */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-100 dark:border-neutral-800">
            <div className="flex items-center gap-2">
              <Bell size={16} className="text-neutral-400" />
              <span className="font-semibold text-sm text-neutral-900 dark:text-white">通知</span>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-error-100 text-error-600 text-xs font-medium">
                  {unreadCount} 条未读
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={() => markAllReadMutation.mutate()}
                disabled={markAllReadMutation.isPending}
                className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700
                           dark:text-primary-400 disabled:opacity-50 transition-colors"
              >
                <CheckCheck size={14} />
                全部已读
              </button>
            )}
          </div>

          {/* 通知列表 */}
          <div className="flex-1 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-neutral-400 text-sm">暂无通知</div>
            ) : (
              notifications.map((notif) => (
                <button
                  key={notif.id}
                  onClick={() => handleNotificationClick(notif)}
                  className={cn(
                    'w-full text-left px-4 py-3 border-b border-slate-50 dark:border-neutral-800/50',
                    'hover:bg-slate-50 dark:hover:bg-neutral-800/50 transition-colors',
                    {!notif.isRead && 'bg-primary-50/50 dark:bg-primary-900/10'},
                  )}
                >
                  <div className="flex items-start gap-3">
                    {/* 类型标签 */}
                    <span
                      className={cn(
                        'shrink-0 mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium',
                        TYPE_COLORS[notif.type] || TYPE_COLORS.system,
                      )}
                    >
                      {TYPE_LABELS[notif.type] || '通知'}
                    </span>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p
                          className={cn(
                            'text-sm truncate',
                              ? 'font-semibold text-neutral-900 dark:text-white'
                              : 'text-neutral-600 dark:text-neutral-300',
                          )}
                        >
                          {notif.title}
                        </p>
                        {notif.actionUrl && <ExternalLink size={12} className="shrink-0 text-neutral-400" />}
                      </div>
                      {notif.message && (
                        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 line-clamp-2">{notif.message}</p>
                      )}
                      <p className="text-[10px] text-neutral-400 mt-1">
                        {notif.createdAt && format(new Date(notif.createdAt), 'MM-dd HH:mm', { locale: zhCN })}
                      </p>
                    </div>

                    {/* 未读圆点 */}
                    {!notif.isRead && (
                      <span className="shrink-0 mt-2 w-2 h-2 rounded-full bg-primary-500" />
                    )}
                  </div>
                </button>
              ))
            )}
          </div>

          {/* 底部 */}
          <div className="px-4 py-2 border-t border-neutral-100 dark:border-neutral-800 text-center">
            <button
              onClick={() => {
                setOpen(false);
                navigate('/notifications');
              }}
              className="text-xs text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
            >
              查看全部通知
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
