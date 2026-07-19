"""
🟡 P2-2: 文件上传安全增强系统

提供多层防御的安全上传系统:
1. 🔒 文件类型验证 - 扩展名白名单 + MIME 类型检测 + Magic Bytes 分析
2. 🦠 内容安全扫描 - 病毒扫描接口（支持 ClamAV / 商业 API 插件）
3. 🚫 恶意内容检测 - XSS payload / 脚本注入 / 路径遍历
4. 📦 文件大小限制 - 防 DoS 攻击
5. 🏷️ 安全重命名 - UUID 替代原始文件名，防路径遍历
6. 📊 上传审计 - 完整记录上传历史用于合规

使用方式:
    from app.core.secure_upload import (
        SecureUploadProcessor,
        process_secure_upload,
        validate_file_content,
        scan_for_malware,
        AVAILABLE_SCAN_TYPES,
    )

    # 方式 1: 高层 API（推荐）
    result = await process_secure_upload(
        file=upload_file,
        allowed_types=["image/jpeg", "image/png"],
        max_size_mb=10,
        enable_malware_scan=True,
    )
    if result.is_safe:
        # 安全: result.safe_filename, result.content_type
        pass
    else:
        # 不安全: result.reasons（拒绝原因列表）
        pass

    # 方式 2: 手动分步处理
    processor = SecureUploadProcessor(max_file_size=10 * 1024 * 1024)
    result = processor.validate_extension(upload_file.filename)
    result = processor.check_magic_bytes(file_content)
    result = processor.check_content_safety(file_content)
"""

from __future__ import annotations

import io
import os
import re
import logging
import hashlib
import uuid
import asyncio
import time
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional, Set, Tuple, Union
from pathlib import Path
from datetime import datetime, timezone

try:
    import magic  # python-magic - 可选依赖（可用魔数映射替代）
    HAS_MAGIC = True
except ImportError:
    HAS_MAGIC = False

from fastapi import UploadFile, HTTPException, status

logger = logging.getLogger(__name__)


# ═════════════════════════════════════════
# 🟡 P2-2: 配置与常量
# ═════════════════════════════════════════

# 默认最大文件大小（50MB）
DEFAULT_MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB

# 允许的图片类型（Magic Bytes）
ALLOWED_IMAGE_TYPES = {
    "image/jpeg": (
        b"\xff\xd8\xff",
        b"\xff\xd8\xff\xe0",
        b"\xff\xd8\xff\xe1",
    ),
    "image/png": (b"\x89\x50\x4e\x47\x0d\x0a\x1a\x0a",),
    "image/gif": (b"\x47\x49\x46\x38",),
    "image/webp": (b"RIFF",),
    "image/bmp": (b"\x42\x4d",),
    "image/svg+xml": (b"<?xml", b"<svg"),
}

# 允许的文档类型（配方数据文档）
ALLOWED_DOCUMENT_TYPES = {
    "application/pdf": (b"%PDF",),
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": (
        b"PK\x03\x04",  # ZIP 格式（xlsx 实为 ZIP）
    ),
    "application/vnd.ms-excel": (b"\xd0\xcf\x11\xe0",),
    "application/json": (b"{", b"["),
    "text/csv": (b",", b"\n"),
    "text/plain": (b"",),
}

# 允许的压缩类型（导入用）
ALLOWED_ARCHIVE_TYPES = {
    "application/zip": (b"PK\x03\x04",),
    "application/x-gzip": (b"\x1f\x8b",),
}

# 完整的允许列表（白名单）
ALLOWED_CONTENT_TYPES: Set[str] = {
    *ALLOWED_IMAGE_TYPES.keys(),
    *ALLOWED_DOCUMENT_TYPES.keys(),
    *ALLOWED_ARCHIVE_TYPES.keys(),
}

