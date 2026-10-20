/**
 * ChatMessages — 消息列表入口组件（薄层 v2.0）
 *
 * 所有逻辑已提取至 MessageList / MessageBubble / utils
 */
import React from 'react';
import MessageList from './MessageList';

import type { MessageListProps } from './MessageList'

// 导出新的拆分组件
export { MessageList } from './MessageList'
export { MessageBubble } from './MessageBubble'
export type { MessageListProps } from './MessageList'
export type { MessageBubbleProps } from './MessageBubble'

// 重新导出原有类型接口保持向后兼容
export type { MessageType } from './utils'
export { detectMessageType, parseChartData, renderMessageContent } from './utils'

// 导出 Props 类型别名（旧接口兼容）
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface ChatMessagesProps extends MessageListProps {}
export type { HistorySession } from './ChatHistory'
export { saveSessions, loadSessions, formatTime } from './ChatHistory'

// 导出子组件工具函数
export { LinkMessageCard, CodeMessageBlock, ImageMessageCard, FileMessageCard } from './utils'
export { tryExtractDomain, tryExtractTitle, extractExtension } from './utils'

export default function ChatMessages(props: ChatMessagesProps) {
  return <MessageList {...props} />
}
