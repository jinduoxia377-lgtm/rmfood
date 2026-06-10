# RMFOOD智能对话模块 v9.0 - 代码注释规范

## 📋 文档概述

**文档版本**: v9.0.0  
**适用范围**: AI智能对话模块所有TypeScript/React代码  
**注释率目标**: ≥30%  
**最后更新**: 2026-05-17

---

## 🎯 核心原则

### 1. 注释应该解释"为什么"而非"是什么"
```typescript
// ❌ 不好：重复代码本身
const result = a + b; // 计算a加b

// ✅ 好：解释业务意图
const result = a + b; // 合并两个配方的总剂量
```

### 2. 注释应该清晰简洁
- 避免冗长的描述
- 使用主动语态
- 保持一行或简短的段落

### 3. 注释应该与代码同步更新
- 修改代码时同步更新注释
- 删除过时的注释
- 避免注释与代码不一致

### 4. 注释率目标
| 文件类型 | 目标注释率 |
|---------|-----------|
| 工具函数 | ≥40% |
| Hooks | ≥35% |
| 组件 | ≥30% |
| 类型定义 | ≥25% |
| 测试文件 | ≥20% |

---

## 📝 注释类型

### 1. 文件头部注释

**格式要求**：每个文件必须包含头部注释，说明文件的用途、作者、版本等信息。

```typescript
/**
 * @file ChatInputArea.tsx
 * @description 聊天输入区域组件，支持文本输入、快捷操作和发送功能
 * @author RMFOOD AI Assistant Team
 * @version 9.0.0
 * @date 2026-05-17
 * 
 * @component
 * @example
 * ```tsx
 * <ChatInputArea 
 *   onSend={handleSend} 
 *   disabled={isStreaming}
 * />
 * ```
 */
```

**必填字段**：
- `@file`：文件名
- `@description`：文件功能描述
- `@version`：版本号
- `@date`：创建/修改日期

**可选字段**：
- `@author`：作者信息
- `@component`：标记为组件
- `@module`：标记为模块
- `@example`：使用示例

---

### 2. 类/组件注释

**格式要求**：使用JSDoc格式描述类或组件的功能、属性、方法等。

```typescript
/**
 * 聊天消息状态管理Hook
 * 
 * 提供消息列表的增删改查操作，支持流式响应和错误处理
 * 
 * @returns {UseChatMessagesReturn} 消息管理相关的状态和操作方法
 * 
 * @example
 * ```typescript
 * const { messages, sendMessage, setInput } = useChatMessages();
 * ```
 */
export function useChatMessages(): UseChatMessagesReturn {
  // ...
}
```

---

### 3. 函数/方法注释

**格式要求**：描述函数的功能、参数、返回值、异常情况等。

```typescript
/**
 * 发送消息到AI服务
 * 
 * @param message - 用户输入的消息内容
 * @param options - 发送选项配置
 * @param options.stream - 是否启用流式响应
 * @param options.sessionId - 会话ID，可选
 * @returns {Promise<ChatMessage>} AI返回的消息对象
 * 
 * @throws {Error} 当消息内容为空时抛出
 * @throws {ApiError} 当API调用失败时抛出
 * 
 * @example
 * ```typescript
 * const response = await sendMessage('分析这个配方', { stream: true });
 * ```
 */
export async function sendMessage(
  message: string,
  options?: {
    stream?: boolean;
    sessionId?: string;
  }
): Promise<ChatMessage> {
  // ...
}
```

**JSDoc标签说明**：

| 标签 | 用途 | 示例 |
|------|------|------|
| `@param` | 参数说明 | `@param name - 用户名` |
| `@returns` | 返回值说明 | `@returns {string} 格式化后的文本` |
| `@throws` | 异常说明 | `@throws {Error} 当参数无效时` |
| `@example` | 使用示例 | `@example \`\`\`typescript ... \`\`\`` |
| `@deprecated` | 废弃标记 | `@deprecated 使用newFunction代替` |
| `@see` | 参考链接 | `@see https://docs.example.com` |

---

### 4. 类型/接口注释

**格式要求**：描述类型的用途、字段含义等。

```typescript
/**
 * 聊天消息类型定义
 * 
 * 表示用户或AI发送的一条消息，包含内容、发送者、时间戳等信息
 */
export interface ChatMessage {
  /** 消息唯一标识符 */
  id: string;
  
  /** 消息内容 */
  content: string;
  
  /** 发送者类型：'user' | 'assistant' | 'system' */
  role: MessageRole;
  
  /** 消息发送时间戳 */
  timestamp: number;
  
  /** 是否为流式响应 */
  isStreaming?: boolean;
  
  /** 关联的配方ID（如果消息包含配方） */
  formulaId?: string;
  
  /** 错误信息（如果消息发送失败） */
  error?: string;
}
```

---

### 5. 行内注释

**格式要求**：用于解释复杂逻辑或特殊处理。

```typescript
// 计算相似度得分，使用余弦相似度算法
const similarity = calculateCosineSimilarity(vectorA, vectorB);

// 过滤掉已禁用的配方（业务规则：禁用配方不应出现在推荐列表中）
const activeFormulas = formulas.filter(f => !f.disabled);

// 处理边界情况：当消息数组为空时直接返回
if (messages.length === 0) return [];
```

**使用场景**：
- 解释复杂的业务逻辑
- 说明特殊的处理方式
- 标记待优化的代码
- 解释非直观的代码决策

