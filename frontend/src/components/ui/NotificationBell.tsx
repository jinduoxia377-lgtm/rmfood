/**
 * NotificationBell 组件
 * 顶栏通知入口：未读数徽标 + 通知弹层
 */
'use client';

import { useState, useRef, useEffect } from'react';
import { useNavigate } from'react-router-dom';
import { useQuery, useMutation, useQueryClient } from'@tanstack/react-query';
import { Bell, CheckCheck, ExternalLink } from'lucide-react';
import { notificationApi } from'@/api/admin';
import type { Notification } from'@/types';
import { cn } from'@/lib/utils';
import { format } from'date-fns';
import { zhCN } from'date-fns/locale';

const TYPE_COLORS: Record<string, string> = {
 system:'bg-neutral-100 dark:bg-neutral-800 text-text-secondary',
 formula_review:'bg-warning-100 text-warning-700 dark:bg-warning-300/25 dark:text-warning-700',
 experiment_complete:'bg-secondary-100 text-secondary-700 dark:bg-secondary-300/25 dark:text-secondary-700',
 ai_task_done:'bg-primary-100 text-primary-700 dark:bg-primary-300/25 dark:text-primary-700',
 data_sync:'bg-accent-100 text-accent-700 dark:bg-accent-300/25 dark:text-accent-700',
};

const TYPE_LABELS: Record<string, string> = {
 system:'系统',
 formula_review:'配方评审',
 experiment_complete:'实验完成',
 ai_task_done:'AI完成',
 data_sync:'数据同步',
};

export default function NotificationBell() {
 const [open, setOpen] = useState(false);
 const panelRef = useRef<HTMLDivElement>(null);
 const qc = useQueryClient();
 const navigate = useNavigate();

 const { data: notifData } = useQuery({
 queryKey: ['notifications', 1, 10],
 queryFn: () => notificationApi.list({ page: 1, page_size: 10 }),
 refetchInterval: 30_000,
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
 setOpen(false);
 };

 return (
 <div className="relative" ref={panelRef}>
 <button
 onClick={() => setOpen(!open)}
 className="relative p-2 rounded-lg text-text-muted hover:bg-bg-tertiary transition-colors"
 title="通知"
 >
 <Bell size={18} />
 {unreadCount > 0 && (
 <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center px-1 rounded-full bg-error-500 text-white text-overline font-semibold leading-none">
 {unreadCount > 99 ?'99+' : unreadCount}
 </span>
 )}
 </button>

 {open && (
 <div className="absolute right-0 top-full mt-2 w-96 max-h-[480px] flex flex-col surface-card rounded-2xl shadow-2xl border border-neutral-200 dark:border-neutral-700 z-50 overflow-hidden">
 <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-100">
 <div className="flex items-center gap-2">
 <Bell size={16} className="text-text-disabled" />
 <span className="font-semibold text-sm text-text-primary dark:text-white">通知</span>
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
 className="flex items-center gap-1 text-xs text-secondary-600 hover:text-secondary-700 dark:text-secondary-700 disabled:opacity-50 transition-colors"
 >
 <CheckCheck size={14} />
 全部已读
 </button>
 )}
 </div>

 <div className="flex-1 overflow-y-auto">
 {notifications.length === 0 ? (
 <div className="p-8 text-center text-text-disabled text-sm">暂无通知</div>
 ) : (
 notifications.map((notif) => {
 const isActive = !notif.isRead;
 return (
 <button
 key={notif.id}
 onClick={() => handleNotificationClick(notif)}
 className={cn(
'w-full text-left px-4 py-3 border-b border-neutral-50/50',
'hover:bg-neutral-default/50 transition-colors',
 isActive ?'bg-secondary-50/50 dark:bg-secondary-300/15' :'',
 )}
 >
 <div className="flex items-start gap-3">
 <span
 className={cn(
'shrink-0 mt-0.5 px-1.5 py-0.5 rounded text-xs font-medium',
 TYPE_COLORS[notif.type] || TYPE_COLORS.system,
 )}
 >
 {TYPE_LABELS[notif.type] ||'通知'}
 </span>
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-2">
 <p
 className={cn(
'text-sm truncate',
 isActive
 ?'font-semibold text-text-primary dark:text-white'
 :'text-text-secondary',
 )}
 >
 {notif.title}
 </p>
 {notif.actionUrl && <ExternalLink size={12} className="shrink-0 text-text-disabled" />}
 </div>
 {notif.message && (
 <p className="text-xs text-text-muted mt-0.5 line-clamp-2">
 {notif.message}
 </p>
 )}
 <p className="text-xs text-text-disabled mt-1">
 {notif.createdAt && format(new Date(notif.createdAt),'MM-dd HH:mm', { locale: zhCN })}
 </p>
 </div>
 {isActive && (
 <span className="shrink-0 mt-2 w-2 h-2 rounded-full bg-secondary-500" />
 )}
 </div>
 </button>
 );
 })
 )}
 </div>

 <div className="px-4 py-2 border-t border-neutral-100 text-center">
 <button
 onClick={() => {
 setOpen(false);
 navigate('/notifications');
 }}
 className="text-xs text-text-disabled hover:text-text-secondary dark:hover:text-text-disabled"
 >
 查看全部通知
 </button>
 </div>
 </div>
 )}
 </div>
 );
}