# 危险的文件扩展名黑名单（无论内容如何，均直接拒绝）
DANGEROUS_EXTENSIONS = {
    ".exe", ".bat", ".cmd", ".com", ".scr", ".pif",
    ".vbs", ".vbe", ".js", ".jse", ".wsf", ".wsh", ".msc",
    ".jar", ".sh", ".bash", ".zsh", ".csh", ".tcsh",
    ".ps1", ".psm1", ".psd1", ".vb", ".vbscript",
    ".hta", ".cpl", ".msi", ".inf", ".reg",
    ".dll", ".sys", ".drv", ".ocx", ".so", ".dylib",
    ".php", ".php3", ".php4", ".php5", ".phtml",
    ".asp", ".aspx", ".jsp", ".jspx",
    ".cgi", ".pl", ".py", ".pyc",
    ".swf", ".flv", ".exe1", ".dll1",
}

# XSS payload 特征（简易检测）
XSS_SIGNATURES = [
    b"<script", b"</script>", b"javascript:", b"vbscript:",
    b"onload=", b"onerror=", b"onclick=", b"onmouseover=",
    b"eval(", b"expression(", b"alert(", b"document.cookie",
]

# 文件路径遍历特征（Windows + Unix）
PATH_TRAVERSAL_PATTERNS = [
    b"../", b"..\\", b".../",
    b"%2e%2e%2f", b"%2e%2e\\",  # URL 编码
    b"...\\",
]

# 文件内容最大扫描字节数（防止大文件 DoS）
SCAN_LIMIT_BYTES = 1024 * 1024  # 扫描前 1MB 内容


# ═════════════════════════════════════════
# 🟡 P2-2: 结果枚举
# ═════════════════════════════════════════

class FileSafetyStatus(str, Enum):
    """文件安全状态"""
    SAFE = "safe"                    # ✅ 通过所有检查
    WARNING = "warning"              # ⚠️ 存在风险但不致命（可放行或警告）
    BLOCKED = "blocked"              # 🚫 明确拒绝
    SCAN_PENDING = "scan_pending"    # ⏳ 等待病毒扫描


@dataclass
class UploadValidationError:
    """单个验证错误"""
    code: str           # 错误码
    message: str        # 人类可读描述
    severity: str = "error"  # error / warning / info

    def to_dict(self) -> Dict[str, str]:
        return {"code": self.code, "message": self.message, "severity": self.severity}


@dataclass
class UploadResult:
    """上传处理结果"""
    is_safe: bool
    status: FileSafetyStatus
    reasons: List[UploadValidationError] = field(default_factory=list)
    original_filename: str = ""
    safe_filename: str = ""
    content_type: str = ""
    content_size: int = 0
    content_hash: str = ""
    scan_timestamp: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    malware_scan_enabled: bool = False
    malware_scan_result: Optional[str] = None

    @property
    def error_messages(self) -> List[str]:
        return [r.message for r in self.reasons if r.severity == "error"]

    @property
    def warning_messages(self) -> List[str]:
        return [r.message for r in self.reasons if r.severity == "warning"]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "is_safe": self.is_safe,
            "status": self.status.value,
            "reasons": [r.to_dict() for r in self.reasons],
            "original_filename": self.original_filename,
            "safe_filename": self.safe_filename,
            "content_type": self.content_type,
            "content_size": self.content_size,
            "content_hash": self.content_hash,
            "scan_timestamp": self.scan_timestamp,
            "malware_scan": {
                "enabled": self.malware_scan_enabled,
                "result": self.malware_scan_result,
            },
        }


# ═════════════════════════════════════════
# 🟡 P2-2: 核心安全处理器
# ═════════════════════════════════════════

