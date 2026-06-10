# RMFOOD 大模型集成模块 — 全面优化升级技术方案

> **版本**: v1.0 | **日期**: 2026-06-08 | **状态**: 待评审
> **作者**: AI 系统架构专家组
> **适用范围**: `backend/app/services/llm_service.py` → `frontend/src/api/modelClient.ts` 全链路

---

## 目录

1. [现状诊断与根因分析](#一现状诊断与根因分析)
2. [问题诊断机制（Module 1）](#二module-1-智能诊断引擎)
3. [错误处理与恢复机制（Module 2）](#三module-2-智能错误处理与自愈系统)
4. [配置流程优化（Module 3）](#四module-3-配置流程重构)
5. [状态监控系统（Module 4）](#五module-4-实时监控面板)
6. [性能优化（Module 5）](#六module-5-性能优化)
7. [文档与指引完善（Module 6）](#七module-6-文档体系)
8. [测试方案（Module 7）](#八module-7-测试方案)
9. [架构总图与实施路线图](#九架构总图与实施路线图)

---

## 一、现状诊断与根因分析

### 1.1 "inactive" 问题根因定位

通过全链路代码审计，**"连接测试完成但模型状态异常: inactive"** 的完整因果链如下：

```
用户操作: 点击"连接测试" / 页面加载触发 useQuery(['ai-model-status'])
    │
    ▼
前端 ModelClient.getModelStatus()
    │  GET /api/v1/ai/models/status (注意: 走的是 ai_router.py, 不是 ai.py!)
    │
    ▼
后端 ai_router.py 第794行 get_ai_model_status():
    │  判断条件: settings.ai_available
    │  = any([self.openai_api_key, self.vllm_endpoint])
    │
    ├── .env 中 OPENAI_API_KEY=空 ──→ status="unconfigured"
    │
    └── .env 中有 API Key 但实际调用失败 ──→ ??? (当前代码无法区分!)
       ⚠️ 关键缺陷: ai_router.py 只做静态配置检查,
          不执行运行时连通性测试, 所以永远不会返回 "inactive" 的真正原因!
    │
    ▼
返回 { llm: { status: "inactive", note: "..." } }
    │
    ▼
ChatTab.tsx: llmAvailable = false → 头像灰点 + 模型名称显示异常
```

### 1.2 核心缺陷清单

| # | 缺陷 | 严重度 | 影响范围 |
|---|------|--------|---------|
| D-01 | **两套 `/models/status` 实现不一致** — `ai.py` 做运行时检测，`ai_router.py` 仅静态判断 | P0 | 状态展示失真 |
| D-02 | **无运行时连通性探测** — 有 Key ≠ 能连上，网络/API余额/模型名错误均不可知 | P0 | inactive 无诊断信息 |
| D-03 | **路由冲突** — `api/ai.py` 和 `api/v1/ai_router.py` 同名路由共存 | P0 | 行为不可预测 |
| D-04 | **Fallback 链未暴露给前端** — provider_factory 的健康检查结果未传递到 UI | P1 | 用户不知道备用链状态 |
| D-05 | **错误分类不完整** — 前端只区分 8 种错误类型，缺少 quota_exceeded/model_not_found/context_too_long 等 | P1 | 错误提示模糊 |
| D-06 | **无连接池管理** — 每次 LLM 调用新建 HTTP 连接 | P2 | 高并发性能差 |
| D-07 | **配置预测试缺失** — 用户保存 API Key 后无即时验证 | P1 | 配置错误延迟发现 |

---

## 二、Module 1: 智能诊断引擎

### 2.1 架构设计

```
┌──────────────────────────────────────────────────────────────┐
│                   DiagnosticEngine (新增)                     │
│                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ ConfigCheck  │  │Connectivity │  │   CapabilityCheck   │  │
│  │ 配置完整性   │  │ 连通性探测  │  │     能力验证        │  │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘  │
│         │                │                      │             │
│         ▼                ▼                      ▼             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              DiagnosticReport (标准化输出)            │    │
│  │  {                                                    │    │
│  │    overall: "healthy" | "degraded" | "critical",      │    │
│  │    score: 0-100,                                      │    │
│  │    checks: [                                          │    │
│  │      { id, name, status, detail, suggestion, fixable }│    │
│  │    ],                                                 │    │
│  │    timeline: [...],                                   │    │
│  │    remediation: { auto, manual }                       │    │
│  │  }                                                    │    │
│  └─────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────┘
```

### 2.2 三级检测流水线

#### Level 1: ConfigCheck（配置完整性，< 10ms）

```python
# backend/app/services/ai/diagnostic_engine.py (新增)

@dataclass
class CheckResult:
    check_id: str
    name: str
    status: Literal["pass", "warn", "fail", "skip"]
    detail: str
    suggestion: str
    fixable: bool = True
    auto_fix_available: bool = False

class ConfigChecker:
    """Level 1: 静态配置校验"""

    async def check(self) -> list[CheckResult]:
        results = []
        settings = get_settings()

        # C-01: API Key 存在性
        if not settings.openai_api_key:
            results.append(CheckResult(
                check_id="C-01", name="API Key 配置",
                status="fail",
                detail="OPENAI_API_KEY 未设置",
                suggestion="在 ModelConfigPanel 或 .env 文件中配置有效的 API Key",
                fixable=True,
            ))
        elif len(settings.openai_api_key) < 20:
            results.append(CheckResult(
                check_id="C-01", name="API Key 配置",
                status="warn",
                detail=f"API Key 长度异常 ({len(settings.openai_api_key)} 字符)",
                suggestion="请确认 Key 完整复制，通常应 ≥ 20 字符",
            ))
        else:
            results.append(CheckResult(
                check_id="C-01", name="API Key 配置",
                status="pass",
                detail=f"已配置 (前缀: {settings.openai_api_key[:8]}...)",
            ))

        # C-02: Provider 合法性
        valid_providers = {"openai", "deepseek", "zhipu", "qwen", "custom"}
        if settings.llm_provider not in valid_providers:
            results.append(CheckResult(
                check_id="C-02", name="Provider 类型",
                status="fail",
                detail=f"未知 provider: '{settings.llm_provider}'",
                suggestion=f"可选值: {', '.join(valid_providers)}",
            ))

        # C-03: Base URL 格式
        if settings.openai_base_url:
            parsed = urlparse(settings.openai_base_url)
            if parsed.scheme not in ("http", "https"):
                results.append(CheckResult(..., status="fail", ...))

        # C-04: 模型名非空
        if not settings.llm_model:
            results.append(CheckResult(
                check_id="C-04", name="默认模型",
                status="warn",
                detail="LLM_MODEL 未设置，将使用 Provider 默认值",
                suggestion="建议显式指定模型名以避免隐式行为",
            ))

        return results
```

#### Level 2: ConnectivityCheck（连通性探测，< 5s）

```python
class ConnectivityChecker:
    """Level 2: 运行时连通性探测 — 发送轻量级请求验证端到端可用性"""

    def __init__(self):
        self.timeout = httpx.AsyncClient(timeout=10.0)

    async def check(self, config: LLMConfig) -> list[CheckResult]:
        results = []

        # N-01: DNS 解析
        try:
            hostname = urlparse(config.base_url).hostname
            socket.gethostbyname(hostname)
            results.append(CheckResult("N-01", "DNS 解析", "pass", f"{hostname} → OK"))
        except socket.gaierror:
            results.append(CheckResult("N-01", "DNS 解析", "fail",
                f"无法解析 {hostname}", "检查 Base URL 是否正确 / DNS 配置"))

        # N-02: TCP 连接
        try:
            parsed = urlparse(config.base_url)
            port = parsed.port or (443 if parsed.scheme == "https" else 80)
            _, writer = await asyncio.wait_for(
                asyncio.open_connection(hostname, port), timeout=5.0
            )
            writer.close()
            results.append(CheckResult("N-02", "TCP 连通", "pass", f"{hostname}:{port}"))
        except asyncio.TimeoutError:
            results.append(CheckResult("N-02", "TCP 连通", "fail", "连接超时(5s)",
                "检查网络 / 代理设置 / 防火墙规则"))
        except OSError as e:
            results.append(CheckResult("N-02", "TCP 连通", "fail", str(e)))

        # N-03: HTTP 探测 (GET /models 或等效端点)
        try:
            headers = {"Authorization": f"Bearer {config.api_key}"}
            resp = await self.timeout.get(
                f"{config.base_url.rstrip('/')}/models",
                headers=headers,
            )
            if resp.status_code == 200:
                models = resp.json().get("data", [])
                model_names = [m["id"] for m in models]
                target_in_list = config.model in model_names if config.model else True
                results.append(CheckResult("N-03", "API 可达性", "pass",
                    f"HTTP {resp.status_code}, 可用模型 {len(models)} 个"))
                if config.model and not target_in_list:
                    results.append(CheckResult("N-03b", "模型可用性", "warn",
                        f"模型 '{config.model}' 不在可用列表中",
                        f"可选: {model_names[:5]}..."))
            elif resp.status_code == 401:
                results.append(CheckResult("N-03", "API 认证", "fail",
                    "HTTP 401: API Key 无效或已过期",
                    "检查 Key 是否正确 / 账户是否有效 / 余额是否充足"))
            elif resp.status_code == 429:
                results.append(CheckResult("N-03", "API 配额", "fail",
                    "HTTP 429: 请求频率超限或配额耗尽",
                    "等待冷却或升级套餐"))
            else:
                results.append(CheckResult("N-03", "API 响应", "warn",
                    f"HTTP {resp.status_code}: 非预期响应",
                    "查看提供商文档了解此状态码含义"))
        except httpx.ConnectError as e:
            results.append(CheckResult("N-03", "API 可达性", "fail", str(e)))
        except Exception as e:
            results.append(CheckResult("N-03", "API 可达性", "fail", str(e)))

        return results
```

#### Level 3: CapabilityCheck（能力验证，< 15s）

```python
class CapabilityChecker:
    """Level 3: 发送最小化推理请求，验证模型实际可调用"""

    async def check(self, config: LLMConfig) -> list[CheckResult]:
        results = []

        # P-01: 最小推理测试 (发送 "Hi" 并验证响应格式)
        try:
            start = time.monotonic()
            response = await llm_service.chat(
                messages=[{"role": "user", "content": "Hi"}],
                max_tokens=5,
                temperature=0,
            )
            latency_ms = (time.monotonic() - start) * 1000

            if response and len(response.strip()) > 0:
                level = "pass" if latency_ms < 5000 else "warn"
                results.append(CheckResult("P-01", "推理能力", level,
                    f"首 token 延迟 ~{latency_ms:.0f}ms, 响应长度 {len(response)}"))
            else:
                results.append(CheckResult("P-01", "推理能力", "fail",
                    "模型返回空响应", "可能是模型名不匹配或服务异常"))

        except RuntimeError as e:
            error_str = str(e)
            if "401" in error_str:
                results.append(CheckResult("P-01", "推理能力", "fail",
                    "认证失败 (401)", "API Key 无效或权限不足"))
            elif "429" in error_str:
                results.append(CheckResult("P-01", "推理能力", "fail",
                    "配额限制 (429)", "账户余额不足或 RPM/TPM 超限"))
            elif "timeout" in error_str.lower():
                results.append(CheckResult("P-01", "推理能力", "fail",
                    "请求超时", "模型负载过高或网络不稳定"))
            else:
                results.append(CheckResult("P-01", "推理能力", "fail", error_str[:200]))

        except Exception as e:
            results.append(CheckResult("P-01", "推理能力", "fail", f"未知错误: {str(e)[:150]}"))

        # P-02: Token 限额探测 (从响应头估算)
        # P-03: 流式支持检测
        # ... (详见实现)

        return results
```

### 2.3 统一状态端点重构

合并两套 `/models/status` 为单一权威端点：

```python
# backend/app/api/v1/ai_router.py (重构)

@router.get("/models/status")
async def get_ai_model_status_v2(current_user = Depends(get_current_active_user)):
    """
    V2 模型状态端点 — 整合三级诊断引擎
    返回结构化的 DiagnosticReport，替代原来的简单 active/inactive 判断
    """
    from ..services.ai.diagnostic_engine import DiagnosticEngine

    engine = DiagnosticEngine()

    # 异步并行执行三级检测 (总耗时 ≈ max(L1, L2, L3) ≈ 15s)
    config_results, conn_results, capa_results = await asyncio.gather(
        engine.run_config_check(),
        engine.run_connectivity_check(),
        engine.run_capability_check(),  # 仅在前两级通过时执行
        return_exceptions=True,
    )

    report = engine.assemble_report(config_results, conn_results, capa_results)

    # 兼容旧版字段 (平滑过渡)
    legacy_status = "active" if report.overall == "healthy" else (
        "unconfigured" if report.overall == "critical" else "inactive"
    )

    return {
        # 新版: 结构化诊断报告
        "diagnostic": report.model_dump(),

        # 旧版兼容 (ChatTab.tsx 等现有消费者)
        "llm": {
            "status": legacy_status,
            "model": settings.llm_model or "",
            "provider": settings.llm_provider or "openai",
            "score": report.score,
            "last_checked": report.timestamp_iso,
        },
        # 子模型状态 (保持不变)
        "formula_gpt": { "status": "active", "mode": "local", "note": "规则引擎+本地模型" },
        # ...
    }
```

### 2.4 前端诊断面板组件

```typescript
// frontend/src/components/ai/features/components/pro/ModelDiagnosticPanel.tsx (新增)

interface DiagnosticPanelProps {
  report: DiagnosticReport | null
  isDiagnosing: boolean
  onRunDiagnostic: () => void
  onAutoFix: (checkId: string) => void
}

export function ModelDiagnosticPanel({ report, isDiagnosing, onRunDiagnostic, onAutoFix }: DiagnosticPanelProps) {
  // 渲染三级行检测结果，每项带状态图标 + 详细说明 + 一键修复按钮
  // 支持"正在诊断..."加载动画 + 进度条
}
```

---

## 三、Module 2: 智能错误处理与自愈系统

### 3.1 分层错误码体系

```
┌─────────────────────────────────────────────────────────┐
│                  ErrorTaxonomy (统一错误分类)              │
│                                                          │
│  Domain: AI_LLM                                          │
│  ├── AI_LLM_AUTH_001    API Key 格式无效                  │
│  ├── AI_LLM_AUTH_002    API Key 已过期/被撤销            │
│  ├── AI_LLM_AUTH_003    权限不足 (模型访问受限)           │
│  ├── AI_LLM_QUOTA_001   RPM (每分钟请求数) 超限           │
│  ├── AI_LLM_QUOTA_002   TPM (每分钟 Token 数) 超限        │
│  ├── AI_LLM_QUOTA_003   账户余额不足                      │
│  ├── AI_LLM_NET_001     DNS 解析失败                     │
│  ├── AI_LLM_NET_002     TCP 连接超时                      │
│  ├── AI_LLM_NET_003     TLS 握手失败                     │
│  ├── AI_LLM_MODEL_001   模型不存在                         │
│  ├── AI_LLM_MODEL_002   模型版本不兼容                     │
│  ├── AI_LLM_MODEL_003   Context 长度超限                  │
│  ├── AI_LLM_SERVER_001  服务端内部错误 (5xx)              │
│  ├── AI_LLM_SERVER_002  服务过载 (529)                    │
│  └── AI_LLM_STREAM_001  SSE 流中断                       │
└─────────────────────────────────────────────────────────┘
```

### 3.2 多级重试策略矩阵

| 错误类别 | 重试策略 | 退避算法 | 最大次数 | 自动切换 |
|---------|---------|---------|---------|---------|
| 网络超时 (NET_002) | 立即重试 | 固定 1s | 3 | 否 |
| 服务过载 (SERVER_002) | 延迟重试 | 指数退避 (2^n) | 5 | 是→Fallback链 |
| RPM/TPM 超限 (QUOTA_001/002) | 冷却等待 | 固定 60s | 2 | 是→降级模型 |
| 余额不足 (QUOTA_003) | 不重试 | - | 0 | 是→提示充值 |
| 认证失败 (AUTH_001~003) | 不重试 | - | 0 | 否→提示重新配置 |
| 模型不存在 (MODEL_001) | 不重试 | - | 0 | 是→自动修正模型名 |
| 流中断 (STREAM_001) | 断点续传 | 固定 500ms | 3 | 否 |

### 3.3 Fallback 链增强

```python
# backend/app/services/ai/provider_factory.py (增强)

class EnhancedProviderFactory(LLMProviderFactory):
    """增强版 Provider 工厂 — 带自动切换和健康评分"""

    # Fallback 链优先级定义
    FALLBACK_CHAIN = [
        ("primary", 1.0),      # 主力模型 (满分权重)
        ("ollama_backup", 0.6), # 本地 Ollama (降级但可用)
        ("rule_engine", 0.3),   # 规则推理引擎 (保底)
    ]

    async def call_with_enhanced_fallback(
        self,
        messages: list[dict],
        task_type: TaskType = TaskType.CHAT,
    ) -> tuple[str, CallMetadata]:
        """
        带完整元数据的 Fallback 调用
        返回: (response_text, metadata包含使用的provider/延迟/重试次数等)
        """
        metadata = CallMetadata(attempted_providers=[], total_latency_ms=0)

        for provider_name, quality_weight in self.FALLBACK_CHAIN:
            provider = self.get_provider(provider_name)
            if not provider or not provider.is_healthy:
                metadata.attempted_providers.append({
                    "name": provider_name, "status": "skipped_unhealthy"
                })
                continue

            for attempt in range(self.max_retries_per_provider):
                try:
                    start = time.monotonic()
                    result = await provider.chat(messages)
                    latency = (time.monotonic() - start) * 1000

                    metadata.success_provider = provider_name
                    metadata.total_latency_ms += latency
                    metadata.quality_score = quality_weight
                    metadata.attempted_providers.append({
                        "name": provider_name, "status": "success",
                        "latency_ms": round(latency, 1),
                    })

                    # 成功 → 更新健康分数
                    provider.record_success()
                    return result, metadata

                except (RateLimitError, OverloadedError) as e:
                    # 可恢复错误 → 记录并尝试下一个 provider
                    provider.record_failure()
                    metadata.attempted_providers.append({
                        "name": provider_name, "status": f"recoverable:{e.code}",
                    })
                    break  # 跳出内层 retry, 进入下一个 provider

                except (AuthError, ModelNotFoundError) as e:
                    # 不可恢复错误 → 直接跳过该 provider
                    provider.mark_unhealthy(reason=str(e))
                    metadata.attempted_providers.append({
                        "name": provider_name, "status": f"fatal:{e.code}",
                    })
                    break

                except Exception as e:
                    provider.record_failure()
                    if attempt < self.max_retries_per_provider - 1:
                        await asyncio.sleep(2 ** attempt)  # 指数退避

        # 所有 Provider 均失败 → 最终降级
        fallback_response = await self._emergency_fallback(messages)
        metadata.success_provider = "emergency_fallback"
        return fallback_response, metadata
```

### 3.4 前端错误处理增强

```typescript
// frontend/src/components/ai/features/services/chatService.ts (增强)

const ENHANCED_ERROR_MAP: Record<string, ErrorResponseTemplate> = {
  // === 认证类 (不可自动恢复, 引导用户操作) ===
  'AI_LLM_AUTH_001': {
    type: 'AuthError',
    userMessage: 'API Key 格式无效',
    action: { label: '重新配置', route: '/settings/ai', icon: Settings },
    recoverable: false,
  },
  'AI_LLM_AUTH_002': {
    type: 'AuthExpiredError',
    userMessage: 'API Key 已过期或被撤销',
    action: { label: '更新 Key', route: '/settings/ai', icon: KeyRound },
    recoverable: false,
  },
  // === 配额类 (提示 + 冷却) ===
  'AI_LLM_QUOTA_001': {
    type: 'RateLimitedError',
    userMessage: '请求过于频繁，请稍后再试',
    action: { label: '查看配额', route: null, icon: Gauge },
    cooldownMs: 60_000,
    recoverable: true,
    retryAfterCooldown: true,
  },
  'AI_LLM_QUOTA_003': {
    type: 'QuotaExhaustedError',
    userMessage: 'API 余额不足，请充值后继续使用',
    action: { label: '前往充值', url: 'https://...', icon: CreditCard },
    recoverable: false,
  },
  // === 模型类 ===
  'AI_LLM_MODEL_001': {
    type: 'ModelNotFoundError',
    userMessage: `指定的模型 "${modelName}" 不存在`,
    action: { label: '选择其他模型', icon: SwitchCamera },
    autoFix: 'suggest_alternative_models',  // 自动推荐可用模型列表
    recoverable: true,
  },
  // === 网络类 (自动重试) ===
  'AI_LLM_NET_002': {
    type: 'ConnectionTimeoutError',
    userMessage: '连接 AI 服务超时',
    recoverable: true,
    autoRetry: { maxAttempts: 3, baseDelayMs: 1000, strategy: 'exponential' },
  },
}
```

---

## 四、Module 3: 配置流程重构

### 3.1 新配置流程状态机

```
                    ┌──────────────┐
                    │   IDLE       │
                    │  (空闲/已配置) │
                    └──────┬───────┘
                           │ 用户点击"修改配置"
                           ▼
                    ┌──────────────┐
              ┌─────│  EDITING     │◄──────┐
              │     │  (编辑中)     │       │
              │     └──────┬───────┘       │
              │            │ 保存           │ 取消
              │            ▼                │
              │     ┌──────────────┐        │
              │     │  VALIDATING  │────────┘
              │     │  (参数校验)   │
              │     └──────┬───────┘
              │            │ 校验通过
              │            ▼
              │     ┌──────────────┐     校验失败
              │     │  PRE_TESTING │────► 显示错误, 回 EDITING
              │     │  (预测试)     │
              │     └──────┬───────┘
              │            │ 测试成功
              │            ▼
              │     ┌──────────────┐     测试失败
              │     │  APPLYING    │────► 显示诊断报告, 回 EDITING
              │     │  (应用生效)   │
              │     └──────┬───────┘
              │            │ 完成
              │            ▼
              └────────▶│   ACTIVE     │
                       │  (生效运行)   │
                       └──────────────┘
```

### 3.2 实时参数验证器

```typescript
// frontend/src/components/ai/features/components/pro/ModelConfigWizard.tsx (新增)

interface ValidationRule {
  field: string
  validator: (value: string, allValues: Record<string, string>) => ValidationResult
  trigger: 'onChange' | 'onBlur' | 'onSubmit'
}

const CONFIG_VALIDATION_RULES: ValidationRule[] = [
  {
    field: 'apiKey',
    trigger: 'onBlur',
    validator: (value) => {
      if (!value) return { valid: false, error: 'API Key 不能为空' }
      if (value.length < 20) return { valid: false, error: 'Key 长度过短，可能不完整' }
      if (!/^sk-|^[a-zA-Z0-9]{20,}$/.test(value)) {
        return { valid: false, warn: 'Key 格式异常，但不一定有问题' }
      }
      return { valid: true }
    },
  },
  {
    field: 'baseUrl',
    trigger: 'onChange',
    validator: (value) => {
      if (!value) return { valid: true }  // 可选字段
      try {
        const url = new URL(value)
        if (!['http:', 'https:'].includes(url.protocol)) {
          return { valid: false, error: '必须以 http:// 或 https:// 开头' }
        }
      } catch {
        return { valid: false, error: 'URL 格式无效' }
      }
      return { valid: true }
    },
  },
  {
    field: 'model',
    trigger: 'onSubmit',
    validator: (value, ctx) => {
      if (!value && !ctx.provider?.includes('custom')) {
        return { valid: false, error: '请指定模型名称' }
      }
      return { valid: true }
    },
  },
]
```

### 3.3 配置模板管理

```yaml
# config/ai-providers.yaml (新增 — 内置模板库)

templates:
  - id: openai-gpt4o-mini
    name: OpenAI GPT-4o Mini (推荐)
    provider: openai
    base_url: https://api.openai.com/v1
    model: gpt-4o-mini
    max_tokens: 4096
    temperature: 0.7
    description: 高性价比通用模型，适合配方对话场景
    tier: recommended

  - id: deepseek-chat
    name: DeepSeek V3
    provider: deepseek
    base_url: https://api.deepseek.com/v1
    model: deepseek-chat
    max_tokens: 8192
    temperature: 0.7
    description: 国产高性能模型，中文理解优秀
    tier: alternative

  - id: zhipu-glm4-flash
    name: 智谱 GLM-4 Flash (免费)
    provider: zhipu
    base_url: https://open.bigmodel.cn/api/paas/v4
    model: glm-4-flash
    max_tokens: 4096
    temperature: 0.7
    description: 免费额度充足，适合开发测试
    tier: free

  - id: ollama-local
    name: Ollama 本地模型
    provider: custom
    base_url: http://localhost:11434/v1
    model: qwen2.5:7b
    max_tokens: 2048
    temperature: 0.7
    description: 完全离线运行，零成本，需本地部署 Ollama
    tier: offline
    requires_local_setup: true
```

---

## 五、Module 4: 实时监控面板

### 4.1 监控数据架构

```
┌──────────┐    ┌──────────────┐    ┌─────────────┐    ┌──────────┐
│ ChatTab  │───▶│ MonitorStore │───▶│ WS Push     │───▶│ 后端     │
│ /Admin   │    │ (Zustand)    │    │ (实时推送)   │    │ Metrics  │
└──────────┘    └──────┬───────┘    └─────────────┘    └──────────┘
                       │
                       ▼
              ┌─────────────────┐
              │ MonitorDashboard │
              │                 │
              │ ┌─────────────┐ │
              │ │ StatusCard  │ │  整体健康度 (绿/黄/红)
              │ ├─────────────┤ │
              │ │ LatencyChart│ │  P50/P95/P99 延迟趋势
              │ ├─────────────┤ │
              │ │ ErrorRate   │ │  错误率 + 分类饼图
              │ ├─────────────┤ │
              │ │ ProviderGrid│ │  各 Provider 健康状态网格
              │ ├─────────────┤ │
              │ │ RecentLogs  │ │  最近 50 条调用日志
              │ └─────────────┘ │
              └─────────────────┘
```

### 4.2 监控指标定义

```python
# backend/app/services/ai/metrics_collector.py (新增)

from dataclasses import dataclass, field
from collections import deque
import time

@dataclass
class LLMMetricsSnapshot:
    """单次调用的指标快照"""
    timestamp: float
    provider: str
    model: str
    task_type: str
    success: bool
    latency_ms: float
    tokens_used: int
    error_code: str | None = None
    fallback_used: bool = False
    fallback_from: str | None = None


class MetricsCollector:
    """LLM 调用指标收集器 — 内存环形缓冲区"""

    def __init__(self, max_history: int = 1000):
        self.history: deque[LLMMetricsSnapshot] = deque(maxlen=max_history)
        self._lock = asyncio.Lock()

    async def record(self, snapshot: LLMMetricsSnapshot):
        async with self._lock:
            self.history.append(snapshot)

    def get_summary(self, window_seconds: int = 300) -> dict:
        """计算滑动窗口内的聚合指标"""
        now = time.monotonic()
        window = [s for s in self.history if now - s.timestamp < window_seconds]

        if not window:
            return self._empty_summary()

        total = len(window)
        successes = sum(1 for s in window if s.success)
        latencies = [s.latency_ms for s in window]

        return {
            "window_seconds": window_seconds,
            "total_calls": total,
            "success_rate": successes / total,
            "error_rate": (total - successes) / total,
            "latency_p50": sorted(latencies)[int(total * 0.5)],
            "latency_p95": sorted(latencies)[min(int(total * 0.95), total - 1)],
            "latency_p99": sorted(latencies)[min(int(total * 0.99), total - 1)],
            "avg_latency_ms": sum(latencies) / total,
            "tokens_total": sum(s.tokens_used for s in window),
            "fallback_rate": sum(1 for s in window if s.fallback_used) / total,
            "error_breakdown": self._count_errors(window),
            "provider_breakdown": self._count_by_provider(window),
        }

    # 全局单例
_metrics = MetricsCollector()
def get_metrics() -> MetricsCollector:
    return _metrics
```

### 4.3 告警规则引擎

```python
# backend/app/services/ai/alerting.py (新增)

@dataclass
class AlertRule:
    rule_id: str
    name: string
    condition: Callable[[dict], bool]  # 接收 metrics summary, 返回 bool
    severity: "info" | "warning" | "critical"
    cooldown_seconds: int = 300  # 同一告警的最小间隔
    channels: list[str] = field(default_factory=lambda: ["system"])  # system/email/sms/webhook
    message_template: str

# 预置告警规则
PRESET_ALERT_RULES = [
    AlertRule(
        rule_id="ALERT-ERR-RATE-HIGH",
        name="错误率过高",
        condition=lambda m: m["error_rate"] > 0.2 and m["total_calls"] > 10,
        severity="critical",
        cooldown_seconds=60,
        message_template="AI 服务错误率达到 {error_rate:.1%} ({total_calls}次调用/{window_seconds}s)",
    ),
    AlertRule(
        rule_id="ALERT-LATENCY-P99-HIGH",
        name="P99 延迟过高",
        condition=lambda m: m["latency_p99"] > 30000,
        severity="warning",
        message_template="AI P99 延迟达 {latency_p99:.0f}ms，用户体验可能受影响",
    ),
    AlertRule(
        rule_id="ALERT-FALLBACK-SPIKE",
        name="Fallback 使用激增",
        condition=lambda m: m["fallback_rate"] > 0.5 and m["total_calls"] > 5,
        severity="warning",
        message_template="{fallback_rate:.0%} 的请求使用了降级模型，主模型可能不可用",
    ),
    AlertRule(
        rule_id="ALERT-ALL-DOWN",
        name="所有 Provider 离线",
        condition=lambda m: m["success_rate"] == 0 and m["total_calls"] > 3,
        severity="critical",
        cooldown_seconds=30,
        channels=["system", "email"],
        message_template="所有 AI Provider 均不可用！系统正在使用纯规则引擎模式运行。",
    ),
]
```

---

## 六、Module 5: 性能优化

### 6.1 HTTP 连接池

```python
# backend/app/services/ai/connection_pool.py (新增)

import httpx

class LLMConnectionPool:
    """LLM Provider 专用 HTTP 连接池"""

    def __init__(self):
        self._pools: dict[str, httpx.AsyncClient] = {}

    def get_client(self, base_url: str, timeout: float = 60.0) -> httpx.AsyncClient:
        if base_url not in self._pools:
            self._pools[base_url] = httpx.AsyncClient(
                base_url=base_url,
                timeout=httpx.Timeout(timeout, connect=10.0),
                limits=httpx.Limits(
                    max_connections=10,      # 每个目标主机最大连接数
                    max_keepalive_connections=5,
                    keepalive_expiry=30.0,
                ),
            )
        return self._pools[base_url]

    async def close_all(self):
        for client in self._pools.values():
            await client.aclose()
        self._pools.clear()

# 全局单例
_pool = LLMConnectionPool()
```

### 6.2 请求队列与并发控制

```python
# backend/app/services/ai/request_queue.py (新增)

import asyncio
from dataclasses import dataclass

@dataclass
class PendingRequest:
    request_id: str
    priority: int  # 0=高(交互式对话) 1=中(生成) 2=低(批量)
    messages: list[dict]
    future: asyncio.Future

class LLMRequestQueue:
    """基于优先级的异步请求队列 + 并发控制"""

    def __init__(self, max_concurrent: int = 5):
        self._queue: asyncio.PriorityQueue = asyncio.PriorityQueue()
        self._semaphore = asyncio.Semaphore(max_concurrent)
        self._active_count = 0
        self._stats = {"total_queued": 0, "total_completed": 0, "avg_wait_ms": 0}

    async def submit(self, request: PendingRequest) -> any:
        """提交请求并等待结果"""
        self._stats["total_queued"] += 1
        enqueue_time = time.monotonic()

        await self._queue.put((request.priority, enqueue_time, request))

        async with self._semaphore:
            wait_ms = (time.monotonic() - enqueue_time) * 1000
            # 执行实际 LLM 调用...
            result = await self._execute(request)

        self._stats["total_completed"] += 1
        return result
```

### 6.3 前端请求去重与缓存

```typescript
// frontend/src/api/modelClient.ts (增强)

// 请求去重: 相同内容 + 时间窗口内不重复发送
const pendingRequests = new Map<string, AbortController>()

export async function deduplicatedChatSend(content: string): Promise<Response> {
  const key = `${content.slice(0, 100)}_${Math.floor(Date.now() / 30000)}` // 30s窗口

  if (pendingRequests.has(key)) {
    // 返回已有 Promise (不重复发请求)
    return pendingRequests.get(key)!.signal.throwIfAborted()
  }

  const controller = new AbortController()
  pendingRequests.set(key, controller)

  try {
    const response = await api.post('/ai/chat/stream', { content }, {
      signal: controller.signal,
    })
    return response
  } finally {
    setTimeout(() => pendingRequests.delete(key), 30000) // 30s后清除
  }
}
```

---

## 七、Module 6: 文档体系

### 6.1 文档清单

| 文档 | 目标读者 | 内容 |
|------|---------|------|
| `docs/AI_MODEL_SETUP_GUIDE.md` | 运维/开发者 | 完整配置指南（含各 Provider 步骤截图） |
| `docs/AI_TROUBLESHOOTING.md` | 全体用户 | FAQ + 错误码速查表 + 排查决策树 |
| `docs/AI_ERROR_CODES.md` | 开发者 | 全量错误码定义、触发条件、处理建议 |
| `docs/AI_ARCHITECTURE.md` | 架构师 | 模块架构图、数据流、扩展点 |
| `docs/AI_PROVIDER_TEMPLATES.yml` | 用户 | 各厂商配置模板（可直接复制粘贴） |

### 6.2 错误码速查表（核心）

| 错误码 | 含义 | 用户可见消息 | 建议操作 |
|--------|------|-------------|---------|
| `AI_LLM_AUTH_001` | Key 格式错 | "API Key 格式可能不正确" | 重新复制完整 Key |
| `AI_LLM_AUTH_002` | Key 过期 | "API Key 已失效" | 到提供商后台重新生成 |
| `AI_LLM_QUOTA_001` | RPM 超限 | "请求太频繁" | 降低使用频率或升级套餐 |
| `AI_LLM_QUOTA_003` | 余额不足 | "账户余额不足" | 前往充值 |
| `AI_LLM_NET_002` | 连接超时 | "AI 服务暂时不可达" | 检查网络 / 代理设置 |
| `AI_LLM_MODEL_001` | 模型不存在 | "模型名称有误" | 检查模型拼写或使用模板 |
| `AI_LLM_MODEL_003` | 上下文过长 | "输入内容超出限制" | 缩短对话历史或分批发送 |

---

## 八、Module 7: 测试方案

### 7.1 单元测试

```python
# tests/unit/test_diagnostic_engine.py (新增)

import pytest
from app.services.ai.diagnostic_engine import DiagnosticEngine, ConfigChecker, ConnectivityChecker

class TestConfigChecker:
    """Level 1 配置检测 单元测试"""

    @pytest.mark.asyncio
    async def test_missing_api_key_returns_fail(self, empty_settings):
        checker = ConfigChecker()
        results = await checker.check()
        c01 = next(r for r in results if r.check_id == "C-01")
        assert c01.status == "fail"

    @pytest.mark.asyncio
    async def test_valid_openai_key_returns_pass(self, monkeypatch):
        monkeypatch.setattr("app.core.config.settings.openai_api_key", "sk-valid-key-12345678901234567890")
        checker = ConfigChecker()
        results = await checker.check()
        c01 = next(r for r in results if r.check_id == "C-01")
        assert c01.status == "pass"

    @pytest.mark.asyncio
    async def test_invalid_provider_returns_fail(self, monkeypatch):
        monkeypatch.setattr("app.core.config.settings.llm_provider", "invalid_provider")
        checker = ConfigChecker()
        results = await checker.check()
        c02 = next(r for r in results if r.check_id == "C-02")
        assert c02.status == "fail"


class TestEnhancedFallback:
    """Fallback 链 单元测试"""

    @pytest.mark.asyncio
    async def test_primary_failure_triggers_backup(self, mock_factory):
        mock_factory.get_provider("primary").chat.side_effect = AuthError("401")
        mock_factory.get_provider("ollama_backup").chat.return_value = "backup response"

        factory = EnhancedProviderFactory()
        result, meta = await factory.call_with_enhanced_fallback([{"role": "user", "content": "hi"}])

        assert result == "backup response"
        assert meta.success_provider == "ollama_backup"
        assert len(meta.attempted_providers) >= 2

    @pytest.mark.asyncio
    async def test_all_providers_fallback_to_rule_engine(self, mock_factory):
        for name in ["primary", "ollama_backup"]:
            mock_factory.get_provider(name).chat.side_effect = ConnectionError()

        factory = EnhancedProviderFactory()
        result, meta = await factory.call_with_enhanced_fallback([{"role": "user", "content": "hi"}])

        assert meta.success_provider == "emergency_fallback"
```

### 7.2 集成测试

```python
# tests/integration/test_llm_e2e.py (新增)

@pytest.mark.integration
class TestLLMEndToEnd:
    """LLM 全链路集成测试 (需要真实 API Key 或 Mock Server)"""

    @pytest.fixture
    def auth_headers(self, test_user_token):
        return {"Authorization": f"Bearer {test_user_token}"}

    @pytest.mark.asyncio
    async def test_models_status_with_valid_key(self, client, auth_headers):
        """有效 Key → status=active + diagnostic.healthy"""
        resp = await client.get("/api/v1/ai/models/status", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["llm"]["status"] == "active"
        assert data["diagnostic"]["overall"] == "healthy"
        assert data["diagnostic"]["score"] >= 80

    @pytest.mark.asyncio
    async def test_chat_stream_full_cycle(self, client, auth_headers):
        """完整对话流: send → stream → receive → display"""
        resp = await client.post("/api/v1/ai/chat/stream", json={
            "message": "你好，请介绍你自己",
            "stream": True,
        }, headers=auth_headers)
        assert resp.status_code == 200
        # 验证 SSE 流格式
        chunks = []
        async for line in resp.content.iter_lines():
            if line.startswith("data: ") and line != "data: [DONE]":
                chunk = json.loads(line[6:])
                chunks.append(chunk)
        assert len(chunks) > 0
        # 至少有一个 content delta
        assert any(c.get("delta", {}).get("content") for c in chunks)

    @pytest.mark.asyncio
    async def test_fallback_on_primary_down(self, client, auth_settings):
        """主 Provider 故障 → 自动切换到 Backup"""
        # 模拟主 Provider 不可用
        auth_settings.OPENAI_API_KEY = "sk-invalid-expired-key"
        # 设置 Ollama backup
        settings.VLLM_ENDPOINT = "http://localhost:11434"

        resp = await client.post("/api/v1/ai/chat", json={
            "message": "test fallback",
        }, headers=auth_headers)
        # 应该返回降级响应而非 500
        assert resp.status_code == 200
```

### 7.3 压力测试

```python
# tests/stress/test_llm_concurrent.py (新增)

import pytest
import asyncio

@pytest.mark.stress
class TestLLMConcurrency:
    """高并发场景压力测试"""

    @pytest.mark.asyncio
    async def test_10_concurrent_requests(self, client, auth_headers):
        """10 个并发请求不应导致连接池耗尽"""
        async def single_request(i):
            resp = await client.post("/api/v1/ai/chat", json={
                "message": f"concurrent test {i}",
            }, headers=auth_headers)
            return resp.status_code

        tasks = [single_request(i) for i in range(10)]
        results = await asyncio.gather(*tasks)

        # 所有请求都应在合理时间内完成 (无超时)
        assert all(s in (200, 503) for s in results)  # 503=排队拒绝也是可接受的
        # 大部分应该成功
        success_rate = sum(1 for s in results if s == 200) / 10
        assert success_rate >= 0.7  # 至少 70% 成功率

    @pytest.mark.asyncio
    async def test_request_queue_priority(self):
        """高优先级请求应比低优先级先完成"""
        queue = LLMRequestQueue(max_concurrent=1)  # 强制串行
        # ... 实现
```

---

## 九、架构总图与实施路线图

### 9.1 优化后架构总图

```
 RMFOOD AI Integration — Optimized Architecture v2.0
═══════════════════════════════════════════════════

 ┌──────────────────────────────────────────────────────────────────┐
 │                        FRONTEND LAYER                             │
 │                                                                  │
 │  ┌────────────┐  ┌──────────────────┐  ┌─────────────────────┐  │
 │  │ChatTab v11 │  │ModelConfigWizard │  │MonitorDashboard v2  │  │
 │  │ (消费状态)  │  │ (配置向导+预测试) │  │ (实时监控面板)       │  │
 │  └─────┬──────┘  └────────┬─────────┘  └──────────┬──────────┘  │
 │        │                   │                       │              │
 │        ▼                   ▼                       ▼              │
 │  ┌──────────────────────────────────────────────────────────┐   │
 │  │              Enhanced ModelClient (统一层)                │   │
 │  │  ┌─────────────┐ ┌──────────────┐ ┌──────────────────┐   │   │
 │  │  │DedupCache   │ │ErrorClassifier│ │MetricsReporter   │   │   │
 │  │  │(请求去重)   │ │(增强错误分类) │ │(指标上报)        │   │   │
 │  │  └─────────────┘ └──────────────┘ └──────────────────┘   │   │
 │  └──────────────────────────┬───────────────────────────────┘   │
 └─────────────────────────────┼─────────────────────────────────┘
                               │ HTTP / SSE / WS
                               ▼
 ┌──────────────────────────────────────────────────────────────────┐
 │                         BACKEND LAYER                             │
 │                                                                  │
 │  ┌──────────────────────────────────────────────────────────┐   │
 │  │                   API GATEWAY                              │   │
 │  │  GET  /api/v1/ai/models/status  →  DiagnosticEngine      │   │
 │  │  POST /api/v1/ai/chat          →  EnhancedChatHandler     │   │
 │  │  POST /api/v1/ai/chat/stream   →  SSEStreamHandler       │   │
 │  │  POST /api/v1/ai/models/config →  ConfigApplier          │   │
 │  │  GET  /api/v1/ai/metrics       →  MetricsCollector       │   │
 │  └──────────────────────────┬───────────────────────────────┘   │
 │                             │                                    │
 │  ┌──────────────────────────▼───────────────────────────────┐   │
 │  │                  SERVICE LAYER                            │   │
 │  │                                                          │   │
 │  │  ┌──────────────┐  ┌───────────────┐  ┌───────────────┐ │   │
 │  │  │DiagnosticEng │  │ RequestQueue  │  │MetricsCollect │ │   │
 │  │  │(三级诊断)    │  │(优先级队列)   │  │(指标收集)     │ │   │
 │  │  └──────┬───────┘  └──────┬────────┘  └──────┬────────┘ │   │
 │  │         │                 │                  │           │   │
 │  │  ┌──────▼─────────────────▼──────────────────▼───────┐  │   │
 │  │  │           EnhancedProviderFactory (V2)             │  │   │
 │  │  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌──────────┐ │  │   │
 │  │  │  │ Primary │ │Backup 1│ │Backup 2│ │Emergency │ │  │   │
 │  │  │  │(OpenAI) │ │(Ollama)│ │(Zhipu) │ │(Rules)   │ │  │   │
 │  │  │  └────┬────┘ └────┬────┘ └────┬────┘ └────┬─────┘ │  │   │
 │  │  └───────┼──────────┼──────────┼───────────┼────────┘  │   │
 │  │          │  ConnectionPool (共享连接池)               │  │   │
 │  │          └──────────────────┬─────────────────────────┘  │   │
 │  └─────────────────────────────┼────────────────────────────┘   │
 │                                │                                │
 │  ┌─────────────────────────────▼────────────────────────────┐   │
 │  │                  INFRASTRUCTURE                           │   │
 │  │  ┌──────────┐  ┌──────────┐  ┌─────────────────────┐    │   │
 │  │  │Alerting  │  │Logging   │  │HealthCheck Scheduler│    │   │
 │  │  │(告警引擎)│  │(审计日志)│  │(定期健康探测 300s)   │    │   │
 │  │  └──────────┘  └──────────┘  └─────────────────────┘    │   │
 │  └──────────────────────────────────────────────────────────┘   │
 └──────────────────────────────────────────────────────────────────┘
```

### 9.2 实施路线图

```
Phase 1: 核心修复 (Week 1) ──────────────────────┐
                                                     │
  P1.1  统一 /models/status 端点 (消除双路由冲突)     │  预期效果:
  P1.2  实现 DiagnosticEngine Level 1+2              │  ✓ inactive 问题根除
  P1.3  前端错误分类增强 (新增 6 种错误类型)           │  ✓ 用户看到精确原因
  P1.4  配置预测试功能 (保存前自动探测)                │  ✓ 配置错误即时发现
                                                     │
Phase 2: 自愈与监控 (Week 2) ─────────────────────┤
                                                     │
  P2.1  EnhancedProviderFactory (增强 Fallback)      │  预期效果:
  P2.2  MetricsCollector + /metrics 端点             │  ✓ 主故障自动切换备份
  P2.3  MonitorDashboard 前端面板 (V1 MVP)           │  ✓ 运维可见性大幅提升
  P2.4  Alerting 规则引擎 (内置 4 条规则)             │  ✓ 异常主动通知
                                                     │
Phase 3: 性能与体验 (Week 3) ──────────────────────┤
                                                     │
  P3.1  ConnectionPool (HTTP 连接池)                 │  预期效果:
  P3.2  RequestQueue (优先级队列 + 并发控制)         │  ✓ 高并发稳定性 ↑
  P3.3  ModelConfigWizard (配置向导 + 模板库)        │  ✓ 配置门槛降低 80%
  P3.4  前端请求去重 + 智能缓存                       │  ✓ 无效请求减少
                                                     │
Phase 4: 文档与测试 (Week 4) ──────────────────────┤
                                                     │
  P4.1  配置指南 + 排查手册 + 错误码文档              │  预期效果:
  P4.2  单元测试 (覆盖率 ≥ 80%)                       │  ✓ 回归风险可控
  P4.3  集成测试 (5 条 E2E 场景)                      │  ✓ 全链路质量保障
  P4.4  压力测试 (10 并发基线)                         │  ✓ 性能基线建立
                                                     │
Phase 5: 优化迭代 (Week 5-6) ─────────────────────┤
                                                     │
  P5.1  生产环境灰度验证                               │  预期效果:
  P5.2  性能调优 (基于压测数据)                        │  ✓ 生产就绪
  P5.3  用户反馈收集 + 快速迭代                        │
  └──────────────────────────────────────────────────┘
```

### 9.3 资源需求评估

| 资源 | Phase 1 | Phase 2 | Phase 3 | Phase 4 | 合计 |
|------|---------|---------|---------|---------|------|
| 后端新代码 | ~800 行 | ~600 行 | ~500 行 | ~200 行 | ~2100 行 |
| 前端新代码 | ~400 行 | ~600 行 | ~700 行 | ~100 行 | ~1800 行 |
| 测试代码 | ~200 行 | ~300 行 | ~200 行 | ~800 行 | ~1500 行 |
| 文档 | - | - | - | ~3000 字 | ~3000 字 |
| **人天估算** | **3 天** | **3 天** | **3 天** | **2 天** | **~11 人天** |

### 9.4 风险与缓解

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|---------|
| 重构 `/models/status` 影响现有消费者 | 中 | 高 | 保留旧版字段兼容，渐进迁移 |
| Provider 工厂改动引入回归 | 低 | 高 | 全量单元测试 + Fallback 链专项测试 |
| 前端组件改动力大 | 中 | 中 | 采用增量方式：先加 DiagnosticPanel，再逐步替换旧逻辑 |
| 性能优化效果不明显 | 低 | 低 | 先建基线再优化，每次优化有量化对比 |

---

> **下一步行动**: 请评审本方案，确认优先级和实施范围后即可开始 Phase 1 编码。
