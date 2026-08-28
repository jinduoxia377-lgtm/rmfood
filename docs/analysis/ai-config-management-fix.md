# AI 配置管理模块深度分析与修复方案

## 问题诊断总结

### 🔴 严重问题（导致功能完全失效）

1. **API 路径不匹配**
   - 前端调用: `/ai/models/config` (相对路径)
   - 后端实际路径: `/api/v1/ai/models/config` (带 prefix)
   - 结果: 404 错误，配置无法保存和加载

2. **API Key 未加密存储**
   - 后端 `AIModelConfigService.update()` 将明文 Key 直接存入 `api_key_encrypted` 列
   - `serialize()` 方法直接用加密列的值做脱敏显示（显示的是明文而非加密值）
   - 安全漏洞 + 前端无法正确回显

3. **后端未实现 API Key 解密**
   - `to_dict()` 只返回 `api_key_encrypted: boolean`
   - 前端期望收到 `api_key_masked` 和 `api_key_configured` 字段
   - 字段名不匹配导致回显失败

### 🟡 中等问题（影响功能完整性）

4. **LLM 运行时配置同步失败**
   - `models_and_tools.py:217-232` 尝试同步到 `llm_service`
   - 但 `LLMConfig` 构造函数缺少 `max_retries`, `concurrency_limit` 等字段
   - 同步后 `is_available` 仍返回 False

5. **前端 concurrencyLimit 硬编码**
   - `ModelConfigPanel.tsx:148` 硬编码 `concurrencyLimit: 3`
   - 不从配置中读取，用户设置无效

6. **前端加载逻辑双重合并导致覆盖**
   - `ModelConfigPanel.tsx:174-182` 先合并本地再覆盖后端
   - 本地存储（Base64 加密）覆盖后端存储（应反之）

---

## 修复方案

### 修复 1: 统一 API Key 加密/解密机制

**文件**: `backend/app/services/ai_model_config_service.py`

```python
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
import os

class AIModelConfigService:
    @classmethod
    def _get_encryption_key(cls) -> bytes:
        """获取 AES-256 加密密钥（从环境变量或 secret_key 派生）"""
        import hashlib
        from app.core.config import settings
        raw = settings.encryption.encryption_key or settings.secret_key or ""
        if not raw:
            logger.warning("[AIModelConfig] 未设置 ENCRYPTION_KEY，使用默认密钥（仅开发环境）")
            raw = "rmfood-dev-default-key-32-chars!!!!"  # 仅开发环境
        return hashlib.sha256(raw.encode("utf-8")).digest()

    @classmethod
    def encrypt_api_key(cls, plaintext: str) -> str | None:
        """AES-256-GCM 加密 API Key"""
        if not plaintext:
            return None
        try:
            aesgcm = AESGCM(cls._get_encryption_key())
            nonce = os.urandom(12)
            ciphertext = aesgcm.encrypt(nonce, plaintext.encode("utf-8"), None)
            # 格式: base64(nonce + ciphertext)
            import base64
            return base64.b64encode(nonce + ciphertext).decode("utf-8")
        except Exception as e:
            logger.error(f"[AIModelConfig] 加密失败: {e}")
            return None

    @classmethod
    def decrypt_api_key(cls, encrypted: str | None) -> str:
        """解密 API Key"""
        if not encrypted:
            return ""
        try:
            import base64
            raw = base64.b64decode(encrypted)
            nonce, ciphertext = raw[:12], raw[12:]
            aesgcm = AESGCM(cls._get_encryption_key())
            plaintext = aesgcm.decrypt(nonce, ciphertext, None)
            return plaintext.decode("utf-8")
        except Exception as e:
            logger.error(f"[AIModelConfig] 解密失败: {e}")
            return ""

    @classmethod
    def update(cls, db, tenant_id, model_type, data):
        """更新配置（修复：正确加密 API Key）"""
        record = cls.get_or_create(db, tenant_id, model_type)
        
        # 更新普通字段
        updatable = {
            "api_format", "auth_method", "auth_header_name", "base_url",
            "provider", "models", "default_model", "fallback_models",
            "temperature", "max_tokens", "top_p", "stream_enabled",
            "timeout_ms", "max_retries",
        }
        for key in updatable:
            if key in data:
                setattr(record, key, data[key])

        # API Key 单独处理（加密存储）
        if "api_key" in data:
            raw_key = data["api_key"]
            record.api_key_encrypted = cls.encrypt_api_key(raw_key)

        record.updated_at = datetime.now(timezone.utc)
        await db.flush()
        return record

    @classmethod
    def serialize(cls, records):
        """序列化为前端格式（API Key 脱敏）"""
        out = []
        for rec in records:
            d = rec.to_dict()
            # 解密后脱敏显示
            if rec.api_key_encrypted:
                decrypted = cls.decrypt_api_key(rec.api_key_encrypted)
                if len(decrypted) >= 8:
                    d["api_key_masked"] = f"{decrypted[:4]}***{decrypted[-4:]}"
                else:
                    d["api_key_masked"] = "***"
                d["api_key_configured"] = True
                # 为了前端能回显，返回部分可见的 key（实际生产应返回 masked）
                d["api_key_partial"] = decrypted[:4] + "..." + decrypted[-4:] if len(decrypted) >= 8 else "***"
            else:
                d["api_key_masked"] = None
                d["api_key_configured"] = False
                d["api_key_partial"] = ""
            out.append(d)
        return out
```

