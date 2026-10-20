"""修复 LLM 运行时配置：用当前 SECRET_KEY 重新加密 .env 中的 API Key 写入 DB。

背景：llm_runtime_config 中的 API Key 由旧 SECRET_KEY 加密，当前密钥轮换后
解密失败 → llm_service.config.api_key 为空 → provider_factory 空 Bearer。

本脚本从 backend/.env 读取 OPENAI_API_KEY / OPENAI_BASE_URL / LLM_MODEL /
LLM_PROVIDER，构造 LLMConfig 并调用 save_config_to_db 重新加密持久化。
不打印任何密钥明文。

用法：cd backend && venv\\Scripts\\python -m scripts.fix_llm_config
"""
from __future__ import annotations

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services.llm_service import LLMConfig, save_config_to_db, load_config_from_db


def _read_env(key: str) -> str:
    env_path = Path(__file__).resolve().parents[1] / ".env"
    for line in env_path.read_text(encoding="utf-8", errors="ignore").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, _, v = line.partition("=")
        if k.strip() == key:
            return v.strip().strip('"').strip("'")
    return ""


async def _verify() -> bool:
    cfg = await load_config_from_db()
    if cfg is None:
        print("VERIFY: load_config_from_db returned None")
        return False
    key_len = len(cfg.api_key or "")
    print(f"VERIFY: provider={cfg.provider} model={cfg.model} base_url={cfg.base_url} api_key_len={key_len}")
    return key_len > 0


def main() -> None:
    provider = _read_env("LLM_PROVIDER") or "openai"
    api_key = _read_env("OPENAI_API_KEY")
    base_url = _read_env("OPENAI_BASE_URL")
    model = _read_env("LLM_MODEL")

    if not api_key:
        print("ERROR: .env 中未找到 OPENAI_API_KEY")
        return
    print(f"使用 .env 配置重新加密写入: provider={provider} model={model} base_url={base_url} key_len={len(api_key)}")

    cfg = LLMConfig(
        provider=provider,
        api_key=api_key,
        base_url=base_url,
        model=model,
        max_tokens=4096,
        temperature=0.7,
    )
    ok = save_config_to_db(cfg)
    print("save_config_to_db:", "OK" if ok else "FAILED")

    # 异步验证
    asyncio.run(_verify())


if __name__ == "__main__":
    main()