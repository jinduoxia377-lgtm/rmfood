"""AI 模型配置服务 — CRUD + 加密 Key 持久化

职责：
  - 按 (tenant_id, model_type) 读写 ai_model_configs 表
  - API Key 使用 AES-256-GCM 加密后存入 api_key_encrypted 列
  - 提供加载默认配置的辅助方法
"""
from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.ai_model_config import AIModelConfig

logger = logging.getLogger(__name__)


@dataclass
class ModelConfig:
    """模型配置数据类"""
    model_type: str
    provider: str = ""
    api_key: str = ""
    api_key_plaintext: str = ""
    base_url: str = ""
    model: str = ""
    max_tokens: int = 4096
    temperature: float = 0.7
    timeout_ms: int = 30000
    max_retries: int = 3
    concurrency_limit: int = 3

    def to_dict(self) -> dict[str, Any]:
        return {
            "model_type": self.model_type,
            "provider": self.provider,
            "api_key": self.api_key_plaintext[:8] + "..." if len(self.api_key_plaintext) > 8 else "",
            "api_key_configured": bool(self.api_key_plaintext),
            "base_url": self.base_url,
            "model": self.model,
            "max_tokens": self.max_tokens,
            "temperature": self.temperature,
            "timeout_ms": self.timeout_ms,
            "max_retries": self.max_retries,
            "concurrency_limit": self.concurrency_limit,
        }

    @classmethod
    def get_default(cls, model_type: str) -> "ModelConfig":
        defaults = {
            "llm": {"provider": "deepseek", "base_url": "https://api.deepseek.com/v1", "model": "deepseek-chat"},
            "formula_gpt": {"provider": "local", "base_url": "", "model": "rule_based"},
            "synergy_net": {"provider": "local", "base_url": "", "model": "rule_based"},
            "safety_checker": {"provider": "local", "base_url": "", "model": "rule_engine"},
            "taste_predictor": {"provider": "local", "base_url": "", "model": "rule_based"},
            "stability_model": {"provider": "local", "base_url": "", "model": "simulation"},
            "peptide_scorer": {"provider": "local", "base_url": "", "model": "heuristic"},
        }
        default = defaults.get(model_type, {})
        return cls(
            model_type=model_type,
            provider=default.get("provider", ""),
            base_url=default.get("base_url", ""),
            model=default.get("model", ""),
        )


# ── 内置 provider 预设（格式、基础 URL、默认模型） ───────────────────

PROVIDER_PRESETS: dict[str, dict[str, Any]] = {
    "deepseek": {
        "api_format": "openai",
        "auth_method": "api_key",
        "base_url": "https://api.deepseek.com/v1",
        "default_model": "deepseek-chat",
        "models": [
            {"id": "deepseek-chat", "display_name": "DeepSeek Chat"},
            {"id": "deepseek-reasoner", "display_name": "DeepSeek R1"},
            {"id": "deepseek-coder", "display_name": "DeepSeek Coder"},
        ],
        "fallback_models": ["deepseek-chat"],
    },
    "openai": {
        "api_format": "openai",
        "auth_method": "api_key",
        "base_url": "https://api.openai.com/v1",
        "default_model": "gpt-4o",
        "models": [
            {"id": "gpt-4o", "display_name": "GPT-4o"},
            {"id": "gpt-4o-mini", "display_name": "GPT-4o Mini"},
            {"id": "gpt-4-turbo", "display_name": "GPT-4 Turbo"},
            {"id": "gpt-3.5-turbo", "display_name": "GPT-3.5 Turbo"},
        ],
        "fallback_models": ["gpt-4o-mini"],
    },
    "zhipu": {
        "api_format": "openai",
        "auth_method": "api_key",
        "base_url": "https://open.bigmodel.cn/api/paas/v4",
        "default_model": "glm-4-plus",
        "models": [
            {"id": "glm-4-plus", "display_name": "GLM-4 Plus"},
            {"id": "glm-4-air", "display_name": "GLM-4 Air"},
            {"id": "glm-4-flash", "display_name": "GLM-4 Flash"},
        ],
        "fallback_models": ["glm-4-flash"],
    },
    "qwen": {
        "api_format": "openai",
        "auth_method": "api_key",
        "base_url": "https://dashscope.aliyuncs.com/compatible-mode/v1",
        "default_model": "qwen-plus",
        "models": [
            {"id": "qwen-plus", "display_name": "Qwen Plus"},
            {"id": "qwen-turbo", "display_name": "Qwen Turbo"},
            {"id": "qwen-max", "display_name": "Qwen Max"},
        ],
        "fallback_models": ["qwen-turbo"],
    },
    "anthropic": {
        "api_format": "anthropic",
        "auth_method": "api_key",
        "base_url": "https://api.anthropic.com/v1",
        "default_model": "claude-sonnet-4-20250514",
        "models": [
            {"id": "claude-opus-4-20250514", "display_name": "Claude Opus 4"},
            {"id": "claude-sonnet-4-20250514", "display_name": "Claude Sonnet 4"},
            {"id": "claude-haiku-4-20250514", "display_name": "Claude Haiku 4"},
        ],
        "fallback_models": ["claude-haiku-4-20250514"],
    },
    "azure": {
        "api_format": "azure",
        "auth_method": "api_key",
        "base_url": "",
        "default_model": "gpt-4o",
        "models": [],
        "fallback_models": [],
    },
    "custom": {
        "api_format": "custom",
        "auth_method": "api_key",
        "base_url": "",
        "default_model": "",
        "models": [],
        "fallback_models": [],
    },
}

