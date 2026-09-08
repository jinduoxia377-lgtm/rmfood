# RMFOOD 微信小程序开发方案 V5.0（完整版）

> 版本：V5.0  
> 编制日期：2026-09-05  
> 编制：RMFOOD架构组 + 资深小程序专家组  
> 状态：✅ 正式开发版

---

## 执行摘要

本方案基于微信小程序官方开发框架，结合RMFOOD平台业务需求，提供完整的技术架构、实现方案和开发指南。

**核心要点：**
- ✅ 技术栈：Taro 4.x + React 18 + TypeScript + NutUI-Taro
- ✅ 后端对接：复用现有FastAPI接口，新增微信登录
- ✅ 流式输出：fetch API + ReadableStream（基础库2.15.0+）
- ✅ 合规要求：隐私政策、免责声明、健康数据保护
- ✅ 开发周期：10周（含审核buffer）
- ✅ 预算估算：首年¥56,000

---

## 一、技术架构设计

### 1.1 技术选型

| 层级 | 技术 | 版本 | 说明 |
|------|------|------|------|
| **框架层** | Taro | 4.1.6 | 多端框架，支持微信小程序 |
| **UI层** | React | 18.2.0 | Taro支持的React版本 |
| **组件库** | NutUI-Taro | 4.11.0 | 京东开源，Taro专属版 |
| **状态管理** | Zustand | 5.0.1 | 轻量级，支持持久化 |
| **样式方案** | SCSS + CSS变量 | 1.6 | rpx单位适配系统 |
| **请求层** | fetch API | 原生 | 基础库2.15.0+支持 |
| **降级方案** | wx.request | 原生 | 兼容旧版本 |
| **富文本** | wxParse | 1.0.0 | Markdown渲染 |
| **加密工具** | crypto-js | 4.2.0 | Token加密存储 |

