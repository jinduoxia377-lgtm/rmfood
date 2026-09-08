# RMFOOD 药食同源配方平台小程序

> 版本：V2.0 | 最后更新：2026-01-15 | 状态：✅ 后端API对接完成，待OCR接入

---

## 📱 项目简介

RMFOOD小程序是一款专业的药食同源健康管理应用，提供三大核心功能：

1. **配方生成** - AI智能问诊，生成个性化药食同源配方
2. **配料表分析** - 拍照识别，六维健康评估（Nutri-Score/NOVA/添加剂/过敏原/药食同源/营养标签）
3. **电商同步** - 淘宝/天猫产品搜索、对比、一键购买

---

## 🏗️ 技术栈

- **前端框架**：微信小程序原生开发（基础库 3.15.2）
- **样式方案**：WXSS + CSS变量 + 响应式布局
- **状态管理**：全局Data + LocalStorage + 页面缓存
- **请求封装**：Promise + 拦截器 + 错误重试
- **分包策略**：4个子包，控制主包体积 < 2MB
- **编码规范**：UTF-8 without BOM

---

## 📂 项目结构

```
miniprogram/
├── app.js                 # 应用入口
├── app.json               # 全局配置
├── app.wxss               # 全局样式
├── project.config.json    # 项目配置
│
├── pages/                 # 主包页面（<2MB）
│   ├── index/            # 首页 ✅
│   ├── test/             # 测试页 ✅
│   ├── search/           # 搜索页 ✅
│   ├── compare/          # 对比分析页 ✅
│   ├── settings/         # 设置页 ✅
│   ├── privacy/          # 隐私政策页 ✅
│   └── agreement/        # 用户协议页 ✅
│
├── packages/              # 分包目录
│   ├── chat/             # AI对话分包 ✅
│   │   └── pages/index/
│   ├── formulas/         # 配方管理分包 ✅
│   │   ├── pages/index/  # 配方列表
│   │   └── pages/detail/ # 配方详情
│   ├── ingredient/       # 配料分析分包 ⭐核心 ✅
│   │   └── pages/analysis/
│   └── profile/          # 个人中心分包 ✅
│       ├── pages/index/
│       └── pages/history/
│
├── components/            # 公共组件 ✅
│   ├── Badge/            # 徽章组件
│   ├── EmptyState/       # 空状态组件
│   ├── FormulaCard/      # 配方卡片组件
│   ├── GlobalIcons/      # 全局图标组件
│   ├── HealthScore/      # 健康评分组件
│   ├── Icon/             # 通用图标组件
│   ├── NutritionLabel/   # 营养成分表组件
│   ├── ProgressBar/      # 进度条组件
│   └── SkeletonLoader/   # 骨架屏加载组件
│
├── utils/                 # 工具函数 ✅
│   ├── helpers.js        # 通用工具
│   ├── request.js        # 请求封装
│   └── helpers.wxs       # WXS脚本
│
└── assets/                # 资源文件
    ├── icons/            # TabBar图标
    └── images/           # 图片资源
```

---

## 📊 当前项目状态

### 📈 文件统计

| 类型 | 数量 | 说明 |
|------|------|------|
| JSON 配置 | 29 个 | 包括页面、组件、全局配置 |
| WXML 模板 | 23 个 | 所有页面和组件模板 |
| WXSS 样式 | 23 个 | 配套样式文件 |
| JS 脚本 | 38 个 | 页面逻辑和工具函数 |
| 资源文件 | 85 个 | 图片、图标等 |
| **总计** | **198 个** | 不含 node_modules |

### ✅ 已完成功能清单

#### 核心页面（16个）

| 页面 | 路径 | 功能状态 | 备注 |
|------|------|---------|------|
| 首页 | pages/index | ✅ 完成 | 汉堡菜单、功能导航 |
| 测试页 | pages/test | ✅ 完成 | 编译测试专用 |
| 搜索页 | pages/search | ✅ 完成 | 食材/配方搜索 |
| 对比分析页 | pages/compare | ✅ 完成 | 多产品对比 |
| 设置页 | pages/settings | ✅ 完成 | 用户偏好设置 |
| 隐私政策页 | pages/privacy | ✅ 完成 | 合规页面 |
| 用户协议页 | pages/agreement | ✅ 完成 | 合规页面 |
| **数据检索中心** ⭐ | pages/database | ✅ 完成 | 中药材/活性肽/药食同源/知识图谱 |
| **合规标准** ⭐ | pages/compliance | ✅ 完成 | GB标准/GB2760/GB14880/禁忌/合规检查 |
| AI对话页 | packages/chat | ✅ 完成 | SSE流式响应 |
| 配方列表页 | packages/formulas | ✅ 完成 | 分类筛选 |
| 配方详情页 | packages/formulas/detail | ✅ 完成 | 完整配方展示 |
| 个人中心页 | packages/profile | ✅ 完成 | 用户信息 |
| 历史记录页 | packages/history | ✅ 完成 | 分析历史 |
| 配料分析页 ⭐ | packages/ingredient | ✅ 完成 | 六维分析核心 |

