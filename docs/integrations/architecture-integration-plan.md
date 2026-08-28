# RMFOOD 项目架构集成方案

## 当前问题诊断

### 前端散落点
| 位置 | 问题 | 文件数 |
|------|------|--------|
| `components/ai/` + `features/` | 组件分散在两层目录 | ~120 文件 |
| `components/ai/hooks/` + `features/hooks/` | Hooks 分散 | 27 hooks |
| `features/services/` | 38 个服务文件过于膨胀 | 38 文件 |
| `features/components/` + `components/ai/components/` | 组件重复注册 | ~50 文件 |

### 后端散落点
| 位置 | 问题 | 文件数 |
|------|------|--------|
| `api/ai.py` + `api/v1/ai_router.py` | 两个 AI 路由冲突 | 2 文件 |
| `services/ai/` | 核心 AI 服务与算法混合 | 15+ 文件 |
| `services/` 根目录 | 服务散落 | 20+ 文件 |

## 集成方案

### 前端架构

```
src/components/ai/
├── ChatTab/                    # 智能对话 (核心)
│   ├── ChatTab.tsx
│   ├── hooks/
│   │   ├── useChatMessages.ts
│   │   ├── useChatSendMessage.ts
│   │   ├── useChatCallbacks.ts
│   │   └── useThinkingProcessV3.ts
│   ├── services/
│   │   ├── chatService.ts
│   │   ├── contextManager.ts
│   │   └── storageService.ts
│   └── components/
│       ├── ChatMessages.tsx
│       ├── ChatInputPro.tsx
│       ├── ChatSidebarV4.tsx
│       ├── EnhancedContentRenderer.tsx
│       ├── TypewriterText.tsx
│       └── ChatHistory.tsx
│
├── Generate/                   # 配方生成
│   └── ...
├── Safety/                     # 安全检查
│   └── ...
├── Peptide/                    # 肽分析
│   └── ...
├── shared/                     # 共享组件
│   ├── charts/                 # 图表
│   ├── ui/                     # UI组件
│   └── utils/                  # 工具函数
│
└── engines/                    # AI 引擎层
    ├── hybridNLPEngineV2.ts
    ├── promptEngineeringFramework.ts
    └── ...
```

### 后端架构

```
backend/app/
├── api/v1/                     # API 路由
│   ├── ai_router.py            # 唯一 AI 路由 (/chat, /generate)
│   └── ...                     # 其他路由
│
├── services/
│   ├── ai/                     # AI 服务层
│   │   ├── chat_engine.py      # 对话引擎
│   │   ├── provider_factory.py # LLM 提供商
│   │   ├── generation_service.py
│   │   └── algorithms/         # 算法库
│   │       ├── bayesian.py
│   │       ├── genetic.py
│   │       └── neural.py
│   └── ...                     # 其他服务
│
└── models/                     # 数据模型
    └── ...
```

## 实施步骤

### Step 1: 前端整合
1. 将 `features/hooks/` → `ChatTab/hooks/`
2. 将 `features/services/` → `ChatTab/services/`
3. 合并 `components/` 与 `features/components/`

### Step 2: 后端整合
1. 删除 `api/ai.py` 中与 `ai_router.py` 冲突的路由
2. 将算法文件移入 `services/ai/algorithms/`
3. 清理重复的服务文件

### Step 3: 统一导入路径
1. 更新所有 import 语句
2. 验证 TypeScript 编译
3. 验证后端路由
