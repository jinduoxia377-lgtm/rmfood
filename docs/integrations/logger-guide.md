# RMFOOD 项目 Logger 使用最佳实践指南

> **版本**: 1.0.0
> **最后更新**: 2026-05-09
> **适用范围**: RMFOOD 配方平台前端项目

---

## 目录

1. [快速开始（Quick Start）](#1-快速开始quick-start)
2. [API 参考（API Reference）](#2-api-参考api-reference)
3. [最佳实践（Best Practices）](#3-最佳实践best-practices)
4. [环境感知行为（Environment Awareness）](#4-环境感知行为environment-awareness)
5. [迁移指南（Migration Guide）](#5-迁移指南migration-guide)
6. [高级用法（Advanced Usage）](#6-高级用法advanced-usage)
7. [常见问题 FAQ（Frequently Asked Questions）](#7-常见问题-faqfrequently-asked-questions)
8. [架构说明（Architecture）](#8-架构说明architecture)

---

## 1. 快速开始（Quick Start）

### 1.1 统一导入方式

```typescript
// ✅ 推荐方式 - 使用 SafeLogger（统一日志系统）
import { logger } from '@/utils/safeLogger'

// 也支持默认导出
import logger from '@/utils/safeLogger'
```

### 1.2 五个基本示例

#### info - 一般信息日志

```typescript
import { logger } from '@/utils/safeLogger'

// 用户操作记录
logger.info('用户登录成功', { username: 'admin', role: 'superadmin' })

// API 调用成功
logger.info('配方数据获取成功', {
  formulaId: 'F20260509001',
  count: 25,
}, 'FormulaService')

// 输出示例:
// [2026-05-09T10:30:45.123Z] [INFO] 用户登录成功 {"username":"admin","role":"superadmin"}
```

#### error - 错误日志

```typescript
import { logger } from '@/utils/safeLogger'

try {
  await fetch('/api/formulas')
} catch (error) {
  // 自动提取 Error 对象的 name、message、stack
  logger.error('API请求失败', error, {
    url: '/api/formulas',
    method: 'GET',
  })
}

// 也可以直接传入错误对象
logger.error('数据库连接失败', new Error('Connection timeout'), 'DatabaseService')
```

#### warn - 警告日志

```typescript
import { logger } from '@/utils/safeLogger'

// 性能警告
logger.warn('查询耗时过长', {
  duration: 2500,
  threshold: 1000,
  query: 'SELECT * FROM formulas',
}, 'PerformanceMonitor')

// 弃用警告
logger.warn('此方法将在下个版本弃用', {
  methodName: 'oldMethod',
  recommended: 'newMethod',
})
```

#### debug - 调试日志

```typescript
import { logger } from '@/utils/safeLogger'

// 仅在开发环境输出
logger.debug('组件状态更新', {
  prevState: { loading: true },
  nextState: { loading: false, data: [...] },
}, 'DataLoader')

// 调试复杂逻辑
debugger
logger.debug('算法执行步骤', {
  step: 3,
  input: [1, 2, 3],
  output: 6,
}, 'Calculator')
```

#### log - 通用日志

```typescript
import { logger } from '@/utils/safeLogger'

// 兼容 console.log 的使用方式
logger.log('简单消息')
logger.log('带参数的消息', { key: 'value' }, [1, 2, 3])

// 用于临时调试（建议完成后改为 info 或 debug）
logger.log('检查点到达', { line: 42 })
```

### 1.3 计时功能示例

```typescript
import { logger } from '@/utils/safeLogger'

// 基础计时
const timer = logger.startTimer('配方生成')

// ... 执行耗时操作 ...
await generateFormula()

timer.end()
// 输出: [INFO] [Performance] 配方生成 完成 {"durationMs":1234}

// 带额外数据的计时
const apiTimer = logger.startTimer('API请求')
const response = await fetch('/api/data')
apiTimer.end({
  url: '/api/data',
  status: response.status,
  size: response.headers.get('content-length'),
})

// 在组件中使用
function FormulaEditor() {
  const handleSave = async () => {
    const saveTimer = logger.startTimer('保存配方')
    try {
      await saveFormula(formulaData)
      saveTimer.end({ formulaId: formulaData.id })
    } catch (error) {
      saveTimer.end({ error: true })
      logger.error('保存失败', error, 'FormulaEditor')
    }
  }
}
```

---

## 2. API 参考（API Reference）

### SafeLogger 完整接口定义

```typescript
interface SafeLogger {
  // 核心日志方法
  log(message: string, ...args: unknown[]): void
  debug(message: string, data?: any, context?: string): void
  info(message: string, data?: any, context?: string): void
  warn(message: string, data?: any, context?: string): void
  error(message: string, error?: Error | any, context?: string): void

  // 高级功能
  startTimer(label: string): { end: (data?) => void }
  withContext(context: string): SafeLogger
}
```

---

### 2.1 `log(message, ...args)` - 通用日志

**方法签名**:
```typescript
log(message: string, ...args: unknown[]): void
```

**参数说明**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| message | string | ✅ | 日志消息文本 |
| args | unknown[] | ❌ | 额外数据参数（支持任意类型） |

**返回值**: void

**使用示例**:
```typescript
// 简单消息
logger.log('应用程序启动')

// 带数据对象
logger.log('配置加载完成', { env: 'production', version: '2.0.0' })

// 多个参数
logger.log('用户操作', { action: 'click' }, { target: 'button' }, [1, 2, 3])
```

**最佳使用场景**:
- 兼容旧代码迁移时的 console.log 替换
- 临时调试信息（正式提交前应改为 info/debug）
- 不需要特定级别的通用输出

---

### 2.2 `debug(message, data?, context?)` - 调试信息

**方法签名**:
```typescript
debug(message: string, data?: any, context?: string): void
```

**参数说明**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| message | string | ✅ | 调试消息 |
| data | any | ❌ | 调试数据对象 |
| context | string | ❌ | 上下文标识（如模块名、组件名） |

**返回值**: void

**使用示例**:
```typescript
// 组件状态调试
logger.debug('状态变更', {
  prev: { loading: true },
  next: { loading: false, data: [...] }
}, 'UserList')

// 算法中间结果
logger.debug('排序步骤', {
  array: [3, 1, 4, 1, 5],
  pivot: 3,
  left: [1, 1],
  right: [4, 5]
}, 'QuickSort')
```

**最佳使用场景**:
- 开发阶段的详细调试信息
- 复杂算法的中间状态跟踪
- 组件生命周期钩子调试
- **注意**: 生产环境自动禁用，不影响性能

---

### 2.3 `info(message, data?, context?)` - 一般信息

**方法签名**:
```typescript
info(message: string, data?: any, context?: string): void
```

**参数说明**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| message | string | ✅ | 信息消息 |
| data | any | ❌ | 附加数据 |
| context | string | ❌ | 上下文标识 |

**返回值**: void

**使用示例**:
```typescript
// 业务操作记录
logger.info('配方创建成功', {
  formulaId: 'F001',
  name: '黄芪姜黄复合肽',
  creator: '张三'
}, 'FormulaService')

// 功能使用统计
logger.info('导出功能使用', {
  format: 'PDF',
  pageCount: 12,
  fileSize: '2.3MB'
}, 'ExportService')
```

**最佳使用场景**:
- 业务操作的成功记录
- 关键流程节点标记
- 功能使用情况追踪
- 用户行为分析数据采集

---

### 2.4 `warn(message, data?, context?)` - 警告信息

**方法签名**:
```typescript
warn(message: string, data?: any, context?: string): void
```

**参数说明**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| message | string | ✅ | 警告消息 |
| data | any | ❌ | 警告相关数据 |
| context | string | ❌ | 上下文标识 |

**返回值**: void

**使用示例**:
```typescript
// 性能警告
logger.warn('API响应时间超过阈值', {
  duration: 2500,
  threshold: 1000,
  endpoint: '/api/formulas/search'
}, 'APIMonitor')

// 数据质量警告
logger.warn('配方数据缺失必填字段', {
  formulaId: 'F042',
  missingFields: ['name', 'ingredients']
}, 'Validator')

// 兼容性警告
logger.warn('浏览器版本过低', {
  userAgent: navigator.userAgent,
  recommendedVersion: 'Chrome 90+'
}, 'CompatibilityChecker')
```

**最佳使用场景**:
- 性能问题预警（但不影响功能）
- 数据质量问题提醒
- 即将弃用的 API/方法警告
- 潜在风险提示

---

### 2.5 `error(message, error?, context?)` - 错误信息

**方法签名**:
```typescript
error(message: string, error?: Error | any, context?: string): void
```

**参数说明**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| message | string | ✅ | 错误描述 |
| error | Error \| any | ❌ | Error 对象或错误详情 |
| context | string | ❌ | 上下文标识 |

**返回值**: void

**特殊处理**:
- 如果传入 Error 对象，自动提取 `name`、`message`、`stack` 属性
- 错误日志始终输出（即使生产环境）
- 支持远程上报（需配置 `VITE_LOG_ENDPOINT`）

**使用示例**:
```typescript
// 捕获异常
try {
  await riskyOperation()
} catch (error) {
  logger.error('操作失败', error, 'RiskService')
  // 自动输出: { name: "TypeError", message: "...", stack: "..." }
}

// 手动构造错误信息
logger.error('验证失败', {
  field: 'email',
  value: 'invalid-email',
  reason: '格式不正确'
}, 'FormValidator')

// 网络错误
logger.error('网络请求失败', {
  status: 500,
  url: '/api/save',
  timestamp: Date.now()
}, 'NetworkService')
```

**最佳使用场景**:
- 异常捕获和处理
- API 调用失败记录
- 数据验证错误
- 所有需要关注的问题

---

### 2.6 `startTimer(label)` - 性能计时器

**方法签名**:
```typescript
startTimer(label: string): { end: (data?: any) => void }
```

**参数说明**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| label | string | ✅ | 计时标签（用于标识本次计时） |

**返回值**:
```typescript
{
  end: (data?: any) => void  // 结束计时并输出结果
}
```

**使用示例**:
```typescript
// 基础用法
const timer = logger.startTimer('数据处理')
processData()
timer.end()
// 输出: [INFO] [Performance] 数据处理 完成 {"durationMs":123}

// 带附加数据
const timer = logger.startTimer('API调用')
const result = await fetchApi()
timer.end({
  endpoint: '/api/data',
  statusCode: result.status,
  recordCount: result.data.length
})
```

**最佳使用场景**:
- API 请求性能监控
- 复杂计算过程耗时统计
- 渲染性能分析
- 数据库查询优化

---

### 2.7 `withContext(context)` - 上下文包装器

**方法签名**:
```typescript
withContext(context: string): SafeLogger
```

**参数说明**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| context | string | ✅ | 上下文名称（如组件名、模块名、服务名） |

**返回值**: 新的 SafeLogger 实例（绑定指定上下文）

**使用示例**:
```typescript
// 创建专用 logger
const formulaLogger = logger.withContext('FormulaEditor')

// 所有日志自动带上上下文
formulaLogger.info('保存成功')           // [FormulaEditor]
formulaLogger.error('加载失败', err)      // [FormulaEditor]
formulaLogger.debug('状态更新', state)    // [FormulaEditor]

// 在 React 组件中使用
function UserProfile() {
  const userLogger = logger.withContext('UserProfile')

  useEffect(() => {
    userLogger.info('组件挂载', { userId: props.id })
    return () => userLogger.info('组件卸载')
  }, [])

  const handleClick = () => {
    userLogger.info('按钮点击', { action: 'edit' })
  }
}

// 在 Service 类中使用
class FormulaService {
  private log = logger.withContext('FormulaService')

  async create(data: FormulaData) {
    this.log.info('开始创建配方', { name: data.name })
    // ...
    this.log.info('创建完成', { id: result.id })
  }
}
```

**最佳使用场景**:
- 大型组件/模块内部使用
- Service 类的专属日志
- 需要区分日志来源的场景
- 团队协作时定位问题

---

## 3. 最佳实践（Best Practices）

### 3.1 ✅ DO 列表（推荐做法）

#### ✅ 1. 统一导入路径

```typescript
// ✅ 正确 - 使用标准导入路径
import { logger } from '@/utils/safeLogger'

// ❌ 错误 - 使用旧版或其他路径
import { logger } from '@/utils/logger'
import { logger } from '@/config/logger'
```

#### ✅ 2. 使用语义化的方法名

```typescript
// ✅ 正确 - 根据场景选择合适的方法
logger.info('用户登录成功')     // 一般信息
logger.error('API请求失败', err) // 错误
logger.warn('响应时间过长')      // 警告
logger.debug('变量值:', value)   // 调试

// ❌ 错误 - 所有场景都用 log
logger.log('用户登录成功')
logger.log('严重错误!!!')
```

#### ✅ 3. 添加上下文信息

```typescript
// ✅ 正确 - 明确标识来源
logger.info('数据加载完成', null, 'UserService')
logger.error('保存失败', error, 'FormulaEditor')

// 或使用 withContext
const apiLogger = logger.withContext('APIService')
apiLogger.info('请求发送')

// ❌ 错误 - 无法定位日志来源
logger.info('完成了')
logger.error('出错了')
```

#### ✅ 4. 结构化数据作为第二参数

```typescript
// ✅ 正确 - 使用结构化对象
logger.info('API调用成功', {
  url: '/api/formulas',
  method: 'GET',
  duration: 123,
  status: 200,
  recordCount: 25
})

// ❌ 错误 - 字符串拼接难以解析
logger.info(`API调用成功: GET /api/formulas 耗时123ms 返回200 共25条`)
```

#### ✅ 5. 使用计时器监控性能关键代码

```typescript
// ✅ 正确 - 监控关键路径性能
const timer = logger.startTimer('配方导出PDF')
await exportToPDF(formulaData)
timer.end({ pageSize: formulaData.ingredients.length })

// 在关键函数中使用
async function fetchFormulas() {
  const timer = logger.startTimer('fetchFormulas')
  const data = await api.get('/formulas')
  timer.end({ count: data.length })
  return data
}
```

#### ✅ 6. 错误日志包含足够的上下文

```typescript
// ✅ 正确 - 提供完整错误上下文
try {
  await saveFormula(formula)
} catch (error) {
  logger.error('配方保存失败', error, 'FormulaService')
  // 或提供更多细节
  logger.error('配方保存失败', {
    ...parseError(error),
    formulaId: formula.id,
    retryCount: retries,
    timestamp: Date.now()
  }, 'FormulaService')
}
```

#### ✅ 7. 敏感数据让系统自动脱敏

```typescript
// ✅ 正确 - 直接传入，系统会自动脱敏
logger.info('用户登录', {
  username: 'admin',
  password: 'mySecretPassword',  // 自动脱敏为 my****rd
  token: 'eyJhbGciOiJIUzI1NiIs...'  // 自动脱敏为 ey****Ij
})

// ❌ 错误 - 手动脱敏容易遗漏
logger.info('用户登录', {
  username: 'admin',
  password: '******'  // 可能忘记脱敏其他字段
})
```

---

### 3.2 ❌ DON'T 列表（禁止事项）

#### ❌ 1. 禁止自定义 Logger 对象

```typescript
// ❌ 严格禁止 - 创建自定义 logger 实例
const myLogger = {
  info: (msg) => console.log('[MY]', msg),
  error: (msg) => console.error('[ERROR]', msg)
}

// ❌ 禁止 - 继承或修改 SafeLogger
class MyLogger extends SafeLogger {
  customMethod() { /* ... */ }
}

// ✅ 正确 - 只使用全局单例
import { logger } from '@/utils/safeLogger'
```

**原因**:
- 破坏统一架构，导致日志格式混乱
- 无法享受自动脱敏、远程上报等功能
- 增加维护成本和排查难度

---

#### ❌ 2. 禁止直接使用 Console 方法

```typescript
// ❌ 严格禁止 - 直接使用 console
console.log('调试信息')
console.warn('警告')
console.error('错误')
console.debug('调试')

console.table(data)
console.group('分组')
console.time('计时')

// ✅ 正确 - 使用 SafeLogger
logger.log('调试信息')
logger.warn('警告')
logger.error('错误')
logger.debug('调试')
```

**原因**:
- 生产环境无法统一控制输出
- 无自动脱敏机制
- 无远程上报能力
- 格式不统一，难以分析

---

#### ❌ 3. 禁止在日志中记录明文敏感数据

```typescript
// ❌ 禁止 - 即使使用 logger 也要避免明文
logger.info('用户凭证', {
  password: 'admin123',        // 不要这样做
  creditCard: '4000-1234-5678-9000',
  apiKey: 'sk-live-xxxxxxxxxxxx'
})

// ✅ 正确 - 让系统自动处理
// 或者如果必须记录，只记录必要信息
logger.info('用户认证', {
  userId: 12345,
  loginSuccess: true,
  // 不要记录密码/token 的明文
})
```

**SafeLogger 自动脱敏的字段**:
- password / passwd / secret
- token / api_key / authorization
- credit_card / ssn
- 以及匹配这些正则的字段名

---

#### ❌ 4. 禁止在循环中使用同步日志（高频场景）

```typescript
// ❌ 禁止 - 高频循环中的日志会影响性能
for (let i = 0; i < 10000; i++) {
  processItem(items[i])
  logger.debug(`处理第 ${i} 项`)  // 每次循环都输出
}

// ✅ 正确 - 采样或汇总后记录
let processedCount = 0
for (let i = 0; i < 10000; i++) {
  processItem(items[i])
  processedCount++
  if (i % 1000 === 0) {  // 每1000条记录一次
    logger.debug(`已处理 ${processedCount} 项`)
  }
}
logger.info('批量处理完成', { total: processedCount })

// 或使用计时器监控整体性能
const timer = logger.startTimer('批量处理')
items.forEach(processItem)
timer.end({ total: items.length })
```

---

#### ❌ 5. 禁止导入非标准路径的 Logger

```typescript
// ❌ 禁止 - 相对路径导入
import { logger } from '../../utils/safeLogger'
import { logger } from '../config/logger'

// ❌ 禁止 - 别名路径（除非已在 tsconfig 中配置）
import { logger } from '@lib/logger'
import { logger } from '@shared/utils/logger'

// ✅ 正确 - 只使用项目标准的别名路径
import { logger } from '@/utils/safeLogger'
```

**原因**:
- 确保全项目使用同一实例
- 避免打包重复代码
- 方便后续统一升级和维护

---

## 4. 环境感知行为（Environment Awareness）

### 4.1 开发环境 vs 生产环境

SafeLogger 会根据运行环境自动调整行为：

| 特性 | 开发环境 | 生产环境 |
|------|----------|----------|
| **日志级别** | debug 及以上全部输出 | 仅输出 error 和 warn |
| **控制台输出** | ✅ 启用 | ⚠️ 受限（仅错误/警告） |
| **性能影响** | 可忽略 | 最小化 |
| **调试日志** | ✅ 显示 | ❌ 自动禁用 |
| **计时器** | ✅ 完整输出 | ⚠️ 仅显示超阈值 |
| **远程上报** | ❌ 默认关闭 | ✅ 可选启用 |

**环境判断逻辑**:
```typescript
// SafeLogger 内部实现
this.isEnabled =
  import.meta.env?.MODE === 'development' ||  // Vite 开发模式
  process.env?.NODE_ENV === 'development' ||   // Node.js 环境
  window.location.hostname === 'localhost';     // 域名判断
```

### 4.2 敏感数据自动脱敏机制

SafeLogger 内置智能脱敏系统，自动检测和保护敏感字段：

**支持的敏感字段模式**:

```typescript
const SENSITIVE_PATTERNS = [
  /password/i,        // 密码
  /passwd/i,          // 密码变体
  /secret/i,          // 密钥
  /token/i,           // 令牌
  /api[_-]?key/i,     // API密钥
  /authorization/i,   // 授权信息
  /credit[_-]?card/i, // 信用卡号
  /ssn/i,             // 社保号
]
```

**脱敏效果示例**:

```typescript
// 输入原始数据
{
  username: 'admin',
  password: 'mySecretPassword123',
  accessToken: 'eyJhbGciOiJIUzI1NiJ9.abcxyz',
  apiKey: 'sk-live-1234567890abcdef',
  normalField: '这是普通数据'
}

// 自动脱敏后的输出
{
  username: 'admin',
  password: 'my****23',                    // 前后各保留2字符
  accessToken: 'ey****yz',                 // 自动识别并脱敏
  apiKey: 'sk****ef',                      // 匹配 api_key 模式
  normalField: '这是普通数据'               // 保持不变
}
```

**嵌套对象自动递归处理**:
```typescript
logger.info('请求数据', {
  user: {
    name: '张三',
    credentials: {
      password: 'secret123',  // 自动脱敏
      token: 'abc-token-xyz' // 自动脱敏
    }
  },
  headers: {
    authorization: 'Bearer xxx'  // 自动脱敏
  }
})
```

### 4.3 通过环境变量控制日志级别

**Vite 项目配置** (.env 文件):

```bash
# .env.development (开发环境)
VITE_MODE=development
# 可选：开发环境日志端点（通常不需要）
# VITE_LOG_ENDPOINT=http://localhost:3000/logs

# .env.production (生产环境)
VITE_MODE=production
VITE_LOG_ENDPOINT=https://logs.rmfood.com/api/logs  # 远程上报地址
```

**高级配置（通过 config/logger.ts）**:

```typescript
import { initLogger } from '@/config/logger'

// 在应用启动时配置
initLogger({
  enableConsole: true,      // 是否输出到控制台
  enableRemote: true,       // 是否启用远程上报
  minLevel: 'info',         // 最低日志级别
  remoteUrl: 'https://logs.example.com/api/logs'  // 远程端点
})
```

**日志级别优先级** (从低到高):

```
debug < info < warn < error
```

生产环境默认只输出 `error` 和 `warn` 级别的日志。

---

## 5. 迁移指南（Migration Guide）

### 5.1 从旧 Logger 迁移步骤

#### 步骤 1: 更新导入语句

```diff
- import { logger } from '@/utils/logger'
+ import { logger } from '@/utils/safeLogger'

# 或者如果你使用了 config/logger
- import { logger } from '@/config/logger'
+ import { logger } from '@/utils/safeLogger'
```

#### 步骤 2: 调整方法调用（如有必要）

大部分情况下无需修改方法调用，但建议：

```diff
  # 旧写法（仍然兼容）
- logger.log('操作完成')
+ logger.info('操作完成', { module: 'UserService' })  # 推荐新写法

  # 添加上下文信息
- logger.error('请求失败', error)
+ logger.error('请求失败', error, 'APIService')

  # 利用新的特性
- console.time('操作')
- // ... 代码 ...
- console.timeEnd('操作')
+ const timer = logger.startTimer('操作')
+ // ... 代码 ...
+ timer.end({ extraInfo: 'value' })
```

#### 步骤 3: 验证功能正常

```typescript
# 测试清单
□ 日志正常输出到控制台
□ 错误日志包含完整的 stack trace
□ 计时功能工作正常
□ withContext 上下文正确显示
□ 生产环境下 debug 日志不输出
□ 敏感字段被正确脱敏
```

### 5.2 迁移前后对比示例

#### 示例 1: 基础日志替换

```typescript
// ❌ 旧代码（使用旧的 utils/logger）
import { logger } from '@/utils/logger'

function fetchData() {
  logger.log('开始获取数据')
  // ...
  logger.info('数据获取成功')
}
```

```typescript
// ✅ 新代码（使用 safeLogger）
import { logger } from '@/utils/safeLogger'

function fetchData() {
  logger.info('开始获取数据', null, 'DataService')
  // ...
  logger.info('数据获取成功', { source: 'API' }, 'DataService')
}
```

#### 示例 2: 错误处理改进

```typescript
// ❌ 旧代码
import { logger } from '@/utils/logger'

try {
  await api.call()
} catch (e) {
  logger.error('调用失败')
  console.error(e)  // 混用 console
}
```

```typescript
// ✅ 新代码
import { logger } from '@/utils/safeLogger'

try {
  await api.call()
} catch (e) {
  logger.error('调用失败', e, 'APIClient')
  // 自动包含 Error 对象的所有信息
  // 自动脱敏敏感数据
  // 支持远程上报
}
```

#### 示例 3: 性能监控增强

```typescript
// ❌ 旧代码
import { logger } from '@/utils/logger'

function processData() {
  console.time('processing')
  // ... 处理逻辑 ...
  console.timeEnd('processing')
  logger.log('处理完成')
}
```

```typescript
// ✅ 新代码
import { logger } from '@/utils/safeLogger'

function processData() {
  const timer = logger.startTimer('数据处理')
  // ... 处理逻辑 ...
  timer.end({
    itemCount: data.length,
    success: true
  }, 'ProcessService')
  // 输出: [INFO] [Performance] 数据处理 完成 {"durationMs":123,"itemCount":100,"success":true}
}
```

#### 示例 4: 组件内使用优化

```typescript
// ❌ 旧代码
import { logger } from '@/utils/logger'

function UserList() {
  useEffect(() => {
    logger.info('UserList mounted')
    loadUsers().then(users => {
      logger.log(`Loaded ${users.length} users`)
    })
  }, [])
}
```

```typescript
// ✅ 新代码
import { logger } from '@/utils/safeLogger'

function UserList() {
  const log = logger.withContext('UserList')  // 创建上下文绑定的 logger

  useEffect(() => {
    log.info('组件挂载')
    loadUsers().then(users => {
      log.info('用户列表加载完成', { count: users.length })
    })
  }, [])

  return (
    <div>
      {/* ... */}
    </div>
  )
}
```

### 5.3 常见问题及解决方案

**Q1: 迁移后日志不显示了？**

```typescript
// 检查是否在生产环境且使用了 debug 级别
// 解决方案：改用 info 或更高等级
- logger.debug('调试信息')  // 生产环境不显示
+ logger.info('重要信息')   // 始终显示
```

**Q2: 导入报错 Module not found？**

```bash
# 确认路径正确
# 应该是 @/utils/safeLogger 而不是：
# - @/utils/logger （旧版）
# - @/config/logger （配置层）
```

**Q3: TypeScript 类型报错？**

```typescript
// 确保使用正确的导入方式
import { logger } from '@/utils/safeLogger'  // ✅ 命名导入

// 而不是
import logger from '@/utils/safeLogger'       // ✅ 也是支持的（默认导出）
```

---

## 6. 高级用法（Advanced Usage）

### 6.1 性能监控模式（Timer）

#### 监控 API 请求性能

```typescript
// 创建 API 请求封装器
async function monitoredFetch(url: string, options?: RequestInit) {
  const timer = logger.startTimer(`API:${url}`)

  try {
    const response = await fetch(url, options)

    timer.end({
      url,
      method: options?.method || 'GET',
      status: response.status,
      size: response.headers.get('content-length'),
    })

    return response
  } catch (error) {
    timer.end({ error: true, message: error.message })
    throw error
  }
}

// 使用示例
const data = await monitoredFetch('/api/formulas', { method: 'POST' })
// 输出: [INFO] [Performance] API:/api/formulas 完成 {"durationMs":234,"url":"/api/formulas","method":"POST","status":200,...}
```

#### 监控渲染性能

```typescript
function MonitoredComponent() {
  const renderTimer = useRef<{ end: (data?) => void } | null>(null)

  useEffect(() => {
    // 组件渲染完成
    renderTimer.current?.end({ component: 'MonitoredComponent' })
  })

  // 开始计时（在渲染前）
  renderTimer.current = logger.startTimer('Render')

  return <div>{/* ... */}</div>
}
```

#### 批量操作性能统计

```typescript
async function batchProcess(items: Item[]) {
  const totalTime = logger.startTimer('批量处理总耗时')
  const results = []

  for (let i = 0; i < items.length; i++) {
    const itemTimer = logger.startTimer(`处理项-${i}`)
    const result = await processItem(items[i])
    itemTimer.end({ itemId: items[i].id })
    results.push(result)
  }

  totalTime.end({
    totalItems: items.length,
    successCount: results.filter(r => r.success).length,
  })

  return results
}
```

---

### 6.2 上下文隔离（withContext）

#### 组件级上下文

```typescript
// 在大型应用中，每个模块使用独立的 logger
const modules = {
  auth: logger.withContext('AuthModule'),
  formula: logger.withContext('FormulaModule'),
  user: logger.withContext('UserModule'),
  analytics: logger.withContext('AnalyticsModule'),
}

// 使用
modules.auth.info('用户登录', { userId: 123 })
modules.formula.error('保存失败', error)
modules.user.debug('权限检查', { role: 'admin' })

// 输出示例:
// [INFO] [AuthModule] 用户登录 {"userId":123}
// [ERROR] [FormulaModule] 保存失败 {...}
// [DEBUG] [UserModule] 权限检查 {"role":"admin"}
```

#### 类级上下文（推荐模式）

```typescript
// Service 类的标准模式
class FormulaService {
  private readonly log = logger.withContext('FormulaService')

  async create(data: CreateFormulaDTO) {
    this.log.info('开始创建配方', { name: data.name })

    try {
      const result = await this.repository.save(data)
      this.log.info('创建成功', { id: result.id })
      return result
    } catch (error) {
      this.log.error('创建失败', error)
      throw error
    }
  }

  async update(id: string, data: UpdateFormulaDTO) {
    const timer = this.log.startTimer('更新配方')

    try {
      const result = await this.repository.update(id, data)
      timer.end({ formulaId: id })
      return result
    } catch (error) {
      timer.end({ error: true })
      this.log.error('更新失败', error, { formulaId: id })
      throw error
    }
  }
}
```

#### 嵌套上下文

```typescript
// 上下文可以组合使用
const appLog = logger.withContext('App')
const moduleLog = appLog.withContext('FormulaEditor')  // 注意：这会创建 App:FormulaEditor

// 但推荐扁平化命名
const formulaLog = logger.withContext('FormulaEditor')
```

---

### 6.3 远程错误上报配置

#### 启用远程上报

```typescript
// 方法 1: 通过环境变量（推荐）
# .env.production
VITE_LOG_ENDPOINT=https://your-log-server.com/api/logs

// 方法 2: 通过配置初始化
import { initLogger } from '@/config/logger'

initLogger({
  enableRemote: true,
  minLevel: 'error',  // 只上报错误级别
  remoteUrl: 'https://logs.rmfood.com/api/errors',
})
```

#### 自定义上报逻辑（扩展）

```typescript
// 如果需要自定义上报逻辑（如添加用户信息、设备信息等）
import { logger } from '@/utils/safeLogger'

// 包装 error 方法
const originalError = logger.error.bind(logger)

logger.error = function(message, error, context) {
  // 调用原始方法
  originalError(message, error, context)

  // 自定义上报逻辑
  if (isProduction()) {
    sendToCustomService({
      message,
      error: parseError(error),
      context,
      user: getCurrentUser(),
      device: getDeviceInfo(),
      timestamp: Date.now(),
    })
  }
}
```

#### 上报数据格式

```json
{
  "level": "error",
  "message": "API请求失败",
  "data": {
    "name": "TypeError",
    "message": "Cannot read property 'data' of undefined",
    "stack": "TypeError: Cannot read property...\n    at Object.fetchData..."
  },
  "timestamp": "2026-05-09T10:30:45.123Z",
  "context": "APIService",
  "userAgent": "Mozilla/5.0...",
  "url": "http://localhost:5173/formulas"
}
```

---

### 6.4 日志采样和限流策略

#### 采样策略（避免海量日志）

```typescript
// 只记录部分日志（适用于高频场景）
class SampledLogger {
  private sampleRate: number
  private counter = 0

  constructor(sampleRate: number = 0.1) {
    this.sampleRate = sampleRate  // 10% 采样率
  }

  info(message: string, data?: any, context?: string) {
    this.counter++
    if (Math.random() < this.sampleRate) {
      logger.info(`[采样 ${Math.round(this.sampleRate * 100)}%] ${message}`, {
        ...data,
        _sampleCounter: this.counter,
      }, context)
    }
  }
}

const sampledLog = new SampledLogger(0.1)  // 10% 采样

// 高频事件
socket.onMessage((msg) => {
  sampledLog.info('收到消息', { type: msg.type })  // 只有 10% 的概率记录
})
```

#### 限流策略（防止日志风暴）

```typescript
// 同一消息限流（N 秒内只记录一次）
class ThrottledLogger {
  private lastLogged = new Map<string, number>()
  private throttleMs: number

  constructor(throttleMs: number = 5000) {
    this.throttleMs = throttleMs  // 5秒限流
  }

  warn(message: string, data?: any, context?: string) {
    const key = `${context}:${message}`
    const now = Date.now()
    const lastTime = this.lastLogged.get(key) || 0

    if (now - lastTime > this.throttleMs) {
      logger.warn(message, data, context)
      this.lastLogged.set(key, now)
    }
    // 否则静默丢弃
  }
}

const throttledLog = new ThrottledLogger(5000)

// 可能频繁触发的事件
window.addEventListener('resize', () => {
  throttledLog.warn('窗口大小变化', {
    width: window.innerWidth,
    height: window.innerHeight,
  }, 'UI')
})  // 5秒内只记录一次
```

#### 批量聚合上报

```typescript
// 收集多条日志后批量上报
class BatchReporter {
  private buffer: LogEntry[] = []
  private flushInterval: number
  private maxSize: number
  private timer: ReturnType<typeof setInterval>

  constructor(flushIntervalMs = 10000, maxSize = 50) {
    this.flushInterval = flushIntervalMs
    this.maxSize = maxSize

    // 定时刷新
    this.timer = setInterval(() => this.flush(), flushIntervalMs)
  }

  add(entry: LogEntry) {
    this.buffer.push(entry)

    if (this.buffer.length >= this.maxSize) {
      this.flush()
    }
  }

  private async flush() {
    if (this.buffer.length === 0) return

    const batch = [...this.buffer]
    this.buffer = []

    try {
      await fetch('/api/logs/batch', {
        method: 'POST',
        body: JSON.stringify(batch),
      })
    } catch (error) {
      logger.error('批量上报失败', error)
    }
  }

  destroy() {
    clearInterval(this.timer)
    this.flush()  // 上报剩余日志
  }
}
```

---

## 7. 常见问题 FAQ（Frequently Asked Questions）

### Q1: 为什么不能自定义 Logger 对象？

**A**: 统一使用全局单例有以下优势：

1. **一致性保证**: 全项目日志格式统一，便于分析和搜索
2. **功能完整性**: 自动脱敏、远程上报、环境感知等特性只有单例才能保证生效
3. **维护成本**: 避免多套日志系统的混乱（历史教训）
4. **打包优化**: 避免重复打包日志库代码
5. **集中管控**: 可以通过配置文件统一调整日志行为

如果需要模块隔离，请使用 `withContext()` 方法。

---

### Q2: 如何在生产环境禁用调试日志？

**A**: SafeLogger 已自动处理：

- **开发环境**: 输出所有级别日志（debug/info/warn/error/log）
- **生产环境**: 只输出 `error` 和 `warn` 级别
- `debug` 和 `info` 级别在生产环境不会输出，也不会影响性能

如需进一步控制，可通过环境变量配置：

```typescript
import { initLogger } from '@/config/logger'

initLogger({
  minLevel: 'error',  // 生产环境只保留错误日志
})
```

---

### Q3: 日志会影响性能吗？

**A**: 影响极小，原因如下：

1. **生产环境过滤**: debug/info 级别日志在生产环境完全不执行
2. **轻量级实现**: 核心逻辑只是简单的条件判断和字符串拼接
3. **异步远程上报**: 错误上报使用非阻塞式 fetch，不影响主线程
4. **内置保护**: 循环引用检测、异常捕获等避免崩溃

**性能基准测试**（参考值）:

| 操作 | 耗时 |
|------|------|
| 调用 logger.info()（被过滤） | ~0.001ms |
| 调用 logger.info()（实际输出） | ~0.05ms |
| 脱敏处理（10个字段的对象） | ~0.02ms |
| 远程上报（网络等待除外） | ~1ms |

对于绝大多数应用场景，性能影响可忽略不计。

---

### Q4: 如何查看历史日志？

**A**: 当前 SafeLogger 提供两种方式：

**方式 1: 控制台实时查看**

打开浏览器开发者工具（F12），切换到 Console 标签页即可看到实时日志。

**方式 2: 旧版 Logger 的存储功能**

如果你同时使用了旧版 `@/utils/logger`，它提供了内存存储：

```typescript
import { logger as oldLogger } from '@/utils/logger'

// 获取最近100条日志
const logs = oldLogger.getLogs()

// 导出为 JSON
const jsonStr = oldLogger.exportLogs()

// 清空日志
oldLogger.clearLogs()
```

**注意**: SafeLogger 本身不存储历史日志（为了节省内存）。如需持久化存储，建议：
- 配置远程上报服务端点
- 使用第三方日志服务（如 Sentry、LogRocket）
- 自定义扩展（参考 6.3 节）

---

### Q5: 支持远程上报吗？

**A**: 支持！配置方式如下：

**Step 1: 设置环境变量**

```bash
# .env.production
VITE_LOG_ENDPOINT=https://your-server.com/api/logs
```

**Step 2: 自动生效**

配置后，所有 `error` 级别日志会自动 POST 到指定端点。

**Step 3: 服务端接收示例（Node.js/Express）**

```javascript
app.post('/api/logs', (req, res) => {
  const logEntry = req.body
  // {
  //   level: 'error',
  //   message: '...',
  //   data: {...},
  //   timestamp: '...',
  //   context: '...',
  //   userAgent: '...',
  //   url: '...'
  // }

  // 存储到数据库或发送到日志服务
  saveToDatabase(logEntry)
  sendToSlack(logEntry)  // 可选：通知开发团队

  res.json({ success: true })
})
```

**可选: 更细粒度的控制**

```typescript
import { initLogger } from '@/config/logger'

initLogger({
  enableRemote: true,
  minLevel: 'warn',  // 上报 warn 及以上级别
  remoteUrl: 'https://logs.example.com/api/receive',
})
```

---

### Q6: 与旧 Logger 有什么区别？

**A**: 主要区别对比：

| 特性 | 旧 Logger (`@/utils/logger`) | 新 SafeLogger (`@/utils/safeLogger`) |
|------|------------------------------|-------------------------------------|
| **位置** | `frontend/src/utils/logger.ts` | `frontend/src/utils/safeLogger.ts` |
| **敏感数据脱敏** | ❌ 不支持 | ✅ 自动脱敏 |
| **环境感知** | ⚠️ 基础支持 | ✅ 完善的环境判断 |
| **远程上报** | ❌ 不支持 | ✅ 可配置 |
| **Error 对象处理** | ❌ 原样输出 | ✅ 自动提取 stack trace |
| **上下文支持** | ❌ 不支持 | ✅ withContext() |
| **性能计时** | ✅ time/timeEnd + startTimer | ✅ startTimer（更完善） |
| **日志存储** | ✅ 内存存储100条 | ❌ 不存储（节省内存） |
| **日志导出** | ✅ exportLogs() | ❌ 不支持 |
| **推荐度** | 🚫 将被废弃 | ✅ **强烈推荐使用** |

**迁移建议**: 新代码统一使用 SafeLogger，旧代码逐步迁移。

---

### Q7: 可以同时使用多个上下文吗？

**A**: 技术上可以通过链式调用实现，但**不推荐**：

```typescript
// ⚠️ 可以工作但不推荐
const log = logger.withContext('Module').withContext('SubModule')
// 结果: 上下文为 "SubModule"（后者覆盖前者）
```

**推荐的替代方案**：

**方案 1: 层级命名**
```typescript
const log = logger.withContext('Module:SubModule:Function')
log.info('操作完成')
// 输出: [INFO] [Module:SubModule:Function] 操作完成
```

**方案 2: 在 data 中携带额外上下文**
```typescript
const log = logger.withContext('Module')
log.info('子模块操作', {
  subModule: 'SubModule',
  function: 'FunctionName',
  extraContext: 'value',
})
```

**方案 3: 组合使用**
```typescript
const moduleLog = logger.withContext('Module')
moduleLog.info('操作1', null, 'SubModuleA')  // 显式传入 context 参数
moduleLog.info('操作2', null, 'SubModuleB')
```

---

### Q8: 如何处理循环引用对象？

**A**: SafeLogger 已内置处理机制：

**自动降级处理**:

```typescript
const circularObj = {}
circularObj.self = circularObj  // 循环引用

// ✅ SafeLogger 自动处理（不会崩溃）
logger.info('循环引用对象', circularObj)
// 输出: [Circular Reference] 或安全字符串表示
```

**内部实现原理**:
```typescript
private format(entry: LogEntry): string {
  if (entry.data) {
    try {
      // 尝试 JSON 序列化（会检测循环引用）
      output += JSON.stringify(this.sanitize(entry.data), null, 2)
    } catch {
      // 失败时降级为 toString()
      output += String(entry.data)
    }
  }
  return output
}
```

**手动处理建议**（如果需要精确控制）:

```typescript
// 使用自定义 replier 函数处理特殊对象
const seen = new WeakSet()

function safeStringify(obj) {
  return JSON.stringify(obj, (key, value) => {
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) {
        return '[Circular]'
      }
      seen.add(value)
    }
    return value
  })
}

logger.info('复杂数据', JSON.parse(safeStringify(data)))
```

---

### Q9: 支持哪些浏览器？

**A**: SafeLogger 支持所有现代浏览器：

| 浏览器 | 最低版本 | 支持程度 |
|--------|----------|----------|
| Chrome | 60+ | ✅ 完全支持 |
| Firefox | 55+ | ✅ 完全支持 |
| Safari | 11+ | ✅ 完全支持 |
| Edge | 79+ | ✅ 完全支持 |
| IE 11 | - | ⚠️ 不支持（需要 polyfill） |

**依赖的现代 API**:

1. **performance.now()** - 用于计时功能（IE10+）
2. **fetch()** - 用于远程上报（需要 polyfill）
3. **JSON.stringify()** - 用于序列化（全面支持）
4. **模板字符串** - ES6 语法（需要编译）

**Polyfill 建议**（如果需要支持旧浏览器）:

```typescript
// fetch polyfill
import 'whatwg-fetch'

// performance.now() polyfill
if (!window.performance) {
  window.performance = { now: Date.now }
}
```

**注意**: RMFOOD 项目目标浏览器均为现代浏览器，通常无需担心兼容性问题。

---

### Q10: 如何扩展自定义功能？

**A**: SafeLogger 设计为可扩展，以下是几种扩展方式：

#### 方式 1: 包装器模式（推荐）

```typescript
// utils/enhancedLogger.ts
import { logger } from './safeLogger'

interface EnhancedLogger extends SafeLogger {
  success(message: string, data?: any, context?: string): void
  metric(name: string, value: number, tags?: Record<string, string>): void
}

const enhancedLogger = {
  // 委托原有方法
  ...logger,

  // 新增：成功日志（绿色输出）
  success(message: string, data?: any, context?: string) {
    console.log(`%c✅ ${message}`, 'color: green; font-weight: bold;', data)
    logger.info(message, data, context)
  },

  // 新增：指标记录
  metric(name: string, value: number, tags?: Record<string, string>) {
    logger.info(`Metric: ${name}`, { value, ...tags }, 'Metrics')
    // 可以上报到监控系统
    if (window.__METRICS_COLLECTOR__) {
      window.__METRICS_COLLECTOR__.record(name, value, tags)
    }
  },

  // 新增：业务事件
  trackEvent(event: string, properties?: Record<string, unknown>) {
    logger.info(`Event: ${event}`, properties, 'Analytics')
  },
}

export { enhancedLogger as logger }
export default enhancedLogger
```

**使用**:
```typescript
import { logger } from '@/utils/enhancedLogger'

logger.success('配方保存成功', { id: 'F001' })
logger.metric('api_latency', 234, { endpoint: '/api/formulas' })
logger.trackEvent('formula_created', { category: 'peptide' })
```

#### 方式 2: Monkey-patch（谨慎使用）

```typescript
// 仅在开发环境或初始化阶段使用
if (process.env.NODE_ENV === 'development') {
  const originalError = logger.error.bind(logger)

  logger.error = function(message, error, context) {
    // 调用原始方法
    originalError(message, error, context)

    // 额外行为：弹出提示（仅开发环境）
    if (typeof window !== 'undefined' && window.alert) {
      // window.alert(`[DEV] ${message}`)
    }
  }
}
```

#### 方式 3: 继承扩展（高级）

```typescript
class CustomLogger extends (logger.constructor as typeof SafeLogger) {
  constructor() {
    super()
  }

  // 重写错误处理
  error(message: string, error?: Error | any, context?: string) {
    super.error(message, error, context)

    // 发送到自定义错误追踪服务
    this.sendToSentry(message, error, context)
  }

  private sendToSentry(message: string, error: any, context: string) {
    // 实现 Sentry 集成
  }
}

// ⚠️ 注意：这种方式可能导致实例不一致，不推荐
```

**推荐**: 使用**方式 1（包装器模式）**，最安全且易于维护。

---

## 8. 架构说明（Architecture）

### 8.1 统一日志系统架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                        应用层 (Application Layer)                │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │   Components │  │   Services    │  │      Hooks/Stores    │   │
│  │              │  │              │  │                      │   │
│  │ import logger│  │ import logger│  │  import logger       │   │
│  │ from safe... │  │ from safe... │  │  from safe...        │   │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────┘   │
│         │                 │                      │               │
└─────────┼─────────────────┼──────────────────────┼───────────────┘
          │                 │                      │
          ▼                 ▼                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                     SafeLogger 核心层                            │
│                  (@/utils/safeLogger.ts)                         │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                   SafeLogger Class                       │    │
│  │                                                          │    │
│  │  ┌─────────────┐  ┌─────────────┐  ┌────────────────┐  │    │
│  │  │  log()      │  │  info()     │  │  warn()        │  │    │
│  │  ├─────────────┤  ├─────────────┤  ├────────────────┤  │    │
│  │  │  debug()    │  │  error()    │  │  log()         │  │    │
│  │  └─────────────┘  └─────────────┘  └────────────────┘  │    │
│  │                                                          │    │
│  │  ┌─────────────────┐  ┌──────────────────────────────┐  │    │
│  │  │  startTimer()   │  │  withContext()               │  │    │
│  │  └─────────────────┘  └──────────────────────────────┘  │    │
│  └─────────────────────────────────────────────────────────┘    │
│                          │                                       │
│          ┌───────────────┼───────────────┐                       │
│          ▼               ▼               ▼                       │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐             │
│  │ Sanitizer    │ │ Formatter    │ │ Environment  │             │
│  │ (脱敏引擎)   │ │ (格式化器)   │ │ (环境检测)   │             │
│  └──────────────┘ └──────────────┘ └──────────────┘             │
└─────────────────────────────────────────────────────────────────┘
                          │
          ┌───────────────┼───────────────┐
          ▼               ▼               ▼
┌─────────────────┐ ┌─────────────┐ ┌──────────────────┐
│  Console Output │ │ Remote Log  │ │  Config Layer    │
│  (控制台输出)   │ │ (远程上报)  │ │ (/config/logger) │
│                 │ │             │ │                  │
│  • dev: 全部    │  │  • error   │  │  • LOG_LEVELS   │
│  • prod: 限制   │  │  • 可配置  │  │  • initLogger() │
└─────────────────┘ └─────────────┘ └──────────────────┘
```

### 8.2 各层职责说明

#### 第一层：应用层（Application Layer）

**职责**:
- 业务代码通过统一的导入方式使用日志
- 所有组件、服务、hooks 都从同一入口导入
- 保证全项目使用相同的 Logger 实例

**关键原则**:
```typescript
// ✅ 唯一允许的导入方式
import { logger } from '@/utils/safeLogger'

// ❌ 禁止的其他导入方式
import { logger } from '@/utils/logger'           // 旧版
import { logger } from '@/config/logger'          // 配置层
const logger = { /* 自定义 */ }                   // 自定义
```

---

#### 第二层：SafeLogger 核心层

**文件位置**: `frontend/src/utils/safeLogger.ts`

**核心职责**:

1. **日志调度中心**
   - 接收所有日志调用
   - 根据级别和环境决定是否输出
   - 分发到不同的输出目标

2. **安全处理引擎**
   - 自动脱敏敏感数据（password、token 等）
   - 循环引用检测和安全序列化
   - Error 对象标准化处理

3. **环境适配器**
   - 自动检测开发/生产环境
   - 动态调整日志级别
   - 条件性启用/禁用功能

4. **功能扩展接口**
   - `withContext()`: 上下文隔离
   - `startTimer()`: 性能监控
   - 可插拔的远程上报

**核心类结构**:

```typescript
class SafeLogger {
  // 私有属性
  private isEnabled: boolean        // 是否启用
  private minLevel: LogLevel        // 最低日志级别
  private remoteEndpoint?: string   // 远程端点

  // 核心私有方法
  private sanitize(data: any): any           // 脱敏处理
  private format(entry: LogEntry): string    // 格式化输出
  private internalLog(level, msg, data, ctx) // 内部日志实现
  private shouldLog(level): boolean          // 级别检查
  private reportToRemote(entry): void        // 远程上报

  // 公共 API
  public log(message, ...args): void
  public debug(message, data?, context?): void
  public info(message, data?, context?): void
  public warn(message, data?, context?): void
  public error(message, error?, context?): void
  public startTimer(label): TimerHandle
  public withContext(context): SafeLogger
}
```

---

#### 第三层：辅助功能层

##### 3.1 Sanitizer（脱敏引擎）

**职责**:
- 扫描日志数据中的敏感字段
- 自动隐藏敏感值（保留首尾字符）
- 递归处理嵌套对象和数组

**工作流程**:
```
输入: { password: 'secret123', user: 'admin' }
  ↓
正则匹配: password 匹配 /password/i ✓
  ↓
脱敏处理: 'secret123' → 'se****23'
  ↓
输出: { password: 'se****23', user: 'admin' }
```

**敏感字段列表**:
- password, passwd, secret
- token, api_key, authorization
- credit_card, ssn
- 以及匹配这些模式的字段名

##### 3.2 Formatter（格式化器）

**职责**:
- 统一输出格式: `[timestamp] [LEVEL] message`
- JSON 序列化数据对象
- 异常捕获和降级处理

**输出格式示例**:
```
[2026-05-09T10:30:45.123Z] [INFO] 用户登录成功 {"username":"admin","role":"superadmin"}
[2026-05-09T10:31:02.456Z] [ERROR] API请求失败 {"name":"TypeError","message":"..."}
[2026-05-09T10:31:15.789Z] [Performance] 配方生成 完成 {"durationMs":1234,"count":25}
```

##### 3.3 Environment（环境检测器）

**职责**:
- 检测当前运行环境
- 设置合适的日志级别
- 决定功能启用状态

**检测优先级**:
1. Vite 环境变量: `import.meta.env.MODE`
2. Node.js 环境变量: `process.env.NODE_ENV`
3. 主机名判断: `window.location.hostname === 'localhost'`

---

#### 第四层：输出层

##### 4.1 Console Output（控制台输出）

**行为差异**:

| 环境 | debug | info | log | warn | error |
|------|-------|------|-----|------|-------|
| **开发** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **生产** | ❌ | ❌ | ❌ | ✅ | ✅ |

**映射关系**:
```typescript
const consoleMethod = {
  debug: console.debug,
  info: console.info,
  log: console.log,
  warn: console.warn,
  error: console.error,
}[level]
```

##### 4.2 Remote Log（远程上报）

**触发条件**:
- 日志级别为 `error`
- 已配置 `VITE_LOG_ENDPOINT` 或 `remoteUrl`
- 网络可用

**上报数据结构**:
```typescript
{
  level: 'error',
  message: string,
  data: object,
  timestamp: ISO string,
  context?: string,
  userAgent: string,  // 自动添加
  url: string,        // 自动添加
}
```

**错误处理**:
- 上报失败静默处理（避免无限循环）
- 不阻塞主线程（异步执行）
- 不影响本地日志输出

##### 4.3 Config Layer（配置层）

**文件位置**: `frontend/src/config/logger.ts`

**职责**:
- 提供 Logger 配置接口
- 定义类型常量（LOG_LEVELS 等）
- 高级功能封装（全局错误处理器等）

**与 SafeLogger 的关系**:
```
Config Layer (config/logger.ts)
    │
    │  import { logger as safeLogger } from '@/utils/safeLogger'
    │  委托核心功能给 SafeLogger
    │
    ▼
SafeLogger (utils/safeLogger.ts)
    │
    │  实际执行日志操作
    │
    ▼
Console / Remote Endpoint
```

**何时使用 Config Layer**:
- 需要初始化配置时: `initLogger()`
- 需要全局错误处理时: `setupGlobalErrorHandler()`
- 需要便捷的业务日志方法时: `logPageView()`, `logUserAction()` 等

**何时直接使用 SafeLogger**:
- 日常开发的大部分场景
- 需要完整 API 时（withContext、startTimer 等）
- 组件和服务内部使用

---

### 8.3 依赖关系说明

#### 包依赖图

```
SafeLogger (无外部依赖)
    │
    ├── 浏览器原生 API
    │   ├── console (log/warn/error/debug/info)
    │   ├── performance.now() (高精度计时)
    │   ├── fetch() (HTTP 请求)
    │   ├── Date (时间戳)
    │   └── JSON (序列化)
    │
    └── Vite 环境变量 (可选)
        └── import.meta.env (MODE, PROD, VITE_*)
```

**特点**:
- ✅ **零依赖**: 不引入任何第三方 npm 包
- ✅ **轻量级**: 源码不到 300 行
- ✅ **Tree-shakable**: 未使用的功能可被优化掉
- ✅ **ESM 原生**: 支持 ES Module 标准

#### 模块依赖关系

```
@/utils/safeLogger (核心)
    ↑
    │ 被...导入
    │
├── @/config/logger (配置层包装器)
│     ↑
│     ├── 各个 Service 文件 (~20个)
│     ├── Store 文件 (~5个)
│     └── Hook 文件 (~10个)
│
├── 组件文件 (~30个)
│
└── 工具文件 (~10个)
```

**统计数据** (截至 2026-05-09):
- 直接使用 safeLogger 的文件: **1 个** (safeLogger.ts 本身)
- 使用 config/logger 的文件: **~35 个**
- 总计使用统一日志系统的文件: **~36 个**
- 项目总文件数: **~200+ 个前端文件**
- 覆盖率: **~18%** (持续增长中)

---

### 8.4 数据流示意

#### 正常日志流程

```
用户代码调用
    │
    ▼
logger.info('消息', data, 'Context')
    │
    ▼
internalLog('info', '消息', data, 'Context')
    │
    ├─→ shouldLog('info') → 检查环境和级别
    │       │
    │       ├─→ false → return (静默退出)
    │       │
    │       └─→ true → 继续
    │
    ├─→ 构建 LogEntry 对象
    │       {
    │         level: 'info',
    │         message: '消息',
    │         data: sanitize(data),  ← 脱敏处理
    │         timestamp: ISO string,
    │         context: 'Context'
    │       }
    │
    ├─→ format(entry) → 格式化字符串
    │
    ├─→ console.info(formatted) → 输出到控制台
    │
    └─→ (如果是 error 且配置了远程端点)
            └─→ reportToRemote(entry) → POST 到服务器
                    │
                    └─→ 失败时静默处理
```

#### 计时器流程

```
logger.startTimer('标签')
    │
    ▼
记录 startTime = performance.now()
    │
    ▼
返回 { end: function(data) }
    │
    │ (... 用户代码执行 ...)
    │
    ▼
timer.end(extraData)
    │
    ▼
计算 duration = performance.now() - startTime
    │
    ▼
调用 logger.info('标签 完成', { ...extraData, durationMs }, 'Performance')
    │
    ▼
走正常的日志流程...
```

#### withContext 流程

```
logger.withContext('MyModule')
    │
    ▼
创建代理对象
    │
    ├─→ log(msg, data) → internalLog('log', msg, data, 'MyModule')
    ├─→ info(msg, data) → internalLog('info', msg, data, 'MyModule')
    ├─→ warn(msg, data) → internalLog('warn', msg, data, 'MyModule')
    ├─→ error(msg, err) → internalLog('error', msg, err, 'MyModule')
    ├─→ debug(msg, data) → internalLog('debug', msg, data, 'MyModule')
    │
    └─→ startTimer(label) → startTimer('MyModule:label')
                                │
                                └─→ end 时自动带上上下文
```

---

## 附录

### A. 快速参考卡（Cheat Sheet）

```typescript
// ══════════════════════════════════
// 导入
// ══════════════════════════════════
import { logger } from '@/utils/safeLogger'

// ══════════════════════════════════
// 基础用法
// ══════════════════════════════════
logger.info('一般信息', { key: 'value' }, 'Context')
logger.error('错误信息', errorObject, 'Context')
logger.warn('警告信息', { threshold: 1000 })
logger.debug('调试信息', { step: 1 }, 'DevOnly')
logger.log('通用日志', arg1, arg2)

// ══════════════════════════════════
// 计时
// ══════════════════════════════════
const timer = logger.startTimer('操作名称')
// ... 执行代码 ...
timer.end({ additionalData: 'value' })

// ══════════════════════════════════
// 上下文
// ══════════════════════════════════
const log = logger.withContext('ModuleName')
log.info('消息')  // 自动带上 [ModuleName]
```

### B. 日志级别选择指南

| 场景 | 推荐级别 | 示例 |
|------|----------|------|
| 用户操作成功 | `info` | `'用户登录成功'` |
| 业务流程节点 | `info` | `'配方保存完成'` |
| 可恢复的错误 | `warn` | `'API响应慢 (2.5s)'` |
| 异常/失败 | `error` | `'数据库连接失败'` |
| 开发调试 | `debug` | `'状态值: {...}'` |
| 临时调试 | `log` | `'检查点 A'` |
| 性能监控 | `info` + `timer` | `'API请求 完成 {durationMs: 123}'` |

### C. 常见错误及修复

| 错误现象 | 原因 | 解决方案 |
|----------|------|----------|
| 日志不显示 | 生产环境用了 `debug` | 改用 `info` 或 `warn` |
| 导入报错 | 路径错误 | 使用 `@/utils/safeLogger` |
| 类型错误 | Error 对象未正确传递 | 确保 `catch` 的变量传入 |
| 敏感数据泄露 | 手动绕过脱敏 | 不要手动拼接敏感字段 |
| 性能问题 | 循环中使用高频日志 | 使用采样或汇总 |

---

## 文档信息

- **文档版本**: 1.0.0
- **创建日期**: 2026-05-09
- **适用项目**: RMFOOD 配方平台
- **维护团队**: Frontend Team
- **最后审核**: 待定

---

> 💡 **提示**: 如有疑问或建议，请联系前端团队或在项目中提 Issue。
>
> 📖 **相关文档**:
> - [SafeLogger 源码](../frontend/src/utils/safeLogger.ts)
> - [Logger 配置](../frontend/src/config/logger.ts)
> - [旧版 Logger](../frontend/src/utils/logger.ts) (仅供参考)
