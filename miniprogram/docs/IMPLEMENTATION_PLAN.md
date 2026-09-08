# RMFOOD 小程序 - 完整实施方案

> 版本：V3.1 | 更新日期：2026-01-15 | 状态：🚀 执行阶段

---

## 一、执行摘要

| 项目 | 详情 |
|------|------|
| 项目名称 | RMFOOD 食源性药食同源配方平台 |
| 当前版本 | V3.1 |
| 基础库版本 | 3.15.2 |
| AppID | wx2aa1c2e869b9e8ac |
| 总文件大小 | 503 KB |
| 页面数量 | 11 个 |
| 组件数量 | 9 个 |
| API模块 | 6 个 |

---

## 二、已完成功能清单

### 2.1 核心页面 ✅

| 页面 | 路径 | 状态 | 功能 |
|------|------|------|------|
| 首页 | pages/index/index | ✅ | 快捷入口、配方推荐、食材展示 |
| 搜索 | pages/search/index | ✅ | 全局搜索、热门搜索、历史记录 |
| 个人中心 | pages/profile/index | ✅ | 用户信息、收藏、历史 |
| 设置 | pages/settings/index | ✅ | 个人信息、隐私、缓存管理 |
| 数据检索 | pages/database/index | ✅ | 中药材、活性肽、药食同源 |
| 合规标准 | pages/compliance/index | ✅ | 国标查询、添加剂限量、实时检测 |
| AI对话 | packages/chat/pages/index | ✅ | 流式对话、历史会话、配方生成 |
| 配方库 | packages/formulas/pages/index | ✅ | 配方列表、分类筛选 |
| 配方详情 | packages/formulas/pages/detail | ✅ | 配方详情、收藏、分享 |
| 配料分析 | packages/ingredient/pages/analysis | ✅ | 六维分析、OCR识别、营养报告 |

### 2.2 公共组件 ✅

| 组件 | 功能 | 文件数 |
|------|------|--------|
| Icon | SVG图标组件 | 4 |
| GlobalIcons | 51个业务图标spritesheet | 4 |
| HealthScore | Nutri-Score健康评分 | 4 |
| NutritionLabel | GB28050营养标签 | 4 |
| FormulaCard | 配方卡片 | 4 |
| Badge | 徽章组件 | 4 |
| ProgressBar | 进度条 | 4 |
| EmptyState | 空状态 | 4 |
| SkeletonLoader | 骨架屏 | 4 |

### 2.3 API服务层 ✅

| 服务 | 方法数 | 状态 |
|------|--------|------|
| AuthService | 5 | ✅ |
| AIService | 8 | ✅ |
| FormulaService | 7 | ✅ |
| IngredientService | 8 | ✅ |
| DatabaseService | 14 | ✅ |
| ComplianceService | 12 | ✅ |

### 2.4 后端API ✅

| 端点 | 方法 | 功能 |
|------|------|------|
| /api/v1/ingredients/analyze | POST | 六维分析 |
| /api/v1/ingredients/ocr | POST | OCR识别 |
| /api/v1/ingredients/additives | GET | 添加剂数据库 |
| /api/v1/ingredients/food-homology | GET | 药食同源目录 |
| /api/v1/ingredients/allergens | GET | 过敏原配置 |
| /api/v1/ingredients/health-score/{score} | GET | 评分解读 |
| /api/v1/ingredients/batch-analyze | POST | 批量分析 |
| /api/v1/ai/chat/stream | POST | AI对话流式输出 |
| /api/v1/formulas | GET/POST | 配方CRUD |
| /api/v1/databases/herbs | GET | 中药材检索 |
| /api/v1/compliance/check | POST | 实时合规检查 |

---

## 三、待实现功能清单

### 3.1 P0 优先级（必须完成）

| 功能 | 详情 | 预计工时 | 状态 |
|------|------|---------|------|
| 真实OCR接入 | 接入腾讯云OCR API | 4h | ⏳ |
| 首页数据对接 | 接入真实配方/食材API | 2h | 🟡 |
| AI对话优化 | 完善SSE流式输出体验 | 3h | 🟡 |
| 配方详情页 | 完整展示配方信息 | 4h | ⏳ |

### 3.2 P1 优先级（重要）

| 功能 | 详情 | 预计工时 | 状态 |
|------|------|---------|------|
| 报告导出 | PDF/图片分享功能 | 3h | ⏳ |
| 用户体系完善 | 登录/注册/个人信息 | 4h | 🟡 |
| 历史记录优化 | 分析/对话历史持久化 | 2h | 🟡 |
| 缓存策略优化 | Redis缓存热点数据 | 3h | ⏳ |