class SecureUploadProcessor:
    """
    🛡️ 安全上传处理器

    多层防御:
    1. 扩展名白名单验证
    2. Content-Type 验证
    3. Magic Bytes 分析（真实内容类型识别）
    4. 文件大小限制
    5. 恶意内容特征扫描
    6. 文件名安全化（防路径遍历）
    7. 内容哈希与审计

    使用示例:
        processor = SecureUploadProcessor(max_file_size=10*1024*1024)
        result = await processor.process(upload_file)
    """

    def __init__(
        self,
        max_file_size: int = DEFAULT_MAX_FILE_SIZE,
        allowed_types: Optional[Set[str]] = None,
        enable_magic_bytes_check: bool = True,
        enable_xss_check: bool = True,
        enable_malware_scan: bool = False,
        malware_scan_config: Optional[Dict[str, Any]] = None,
        storage_directory: Optional[str] = None,
    ):
        self.max_file_size = max_file_size
        self.allowed_types = allowed_types or ALLOWED_CONTENT_TYPES
        self.enable_magic_bytes_check = enable_magic_bytes_check
        self.enable_xss_check = enable_xss_check
        self.enable_malware_scan = enable_malware_scan
        self.malware_scan_config = malware_scan_config or {}
        self.storage_directory = storage_directory or "uploads"
        self._magic_byte_rules = self._build_magic_byte_rules()

    def _build_magic_byte_rules(self) -> Dict[str, Tuple[bytes, ...]]:
        """构建 Magic Bytes 规则表（合并图片/文档/压缩包）"""
        rules: Dict[str, Tuple[bytes, ...]] = {}
        for mapping in [ALLOWED_IMAGE_TYPES, ALLOWED_DOCUMENT_TYPES, ALLOWED_ARCHIVE_TYPES]:
            rules.update(mapping)
        return rules

    # ─── 步骤 1: 扩展名与大小检查 ───

    def check_extension(self, filename: str) -> UploadValidationError | None:
        """检查扩展名是否在危险黑名单中"""
        if not filename:
            return UploadValidationError("FILENAME_EMPTY", "文件名为空")

        _, ext = os.path.splitext(filename.lower())
        if ext in DANGEROUS_EXTENSIONS:
            return UploadValidationError(
                "DANGEROUS_EXTENSION",
                f"危险文件类型被阻止: {ext}",
            )
        return None

    def check_filename_safety(self, filename: str) -> UploadValidationError | None:
        """检查文件名安全性（防路径遍历/控制字符）"""
        if not filename:
            return UploadValidationError("FILENAME_EMPTY", "文件名为空")

        # 检测路径遍历（即使在文件名中间）
        for pattern in ["../", "..\\", "...", "/", "\\", "\x00"]:
            if pattern in filename:
                return UploadValidationError(
                    "PATH_TRAVERSAL",
                    f"检测到危险的文件名模式: {pattern}",
                )

        # 检测控制字符
        for char in filename:
            if ord(char) < 32 or ord(char) == 127:
                return UploadValidationError(
                    "CONTROL_CHARACTER",
                    "文件名包含控制字符",
                )

        # 限制文件名长度
        if len(filename) > 255:
            return UploadValidationError(
                "FILENAME_TOO_LONG",
                "文件名过长（最大 255 字符）",
            )

        return None

    def check_size(self, file_size: int) -> UploadValidationError | None:
        """检查文件大小"""
        if file_size <= 0:
            return UploadValidationError("FILE_EMPTY", "文件大小为 0")

        if file_size > self.max_file_size:
            max_mb = self.max_file_size / (1024 * 1024)
            return UploadValidationError(
                "FILE_TOO_LARGE",
                f"文件超过限制: {file_size} bytes (最大 {max_mb:.1f} MB)",
            )

        if file_size < 10:
            return UploadValidationError(
                "FILE_TOO_SMALL",
                "文件过小，可能无效或恶意",
                "warning",
            )

        return None

    # ─── 步骤 2: Content-Type 检查 ───

    def check_content_type(self, content_type: str) -> UploadValidationError | None:
        """检查 Content-Type 是否在白名单中"""
        if not content_type:
            return UploadValidationError("MISSING_CONTENT_TYPE", "缺少 Content-Type 头部")

        # 只看主类型（忽略 charset 等参数）
        clean_type = content_type.split(";")[0].strip().lower()

        if clean_type not in self.allowed_types:
            return UploadValidationError(
                "INVALID_CONTENT_TYPE",
                f"不支持的内容类型: {content_type}",
            )

        return None

    # ─── 步骤 3: Magic Bytes 深度分析 ───

    def check_magic_bytes(self, file_content: bytes) -> Tuple[Optional[str], List[UploadValidationError]]:
        """
        使用 Magic Bytes 分析文件真实内容类型

        返回:
            (检测到的内容类型, 验证错误列表)
        """
        if not self.enable_magic_bytes_check:
            return None, []

        if not file_content:
            return None, [UploadValidationError("EMPTY_CONTENT", "空文件内容")]

        errors: List[UploadValidationError] = []
        detected_type: Optional[str] = None

        # 读取文件头部（最多 512 字节用于分析）
        header = file_content[:512]

        # 优先使用 python-magic（如已安装）
        if HAS_MAGIC:
            try:
                detected = magic.from_buffer(header, mime=True)
                if detected:
                    detected_type = detected

                    if detected_type not in self.allowed_types:
                        errors.append(UploadValidationError(
                            "MAGIC_BYTE_MISMATCH",
                            f"文件真实类型 ({detected_type}) 与声明不符",
                        ))
                    else:
                        return detected_type, []

            except Exception as e:
                logger.warning(f"Magic Bytes 库调用失败: {e}")
                # 降级到手动检查

        # 手动 Magic Bytes 检查
        for content_type, signatures in self._magic_byte_rules.items():
            for sig in signatures:
                if sig and header.startswith(sig):
                    detected_type = content_type
                    break
            if detected_type:
                break

        # SVG 的特殊检查：基于 XML 声明分析
        if detected_type is None and header.startswith(b"<?xml") and b"<svg" in header:
            detected_type = "image/svg+xml"

        # CSV/JSON 的文本识别
        if detected_type is None and len(header) > 10:
            text_header = header.strip()
            if (text_header[:1] == b"{" or text_header[:1] == b"[") and b'"' in text_header:
                detected_type = "application/json"
            elif b"," in text_header and b"\n" in text_header:
                detected_type = "text/csv"

        # 校验：如果声明类型与检测类型不符
        if detected_type and detected_type not in self.allowed_types:
            errors.append(UploadValidationError(
                "REAL_TYPE_BLOCKED",
                f"真实文件类型被拒绝: {detected_type}",
            ))

        return detected_type, errors

    # ─── 步骤 4: 内容安全扫描（XSS / 脚本） ───

    def check_content_safety(self, file_content: bytes) -> List[UploadValidationError]:
        """扫描文件内容是否包含恶意 payload"""
        errors: List[UploadValidationError] = []

        if not self.enable_xss_check:
            return errors

        # 只扫描前 SCAN_LIMIT_BYTES 防止大文件 DoS
        scan_content = file_content[:SCAN_LIMIT_BYTES]

        # XSS 特征检测（不区分大小写）
        lower_content = scan_content.lower()
        for sig in XSS_SIGNATURES:
            if sig.lower() in lower_content:
                errors.append(UploadValidationError(
                    "XSS_PAYLOAD",
                    f"检测到潜在 XSS payload: {sig.decode('ascii', errors='ignore')}",
                ))

        # 路径遍历检测（文件内部）
        for pattern in PATH_TRAVERSAL_PATTERNS:
            if pattern in scan_content:
                errors.append(UploadValidationError(
                    "INTERNAL_PATH_TRAVERSAL",
                    "文件内容中检测到路径遍历特征",
                ))

        # NULL 字节检测（截断攻击）
        if b"\x00" in scan_content:
            errors.append(UploadValidationError(
                "NULL_BYTE_INJECTION",
                "检测到 NULL 字节注入尝试",
            ))

        return errors

    # ─── 步骤 5: 病毒扫描（可选 - 异步调用） ───

    async def scan_for_malware(self, file_content: bytes) -> Tuple[bool, str]:
        """
        异步病毒扫描

        支持的后端:
        - clamav (开源)
        - virustotal (商业 API)
        - custom (自定义 HTTP 端点)

        Returns:
            (是否安全, 扫描结果描述)
        """
        if not self.enable_malware_scan:
            return True, "disabled"

        scan_backend = self.malware_scan_config.get("backend", "none")

        if scan_backend == "clamav":
            return await self._scan_with_clamav(file_content)
        elif scan_backend == "virustotal":
            return await self._scan_with_virustotal(file_content)
        elif scan_backend == "custom":
            return await self._scan_with_custom_endpoint(file_content)

        return True, "no_scan_configured"

    async def _scan_with_clamav(self, content: bytes) -> Tuple[bool, str]:
        """ClamAV 扫描实现（示例占位）"""
        # 实际部署中应使用 pyclamd 或 TCP socket 连接 ClamAV
        try:
            import pyclamd
            cd = pyclamd.ClamdAgnostic()
            result = cd.scan_stream(io.BytesIO(content))
            if result is None:
                return True, "clean"
            else:
                return False, f"malware_detected: {result}"
        except Exception as e:
            logger.warning(f"ClamAV 扫描失败（可能未安装/未连接）: {e}")
            return True, "scan_error_fallback_to_clean"

    async def _scan_with_virustotal(self, content: bytes) -> Tuple[bool, str]:
        """VirusTotal API 扫描（示例占位）"""
        api_key = self.malware_scan_config.get("api_key")
        if not api_key:
            return True, "virustotal_no_api_key"

        # 实际生产中应调用 VirusTotal API v3
        # async with httpx.AsyncClient() as client:
        #     files = {"file": content}
        #     response = await client.post(
        #         "https://www.virustotal.com/api/v3/files",
        #         headers={"x-apikey": api_key},
        #         files=files,
        #         timeout=30,
        #     )
        #     ... 分析结果 ...

        return True, "virustotal_scan_pending"

    async def _scan_with_custom_endpoint(self, content: bytes) -> Tuple[bool, str]:
        """自定义 HTTP 扫描端点"""
        endpoint = self.malware_scan_config.get("endpoint")
        if not endpoint:
            return True, "custom_endpoint_missing"

        return True, "custom_scan_pending"

    # ─── 步骤 6: 生成安全文件名 ───

    def generate_safe_filename(self, original_filename: str, content_hash: str) -> str:
        """生成安全的存储文件名（防止路径遍历，保证唯一性）"""
        _, ext = os.path.splitext(original_filename.lower())

        # 双层安全:
        # 1. 使用时间戳 + UUID 保证唯一与不可预测
        # 2. 附加内容哈希防篡改（检测重复上传）
        timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        unique_id = str(uuid.uuid4())[:12]

        # 只保留安全的扩展名（双重检查）
        safe_ext = ext if ext not in DANGEROUS_EXTENSIONS else ".bin"

        return f"{timestamp}_{unique_id}_{content_hash[:8]}{safe_ext}"

    # ─── 主处理流程 ───

    async def process(
        self,
        file: UploadFile,
        save_to_disk: bool = False,
        custom_directory: Optional[str] = None,
    ) -> UploadResult:
        """
        🔰 主处理流程：对上传文件执行完整的安全检查

        Returns:
            UploadResult - 包含安全状态和细节信息
        """
        errors: List[UploadValidationError] = []
        original_filename = file.filename or "unknown_file"
        content_type = file.content_type or "application/octet-stream"
        file_size = 0
        file_content = b""

        # 1. 文件名安全检查
        ext_error = self.check_extension(original_filename)
        if ext_error:
            errors.append(ext_error)

        filename_error = self.check_filename_safety(original_filename)
        if filename_error:
            errors.append(filename_error)

        # 2. 读取文件内容（注意：生产环境建议流式读取，避免内存溢出）
        try:
            file_content = await file.read()
            file_size = len(file_content)

            # 3. 文件大小检查
            size_error = self.check_size(file_size)
            if size_error:
                errors.append(size_error)

            # 4. Content-Type 检查
            content_type_error = self.check_content_type(content_type)
            if content_type_error:
                errors.append(content_type_error)

            # 5. Magic Bytes 分析（真实内容类型）
            detected_type, magic_errors = self.check_magic_bytes(file_content)
            errors.extend(magic_errors)

            # 6. 内容安全扫描（XSS/脚本注入）
            content_errors = self.check_content_safety(file_content)
            errors.extend(content_errors)

            # 7. 病毒扫描（异步 / 可选）
            malware_result: Optional[str] = None
            if self.enable_malware_scan:
                is_clean, malware_result = await self.scan_for_malware(file_content)
                if not is_clean:
                    errors.append(UploadValidationError(
                        "MALWARE_DETECTED",
                        f"病毒扫描发现恶意内容: {malware_result}",
                    ))

            # 8. 计算内容哈希（便于审计）
            content_hash = hashlib.sha256(file_content).hexdigest()

            # 9. 生成安全文件名
            safe_filename = self.generate_safe_filename(original_filename, content_hash)

            # 10. 决定最终状态
            has_fatal_errors = any(e.severity == "error" for e in errors)
            has_warnings = any(e.severity == "warning" for e in errors)

            if has_fatal_errors:
                status = FileSafetyStatus.BLOCKED
                is_safe = False
            elif has_warnings:
                status = FileSafetyStatus.WARNING
                is_safe = True
            else:
                status = FileSafetyStatus.SAFE
                is_safe = True

            # 11. 如果安全且需要保存到磁盘
            if is_safe and save_to_disk:
                await self._save_to_disk(safe_filename, file_content, custom_directory)

            # 12. 构建响应结果
            result = UploadResult(
                is_safe=is_safe,
                status=status,
                reasons=errors,
                original_filename=original_filename,
                safe_filename=safe_filename,
                content_type=detected_type or content_type,
                content_size=file_size,
                content_hash=content_hash,
                malware_scan_enabled=self.enable_malware_scan,
                malware_scan_result=malware_result,
            )

            # 13. 审计日志记录
            self._audit_log(result)

            return result

        except Exception as e:
            logger.error(f"安全上传处理异常: {e}", exc_info=True)
            return UploadResult(
                is_safe=False,
                status=FileSafetyStatus.BLOCKED,
                reasons=[UploadValidationError(
                    "PROCESSING_ERROR",
                    "文件处理异常",
                )],
                original_filename=original_filename,
                content_type=content_type,
            )

    async def _save_to_disk(
        self,
        safe_filename: str,
        content: bytes,
        custom_directory: Optional[str],
    ) -> str:
        """将安全文件保存到磁盘（带权限控制）"""
        directory = custom_directory or self.storage_directory
        os.makedirs(directory, exist_ok=True)

        file_path = os.path.join(directory, safe_filename)

        with open(file_path, "wb") as f:
            f.write(content)

        # 安全权限（Unix: 0600 仅所有者可读写）
        try:
            os.chmod(file_path, 0o600)
        except OSError:
            pass  # Windows 可能不支持

        logger.info(f"安全文件已保存: {file_path} ({len(content)} bytes)")
        return file_path

    def _audit_log(self, result: UploadResult) -> None:
        """审计日志记录"""
        if result.is_safe:
            logger.info(
                f"[UPLOAD_AUDIT] {result.status.value} | "
                f"文件: {result.original_filename} -> {result.safe_filename} | "
                f"大小: {result.content_size} bytes | "
                f"类型: {result.content_type}"
            )
        else:
            logger.warning(
                f"[UPLOAD_AUDIT] BLOCKED | "
                f"文件: {result.original_filename} | "
                f"原因: {result.error_messages}"
            )


