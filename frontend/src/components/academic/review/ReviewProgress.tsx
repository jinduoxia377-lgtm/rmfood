import { useReviewStore } from '@/stores/reviewStore';
import { CheckCircle, Clock, AlertTriangle, MessageSquare, Users } from 'lucide-react';

const statusLabels: Record<string, { label: string; color: string; bgColor: string }> = {
  pending: { label: '待提交', color: 'text-neutral-600', bgColor: 'bg-neutral-100 dark:bg-neutral-800' },
  in_progress: { label: '评审中', color: 'text-secondary-600', bgColor: 'bg-secondary-100' },
  needs_revision: { label: '需修改', color: 'text-warning-600', bgColor: 'bg-warning-100' },
  completed: { label: '已完成', color: 'text-warning-600', bgColor: 'bg-warning-100' },
  approved: { label: '已批准', color: 'text-success-600', bgColor: 'bg-success-100' },
  published: { label: '已发布', color: 'text-accent-600', bgColor: 'bg-accent-100' },
};

export function ReviewProgress() {
  const { currentReview, createReview, submitReview, getReviewProgress } = useReviewStore();

  if (!currentReview) {
    return (
      <div className="border rounded-lg p-8 text-center bg-white dark:bg-neutral-800">
        <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" />
        <h3 className="text-lg font-semibold mb-2">暂无评审流程</h3>
        <p className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mb-4">为您的报告创建评审流程，跟踪审核进度</p>
        <button
          onClick={() => createReview('current-report')}
          className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
        >
          创建评审流程
        </button>
      </div>
    );
  }

  const progress = getReviewProgress(currentReview.id);
  const currentStatus = currentReview.status as string;
  const comments = currentReview.comments || [];

  return (
    <div className="space-y-4">
      <div className="border rounded-lg p-6 bg-white dark:bg-neutral-800">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full ${statusLabels[currentStatus]?.bgColor || 'bg-neutral-100 dark:bg-neutral-800'} flex items-center justify-center`}>
              {currentStatus === 'approved' ? (
                <CheckCircle className={`w-5 h-5 ${statusLabels[currentStatus]?.color || 'text-neutral-600'}`} />
              ) : currentStatus === 'in_progress' ? (
                <Clock className={`w-5 h-5 ${statusLabels[currentStatus]?.color || 'text-neutral-600'}`} />
              ) : (
                <AlertTriangle className={`w-5 h-5 ${statusLabels[currentStatus]?.color || 'text-neutral-600'}`} />
              )}
            </div>
            <div>
              <h3 className="font-semibold">评审进度</h3>
              <span className={`inline-block px-2 py-1 text-xs rounded ${statusLabels[currentStatus]?.bgColor || 'bg-neutral-100 dark:bg-neutral-800'} ${statusLabels[currentStatus]?.color || 'text-neutral-600'}`}>
                {statusLabels[currentStatus]?.label || '未知'}
              </span>
            </div>
          </div>
          {currentStatus === 'pending' && (
            <button
              onClick={() => submitReview(currentReview.id)}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
            >
              提交评审
            </button>
          )}
        </div>

        <div className="mb-2">
          <div className="flex justify-between text-sm text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mb-1">
            <span>完成进度</span>
            <span>{progress}%</span>
          </div>
          <div className="w-full h-2 bg-neutral-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="mt-6 space-y-3">
          {currentReview.stages.map((stage: any, index: number) => {
            const stageStatus = stage.status as string;
            return (
              <div key={stage.id} className="flex items-center gap-4 p-3 bg-neutral-50 dark:bg-neutral-700 rounded-lg">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold">
                  {index + 1}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{stage.name}</span>
                    <span className={`inline-block px-2 py-1 text-xs rounded ${statusLabels[stageStatus]?.bgColor || 'bg-neutral-100 dark:bg-neutral-800'} ${statusLabels[stageStatus]?.color || 'text-neutral-600'}`}>
                      {statusLabels[stageStatus]?.label || '未知'}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mt-1">
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      {stage.reviewers?.length || 0} 位评审人
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      截止: {new Date(stage.deadline).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <div className="text-sm text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
                  {(stage.approvals || 0)}/{stage.requiredApprovals || 1} 已批准
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="border rounded-lg p-4 bg-white dark:bg-neutral-800">
        <div className="flex items-center gap-2 mb-3">
          <MessageSquare className="w-5 h-5 text-primary-500" />
          <span className="font-medium">评审意见</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-neutral-900 dark:text-white">{comments.length}</div>
            <div className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">总意见数</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-warning-500">
              {comments.filter((c: any) => c.status === 'pending').length}
            </div>
            <div className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">待处理</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-success-500">
              {comments.filter((c: any) => c.status === 'resolved').length}
            </div>
            <div className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">已解决</div>
          </div>
        </div>
      </div>
    </div>
  );
}