#### 公共组件（9个）

| 组件 | 功能 | 状态 |
|------|------|------|
| HealthScore | Nutri-Score健康评分展示 | ✅ |
| NutritionLabel | GB 28050营养成分表 | ✅ |
| FormulaCard | 配方卡片展示 | ✅ |
| Badge | 徽章标记 | ✅ |
| EmptyState | 空状态提示 | ✅ |
| Icon | 通用图标 | ✅ |
| ProgressBar | 进度条 | ✅ |
| SkeletonLoader | 骨架屏加载 | ✅ |
| GlobalIcons | 全局SVG图标 | ✅ |

#### 工具函数（3个）

| 文件 | 功能 |
|------|------|
| helpers.js | 日期格式化、金额格式化、健康评分计算 |
| request.js | 请求封装、认证、错误处理、重试机制 |
| helpers.wxs | WXS模板辅助函数 |

---

## 🔧 技术架构

### 分包策略

```
主包（约45KB）                分包1: chat（AI对话）
├── pages/index/           ├── pages/index/
├── pages/search/          └── （对话页）
├── pages/compare/         
├── pages/settings/        
├── pages/privacy/         
└── pages/agreement/       

分包2: formulas（配方管理）  分包3: ingredient（配料分析）⭐
├── pages/index/           ├── pages/analysis/
└── pages/detail/          └── （六维分析页）

分包4: profile（个人中心）
├── pages/index/
└── pages/history/
```

### API接口设计

#### 认证模块
```
POST /api/v1/wechat/login      # 微信登录
```

#### 配方生成模块
```
POST /api/v1/ai/chat/stream    # AI对话（SSE）
GET  /api/v1/formulas          # 配方列表
GET  /api/v1/formulas/{id}     # 配方详情
POST /api/v1/formulas/{id}/favorite  # 收藏配方
```

#### 配料分析模块 ⭐
```
POST /api/v1/nutrition/analyze  # 配料表分析
POST /api/v1/nutrition/ocr       # OCR识别
GET  /api/v1/nutrition/database  # 营养数据库
```

#### 电商平台模块
```
GET  /api/v1/taobao/search       # 淘宝商品搜索
GET  /api/v1/products/{id}/analysis  # 产品分析结果
```

#### 用户模块
```
GET  /api/v1/user/profile        # 用户信息
GET  /api/v1/user/history        # 分析历史
GET  /api/v1/user/stats          # 统计数据
```

---

## 🎨 UI设计规范

### 颜色系统
```css
/* 主色调 - 草本绿 */
--primary: #2D5A3D
--primary-light: #4A7C5C
--primary-dark: #1E3D2A

/* 功能色 */
--success: #4CAF50
--warning: #FFC107
--danger: #F44336
--info: #2196F3

/* 中性色 */
--text-primary: #333333
--text-secondary: #666666
--text-muted: #999999
--bg-primary: #F5F5F5
--bg-white: #FFFFFF
```

### 字体规范
- 标题：36rpx-48rpx，bold
- 正文：28rpx-32rpx，normal
- 辅助：24rpx-26rpx，muted

### 间距规范
- 大间距：48rpx
- 中标距：32rpx
- 小间距：16rpx
- 极小：8rpx

### 设计亮点

#### 汉堡菜单
- 经典三条横杠图标（≡）
- 尺寸：44rpx × 32rpx
- 线条高度：3rpx，圆角2rpx
- 流畅的展开/收起动画

#### 健康评分系统
- Nutri-Score标准：A/B/C/D/E五级
- 颜色编码：绿→黄→橙→红
- 圆形徽章 + 数值 + 文字三合一展示

#### 配料分析六维
```
┌─────────────────────────────────────────┐
│  健康总评                                │
│  ├─ Nutri-Score圆形徽章                  │
│  ├─ 分数值 + 文字评价                    │
│  └─ NOVA分组徽章                         │
├─────────────────────────────────────────┤
│  营养成分表（GB 28050格式）              │
├─────────────────────────────────────────┤
│  成分分析                                │
│  ├─ 添加剂分析（E编码识别）              │
│  ├─ 过敏原检测（八大过敏原）             │
│  └─ 药食同源成分识别 ⭐特色               │
├─────────────────────────────────────────┤
│  改进建议                               │
├─────────────────────────────────────────┤
│  替代配方推荐（联动功能）                │
└─────────────────────────────────────────┘
```

---

## 📝 开发历史记录

### V2.0 - 2026-01-15
- ✅ 后端六维分析引擎（ingredient_analysis.py）
- ✅ 后端OCR识别API接口（/ingredients/ocr）
- ✅ 后端六维分析API接口（/ingredients/analyze）
- ✅ 后端批量分析API接口（/ingredients/batch-analyze）
- ✅ 后端数据库查询API（additives/food-homology/allergens）
- ✅ 前端对接后端API（ingredient_analysis.js重构）
- ✅ 前端分析流程优化（OCR→确认→分析）
- ✅ 路由注册到main.py
- ✅ 开发方案文档（INGREDIENT_ANALYSIS_PLAN.md）

