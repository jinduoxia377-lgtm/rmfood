"""
提示词服务 - 支持热加载和场景化切换 (ADR-029 P1-2)

设计原则:
1. 配置文件热加载：修改 YAML 后自动生效
2. 场景映射：根据用户场景自动选择提示词
3. 缓存机制：减少频繁文件 IO
4. 版本控制：支持提示词版本化管理

@version 1.0.0
@created 2026-09-21
"""
from __future__ import annotations

import logging
import hashlib
from pathlib import Path
from typing import Optional, Dict
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)

try:
    import yaml
    YAML_AVAILABLE = True
except ImportError:
    YAML_AVAILABLE = False
    logger.warning("[PromptService] PyYAML 未安装，将使用内置提示词")


@dataclass
class PromptConfig:
    """提示词配置"""
    version: str = "1.0"
    system_prompts: Dict[str, str] = field(default_factory=dict)
    scenarios: Dict[str, str] = field(default_factory=dict)
    cache_ttl: int = 300


class PromptService:
    """
    提示词服务 - 支持热加载和场景化切换

    Usage:
        service = get_prompt_service()
        prompt = service.get_scenario_prompt("formula_design")
    """

    def __init__(self, config_path: str = "conf/prompts/default.yaml"):
        self.config_path = Path(config_path)
        self._config: PromptConfig = PromptConfig()
        self._config_hash: str = ""
        self._last_loaded: float = 0
        self._load_config()

    def _calculate_hash(self, content: str) -> str:
        """计算配置内容的哈希值"""
        return hashlib.md5(content.encode('utf-8')).hexdigest()[:16]

    def _load_config(self) -> bool:
        """加载配置文件"""
        try:
            if not self.config_path.exists():
                logger.warning(f"[PromptService] 配置文件不存在: {self.config_path}，使用内置提示词")
                self._load_builtin_prompts()
                return False

            with open(self.config_path, 'r', encoding='utf-8') as f:
                content = f.read()

            new_hash = self._calculate_hash(content)
            if new_hash == self._config_hash:
                return True  # 配置未变化

            if YAML_AVAILABLE:
                data = yaml.safe_load(content)
                self._config = PromptConfig(
                    version=data.get('version', '1.0'),
                    system_prompts=data.get('system_prompts', {}),
                    scenarios=data.get('scenarios', {}),
                    cache_ttl=data.get('cache', {}).get('ttl_seconds', 300),
                )
            else:
                self._load_builtin_prompts()

            self._config_hash = new_hash
            self._last_loaded = __import__('time').time()
            logger.info(f"[PromptService] 提示词配置已加载: {len(self._config.system_prompts)} 个提示词, "
                       f"{len(self._config.scenarios)} 个场景")
            return True

        except Exception as e:
            logger.error(f"[PromptService] 加载配置失败: {e}，使用内置提示词")
            self._load_builtin_prompts()
            return False

    def _load_builtin_prompts(self) -> None:
        """加载内置提示词（作为 fallback）"""
        self._config.system_prompts = {
            "base": """你是 RMFOOD 配方设计平台的 AI 配方顾问，专精于药食同源功能性食品的研发。

## 你的专业领域
1. 药食同源中药学：熟悉国家卫健委公布的药食同源目录
2. 功能性食品配方：了解配方设计原则、功效成分配伍、剂量安全范围
3. 食品安全法规：熟悉 GB standards、保健食品注册备案要求

## 输出要求
- 基于中医药理论和现代科学证据
- 提供具体用量建议和安全依据
- 标注可能的禁忌和注意事项
- 如不确定，明确说明""",
            "academician": """你是一位拥有30年药食同源功能性食品研发经验的院士级专家。

## 核心回答原则
1. 【绝对安全】所有建议必须在药食同源目录安全剂量范围内
2. 【专业严谨】引用具体数据、科学研究和法规条文
3. 【完整详尽】每个回答覆盖全部相关维度
4. 【结构清晰】使用专业Markdown排版""",
            "consultant": """你是一位专业的药食同源顾问，专注于为用户提供科学、实用的配方建议。

## 回答原则
1. 语言通俗易懂，避免过多专业术语
2. 提供具体可操作的建议
3. 强调安全性和适用人群""",
        }
        self._config.scenarios = {
            "default": "base",
            "formula_design": "academician",
            "safety_check": "academician",
            "general_qa": "consultant",
        }
        self._config_hash = self._calculate_hash(str(self._config.system_prompts))

    def _check_reload(self) -> None:
        """检查是否需要重新加载配置"""
        try:
            if not self.config_path.exists():
                return
            mtime = self.config_path.stat().st_mtime
            if mtime > self._last_loaded:
                logger.info("[PromptService] 检测到配置文件变更，重新加载...")
                self._load_config()
        except Exception as e:
            logger.debug(f"[PromptService] 检查配置失败: {e}")

    def get_prompt(self, prompt_key: str) -> Optional[str]:
        """
        获取指定键的提示词

        Args:
            prompt_key: 提示词键名 (如 "academician", "consultant")

        Returns:
            提示词文本，如果键不存在则返回 None
        """
        self._check_reload()
        return self._config.system_prompts.get(prompt_key)

    def get_scenario_prompt(self, scenario: str) -> str:
        """
        根据场景获取提示词（自动 fallback 到 base）

        Args:
            scenario: 场景名 (如 "formula_design", "safety_check")

        Returns:
            对应的提示词文本
        """
        self._check_reload()
        prompt_key = self._config.scenarios.get(scenario, self._config.scenarios.get("default", "base"))
        return self._config.system_prompts.get(prompt_key, self._config.system_prompts.get("base", ""))

    def list_prompts(self) -> list[str]:
        """列出所有可用提示词键"""
        self._check_reload()
        return list(self._config.system_prompts.keys())

    def list_scenarios(self) -> dict[str, str]:
        """列出所有场景映射"""
        self._check_reload()
        return dict(self._config.scenarios)

    def get_config_info(self) -> dict:
        """获取配置信息（用于调试）"""
        return {
            "version": self._config.version,
            "prompt_count": len(self._config.system_prompts),
            "scenario_count": len(self._config.scenarios),
            "config_hash": self._config_hash,
            "config_path": str(self.config_path),
            "last_loaded": self._last_loaded,
        }

    def reload(self) -> bool:
        """强制重新加载配置"""
        logger.info("[PromptService] 强制重新加载配置")
        return self._load_config()


# ── 全局单例 ──

_prompt_service: Optional[PromptService] = None


def get_prompt_service() -> PromptService:
    """获取全局 PromptService 单例"""
    global _prompt_service
    if _prompt_service is None:
        _prompt_service = PromptService()
    return _prompt_service


def reset_prompt_service() -> None:
    """重置全局单例（用于测试）"""
    global _prompt_service
    _prompt_service = None
    logger.info("[PromptService] 全局单例已重置")


__all__ = [
    "PromptService",
    "get_prompt_service",
    "reset_prompt_service",
    "PromptConfig",
]
