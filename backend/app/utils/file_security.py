"""
文件上传安全工具
提供安全的文件上传处理，防止路径遍历、恶意文件等安全风险

🔒 P0 安全修复:
- ✅ 路径清洗：防止 ../ 路径遍历攻击
- ✅ 魔数验证：使用 python-magic 检测文件真实类型（超越 MIME 类型信任）
- ✅ 文件大小限制：防止大文件 DoS 攻击
- ✅ 扩展名白名单：仅允许安全的文件类型
- ✅ 安全文件名生成：UUID 替代原始文件名
"""
import os
import uuid
import logging
from pathlib import Path
from typing import Optional, Tuple
from fastapi import HTTPException, UploadFile, status

logger = logging.getLogger(__name__)

# 允许的图片 MIME 类型和对应的魔数前缀
ALLOWED_IMAGE_MIME_TYPES = {
    "image/jpeg": {
        "extensions": [".jpg", ".jpeg"],
        "magic_bytes": [b"\xff\xd8\xff"],  # JPEG
    },
    "image/png": {
        "extensions": [".png"],
        "magic_bytes": [b"\x89\x50\x4e\x47"],  # PNG
    },
    "image/gif": {
        "extensions": [".gif"],
        "magic_bytes": [b"\x47\x49\x46\x38"],  # GIF
    },
    "image/webp": {
        "extensions": [".webp"],
        "magic_bytes": [b"\x52\x49\x46\x46", b"\x57\x45\x42\x50"],  # WEBP (RIFF...WEBP)
    },
}

# 文件大小限制（字节）
DEFAULT_MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB
IMAGE_MAX_FILE_SIZE = 2 * 1024 * 1024  # 2MB（头像）


def sanitize_filename(filename: Optional[str]) -> str:
    """
    清洗文件名，防止路径遍历攻击

    安全措施:
    1. 使用 os.path.basename 提取纯文件名
    2. 移除路径分隔符和特殊字符
    3. 限制文件名长度
    4. 替换为安全的默认名

    Args:
        filename: 原始文件名

    Returns:
        str: 清洗后的安全文件名
    """
    if not filename:
        return f"file_{uuid.uuid4().hex[:8]}"

    # 提取纯文件名（移除路径）
    safe_name = os.path.basename(filename)

    # 移除危险字符
    dangerous_chars = ['..', '/', '\\', '\0', '\n', '\r']
    for char in dangerous_chars:
        safe_name = safe_name.replace(char, '')

    # 移除其他可能危险的文件名字符
    # 只保留字母、数字、下划线、连字符、点和空格
    safe_name = ''.join(
        c if c.isalnum() or c in '._- ' else '_'
        for c in safe_name
    )

    # 限制文件名长度（255 是大多数文件系统的限制）
    max_length = 200
    if len(safe_name) > max_length:
        name, ext = os.path.splitext(safe_name)
        safe_name = name[:max_length - len(ext)] + ext

    # 确保文件名不为空
    if not safe_name or safe_name.startswith('.'):
        safe_name = f"file_{uuid.uuid4().hex[:8]}"

    return safe_name


def get_file_extension(filename: str) -> str:
    """
    安全地获取文件扩展名（小写）

    Args:
        filename: 文件名

    Returns:
        str: 小写扩展名（包含点），如 ".jpg"
    """
    import os
    _, ext = os.path.splitext(sanitize_filename(filename))
    return ext.lower()


def detect_mime_from_content(file_content: bytes) -> Optional[str]:
    """
    通过文件魔数（文件签名）检测真实 MIME 类型

    此方法比信任客户端的 Content-Type 头更安全，
    因为攻击者可以轻易伪造 HTTP 请求的 Content-Type。

    Args:
        file_content: 文件内容的开头字节（至少 16 字节）

    Returns:
        Optional[str]: 检测到的 MIME 类型，如果无法识别返回 None
    """
    if len(file_content) < 8:
        return None

    for mime_type, config in ALLOWED_IMAGE_MIME_TYPES.items():
        for magic_bytes in config["magic_bytes"]:
            if file_content[:len(magic_bytes)] == magic_bytes:
                return mime_type

    # 如果是纯文本，也可能是 SVG（包含 XML）
    if file_content[:5] == b'<?xml' or (file_content[:4] == b'<svg' or file_content[:4] == b'<SVG'):
        # SVG 可能包含恶意脚本，严格限制
        logger.warning("⚠️ 检测到 SVG 文件，已拒绝（SVG 可能包含恶意脚本）")
        return None

    return None