### V1.3.0 - 2026-01-15
- ✅ 首页搜索框遮挡问题修复（margin-top优化）
- ✅ 配料分析模块深度开发（六维分析系统）
- ✅ 新增50+种E编码添加剂数据库
- ✅ 新增50+种药食同源成分库
- ✅ 八大过敏原自动检测
- ✅ NOVA超加工食品分组算法
- ✅ Nutri-Score健康评分引擎
- ✅ GB 28050营养成分表生成
- ✅ Icon组件全面替换（无Emoji）

### V1.2.0 - 2026-01-15
- ✅ 首页快捷功能区重构（2行3列专业布局）
- ✅ Icon组件系统升级（SVG实现，51个业务图标）
- ✅ TabBar中文化
- ✅ 废弃所有Emoji图标
- ✅ 新增数据检索中心页面
- ✅ 新增合规标准页面
- ✅ API层完善（database.js, compliance.js）
- ✅ 渐变色图标背景设计

### V1.1.0 - 2026-01-15
- ✅ 修复所有WXML文件编码问题（GBK → UTF-8）
- ✅ 修复页面JS文件为空问题
- ✅ 验证所有文件语法正确性
- ✅ 项目可正常编译运行

### V1.0.0 - 早期版本
- ✅ 完成基础页面框架搭建
- ✅ 实现分包架构
- ✅ 设计公共组件系统
- ✅ 编写工具函数库

---

## 🚀 快速开始

### 1. 环境准备

```bash
# 安装微信开发者工具
# https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html
```

### 2. 项目配置

打开微信开发者工具，导入项目：
- 项目目录：`D:\RMFOODFP\miniprogram`
- AppID：`wx2aa1c2e869b9e8ac`
- 项目名称：RMFOOD

### 3. 后端配置

编辑 `miniprogram/app.js`，修改API地址：

```javascript
globalData: {
  baseUrl: 'http://localhost:8000/api/v1', // 开发环境
  // baseUrl: 'https://api.rmfood.com/api/v1', // 生产环境
}
```

### 4. 启动开发

使用微信开发者工具打开项目即可预览。

---

## 🎯 下一步深度开发计划

### 第一阶段：功能完善（预计2周）

- [ ] **后端API联调**
  - [ ] 实现微信登录接口对接
  - [ ] 对接AI对话SSE流式响应
  - [ ] 实现配料分析API对接
  - [ ] 实现配方数据同步

- [ ] **缓存系统优化**
  - [ ] 页面级缓存（keep-alive）
  - [ ] 数据级缓存（LocalStorage）
  - [ ] 图片懒加载优化
  - [ ] 离线数据支持

- [ ] **用户体验提升**
  - [ ] 骨架屏加载动画优化
  - [ ] 错误边界处理
  - [ ] 网络状态检测
  - [ ] 手势操作优化

### 第二阶段：核心功能深化（预计3周）

- [ ] **AI对话增强**
  - [ ] 多轮对话记忆
  - [ ] 对话历史持久化
  - [ ] 智能推荐算法
  - [ ] 对话结果导出分享

- [ ] **配料分析深化**
  - [ ] 拍照OCR识别优化
  - [ ] 批量分析支持
  - [ ] 历史数据分析趋势
  - [ ] 个性化健康报告生成

- [ ] **配方系统完善**
  - [ ] 配方智能推荐算法
  - [ ] 配方收藏与分享
  - [ ] 配方打印功能
  - [ ] 配方云同步

### 第三阶段：商业化准备（预计2周）

- [ ] **电商功能接入**
  - [ ] 淘宝/天猫商品搜索
  - [ ] 价格对比功能
  - [ ] 一键购买跳转
  - [ ] 优惠券领取

- [ ] **用户体系完善**
  - [ ] 用户等级系统
  - [ ] 积分奖励机制
  - [ ] 会员订阅功能
  - [ ] 社交分享裂变

- [ ] **数据分析埋点**
  - [ ] 用户行为追踪
  - [ ] 功能使用统计
  - [ ] 转化率分析
  - [ ] A/B测试框架

### 第四阶段：发布准备（预计1周）

- [ ] **性能优化**
  - [ ] 代码压缩分包
  - [ ] 图片资源压缩
  - [ ] 首屏加载优化
  - [ ] 内存占用优化

- [ ] **测试验证**
  - [ ] 真机兼容性测试
  - [ ] 性能压力测试
  - [ ] 安全漏洞扫描
  - [ ] 用户体验测试

- [ ] **上线部署**
  - [ ] 提交微信审核
  - [ ] 生产环境配置
  - [ ] 监控告警设置
  - [ ] 版本更新机制

---

## 📞 联系方式

- **项目负责人**：RMFOOD架构组
- **问题反馈**：GitHub Issues

---

## 📄 License

MIT License - 自由使用、修改和分发

---

*© 2026 RMFOOD. All rights reserved.*