### 修复 2: 修复前端 API 路径

**文件**: `frontend/src/api/modelClient.ts`

```typescript
// 修复：使用完整路径
static async getModelStatus(): Promise<Record<string, ModelStatus>> {
  try {
    const response = await api.get<Record<string, ModelStatus>>('/api/v1/ai/models/status', {
      headers: { 'X-Requested-With': 'XMLHttpRequest' },
    });
    return response.data;
  } catch (error) {
    // ... 错误处理
  }
}
```

**文件**: `frontend/src/components/ai/ModelConfigPanel.tsx`

```typescript
// 修复：统一使用完整路径
const resp = await api.get('/api/v1/ai/models/config');
// ...
const resp = await api.post('/api/v1/ai/models/config', { ... });
```

### 修复 3: 修复 LLM 运行时配置同步

**文件**: `backend/app/api/ai_modules/models_and_tools.py`

```python
@sub_router.post("/models/config", ...)
async def update_llm_config(req: UpdateLLMConfigRequest, ...):
    # ... 保存配置到数据库 ...
    
    # 修复：正确同步 LLM 运行时配置
    if req.model_type == "llm":
        try:
            from ...services.llm_service import LLMConfig, llm_service as _llm_svc
            runtime_cfg = LLMConfig(
                provider=req.provider,
                api_key=req.api_key,
                base_url=req.base_url,
                model=req.default_model or "deepseek-chat",
                max_tokens=req.max_tokens,
                temperature=req.temperature,
                timeout=float(req.timeout_ms) / 1000.0 if req.timeout_ms else 60.0,
                # 补充缺失字段
                max_retries=req.max_retries,
                api_format=req.api_format,
                auth_method=req.auth_method,
            )
            _llm_svc.update_config(runtime_cfg, user_id=current_user.id)
            
            # 验证同步结果
            await asyncio.sleep(0.1)  # 等待异步操作完成
            new_status = await model_status()
            if new_status.get("llm", {}).get("status") == "active":
                logger.info(f"LLM 运行时配置同步成功")
            else:
                logger.warning(f"LLM 运行时配置同步后状态仍为: {new_status.get('llm', {}).get('status')}")
                
        except Exception as e:
            logger.error(f"LLM 运行时配置同步失败: {e}", exc_info=True)
            # 不阻断配置保存，仅记录错误
```

### 修复 4: 修复前端 concurrencyLimit 硬编码

**文件**: `frontend/src/components/ai/ModelConfigPanel.tsx`