### 3.3 P2 优先级（增强）

| 功能 | 详情 | 预计工时 | 状态 |
|------|------|---------|------|
| 配方生成向导 | AI辅助配方设计流程 | 6h | ⏳ |
| 食材详情页 | 单个食材详细信息 | 2h | ⏳ |
| 多端适配 | 鸿蒙/折叠屏适配 | 4h | ⏳ |
| 无障碍支持 | 屏幕阅读器适配 | 3h | ⏳ |

---

## 四、技术架构

### 4.1 分层架构

```
┌─────────────────────────────────────────────────────────────┐
│                      表现层 (Presentation)                    │
│  ┌──────────┬──────────┬──────────┬──────────────────────┐  │
│  │ 首页     │ AI对话   │ 搜索     │ 个人中心               │  │
│  │ 配方库   │ 配料分析 │ 数据库   │ 合规标准               │  │
│  └──────────┴──────────┴──────────┴──────────────────────┘  │
├─────────────────────────────────────────────────────────────┤
│                      组件层 (Components)                      │
│  ┌──────────┬──────────┬──────────┬──────────────────────┐  │
│  │ Icon     │ Health   │ Nutrition│ FormulaCard          │  │
│  │ Score    │  Label   │          │                      │  │
│  └──────────┴──────────┴──────────┴──────────────────────┘  │
├─────────────────────────────────────────────────────────────┤
│                      服务层 (Services)                        │
│  ┌──────────┬──────────┬──────────┬──────────────────────┐  │
│  │ Auth     │ AI       │ Formula  │ Ingredient           │  │
│  │ Service  │ Service  │ Service  │ Service              │  │
│  ├──────────┼──────────┼──────────┼──────────────────────┤  │
│  │ Database │ Compliance│ Search  │ Cache                │  │
│  │ Service  │ Service   │ Service │ Service              │  │
│  └──────────┴──────────┴──────────┴──────────────────────┘  │
├─────────────────────────────────────────────────────────────┤
│                      数据层 (Data)                            │
│  ┌──────────┬──────────┬──────────┬──────────────────────┐  │
│  │ request  │ storage  │ config   │ helpers              │  │
│  │ .js      │ .js      │ .js      │ .js                  │  │
│  └──────────┴──────────┴──────────┴──────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                      后端服务层 (Backend)                     │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  FastAPI + PostgreSQL + Redis                       │  │
│  │  • /api/v1/auth        - 认证                        │  │
│  │  • /api/v1/ai          - AI对话/配方生成             │  │
│  │  • /api/v1/formulas    - 配方管理                    │  │
│  │  • /api/v1/ingredients - 配料分析                    │  │
│  │  • /api/v1/databases   - 数据库检索                  │  │
│  │  • /api/v1/compliance  - 合规检查                    │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 数据流架构

```
用户操作
    │
    ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   WXML      │────▶│   JS逻辑    │────▶│  API服务    │
│  视图层     │     │  控制层     │     │  服务层     │
└─────────────┘     └─────────────┘     └──────┬──────┘
                                               │
                                               ▼
                                      ┌─────────────────┐
                                      │   HTTP请求      │
                                      │  (request.js)   │
                                      └────────┬────────┘
                                               │
                                               ▼
                                      ┌─────────────────┐
                                      │   后端API       │
                                      │ (FastAPI)       │
                                      └────────┬────────┘
                                               │
                                               ▼
                                      ┌─────────────────┐
                                      │   数据库        │
                                      │(PostgreSQL)     │
                                      └─────────────────┘
```

---

## 五、实施计划

### Phase 1: 核心功能完善（第1周）

```
Day 1-2: 首页数据对接
├── 接入真实配方API
├── 接入真实食材API
└── 优化加载状态和错误处理

Day 3-4: AI对话优化
├── 完善SSE流式输出
├── 优化对话体验
└── 添加配方卡片展示

Day 5-7: 配方详情页
├── 完整展示配方信息
├── 配方收藏/分享功能
└── 配方版本历史
```

### Phase 2: 功能增强（第2周）

```
Day 1-2: OCR接入
├── 申请腾讯云OCR密钥
├── 实现OCRService类
└── 接入配料分析流程

Day 3-4: 用户体系
├── 登录/注册流程优化
├── 个人信息管理
└── 权限控制

Day 5-7: 报告导出
├── PDF报告生成
├── 图片分享功能
└── 历史记录持久化
```

### Phase 3: 体验优化（第3周）

```
Day 1-2: 性能优化
├── 分包懒加载优化
├── 图片压缩和CDN
└── 缓存策略优化

