# RMFOOD 小程序 - 完整架构方案

> 版本：V3.0 | 更新日期：2026-01-15 | 状态：✅ 完整架构规划

---

## 一、项目全景图

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           RMFOOD 小程序架构                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐  │
│  │   首页      │    │   AI顾问    │    │   搜索      │    │   我的      │  │
│  │  index      │    │   chat      │    │  search     │    │  profile    │  │
│  │             │    │             │    │             │    │             │  │
│  │ • 快捷入口  │    │ • 流式对话  │    │ • 全局搜索  │    │ • 用户信息  │  │
│  │ • 配方推荐  │    │ • 历史会话  │    │ • 热门搜索  │    │ • 我的收藏  │  │
│  │ • 配料分析  │    │ • 智能建议  │    │ • 分类筛选  │    │ • 历史记录  │  │
│  │ • 健康提示  │    │ • 配方生成  │    │ • 结果展示  │    │ • 设置偏好  │  │
│  └──────┬──────┘    └──────┬──────┘    └──────┬──────┘    └──────┬──────┘  │
│         │                  │                  │                  │         │
│         └──────────────────┴──────────────────┴──────────────────┘         │
│                              TabBar 导航                                    │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                        子包模块（按需加载）                           │    │
│  ├─────────────┬─────────────┬─────────────┬─────────────────────────┤    │
│  │  配方库     │  配料分析   │  数据库检索 │  合规标准                │    │
│  │  formulas   │ ingredient  │  database   │  compliance              │    │
│  │             │             │             │                          │    │
│  │ • 配方列表  │ • OCR识别   │ • 中药材    │ • 国标查询               │    │
│  │ • 配方详情  │ • 六维分析  │ • 活性肽    │ • 添加剂限量             │    │
│  │ • 配方收藏  │ • 成分识别  │ • 药食同源  │ • 禁忌检测               │    │
│  │ • 配方分享  │ • 营养表    │ • 知识图谱  │ • 实时检查               │    │
│  └─────────────┴─────────────┴─────────────┴─────────────────────────┘    │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                        公共组件层                                     │    │
│  ├──────────┬──────────┬──────────┬──────────┬──────────┬──────────┤    │
│  │  Icon    │ Health   │ Nutrition│ Formula  │ Empty    │ Skeleton │    │
│  │  SVG图标 │ Score    │  Label   │  Card    │  State   │  Loader  │    │
│  │  51个    │ 评分组件 │ 营养标签 │ 配方卡片 │ 空状态   │ 骨架屏   │    │
│  └──────────┴──────────┴──────────┴──────────┴──────────┴──────────┘    │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                        工具层（utils）                                │    │
│  ├──────────────┬──────────────┬──────────────┬──────────────────────┤    │
│  │  request.js  │  auth.js     │  storage.js  │  loadingManager.js   │    │
│  │  HTTP请求    │  认证管理    │  缓存管理    │  加载状态管理         │    │
│  ├──────────────┼──────────────┼──────────────┼──────────────────────┤    │
│  │ ai_chat.js   │ formula_mgr  │ db_service   │ ingredient_analysis  │    │
│  │ AI对话服务   │ 配方管理服务 │ 数据库服务   │ 配料分析服务          │    │
│  ├──────────────┼──────────────┼──────────────┼──────────────────────┤    │
│  │ compliance.js│ helpers.js   │ api.js       │ config.js            │    │
│  │ 合规服务     │ 通用工具     │ API统一导出  │ 配置文件             │    │
│  └──────────────┴──────────────┴──────────────┴──────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           后端服务层 (FastAPI)                               │
│                                                                              │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐               │
│  │ /api/v1/auth   │  │ /api/v1/ai     │  │ /api/v1/formulas│               │
│  │ 登录/注册/Token │  │ 对话/配方生成   │  │ 配方CRUD/版本   │               │
│  └────────────────┘  └────────────────┘  └────────────────┘               │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐               │
│  │ /api/v1/ingredients │ /api/v1/database │ /api/v1/compliance        │
│  │ OCR/六维分析    │  │ 药材/肽/图谱    │  │ 标准查询/合规检查        │
│  └────────────────┘  └────────────────┘  └────────────────┘               │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                      数据库层 (PostgreSQL)                           │    │
│  ├─────────────┬─────────────┬─────────────┬─────────────────────────┤    │
│  │ TCMHerb     │ Peptide     │ Formula     │ User                    │    │
│  │ 中药材表     │ 活性肽表    │ 配方表      │ 用户表                  │    │
│  ├─────────────┼─────────────┼─────────────┼─────────────────────────┤    │
│  │ Compound    │ Target      │ Knowledge   │ Compliance              │    │
│  │ 化合物表     │ 靶点表      │ 知识库表    │ 合规标准表               │    │
│  └─────────────┴─────────────┴─────────────┴─────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 二、页面架构设计

