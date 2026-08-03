/**
 * 评审流程管理状态存储 - 专业增强版
 *
 * 功能特性：
 * - 完整的评审生命周期管理
 * - 支持多阶段评审流程
 * - 评论系统与解决状态跟踪
 * - 进度计算与状态同步
 * - 持久化存储支持
 * - 完善的错误处理与日志记录
 *
 * @version 2.0.0
 * @author RMFOOD Team
 * @lastUpdated 2025-01-15
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { devtools } from 'zustand/middleware';
import { logger } from '@/utils/safeLogger'
import type {
  Review,
  ReviewStage,
  ReviewComment,
  ReviewStatus,
  StageStatus,
} from '@/types/academic-report-lifecycle';

// ─────────────────────────────────────────────────────────────────────────────
// 常量定义
// ─────────────────────────────────────────────────────────────────────────────

/** 默认评审阶段配置 */
const DEFAULT_REVIEW_STAGES: Omit<ReviewStage, 'id' | 'deadline'>[] = [
  {
    name: '初审',
    description: '编辑初步审查 - 检查格式、完整性和基本质量',
    reviewers: [],
    requiredApprovals: 1,
    criteria: [
      { id: 'c1', name: '格式规范', description: '文档格式符合要求', required: true, weight: 1 },
      { id: 'c2', name: '内容完整', description: '所有必要章节完整', required: true, weight: 1 },
    ],
    status: 'pending',
    approvals: 0,
  },
  {
    name: '同行评审',
    description: '专家评审 - 评估学术内容和方法论',
    reviewers: [],
    requiredApprovals: 2,
    criteria: [
      { id: 'c3', name: '方法论正确', description: '研究方法科学合理', required: true, weight: 2 },
      { id: 'c4', name: '数据可靠', description: '数据来源可信、分析准确', required: true, weight: 2 },
      { id: 'c5', name: '结论合理', description: '结论有数据支持', required: true, weight: 2 },
    ],
    status: 'pending',
    approvals: 0,
  },
  {
    name: '终审',
    description: '主编最终审查 - 综合评估与出版决策',
    reviewers: [],
    requiredApprovals: 1,
    criteria: [
      { id: 'c6', name: '整体质量', description: '达到出版标准', required: true, weight: 3 },
      { id: 'c7', name: '创新性', description: '具有学术或应用价值', required: false, weight: 1 },
    ],
    status: 'pending',
    approvals: 0,
  },
];

/** 评审阶段时间限制（天数）*/
const STAGE_DEADLINES = {
  '初审': 7,
  '同行评审': 14,
  '终审': 21,
};

// ─────────────────────────────────────────────────────────────────────────────
// 类型定义
// ─────────────────────────────────────────────────────────────────────────────

/** 评审操作结果 */
interface ReviewOperationResult {
  success: boolean;
  error?: string;
  data?: any;
}

/** 评审存储状态 */
interface ReviewState {
  /** 当前评审 */
  currentReview: Review | null;

  /** 评审列表（用于管理多个评审） */
  reviews: Map<string, Review>;

  /** 加载状态 */
  isLoading: boolean;

  /** 错误信息 */
  error: string | null;

  /** 最后更新时间 */
  lastUpdated: string | null;

  // ─────────────────────────────────────────────────────────────────────────
  // 操作方法
  // ─────────────────────────────────────────────────────────────────────────

  /** 创建新评审 */
  createReview: (
    reportId: string,
    options?: Partial<{
      stages: Omit<ReviewStage, 'id' | 'deadline'>[];
      reviewers: string[];
    }>
  ) => ReviewOperationResult;

  /** 提交评审 */
  submitReview: (reviewId: string) => ReviewOperationResult;

  /** 更新阶段状态 */
  updateStageStatus: (
    reviewId: string,
    stageId: string,
    status: ReviewStatus,
    approverId?: string
  ) => ReviewOperationResult;

  /** 添加评论 */
  addComment: (
    reviewId: string,
    stageId: string,
    comment: Omit<ReviewComment, 'id' | 'createdAt' | 'resolvedAt'>
  ) => ReviewOperationResult;

