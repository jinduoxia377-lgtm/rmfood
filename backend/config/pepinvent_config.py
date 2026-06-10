"""
PepINVENT 肽序列生成与优化引擎配置模块

基于 pydantic-settings 实现配置管理，支持从环境变量和 .env 文件加载。
提供模型路径、采样参数、强化学习参数、设备选择等配置项。

使用方式:
    from backend.config.pepinvent_config import PepinventConfig, get_pepinvent_config, check_dependencies

    config = get_pepinvent_config()
    print(config.device)
    deps = check_dependencies()
    print(deps)
"""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional


@dataclass
class SamplingParams:
    """采样参数配置"""

    temperature: float = 1.0
    top_k: int = 50
    batch_size: int = 32


@dataclass
class RLParams:
    """强化学习参数配置"""

    learning_rate: float = 0.0001
    epochs: int = 10
    batch_size: int = 128


@dataclass
class CacheConfig:
    """缓存配置"""

    enable_cache: bool = True
    cache_ttl: int = 3600


@dataclass
class PepinventConfig:
    """
    PepINVENT 引擎核心配置类

    支持从环境变量加载配置，提供路径验证和依赖检查功能。
    所有配置项均有合理默认值，可直接用于开发环境。
    """

    generative_model_path: str = "./models/pepinvent_generative.pt"
    predictor_model_path: str = "./models/pepinvent_predictor.pt"
    device: str = "auto"
    timeout_seconds: int = 60
    sampling: SamplingParams = field(default_factory=SamplingParams)
    rl: RLParams = field(default_factory=RLParams)
    cache: CacheConfig = field(default_factory=CacheConfig)

    @classmethod
    def from_env(cls) -> "PepinventConfig":
        """从环境变量创建配置实例"""

        return cls(
            generative_model_path=os.getenv(
                "PEPINVENT_GENERATIVE_MODEL_PATH",
                "./models/pepinvent_generative.pt",
            ),
            predictor_model_path=os.getenv(
                "PEPINVENT_PREDICTOR_MODEL_PATH",
                "./models/pepinvent_predictor.pt",
            ),
            device=os.getenv("PEPINVENT_DEVICE", "auto"),
            timeout_seconds=int(os.getenv("PEPINVENT_TIMEOUT_SECONDS", "60")),
            sampling=SamplingParams(
                temperature=float(os.getenv("PEPINVENT_TEMPERATURE", "1.0")),
                top_k=int(os.getenv("PEPINVENT_TOP_K", "50")),
                batch_size=int(os.getenv("PEPINVENT_BATCH_SIZE", "32")),
            ),
            rl=RLParams(
                learning_rate=float(os.getenv("PEPINVENT_LEARNING_RATE", "0.0001")),
                epochs=int(os.getenv("PEPINVENT_EPOCHS", "10")),
                batch_size=int(os.getenv("PEPINVENT_RL_BATCH_SIZE", "128")),
            ),
            cache=CacheConfig(
                enable_cache=os.getenv("PEPINVENT_ENABLE_CACHE", "true").lower() == "true",
                cache_ttl=int(os.getenv("PEPINVENT_CACHE_TTL", "3600")),
            ),
        )

    def validate(self) -> List[str]:
        """
        验证配置有效性，检查模型路径是否存在

        Returns:
            List[str]: 验证错误信息列表，空列表表示验证通过
        """
        errors: List[str] = []

        if self.device not in ("auto", "cuda", "cpu"):
            errors.append(f"无效的 device 值: {self.device}，必须是 auto|cuda|cpu")

        gen_path = Path(self.generative_model_path)
        if gen_path.exists():
            if not gen_path.is_file():
                errors.append(f"生成模型路径存在但不是文件: {self.generative_model_path}")

        pred_path = Path(self.predictor_model_path)
        if pred_path.exists():
            if not pred_path.is_file():
                errors.append(f"预测模型路径存在但不是文件: {self.predictor_model_path}")

        if self.sampling.temperature <= 0:
            errors.append(f"sampling.temperature 必须大于 0，当前值: {self.sampling.temperature}")

        if self.sampling.top_k <= 0:
            errors.append(f"sampling.top_k 必须大于 0，当前值: {self.sampling.top_k}")

        if self.sampling.batch_size <= 0:
            errors.append(f"sampling.batch_size 必须大于 0，当前值: {self.sampling.batch_size}")

        if self.rl.learning_rate <= 0:
            errors.append(f"rl.learning_rate 必须大于 0，当前值: {self.rl.learning_rate}")

        if self.rl.epochs <= 0:
            errors.append(f"rl.epochs 必须大于 0，当前值: {self.rl.epochs}")

        if self.timeout_seconds <= 0:
            errors.append(f"timeout_seconds 必须大于 0，当前值: {self.timeout_seconds}")

        return errors

    def get_device_str(self) -> str:
        """
        解析并返回实际使用的设备字符串

        Returns:
            str: "cuda" 或 "cpu"
        """
        if self.device == "auto":
            try:
                import torch

                return "cuda" if torch.cuda.is_available() else "cpu"
            except ImportError:
                return "cpu"
        return self.device

    def to_dict(self) -> Dict[str, Any]:
        """将配置转换为字典格式"""

        return {
            "generative_model_path": self.generative_model_path,
            "predictor_model_path": self.predictor_model_path,
            "device": self.device,
            "timeout_seconds": self.timeout_seconds,
            "sampling": {
                "temperature": self.sampling.temperature,
                "top_k": self.sampling.top_k,
                "batch_size": self.sampling.batch_size,
            },
            "rl": {
                "learning_rate": self.rl.learning_rate,
                "epochs": self.rl.epochs,
                "batch_size": self.rl.batch_size,
            },
            "cache": {
                "enable_cache": self.cache.enable_cache,
                "cache_ttl": self.cache.cache_ttl,
            },
        }


_config_instance: Optional[PepinventConfig] = None


def get_pepinvent_config() -> PepinventConfig:
    """
    获取 PepINVENT 配置单例实例

    Returns:
        PepinventConfig: 配置实例
    """
    global _config_instance

    if _config_instance is None:
        _config_instance = PepinventConfig.from_env()

    return _config_instance


def check_dependencies() -> Dict[str, Any]:
    """
    检查 PepINVENT 所需的 Python 依赖是否可用

    尝试导入 torch、rdkit、pepinvent 等关键依赖，
    返回各依赖的可用状态和版本信息。

    Returns:
        Dict[str, Any]: 包含以下键的字典:
            - available (bool): 所有必要依赖是否都可用
            - missing (List[str]): 缺失的依赖名称列表
            - version_info (Dict[str, Optional[str]]): 各依赖的版本信息
    """
    result: Dict[str, Any] = {
        "available": True,
        "missing": [],
        "version_info": {},
    }

    dependencies = [
        ("torch", "torch"),
        ("rdkit", "rdkit"),
        ("pepinvent", "pepinvent"),
        ("transformers", "transformers"),
    ]

    for display_name, import_name in dependencies:
        try:
            module = __import__(import_name)
            version = getattr(module, "__version__", None)
            result["version_info"][display_name] = version
        except ImportError:
            result["available"] = False
            result["missing"].append(display_name)
            result["version_info"][display_name] = None

    return result
