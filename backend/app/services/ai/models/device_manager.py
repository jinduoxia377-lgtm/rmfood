"""GPU 加速支持 — 模型设备管理

支持 CPU/CUDA 自动检测和切换。
"""

from __future__ import annotations

import logging
from typing import Optional

logger = logging.getLogger(__name__)

_device: str = "cpu"
_cuda_available: bool = False


def detect_device() -> str:
    """检测可用设备"""
    global _device, _cuda_available

    try:
        import torch
        if torch.cuda.is_available():
            _cuda_available = True
            _device = "cuda"
            logger.info(f"[Device] CUDA 可用，使用 GPU: {torch.cuda.get_device_name(0)}")
        else:
            _cuda_available = False
            _device = "cpu"
            logger.info("[Device] 使用 CPU")
    except ImportError:
        _device = "cpu"
        _cuda_available = False

    return _device


def get_device() -> str:
    """获取当前设备"""
    return _device


def is_cuda_available() -> bool:
    """检查 CUDA 是否可用"""
    return _cuda_available


def move_to_device(obj, device: Optional[str] = None):
    """将对象移动到指定设备"""
    device = device or _device
    if hasattr(obj, 'to'):
        return obj.to(device)
    return obj


def get_torch_device() -> str:
    """获取 PyTorch 设备字符串"""
    device = get_device()
    if device == "cuda":
        return "cuda:0"
    return "cpu"


# 初始化时检测
detect_device()
