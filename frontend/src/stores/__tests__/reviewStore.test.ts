/**
 * 评审流程管理状态存储 - 单元测试
 * 
 * 测试覆盖：
 * - 评审创建与管理
 * - 阶段状态更新
 * - 评论系统操作
 * - 进度计算
 * - 错误处理
 * - 状态持久化
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useReviewStore } from '../reviewStore.enhanced';
import type { ReviewStatus, CommentType } from '@/types/academic-report-lifecycle';

// 模拟 localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

describe('ReviewStore - 评审流程管理', () => {
  beforeEach(() => {
    // 重置存储状态
    useReviewStore.setState({
      currentReview: null,
      reviews: new Map(),
      isLoading: false,
      error: null,
      lastUpdated: null,
    });
    localStorageMock.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 评审创建测试
  // ───────────────────────────────────────────────────────────────────────────

  describe('createReview - 创建评审', () => {
    it('应该成功创建包含默认阶段的评审', () => {
      const store = useReviewStore.getState();
      const result = store.createReview('report-001');

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.reportId).toBe('report-001');
      expect(result.data.stages).toHaveLength(3);
      expect(result.data.status).toBe('pending');
    });

    it('应该使用自定义阶段配置创建评审', () => {
      const store = useReviewStore.getState();
      const customStages = [
        {
          name: '快速审查',
          description: '简化审查流程',
          reviewers: ['reviewer-1'],
          requiredApprovals: 1,
          criteria: [],
          status: 'pending' as ReviewStatus,
          approvals: 0,
        },
      ];

      const result = store.createReview('report-002', {
        stages: customStages,
        reviewers: ['reviewer-1'],
      });

      expect(result.success).toBe(true);
      expect(result.data.stages).toHaveLength(1);
      expect(result.data.stages[0].name).toBe('快速审查');
    });

    it('应该为每个阶段生成正确的截止日期', () => {
      const store = useReviewStore.getState();
      const result = store.createReview('report-003');

      expect(result.success).toBe(true);
      
      const now = new Date();
      const firstStageDeadline = new Date(result.data.stages[0].deadline);
      const daysDiff = Math.floor(
        (firstStageDeadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      expect(daysDiff).toBeGreaterThanOrEqual(6);
      expect(daysDiff).toBeLessThanOrEqual(8);
    });

    it('应该拒绝无效的报告ID', () => {
      const store = useReviewStore.getState();
      const result = store.createReview('');

      expect(result.success).toBe(false);
      expect(result.error).toContain('报告ID');
    });

    it('应该更新 currentReview 和 reviews', () => {
      const store = useReviewStore.getState();
      store.createReview('report-004');

      const state = useReviewStore.getState();
      expect(state.currentReview).not.toBeNull();
      expect(state.currentReview?.reportId).toBe('report-004');
      expect(state.reviews.size).toBe(1);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 评审提交测试
  // ───────────────────────────────────────────────────────────────────────────

  describe('submitReview - 提交评审', () => {
    it('应该成功提交待审状态的评审', () => {
      const store = useReviewStore.getState();
      const createResult = store.createReview('report-005');
      const reviewId = createResult.data.id;

      const submitResult = store.submitReview(reviewId);

      expect(submitResult.success).toBe(true);
      
      const state = useReviewStore.getState();
      expect(state.currentReview?.status).toBe('in_progress');
    });

    it('应该拒绝重复提交', () => {
      const store = useReviewStore.getState();
      const createResult = store.createReview('report-006');
      const reviewId = createResult.data.id;

      store.submitReview(reviewId);
      const secondSubmit = store.submitReview(reviewId);

      expect(secondSubmit.success).toBe(false);
      expect(secondSubmit.error).toContain('已提交');
    });

    it('应该拒绝不存在的评审', () => {
      const store = useReviewStore.getState();
      const result = store.submitReview('non-existent-id');

      expect(result.success).toBe(false);
      expect(result.error).toContain('不存在');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 阶段状态更新测试
  // ───────────────────────────────────────────────────────────────────────────

  describe('updateStageStatus - 更新阶段状态', () => {
    it('应该成功更新阶段状态为已批准', () => {
      const store = useReviewStore.getState();
      const createResult = store.createReview('report-007');
      const reviewId = createResult.data.id;
      const stageId = createResult.data.stages[0].id;

      store.submitReview(reviewId);
      const result = store.updateStageStatus(reviewId, stageId, 'approved');

      expect(result.success).toBe(true);
      
      const state = useReviewStore.getState();
      const stage = state.currentReview?.stages.find(s => s.id === stageId);
      expect(stage?.status).toBe('approved');
      expect(stage?.approvals).toBe(stage?.requiredApprovals);
    });

    it('批准后应自动进入下一阶段', () => {
      const store = useReviewStore.getState();
      const createResult = store.createReview('report-008');
      const reviewId = createResult.data.id;
      const firstStageId = createResult.data.stages[0].id;
      const secondStageId = createResult.data.stages[1].id;

      store.submitReview(reviewId);
      store.updateStageStatus(reviewId, firstStageId, 'approved');

      const state = useReviewStore.getState();
      expect(state.currentReview?.currentStage).toBe(secondStageId);
    });

    it('所有阶段批准后整体状态应为已批准', () => {
      const store = useReviewStore.getState();
      const createResult = store.createReview('report-009');
      const reviewId = createResult.data.id;

      store.submitReview(reviewId);
      
      createResult.data.stages.forEach(stage => {
        store.updateStageStatus(reviewId, stage.id, 'approved');
      });

      const state = useReviewStore.getState();
      expect(state.currentReview?.status).toBe('approved');
    });

    it('任一阶段拒绝后整体状态应为已拒绝', () => {
      const store = useReviewStore.getState();
      const createResult = store.createReview('report-010');
      const reviewId = createResult.data.id;
      const stageId = createResult.data.stages[0].id;

      store.submitReview(reviewId);
      store.updateStageStatus(reviewId, stageId, 'rejected');

      const state = useReviewStore.getState();
      expect(state.currentReview?.status).toBe('rejected');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 评论系统测试
  // ───────────────────────────────────────────────────────────────────────────

  describe('addComment - 添加评论', () => {
    it('应该成功添加评论', () => {
      const store = useReviewStore.getState();
      const createResult = store.createReview('report-011');
      const reviewId = createResult.data.id;
      const stageId = createResult.data.stages[0].id;

      const result = store.addComment(reviewId, stageId, {
        authorId: 'user-1',
        authorName: '测试用户',
        content: '这是一条测试评论',
        type: 'suggestion' as CommentType,
        status: 'open',
      });

      expect(result.success).toBe(true);
      expect(result.data.content).toBe('这是一条测试评论');
      
      const state = useReviewStore.getState();
      expect(state.currentReview?.comments).toHaveLength(1);
    });

    it('应该拒绝空评论', () => {
      const store = useReviewStore.getState();
      const createResult = store.createReview('report-012');
      const reviewId = createResult.data.id;
      const stageId = createResult.data.stages[0].id;

      const result = store.addComment(reviewId, stageId, {
        authorId: 'user-1',
        authorName: '测试用户',
        content: '',
        type: 'suggestion' as CommentType,
        status: 'open',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('不能为空');
    });

    it('应该为评论生成唯一ID和时间戳', () => {
      const store = useReviewStore.getState();
      const createResult = store.createReview('report-013');
      const reviewId = createResult.data.id;
      const stageId = createResult.data.stages[0].id;

      const result = store.addComment(reviewId, stageId, {
        authorId: 'user-1',
        authorName: '测试用户',
        content: '测试',
        type: 'suggestion' as CommentType,
        status: 'open',
      });

      expect(result.data.id).toBeDefined();
      expect(result.data.id).toMatch(/^comment-/);
      expect(result.data.createdAt).toBeDefined();
    });
  });

  describe('resolveComment - 解决评论', () => {
    it('应该成功解决评论', () => {
      const store = useReviewStore.getState();
      const createResult = store.createReview('report-014');
      const reviewId = createResult.data.id;
      const stageId = createResult.data.stages[0].id;

      const addResult = store.addComment(reviewId, stageId, {
        authorId: 'user-1',
        authorName: '测试用户',
        content: '需要修改',
        type: 'suggestion' as CommentType,
        status: 'open',
      });

      const resolveResult = store.resolveComment(
        reviewId, 
        addResult.data.id, 
        'resolver-1'
      );

      expect(resolveResult.success).toBe(true);
      
      const state = useReviewStore.getState();
      const comment = state.currentReview?.comments[0];
      expect(comment?.resolvedAt).toBeDefined();
      expect(comment?.status).toBe('resolved');
    });

    it('应该拒绝重复解决', () => {
      const store = useReviewStore.getState();
      const createResult = store.createReview('report-015');
      const reviewId = createResult.data.id;
      const stageId = createResult.data.stages[0].id;

      const addResult = store.addComment(reviewId, stageId, {
        authorId: 'user-1',
        authorName: '测试用户',
        content: '需要修改',
        type: 'suggestion' as CommentType,
        status: 'open',
      });

      store.resolveComment(reviewId, addResult.data.id, 'resolver-1');
      const secondResolve = store.resolveComment(
        reviewId, 
        addResult.data.id, 
        'resolver-2'
      );

      expect(secondResolve.success).toBe(false);
      expect(secondResolve.error).toContain('已解决');
    });
  });

  describe('deleteComment - 删除评论', () => {
    it('应该成功删除评论', () => {
      const store = useReviewStore.getState();
      const createResult = store.createReview('report-016');
      const reviewId = createResult.data.id;
      const stageId = createResult.data.stages[0].id;

      const addResult = store.addComment(reviewId, stageId, {
        authorId: 'user-1',
        authorName: '测试用户',
        content: '待删除',
        type: 'suggestion' as CommentType,
        status: 'open',
      });

      const deleteResult = store.deleteComment(reviewId, addResult.data.id);

      expect(deleteResult.success).toBe(true);
      
      const state = useReviewStore.getState();
      expect(state.currentReview?.comments).toHaveLength(0);
    });

    it('应该拒绝删除不存在的评论', () => {
      const store = useReviewStore.getState();
      const createResult = store.createReview('report-017');
      const reviewId = createResult.data.id;

      const result = store.deleteComment(reviewId, 'non-existent-comment');

      expect(result.success).toBe(false);
      expect(result.error).toContain('不存在');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 选择器测试
  // ───────────────────────────────────────────────────────────────────────────

  describe('选择器方法', () => {
    it('getReviewByReportId - 应返回正确的评审', () => {
      const store = useReviewStore.getState();
      store.createReview('report-018');

      const review = store.getReviewByReportId('report-018');
      expect(review).toBeDefined();
      expect(review?.reportId).toBe('report-018');
    });

    it('getStageComments - 应返回特定阶段的评论', () => {
      const store = useReviewStore.getState();
      const createResult = store.createReview('report-019');
      const reviewId = createResult.data.id;
      const stageId = createResult.data.stages[0].id;

      store.addComment(reviewId, stageId, {
        authorId: 'user-1',
        authorName: '测试用户',
        content: '阶段评论',
        type: 'suggestion' as CommentType,
        status: 'open',
      });

      const comments = store.getStageComments(reviewId, stageId);
      expect(comments).toHaveLength(1);
      expect(comments[0].stageId).toBe(stageId);
    });

    it('getReviewProgress - 应正确计算进度', () => {
      const store = useReviewStore.getState();
      const createResult = store.createReview('report-020');
      const reviewId = createResult.data.id;

      store.submitReview(reviewId);
      store.updateStageStatus(
        reviewId, 
        createResult.data.stages[0].id, 
        'approved'
      );

      const progress = store.getReviewProgress(reviewId);
      expect(progress.percentage).toBe(33);
      expect(progress.completedStages).toBe(1);
      expect(progress.totalStages).toBe(3);
    });

    it('getUnresolvedCommentsCount - 应返回未解决评论数', () => {
      const store = useReviewStore.getState();
      const createResult = store.createReview('report-021');
      const reviewId = createResult.data.id;
      const stageId = createResult.data.stages[0].id;

      store.addComment(reviewId, stageId, {
        authorId: 'user-1',
        authorName: '测试用户',
        content: '评论1',
        type: 'suggestion' as CommentType,
        status: 'open',
      });

      store.addComment(reviewId, stageId, {
        authorId: 'user-2',
        authorName: '测试用户2',
        content: '评论2',
        type: 'suggestion' as CommentType,
        status: 'open',
      });

      const count = store.getUnresolvedCommentsCount(reviewId);
      expect(count).toBe(2);
    });

    it('canAdvanceToNextStage - 应正确判断是否可进入下一阶段', () => {
      const store = useReviewStore.getState();
      const createResult = store.createReview('report-022');
      const reviewId = createResult.data.id;
      const stageId = createResult.data.stages[0].id;

      store.submitReview(reviewId);

      // 未批准时不可进入
      expect(store.canAdvanceToNextStage(reviewId)).toBe(false);

      // 批准后可进入
      store.updateStageStatus(reviewId, stageId, 'approved');
      expect(store.canAdvanceToNextStage(reviewId)).toBe(true);

      // 有未解决评论时不可进入
      store.addComment(reviewId, stageId, {
        authorId: 'user-1',
        authorName: '测试用户',
        content: '需要修改',
        type: 'suggestion' as CommentType,
        status: 'open',
      });
      expect(store.canAdvanceToNextStage(reviewId)).toBe(false);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 错误处理测试
  // ───────────────────────────────────────────────────────────────────────────

  describe('错误处理', () => {
    it('操作失败时应设置错误信息', () => {
      const store = useReviewStore.getState();
      store.submitReview('non-existent-id');

      const state = useReviewStore.getState();
      expect(state.error).not.toBeNull();
    });

    it('clearError 应清除错误信息', () => {
      const store = useReviewStore.getState();
      store.submitReview('non-existent-id');
      store.clearError();

      const state = useReviewStore.getState();
      expect(state.error).toBeNull();
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 状态管理测试
  // ───────────────────────────────────────────────────────────────────────────

  describe('状态管理', () => {
    it('loadReview 应正确加载评审', () => {
      const store = useReviewStore.getState();
      const createResult = store.createReview('report-023');
      const reviewId = createResult.data.id;

      // 清除当前评审
      store.clearCurrentReview();
      expect(useReviewStore.getState().currentReview).toBeNull();

      // 重新加载
      store.loadReview(reviewId);
      expect(useReviewStore.getState().currentReview?.id).toBe(reviewId);
    });

    it('clearCurrentReview 应清除当前评审', () => {
      const store = useReviewStore.getState();
      store.createReview('report-024');

      store.clearCurrentReview();

      const state = useReviewStore.getState();
      expect(state.currentReview).toBeNull();
    });
  });
});
