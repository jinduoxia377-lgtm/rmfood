# RMFOOD 微信小程序完整开发方案

> 版本：V2.0（完整版）  
> 编制日期：2026-09-06  
> 编制：RMFOOD架构组  
> 状态：✅ 完整开发版

---

## 执行摘要

本文档是RMFOOD微信小程序的**完整开发方案**，整合了技术架构、功能清单、API设计、数据库设计和开发计划。

### 核心要点

| 维度 | 内容 |
|------|------|
| **技术栈** | Taro 4.x + React 18 + TypeScript + NutUI-Taro |
| **功能规模** | 56项功能（12页面 + 18组件 + 14API） |
| **后端对接** | 复用现有FastAPI接口，新增营养分析API |
| **开发周期** | 10周（含审核buffer） |
| **预算估算** | 首年¥56,000 |

### 三大核心模块

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         RMFOOD 小程序三大核心模块                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐     │
│   │   AI智能对话     │    │   配方管理       │    │   配料表分析     │     │
│   │                  │    │                  │    │                  │     │
│   │ • 流式输出       │    │ • 配方浏览       │    │ • 拍照识别       │     │
│   │ • 语音输入       │    │ • 配方详情       │    │ • 营养计算       │     │
│   │ • 快捷问题       │    │ • 配方收藏       │    │ • 健康评估       │     │
│   │ • 配方生成       │    │ • 配方分享       │    │ • 安全审查       │     │
│   │                  │    │                  │    │ • 改进建议       │     │
│   └──────────────────┘    └──────────────────┘    └──────────────────┘     │
│                                                                             │
│   ████████████████████████████████████████████████████████████████████     │
│                                                                             │
│   ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐     │
│   │   体质诊断       │    │   个人中心       │    │   搜索对比       │     │
│   │                  │    │                  │    │                  │     │
│   │ • 15题问卷       │    │ • 对话历史       │    │ • 食材搜索       │     │
│   │ • 体质分析       │    │ • 我的收藏       │    │ • 配方对比       │     │
│   │ • AI推荐         │    │ • 诊断历史       │    │ • 联想搜索       │     │
│   │                  │    │                  │    │                  │     │
│   └──────────────────┘    └──────────────────┘    └──────────────────┘     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 一、技术架构

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
| **图片处理** | Taro.chooseMedia | - | 拍照/相册选择 |

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
│  │  配料表分析  │    │  配方详情    │    │   搜索       │    │  设置    │  │
│  │(ingredient-  │    │(formula-     │    │  (search)    │    │ (settings)│ │
│  │ analysis)    │    │  detail)     │    │              │    │          │ │
│  └──────────────┘    └──────────────┘    └──────────────┘    └──────────┘  │
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                      业务逻辑层（React + Taro）                       │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌────────────┐  │   │
│  │  │  Pages      │  │ Components  │  │    Stores   │  │   Hooks    │  │   │
│  │  │  (12个页面) │  │ (18+组件)   │  │ (Zustand)   │  │ (自定义)   │  │   │
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
│  │  • Token管理（AES加密存储）                                          │   │
│  │  • 请求拦截器（自动注入Authorization）                               │   │
│  │  • 响应拦截器（401自动刷新、错误统一处理）                           │   │
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
│  │  │ 认证服务 │  │ AI服务   │  │ 配方服务 │  │ 营养服务 │  │ 通知  │  │   │
│  │  │/auth/*   │  │ /ai/*    │  │/formulas │  │/nutrition│  │/notify│  │   │
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

| 分包名 | 根目录 | 页面 | 说明 |
|--------|--------|------|------|
| **主包** | - | index, search, compare, settings, privacy, agreement | 公共页面 |
| **chat** | packages/chat | chat/index | AI对话分包 |
| **formulas** | packages/formulas | formulas/index, formula-detail, ingredient-analysis | 配方相关分包 |
| **profile** | packages/profile | profile/index, settings | 个人中心分包 |
| **health-check** | packages/health-check | health-check/index | 体质诊断独立分包 |

---

## 二、功能结构

### 2.1 功能统计总览

| 类别 | 核心功能(P0) | 增值功能(P1) | 扩展功能(P2/P3) | 总计 |
|------|-------------|-------------|----------------|------|
| **页面** | 8个 | 3个 | 1个 | **12个** |
| **组件** | 8个 | 7个 | 3个 | **18个** |
| **Store** | 4个 | 1个 | - | **5个** |
| **Hook** | 3个 | 2个 | 2个 | **7个** |
| **API** | 6个 | 5个 | 3个 | **14个** |
| **合计** | **29项** | **18项** | **9项** | **56项** |

### 2.2 三大核心模块详解

#### 模块一：AI智能对话

| 功能 | 描述 | 技术实现 | 状态 |
|------|------|---------|------|
| 流式对话 | 实时打字机效果 | fetch API + ReadableStream | 需开发 |
| 对话历史 | 保存最近10条记录 | Zustand store + 本地缓存 | 需开发 |
| 快捷问题 | 首页常见问题入口 | 预设问题列表 | 需开发 |
| 配方卡片 | AI回复内嵌配方 | FormulaCard组件 | 需开发 |
| 语音输入 | 语音提问支持 | wx.getRecorderManager | 需开发 |
| 免责声明 | 每条回复后展示 | Disclaimer组件 | 需开发 |

#### 模块二：配方管理

| 功能 | 描述 | 技术实现 | 状态 |
|------|------|---------|------|
| 配方列表 | 分页+下拉刷新+上拉加载 | 分页API + 虚拟列表 | 需开发 |
| 配方分类 | 按功效分类筛选 | 分类筛选API | 需开发 |
| 配方搜索 | 关键词搜索 | 搜索API | 需开发 |
| 配方详情 | 成分、机理、禁忌 | Markdown渲染 | 需开发 |
| 配方收藏 | 收藏/取消收藏 | POST /formulas/favorite | 需开发 |
| 配方分享 | 生成分享海报 | canvas绘制 | 需开发 |

#### 模块三：配料表分析 ⭐ 新增核心

| 功能 | 描述 | 技术实现 | 状态 |
|------|------|---------|------|
| 拍照识别 | 拍摄食品包装配料表 | wx.chooseMedia + OCR | 需开发 |
| 手动输入 | 手动输入配料成分 | 文本输入框 | 需开发 |
| 语音输入 | 语音描述配料 | wx.getRecorderManager | 需开发 |
| 成分识别 | AI识别配料表中的成分 | AI分析 + 数据库匹配 | 需开发 |
| 营养计算 | 按GB 28050计算营养标签 | 后端/nutrition/calculate | 需开发 |
| 健康评估 | 评估配料健康价值 | AI分析 + 规则引擎 | 需开发 |
| 安全审查 | 检查禁忌成分 | 安全检测API | 需开发 |
| 功效分析 | 分析各成分功效 | 成分功效数据库 | 需开发 |
| 营养标签 | 展示营养成分表 | NutritionLabel组件 | 需开发 |
| 成分详情 | 展示各成分详细信息 | IngredientDetail组件 | 需开发 |
| 健康评分 | 展示健康价值评分 | HealthScore组件 | 需开发 |
| 改进建议 | 给出配方优化建议 | AI生成建议 | 需开发 |
| 保存结果 | 保存分析记录 | 本地Storage | 需开发 |
| 分享结果 | 生成分享海报 | canvas绘制 | 需开发 |
| 历史记录 | 查看历史分析记录 | 历史记录API | 需开发 |

---

## 三、页面结构

### 3.1 页面清单（12个页面）

| 序号 | 页面 | 路径 | 分包 | 优先级 | 核心功能 |
|------|------|------|------|--------|---------|
| 1 | 首页 | pages/index/index | 主包 | P0 | AI入口、热门配方、快捷问题 |
| 2 | AI对话 | packages/chat/index | chat | P0 | 流式对话、配方卡片内嵌 |
| 3 | 配方列表 | packages/formulas/index | formulas | P0 | 分类浏览、搜索、收藏 |
| 4 | 配方详情 | packages/formula-detail/index | formulas | P0 | 完整配方信息、机理说明 |
| 5 | **配料表分析** | **packages/ingredient-analysis/index** | **formulas** | **P0** | **拍照识别、营养计算、健康评估** ⭐ |
| 6 | 体质诊断 | packages/health-check/index | health-check | P1 | 多步骤问卷、AI推荐 |
| 7 | 个人中心 | packages/profile/index | profile | P0 | 历史记录、收藏、设置 |
| 8 | 搜索页 | pages/search/index | 主包 | P1 | 食材搜索、联想搜索 |
| 9 | 配方对比 | pages/compare/index | 主包 | P1 | 多方案并列对比 |
| 10 | 设置页 | pages/settings/index | profile | P2 | 通知开关、隐私设置 |
| 11 | 隐私政策 | pages/privacy/index | 主包 | P0 | 隐私政策展示（合规必需） |
| 12 | 用户协议 | pages/agreement/index | 主包 | P0 | 用户协议展示（合规必需） |

### 3.2 页面架构图

```
                    ┌─────────────────┐
                    │      首页        │
                    │   (index)       │
                    └────────┬────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
        ▼                    ▼                    ▼
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│    AI对话      │    │    配方浏览    │    │   配料表分析   │
│   (chat)      │    │  (formulas)   │    │(ingredient-   │
│               │    │               │    │  analysis)    │
│ • 流式对话     │    │ • 配方列表    │    │               │
│ • 语音输入     │    │ • 配方详情    │    │ • 拍照识别    │
│ • 快捷问题     │    │ • 配方收藏    │    │ • 营养计算    │
│               │    │ • 配方分享    │    │ • 健康评估    │
└───────────────┘    └───────────────┘    └───────────────┘
        │                    │                    │
        └────────────────────┼────────────────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │    个人中心      │
                    │   (profile)     │
                    │                 │
                    │ • 对话历史       │
                    │ • 我的收藏       │
                    │ • 诊断历史       │
                    │ • 设置           │
                    └─────────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
        ▼                    ▼                    ▼
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│   体质诊断     │    │     搜索       │    │   配方对比    │
│(health-check) │    │   (search)    │    │  (compare)    │
│               │    │               │    │               │
│ • 15题问卷    │    │ • 食材搜索    │    │ • 多选配方    │
│ • 体质分析    │    │ • 配方搜索    │    │ • 维度对比    │
│ • AI推荐      │    │ • 联想搜索    │    │               │
└───────────────┘    └───────────────┘    └───────────────┘
```

---

## 四、组件结构

### 4.1 组件清单（18个组件）

#### 核心组件（8个）

| 组件名称 | 用途 | 所属模块 | 优先级 |
|---------|------|---------|--------|
| FormulaCard | 配方卡片展示 | 配方管理 | P0 |
| ChatBubble | 对话气泡（用户/AI） | AI对话 | P0 |
| HamburgerMenu | 汉堡侧栏菜单（三条横杠） | 导航 | P0 |
| TypingIndicator | 打字机动画指示器 | AI对话 | P0 |
| Disclaimer | 免责声明组件 | 合规 | P0 |
| LoadingSkeleton | 骨架屏加载 | 通用 | P0 |
| ImageLazyLoad | 图片懒加载 | 通用 | P0 |
| NutritionLabel | 营养成分表展示 | 配料分析 | P0 ⭐ |

#### 业务组件（7个）

| 组件名称 | 用途 | 所属模块 | 优先级 |
|---------|------|---------|--------|
| InputPanel | 配料输入面板 | 配料分析 | P0 ⭐ |
| IngredientDetail | 成分详情展示 | 配料分析 | P0 ⭐ |
| HealthScore | 健康评分展示 | 配料分析 | P0 ⭐ |
| ImprovementSuggestion | 改进建议展示 | 配料分析 | P0 ⭐ |
| QuestionStep | 体质诊断单题组件 | 体质诊断 | P1 |
| ResultCard | 诊断结果卡片 | 体质诊断 | P1 |
| SharePoster | 分享海报生成 | 通用 | P1 |

#### 工具组件（3个）

| 组件名称 | 用途 | 优先级 |
|---------|------|--------|
| SafeArea | 安全区域适配 | P0 |
| ErrorBoundary | 错误边界 | P0 |
| SearchBar | 搜索输入框 | P1 |

---

## 五、API接口设计

### 5.1 认证接口

| 接口 | 方法 | 功能 | 后端支撑 |
|------|------|------|---------|
| /api/v1/wechat/login | POST | 微信授权登录 | 需开发 |
| /api/v1/wechat/bind | POST | 绑定微信账号 | 需开发 |
| /api/v1/auth/refresh | POST | Token刷新 | 已有 |

### 5.2 配方接口

| 接口 | 方法 | 功能 | 后端支撑 |
|------|------|------|---------|
| /api/v1/formulas | GET | 配方列表（精简版） | 需适配 |
| /api/v1/formulas/{id} | GET | 配方详情（精简版） | 需适配 |
| /api/v1/formulas/favorite | POST | 收藏/取消收藏 | 需开发 |
| /api/v1/formulas/images/upload | POST | 图片上传 | 需开发 |

### 5.3 AI对话接口

| 接口 | 方法 | 功能 | 后端支撑 |
|------|------|------|---------|
| /api/v1/ai/chat/stream | POST | 流式对话 | ✅ 已有 |
| /api/v1/ai/generate | POST | 配方生成 | ✅ 已有 |
| /api/v1/ai/safety-check | POST | 安全检测 | ✅ 已有 |

### 5.4 营养分析接口 ⭐ 新增

| 接口 | 方法 | 功能 | 后端支撑 |
|------|------|------|---------|
| /api/v1/nutrition/analyze | POST | 配料表分析 | 需开发 |
| /api/v1/nutrition/calculate | POST | 营养标签计算 | 需开发 |
| /api/v1/nutrition/database | GET | 营养数据库查询 | 需开发 |
| /api/v1/nutrition/safety-check | POST | 安全审查 | 需开发 |

### 5.5 搜索接口

| 接口 | 方法 | 功能 | 后端支撑 |
|------|------|------|---------|
| /api/v1/search/herbs | GET | 食材搜索 | ✅ 已有 |
| /api/v1/search/formulas | GET | 配方搜索 | ✅ 已有 |

### 5.6 移动端接口

| 接口 | 方法 | 功能 | 后端支撑 |
|------|------|------|---------|
| /api/v1/mobile/dashboard | GET | 移动端仪表盘 | ✅ 已有 |
| /api/v1/mobile/notifications | GET | 通知列表 | ✅ 已有 |
| /api/v1/mobile/notifications/{id}/read | POST | 标记已读 | ✅ 已有 |
| /api/v1/mobile/trace/{batch_id} | GET | 溯源查询 | ✅ 已有 |

---

## 六、数据库设计

### 6.1 新增表结构

```sql
-- 配料表分析记录表
CREATE TABLE ingredient_analysis (
    id BIGSERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    tenant_id INTEGER NOT NULL,
    
    -- 输入数据
    ingredients JSONB NOT NULL,  -- [{"name": "黄芪", "amount_g": 10}, ...]
    total_weight_g NUMERIC(10,2) NOT NULL,
    serving_size_g NUMERIC(10,2),
    
    -- 分析结果
    nutrition_label JSONB,       -- 营养成分表
    health_score INTEGER,        -- 健康评分（0-100）
    health_assessment JSONB,     -- 健康评估
    safety_check JSONB,          -- 安全审查
    improvements TEXT[],         -- 改进建议
    
    -- 元数据
    input_mode VARCHAR(20),      -- 'photo' | 'manual' | 'voice'
    analysis_time_ms INTEGER,
    
    -- 时间戳
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_ingredient_analysis_user ON ingredient_analysis(user_id);
CREATE INDEX idx_ingredient_analysis_tenant ON ingredient_analysis(tenant_id);
CREATE INDEX idx_ingredient_analysis_created ON ingredient_analysis(created_at DESC);

-- 成分索引表（用于搜索）
CREATE TABLE ingredient_index (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    pinyin VARCHAR(100),
    category VARCHAR(50),        -- '补气类' | '补血类' | '补阴类' | '补阳类'
    is_food_homology BOOLEAN DEFAULT false,
    nutrition_data JSONB,        -- 营养成分数据
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

---

## 七、核心服务设计

### 7.1 营养标签生成器（已有）

```python
# backend/app/services/nutrition/nutrition_label_generator.py
class NutritionLabelGenerator:
    """
    营养成分表生成器
    
    核心算法（GB 28050标准）：
    1. 按添加量加权计算各营养素的绝对总量
    2. 归一化为 per_100g
    3. 按比例缩放 per_serving
    4. 计算 NRV%
    5. 能量一致性校验
    6. 营养声称检测
    """
    
    def calculate_label(
        self,
        ingredients: List[Dict],
        total_weight_g: float,
        serving_size_g: float = 100.0,
    ) -> Dict[str, Any]:
        """生成完整营养成分表数据"""
        pass
```

### 7.2 营养数据库（已有）

```python
# backend/app/services/nutrition/nutrition_database.py
HERB_NUTRITION_DB = {
    "黄芪": {"energy": 1463.4, "protein": 20.7, "fat": 0.8, ...},
    "人参": {"energy": 1622.7, "protein": 16.1, "fat": 1.4, ...},
    # ... 覆盖50+味药食同源药材
}
```

### 7.3 安全审查服务（需新增）

```python
# backend/app/services/safety_checker.py
class SafetyChecker:
    """安全审查服务"""
    
    def check(
        self,
        ingredients: List[Any],
        user_allergens: List[str] = None,
        target_population: str = "adult",
    ) -> Dict[str, Any]:
        """
        安全审查
        
        Returns:
            {
                "is_safe": bool,
                "warnings": List[str],
                "contraindications": List[str],
                "allergens_found": List[str],
                "severity": str
            }
        """
        pass
```

### 7.4 健康评估服务（需新增）

```python
# backend/app/services/health_evaluator.py
class HealthEvaluator:
    """健康评估服务"""
    
    def evaluate(
        self,
        ingredients: List[Any],
        nutrition_label: Dict[str, Any],
        user_allergens: List[str] = None,
    ) -> Dict[str, Any]:
        """
        健康评估
        
        Returns:
            {
                "overall_health": str,
                "benefits": List[str],
                "concerns": List[str],
                "suitable_for": List[str],
                "not_suitable_for": List[str]
            }
        """
        pass
```

---

## 八、前端代码结构

### 8.1 目录结构

```
miniprogram/
├── src/
│   ├── api/                          # 请求层
│   │   ├── request.ts                # wx.request封装（降级方案）
│   │   ├── stream.ts                 # fetch API流式请求（推荐）
│   │   ├── auth.ts                   # 认证API
│   │   ├── chat.ts                   # 对话API
│   │   ├── formula.ts                # 配方API
│   │   ├── nutrition.ts              # 营养分析API ⭐
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
│   │   ├── ingredient-analysis/      # 配料表分析（分包）⭐
│   │   │   ├── index.tsx
│   │   │   └── components/
│   │   │       ├── InputPanel.tsx
│   │   │       ├── AnalysisResult.tsx
│   │   │       ├── NutritionLabel.tsx
│   │   │       ├── IngredientDetail.tsx
│   │   │       ├── HealthScore.tsx
│   │   │       └── ImprovementSuggestion.tsx
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
│   │   ├── useOffline.ts             # 离线同步Hook
│   │   └── useNutrition.ts           # 营养分析Hook ⭐
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
│   │   ├── chat.types.ts             # 对话类型
│   │   └── nutrition.types.ts        # 营养分析类型 ⭐
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

---

## 九、开发计划

### 9.1 里程碑概览

| 阶段 | 周期 | 核心任务 | 交付物 |
|------|------|---------|--------|
| **Phase 1** | 第1-2周 | 核心功能 | 登录、对话、配方浏览、配料分析、隐私合规 |
| **Phase 2** | 第3-4周 | 增值功能 | 体质诊断、收藏、分享、语音输入 |
| **Phase 3** | 第5-6周 | 扩展功能 | 订阅消息、离线缓存、扫码溯源 |
| **Phase 4** | 第7-8周 | 优化与测试 | 性能优化、真机测试、微信审核 |

### 9.2 详细任务清单

#### Phase 1：核心功能（第1-2周）

**后端任务（第1周）**
- [ ] 创建`nutrition_router.py`
- [ ] 实现`/api/v1/nutrition/analyze`接口
- [ ] 实现`/api/v1/nutrition/calculate`接口
- [ ] 实现`/api/v1/nutrition/safety-check`接口
- [ ] 创建`SafetyChecker`服务
- [ ] 创建`HealthEvaluator`服务
- [ ] 数据库迁移脚本

**前端任务（第1-2周）**
- [ ] 项目初始化（Taro + React + TypeScript）
- [ ] 微信登录流程
- [ ] AI对话页面（流式输出）
- [ ] 配方浏览页面（列表+详情）
- [ ] **配料表分析页面** ⭐
- [ ] 隐私合规模块（弹窗+政策页）
- [ ] 底部导航TabBar

#### Phase 2：增值功能（第3-4周）

- [ ] 体质诊断页面
- [ ] 个人中心（对话历史、收藏）
- [ ] 搜索功能
- [ ] 配方对比功能
- [ ] 分享海报生成
- [ ] 语音输入功能

#### Phase 3：扩展功能（第5-6周）

- [ ] 订阅消息
- [ ] 离线缓存
- [ ] 扫码溯源（可选）
- [ ] 性能优化

#### Phase 4：优化与测试（第7-8周）

- [ ] 真机测试
- [ ] 性能测试
- [ ] 微信审核准备
- [ ] Bug修复
- [ ] 正式上线

---

## 十、技术风险与应对

| 风险 | 影响 | 应对措施 |
|------|------|---------|
| 微信OCR识别准确率不高 | 用户体验差 | 提供手动输入作为降级方案 |
| 营养数据库覆盖不足 | 分析结果不准确 | 建立用户反馈机制，持续补充数据 |
| 复杂配料解析困难 | 分析失败 | 引入AI辅助解析，简化输入流程 |
| 小程序包体积限制 | 加载慢 | 使用分包加载，图片压缩 |
| 流式输出兼容性问题 | 部分版本不支持 | 提供轮询降级方案 |

---

## 十一、预算估算

| 项目 | 金额 | 说明 |
|------|------|------|
| 微信小程序认证 | ¥300/年 | 企业认证 |
| 服务器（首年） | ¥12,000/年 | 云服务器2核4G |
| 数据库（首年） | ¥6,000/年 | PostgreSQL云数据库 |
| CDN存储（首年） | ¥3,000/年 | 图片和文件存储 |
| 短信服务（首年） | ¥2,000/年 | 验证码短信 |
| 开发人力 | ¥30,000 | 8周开发 |
| **首年总计** | **¥56,000** | |

---

## 十二、总结

### 12.1 方案可行性结论

✅ **技术可行**：后端SSE端点完整，前端fetch API消费正确

✅ **架构合理**：Taro跨端框架，分包加载，状态管理规范

✅ **合规完善**：隐私政策、免责声明、健康数据保护齐全

✅ **性能达标**：分包预下载、图片懒加载、缓存策略完整

✅ **预算可控**：首年¥56,000，月运营成本¥2,500

### 12.2 关键结论

1. **定位清晰**：小程序聚焦C端便捷服务，不做B端复杂功能
2. **三大核心**：AI对话、配方管理、配料表分析并列核心模块
3. **API复用**：80%后端API可直接复用，降低开发成本
4. **差异化竞争力**：配料表分析是小程序的核心差异化功能
5. **分阶段实施**：建议按Phase逐期交付，确保核心功能先上线

### 12.3 下一步行动

1. **立即行动**
   - [x] 确认完整开发方案
   - [ ] 申请微信小程序账号
   - [ ] 配置微信开发者工具
   - [ ] 初始化Taro项目脚手架

2. **第1周行动**
   - [ ] 搭建项目结构
   - [ ] 实现请求层和流式输出
   - [ ] 开发微信登录接口（后端）
   - [ ] 开发营养分析API（后端）
   - [ ] 设计隐私政策页面

---

**结论：V2.0方案完整可行，建议按此方案启动开发。**

---

*方案版本：V2.0 | 编制：RMFOOD架构组 | 日期：2026-09-06*
