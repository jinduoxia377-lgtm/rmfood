# RMFOOD 微信小程序开发方案 V3.0 — 资深专家深度评审报告

> 评审版本：V2.0 → V3.0  
> 评审日期：2026-09-05  
> 评审人：资深小程序专家组

---

## 执行摘要

V2.0方案已比V1.0有显著改进，但在**代码正确性、平台约束落地、数据流设计、工程化缺失**四个方面仍存在关键问题。本报告逐一指出并给出修正方案。

---

## 一、严重问题（影响核心功能实现）

### 1.1 SSE流式代码存在技术错误

**V2.0代码问题：**
```typescript
// V2.0中的错误代码
const reader = res.data.getReader()  // ❌ 小程序不支持！
const decoder = new TextDecoder('utf-8')  // ❌ 小程序不支持！
```

**问题分析：**
- `ReadableStream.getReader()` 是浏览器Web API，小程序环境不可用
- `TextDecoder` 同样不存在于小程序环境
- Taro的`wx.request`不支持`enableChunked`配置项（该配置仅适用于H5模式）

**正确方案：**
```typescript
// V3.0修正方案：使用Taro原生分包读取
export async function streamChat(
  question: string,
  callbacks: StreamCallback,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const token = Taro.getStorageSync('access_token')
    
    // 方案A：使用Taro官方推荐的fetch API（基础库2.15.0+）
    const controller = new AbortController()
    
    fetch(`${API_BASE}/ai/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ question, stream: true }),
      signal: controller.signal,
    })
    .then(response => {
      if (!response.ok) throw new Error('Request failed')
      
      const reader = response.body.getReader()
      const decoder = new TextDecoder('utf-8')
      let buffer = ''
      
      function read() {
        reader.read().then(({ done, value }) => {
          if (done) {
            callbacks.onDone(buffer)
            resolve()
            return
          }
          
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6))
                if (data.content) callbacks.onChunk(data.content)
                else if (data.error) {
                  callbacks.onError(data)
                  reject(new Error(data.message))
                  controller.abort()
                  return
                }
              } catch (e) { /* 忽略解析错误 */ }
            }
          }
          
          read()
        }).catch(reject)
      }
      
      read()
    })
    .catch(reject)
  })
}
```

**备选方案（基础库<2.15.0）：**
- 使用后端轮询接口替代SSE
- 或者使用Taro的`connectSocket`建立WebSocket连接

---

### 1.2 Zustand persist中间件与小程序不兼容

**V2.0代码问题：**
```typescript
// V2.0中的错误代码
export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({ ... }),
    {
      name: 'auth-storage',  // ❌ persist默认使用localStorage
    }
  )
)
```

**问题分析：**
- Zustand的`persist`中间件默认使用`localStorage`
- 小程序环境没有`localStorage`，只有`wx.setStorageSync`/`wx.getStorageSync`
- 需要使用自定义storage适配器

**正确方案：**
```typescript
// V3.0修正方案
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import Taro from '@tarojs/taro'

// 自定义小程序storage适配器
const taroStorage = {
  getItem: (name: string) => {
    const value = Taro.getStorageSync(name)
    return value ? JSON.stringify(value) : null
  },
  setItem: (name: string, value: string) => {
    Taro.setStorageSync(name, JSON.parse(value))
  },
  removeItem: (name: string) => {
    Taro.removeStorageSync(name)
  },
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      isAuthenticated: false,
      // ... actions
    }),
    {
      name: 'rmfood-auth',
      storage: createJSONStorage(() => taroStorage),
      partialize: (state) => ({ 
        token: state.token,
        user: state.user 
      }),
    }
  )
)
```

---

### 1.3 目录结构技术栈不一致

**V2.0问题：**
```
// V2.0目录结构中使用了.vue扩展名
├── pages/
│   ├── index/
│   │   ├── index.vue     // ❌ React/Taro应使用tsx
│   │   └── index.scss
│   ├── chat/
│   │   ├── chat.vue      // ❌
```

**修正：** Taro + React应使用`.tsx`扩展名，而非`.vue`

---

## 二、重要遗漏（影响用户体验和合规）

### 2.1 小程序隐私合规要求未提及

**微信小程序健康类内容审核严格：**
- 体质诊断涉及健康数据收集，需在首次使用时弹窗声明
- AI生成的配方建议必须添加免责声明
- 用户健康数据属于敏感个人信息，需符合《个人信息保护法》要求

**V3.0补充方案：**
```typescript
// 首次启动隐私协议弹窗
Taro.showModal({
  title: '隐私政策声明',
  content: '本小程序将收集您的健康相关数据用于提供个性化配方建议。' +
           '您的数据仅存储在本地和我们的加密服务器中，不会分享给第三方。' +
           '继续使用前请阅读并同意《隐私政策》和《用户协议》。',
  confirmText: '同意并继续使用',
  cancelText: '退出',
  success: (res) => {
    if (res.confirm) {
      Taro.setStorageSync('privacy_accepted', true)
    } else {
      Taro.exitMiniProgram()
    }
  }
})
```

### 2.2 健康咨询免责声明未设计

**必须在前端固定位置展示：**
```
⚠️ 免责声明：本平台提供的配方建议仅供参考，不能替代专业医疗诊断和治疗。
   如有健康问题，请及时就医。孕妇、哺乳期妇女及慢性病患者在使用前请咨询医生。
