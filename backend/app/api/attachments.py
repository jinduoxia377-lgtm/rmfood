"""
文件附件 API
支持配方和实验的文件上传、下载、删除

🔒 安全增强:
- 魔数验证：检测文件真实类型，不信任客户端 Content-Type
- 文件类型白名单：仅允许安全的文件类型
- 文件大小限制：防止大文件 DoS 攻击
- 路径安全验证：防止路径遍历攻击
"""
import logging
import os
import uuid
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

logger = logging.getLogger(__name__)

from ..models.models import Attachment, Formula, Experiment, User
from ..services.auth import get_current_user
from ..api.deps import get_db_session
from ..utils.file_security import (
    ALLOWED_FILE_TYPES,
    MAX_ATTACHMENT_SIZE,
    detect_file_mime_from_content,
    sanitize_filename as file_security_sanitize_filename,
    validate_file_path,
)

router = APIRouter(prefix="/attachments", tags=["附件"])

# 上传目录
UPLOAD_DIR = "uploads"


def ensure_upload_dir():
    os.makedirs(UPLOAD_DIR, exist_ok=True)


@router.get("", summary="获取附件列表")
async def list_attachments(
    formula_id: int | None = Query(None),
    experiment_id: int | None = Query(None),
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """获取指定配方或实验的附件列表"""
    stmt = select(Attachment)
    if formula_id:
        stmt = stmt.where(Attachment.formula_id == formula_id)
    elif experiment_id:
        stmt = stmt.where(Attachment.experiment_id == experiment_id)
    else:
        raise HTTPException(status_code=400, detail="需要指定 formula_id 或 experiment_id")

    stmt = stmt.order_by(Attachment.created_at.desc())
    attachments = (await db.execute(stmt)).scalars().all()

    return [
        {
            "id": a.id,
            "file_name": a.file_name,
            "original_file_name": a.original_file_name or a.file_name,
            "file_size": a.file_size,
            "mime_type": a.mime_type,
            "uploaded_by": a.uploaded_by,
            "created_at": a.created_at.isoformat(),
        }
        for a in attachments
    ]


@router.post("", status_code=201, summary="上传附件")
async def upload_attachment(
    file: UploadFile = File(...),
    formula_id: int | None = Form(None),
    experiment_id: int | None = Form(None),
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """上传文件附件（含安全验证）

    🔒 安全验证:
    - 魔数检测：验证文件真实类型
    - 类型白名单：仅允许图片、PDF、Office 文档、CSV
    - 文件大小限制：不超过 50MB
    - 安全文件名：UUID 替代原始文件名
    - 路径安全：防止 ../ 遍历攻击
    """
    if not formula_id and not experiment_id:
        raise HTTPException(status_code=400, detail="需要指定 formula_id 或 experiment_id")

    # 验证目标存在
    if formula_id:
        target = await db.get(Formula, formula_id)
        if not target:
            raise HTTPException(status_code=404, detail="配方不存在")
    if experiment_id:
        target = await db.get(Experiment, experiment_id)
        if not target:
            raise HTTPException(status_code=404, detail="实验不存在")

    # ── 安全验证 ──

    # 1. 检查文件大小（先查看已读取的字节数）
    file.file.seek(0, 2)
    file_size = file.file.tell()
    file.file.seek(0)

    if file_size > MAX_ATTACHMENT_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error_code": "FILE_TOO_LARGE",
                "message": f"文件大小超过限制（最大 {MAX_ATTACHMENT_SIZE // (1024 * 1024)}MB）",
            }
        )

    # 2. 读取文件内容（限制读取大小以防止内存溢出）
    read_limit = min(file_size, 32 * 1024)
    file_content_preview = await file.read(read_limit)

    # 3. 魔数验证
    detected_mime = detect_file_mime_from_content(file_content_preview)

    if not detected_mime or detected_mime not in ALLOWED_FILE_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error_code": "INVALID_FILE_TYPE",
                "message": "不支持的文件类型。允许的格式：图片(JPEG/PNG/GIF/WebP)、PDF、Word、Excel、CSV",
            }
        )

    # 4. 验证客户端声明的 Content-Type（作为额外检查）
    client_mime = file.content_type or ""
    if client_mime and client_mime != detected_mime:
        logger.warning(
            f"MIME 类型不匹配: 客户端声明={client_mime}, 实际检测={detected_mime}, "
            f"文件名={file.filename}"
        )
        # 以实际检测到的类型为准

    # 5. 如果文件大小小于读取限制，读取完整内容
    if file_size <= read_limit:
        file_content = file_content_preview
    else:
        remaining = await file.read(file_size - read_limit)
        file_content = file_content_preview + remaining

    # 6. 生成安全的 UUID 文件名
    original_filename = file.filename or "unknown"
    safe_ext = ALLOWED_FILE_TYPES[detected_mime]["extensions"][0]
    unique_name = f"{uuid.uuid4().hex}{safe_ext}"

    # 7. 验证文件路径安全性
    ensure_upload_dir()
    file_path = validate_file_path(UPLOAD_DIR, unique_name)

    # 8. 保存文件
    with open(file_path, "wb") as f:
        f.write(file_content)

    # 9. 创建数据库记录
    attachment = Attachment(
        formula_id=formula_id,
        experiment_id=experiment_id,
        file_name=unique_name,
        original_file_name=file_security_sanitize_filename(original_filename),
        file_path=file_path,
        file_size=len(file_content),
        mime_type=detected_mime,
        uploaded_by=current_user.id,
    )
    db.add(attachment)
    await db.commit()
    await db.refresh(attachment)

    return {
        "id": attachment.id,
        "file_name": attachment.file_name,
        "original_file_name": attachment.original_file_name or attachment.file_name,
        "file_size": attachment.file_size,
        "mime_type": attachment.mime_type,
        "created_at": attachment.created_at.isoformat(),
    }


@router.delete("/{attachment_id}", summary="删除附件")
async def delete_attachment(
    attachment_id: int,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """删除附件（上传者或管理员）"""
    attachment = await db.get(Attachment, attachment_id)
    if not attachment:
        raise HTTPException(status_code=404, detail="附件不存在")

    # 权限校验：仅上传者本人或管理员可删除
    if attachment.uploaded_by != current_user.id and current_user.role.value != "admin":
        raise HTTPException(status_code=403, detail="无权删除此附件")

    # 删除物理文件
    if os.path.exists(attachment.file_path):
        os.remove(attachment.file_path)

    await db.delete(attachment)
    await db.commit()
    return {"message": "附件已删除"}