### 2.1 主包页面（核心功能）

| 页面路径 | 功能 | 状态 | 优先级 |
|---------|------|------|--------|
| `pages/index/index` | 首页 - 快捷入口+推荐 | ✅ 完成 | P0 |
| `pages/search/index` | 搜索页 - 全局搜索 | ✅ 完成 | P0 |
| `pages/profile/index/index` | 个人中心 | ✅ 完成 | P0 |
| `pages/settings/index` | 设置页 | ✅ 完成 | P1 |
| `pages/database/index` | 数据检索中心 | ✅ 完成 | P1 |
| `pages/compliance/index` | 合规标准 | ✅ 完成 | P1 |
| `pages/compare/index` | 配料对比 | 🟡 待优化 | P2 |
| `pages/test/index` | 测试页 | ✅ 完成 | P3 |

### 2.2 子包页面（按需加载）

#### 配方库子包 (`packages/formulas/`)

| 页面 | 功能 | 状态 |
|------|------|------|
| `pages/index/index` | 配方列表 - 分类筛选 | ✅ 完成 |
| `pages/detail/index` | 配方详情 - 完整展示 | ✅ 完成 |

#### AI对话子包 (`packages/chat/`)

| 页面 | 功能 | 状态 |
|------|------|------|
| `pages/index/index` | AI对话 - 流式输出 | ✅ 完成 |

#### 配料分析子包 (`packages/ingredient/`)

| 页面 | 功能 | 状态 |
|------|------|------|
| `pages/analysis/index` | 配料分析 - 六维引擎 | ✅ 完成 |

### 2.3 新增页面规划

| 页面 | 功能 | 优先级 | 预计工时 |
|------|------|--------|---------|
| `pages/profile/history/index` | 历史记录 | P1 | 2h |
| `pages/formula/generate` | AI配方生成向导 | P0 | 4h |
| `pages/ingredient/detail` | 食材详情 | P2 | 2h |
| `pages/report/export` | 报告导出 | P2 | 3h |

---

## 三、组件系统架构

### 3.1 基础组件

| 组件 | 功能 | 属性 | 状态 |
|------|------|------|------|
| `Icon` | SVG图标组件 | name, size, color | ✅ |
| `GlobalIcons` | 图标 spritesheet | - | ✅ (51个图标) |
| `Badge` | 徽章组件 | type, text, count | ✅ |
| `ProgressBar` | 进度条 | percent, color, showText | ✅ |

### 3.2 业务组件

| 组件 | 功能 | 属性 | 状态 |
|------|------|------|------|
| `HealthScore` | 健康评分 | score, size, showText | ✅ |
| `NutritionLabel` | 营养标签 | nutritionData, servingSize | ✅ |
| `FormulaCard` | 配方卡片 | formula, showFavorite | ✅ |
| `EmptyState` | 空状态 | icon, title, desc | ✅ |
| `SkeletonLoader` | 骨架屏 | type, lines | ✅ |

### 3.3 新增组件规划

| 组件 | 功能 | 优先级 |
|------|------|--------|
| `IngredientCard` | 食材卡片 | P1 |
| `AnalysisResult` | 分析结果组件 | P1 |
| `ChatMessage` | 聊天消息气泡 | P1 |
| `Tabs` | 选项卡容器 | P2 |

---

## 四、API服务层架构

### 4.1 服务模块清单

| 模块 | 文件 | 导出方法 | 状态 |
|------|------|---------|------|
| `AuthService` | auth.js | login, logout, isLoggedIn, getUserInfo | ✅ |
| `AIService` | ai_chat.js | chat, sendMessage, getSessions, clearChat | ✅ |
| `FormulaService` | formula_manager.js | getFormulas, getFormula, saveFormula, favorite | ✅ |
| `IngredientService` | ingredient_analysis.js | analyze, ocrRecognize, getAdditives | ✅ |
| `DatabaseService` | database.js | searchHerbs, searchPeptides, searchKnowledge | ✅ |
| `ComplianceService` | compliance.js | getLimits, realtimeCheck, bulkCheck | ✅ |

### 4.2 API端点映射