### 1.2 系统架构图

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          RMFOOD 微信小程序系统架构                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────┐  │
│  │   首页       │    │   AI对话     │    │   配方列表   │    │ 个人中心 │  │
│  │  (index)     │    │   (chat)     │    │  (formulas)  │    │ (profile)│  │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘    └─────┬────┘  │
│         │                   │                   │                  │       │
│  ┌──────▼───────┐    ┌──────▼───────┐    ┌──────▼───────┐    ┌─────▼────┐  │
│  │   体质诊断   │    │  配方详情    │    │   搜索       │    │  设置    │  │
│  │(health-check)│    │(formula-detail)│  │  (search)    │    │ (settings)│ │
│  └──────────────┘    └──────────────┘    └──────────────┘    └──────────┘  │
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                      业务逻辑层（React + Taro）                       │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌────────────┐  │   │
│  │  │  Pages      │  │ Components  │  │    Stores   │  │   Hooks    │  │   │
│  │  │  (10个页面) │  │ (20+组件)   │  │ (Zustand)   │  │ (自定义)   │  │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └────────────┘  │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌────────────┐  │   │
│  │  │   API层     │  │  工具函数   │  │  类型定义   │  │  缓存管理  │  │   │
│  │  │(request.ts) │  │ (utils/)    │  │  (types/)   │  │(cache.ts) │  │   │
│  │  │(stream.ts) │  │             │  │             │  │           │  │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └────────────┘  │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                      请求层（双策略：fetch + wx.request）              │   │
│  │  • Token管理（加密存储）                                              │   │
│  │  • 请求拦截器（自动注入Authorization）                                │   │
│  │  • 响应拦截器（401自动刷新、错误统一处理）                            │   │
│  │  • SSE流式（fetch API + ReadableStream）                             │   │
│  │  • 降级策略（轮询 fallback）                                         │   │
│  │  • 离线队列（网络恢复后自动同步）                                     │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│                              ↓ HTTP/HTTPS ↓                                 │
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                       FastAPI 后端服务                                │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌───────┐  │   │
│  │  │ 认证服务 │  │ AI服务   │  │ 配方服务 │  │ 搜索服务 │  │ 通知  │  │   │
│  │  │/auth/*   │  │ /ai/*    │  │/formulas │  │ /search  │  │ /notify│  │   │
│  │  │/wechat/* │  │          │  │          │  │          │  │       │  │   │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘  └───────┘  │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│                              ↓ PostgreSQL + Redis ↓                         │
│                                                                             │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                  │
│  │  PostgreSQL  │    │    Redis     │    │  文件存储    │                  │
│  │  (业务数据)  │    │ (缓存/队列)  │    │  (图片/附件) │                  │
│  └──────────────┘    └──────────────┘    └──────────────┘                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.3 分包策略

根据微信小程序分包加载规范：

```typescript
// taro.config.ts
export default defineConfig({
  mini: {
    // 分包配置
    subpackages: [
      {
        root: 'packages/chat',
        name: 'chat',
        pages: ['index'],
      },
      {
        root: 'packages/formulas',
        name: 'formulas',
        pages: ['index', 'formula-detail'],
      },
      {
        root: 'packages/profile',
        name: 'profile',
        pages: ['index', 'settings'],
      },
      {
        root: 'packages/health-check',
        name: 'health-check',
        pages: ['index'],
        independent: true,  // 独立分包，独立下载
      },
    ],
    // 主包不超过2MB
    // 所有分包不超过20MB
  },
  h5: {
    devServer: { port: 3001 },
  },
})
```

---

## 二、项目结构

### 2.1 目录结构

```
miniprogram/
├── src/
│   ├── api/                          # 请求层
│   │   ├── request.ts                # wx.request封装（降级方案）
│   │   ├── stream.ts                 # fetch API流式请求（推荐）
│   │   ├── auth.ts                   # 认证API
│   │   ├── chat.ts                   # 对话API
│   │   ├── formula.ts                # 配方API
│   │   ├── search.ts                 # 搜索API
│   │   └── types.ts                  # API类型定义
│   │
│   ├── pages/                        # 小程序页面
│   │   ├── index/                    # 首页
│   │   │   ├── index.tsx
│   │   │   └── index.scss
│   │   ├── chat/                     # AI对话页（分包）
│   │   │   ├── index.tsx
│   │   │   └── components/
│   │   │       ├── MessageList.tsx
│   │   │       ├── ChatInput.tsx
│   │   │       └── TypingIndicator.tsx
│   │   ├── formulas/                 # 配方列表（分包）
│   │   │   ├── index.tsx
│   │   │   └── components/
│   │   │       └── FormulaCard.tsx
│   │   ├── formula-detail/           # 配方详情（分包）
│   │   │   ├── index.tsx
│   │   │   └── components/
│   │   │       ├── IngredientTable.tsx
│   │   │       └── MechanismText.tsx
│   │   ├── health-check/             # 体质诊断（独立分包）
│   │   │   ├── index.tsx
│   │   │   └── components/
│   │   │       ├── QuestionStep.tsx
│   │   │       └── ResultCard.tsx
│   │   ├── profile/                  # 个人中心（分包）
│   │   │   ├── index.tsx
│   │   │   └── components/
│   │   │       ├── HistoryList.tsx
│   │   │       └── FavoriteList.tsx
│   │   ├── search/                   # 搜索页
│   │   │   └── index.tsx
│   │   ├── compare/                  # 配方对比
│   │   │   └── index.tsx
│   │   ├── settings/                 # 设置页
│   │   │   └── index.tsx
│   │   ├── privacy/                  # 隐私政策（合规必需）
│   │   │   └── index.tsx
│   │   └── agreement/                # 用户协议（合规必需）
│   │       └── index.tsx
│   │
│   ├── components/                   # 通用组件库
│   │   ├── FormulaCard/              # 配方卡片
│   │   ├── ChatBubble/               # 对话气泡
│   │   ├── HamburgerMenu/            # 汉堡菜单（三条横杠）
│   │   ├── LoadingSkeleton/          # 骨架屏
│   │   ├── ErrorBoundary/            # 错误边界
│   │   ├── SafeArea/                 # 安全区域适配
│   │   ├── ImageLazyLoad/            # 图片懒加载
│   │   ├── Disclaimer/               # 免责声明组件
│   │   └── SharePoster/              # 分享海报组件
│   │
│   ├── stores/                       # Zustand状态管理
│   │   ├── storage.ts                # 自定义storage适配器
│   │   ├── auth.store.ts             # 认证状态
│   │   ├── chat.store.ts             # 对话状态
│   │   ├── formula.store.ts          # 配方状态
│   │   └── user.store.ts             # 用户状态
│   │
│   ├── hooks/                        # 自定义Hooks
│   │   ├── useAuth.ts                # 认证Hook
│   │   ├── useStreaming.ts           # 流式输出Hook
│   │   ├── useVoice.ts               # 语音输入Hook
│   │   └── useOffline.ts             # 离线同步Hook
│   │
│   ├── utils/
│   │   ├── crypto.ts                 # 加密工具
│   │   ├── cache.ts                  # 缓存管理
│   │   ├── format.ts                 # 格式化函数
│   │   ├── constants.ts              # 业务常量
│   │   └── performance.ts            # 性能监控
│   │
│   ├── types/
│   │   ├── api.types.ts              # API类型定义
│   │   ├── formula.types.ts          # 配方类型
│   │   └── chat.types.ts             # 对话类型
│   │
│   ├── app.config.ts                 # 小程序配置
│   ├── app.ts                        # 小程序入口
│   ├── app.scss                      # 全局样式
│   └── index.html                    # HTML入口
│
├── config/
│   ├── dev.ts                        # 开发环境配置
│   ├── prod.ts                       # 生产环境配置
│   └── index.ts                      # 配置合并
│
├── .github/
│   └── workflows/
│       └── miniprogram.yml           # CI/CD配置
│
├── package.json
├── tsconfig.json
├── babel.config.js
└── taro.config.ts                    # Taro编译配置
```

### 2.2 配置文件

#### app.config.ts（小程序配置）

```typescript
// src/app.config.ts
export default {
  pages: [
    'pages/index/index',
    'pages/chat/index',
    'pages/formulas/index',
    'pages/formula-detail/index',
    'pages/health-check/index',
    'pages/profile/index',
    'pages/search/index',
    'pages/compare/index',
    'pages/settings/index',
    'pages/privacy/index',
    'pages/agreement/index',
  ],
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#2D5A3D',
    navigationBarTitleText: 'RMFOOD药食同源配方平台',
    navigationBarTextStyle: 'white',
  },
  tabBar: {
    color: '#8B7355',
    selectedColor: '#2D5A3D',
    backgroundColor: '#FAF8F5',
    borderStyle: 'black',
    list: [
      {
        pagePath: 'pages/index/index',
        text: '首页',
        iconPath: 'assets/icons/home.png',
        selectedIconPath: 'assets/icons/home-active.png',
      },
      {
        pagePath: 'pages/formulas/index',
        text: '配方',
        iconPath: 'assets/icons/formula.png',
        selectedIconPath: 'assets/icons/formula-active.png',
      },
      {
        pagePath: 'pages/profile/index',
        text: '我的',
        iconPath: 'assets/icons/profile.png',
        selectedIconPath: 'assets/icons/profile-active.png',
      },
    ],
  },
  subpackages: [
    {
      root: 'packages/chat',
      name: 'chat',
      pages: ['index'],
    },
    {
      root: 'packages/formulas',
      name: 'formulas',
      pages: ['index', 'formula-detail'],
    },
    {
      root: 'packages/profile',
      name: 'profile',
      pages: ['index', 'settings'],
    },
  ],
  preloadRule: {
    'pages/index/index': {
      network: 'all',
      packages: ['chat', 'formulas'],
    },
  },
  permission: {
    'scope.record': {
      desc: '用于语音输入功能',
    },
  },
  requiredPrivateInfos: [
    'chooseAddress',  // 如需要收货地址
  ],
}
```

#### taro.config.ts（Taro编译配置）

```typescript
// taro.config.ts
import { defineConfig } from '@tarojs/cli'
import devConfig from './config/dev'
import prodConfig from './config/prod'

export default defineConfig(async (merge, { command, mode }) => {
  const baseConfig = {
    projectName: 'rmfood-miniprogram',
    date: '2026-09-05',
    designWidth: 750,
    deviceRatio: {
      640: 2.34 / 2,
      750: 1,
      375: 2,
      828: 1.81 / 2,
    },
    sourceRoot: 'src',
    outputRoot: 'dist',
    plugins: ['@tarojs/plugin-framework-react'],
    defineConstants: {},
    copy: {
      patterns: [],
      options: {},
    },
    framework: 'react',
    compiler: 'vite',
    mini: {
      postcss: {
        pxtransform: {
          enable: true,
          config: {
            selectorUnitName: 'rpx',
          },
        },
      },
      // 分包配置
      subpackages: [
        {
          root: 'packages/chat',
          name: 'chat',
          pages: ['index'],
        },
        {
          root: 'packages/formulas',
          name: 'formulas',
          pages: ['index', 'formula-detail'],
        },
        {
          root: 'packages/profile',
          name: 'profile',
          pages: ['index', 'settings'],
        },
      ],
      // 独立分包
      independentSubpackages: [
        {
          root: 'packages/health-check',
          name: 'health-check',
          pages: ['index'],
        },
      ],
      // 分包预下载
      preloadRule: {
        'pages/index/index': {
          network: 'all',
          packages: ['chat', 'formulas'],
        },
      },
    },
    h5: {
      devServer: {
        port: 3001,
        proxy: {
          '/api': {
            target: 'http://localhost:8000',
            changeOrigin: true,
          },
        },
      },
      router: {
        mode: 'hash',
      },
    },
  }

  if (command === 'build' && mode === 'development') {
    return merge(baseConfig, devConfig)
  }
  if (command === 'build' && mode === 'production') {
    return merge(baseConfig, prodConfig)
  }
  return baseConfig
})
```

---

## 三、核心功能实现

### 3.1 微信登录流程

#### 3.1.1 前端登录流程

```typescript
// src/hooks/useAuth.ts
import { useState, useCallback } from 'react'
import Taro from '@tarojs/taro'
import { authApi } from '@/api/auth'
import { useAuthStore } from '@/stores/auth.store'

export function useAuth() {
  const { login, logout, isAuthenticated } = useAuthStore()
  const [loading, setLoading] = useState(false)

  // 微信登录
  const wechatLogin = useCallback(async () => {
    setLoading(true)
    try {
      // Step 1: 获取微信临时code
      const loginRes = await Taro.login()
      const { code } = loginRes

      if (!code) {
        throw new Error('获取登录凭证失败')
      }

      // Step 2: 发送code到后端换取Token
      const tokenRes = await authApi.wechatLogin({ code })
      
      // Step 3: 存储Token
      await login(tokenRes.access_token, tokenRes.user)
      
      return { success: true, user: tokenRes.user }
    } catch (error) {
      console.error('微信登录失败:', error)
      throw error
    } finally {
      setLoading(false)
    }
  }, [login])

  // 退出登录
  const handleLogout = useCallback(async () => {
    await logout()
    Taro.reLaunch({ url: '/pages/index/index' })
  }, [logout])

  return {
    isAuthenticated,
    loading,
    wechatLogin,
    handleLogout,
  }
}
```

#### 3.1.2 后端登录接口

```python
# backend/app/api/wechat_auth.py
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
import httpx
from datetime import timedelta

router = APIRouter(prefix="/wechat", tags=["微信认证"])

class WechatLoginRequest(BaseModel):
    code: str  # wx.login()获取的临时码

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    expires_in: int
    user: UserResponse

@router.post("/login", response_model=TokenResponse)
async def wechat_login(req: WechatLoginRequest, db: AsyncSession = Depends(get_db_session)):
    """
    微信授权登录
    
    流程：
    1. 使用code换取openid和session_key
    2. 查询或创建用户
    3. 生成JWT Token
    """
    # Step 1: 调用微信接口换取openid
    wx_response = await httpx.AsyncClient().get(
        "https://api.weixin.qq.com/sns/jscode2session",
        params={
            "appid": settings.wechat.appid,
            "secret": settings.wechat.secret,
            "js_code": req.code,
            "grant_type": "authorization_code"
        }
    )
    
    wx_data = wx_response.json()
    
    # 检查微信接口返回
    if "errcode" in wx_data:
        raise HTTPException(
            status_code=400,
            detail=f"微信登录失败: {wx_data.get('errmsg')}"
        )
    
    openid = wx_data["openid"]
    session_key = wx_data.get("session_key")
    
    # Step 2: 查询或创建用户
    user = await get_or_create_user(db, openid, session_key)
    
    # Step 3: 生成JWT Token
    tokens = await generate_jwt_tokens(user)
    
    return TokenResponse(
        access_token=tokens.access_token,
        refresh_token=tokens.refresh_token,
        expires_in=tokens.expires_in,
        user=UserResponse.from_orm(user)
    )

@router.post("/bind", response_model=TokenResponse)
async def wechat_bind(req: WechatBindRequest, db: AsyncSession = Depends(get_db_session)):
    """绑定微信账号到已有用户"""
    # 实现绑定逻辑...
    pass
```

### 3.2 AI对话流式输出

#### 3.2.1 前端流式请求封装

```typescript
// src/api/stream.ts
/**
 * AI对话流式输出
 * 
 * 方案A：fetch API（基础库2.15.0+）
 * 方案B：轮询降级（基础库<2.15.0）
 */

