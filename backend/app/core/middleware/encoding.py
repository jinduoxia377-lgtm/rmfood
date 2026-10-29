"""
UTF-8 编码规范化中间件
确保所有 HTTP 响应和请求使用 UTF-8 编码
"""
import logging

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger(__name__)


class UTF8EncodingMiddleware(BaseHTTPMiddleware):
    """
    UTF-8 编码规范化中间件

    功能:
    1. 确保所有 JSON 响应使用 Content-Type: application/json; charset=utf-8
    2. 处理请求中的中文文件名
    3. 规范化文件名编码
    """

    async def dispatch(self, request: Request, call_next):
        try:
            response = await call_next(request)

            # 规范化 Content-Type 头，添加 charset=utf-8
            content_type = response.headers.get("content-type", "")

            if content_type.startswith("application/json"):
                # 如果没有 charset，添加 utf-8
                if "charset" not in content_type.lower():
                    content_type = f"{content_type}; charset=utf-8"
                    response.headers["content-type"] = content_type
                    logger.debug(f"添加 UTF-8 编码到 JSON 响应: {content_type}")

            elif content_type.startswith("text/"):
                # 确保文本响应也使用 UTF-8
                if "charset" not in content_type.lower():
                    content_type = f"{content_type}; charset=utf-8"
                    response.headers["content-type"] = content_type

            # 添加响应头标记编码已规范化
            response.headers["X-Content-Type-Options"] = "nosniff"

            return response

        except Exception:
            logger.error("UTF8EncodingMiddleware 错误", exc_info=True)
            raise


def sanitize_filename(filename: str) -> str:
    """
    规范化文件名，防止路径穿越和安全问题

    Args:
        filename: 原始文件名

    Returns:
        规范化后的安全文件名
    """
    import os
    import re
    import unicodedata

    # 1. 规范化 Unicode 字符（NFC 标准化）
    # 将所有字符转为 NFC 形式，确保跨平台一致性
    normalized = unicodedata.normalize('NFC', filename)

    # 2. 替换路径分隔符
    normalized = normalized.replace('/', '_').replace('\\', '_')

    # 3. 移除或替换危险字符（保留中文、字母、数字、常见符号）
    # 允许：中文、日文、韩文、拉丁字母、数字、空格、点、连字符、下划线
    safe_chars = []
    for char in normalized:
        code = ord(char)
        # 保留字母、数字、基本标点
        if (0x0041 <= code <= 0x005A) or (0x0061 <= code <= 0x007A) or \
           (0x0030 <= code <= 0x0039) or char in ' .-_':
            safe_chars.append(char)
        # 保留中文（CJK统一汉字）
        elif 0x4E00 <= code <= 0x9FFF:
            safe_chars.append(char)
        # 保留日文平假名和片假名
        elif (0x3040 <= code <= 0x309F) or (0x30A0 <= code <= 0x30FF):
            safe_chars.append(char)
        # 保留韩文
        elif 0xAC00 <= code <= 0xD7AF:
            safe_chars.append(char)
        else:
            safe_chars.append('_')

    sanitized = ''.join(safe_chars)

    # 4. 移除连续的点（防止 .. 路径穿越）
    sanitized = re.sub(r'\.{2,}', '.', sanitized)

    # 5. 移除开头和结尾的点
    sanitized = sanitized.strip('.')

    # 6. 确保文件名不为空
    if not sanitized:
        sanitized = 'unnamed_file'

    # 7. 限制文件名长度（Windows 最大 255）
    if len(sanitized) > 200:
        name, ext = os.path.splitext(sanitized)
        name = name[:200 - len(ext)]
        sanitized = name + ext

    return sanitized


def encode_filename_for_header(filename: str) -> str:
    """
    为 HTTP 响应头编码文件名（RFC 5987 / RFC 6266）

    Args:
        filename: 原始文件名

    Returns:
        编码后的文件名（包含 ASCII 和 filename* 格式）
    """
    import urllib.parse

    # RFC 5987 编码
    encoded = urllib.parse.quote(filename, safe='')

    # 尝试使用 UTF-8 编码的 filename* 参数
    # 格式: filename*=UTF-8''encoded_name
    filename_star = f"filename*=UTF-8''{encoded}"

    return filename_star


def decode_filename_from_request(filename_encoded: str) -> str:
    """
    解码请求中的文件名（支持 URL 编码）

    Args:
        filename_encoded: URL 编码的文件名

    Returns:
        解码后的文件名
    """
    import urllib.parse

    # 尝试解码
    try:
        # 首先尝试直接解码
        decoded = urllib.parse.unquote(filename_encoded)
        # 验证解码结果是否有效
        decoded.encode('utf-8')
        return decoded
    except (UnicodeDecodeError, UnicodeEncodeError):
        # 如果失败，尝试 latin-1（某些客户端使用）
        try:
            return filename_encoded.encode('latin-1').decode('utf-8')
        except Exception as e:
            logger.debug("文件名编码转换失败，使用原始字符串: %s", e)
            # 最后回退到原始字符串
            return filename_encoded