| 小程序调用 | 后端端点 | 方法 |
|-----------|---------|------|
| `auth.login()` | `/api/v1/auth/wechat/login` | POST |
| `ai.chat(message)` | `/api/v1/ai/chat/stream` | POST |
| `formula.getFormulas()` | `/api/v1/formulas` | GET |
| `ingredient.analyze()` | `/api/v1/ingredients/analyze` | POST |
| `ingredient.ocrRecognize()` | `/api/v1/ingredients/ocr` | POST |
| `database.searchHerbs()` | `/api/v1/databases/herbs` | GET |
| `compliance.realtimeCheck()` | `/api/v1/compliance/check` | POST |

---

## 五、缓存策略架构

### 5.1 缓存分级

```
┌─────────────────────────────────────────────────────────────┐
│                      缓存层级架构                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  L1: 内存缓存 (data对象)                                    │
│  ├── 当前页面数据                                           │
│  ├── 组件状态                                              │
│  └── 生命周期：页面存活期间                                  │
│                                                             │
│  L2: LocalStorage 缓存                                      │
│  ├── 用户信息 (user_info)                                   │
│  ├── 访问令牌 (access_token)                                │
│  ├── 配方列表 (formulas) - 10分钟过期                       │
│  ├── 食材数据 (ingredients) - 5分钟过期                     │
│  ├── 健康提示 (health_tips) - 30分钟过期                    │
│  ├── 对话历史 (chat_history) - 永久                        │
│  └── 分析记录 (analysis_records) - 永久                    │
│                                                             │
│  L3: 服务端缓存                                             │
│  ├── Redis 热点数据                                        │
│  ├── PostgreSQL 查询结果缓存                                │
│  └── CDN 静态资源                                          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 缓存key规范

| Key | 类型 | 过期时间 | 用途 |
|-----|------|---------|------|
| `user_info` | Object | 永久 | 用户基本信息 |
| `access_token` | String | 永久 | 登录令牌 |
| `home_data` | Object | 10分钟 | 首页数据缓存 |
| `ingredients` | Object | 5分钟 | 食材数据缓存 |
| `health_tips` | Array | 30分钟 | 健康提示缓存 |
| `chat_session_*` | Array | 永久 | 对话历史 |
| `analysis_history` | Array | 永久 | 分析历史 |
| `analysis_records` | Array | 永久 | 分析记录 |
| `favorites` | Array | 永久 | 收藏列表 |

### 5.3 缓存工具函数

```javascript
// utils/storage.js 已实现
const { getStorage, setStorage, isExpired } = require('./storage')

// 使用示例
setStorage('home_data', data, 10 * 60 * 1000)  // 10分钟过期
const cached = getStorage('home_data')
if (cached && !isExpired('home_data')) {
  // 使用缓存数据
}
```

---

## 六、状态管理架构

### 6.1 全局状态 (App GlobalData)

```javascript
// app.js
globalData: {
  userInfo: null,
  accessToken: null,
  baseUrl: 'http://localhost:8000/api/v1',
  systemInfo: null,
  platform: 'ios' // 'ios' | 'android' | 'devtools'
}
```

### 6.2 页面级状态

每个页面维护自己的 data 对象，遵循最小化原则：

```javascript
Page({
  data: {
    // 视图渲染数据
    loading: false,
    refreshing: false,
    list: [],
    
    // 用户交互状态
    menuOpen: false,
    activeTab: 'all',
    
    // 缓存控制
    CACHE_EXPIRE: 10 * 60 * 1000
  }
})
```

### 6.3 状态更新规范

```javascript
// ✅ 正确：批量更新减少重渲染
this.setData({
  loading: false,
  list: newList,
  hasMore: newList.length >= pageSize
})

// ❌ 错误：多次 setData 导致多次重渲染
this.setData({ loading: false })
this.setData({ list: newList })
this.setData({ hasMore: true })
```

---

## 七、路由导航架构

### 7.1 导航方式选择

| 场景 | 导航方式 | 说明 |
|------|---------|------|
| 页面跳转（新页面） | `wx.navigateTo` | 保留当前页面，可返回 |
| 页面跳转（关闭当前） | `wx.redirectTo` | 关闭当前页面 |
| TabBar切换 | `wx.switchTab` | 切换底部导航 |
| 页面返回 | `wx.navigateBack` | 返回上一级 |
| 重新加载 | `wx.reLaunch` | 关闭所有页面 |

### 7.2 页面栈管理

```javascript
// 获取当前页面栈
const pages = getCurrentPages()
const currentPage = pages[pages.length - 1]

