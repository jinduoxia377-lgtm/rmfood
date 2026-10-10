/**
 * 工具调用显示组件
 *
 * 统一展示 Agent 调用的工具列表及其状态
 */
import React from 'react';
import type { ToolCall } from './types';
import { CheckCircle2, XCircle, Loader2, Wrench } from 'lucide-react';

interface ToolCallDisplayProps {
  tools: ToolCall[];
  isLoading?: boolean;
}

export function ToolCallDisplay({ tools, isLoading = false }: ToolCallDisplayProps) {
  if (tools.length === 0 && !isLoading) {
    return null;
  }

  return (
    <div className="mt-4 p-4 bg-neutral-50 dark:bg-neutral-900 rounded-lg">
      <div className="flex items-center gap-2 mb-3">
        <Wrench className="w-4 h-4 text-primary-500" />
        <span className="text-sm font-medium">工具调用</span>
        {isLoading && (
          <span className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] animate-pulse">执行中...</span>
        )}
      </div>

      <div className="space-y-2">
        {tools.map((tool, index) => (
          <div
            key={index}
            className="flex items-center gap-3 p-2 rounded bg-white dark:bg-neutral-800"
          >
            {/* 状态图标 */}
            {tool.status === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-success-500 flex-shrink-0" />
            ) : tool.status === 'failed' ? (
              <XCircle className="w-4 h-4 text-error-500 flex-shrink-0" />
            ) : (
              <Loader2 className="w-4 h-4 text-secondary-500 animate-spin flex-shrink-0" />
            )}

            {/* 工具名称 */}
            <span className="text-sm font-medium flex-1">{tool.tool}</span>

            {/* 耗时 */}
            <span className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
              {tool.latencyMs > 0 ? `${tool.latencyMs}ms` : '-'}
            </span>

            {/* 错误信息 */}
            {tool.error && (
              <span className="text-xs text-error-500 max-w-[200px] truncate" title={tool.error}>
                {tool.error}
              </span>
            )}
          </div>
        ))}

        {/* 空状态 */}
        {tools.length === 0 && isLoading && (
          <div className="flex items-center gap-2 text-sm text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>准备调用工具...</span>
          </div>
        )}
      </div>
    </div>
  );
}
