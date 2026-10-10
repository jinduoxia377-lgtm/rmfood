/**
 * ChatInputArea - 智能对话输入区域 (v8.0 Pure Layout)
 *
 * v8.0 架构重构 (2026-05-21):
 * ✅ 精简至纯布局组装组件（目标 ≤250 行）
 * ✅ 所有状态逻辑已提取至 useChatInputState Hook
 * ✅ UI面板已拆分为独立组件：
 *    - SuggestionPanel: 智能建议面板
 *    - DeepThinkingPanel: 深度分析面板
 *    - SearchPanel: 搜索结果面板
 * ✅ 异步操作已升级为可取消模式
 * ✅ 安全性增强（XSS防护 + 文件上传验证）
 *
 * 核心职责：
 * - 组合 useChatInputState Hook 获取状态和方法
 * - 渲染纯 JSX 布局结构
 * - 委托给子组件处理具体功能
 *
 * @version 8.0.0
 * @lastUpdated 2026-05-21
 * @author RMFOOD Team (AI-Assisted Refactoring)
 */

import React, { memo, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui';
import {
  Mic,
  Settings,
  Paperclip,
  Scissors,
  User,
  Send,
  Loader2,
  AlertTriangle,
  Brain,
  Search,
  Sparkles,
  X,
  Image,
  FileText,
  File,
  XCircle,
} from 'lucide-react';

import { useChatInputState } from '../hooks/useChatInputState';
import SuggestionPanel from './SuggestionPanel';
import DeepThinkingPanel from './DeepThinkingPanel';
import { SearchPanel } from './SearchPanel';
import ChatInputSettingsDialog from './ChatInputSettingsDialog';
import type { Attachment, AttachmentType } from '../services/clipboardAttachmentService';

export interface ChatInputAreaProps {
  value: string;
  onChange: (value: string) => void;
  onSend: (value: string) => void;
  isStreaming: boolean;
  disabled?: boolean;
  placeholder?: string;
  maxLength?: number;
  deepThinking?: boolean;
  smartSearch?: boolean;
  onDeepThinkingChange?: (enabled: boolean) => void;
  onSmartSearchChange?: (enabled: boolean) => void;
  conversationHistory?: string[];
  messageCount?: number;
  onStopStreaming?: () => void;

  // AI思考过程相关
  thinkingSteps?: {
    id: string;
    title: string;
    content: string;
    timestamp: number;
    confidence: number;
    status: 'pending' | 'processing' | 'completed' | 'error';
  }[];
  isThinking?: boolean;
  isThinkingVisible?: boolean;
  onToggleThinking?: () => void;
}

const getAttachmentIcon = (type: AttachmentType) => {
  switch (type) {
    case 'image':
      return Image;
    case 'document':
      return FileText;
    case 'text':
      return File;
    default:
      return File;
  }
};

export const ChatInputArea = memo(
  ({
    value: propsValue,
    onChange: propsOnChange,
    onSend,
    isStreaming,
    disabled,
    placeholder = '输入您的问题...',
    maxLength,
    deepThinking: externalDeepThinking,
    smartSearch: externalSmartSearch,
    onDeepThinkingChange,
    onSmartSearchChange,
    conversationHistory = [],

    // AI思考过程相关
    thinkingSteps = [],
    isThinking = false,
    isThinkingVisible = false,
    onToggleThinking,
  }: ChatInputAreaProps) => {
    const state = useChatInputState({
      initialValue: propsValue,
      maxLength,
      externalDeepThinking,
      externalSmartSearch,
      onDeepThinkingChange,
      onSmartSearchChange,
      conversationHistory,
      onChange: propsOnChange,
    });

    useEffect(() => {
      // 确保内部状态与外部 propsValue 同步
      if (propsValue !== state.value) {
        state.onChange(propsValue);
      }
    }, [propsValue, state.value]);

    // 定义 handleSend
    const handleSend = useCallback(() => {
      const canSendMessage = !disabled && !isStreaming && state.value.trim().length > 0 && !state.showFormatError;

      if (canSendMessage) {
        // 关键修复：先保存当前值，再调用onSend，不要立即清空
        const currentValue = state.value;
        onSend(currentValue); // 将当前值传入回调，由ChatTab成功后再清空
      }
    }, [state.canSend, onSend, disabled, isStreaming, state.value]);

    // 监听 Enter 键发送事件
    useEffect(() => {
      const handler = () => handleSend();
      window.addEventListener('chat:send-message', handler);
      return () => window.removeEventListener('chat:send-message', handler);
    }, [handleSend]);

    const canSend = !disabled && !isStreaming && state.value.trim().length > 0 && !state.showFormatError;

    const isOverLimit = maxLength && state.charCount > maxLength * 0.9;
    const isExceeded = maxLength && state.charCount > maxLength;

    return (
      <div className="border-t border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900/95 sticky bottom-0 left-0 right-0 z-40 backdrop-blur-md">
        {(state.deepThinking || state.smartSearch) && (
          <div className="px-4 py-2 bg-gradient-to-r from-primary-50 to-accent-50 dark:from-primary-900/20 dark:to-accent-900/20 border-b border-primary-100 dark:border-primary-800/50">
            <div className="max-w-4xl mx-auto flex items-center gap-4 text-xs">
              {state.deepThinking && (
                <div className="flex items-center gap-1.5 text-neutral-700 dark:text-neutral-300">
                  <Brain className="w-3.5 h-3.5 text-neutral-600 dark:text-neutral-400" />
                  <span>深度思考模式已启用</span>
                  <button
                    onClick={() => state.toggleDeepThinking()}
                    className="ml-1 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-400 transition-colors"
                    aria-label="禁用深度思考"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
              {state.smartSearch && (
                <div className="flex items-center gap-1.5 text-primary-700 dark:text-primary-700">
                  <Search className="w-3.5 h-3.5" />
                  <span>智能搜索模式已启用</span>
                  <button
                    onClick={() => state.toggleSmartSearch()}
                    className="ml-1 text-neutral-400 hover:text-primary-700 dark:hover:text-primary-600 transition-colors"
                    aria-label="禁用智能搜索"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="max-w-full mx-auto px-4 py-3 sm:px-6 lg:px-8 relative">
          <SuggestionPanel
            suggestions={state.suggestions}
            isVisible={state.showSuggestions}
            isStreaming={isStreaming}
            detectedLanguage={state.detectedLanguage}
            onApplySuggestion={(s) => {
              if ('qScore' in s && 'sections' in s) {
                // EnhancedSuggestion: just append the title
                if (state.onChange) {
                  state.onChange(state.value + ' ' + s.title)
                }
              } else {
                state.applySuggestion(s)
              }
            }}
            onClose={() => state.setShowSuggestions(false)}
            currentInput={state.value}
          />

          <DeepThinkingPanel
            analysis={state.deepThinkingAnalysis}
            isVisible={state.showDeepThinkingPanel}
            isAnalyzing={state.isAnalyzing}
            onApplyQuestion={(question) => state.onChange(question)}
            onClose={() => state.setShowDeepThinkingPanel(false)}
          />

          <SearchPanel
            results={[]}
            isVisible={state.showSearchPanel}
            isSearching={state.isSearching}
            onSelectResult={() => {}}
            onClose={() => state.setShowSearchPanel(false)}
          />

          {state.showAttachments && state.attachments.length > 0 && (
            <div className="absolute bottom-full left-4 right-4 sm:left-6 sm:right-6 lg:left-8 lg:right-8 mb-2 bg-white dark:bg-neutral-800 rounded-2xl shadow-lg border border-neutral-200/80 dark:border-neutral-700/80 overflow-hidden z-50 animate-in slide-in-from-bottom-2 fade-in duration-150">
              <div className="px-4 py-3 border-b border-neutral-100 dark:border-neutral-700 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Paperclip className="w-4 h-4 text-neutral-700 dark:text-neutral-300" />
                  <span className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
                    已添加附件 ({state.attachments.length})
                  </span>
                </div>
                <button
                  onClick={() => {
                    state.clearAll();
                    state.setShowAttachments(false);
                  }}
                  className="p-1 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded transition-colors"
                  aria-label="清空所有附件"
                >
                  <XCircle className="w-4 h-4 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" />
                </button>
              </div>
              <div className="p-3 grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                {state.attachments.map((attachment) => {
                  const Icon = getAttachmentIcon(attachment.type as AttachmentType);
                  return (
                    <div
                      key={attachment.id}
                      className="flex items-center gap-2 p-2 bg-neutral-50 dark:bg-neutral-700 rounded-lg group"
                    >
                      {attachment.preview ? (
                        <img
                          src={attachment.preview}
                          alt={attachment.name}
                          className="w-10 h-10 rounded object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-neutral-200 dark:bg-neutral-600 flex items-center justify-center">
                          <Icon className="w-5 h-5 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-neutral-800 dark:text-neutral-200 truncate">
                          {attachment.name}
                        </div>
                        <div className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">{(attachment.size / 1024).toFixed(1)} KB</div>
                      </div>
                      <button
                        onClick={() => state.removeAttachment(attachment.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-neutral-200 dark:hover:bg-neutral-600 rounded transition-all"
                        aria-label="移除附件"
                      >
                        <X className="w-3.5 h-3.5 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ===== AI思考过程展示区域（位于输入框上方）===== */}
          {isThinkingVisible && (
            <div className="mb-3 bg-white rounded-2xl border border-neutral-200 dark:border-neutral-700 overflow-hidden shadow-sm">
              {/* 标题栏 */}
              <div
                className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-accent-500 to-accent-600 cursor-pointer hover:opacity-95 transition-opacity"
                 role="button" tabIndex={0} onClick={onToggleThinking}
              >
                <div className="flex items-center gap-2">
                  <Brain className="w-5 h-5 text-white" />
                  <span className="font-semibold text-white">AI思考过程</span>
                </div>
                <div className="flex items-center gap-1 text-sm text-white/80">
                  <span>点击收起</span>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>

              {/* 思考内容区域 */}
              <div className="px-4 py-6">
                {thinkingSteps.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-4 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
                    <div className="w-14 h-14 rounded-full bg-gradient-to-br from-accent-100 to-accent-100 dark:from-accent-900/30 dark:to-accent-900/30 flex items-center justify-center mb-3">
                      <Sparkles className="w-7 h-7 text-accent-400" />
                    </div>
                    <p className="text-sm font-medium">AI正在准备思考...</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-48 overflow-y-auto">
                    {thinkingSteps.map((step) => (
                      <div
                        key={step.id}
                        className={`p-3 rounded-xl border transition-all duration-300 ${
                          step.status === 'processing'
                            ? 'bg-secondary-50 border-secondary-200 dark:bg-secondary-300/20 dark:border-secondary-800'
                            : step.status === 'completed'
                              ? 'bg-success-50 border-success-200 dark:bg-success-300/20 dark:border-success-800'
                              : step.status === 'error'
                                ? 'bg-error-50 border-error-200 dark:bg-error-300/20 dark:border-error-800'
                                : 'bg-neutral-50 border-neutral-200 dark:bg-neutral-800/50 dark:border-neutral-700'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <div
                            className={`
                          w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0
                          ${step.status === 'pending' ? 'bg-neutral-300' : ''}
                          ${step.status === 'processing' ? 'bg-secondary-500' : ''}
                          ${step.status === 'completed' ? 'bg-success-500' : ''}
                          ${step.status === 'error' ? 'bg-error-500' : ''}
                        `}
                          >
                            {step.status === 'processing' && <Loader2 className="w-3 h-3 text-white animate-spin" />}
                            {step.status === 'completed' && (
                              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                          <span className="text-sm font-medium text-neutral-800 dark:text-neutral-200">{step.title}</span>
                          <span className="text-xs text-neutral-500 dark:text-neutral-400">
                            置信度: {Math.round(step.confidence * 100)}%
                          </span>
                        </div>
                        <p className="text-sm text-neutral-600 dark:text-neutral-300 ml-7">{step.content}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          <input
            ref={state.fileInputRef}
            type="file"
            multiple
            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.md"
            onChange={state.handleFileSelect}
            className="hidden"
            aria-label="选择文件"
          />

          <div
            id="chat-input-container"
            className={`flex items-center bg-white dark:bg-neutral-900 rounded-xl border transition-all duration-200 ease-out overflow-hidden ${
              state.isFocused
                ? 'border-accent-400 dark:border-accent-400 shadow-md shadow-accent-500/10 ring-1 ring-accent-500/20'
                : 'border-neutral-200 dark:border-neutral-700 shadow-sm'
            } ${state.showFormatError ? 'border-error-400 dark:border-error-400 shadow-md shadow-error-500/10 ring-1 ring-error-500/20' : ''} ${state.isDragging ? 'border-accent-400 dark:border-accent-400 bg-accent-50/50 dark:bg-accent-300/15 shadow-md shadow-accent-500/15' : ''}`}
          >
            <div className="flex items-center gap-0.5 pl-2 sm:pl-3">
              <button
                onClick={() => state.setShowMic(!state.showMic)}
                disabled={disabled || isStreaming}
                className={`p-2.5 sm:p-3 transition-all duration-200 rounded-full hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 ${disabled || isStreaming ? 'opacity-50 cursor-not-allowed' : ''}`}
                title="语音输入"
                aria-label="语音输入"
                aria-pressed={state.showMic}
              >
                <Mic className="w-4 h-4" />
              </button>
              <button
                onClick={() => state.setShowSettings(!state.showSettings)}
                disabled={disabled || isStreaming}
                className={`p-2.5 sm:p-3 transition-all duration-200 rounded-full hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 ${disabled || isStreaming ? 'opacity-50 cursor-not-allowed' : ''}`}
                title="设置"
                aria-label="设置"
                aria-pressed={state.showSettings}
              >
                <Settings className="w-4 h-4" />
              </button>
              <div className="relative">
                <button
                  onClick={() => {
                    state.setShowAttachments(!state.showAttachments);
                    if (!state.showAttachments && state.attachments.length === 0) {
                      state.fileInputRef.current?.click();
                    }
                  }}
                  disabled={disabled || isStreaming}
                  className={`p-2.5 sm:p-3 transition-all duration-200 rounded-full hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 ${disabled || isStreaming ? 'opacity-50 cursor-not-allowed' : ''} ${state.attachments.length > 0 ? 'text-primary-500' : ''}`}
                  title="附件"
                  aria-label="附件"
                  aria-expanded={state.showAttachments}
                >
                  <Paperclip className="w-4 h-4" />
                </button>
                {state.attachments.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-primary-container text-primary-main text-xs rounded-full flex items-center justify-center font-medium">
                    {state.attachments.length}
                  </span>
                )}
              </div>
              <button
                onClick={() => state.fileInputRef.current?.click()}
                disabled={disabled || isStreaming}
                className={`hidden sm:flex p-2.5 sm:p-3 transition-all duration-200 rounded-full hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 ${disabled || isStreaming ? 'opacity-50 cursor-not-allowed' : ''}`}
                title="剪贴板"
                aria-label="剪贴板"
              >
                <Scissors className="w-4 h-4" />
              </button>
              <button
                disabled={disabled || isStreaming}
                className={`hidden md:flex p-2.5 sm:p-3 transition-all duration-200 rounded-full hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 ${disabled || isStreaming ? 'opacity-50 cursor-not-allowed' : ''}`}
                title="用户资料"
                aria-label="用户资料"
              >
                <User className="w-4 h-4" />
              </button>
            </div>

            <div className="h-6 w-px bg-neutral-300 dark:bg-neutral-600 mx-1" />

            <textarea
              ref={state.inputRef}
              id="chat-input"
              name="chat-message"
              placeholder={placeholder}
              value={state.value}
              onChange={(e) => state.onChange(e.target.value)}
              onKeyDown={state.handleKeyDown}
              onFocus={state.onFocus}
              onBlur={state.onBlur}
              disabled={disabled || isStreaming}
              className="flex-1 resize-none text-base sm:text-sm leading-[1.6] tracking-[0.01em] px-3 py-3 sm:px-4 sm:py-3 bg-transparent border-0 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus:outline-none focus:ring-0 transition-all duration-200 min-h-[44px]"
              style={{ height: `${state.inputHeight}px`, maxHeight: `${state.inputBehavior.maxHeight}px` }}
              maxLength={maxLength}
              aria-label="消息输入"
              aria-describedby="input-hints"
              aria-invalid={state.showFormatError}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck="false"
            />

            <div className="h-6 w-px bg-neutral-300 dark:bg-neutral-600 mx-1" />

            <div className="flex items-center gap-0.5 pr-2 sm:pr-3">
              <button
                onClick={() => state.setShowSuggestions(!state.showSuggestions)}
                disabled={disabled || isStreaming}
                className={`p-2.5 sm:p-3 transition-all duration-200 rounded-full hover:bg-neutral-200 dark:hover:bg-neutral-700 ${state.showSuggestions ? 'text-primary-700 dark:text-primary-700' : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'} ${disabled || isStreaming ? 'opacity-50 cursor-not-allowed' : ''}`}
                title="智能建议"
                aria-label="智能建议"
                aria-pressed={state.showSuggestions}
                aria-expanded={state.showSuggestions}
              >
                <Sparkles className="w-4 h-4" />
              </button>
              <button
                onClick={handleSend}
                disabled={!canSend}
                className={`h-11 w-11 sm:h-11 sm:w-11 rounded-full transition-all duration-300 flex items-center justify-center ${
                  canSend
                    ? 'bg-gradient-to-r from-accent-500 to-accent-600 hover:from-accent-600 hover:to-accent-700 text-white shadow-md hover:shadow-lg hover:scale-105 cursor-pointer'
                    : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-400 cursor-not-allowed'
                } ${!canSend ? 'opacity-50' : ''}`}
                aria-label={isStreaming ? '发送中...' : '发送消息'}
                aria-disabled={!canSend}
              >
                {isStreaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {state.showFormatError && (
            <div
              id="format-error"
              className="mt-2 flex items-center gap-2 text-error-500 dark:text-error-600 text-xs sm:text-sm"
              role="alert"
              aria-live="polite"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>{state.errorMessage}</span>
            </div>
          )}

          <div className="flex items-center justify-between mt-2 sm:mt-3">
            <div className="flex items-center gap-2 sm:gap-3">
              <button
                onClick={() => state.toggleDeepThinking()}
                disabled={isStreaming}
                className={`flex items-center gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-medium transition-all duration-300 ${
                  state.deepThinking
                    ? 'bg-gradient-to-r from-accent-500 to-accent-600 text-white shadow-lg shadow-accent-500/25'
                    : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700 hover:shadow-md'
                } ${isStreaming ? 'opacity-50 cursor-not-allowed' : ''}`}
                title={state.deepThinking ? '关闭专业分析模式' : '启用专业分析模式 - 深度解析配方原理'}
                aria-pressed={state.deepThinking}
              >
                <Brain className="w-3 sm:w-3.5 h-3 sm:h-3.5" />
                <span className="hidden sm:inline">专业分析</span>
                <span className="sm:hidden">分析</span>
              </button>
              <button
                onClick={() => state.toggleSmartSearch()}
                disabled={isStreaming}
                className={`flex items-center gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-medium transition-all duration-300 ${
                  state.smartSearch
                    ? 'bg-gradient-to-r from-success-500 to-success-600 text-white shadow-lg shadow-success-500/25'
                    : 'bg-primary-50 dark:bg-primary-300/20 text-primary-700 dark:text-primary-700 hover:bg-primary-100 dark:hover:bg-primary-900/30 hover:shadow-md'
                } ${isStreaming ? 'opacity-50 cursor-not-allowed' : ''}`}
                title={state.smartSearch ? '关闭知识库检索' : '启用知识库检索 - 搜索配方数据库'}
                aria-pressed={state.smartSearch}
              >
                <Search className="w-3 sm:w-3.5 h-3 sm:h-3.5" />
                <span className="hidden sm:inline">知识库</span>
                <span className="sm:hidden">检索</span>
              </button>
            </div>

            <div className="flex items-center gap-3 sm:gap-4">
              {state.inputBehavior.showCharCount && maxLength && (
                <div
                  className={`text-xs sm:text-sm transition-colors flex items-center gap-1 ${isExceeded ? 'text-error-500 dark:text-error-600 font-semibold' : isOverLimit ? 'text-warning-500' : 'text-neutral-400'}`}
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  {state.charCount}/{maxLength}
                  {isOverLimit && !isExceeded && (
                    <span className="hidden sm:inline text-xs px-1.5 py-0.5 bg-warning-100 dark:bg-warning-300/25 text-warning-600 dark:text-warning-700 rounded-full">
                      接近上限
                    </span>
                  )}
                </div>
              )}

              <div className="hidden md:flex items-center gap-2 text-xs text-neutral-400 bg-neutral-50 dark:bg-neutral-800 px-2.5 py-1 rounded-md">
                <span className="inline-flex items-center gap-1">
                  <kbd className="px-1 py-0.5 bg-white dark:bg-neutral-700 rounded text-xs font-mono border border-neutral-200 dark:border-neutral-600 shadow-sm">
                    ⇧
                  </kbd>
                  <kbd className="px-1 py-0.5 bg-white dark:bg-neutral-700 rounded text-xs font-mono border border-neutral-200 dark:border-neutral-600 shadow-sm">
                    ↵
                  </kbd>
                  <span>换行</span>
                </span>
                <span className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">·</span>
                <span className="inline-flex items-center gap-1">
                  <kbd className="px-1 py-0.5 bg-white dark:bg-neutral-700 rounded text-xs font-mono border border-neutral-200 dark:border-neutral-600 shadow-sm">
                    ↵
                  </kbd>
                  <span>发送</span>
                </span>
              </div>
            </div>
          </div>
        </div>

        <ChatInputSettingsDialog open={state.showSettings} onClose={() => state.setShowSettings(false)} />
      </div>
    );
  },
);

export default ChatInputArea;
