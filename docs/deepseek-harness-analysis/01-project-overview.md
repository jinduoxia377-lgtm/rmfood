# DeepSeek Harness 项目深度分析报告

## 一、项目概览

**项目名称**: DeepSeek Harness (`dsh`)
**开发者**: DeepSeek AI
**仓库**: https://github.com/deepseek-ai/deepseek-harness
**许可证**: MIT
**版本状态**: Developer Preview (迭代中，会有兼容性破坏)

### 1.1 项目定位

DeepSeek Harness 是一个**开源智能体框架（Agent Harness）**，采用 **"Everything-is-a-plugin"（一切皆插件）** 架构，基于 [Cordis](https://github.com/cordiverse/cordis) 框架构建。

核心设计理念：
- 无特权核心：每个组件（模型适配器、工具注册表、会话日志、智能体循环）都是可替换的插件
- 扩展方式：在插件树旁挂载新插件，注册是效果（effect），卸载时自动撤销
- 多语言支持：TypeScript/Node.js 主框架 + Python SDK

### 1.2 运行模式

| 模式 | 命令 | 说明 |
|------|------|------|
| Web UI | `npx @deepseek-ai/dsh web` | 浏览器界面，默认 127.0.0.1:3080 |
| Headless | `pnpm dsh --profile headless "task"` | 无服务器的一次性运行 |
| SDK | `pnpm dsh --profile sdk` | JSON-RPC 服务端 |
| ACP | `pnpm dsh --profile acp` | 自动化专用 Agent Client Protocol |

---

## 二、项目目录结构

```
deepseek-harness/
├── vendor/                 # Vendored Cordis 源码
├── packages/               # 核心工作区 (@deepseek-ai/dsh-<pkg>)
│   ├── core/               # 产品 API 主干
│   │   ├── session/        # 会话日志（事件溯源）
│   │   ├── system-prompt/  # 提示词组装
│   │   ├── tools/          # 工具注册表与执行管道
│   │   ├── agent/          # Agent 接口与生命周期
│   │   ├── agent-loop/     # 默认驱动实现
│   │   └── scope/          # 作用域注册原语
│   ├── llm/                # LLM 能力（Service Definition/Consumer）
│   ├── subagent/           # 子智能体能力
│   ├── workflow/           # 工作流能力
│   ├── shell/              # Shell 能力（bash/pwsh）
│   ├── fs/                 # 文件系统能力
│   ├── compaction/         # 上下文压缩能力
│   ├── session/            # 持久化会话
│   ├── identity/           # 匿名身份
│   ├── settings/           # 用户设置
│   ├── credentials/        # 凭据管理
│   ├── hooks/              # Hook 桥接
│   ├── bundle/             # 可安装的 Bundle 层
│   └── ...
├── python/                 # Python SDK
├── native/                 # Node addon（landlock-sandbox）
├── apps/                   # 应用程序
├── docs/                   # 架构文档
├── scripts/                # 构建脚本
├── snapshots/              # 快照测试
└── website/                # 文档站点（VitePress）
```

---

## 三、核心架构设计

### 3.1 Cordis 框架

Cordis 是一个**时空组合性编程范式**框架（论文: *A Programming Paradigm for Spatiotemporal Composability*）。

核心概念：
- **Plugin（插件）**: 贡献服务、类型化事件、可逆效果到共享上下文
- **Service Definition（服务定义）**: 抽象接口（`ctx.<key>`）
- **Service Provider（服务提供商）**: 具体实现
- **Consumer（消费者）**: 使用服务的组件

### 3.2 配置文件格式

使用 `cordis.yml` 声明式配置，支持插件挂载：

```yaml
- name: '@deepseek-ai/dsh-agent-loop'
  config:
    maxParallelToolCalls: 10
    agents:
      - id: 'main'
        provider: deepseek
        model: deepseek-chat
        reasoningEffort: high
```

### 3.3 Profiles 与 Bundles

- **Profile**: 命名组合，存储在 Harness 主目录
  - `web`: Web UI 模式
  - `headless`: 无服务器一次性运行
  - `sdk`: SDK 服务
  - `acp`: 自动化专用
- **Bundle**: 分发格式，包含 Cordis 配置行和挂载代码

---

## 四、关键算法索引

| 算法类别 | 核心模块 | 描述 |
|----------|----------|------|
| Agent Loop | `dsh-agent-loop` | Turn/Step 驱动机制 |
| 事件溯源 | `dsh-session` | 会话日志持久化 |
| 上下文压缩 | `dsh-compaction` | 长对话管理 |
| 工具管道 | `dsh-tools` | 工具执行与调度 |
| Subagent | `dsh-subagent` | 子智能体委托 |
| Workflow | `dsh-workflow` | 脚本化编排 |
| Agent Teams | `dsh-agent-team` | 多智能体协作 |

---

## 五、设计原则

1. **Model-visible ⟺ Logged**: 所有模型可见的内容必须可从会话日志重建
2. **Plugins, not loop changes**: 新行为挂载在文档化的扩展点上
3. **Capability Seam**: 每个能力由 Service Definition + Provider + Consumer 组成
4. **Scope-based isolation**: 作用域隔离，全局注册 vs 智能体级注册
5. **Typed events with declaration merging**: 类型安全的事件系统

---

*分析日期: 2026-09-03*
*数据来源: https://github.com/deepseek-ai/deepseek-harness*
