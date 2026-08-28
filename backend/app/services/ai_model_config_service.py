"""AI 模型配置服务 — CRUD + 加密 Key 持久化

职责：
  - 按 (tenant_id, model_type) 读写 ai_model_configs 表
  - API Key 使用 AES-256-GCM 加密后存入 api_key_encrypted 列
  - 提供加载默认配置的辅助方法
"""
from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import Any, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.ai_model_config import AIModelConfig

logger = logging.getLogger(__name__)

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
            logger.warning("[AIModelConfig] 未设置 ENCRYPTION_KEY 或 SECRET_KEY，API Key 将以明文存储")
            return b""
        return hashlib.sha256(raw.encode("utf-8")).digest()

    @classmethod
    async def get_or_create(
        cls, db: AsyncSession, tenant_id: int, model_type: str,
    ) -> AIModelConfig:
        """获取或初始化指定 model_type 的配置记录"""
        stmt = select(AIModelConfig).where(
            AIModelConfig.tenant_id == tenant_id,
            AIModelConfig.model_type == model_type,
        )
        result = await db.execute(stmt)
        row = result.scalars().one_or_none()
        if row is not None:
            return row

        preset = PROVIDER_PRESETS.get("deepseek", PROVIDER_PRESETS["deepseek"])
        now = datetime.now(timezone.utc)
        new_record = AIModelConfig(
            tenant_id=tenant_id,
            model_type=model_type,
            api_format=preset["api_format"],
            auth_method=preset["auth_method"],
            base_url=preset["base_url"],
            provider="deepseek",
            models=preset["models"],
            default_model=preset["default_model"],
            fallback_models=preset["fallback_models"],
            temperature=0.7,
            max_tokens=4096,
            top_p=0.9,
            stream_enabled=False,
            timeout_ms=30000,
            max_retries=3,
            concurrency_limit=3,
            created_at=now,
            updated_at=now,
        )
        db.add(new_record)
        await db.flush()
        logger.info(
            "[AIModelConfig] 已初始化默认配置: tenant=%s model_type=%s",
            tenant_id, model_type,
        )
        return new_record

    @classmethod
    async def get_all_for_tenant(
        cls, db: AsyncSession, tenant_id: int,
    ) -> list[AIModelConfig]:
        stmt = (
            select(AIModelConfig)
            .where(AIModelConfig.tenant_id == tenant_id)
            .order_by(AIModelConfig.model_type.asc())
        )
        result = await db.execute(stmt)
        return list(result.scalars().all())

    @classmethod
    async def get_by_model_type(
        cls, db: AsyncSession, tenant_id: int, model_type: str,
    ) -> Optional[AIModelConfig]:
        stmt = select(AIModelConfig).where(
            AIModelConfig.tenant_id == tenant_id,
            AIModelConfig.model_type == model_type,
        )
        result = await db.execute(stmt)
        return result.scalars().one_or_none()

    @classmethod
    async def ensure_defaults(cls, db: AsyncSession, tenant_id: int) -> None:
        """为所有已知 model_type 确保配置记录存在（启动时调用）"""
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
        """
        更新配置。支持的字段：
          api_format, auth_method, auth_header_name, base_url, provider,
          models, default_model, fallback_models, temperature, max_tokens,
          top_p, stream_enabled, timeout_ms, max_retries, api_key
        """
        record = await cls.get_or_create(db, tenant_id, model_type)

        updatable = {
            "api_format", "auth_method", "auth_header_name", "base_url",
            "provider", "models", "default_model", "fallback_models",
            "temperature", "max_tokens", "top_p", "stream_enabled",
            "timeout_ms", "max_retries", "concurrency_limit",
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
        logger.info(
            "[AIModelConfig] 已更新配置: tenant=%s model_type=%s",
            tenant_id, model_type,
        )
        return record

    @classmethod
    def encrypt_api_key(cls, plaintext: str) -> str | None:
        """使用 EncryptionUtils 加密 API Key"""
        if not plaintext:
            return None
        try:
            from ..utils.encryption import EncryptionUtils
            key = cls._get_encryption_key()
            ciphertext, nonce = EncryptionUtils.encrypt(plaintext.encode("utf-8"), key)
            import base64
            return json.dumps({
                "__encrypted__": True,
                "v": base64.b64encode(ciphertext).decode("ascii"),
                "n": base64.b64encode(nonce).decode("ascii"),
            })
        except Exception as e:
            logger.error(f"[AIModelConfig] 加密 API Key 失败: {e}")
            return None

    @classmethod
    def decrypt_api_key(cls, encrypted_value: str | None) -> str:
        """解密 API Key，兼容明文和加密格式"""
        if not encrypted_value:
            return ""
        try:
            # 尝试解析为加密格式
            data = json.loads(encrypted_value)
            if isinstance(data, dict) and data.get("__encrypted__"):
                from ..utils.encryption import EncryptionUtils
                key = cls._get_encryption_key()
                import base64
                ciphertext = base64.b64decode(data["v"])
                nonce = base64.b64decode(data["n"])
                return EncryptionUtils.decrypt(ciphertext, nonce, key).decode("utf-8")
        except (json.JSONDecodeError, Exception):
            pass
        # 兼容旧版明文存储
        return str(encrypted_value) if encrypted_value else ""

    @classmethod
    def serialize(
        cls, records: list[AIModelConfig],
    ) -> list[dict[str, Any]]:
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
