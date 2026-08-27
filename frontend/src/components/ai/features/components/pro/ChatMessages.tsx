/**
 * ChatMessages - 消息列表入口组件 (v2.0)
 * 所有逻辑已提取至 MessageList / MessageBubble / utils
 */
import MessageList, { type MessageListProps } from './MessageList'

export type { MessageListProps }
export type ChatMessagesProps = MessageListProps

const ChatMessages: React.FC<ChatMessagesProps> = (props) => <MessageList {...props} />

export { MessageList }
export { MessageBubble } from './MessageBubble'
export type { MessageType } from './utils'
export { detectMessageType, parseChartData, renderMessageContent } from './utils'
export { LinkMessageCard, CodeMessageBlock, ImageMessageCard, FileMessageCard } from './utils'
export { tryExtractDomain, tryExtractTitle, extractExtension } from './utils'

export default ChatMessages