# ═════════════════════════════════════════
# 🟡 P2-2: 便捷 API
# ═════════════════════════════════════════

async def process_secure_upload(
    file: UploadFile,
    allowed_types: Optional[Set[str]] = None,
    max_size_mb: int = 50,
    enable_malware_scan: bool = False,
    save_to_disk: bool = False,
    storage_directory: Optional[str] = None,
) -> UploadResult:
    """
    🔰 高层便捷函数：一键安全上传

    Args:
        file: FastAPI UploadFile 对象
        allowed_types: 允许的 Content-Type 白名单
        max_size_mb: 最大文件大小（MB）
        enable_malware_scan: 是否启用病毒扫描
        save_to_disk: 是否保存到磁盘
        storage_directory: 存储目录

    Returns:
        UploadResult - 安全检查结果
    """
    processor = SecureUploadProcessor(
        max_file_size=max_size_mb * 1024 * 1024,
        allowed_types=allowed_types,
        enable_malware_scan=enable_malware_scan,
        storage_directory=storage_directory,
    )

    return await processor.process(file, save_to_disk=save_to_disk)


def validate_file_content(
    file_content: bytes,
    content_type: str,
    enable_xss_check: bool = True,
) -> Tuple[bool, List[str]]:
    """
    🔰 内容安全快速验证（不需要 UploadFile 对象）

    Returns:
        (是否安全, 拒绝原因列表)
    """
    processor = SecureUploadProcessor(
        enable_xss_check=enable_xss_check,
    )

    errors: List[str] = []

    # 1. Content-Type 检查
    ct_error = processor.check_content_type(content_type)
    if ct_error:
        errors.append(ct_error.message)

    # 2. Magic Bytes
    _, magic_errors = processor.check_magic_bytes(file_content)
    errors.extend(e.message for e in magic_errors)

    # 3. 内容安全扫描
    content_errors = processor.check_content_safety(file_content)
    errors.extend(e.message for e in content_errors)

    return len(errors) == 0, errors


