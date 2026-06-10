## gstack

- For all web browsing, use the `/browse` skill from gstack. Never use `mcp__claude-in-chrome__*` tools.
- Available gstack skills: `/office-hours`, `/plan-ceo-review`, `/plan-eng-review`, `/plan-design-review`, `/design-consultation`, `/design-shotgun`, `/design-html`, `/review`, `/ship`, `/land-and-deploy`, `/canary`, `/benchmark`, `/browse`, `/connect-chrome`, `/qa`, `/qa-only`, `/design-review`, `/setup-browser-cookies`, `/setup-deploy`, `/setup-gbrain`, `/retro`, `/investigate`, `/document-release`, `/document-generate`, `/codex`, `/cso`, `/autoplan`, `/plan-devex-review`, `/devex-review`, `/careful`, `/freeze`, `/guard`, `/unfreeze`, `/gstack-upgrade`, `/learn`.

## Skill routing

When the user's request matches an available skill, invoke it via the Skill tool. When in doubt, invoke the skill.

Key routing rules:
- Product ideas/brainstorming → invoke /office-hours
- Strategy/scope → invoke /plan-ceo-review
- Architecture → invoke /plan-eng-review
- Design system/plan review → invoke /design-consultation or /plan-design-review
- Full review pipeline → invoke /autoplan
- Bugs/errors → invoke /investigate
- QA/testing site behavior → invoke /qa or /qa-only
- Code review/diff check → invoke /review
- Visual polish → invoke /design-review
- Ship/deploy/PR → invoke /ship or /land-and-deploy
- Save progress → invoke /context-save
- Resume context → invoke /context-restore
- Author a backlog-ready spec/issue → invoke /spec

## RMFOOD 项目架构规范

- 架构决策记录位于 `docs/adr/index.md` — 重大架构变更前应先查阅和记录
- 六边形架构（Ports & Adapters）：领域层零外部依赖，适配器实现接口
- 领域驱动设计（DDD）：按有界上下文组织模块，参见 ADR-004

## AI 对话专业版组件

位置：`frontend/src/components/ai/features/components/pro/`

| 组件 | 功能 |
|:-----|:------|
| `ChatMessages` | 消息列表（空状态卡片、消息气泡、复制/重试/删除、动画） |
| `ChatInputPro` | 输入区（模型选择器、字符计数、Enter/Shift+Enter） |
| `ChatSidebar` | 思考过程侧栏（分步展示、状态指示器、展开详情） |
| `MarkdownRenderer` | 零依赖 Markdown 渲染（标题/列表/代码/表格/链接） |
| `TypewriterText` | 打字机动画（逐字显示 AI 回复、跳过机制） |
| `ChatHistory` | 对话历史管理（新建/切换/重命名/删除、localStorage 持久化） |

使用方式：`import { ChatMessages } from './components/pro'`