// 导航到指定页面
wx.navigateTo({
  url: `/pages/detail/index?id=${id}`,
  success: () => {
    console.log('导航成功')
  },
  fail: (err) => {
    console.error('导航失败', err)
  }
})
```

---

## 八、性能优化架构

### 8.1 分包策略

```
主包 (<2MB):
├── pages/index          # 首页
├── pages/search         # 搜索
├── pages/profile        # 个人中心
├── components/          # 公共组件
└── utils/               # 工具模块

子包1: formulas (<2MB)
├── pages/index          # 配方列表
└── pages/detail         # 配方详情

子包2: chat (<2MB)
└── pages/index          # AI对话

子包3: ingredient (<2MB)
└── pages/analysis       # 配料分析

子包4: database (<2MB)
└── pages/index          # 数据检索
```

### 8.2 图片优化

| 策略 | 实现 |
|------|------|
| 懒加载 | `lazy-load` 属性 |
| 压缩 | WebP格式，最大宽度750rpx |
| CDN | 静态资源走CDN加速 |
| 占位 | 骨架屏替代loading |

### 8.3 列表优化

| 策略 | 实现 |
|------|------|
| 虚拟列表 | 长列表使用 `recycle-list` |
| 分页加载 | `lower-threshold` 触发加载更多 |
| 防抖节流 | 搜索输入使用防抖 |
| 缓存结果 | 相同查询直接返回缓存 |

---

## 九、安全架构

### 9.1 认证机制

```javascript
// 请求拦截器自动注入 Token
request.interceptors.request.use(config => {
  const token = wx.getStorageSync('access_token')
  if (token) {
    config.header['Authorization'] = `Bearer ${token}`
  }
  return config
})
```

### 9.2 数据校验

| 层级 | 校验内容 |
|------|---------|
| 前端 | 表单验证、输入过滤、长度限制 |
| 后端 | Pydantic模型校验、SQL注入防护 |
| 传输 | HTTPS加密、请求签名 |

### 9.3 隐私保护

```javascript
// 敏感数据处理
const sensitiveFields = ['phone', 'id_card', 'address']