```

### 2.3 分享深度链接未设计

**V2.0仅提到"分享配方"，但未说明：**
- 分享后点击如何跳转到具体配方详情页
- 需要配置小程序path参数传递

**V3.0补充方案：**
```typescript
// 分享时携带配方ID
onShareAppMessage() {
  return {
    title: `推荐配方：${this.formula.name}`,
    path: `/pages/formula-detail/index?id=${this.formula.id}&from=share`,
    imageUrl: this.shareImageUrl,
  }
}

// 详情页接收分享参数
onLoad(options: { id: string; from?: string }) {
  if (options.id) {
    this.loadFormula(options.id)
  }
  if (options.from === 'share') {
    // 记录分享来源，用于统计
    this.reportShareSource(options.id)
  }
}
```

### 2.4 小程序云开发能力未评估

**V2.0完全未提及微信云开发能力：**
- 云数据库：可用于存储用户临时数据（如对话历史草稿）
- 云函数：可用于处理不需要敏感信息的服务端逻辑
- 云存储：可用于存储用户上传图片

**V3.0补充建议：**
```
考虑使用云开发场景：
1. 对话历史草稿：使用云数据库存储未登录用户的临时对话
2. 图片上传：使用云存储替代自建CDN（降低配置复杂度）
3. 订阅消息：使用云函数触发微信订阅消息推送
```

---

## 三、中等遗漏（影响工程质量和可维护性）

### 3.1 CI/CD流水线未设计

**V2.0缺失：**
- 无自动化构建流程
- 无代码质量检查
- 无自动部署到微信开发者工具的流程

**V3.0补充方案：**
```yaml
# .github/workflows/miniprogram.yml
name: 小程序构建发布

on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: 安装依赖
        run: cd miniprogram && npm ci
        
      - name: 代码检查
        run: cd miniprogram && npm run lint
        
      - name: 构建小程序
        run: cd miniprogram && npm run build:weapp
        
      - name: 上传到微信
        run: |
          npx miniprogram-ci upload \
            --appid ${{ secrets.WX_APPID }} \
            --project ./miniprogram \
            --password ${{ secrets.WX_PASSWORD }} \
            --version 1.0.0
```

### 3.2 测试策略未设计

**V2.0缺失：**
- 单元测试策略
- E2E测试策略
- 真机测试计划

**V3.0补充方案：**
```
测试策略：
1. 单元测试：Jest + @tarojs/test-utils
   - 测试状态管理逻辑
   - 测试工具函数
   - 覆盖率目标：80%+

2. E2E测试：Playwright for MiniProgram
   - 测试核心流程（登录→对话→收藏）
   - 测试不同机型适配

3. 真机测试：
   - iOS/Android各测试3款主流机型
   - 网络环境测试（WiFi/4G/弱网）
   - 性能测试（首屏加载、内存占用）
```

### 3.3 性能监控未设计

**V2.0缺失：**
- 无性能数据采集
- 无错误监控上报
- 无用户体验指标

**V3.0补充方案：**
```typescript
// src/utils/performance.ts
import Taro from '@tarojs/taro'

class PerformanceMonitor {
  // 页面加载时间
  trackPageLoad(pageName: string, duration: number) {
    Taro.reportAnalytics('page_load', {
      page: pageName,
      duration_ms: duration,
    })
  }
  
  // API请求时间
  trackApiCall(endpoint: string, duration: number, success: boolean) {
    Taro.reportAnalytics('api_call', {
      endpoint,
      duration_ms: duration,
      success,
    })
  }
  
  // 错误上报
  reportError(error: Error, context: Record<string, any>) {
    Taro.reportAnalytics('error', {
      message: error.message,
      stack: error.stack,
      ...context,
    })
  }
}

export const monitor = new PerformanceMonitor()
```

### 3.4 多端适配未考虑

**V2.0仅针对微信小程序，但Taro的优势是多端输出。**

**V3.0补充方案：**
```
优先发布平台：微信小程序（主战场）
后续扩展平台（Phase 2）：
- 支付宝小程序（用户群体重叠度30%）
- 抖音小程序（潜在增量市场）
- H5版本（SEO引流）