export interface StreamCallbacks {
  onChunk: (chunk: string) => void      // 收到新片段
  onDone: (content: string) => void     // 流结束
  onError: (error: Error) => void       // 发生错误
}

/**
 * 检测是否支持fetch API
 */
function canUseFetch(): boolean {
  try {
    const systemInfo = Taro.getSystemInfoSync()
    const { SDKVersion } = systemInfo
    const [major, minor] = SDKVersion.split('.').map(Number)
    return major > 2 || (major === 2 && minor >= 15)
  } catch {
    return false
  }
}

/**
 * 方案A：使用fetch API进行流式输出（推荐）
 */
export async function streamChatWithFetch(
  question: string,
  callbacks: StreamCallbacks,
  token: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    const controller = new AbortController()
    
    fetch(`${API_BASE}/ai/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ 
        question, 
        stream: true,
        history: [],  // 可传入历史消息
      }),
      signal: controller.signal,
    })
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
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
                if (data.content) {
                  callbacks.onChunk(data.content)
                } else if (data.error) {
                  const error = new Error(data.message || '流式输出错误')
                  callbacks.onError(error)
                  controller.abort()
                  reject(error)
                  return
                }
              } catch (e) {
                // 忽略解析错误
              }
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

/**
 * 方案B：轮询降级方案（兼容旧版本）
 */
export async function streamChatWithPolling(
  question: string,
  callbacks: StreamCallbacks,
  token: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    // Step 1: 提交任务
    Taro.request({
      url: `${API_BASE}/ai/task`,
      method: 'POST',
      header: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      data: {
        task_type: 'ai_chat',
        payload: { question },
      },
      success: async (res) => {
        if (res.statusCode !== 200) {
          reject(new Error('提交任务失败'))
          return
        }
        
        const { task_id } = res.data
        
        // Step 2: 轮询结果
        const poll = async () => {
          try {
            const result = await Taro.request({
              url: `${API_BASE}/ai/task/${task_id}`,
              header: {
                'Authorization': `Bearer ${token}`,
              },
            })
            
            if (result.statusCode !== 200) {
              callbacks.onError(new Error('查询任务状态失败'))
              reject(new Error('查询任务状态失败'))
              return
            }
            
            const task = result.data
            
            if (task.status === 'success') {
              callbacks.onDone(task.result.content)
              resolve()
            } else if (task.status === 'failed') {
              callbacks.onError(new Error(task.error || '任务执行失败'))
              reject(new Error(task.error || '任务执行失败'))
            } else {
              // 继续轮询
              setTimeout(poll, 500)
            }
          } catch (error) {
            callbacks.onError(error as Error)
            reject(error)
          }
        }
        
        poll()
      },
      fail: (err) => {
        callbacks.onError(err as Error)
        reject(err)
      },
    })
  })
}

/**
 * 统一的流式输出入口
 */
export async function streamChat(
  question: string,
  callbacks: StreamCallbacks,
  token: string
): Promise<void> {
  if (canUseFetch()) {
    return streamChatWithFetch(question, callbacks, token)
  } else {
    return streamChatWithPolling(question, callbacks, token)
  }
}
```

#### 3.2.2 对话页实现

```typescript
// src/pages/chat/index.tsx
import { View, Text, ScrollView, Input } from '@tarojs/components'
import Taro, { useReady } from '@tarojs/taro'
import { useState, useRef, useCallback } from 'react'
import { useAuthStore } from '@/stores/auth.store'
import { streamChat } from '@/api/stream'
import { useChatStore } from '@/stores/chat.store'
import ChatBubble from '@/components/ChatBubble'
import TypingIndicator from '@/components/TypingIndicator'
import Disclaimer from '@/components/Disclaimer'

export default function ChatPage() {
  const [messages, setMessages] = useState<Array<{role: string; content: string}>>([])
  const [inputValue, setInputValue] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [currentContent, setCurrentContent] = useState('')
  
  const { isAuthenticated, token } = useAuthStore()
  const { addMessage } = useChatStore()
  const scrollViewRef = useRef<any>(null)

  // 发送消息
  const handleSend = useCallback(async () => {
    if (!inputValue.trim() || isStreaming) return
    
    if (!isAuthenticated) {
      Taro.navigateTo({ url: '/pages/login/index' })
      return
    }
    
    const question = inputValue.trim()
    setInputValue('')
    
    // 添加用户消息
    setMessages(prev => [...prev, { role: 'user', content: question }])
    
    // 开始流式输出
    setIsStreaming(true)
    setCurrentContent('')
    
    try {
      await streamChat(
        question,
        {
          onChunk: (chunk) => {
            setCurrentContent(prev => prev + chunk)
          },
          onDone: (content) => {
            setMessages(prev => [...prev, { role: 'assistant', content }])
            addMessage({ question, answer: content })
            setIsStreaming(false)
            setCurrentContent('')
          },
          onError: (error) => {
            Taro.showToast({ title: '请求失败，请重试', icon: 'none' })
            setIsStreaming(false)
            setCurrentContent('')
          },
        },
        token!
      )
    } catch (error) {
      console.error('流式输出失败:', error)
      setIsStreaming(false)
    }
  }, [inputValue, isStreaming, isAuthenticated, token, addMessage])

  // 自动滚动到底部
  useReady(() => {
    setTimeout(() => {
      scrollViewRef.current?.scrollTo({ top: 9999 })
    }, 100)
  })

  return (
    <View className='chat-page'>
      {/* 消息列表 */}
      <ScrollView
        ref={scrollViewRef}
        scroll-y
        className='chat-messages'
        scroll-into-view={isStreaming ? 'typing-indicator' : undefined}
      >
        {messages.map((msg, index) => (
          <ChatBubble
            key={index}
            role={msg.role}
            content={msg.content}
          />
        ))}
        
        {/* 打字机指示器 */}
        {isStreaming && (
          <View id='typing-indicator'>
            <TypingIndicator />
            <ChatBubble role='assistant' content={currentContent} />
          </View>
        )}
        
        {/* 免责声明 */}
        <Disclaimer />
      </ScrollView>
      
      {/* 输入区域 */}
      <View className='chat-input'>
        <Input
          value={inputValue}
          onInput={(e) => setInputValue(e.detail.value)}
          onConfirm={handleSend}
          placeholder='请输入你的问题...'
          disabled={isStreaming}
        />
        <View className='send-btn' onClick={handleSend}>
          <Text>发送</Text>
        </View>
      </View>
    </View>
  )
}
```

### 3.3 状态管理（Zustand + 持久化）

```typescript
// src/stores/storage.ts
import Taro from '@tarojs/taro'
import { createJSONStorage } from 'zustand/middleware'

/**
 * 自定义Taro Storage适配器
 * 支持加密存储敏感数据
 */
export function createTaroStorage(prefix: string = 'rmfood', encrypt: boolean = false) {
  const encryptKey = 'your-encryption-key-here' // 实际应从环境变量获取
  
  const encryptValue = (value: string): string => {
    if (!encrypt) return value
    // 简单Base64编码（实际应使用AES加密）
    return btoa(value)
  }
  
  const decryptValue = (value: string): string => {
    if (!encrypt) return value
    return atob(value)
  }
  
  return {
    getItem: (name: string): string | null => {
      try {
        const key = `${prefix}_${name}`
        const value = Taro.getStorageSync(key)
        if (value === undefined || value === null) return null
        return decryptValue(typeof value === 'string' ? value : JSON.stringify(value))
      } catch (e) {
        console.warn('Storage getItem failed:', e)
        return null
      }
    },
    
    setItem: (name: string, value: string): void => {
      try {
        const key = `${prefix}_${name}`
        Taro.setStorageSync(key, encrypt ? encryptValue(value) : value)
      } catch (e) {
        console.warn('Storage setItem failed:', e)
      }
    },
    
    removeItem: (name: string): void => {
      try {
        const key = `${prefix}_${name}`
        Taro.removeStorageSync(key)
      } catch (e) {
        console.warn('Storage removeItem failed:', e)
      }
    },
  }
}

// 创建存储实例
export const authStorage = createTaroStorage('rmfood_auth', true)  // 加密存储Token
export const dataStorage = createTaroStorage('rmfood_data', false) // 普通数据存储

// 导出createJSONStorage适配器
export const createTaroJSONStorage = (prefix: string, encrypt: boolean = false) => {
  return createJSONStorage(() => createTaroStorage(prefix, encrypt))
}
```

```typescript
// src/stores/auth.store.ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { createTaroJSONStorage } from './storage'

interface UserInfo {
  id: number
  openid: string
  nickname: string
  avatar_url: string
  // ...
}

interface AuthState {
  token: string | null
  refreshToken: string | null
  user: UserInfo | null
  isAuthenticated: boolean
  
  login: (token: string, user: UserInfo) => Promise<void>
  logout: () => Promise<void>
  refreshToken: () => Promise<void>
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      refreshToken: null,
      user: null,
      isAuthenticated: false,
      
      login: async (token, user) => {
        set({ token, user, isAuthenticated: true })
        // 保存到本地存储（加密）
        await Taro.setStorageSync('access_token', token)
        await Taro.setStorageSync('user_info', JSON.stringify(user))
      },
      
      logout: async () => {
        set({ token: null, user: null, isAuthenticated: false })
        await Taro.removeStorageSync('access_token')
        await Taro.removeStorageSync('user_info')
      },
      
      refreshToken: async () => {
        const currentRefreshToken = get().refreshToken
        if (!currentRefreshToken) {
          throw new Error('No refresh token')
        }
        
        // 调用后端刷新接口
        const response = await fetch('/api/v1/auth/refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: currentRefreshToken }),
        })
        
        if (!response.ok) {
          throw new Error('Refresh failed')
        }
        
        const data = await response.json()
        set({ 
          token: data.access_token,
          refreshToken: data.refresh_token,
        })
      },
    }),
    {
      name: 'auth-storage',
      storage: createTaroJSONStorage('rmfood_auth', true),
      partialize: (state) => ({ 
        token: state.token,
        refreshToken: state.refreshToken,
        user: state.user,
      }),
    }
  )
)
```

### 3.4 隐私合规实现

```typescript
// src/app.ts（小程序入口）
import Taro from '@tarojs/taro'
import { useState, useEffect } from 'react'

function App({ children }) {
  const [showPrivacyModal, setShowPrivacyModal] = useState(false)

  useEffect(() => {
    checkPrivacyAgreement()
  }, [])

  async function checkPrivacyAgreement() {
    const accepted = Taro.getStorageSync('privacy_accepted')
    if (!accepted) {
      setShowPrivacyModal(true)
    }
  }

  async function handlePrivacyAccept() {
    Taro.setStorageSync('privacy_accepted', true)
    setShowPrivacyModal(false)
    // 跳转到隐私政策页面
    Taro.navigateTo({ url: '/pages/privacy/index' })
  }

  return (
    <>
      {children}
      
      {/* 隐私政策弹窗 */}
      {showPrivacyModal && (
        <View className='privacy-modal'>
          <View className='modal-content'>
            <Text className='modal-title'>隐私政策声明</Text>
            <Text className='modal-text'>
              本小程序将收集您的健康相关数据（如症状、体质信息），
              用于提供个性化配方建议。您的数据仅存储在本地和加密服务器中，
              不会分享给第三方。
            </Text>
            <Text className='modal-text'>
              继续使用前请阅读并同意《隐私政策》和《用户协议》。
            </Text>
            <View className='modal-buttons'>
              <Button 
                className='btn-cancel'
                onClick={() => Taro.exitMiniProgram()}
              >
                退出
              </Button>
              <Button 
                className='btn-confirm'
                onClick={handlePrivacyAccept}
              >
                同意并继续
              </Button>
            </View>
          </View>
        </View>
      )}
    </>
  )
}
```

```tsx
// src/components/Disclaimer/index.tsx
import { View, Text } from '@tarojs/components'
import './index.scss'

export default function Disclaimer() {
  return (
    <View className='disclaimer'>
      <Text className='disclaimer-icon'>⚠️</Text>
      <Text className='disclaimer-text'>
        本平台提供的配方建议仅供参考，不能替代专业医疗诊断和治疗。
        如有健康问题，请及时就医。孕妇、哺乳期妇女及慢性病患者在使用前请咨询医生。
      </Text>
    </View>
  )
}
```

---

## 四、性能优化策略

### 4.1 启动性能优化

| 优化项 | 方案 | 预期效果 |
|--------|------|---------|
| 分包加载 | 按模块拆分，按需下载 | 首屏加载时间减少50% |
| 分包预下载 | 首页预下载常用分包 | 二级页面秒开 |
| 资源压缩 | 图片WebP化，代码压缩 | 包体积减少30% |
| 骨架屏 | 首屏占位 | 感知加载时间缩短 |

### 4.2 运行时性能优化

```typescript
// 图片懒加载
<Image 
  src={imageUrl} 
  mode='aspectFill'
  lazy-load  // 开启懒加载
/>

// 列表虚拟滚动（长列表优化）
<RecycleListView
  dataList={formulas}
  renderRow={(row, index, sectionIndex) => (
    <FormulaCard formula={row} />
  )}
  rowHeight={200}
/>

// 防抖搜索
const searchDebounce = debounce((keyword) => {
  handleSearch(keyword)
}, 300)
```

### 4.3 网络优化

```typescript
// src/utils/cache.ts
import Taro from '@tarojs/taro'

class CacheManager {
  private static instance: CacheManager
  private cache: Map<string, { data: any; timestamp: number }>
  
  private constructor() {
    this.cache = new Map()
  }
  
  static getInstance(): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager()
    }
    return CacheManager.instance
  }
  
  // 获取缓存
  get<T>(key: string, ttl: number = 60000): T | null {
    const item = this.cache.get(key)
    if (!item) return null
    
    if (Date.now() - item.timestamp > ttl) {
      this.cache.delete(key)
      return null
    }
    
    return item.data as T
  }
  
  // 设置缓存
  set<T>(key: string, data: T, ttl: number = 60000): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    })
    
    // 同步到本地存储（备份）
    try {
      Taro.setStorageSync(`cache_${key}`, JSON.stringify({ data, timestamp: Date.now() }))
    } catch (e) {
      console.warn('Cache sync failed:', e)
    }
  }
  
  // 清除缓存
  clear(key: string): void {
    this.cache.delete(key)
    Taro.removeStorageSync(`cache_${key}`)
  }
  
  // 批量获取
  async batchGet<T>(requests: Array<{ key: string; fetcher: () => Promise<T> }>): Promise<Map<string, T>> {
    const results = new Map<string, T>()
    
    for (const { key, fetcher } of requests) {
      const cached = this.get<T>(key)
      if (cached) {
        results.set(key, cached)
        continue
      }
      
      try {
        const data = await fetcher()
        this.set(key, data)
        results.set(key, data)
      } catch (e) {
        console.error(`Failed to fetch ${key}:`, e)
      }
    }
    
    return results
  }
}

export const cacheManager = CacheManager.getInstance()
```

---

## 五、安全设计

### 5.1 Token管理

```typescript
// src/utils/crypto.ts
import Taro from '@tarojs/taro'
import CryptoJS from 'crypto-js'

const ENCRYPTION_KEY = 'rmfood-miniprogram-key-2026'  // 实际应从环境变量获取

export class TokenManager {
  // 加密存储Token
  static async setToken(token: string): Promise<void> {
    const encrypted = CryptoJS.AES.encrypt(token, ENCRYPTION_KEY).toString()
    await Taro.setStorageSync('token_enc', encrypted)
  }
  
  // 解密读取Token
  static async getToken(): Promise<string | null> {
    try {
      const encrypted = Taro.getStorageSync('token_enc')
      if (!encrypted) return null
      
      const decrypted = CryptoJS.AES.decrypt(encrypted, ENCRYPTION_KEY)
      return decrypted.toString(CryptoJS.enc.Utf8)
    } catch (e) {
      console.warn('Token decryption failed:', e)
      return null
    }
  }
  
  // 清除Token
  static async clearToken(): Promise<void> {
    await Taro.removeStorageSync('token_enc')
  }
  
  // 检查Token是否有效
  static async isValid(): Promise<boolean> {
    const token = await this.getToken()
    if (!token) return false
    
    try {
      // 解码JWT检查过期时间
      const payload = JSON.parse(atob(token.split('.')[1]))
      return payload.exp > Date.now() / 1000
    } catch {
      return false
    }
  }
}
```

### 5.2 请求安全

```typescript
// src/api/request.ts
import Taro from '@tarojs/taro'
import { TokenManager } from '@/utils/crypto'
import { useAuthStore } from '@/stores/auth.store'

const API_BASE = process.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1'

class RequestManager {
  private static instance: RequestManager
  private refreshing: boolean = false
  private waitQueue: Array<(token: string) => void> = []

  static getInstance(): RequestManager {
    if (!RequestManager.instance) {
      RequestManager.instance = new RequestManager()
    }
    return RequestManager.instance
  }

  // 发起请求
  async request<T>(options: Taro.request.Option): Promise<T> {
    // 注入Token
    const token = await TokenManager.getToken()
    if (token) {
      options.header = {
        ...options.header,
        'Authorization': `Bearer ${token}`,
      }
    }

    try {
      const response = await Taro.request(options)
      
      if (response.statusCode === 401) {
        // Token失效，尝试刷新
        return this.handle401(options)
      }
      
      return response.data as T
    } catch (error) {
      console.error('Request failed:', error)
      throw error
    }
  }

  // 处理401
  private async handle401<T>(options: Taro.request.Option): Promise<T> {
    const { refreshToken } = useAuthStore.getState()
    
    if (!refreshToken || this.refreshing) {
      // 跳转到登录页
      Taro.redirectTo({ url: '/pages/login/index' })
      throw new Error('Unauthorized')
    }

    if (this.refreshing) {
      // 等待刷新完成
      return new Promise((resolve, reject) => {
        this.waitQueue.push((newToken) => {
          options.header['Authorization'] = `Bearer ${newToken}`
          this.request<T>(options).then(resolve).catch(reject)
        })
      })
    }

    this.refreshing = true
    
    try {
      // 调用刷新接口
      const response = await Taro.request({
        url: `${API_BASE}/auth/refresh`,
        method: 'POST',
        data: { refresh_token: refreshToken },
      })
      
      const { access_token, refresh_token: newRefreshToken } = response.data
      
      // 更新Token
      await TokenManager.setToken(access_token)
      useAuthStore.getState().updateTokens(access_token, newRefreshToken)
      
      // 重试原请求
      options.header['Authorization'] = `Bearer ${access_token}`
      
      // 处理等待队列
      this.waitQueue.forEach(callback => callback(access_token))
      this.waitQueue = []
      
      return this.request<T>(options)
    } catch (error) {
      this.waitQueue.forEach(callback => callback(''))
      this.waitQueue = []
      Taro.redirectTo({ url: '/pages/login/index' })
      throw error
    } finally {
      this.refreshing = false
    }
  }
}

export const requestManager = RequestManager.getInstance()
```

---

## 六、开发计划

### 6.1 里程碑计划

| 里程碑 | 完成时间 | 验收标准 |
|--------|---------|---------|
| M1: 项目启动 | 第1天 | Taro项目初始化，CI/CD配置完成 |
| M2: 基建完成 | 第7天 | 请求层、状态管理、路由配置完成 |
| M3: 认证打通 | 第10天 | 微信登录+账号绑定流程跑通 |
| M4: AI对话 | 第17天 | 流式SSE输出+打字机效果完成 |
| M5: 核心功能 | 第24天 | 配方浏览+详情+收藏功能可用 |
| M6: 功能完善 | 第35天 | 体质诊断+RAG+对比功能完成 |
| M7: 性能优化 | 第42天 | 包体积<2MB，首屏<2s |
| M8: 上线发布 | 第49天 | 微信审核通过，正式上线 |

### 6.2 周计划

#### 第1周：基建搭建
- [ ] 初始化Taro项目
- [ ] 配置分包结构
- [ ] 实现请求层（fetch + wx.request双策略）
- [ ] 实现Zustand状态管理+持久化
- [ ] 实现Token加密存储
- [ ] 后端微信登录接口开发

#### 第2周：核心功能
- [ ] AI对话页开发
- [ ] 流式输出+打字机效果
- [ ] 配方列表页开发
- [ ] 配方详情页开发
- [ ] 个人中心页开发

#### 第3周：功能完善
- [ ] 体质诊断问卷开发
- [ ] RAG知识库问答
- [ ] 配方对比功能
- [ ] 搜索功能
- [ ] 收藏/分享功能

#### 第4周：合规与安全
- [ ] 隐私政策页面
- [ ] 用户协议页面
- [ ] 首次启动隐私弹窗
- [ ] 健康免责声明组件
- [ ] 安全审查

#### 第5周：性能优化
- [ ] 分包预下载配置
- [ ] 图片懒加载优化
- [ ] 列表虚拟滚动
- [ ] 包体积分析优化
- [ ] 首屏加载优化

#### 第6-7周：测试与调试
- [ ] 单元测试
- [ ] E2E测试
- [ ] 真机测试（iOS/Android）
- [ ] 弱网测试
- [ ] 性能测试

#### 第8周：审核与发布
- [ ] 提交微信审核
- [ ] 修复审核问题
- [ ] 正式上线
- [ ] 监控部署

---

## 七、预算估算

### 7.1 开发成本

| 项目 | 预算 | 说明 |
|------|------|------|
| 人力成本 | ¥50,000 | 2人×10周（前端+后端） |
| 云服务 | ¥3,000/年 | 服务器+数据库+CDN |
| 微信认证 | ¥300/年 | 企业主体认证 |
| 域名+SSL | ¥500/年 | HTTPS required |
| 云开发（可选） | ¥2,000/年 | 云函数+云数据库 |
| **总计** | **¥56,000** | 首年 |

### 7.2 运营成本

| 项目 | 预算 | 说明 |
|------|------|------|
| AI API调用 | ¥2,000/月 | 按量计费 |
| 服务器维护 | ¥500/月 | 日常运维 |
| 审核续费 | ¥300/年 | 企业认证年费 |
| **月度运营** | **¥2,500** | |

---

## 八、合规要求清单

### 8.1 微信小程序审核要求

| 项目 | 要求 | 状态 | 负责人 |
|------|------|------|--------|
| 隐私政策 | 必须有独立页面 | ⚠️ 需开发 | 前端 |
| 用户协议 | 必须有独立页面 | ⚠️ 需开发 | 前端 |
| 首次启动弹窗 | 明示收集信息用途 | ⚠️ 需开发 | 前端 |
| 健康类资质 | 如涉及医疗需资质 | ⚠️ 提前准备 | 产品 |
| 免责声明 | AI建议需标注仅供参考 | ⚠️ 需开发 | 前端 |
| 用户授权 | 敏感权限需明示授权 | ✅ 已设计 | 前端 |

### 8.2 必要页面

```
/pages/privacy/index     # 隐私政策
/pages/agreement/index   # 用户协议
/pages/disclaimer/index  # 免责声明（可选，可合并到隐私页）
```

### 8.3 审核材料准备

1. **企业资质**：营业执照、法人身份证
2. **产品资质**：食品经营许可证（如涉及）
3. **隐私政策**：完整的隐私政策文档
4. **用户协议**：完整的用户协议文档
5. **免责声明**：AI建议仅供参考的声明

---

## 九、总结

### 9.1 方案可行性结论

✅ **技术可行**：后端SSE端点完整，前端fetch API消费正确

✅ **架构合理**：Taro跨端框架，分包加载，状态管理规范

✅ **合规完善**：隐私政策、免责声明、健康数据保护齐全

✅ **性能达标**：分包预下载、图片懒加载、缓存策略完整

✅ **预算可控**：首年¥56,000，月运营成本¥2,500

### 9.2 下一步行动

1. **立即行动**
   - [x] 确认V5.0方案
   - [ ] 申请微信小程序账号
   - [ ] 配置微信开发者工具
   - [ ] 初始化Taro项目脚手架

2. **第1周行动**
   - [ ] 搭建项目结构
   - [ ] 实现请求层和流式输出
   - [ ] 开发微信登录接口（后端）
   - [ ] 设计隐私政策页面

3. **后续行动**
   - [ ] 按里程碑计划推进开发
   - [ ] 每周进行代码评审
   - [ ] 及时修复问题和优化性能
   - [ ] 按时提交微信审核

---

**结论：V5.0方案完整可行，建议按此方案启动开发。**

---

*文档版本：V5.0 | 编制：RMFOOD架构组 | 日期：2026-09-05*