// 脱敏显示
function maskSensitive(value, type = 'phone') {
  if (type === 'phone') {
    return value.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')
  }
  return value
}
```

---

## 十、错误处理架构

### 10.1 全局错误处理

```javascript
// utils/request.js
class Request {
  async request(options) {
    try {
      const response = await wx.request(...)
      if (response.data.code !== 200) {
        throw new Error(response.data.message)
      }
      return response.data
    } catch (error) {
      // 网络错误
      if (error.errMsg?.includes('fail')) {
        wx.showToast({ title: '网络连接失败', icon: 'none' })
      }
      // 业务错误
      if (error.message?.includes('401')) {
        this.handleUnauthorized()
      }
      throw error
    }
  }
}
```

### 10.2 错误码规范

| 错误码 | 含义 | 处理方式 |
|--------|------|---------|
| 200 | 成功 | 正常展示 |
| 400 | 参数错误 | 提示用户修正 |
| 401 | 未授权 | 跳转登录 |
| 403 | 无权限 | 提示无权限 |
| 404 | 资源不存在 | 提示不存在 |
| 500 | 服务器错误 | 提示稍后重试 |
| 503 | 服务不可用 | 提示网络异常 |

---

## 十一、开发路线图

### Phase 1: 核心功能完善 (2周)

| 任务 | 详情 | 状态 |
|------|------|------|
| 首页数据对接 | 接入后端配方/食材API | 🟡 进行中 |
| AI对话优化 | 完善流式输出体验 | 🟡 进行中 |
| 配方详情页 | 完整展示配方信息 | ⏳ 待开发 |
| 用户体系 | 登录/注册/个人信息 | 🟡 进行中 |

### Phase 2: 功能增强 (2周)

| 任务 | 详情 | 状态 |
|------|------|------|
| OCR识别接入 | 接入腾讯云OCR API | ⏳ 待开发 |
| 报告导出 | PDF/图片分享 | ⏳ 待开发 |
| 配方收藏 | 收藏/取消收藏 | 🟡 进行中 |
| 历史记录 | 分析/对话历史 | 🟡 进行中 |

### Phase 3: 体验优化 (1周)

| 任务 | 详情 | 状态 |
|------|------|------|
| 性能优化 | 分包/懒加载/缓存 | 🟡 进行中 |
| 错误处理 | 全局错误捕获 | 🟡 进行中 |
| 无障碍 | 屏幕阅读器支持 | ⏳ 待开发 |
| 多端适配 | 鸿蒙/折叠屏适配 | ⏳ 待开发 |

---

## 十二、文件清单

### 核心文件

| 文件 | 大小 | 说明 |
|------|------|------|
| `app.js` | 配置入口 | 全局配置 |
| `app.json` | 1.2 KB | 页面注册/TabBar |
| `app.wxss` | 样式重置 | 全局样式 |
| `project.config.json` | 项目配置 | 编译配置 |

### 页面文件 (25个)

| 页面 | 路径 | 状态 |
|------|------|------|
| 首页 | pages/index/ | ✅ |
| 搜索 | pages/search/ | ✅ |
| 个人中心 | pages/profile/index/ | ✅ |
| 设置 | pages/settings/ | ✅ |
| 数据检索 | pages/database/ | ✅ |
| 合规标准 | pages/compliance/ | ✅ |
| 配料对比 | pages/compare/ | 🟡 |
| 配方列表 | packages/formulas/pages/index/ | ✅ |
| 配方详情 | packages/formulas/pages/detail/ | ✅ |
| AI对话 | packages/chat/pages/index/ | ✅ |
| 配料分析 | packages/ingredient/pages/analysis/ | ✅ |

### 组件文件 (9个)

| 组件 | 路径 | 状态 |
|------|------|------|
| Icon | components/Icon/ | ✅ |
| GlobalIcons | components/GlobalIcons/ | ✅ |
| HealthScore | components/HealthScore/ | ✅ |
| NutritionLabel | components/NutritionLabel/ | ✅ |
| FormulaCard | components/FormulaCard/ | ✅ |
| Badge | components/Badge/ | ✅ |
| ProgressBar | components/ProgressBar/ | ✅ |
| EmptyState | components/EmptyState/ | ✅ |
| SkeletonLoader | components/SkeletonLoader/ | ✅ |

### 工具模块 (14个)

| 模块 | 文件 | 大小 |
|------|------|------|
| HTTP请求 | utils/request.js | 2 KB |
| API导出 | utils/api.js | 5.3 KB |
| 认证 | utils/auth.js | 1.8 KB |
| AI对话 | utils/ai_chat.js | 11 KB |
| 配方管理 | utils/formula_manager.js | 3.6 KB |
| 配料分析 | utils/ingredient_analysis.js | 6.8 KB |
| 数据库 | utils/database.js | 4 KB |
| 合规 | utils/compliance.js | 4.5 KB |
| 存储 | utils/storage.js | 1.6 KB |
| 加载管理 | utils/loadingManager.js | 1.1 KB |
| 通用工具 | utils/helpers.js | 2 KB |

---

## 十三、技术规范遵循

### 13.1 View组件规范

遵循 https://developers.weixin.qq.com/miniprogram/dev/component/view.html

| 规范项 | 实现状态 |
|--------|---------|
| hover-class 点击态 | ✅ 已应用 |
| hover-stop-propagation | ✅ 已使用 |
| bindtap/catchtap 区分 | ✅ 已规范 |
| scroll-view 固定高度 | ✅ 已修复 |

### 13.2 事件规范

| 规范项 | 实现状态 |
|--------|---------|
| 事件冒泡控制 | ✅ catchtap用于阻断 |
| data-* 传参 | ✅ kebab-case命名 |
| 事件处理函数命名 | ✅ 统一规范 |

### 13.3 性能规范

| 规范项 | 实现状态 |
|--------|---------|
| wx:key 唯一性 | ✅ 全部使用id |
| 图片懒加载 | ✅ lazy-load属性 |
| 分包加载 | ✅ 4个子包 |
| 缓存策略 | ✅ 三级缓存 |

---

## 十四、下一步行动

### 立即执行

1. **启动后端服务**
   ```bash
   cd D:\RMFOODFP\backend
   python -m uvicorn app.main:app --reload --port 8000
   ```

2. **访问API文档**
   ```
   http://localhost:8000/docs
   ```

3. **测试核心接口**
   - POST `/api/v1/ingredients/analyze`
   - POST `/api/v1/ingredients/ocr`

### 本周完成

4. **首页数据对接** - 接入真实API
5. **AI对话优化** - 完善SSE流式输出
6. **配方详情页** - 完整展示配方信息

### 下周完成

7. **OCR接入** - 腾讯OCR API集成
8. **报告导出** - PDF/图片分享功能
9. **真机测试** - iOS/Android兼容性

---

**文档版本**: V3.0  
**最后更新**: 2026-01-15  
**状态**: ✅ 完整架构规划完成