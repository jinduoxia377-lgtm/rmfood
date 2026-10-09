/**
 * 评论项组件 — 配方详情页评论系统的子组件
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Heart, Reply, Trash2, ChevronUp, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui';
import { commentApi, type Comment } from '@/api/comment';

const ROLE_LABELS: Record<string, string> = {
  admin: '管理员',
  reviewer: '审核员',
  formulator: '配方师',
  researcher: '研究员',
  guest: '访客',
};

export function CommentItem({
  comment,
  currentUserId,
  onDelete,
  onReply,
  expanded,
  onToggle,
}: {
  comment: Comment;
  currentUserId?: number;
  onDelete: (id: number) => void;
  onReply: (id: number) => void;
  expanded: boolean;
  onToggle: () => void;
}) {
  const qc = useQueryClient();
  const [likeLoading, setLikeLoading] = useState(false);

  const { data: likesData } = useQuery({
    queryKey: ['comment-likes', comment.id],
    queryFn: () => commentApi.getLikes(comment.id),
  });

  const likeCount = likesData?.like_count ?? comment.like_count ?? 0;
  const isLiked = likesData?.is_liked ?? comment.is_liked ?? false;

  const likeMut = useMutation({
    mutationFn: () => (isLiked ? commentApi.unlike(comment.id) : commentApi.like(comment.id)),
    onMutate: async () => {
      setLikeLoading(true);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['comment-likes', comment.id] });
    },
    onSettled: () => {
      setLikeLoading(false);
    },
  });

  const { data: replies } = useQuery({
    queryKey: ['comment-replies', comment.id],
    queryFn: () => commentApi.getReplies(comment.id),
    enabled: expanded,
  });

  const canDelete = currentUserId === comment.user_id;

  return (
    <div className="group">
      <div className="flex gap-3">
        <div className="w-7 h-7 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-neutral-500 text-xs font-medium shrink-0 mt-0.5">
          {comment.author_name?.[0] ?? 'U'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-sm font-medium text-neutral-900 dark:text-white">
              {comment.author_name ?? '未知用户'}
            </span>
            {comment.author_role && (
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-500">
                {ROLE_LABELS[comment.author_role] ?? comment.author_role}
              </span>
            )}
            <span className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
              {new Date(comment.created_at).toLocaleDateString('zh-CN', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </div>
          <p className="text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed whitespace-pre-wrap">
            {comment.content}
          </p>
          <div className="flex items-center gap-3 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => likeMut.mutate()}
              disabled={likeLoading}
              className={cn(
                'flex items-center gap-1 text-xs transition-all duration-200',
                isLiked ? 'text-error-500 hover:text-error-600' : 'text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] hover:text-error-500',
              )}
            >
              <Heart
                size={12}
                className={cn('transition-transform duration-200', isLiked ? 'fill-red-500 scale-110' : 'fill-none')}
              />
              {likeCount > 0 && <span>{likeCount}</span>}
            </button>
            <button
              onClick={() => onReply(comment.id)}
              className="flex items-center gap-1 text-xs text-neutral-400 hover:text-primary-700 dark:hover:text-primary-600 transition-colors"
            >
              <Reply size={12} /> 回复
            </button>
            {canDelete && (
              <button
                onClick={() => onDelete(comment.id)}
                className="flex items-center gap-1 text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] hover:text-error-500 transition-colors"
              >
                <Trash2 size={12} /> 删除
              </button>
            )}
          </div>

          {/* 回复展开 */}
          {comment.replies_count > 0 && (
            <button
              onClick={onToggle}
              className="flex items-center gap-1 mt-2 text-xs text-neutral-400 hover:text-primary-700 dark:hover:text-primary-600 transition-colors"
            >
              {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              {comment.replies_count} 条回复
            </button>
          )}
          {expanded && replies && replies.length > 0 && (
            <div className="mt-2 pl-2 border-l-2 border-neutral-100 dark:border-neutral-800 space-y-3">
              {replies.map((reply) => {
                const canDeleteReply = currentUserId === reply.user_id;
                return (
                  <div key={reply.id} className="flex gap-2 group/reply">
                    <div className="w-6 h-6 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-neutral-500 text-xs font-medium shrink-0 mt-0.5">
                      {reply.author_name?.[0] ?? 'U'}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs font-medium text-neutral-900 dark:text-white">{reply.author_name}</span>
                        <span className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
                          {new Date(reply.created_at).toLocaleDateString('zh-CN', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <p className="text-sm text-neutral-600 dark:text-neutral-300">{reply.content}</p>
                      {canDeleteReply && (
                        <button
                          onClick={() => onDelete(reply.id)}
                          className="flex items-center gap-1 mt-1 text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] hover:text-error-500 opacity-0 group-hover/reply:opacity-100 transition-all"
                        >
                          <Trash2 size={11} /> 删除
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