  /** 解决评论 */
  resolveComment: (
    reviewId: string,
    commentId: string,
    resolvedBy: string
  ) => ReviewOperationResult;

  /** 删除评论 */
  deleteComment: (reviewId: string, commentId: string) => ReviewOperationResult;

  /** 加载评审 */
  loadReview: (reviewId: string) => void;

  /** 清除当前评审 */
  clearCurrentReview: () => void;

  /** 重置错误状态 */
  clearError: () => void;

  // ─────────────────────────────────────────────────────────────────────────
  // 选择器方法  // ─────────────────────────────────────────────────────────────────────────

  /** 根据报告ID获取评审 */
  getReviewByReportId: (reportId: string) => Review | undefined;

  /** 获取阶段评论 */
  getStageComments: (reviewId: string, stageId: string) => ReviewComment[];

  /** 获取评审进度 */
  getReviewProgress: (reviewId: string) => {
    percentage: number;
    completedStages: number;
    totalStages: number;
    currentStageName: string;
  };

  /** 获取未解决的评论数量 */
  getUnresolvedCommentsCount: (reviewId: string) => number;

  /** 检查是否可以进入下一阶段 */
  canAdvanceToNextStage: (reviewId: string) => boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// 辅助函数
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 生成唯一ID
 */
const generateId = (prefix: string): string => {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
};

/**
 * 计算阶段截止日期
 */
const calculateDeadline = (stageName: string, startDate: Date = new Date()): string => {
  const days = STAGE_DEADLINES[stageName as keyof typeof STAGE_DEADLINES] || 7;
  const deadline = new Date(startDate.getTime() + days * 24 * 60 * 60 * 1000);
  return deadline.toISOString();
};

/**
 * 验证评审数据
 */
const validateReviewData = (review: Partial<Review>): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (!review.reportId) {
    errors.push('报告ID不能为空');
  }

  if (review.stages?.length === 0) {
    errors.push('至少需要一个评审阶段');
  }

