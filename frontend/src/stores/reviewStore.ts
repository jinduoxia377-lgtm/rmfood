import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Review, ReviewStage, ReviewComment, ReviewStatus, StageStatus } from '@/types/academic-report-lifecycle';

interface ReviewState {
  currentReview: Review | null;

  isLoading: boolean;
  error: string | null;

  createReview: (reportId: string) => void;
  submitReview: (reviewId: string) => void;
  updateStageStatus: (reviewId: string, stageId: string, status: StageStatus) => void;
  addComment: (reviewId: string, stageId: string, comment: Omit<ReviewComment, 'id' | 'createdAt'>) => void;
  resolveComment: (reviewId: string, commentId: string) => void;
  deleteComment: (reviewId: string, commentId: string) => void;

  getReviewByReportId: (reportId: string) => Review | undefined;
  getStageComments: (reviewId: string, stageId: string) => ReviewComment[];
  getReviewProgress: (reviewId: string) => number;
}

export const useReviewStore = create<ReviewState>()(
  persist(
    (set, get) => ({
      currentReview: null,
      isLoading: false,
      error: null,

      createReview: (reportId: string) => {
        const stages: ReviewStage[] = [
          {
            id: 'stage-1',
            name: '初审',
            description: '编辑初步审查',
            reviewers: ['reviewer-1'],
            deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            requiredApprovals: 1,
            criteria: [],
            status: 'pending',
            approvals: 0,
          },
          {
            id: 'stage-2',
            name: '同行评审',
            description: '专家评审',
            reviewers: ['reviewer-2', 'reviewer-3'],
            deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
            requiredApprovals: 2,
            criteria: [],
            status: 'pending',
            approvals: 0,
          },
          {
            id: 'stage-3',
            name: '终审',
            description: '主编最终审核',
            reviewers: ['reviewer-4'],
            deadline: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString(),
            requiredApprovals: 1,
            criteria: [],
            status: 'pending',
            approvals: 0,
          },
        ];

        const newReview: Review = {
          id: `review-${Date.now()}`,
          reportId,
          stages,
          currentStage: 'stage-1',
          status: 'pending',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          comments: [],
        };

        set({ currentReview: newReview });
      },

      submitReview: (reviewId: string) => {
        set(state => {
          if (state.currentReview?.id !== reviewId) return state;
          return {
            currentReview: {
              ...state.currentReview,
              status: 'in_progress' as ReviewStatus,
              updatedAt: new Date().toISOString(),
            },
          };
        });
      },

      updateStageStatus: (reviewId: string, stageId: string, status: StageStatus) => {
        set(state => {
          if (state.currentReview?.id !== reviewId) return state;

          const stages = state.currentReview.stages.map(stage =>
            stage.id === stageId
              ? { ...stage, status, approvals: status === 'approved' ? stage.requiredApprovals : stage.approvals }
              : stage,
          );

          let currentStage = state.currentReview.currentStage;
          if (status === 'approved') {
            const currentIndex = stages.findIndex(s => s.id === stageId);
            if (currentIndex < stages.length - 1) {
              const nextStage = stages[currentIndex + 1];
              if (nextStage) {
                currentStage = nextStage.id;
              }
            }
          }

          let overallStatus: ReviewStatus = 'pending';
          if (stages.every(s => s.status === 'approved')) {
            overallStatus = 'approved';
          } else if (stages.some(s => s.status === 'in_progress')) {
            overallStatus = 'in_progress';
          } else if (stages.some(s => s.status === 'completed')) {
            overallStatus = 'needs_revision';
          }

          return {
            currentReview: {
              ...state.currentReview,
              stages,
              currentStage,
              status: overallStatus,
              updatedAt: new Date().toISOString(),
            },
          };
        });
      },

      addComment: (reviewId: string, _stageId: string, commentData) => {
        const comment: ReviewComment = {
          ...commentData,
          id: `comment-${Date.now()}`,
          createdAt: new Date().toISOString(),
          resolvedAt: undefined,
        };

        set(state => {
          if (state.currentReview?.id !== reviewId) return state;
          return {
            currentReview: {
              ...state.currentReview,
              comments: [...(state.currentReview.comments || []), comment],
              updatedAt: new Date().toISOString(),
            },
          };
        });
      },

      resolveComment: (reviewId: string, commentId: string) => {
        set(state => {
          if (state.currentReview?.id !== reviewId) return state;
          return {
            currentReview: {
              ...state.currentReview,
              comments: (state.currentReview.comments || []).map(c =>
                c.id === commentId
                  ? { ...c, resolvedAt: new Date().toISOString(), status: 'resolved' }
                  : c,
              ),
              updatedAt: new Date().toISOString(),
            },
          };
        });
      },

      deleteComment: (reviewId: string, commentId: string) => {
        set(state => {
          if (state.currentReview?.id !== reviewId) return state;
          return {
            currentReview: {
              ...state.currentReview,
              comments: (state.currentReview.comments || []).filter(c => c.id !== commentId),
              updatedAt: new Date().toISOString(),
            },
          };
        });
      },

      getReviewByReportId: (reportId: string) => {
        const { currentReview } = get();
        return currentReview?.reportId === reportId ? currentReview : undefined;
      },

      getStageComments: (reviewId: string, stageId: string) => {
        const { currentReview } = get();
        if (currentReview?.id !== reviewId) return [];
        return (currentReview.comments || []).filter(c => c.stageId === stageId);
      },

      getReviewProgress: (reviewId: string) => {
        const { currentReview } = get();
        if (currentReview?.id !== reviewId) return 0;

        const totalStages = currentReview.stages.length;
        const completedStages = currentReview.stages.filter(s => s.status === 'approved').length;

        return Math.round((completedStages / totalStages) * 100);
      },
    }),
    {
      name: 'review-storage',
    },
  ),
);
