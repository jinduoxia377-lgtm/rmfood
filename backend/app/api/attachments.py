"""
文件附件 API
支持配方和实验的文件上传、下载、删除
"""
import os
import uuid
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from ..models.models import Attachment, Formula, Experiment, User
from ..services.auth import get_current_user
from ..api.deps import get_db_session
from ..core.encoding import sanitize_filename, decode_filename_from_request

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
    """上传文件附件"""
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

    # 保存文件
    ensure_upload_dir()

    # 解码和规范化文件名
    original_filename = file.filename or "unknown"
    decoded_filename = decode_filename_from_request(original_filename)
    safe_filename = sanitize_filename(decoded_filename)

    ext = os.path.splitext(safe_filename)[1] or ""
    unique_name = f"{uuid.uuid4().hex}{ext}"
    file_path = os.path.join(UPLOAD_DIR, unique_name)

    content = await file.read()
    with open(file_path, "wb") as f:
        f.write(content)

    # 创建数据库记录，使用安全的规范化文件名
    attachment = Attachment(
        formula_id=formula_id,
        experiment_id=experiment_id,
        file_name=safe_filename,
        original_file_name=decoded_filename,
        file_path=file_path,
        file_size=len(content),
        mime_type=file.content_type,
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
    if attachment.uploaded_by != current_user.id and current_user.role.value != "admin":
        raise HTTPException(status_code=403, detail="无权删除此附件")

    # 删除物理文件
    if os.path.exists(attachment.file_path):
        os.remove(attachment.file_path)

    await db.delete(attachment)
    await db.commit()
    return {"message": "附件已删除"}