```typescript
// 修复：从配置中读取 concurrencyLimit
const handleSaveConfig = async (modelType: ModelType) => {
  const config = configs[modelType] || ConfigManager.getDefaultModelConfig();
  
  // 确保 concurrencyLimit 来自配置
  const payload = {
    // ... 其他字段
    concurrency_limit: config.concurrencyLimit || 3,  // 修复：使用配置值
  };
  
  await api.post('/api/v1/ai/models/config', payload);
};
```

### 修复 5: 修复前端配置加载逻辑

**文件**: `frontend/src/components/ai/ModelConfigPanel.tsx`

```typescript
const loadConfigs = useCallback(async () => {
  try {
    const local = ConfigManager.getModelConfigs();
    let backendConfigs: Record<ModelType, ModelConfig> | null = null;
    
    if (isAuthenticated) {
      try {
        const resp = await api.get('/api/v1/ai/models/config');
        if (resp.data?.success && resp.data?.data) {
          const merged: Record<ModelType, ModelConfig> = {} as Record<ModelType, ModelConfig>;
          for (const item of resp.data.data) {
            const mt = item.model_type as ModelType;
            merged[mt] = {
              // 后端不回传明文 key，使用本地存储的值（如有）
              apiKey: local[mt]?.apiKey || '',
              baseUrl: item.base_url,
              timeout: item.timeout_ms,
              maxRetries: item.max_retries,
              concurrencyLimit: item.concurrency_limit || 3,  // 修复：正确读取
              apiFormat: item.api_format as ApiFormat,
              authMethod: item.auth_method as AuthMethod,
              authHeaderName: item.auth_header_name || 'Authorization',
              provider: item.provider,
              models: item.models as ModelEntry[] || [],
              defaultModel: item.default_model,
              fallbackModels: item.fallback_models as string[] || [],
              temperature: item.temperature,
              maxTokens: item.max_tokens,
              topP: item.top_p,
              streamEnabled: item.stream_enabled,
              _apiKeyConfigured: item.api_key_configured || false,
              _apiKeyMasked: item.api_key_masked || null,
            };
          }
          backendConfigs = merged;
        }
      } catch {
        // 降级到本地存储
      }
    }

    // 修复：后端优先，本地仅作为 fallback
    if (backendConfigs) {
      const combined: Record<ModelType, ModelConfig> = {} as Record<ModelType, ModelConfig>;
      for (const mt of Object.keys(backendConfigs) as ModelType[]) {
        combined[mt] = { 
          ...backendConfigs[mt],
          // 本地存储的 key 覆盖后端的 masked 值（如果本地有明文 key）
          apiKey: local[mt]?.apiKey || backendConfigs[mt].apiKey,
        };
      }
      setConfigs(combined);
    } else {
      setConfigs(local);
    }
    
    setError(null);
  } catch (err) {
    setError(err instanceof Error ? err.message : '加载配置失败');
  }
}, [isAuthenticated]);
```

---

## 实施步骤

### 阶段 1: 后端修复（必须）
1. 实现 AES-256-GCM 加密/解密方法
2. 修复 `update()` 方法使用加密存储
3. 修复 `serialize()` 方法返回正确字段
4. 修复 LLM 运行时配置同步逻辑

### 阶段 2: 前端修复（必须）
1. 统一 API 路径为 `/api/v1/ai/...`
2. 修复配置加载逻辑（后端优先）
3. 修复 concurrencyLimit 读取
4. 添加错误处理和用户反馈

### 阶段 3: 验证测试
1. 测试保存配置 → 数据库加密存储
2. 测试加载配置 → 正确回显 masked key
3. 测试 LLM 状态 → `is_available` 返回 true
4. 测试实际 API 调用 → 使用配置的正确 key

---

## 关键发现

1. **后端缺少加密实现**：代码注释说用 AES-256-GCM，但实际是明文存储
2. **前后端字段名不一致**：`concurrencyLimit` vs `concurrency_limit`
3. **API 路径不匹配**：前端相对路径 vs 后端 prefix
4. **配置加载优先级错误**：本地覆盖了后端，应该反之

这个分析揭示了配置管理模块的核心缺陷：**加密机制未实现、路径不匹配、字段映射错误**。修复这些问题需要同时修改前后端代码。
