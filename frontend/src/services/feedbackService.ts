/**
 * 用户反馈服务
 * 提供操作成功确认、加载状态指示、进度提示、交互反馈
 */

import type { ReactNode } from 'react';
import { logger } from '@/utils/safeLogger';


// 反馈类型
export enum FeedbackType {
  SUCCESS = 'success',
  ERROR = 'error',
  WARNING = 'warning',
  INFO = 'info',
}

// 加载状态
export enum LoadingState {
  IDLE = 'idle',
  LOADING = 'loading',
  SUCCESS = 'success',
  ERROR = 'error',
}

// 反馈消息接口
export interface FeedbackMessage {
  id: string;
  type: FeedbackType;
  title: string;
  message: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
  icon?: ReactNode;
  timestamp: number;
}

// 进度条状态
export interface ProgressState {
  isVisible: boolean;
  message: string;
  progress: number; // 0-100
  stage?: string;
  detail?: string;
  canCancel?: boolean;
  cancelAction?: () => void;
}

// 操作跟踪
export interface OperationTracker {
  id: string;
  name: string;
  startTime: number;
  duration?: number;
  status: LoadingState;
}

class FeedbackService {
  private static instance: FeedbackService;
  private messages: FeedbackMessage[] = [];
  private progress: ProgressState = {
    isVisible: false,
    message: '',
    progress: 0,
  };
  private activeOperations = new Map<string, OperationTracker>();
  private messageListeners: ((messages: FeedbackMessage[]) => void)[] = [];
  private progressListeners: ((progress: ProgressState) => void)[] = [];
  private readonly DEFAULT_DURATION = 3000;

  private constructor() {}

  public static getInstance(): FeedbackService {
    if (!FeedbackService.instance) {
      FeedbackService.instance = new FeedbackService();
    }
    return FeedbackService.instance;
  }

  // 消息监听
  public addMessageListener(callback: (messages: FeedbackMessage[]) => void): () => void {
    this.messageListeners.push(callback);
    return () => {
      this.messageListeners = this.messageListeners.filter(cb => cb !== callback);
    };
  }

  // 进度监听
  public addProgressListener(callback: (progress: ProgressState) => void): () => void {
    this.progressListeners.push(callback);
    return () => {
      this.progressListeners = this.progressListeners.filter(cb => cb !== callback);
    };
  }

  // 显示成功消息
  public showSuccess(
    title: string,
    message: string,
    options: { duration?: number; action?: FeedbackMessage['action'] } = {},
  ): string {
    const id = this.createMessageId();
    this.addMessage({
      id,
      type: FeedbackType.SUCCESS,
      title,
      message,
      duration: options.duration || this.DEFAULT_DURATION,
      action: options.action,
      timestamp: Date.now(),
    });
    return id;
  }

  // 显示错误消息
  public showError(
    title: string,
    message: string,
    options: { duration?: number; action?: FeedbackMessage['action'] } = {},
  ): string {
    const id = this.createMessageId();
    this.addMessage({
      id,
      type: FeedbackType.ERROR,
      title,
      message,
      duration: options.duration || 5000,
      action: options.action,
      timestamp: Date.now(),
    });
    return id;
  }

  // 显示警告消息
  public showWarning(
    title: string,
    message: string,
    options: { duration?: number; action?: FeedbackMessage['action'] } = {},
  ): string {
    const id = this.createMessageId();
    this.addMessage({
      id,
      type: FeedbackType.WARNING,
      title,
      message,
      duration: options.duration || 4000,
      action: options.action,
      timestamp: Date.now(),
    });
    return id;
  }

  // 显示信息消息
  public showInfo(
    title: string,
    message: string,
    options: { duration?: number; action?: FeedbackMessage['action'] } = {},
  ): string {
    const id = this.createMessageId();
    this.addMessage({
      id,
      type: FeedbackType.INFO,
      title,
      message,
      duration: options.duration || this.DEFAULT_DURATION,
      action: options.action,
      timestamp: Date.now(),
    });
    return id;
  }

  // 添加消息
  private addMessage(message: FeedbackMessage): void {
    this.messages = [...this.messages, message];
    this.notifyMessageListeners();

    // 自动清除
    if (message.duration && message.duration > 0) {
      setTimeout(() => {
        this.removeMessage(message.id);
      }, message.duration);
    }
  }