  if (review.stages) {
    review.stages.forEach((stage, index) => {
      if (!stage.name) {
        errors.push(`阶段 ${index + 1} 缺少名称`);
      }
      if (stage.requiredApprovals < 1) {
        errors.push(`阶段 ${index + 1} 至少需要${stage.requiredApprovals}个审批`);
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

/**
 * 计算整体评审状态 */
const calculateOverallStatus = (stages: ReviewStage[]): ReviewStatus => {
  if (stages.every(s => s.status === 'approved')) {
    return 'approved';
  }
  if (stages.some(s => s.status === 'completed')) {
    return 'in_progress';
  }
  if (stages.some(s => s.status === 'in_progress')) {
    return 'in_progress';
  }
  return 'pending';
};

/**
 * 日志记录器 - 使用 safeLogger 包装
 */
const reviewLogger = {
  info: (message: string, data?: any) => {
    logger.info(`[ReviewStore] ${message}`, data || '');
  },
  error: (message: string, error?: any) => {
    logger.error(`[ReviewStore] ${message}`, error || '');
  },
  warn: (message: string, data?: any) => {
    logger.warn(`[ReviewStore] ${message}`, data || '');
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// 状态存储实现 // ─────────────────────────────────────────────────────────────────────────────

export const useReviewStore = create<ReviewState>()(
  devtools(
    persist(
      (set, get) => ({
        // 初始状态
        currentReview: null,
        reviews: new Map(),
        isLoading: false,
        error: null,
        lastUpdated: null,

        // ───────────────────────────────────────────────────────────────────────
        // 操作方法实现
        // ───────────────────────────────────────────────────────────────────────

        createReview: (reportId, options = {}) => {
          try {
            reviewLogger.info('创建新评审', { reportId, options });

            // 生成评审阶段
            const stageConfigs = options.stages || DEFAULT_REVIEW_STAGES;
            const startDate = new Date();

            const stages: ReviewStage[] = stageConfigs.map((config, _index) => ({
              id: generateId('stage'),
              name: config.name,
              description: config.description,
              reviewers: config.reviewers || options.reviewers || [],
              deadline: calculateDeadline(config.name, startDate),
              requiredApprovals: config.requiredApprovals,
              criteria: config.criteria || [],
              status: 'pending',
              approvals: 0,
            }));

            // 创建评审对象
            const newReview: Review = {
              id: generateId('review'),
              reportId,
              stages,
              currentStage: stages[0]?.id || '',
              status: 'pending',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              comments: [],
            };

            // 验证数据
            const validation = validateReviewData(newReview);
            if (!validation.valid) {
              reviewLogger.error('评审数据验证失败', validation.errors);
              return { success: false, error: validation.errors.join('; ') };
            }

            // 更新状态
            set(state => {
              const newReviews = new Map(state.reviews);
              newReviews.set(newReview.id, newReview);

              return {
                currentReview: newReview,
                reviews: newReviews,
                error: null,
                lastUpdated: new Date().toISOString(),
              };
            });

            reviewLogger.info('评审创建成功', { reviewId: newReview.id });
            return { success: true, data: newReview };

          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : '创建评审失败';
            reviewLogger.error('创建评审异常', error);
            set({ error: errorMessage });
            return { success: false, error: errorMessage };
          }
        },

        submitReview: (reviewId) => {
          try {
            const { currentReview, reviews } = get();
            const review = currentReview?.id === reviewId
              ? currentReview
              : reviews.get(reviewId);

            if (!review) {
              return { success: false, error: '评审不存在' };
            }

            if (review.status !== 'pending') {
              return { success: false, error: '评审已提交，无法重复提交' };
            }

            set(state => {
              const updatedReview: Review = {
                ...review,
                status: 'in_progress',
                updatedAt: new Date().toISOString(),
              };

              const newReviews = new Map(state.reviews);
              newReviews.set(reviewId, updatedReview);

              return {
                currentReview: state.currentReview?.id === reviewId
                  ? updatedReview
                  : state.currentReview,
                reviews: newReviews,
                lastUpdated: new Date().toISOString(),
              };
            });

            reviewLogger.info('评审提交成功', { reviewId });
            return { success: true };

          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : '提交评审失败';
            reviewLogger.error('提交评审异常', error);
            set({ error: errorMessage });
            return { success: false, error: errorMessage };
          }
        },

        updateStageStatus: (reviewId, stageId, status, _approverId) => {
          try {
            const { currentReview, reviews } = get();
            const review = currentReview?.id === reviewId
              ? currentReview
              : reviews.get(reviewId);

            if (!review) {
              return { success: false, error: '评审不存在' };
            }

            const stageIndex = review.stages.findIndex(s => s.id === stageId);
            if (stageIndex === -1) {
              return { success: false, error: '阶段不存在' };
            }

            set(state => {
              const stageStatus: StageStatus = status === 'approved' ? 'approved' :
                                 status === 'in_progress' ? 'in_progress' :
                                 status === 'published' ? 'completed' : 'pending';
              const updatedStages = review.stages.map((stage, _index) => {
                if (stage.id !== stageId) return stage;

                const updatedStage: ReviewStage = {
                  ...stage,
                  status: stageStatus,
                  approvals: status === 'approved'
                    ? stage.requiredApprovals
                    : stage.approvals,
                };

                return updatedStage;
              });

              // 确定当前阶段
              let currentStage = review.currentStage;
              if (status === 'approved' && stageIndex < review.stages.length - 1) {
                const nextStage = review.stages[stageIndex + 1];
                if (nextStage) {
                  currentStage = nextStage.id;
                }
              }

              // 计算整体状态
              const overallStatus = calculateOverallStatus(updatedStages);

              const updatedReview: Review = {
                ...review,
                stages: updatedStages,
                currentStage,
                status: overallStatus,
                updatedAt: new Date().toISOString(),
              };

              const newReviews = new Map(state.reviews);
              newReviews.set(reviewId, updatedReview);

              return {
                currentReview: state.currentReview?.id === reviewId
                  ? updatedReview
                  : state.currentReview,
                reviews: newReviews,
                lastUpdated: new Date().toISOString(),
              };
            });

            reviewLogger.info('阶段状态更新成功', { reviewId, stageId, status });
            return { success: true };

          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : '更新阶段状态失败';
            reviewLogger.error('更新阶段状态异常', error);
            set({ error: errorMessage });
            return { success: false, error: errorMessage };
          }
        },

        addComment: (reviewId, stageId, commentData) => {
          try {
            const { currentReview, reviews } = get();
            const review = currentReview?.id === reviewId
              ? currentReview
              : reviews.get(reviewId);

            if (!review) {
              return { success: false, error: '评审不存在' };
            }

            // 验证评论内容
            if (!commentData.content?.trim()) {
              return { success: false, error: '评论内容不能为空' };
            }

            const comment: ReviewComment = {
              ...commentData,
              id: generateId('comment'),
              stageId,
              createdAt: new Date().toISOString(),
              resolvedAt: undefined,
            };

            set(state => {
              const updatedReview: Review = {
                ...review,
                comments: [...(review.comments || []), comment],
                updatedAt: new Date().toISOString(),
              };

              const newReviews = new Map(state.reviews);
              newReviews.set(reviewId, updatedReview);

              return {
                currentReview: state.currentReview?.id === reviewId
                  ? updatedReview
                  : state.currentReview,
                reviews: newReviews,
                lastUpdated: new Date().toISOString(),
              };
            });

            reviewLogger.info('评论添加成功', { reviewId, stageId, commentId: comment.id });
            return { success: true, data: comment };

          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : '添加评论失败';
            reviewLogger.error('添加评论异常', error);
            set({ error: errorMessage });
            return { success: false, error: errorMessage };
          }
        },

        resolveComment: (reviewId, commentId, resolvedBy) => {
          try {
            const { currentReview, reviews } = get();
            const review = currentReview?.id === reviewId
              ? currentReview
              : reviews.get(reviewId);

            if (!review) {
              return { success: false, error: '评审不存在' };
            }

            const comments = review.comments || [];
            const comment = comments.find(c => c.id === commentId);
            if (!comment) {
              return { success: false, error: '评论不存在' };
            }

            if (comment.resolvedAt) {
              return { success: false, error: '评论已解决' };
            }

            set(state => {
              const updatedReview: Review = {
                ...review,
                comments: comments.map(c =>
                  c.id === commentId
                    ? {
                        ...c,
                        resolvedAt: new Date().toISOString(),
                        status: 'resolved' as const,
                        resolvedBy,
                      }
                    : c,
                ),
                updatedAt: new Date().toISOString(),
              };

              const newReviews = new Map(state.reviews);
              newReviews.set(reviewId, updatedReview);

              return {
                currentReview: state.currentReview?.id === reviewId
                  ? updatedReview
                  : state.currentReview,
                reviews: newReviews,
                lastUpdated: new Date().toISOString(),
              };
            });

            reviewLogger.info('评论解决成功', { reviewId, commentId });
            return { success: true };

          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : '解决评论失败';
            reviewLogger.error('解决评论异常', error);
            set({ error: errorMessage });
            return { success: false, error: errorMessage };
          }
        },

        deleteComment: (reviewId, commentId) => {
          try {
            const { currentReview, reviews } = get();
            const review = currentReview?.id === reviewId
              ? currentReview
              : reviews.get(reviewId);

            if (!review) {
              return { success: false, error: '评审不存在' };
            }

            const comments = review.comments || [];
            const commentExists = comments.some(c => c.id === commentId);
            if (!commentExists) {
              return { success: false, error: '评论不存在' };
            }

            set(state => {
              const updatedReview: Review = {
                ...review,
                comments: comments.filter(c => c.id !== commentId),
                updatedAt: new Date().toISOString(),
              };

              const newReviews = new Map(state.reviews);
              newReviews.set(reviewId, updatedReview);

              return {
                currentReview: state.currentReview?.id === reviewId
                  ? updatedReview
                  : state.currentReview,
                reviews: newReviews,
                lastUpdated: new Date().toISOString(),
              };
            });

            reviewLogger.info('评论删除成功', { reviewId, commentId });
            return { success: true };

          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : '删除评论失败';
            reviewLogger.error('删除评论异常', error);
            set({ error: errorMessage });
            return { success: false, error: errorMessage };
          }
        },

        loadReview: (reviewId) => {
          const { reviews } = get();
          const review = reviews.get(reviewId);

          if (review) {
            set({ currentReview: review, error: null });
            reviewLogger.info('加载评审成功', { reviewId });
          } else {
            set({ error: '评审不存在' });
            reviewLogger.warn('加载评审失败：评审不存在', { reviewId });
          }
        },

        clearCurrentReview: () => {
          set({ currentReview: null, error: null });
          reviewLogger.info('清除当前评审');
        },

        clearError: () => {
          set({ error: null });
        },

        // ───────────────────────────────────────────────────────────────────────
        // 选择器方法实现 // ───────────────────────────────────────────────────────────────────────────────

        getReviewByReportId: (reportId) => {
          const { currentReview, reviews } = get();

          if (currentReview?.reportId === reportId) {
            return currentReview;
          }

          for (const review of reviews.values()) {
            if (review.reportId === reportId) {
              return review;
            }
          }

          return undefined;
        },

        getStageComments: (reviewId, stageId) => {
          const { currentReview, reviews } = get();
          const review = currentReview?.id === reviewId
            ? currentReview
            : reviews.get(reviewId);

          if (!review) return [];

          return (review.comments || []).filter(c => c.stageId === stageId);
        },

        getReviewProgress: (reviewId) => {
          const { currentReview, reviews } = get();
          const review = currentReview?.id === reviewId
            ? currentReview
            : reviews.get(reviewId);

          if (!review) {
            return {
              percentage: 0,
              completedStages: 0,
              totalStages: 0,
              currentStageName: '',
            };
          }

          const totalStages = review.stages.length;
          const completedStages = review.stages.filter(
            s => s.status === 'approved',
          ).length;
          const currentStage = review.stages.find(
            s => s.id === review.currentStage,
          );

          return {
            percentage: Math.round((completedStages / totalStages) * 100),
            completedStages,
            totalStages,
            currentStageName: currentStage?.name || '',
          };
        },

        getUnresolvedCommentsCount: (reviewId) => {
          const { currentReview, reviews } = get();
          const review = currentReview?.id === reviewId
            ? currentReview
            : reviews.get(reviewId);

          if (!review) return 0;

          return (review.comments || []).filter(c => !c.resolvedAt).length;
        },

        canAdvanceToNextStage: (reviewId) => {
          const { currentReview, reviews } = get();
          const review = currentReview?.id === reviewId
            ? currentReview
            : reviews.get(reviewId);

          if (!review) return false;

          const currentStage = review.stages.find(
            s => s.id === review.currentStage,
          );

          if (!currentStage) return false;

          // 检查当前阶段是否已批准
          if (currentStage.status !== 'approved') return false;

          // 检查是否有未解决的评论
          const unresolvedComments = (review.comments || []).filter(
            c => c.stageId === currentStage.id && !c.resolvedAt,
          );

          return unresolvedComments.length === 0;
        },
      }),
      {
        name: 'review-storage',
        storage: createJSONStorage(() => localStorage),
        partialize: (state) => ({
          currentReview: state.currentReview,
          reviews: Array.from(state.reviews.entries()),
          lastUpdated: state.lastUpdated,
        }),
        onRehydrateStorage: () => (state) => {
          if (state) {
            // 将数组转换回 Map
            state.reviews = new Map(Array.from(state.reviews as unknown as [string, Review][]));
            reviewLogger.info('状态恢复成功');
          }
        },
      },
    ),
    { name: 'ReviewStore' },
  ),
);

// ─────────────────────────────────────────────────────────────────────────────
// 导出辅助类型和常量 // ─────────────────────────────────────────────────────────────────────────────

export type { ReviewState, ReviewOperationResult };
export { DEFAULT_REVIEW_STAGES, STAGE_DEADLINES };