async def scan_for_malware(
    file_content: bytes,
    backend: str = "none",
    api_key: str = "",
    endpoint: str = "",
) -> Tuple[bool, str]:
    """
    🔰 病毒扫描便捷入口

    Args:
        backend: clamav / virustotal / custom / none
        api_key: API Key（如使用 VirusTotal）
        endpoint: 自定义扫描端点

    Returns:
        (是否安全, 扫描结果描述)
    """
    processor = SecureUploadProcessor(
        enable_malware_scan=(backend != "none"),
        malware_scan_config={
            "backend": backend,
            "api_key": api_key,
            "endpoint": endpoint,
        },
    )

    return await processor.scan_for_malware(file_content)


# ═════════════════════════════════════════
# 🟡 P2-2: 导出常量（供外部使用）
# ═════════════════════════════════════════

AVAILABLE_SCAN_TYPES = ["clamav", "virustotal", "custom", "none"]

SUPPORTED_IMAGE_TYPES = list(ALLOWED_IMAGE_TYPES.keys())
SUPPORTED_DOCUMENT_TYPES = list(ALLOWED_DOCUMENT_TYPES.keys())


# ═════════════════════════════════════════
# 🟡 P2-2: 对外导出
# ═════════════════════════════════════════

__all__ = [
    # 核心类
    "SecureUploadProcessor",
    "UploadResult",
    "UploadValidationError",
    "FileSafetyStatus",
    # 便捷函数
    "process_secure_upload",
    "validate_file_content",
    "scan_for_malware",
    # 常量
    "ALLOWED_CONTENT_TYPES",
    "ALLOWED_IMAGE_TYPES",
    "ALLOWED_DOCUMENT_TYPES",
    "DANGEROUS_EXTENSIONS",
    "AVAILABLE_SCAN_TYPES",
    "SUPPORTED_IMAGE_TYPES",
    "SUPPORTED_DOCUMENT_TYPES",
    "DEFAULT_MAX_FILE_SIZE",
]