  // 移除消息
  public removeMessage(id: string): void {
    this.messages = this.messages.filter(m => m.id !== id);
    this.notifyMessageListeners();
  }

  // 清除所有消息
  public clearMessages(): void {
    this.messages = [];
    this.notifyMessageListeners();
  }

  // 获取当前消息
  public getMessages(): FeedbackMessage[] {
    return [...this.messages];
  }

  // 通知消息监听器
  private notifyMessageListeners(): void {
    this.messageListeners.forEach(callback => {
      try {
        callback(this.messages);
      } catch (error) {
        logger.error('消息监听器执行失败:', error);
      }
    });
  }

  // 显示进度条
  public showProgress(
    message: string,
    options: {
      initialProgress?: number;
      stage?: string;
      detail?: string;
      canCancel?: boolean;
      cancelAction?: () => void;
    } = {},
  ): void {
    this.progress = {
      isVisible: true,
      message,
      progress: options.initialProgress || 0,
      stage: options.stage,
      detail: options.detail,
      canCancel: options.canCancel,
      cancelAction: options.cancelAction,
    };
    this.notifyProgressListeners();
  }

  // 更新进度
  public updateProgress(
    progress: number,
    options: { stage?: string; detail?: string; message?: string } = {},
  ): void {
    this.progress = {
      ...this.progress,
      isVisible: true,
      progress: Math.max(0, Math.min(100, progress)),
      stage: options.stage || this.progress.stage,
      detail: options.detail || this.progress.detail,
      message: options.message || this.progress.message,
    };
    this.notifyProgressListeners();
  }

  // 完成进度
  public completeProgress(message?: string): void {
    this.progress = {
      ...this.progress,
      isVisible: false,
      progress: 100,
      message: message || '操作完成',
    };
    this.notifyProgressListeners();
    setTimeout(() => {
      this.hideProgress();
    }, 500);
  }

  // 错误进度
  public errorProgress(message: string): void {
    this.progress = {
      ...this.progress,
      isVisible: true,
      progress: 0,
      message,
    };
    this.notifyProgressListeners();
  }

  // 隐藏进度条
  public hideProgress(): void {
    this.progress = {
      isVisible: false,
      message: '',
      progress: 0,
    };
    this.notifyProgressListeners();
  }

  // 获取进度状态
  public getProgress(): ProgressState {
    return { ...this.progress };
  }

  // 通知进度监听器
  private notifyProgressListeners(): void {
    this.progressListeners.forEach(callback => {
      try {
        callback(this.progress);
      } catch (error) {
        logger.error('进度监听器执行失败:', error);
      }
    });
  }

  // 开始操作跟踪
  public startOperation(name: string): string {
    const id = this.createOperationId();
    const tracker: OperationTracker = {
      id,
      name,
      startTime: Date.now(),
      status: LoadingState.LOADING,
    };
    this.activeOperations.set(id, tracker);
    return id;
  }

  // 更新操作状态
  public updateOperation(
    id: string,
    status: LoadingState,
  ): OperationTracker | undefined {
    const tracker = this.activeOperations.get(id);
    if (tracker) {
      const updated: OperationTracker = {
        ...tracker,
        status,
        duration: Date.now() - tracker.startTime,
      };
      this.activeOperations.set(id, updated);
      return updated;
    }
    return undefined;
  }

  // 完成操作
  public completeOperation(id: string): OperationTracker | undefined {
    const updated = this.updateOperation(id, LoadingState.SUCCESS);
    setTimeout(() => {
      this.activeOperations.delete(id);
    }, 5000);
    return updated;
  }

  // 失败操作
  public failOperation(id: string): OperationTracker | undefined {
    const updated = this.updateOperation(id, LoadingState.ERROR);
    setTimeout(() => {
      this.activeOperations.delete(id);
    }, 10000);
    return updated;
  }

  // 获取活跃操作
  public getActiveOperations(): OperationTracker[] {
    return Array.from(this.activeOperations.values());
  }

  // 帮助方法
  private createMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  private createOperationId(): string {
    return `op_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }
}

export const feedbackService = FeedbackService.getInstance();

export default FeedbackService;