---

### 6. 条件分支注释

**格式要求**：对于复杂的条件分支，在每个分支前添加注释说明。

```typescript
switch (message.role) {
  // 用户消息：显示在右侧，使用主色调
  case 'user':
    return <UserMessage content={message.content} />;
  
  // AI助手消息：显示在左侧，使用辅助色调
  case 'assistant':
    return <AssistantMessage content={message.content} />;
  
  // 系统消息：居中显示，使用灰色
  case 'system':
    return <SystemMessage content={message.content} />;
  
  // 默认情况：应该不会到达这里，作为防御性编程
  default:
    console.warn(`Unknown message role: ${message.role}`);
    return null;
}
```

---

### 7. 常量注释

**格式要求**：解释常量的含义和用途。

```typescript
/** 最大消息长度限制（字符） */
export const MAX_MESSAGE_LENGTH = 5000;

/** 默认会话过期时间（毫秒）- 24小时 */
export const DEFAULT_SESSION_TIMEOUT = 24 * 60 * 60 * 1000;

/** 消息发送频率限制（毫秒）- 防止重复发送 */
export const MESSAGE_SEND_INTERVAL = 1000;

/** 流式响应的最小字符数阈值 */
export const STREAMING_THRESHOLD = 5;
```

---

### 8. 待办事项注释

**格式要求**：使用TODO标记待完成的工作。

```typescript
// TODO: 后续需要支持语音消息发送
//       参考：https://developer.mozilla.org/zh-CN/docs/Web/API/Web_Speech_API

// TODO: [性能优化] 当消息数量超过100条时，考虑实现虚拟滚动
//       当前实现会导致内存占用过高

// FIXME: 修复流式响应时的进度条显示问题
//       问题描述：进度条在某些情况下不会正确更新

// NOTE: 业务规则说明 - 配方名称必须唯一
//       如果存在同名配方，需要提示用户确认
```

---

## 📊 注释风格指南

### 1. 注释语言
- **统一使用中文**进行注释
- 变量名、函数名、类型名使用英文
- 注释应清晰易懂，避免使用过于技术化的术语

### 2. 注释格式
- 使用 `/** ... */` 进行多行注释
- 使用 `//` 进行单行注释
- 避免使用 `/* ... */`（容易产生嵌套问题）

### 3. 缩进对齐
- 注释应与周围代码保持相同的缩进级别
- 行内注释与代码之间保持一个空格

### 4. 特殊标记

| 标记 | 用途 | 示例 |
|------|------|------|
| `TODO` | 待完成的任务 | `TODO: 添加错误处理` |
| `FIXME` | 需要修复的问题 | `FIXME: 修复内存泄漏` |
| `NOTE` | 重要说明 | `NOTE: 业务规则` |
| `OPTIMIZE` | 性能优化提示 | `OPTIMIZE: 可缓存计算结果` |
| `DEPRECATED` | 废弃代码标记 | `DEPRECATED: 使用新API` |

---

## ✅ 注释检查清单

### 文件级别
- [ ] 文件头部有注释说明用途
- [ ] 版本号和日期已更新
- [ ] 包含使用示例（如果适用）

### 函数/方法级别
- [ ] 有清晰的功能描述
- [ ] 参数和返回值有说明
- [ ] 异常情况有说明
- [ ] 包含使用示例（复杂函数）

### 类型/接口级别
- [ ] 每个字段都有注释说明
- [ ] 接口用途有描述
- [ ] 复杂类型有示例

### 代码级别
- [ ] 复杂逻辑有行内注释
- [ ] 条件分支有注释说明
- [ ] 常量和配置有注释
- [ ] 待办事项使用TODO标记

---

## 🛠️ 工具支持

### ESLint规则
启用以下ESLint规则确保注释质量：

```javascript
{
  rules: {
    // 要求函数有JSDoc注释
    'require-jsdoc': ['error', {
      require: {
        FunctionDeclaration: true,
        MethodDefinition: true,
        ClassDeclaration: true,
        ArrowFunctionExpression: false
      }
    }],
    
    // 检查JSDoc语法
    'valid-jsdoc': ['error', {
      requireReturn: false,
      requireReturnType: true
    }]
  }
}
```

### VS Code配置
```json
{
  "editor.rulers": [80, 120],
  "editor.formatOnSave": true,
  "javascript.format.insertSpaceAfterOpeningAndBeforeClosingNonemptyBraces": true,
  "typescript.format.insertSpaceAfterOpeningAndBeforeClosingNonemptyBraces": true
}
```

---

## 📈 注释率统计

### 统计方法
使用以下命令统计注释率：

```bash
# 安装统计工具
npm install -g cloc

# 统计指定目录的注释率
cloc src/components/ai/features/ --include-lang=TypeScript,TypeScriptReact
```

### 目标指标
| 模块 | 目标注释率 | 当前状态 |
|------|-----------|---------|
| hooks/ | ≥35% | 📊 |
| services/ | ≥40% | 📊 |
| utils/ | ≥40% | 📊 |
| components/ | ≥30% | 📊 |
| types/ | ≥25% | 📊 |

---

## 👥 团队与贡献

**规范制定**: RMFOOD AI Assistant Team  
**审核人员**: [待补充]  
**文档版本**: 9.0.0  
**最后更新**: 2026-05-17