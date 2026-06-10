import { useReviewStore } from '@/stores/reviewStore';
import { CheckCircle, Clock, AlertTriangle, MessageSquare, Users } from 'lucide-react';

const statusLabels: Record<string, { label: string; color: string; bgColor: string }> = {
  pending: { label: '待提交', color: 'text-gray-600', bgColor: 'bg-gray-100' },
  in_progress: { label: '评审中', color: 'text-blue-600', bgColor: 'bg-blue-100' },
  needs_revision: { label: '需修改', color: 'text-amber-600', bgColor: 'bg-amber-100' },
  completed: { label: '已完成', color: 'text-amber-600', bgColor: 'bg-amber-100' },
  approved: { label: '已批准', color: 'text-green-600', bgColor: 'bg-green-100' },
  published: { label: '已发布', color: 'text-purple-600', bgColor: 'bg-purple-100' },
};

export function ReviewProgress() {
  const { currentReview, createReview, submitReview, getReviewProgress } = useReviewStore();

  if (!currentReview) {
    return (
      <div className="border rounded-lg p-8 text-center bg-white dark:bg-gray-800">
        <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-gray-300" />
        <h3 className="text-lg font-semibold mb-2">暂无评审流程</h3>
        <p className="text-gray-500 mb-4">为您的报告创建评审流程，跟踪审核进度</p>
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
      <div className="border rounded-lg p-6 bg-white dark:bg-gray-800">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full ${statusLabels[currentStatus]?.bgColor || 'bg-gray-100'} flex items-center justify-center`}>
              {currentStatus === 'approved' ? (
                <CheckCircle className={`w-5 h-5 ${statusLabels[currentStatus]?.color || 'text-gray-600'}`} />
              ) : currentStatus === 'in_progress' ? (
                <Clock className={`w-5 h-5 ${statusLabels[currentStatus]?.color || 'text-gray-600'}`} />
              ) : (
                <AlertTriangle className={`w-5 h-5 ${statusLabels[currentStatus]?.color || 'text-gray-600'}`} />
              )}
            </div>
            <div>
              <h3 className="font-semibold">评审进度</h3>
              <span className={`inline-block px-2 py-1 text-xs rounded ${statusLabels[currentStatus]?.bgColor || 'bg-gray-100'} ${statusLabels[currentStatus]?.color || 'text-gray-600'}`}>
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
          <div className="flex justify-between text-sm text-gray-500 mb-1">
            <span>完成进度</span>
            <span>{progress}%</span>
          </div>
          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
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
              <div key={stage.id} className="flex items-center gap-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold">
                  {index + 1}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{stage.name}</span>
                    <span className={`inline-block px-2 py-1 text-xs rounded ${statusLabels[stageStatus]?.bgColor || 'bg-gray-100'} ${statusLabels[stageStatus]?.color || 'text-gray-600'}`}>
                      {statusLabels[stageStatus]?.label || '未知'}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-500 mt-1">
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
                <div className="text-sm text-gray-400">
                  {(stage.approvals || 0)}/{stage.requiredApprovals || 1} 已批准
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="border rounded-lg p-4 bg-white dark:bg-gray-800">
        <div className="flex items-center gap-2 mb-3">
          <MessageSquare className="w-5 h-5 text-primary-500" />
          <span className="font-medium">评审意见</span>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{comments.length}</div>
            <div className="text-xs text-gray-500">总意见数</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-amber-500">
              {comments.filter((c: any) => c.status === 'pending').length}
            </div>
            <div className="text-xs text-gray-500">待处理</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-500">
              {comments.filter((c: any) => c.status === 'resolved').length}
            </div>
            <div className="text-xs text-gray-500">已解决</div>
          </div>
        </div>
      </div>
    </div>
  );
}