Day 3-4: 错误处理
├── 全局错误捕获
├── 网络重试机制
└── 降级策略

Day 5-7: 测试验收
├── iOS真机测试
├── Android真机测试
└── 性能测试和优化
```

---

## 六、关键代码规范

### 6.1 页面开发规范

```javascript
// ✅ 正确的页面结构
Page({
  data: {
    // 视图数据
    loading: false,
    list: [],
    
    // 交互状态
    menuOpen: false,
    activeTab: 'all'
  },
  
  // 生命周期
  onLoad(options) { /* 页面加载 */ },
  onShow() { /* 页面显示 */ },
  onHide() { /* 页面隐藏 */ },
  onUnload() { /* 页面卸载 */ },
  
  // 事件处理
  onPullDownRefresh() { /* 下拉刷新 */ },
  onLoadMore() { /* 上拉加载 */ },
  
  // 用户操作
  handleTap(e) { /* 点击处理 */ }
})

// ❌ 避免：过于复杂的页面逻辑
// 应将复杂逻辑提取到 Service 层
```

### 6.2 服务层开发规范

```javascript
// ✅ 正确的服务结构
class IngredientAnalysisService {
  // 单例模式
  static instance = null
  
  static getInstance() {
    if (!this.instance) {
      this.instance = new IngredientAnalysisService()
    }
    return this.instance
  }
  
  // 异步方法
  async analyze(params) {
    try {
      const result = await request.post('/ingredients/analyze', params)
      return result
    } catch (error) {
      console.error('[IngredientAnalysis] Error:', error)
      throw error
    }
  }
}

module.exports = IngredientAnalysisService.getInstance()
```

### 6.3 组件开发规范

```javascript
// ✅ 正确的组件结构
Component({
  options: {
    multipleSlots: true,
    styleIsolation: 'isolated'
  },
  
  properties: {
    score: {
      type: Number,
      value: 0,
      observer: '_onScoreChange'
    }
  },
  
  data: {
    scoreLetter: 'B'
  },
  
  methods: {
    _onScoreChange(newVal) {
      this.setData({
        scoreLetter: this.getGrade(newVal)
      })
    }
  }
})
```

---

## 七、环境变量配置

### 7.1 开发环境

```javascript
// config.js
module.exports = {
  baseUrl: 'http://localhost:8000/api/v1',
  uploadUrl: 'http://localhost:8000',
  debug: true,
  mockEnabled: false
}
```

### 7.2 生产环境

```javascript
// 需要修改 config.js
module.exports = {
  baseUrl: 'https://api.rmfood.com/api/v1',
  uploadUrl: 'https://api.rmfood.com',
  debug: false,
  mockEnabled: false
}
```

---

## 八、测试检查清单

### 8.1 功能测试

- [ ] 首页所有功能正常
- [ ] AI对话流式输出正常
- [ ] 配料分析六维结果正确
- [ ] 配方收藏/分享正常
- [ ] 搜索功能正常
- [ ] 个人中心数据同步

### 8.2 性能测试

- [ ] 首屏加载时间 < 2秒
- [ ] 页面切换流畅
- [ ] 列表滚动无卡顿
- [ ] 内存占用合理

### 8.3 兼容性测试

- [ ] iOS 14+ 正常
- [ ] Android 8+ 正常
- [ ] 微信版本兼容

### 8.4 网络测试

- [ ] 弱网环境降级
- [ ] 断网缓存展示
- [ ] 网络恢复自动同步

---

## 九、部署流程

### 9.1 开发环境

```bash
# 1. 启动后端
cd D:\RMFOODFP\backend
python -m uvicorn app.main:app --reload --port 8000

# 2. 打开微信开发者工具
# 3. 导入项目 D:\RMFOODFP\miniprogram
# 4. 编译运行
```

### 9.2 生产环境

```bash
# 1. 修改 config.js 为生产地址
# 2. 上传代码到微信后台
# 3. 提交审核
# 4. 发布上线
```

---

## 十、风险与应对

| 风险 | 影响 | 应对措施 |
|------|------|---------|
| 后端API不稳定 | 功能不可用 | 前端降级策略，本地缓存兜底 |
| OCR识别率低 | 用户体验差 | 提供手动输入备选方案 |
| 真机兼容问题 | 部分用户无法使用 | 多设备测试，针对性修复 |
| 性能问题 | 卡顿/闪退 | 分包优化，图片压缩 |

---

**文档版本**: V3.1  
**最后更新**: 2026-01-15  
**状态**: 🚀 执行阶段