适配策略：
- 使用Taro的条件编译：#__TARO_APP_WEAPP__
- 各端特有API使用platform判断
- 组件库选择多端兼容版本
```

---

## 四、详细问题清单

### 4.1 代码层面的问题

| 行号/位置 | 问题描述 | 严重程度 | 修正方案 |
|-----------|---------|---------|---------|
| 3.2节代码 | `res.data.getReader()` 不可用 | 🔴 严重 | 改用fetch API或轮询 |
| 3.2节代码 | `TextDecoder` 不可用 | 🔴 严重 | 使用base64编码传输 |
| 3.5节代码 | Zustand persist默认localStorage | 🔴 严重 | 使用自定义taroStorage适配器 |
| 2.3节目录 | `.vue`扩展名错误 | 🟡 重要 | 改为`.tsx` |
| 3.6节代码 | `wx.parseVoice` deprecated | 🟡 重要 | 改用`translateVoice`新API |
| 6.1节表格 | "字体子集化"不适用于小程序 | 🟠 中等 | 删除此项，改为"移除未用字体" |

### 4.2 设计层面的遗漏

| 遗漏项 | 影响 | 优先级 | 补充内容 |
|--------|------|--------|---------|
| 隐私合规弹窗 | 审核拒审风险 | P0 | 首次启动隐私协议弹窗设计 |
| 健康免责声明 | 法律风险 | P0 | 固定位置免责声明展示 |
| 分享深度链接 | 裂变效果 | P1 | 分享参数传递方案设计 |
| 云开发能力评估 | 架构优化机会 | P2 | 云数据库/云函数适用场景分析 |
| 多端适配规划 | 技术债 | P2 | Taro多端输出路线图 |
| 性能监控方案 | 运维能力 | P1 | 埋点设计和数据采集方案 |
| CI/CD流水线 | 交付效率 | P1 | GitHub Actions配置示例 |
| 测试策略 | 质量保障 | P1 | 单元+E2E+真机测试方案 |

### 4.3 后端对接遗漏

| 遗漏接口 | 说明 | 优先级 |
|---------|------|--------|
| `/api/v1/auth/wechat-login` | 微信登录（需openid映射） | P0 |
| `/api/v1/formulas/favorite` | 收藏功能 | P0 |
| `/api/v1/mobile/health/check` | 体质诊断提交 | P1 |
| `/api/v1/rag/query` | RAG知识库问答 | P1 |
| `/api/v1/formulas/compare` | 配方对比接口 | P2 |

---

## 五、V3.0修正后的关键改进点

### 5.1 SSE流式输出正确实现方案

```typescript
// 方案选择决策树
if (基础库 >= 2.15.0) {
  → 使用 fetch API + ReadableStream（推荐）
} else if (需要兼容旧版本) {
  → 使用轮询方案（POST提交任务，GET轮询结果）
} else {
  → 降级为同步接口（等待完整结果）
}
```

### 5.2 小程序专属状态管理方案

```typescript
// 自定义storage适配器
const createTaroStorage = (keyPrefix: string) => ({
  getItem: (name: string) => {
    const fullKey = `${keyPrefix}_${name}`
    try {
      const value = Taro.getStorageSync(fullKey)
      return value ? JSON.stringify(value) : null
    } catch {
      return null
    }
  },
  setItem: (name: string, value: string) => {
    const fullKey = `${keyPrefix}_${name}`
    try {
      Taro.setStorageSync(fullKey, JSON.parse(value))
    } catch (e) {
      console.warn('Storage set failed:', e)
    }
  },
  removeItem: (name: string) => {
    const fullKey = `${keyPrefix}_${name}`
    Taro.removeStorageSync(fullKey)
  },
})

// 使用
const authStorage = createTaroStorage('rmfood')
const useAuthStore = create<AuthState>()(
  persist(..., { storage: createJSONStorage(() => authStorage) })
)
```

### 5.3 隐私合规完整方案

```
用户首次启动流程：
1. 检查是否已接受隐私协议
2. 如未接受，显示隐私弹窗
3. 用户同意后，记录状态并继续
4. 设置页面提供隐私设置入口
```

---

## 六、实施建议优先级

### 立即修正（P0）
1. 修正SSE流式代码，使用fetch API
2. 修正Zustand persist适配器
3. 补充隐私合规弹窗设计
4. 添加健康免责声明

### 近期补充（P1）
1. 设计分享深度链接方案
2. 补充CI/CD流水线配置
3. 设计性能监控方案
4. 补充测试策略

### 远期规划（P2）
1. 评估云开发能力适用性
2. 规划多端适配路线图
3. 优化包体积（字体子集化等）

---

## 七、总结

V2.0方案在架构设计和功能规划层面已经相当完善，但在**代码正确性**和**小程序平台特性适配**方面存在关键问题。本报告提出的V3.0修正方案着重解决：

1. **技术正确性**：修正不可用的API调用
2. **平台合规性**：补充隐私合规和免责声明
3. **工程完整性**：补充CI/CD、测试、监控
4. **用户体验**：补充分享链路、多端适配

按照V3.0方案实施，可确保项目顺利推进并符合微信小程序审核要求。

---

*报告版本：V3.0 | 编制：RMFOOD资深小程序专家组 | 日期：2026-09-05*