# ── 前端 ModelType 到数据库 model_type 的映射（保持一致） ──────────

DEFAULT_MODEL_TYPES = [
    "llm",
    "formula_gpt",
    "synergy_net",
    "safety_checker",
    "taste_predictor",
    "stability_model",
    "peptide_scorer",
]


class AIModelConfigService:
    """AI 模型配置持久化服务"""

    # ── 加密/解密 Key ──────────────────────────────────────────────
    @classmethod
    def _get_encryption_key(cls) -> bytes:
        import hashlib
        from app.core.config import settings
        raw = settings.encryption.encryption_key or settings.secret_key or ""
        if not raw:
            logger.warning("[AIModelConfig] 未设置 ENCRYPTION_KEY 或 SECRET_KEY")
            return b""
        return hashlib.sha256(raw.encode("utf-8")).digest()

    @classmethod
    def encrypt_api_key(cls, plaintext: str) -> str:
        """加密 API Key"""
        if not plaintext:
            return ""
        try:
            from app.core.security.crypto import encrypt_value
            return encrypt_value(plaintext)
        except Exception as e:
            logger.error(f"[AIModelConfig] 加密失败: {e}")
            return plaintext

    @classmethod
    def decrypt_api_key(cls, encrypted: Optional[str]) -> str:
        """解密 API Key"""
        if not encrypted:
            return ""
        try:
            from app.core.security.crypto import decrypt_value
            return decrypt_value(encrypted)
        except Exception as e:
            logger.error(f"[AIModelConfig] 解密失败: {e}")
            return ""

    @classmethod
    def mask_api_key(cls, api_key: str) -> str:
        """脱敏显示 API Key"""
        if not api_key:
            return ""
        if len(api_key) <= 12:
            return "***"
        return api_key[:8] + "..." + api_key[-4:]

    # ── 数据库操作 ─────────────────────────────────────────────────
    @classmethod
    async def get_or_create(
        cls, db: AsyncSession, tenant_id: int, model_type: str
    ) -> AIModelConfig:
        """获取或创建配置记录"""
        stmt = select(AIModelConfig).where(
            AIModelConfig.tenant_id == tenant_id,
            AIModelConfig.model_type == model_type,
        )
        result = await db.execute(stmt)
        rec = result.scalar_one_or_none()

        if rec is None:
            preset = PROVIDER_PRESETS.get("deepseek", {})
            rec = AIModelConfig(
                tenant_id=tenant_id,
                model_type=model_type,
                api_format=preset.get("api_format", "openai"),
                auth_method=preset.get("auth_method", "api_key"),
                base_url=preset.get("base_url", "https://api.deepseek.com/v1"),
                provider="deepseek",
                default_model=preset.get("default_model", "deepseek-chat"),
                models=json.dumps(preset.get("models", [])),
                fallback_models=json.dumps(preset.get("fallback_models", [])),
            )
            db.add(rec)
            await db.flush()
        return rec

    @classmethod
    async def get_by_model_type(
        cls, db: AsyncSession, tenant_id: int, model_type: str
    ) -> Optional[AIModelConfig]:
        """按 model_type 查询配置"""
        stmt = select(AIModelConfig).where(
            AIModelConfig.tenant_id == tenant_id,
            AIModelConfig.model_type == model_type,
        )
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    @classmethod
    async def get_all_for_tenant(
        cls, db: AsyncSession, tenant_id: int
    ) -> list[AIModelConfig]:
        """获取租户所有配置"""
        stmt = select(AIModelConfig).where(AIModelConfig.tenant_id == tenant_id)
        result = await db.execute(stmt)
        return list(result.scalars().all())

    @classmethod
    async def ensure_defaults(cls, db: AsyncSession, tenant_id: int) -> None:
        """确保所有默认模型类型都有配置记录"""
        for mt in DEFAULT_MODEL_TYPES:
            await cls.get_or_create(db, tenant_id, mt)

    @classmethod
    async def update(
        cls,
        db: AsyncSession,
        tenant_id: int,
        model_type: str,
        data: dict[str, Any],
    ) -> AIModelConfig:
        """更新配置（含加密 API Key）"""
        rec = await cls.get_or_create(db, tenant_id, model_type)

        rec.provider = data.get("provider", rec.provider)
        rec.base_url = data.get("base_url", rec.base_url)
        rec.default_model = data.get("default_model", rec.default_model)
        rec.max_tokens = data.get("max_tokens", rec.max_tokens)
        rec.temperature = data.get("temperature", rec.temperature)
        rec.timeout_ms = data.get("timeout_ms", rec.timeout_ms)
        rec.max_retries = data.get("max_retries", rec.max_retries)
        rec.concurrency_limit = data.get("concurrency_limit", rec.concurrency_limit)

        if "api_key" in data and data["api_key"]:
            rec.api_key_encrypted = cls.encrypt_api_key(data["api_key"])

        await db.commit()
        await db.refresh(rec)
        return rec

    # ── 序列化 ─────────────────────────────────────────────────────
    @classmethod
    def serialize(cls, records: list[AIModelConfig]) -> list[dict[str, Any]]:
        out: list[dict[str, Any]] = []
        for rec in records:
            d = rec.to_dict()
            if rec.api_key_encrypted:
                decrypted = cls.decrypt_api_key(rec.api_key_encrypted)
                if len(decrypted) >= 8:
                    d["api_key_masked"] = f"{decrypted[:4]}***{decrypted[-4:]}"
                else:
                    d["api_key_masked"] = "***"
                d["api_key_configured"] = True
            else:
                d["api_key_masked"] = None
                d["api_key_configured"] = False
            out.append(d)
        return out

    @classmethod
    def serialize_single(cls, rec: Optional[AIModelConfig]) -> Optional[dict[str, Any]]:
        if rec is None:
            return None
        d = rec.to_dict()
        if rec.api_key_encrypted:
            decrypted = cls.decrypt_api_key(rec.api_key_encrypted)
            if len(decrypted) >= 8:
                d["api_key_masked"] = f"{decrypted[:4]}***{decrypted[-4:]}"
            else:
                d["api_key_masked"] = "***"
            d["api_key_configured"] = True
        else:
            d["api_key_masked"] = None
            d["api_key_configured"] = False
        return d

    # ── 前端兼容方法 ──────────────────────────────────────────────
    @classmethod
    async def get_config(cls, db: AsyncSession, model_type: str, tenant_id: int = 1) -> ModelConfig:
        """获取单个模型配置（前端兼容）"""
        record = await cls.get_by_model_type(db, tenant_id, model_type)
        if record:
            api_key = cls.decrypt_api_key(record.api_key_encrypted)
            return ModelConfig(
                model_type=record.model_type,
                provider=record.provider,
                api_key=api_key,
                api_key_plaintext=api_key,
                base_url=record.base_url,
                model=record.default_model,
                max_tokens=record.max_tokens,
                temperature=record.temperature,
                timeout_ms=record.timeout_ms,
                max_retries=record.max_retries,
                concurrency_limit=record.concurrency_limit,
            )
        return ModelConfig.get_default(model_type)

    @classmethod
    async def save_config(cls, db: AsyncSession, config: ModelConfig, tenant_id: int = 1) -> bool:
        """保存单个模型配置（前端兼容）"""
        try:
            data: dict[str, Any] = {
                "provider": config.provider,
                "base_url": config.base_url,
                "default_model": config.model,
                "max_tokens": config.max_tokens,
                "temperature": config.temperature,
                "timeout_ms": config.timeout_ms,
                "max_retries": config.max_retries,
                "concurrency_limit": config.concurrency_limit,
            }
            if config.api_key:
                data["api_key"] = config.api_key
            await cls.update(db, tenant_id, config.model_type, data)
            return True
        except Exception as e:
            logger.error(f"[AIModelConfig] 保存配置失败: {e}")
            return False

    @classmethod
    async def get_all_configs(cls, db: AsyncSession, tenant_id: int = 1) -> dict[str, ModelConfig]:
        """获取所有模型配置（前端兼容）"""
        records = await cls.get_all_for_tenant(db, tenant_id)
        configs: dict[str, ModelConfig] = {}
        for rec in records:
            api_key = cls.decrypt_api_key(rec.api_key_encrypted)
            configs[rec.model_type] = ModelConfig(
                model_type=rec.model_type,
                provider=rec.provider,
                api_key=api_key,
                api_key_plaintext=api_key,
                base_url=rec.base_url,
                model=rec.default_model,
                max_tokens=rec.max_tokens,
                temperature=rec.temperature,
                timeout_ms=rec.timeout_ms,
                max_retries=rec.max_retries,
                concurrency_limit=rec.concurrency_limit,
            )
        # 补充缺失的默认配置
        for mt in ["llm", "formula_gpt", "synergy_net", "safety_checker", "taste_predictor", "stability_model", "peptide_scorer"]:
            if mt not in configs:
                configs[mt] = ModelConfig.get_default(mt)
        return configs