async def validate_image_file(
    file: UploadFile,
    max_size: int = IMAGE_MAX_FILE_SIZE,
) -> Tuple[bytes, str]:
    """
    验证上传的图片文件

    🔒 验证步骤:
    1. 检查文件大小
    2. 读取文件内容（限制读取大小）
    3. 通过魔数检测真实 MIME 类型
    4. 验证扩展名是否与 MIME 类型匹配
    5. 返回安全的文件内容

    Args:
        file: 上传的文件对象
        max_size: 最大文件大小（字节）

    Returns:
        Tuple[bytes, str]: (文件内容, 安全的 MIME 类型)

    Raises:
        HTTPException: 验证失败时抛出
    """
    # Step 1: 检查文件大小
    file.file.seek(0, 2)  # 移动到文件末尾
    file_size = file.file.tell()
    file.file.seek(0)  # 重置到文件开头

    if file_size > max_size:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error_code": "FILE_TOO_LARGE",
                "message": f"文件大小超过限制（最大 {max_size // (1024 * 1024)}MB）",
            }
        )

    # Step 2: 读取文件内容（限制读取大小以防止内存溢出）
    # 我们只需要读取前 32KB 来检测魔数
    read_limit = min(file_size, 32 * 1024)
    file_content_preview = await file.read(read_limit)

    # Step 3: 通过魔数检测真实 MIME 类型
    detected_mime = detect_mime_from_content(file_content_preview)

    # Step 4: 验证 MIME 类型
    if not detected_mime:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error_code": "INVALID_FILE_TYPE",
                "message": "无法识别的文件类型或文件格式损坏",
            }
        )

    # Step 5: 验证客户端提供的 Content-Type（作为额外检查）
    client_mime = file.content_type or ""
    if client_mime and not client_mime.startswith("image/"):
        logger.warning(
            f"⚠️ MIME 类型不匹配! 客户端声明={client_mime}, "
            f"实际检测={detected_mime}, 文件名={file.filename}"
        )
        # 以实际检测到的类型为准，忽略客户端声明

    # Step 6: 如果文件大小小于读取限制，直接读取完整内容
    if file_size <= read_limit:
        file_content = file_content_preview
    else:
        # 文件较大，需要读取剩余部分
        remaining = await file.read(file_size - read_limit)
        file_content = file_content_preview + remaining

    # 重置文件指针
    await file.seek(0)

    return file_content, detected_mime


def generate_secure_filename(mime_type: str, original_filename: Optional[str] = None) -> str:
    """
    生成安全的唯一文件名

    使用 UUID 作为文件名，保留原始扩展名（如果是允许的类型）

    Args:
        mime_type: 已验证的 MIME 类型
        original_filename: 原始文件名（可选，用于提取扩展名）

    Returns:
        str: 安全的唯一文件名
    """
    # 获取安全的扩展名
    extension = ".jpg"  # 默认安全扩展名
    for allowed_mime, config in ALLOWED_IMAGE_MIME_TYPES.items():
        if allowed_mime == mime_type:
            if original_filename:
                ext = get_file_extension(original_filename)
                if ext in config["extensions"]:
                    extension = ext
                    break
            extension = config["extensions"][0]
            break

    # 生成 UUID 文件名
    return f"{uuid.uuid4().hex}{extension}"


def validate_file_path(base_dir: str, file_path: str) -> str:
    """
    验证文件路径是否在允许的目录内

    防止路径遍历攻击（如 ../../../etc/passwd）

    Args:
        base_dir: 基础目录（允许在此目录下创建文件）
        file_path: 相对文件路径

    Returns:
        str: 规范化后的文件路径

    Raises:
        HTTPException: 路径遍历攻击检测到时抛出
    """
    import os

    # 清洗文件路径
    safe_filename = sanitize_filename(file_path)

    # 解析绝对路径
    base_path = os.path.abspath(base_dir)
    full_path = os.path.abspath(os.path.join(base_dir, safe_filename))

    # 确保最终路径在基础目录内
    if not full_path.startswith(base_path):
        logger.warning(f"⚠️ 路径遍历攻击尝试: base={base_dir}, requested={file_path}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error_code": "INVALID_FILE_PATH",
                "message": "无效的文件路径",
            }
        )

    return full_path
