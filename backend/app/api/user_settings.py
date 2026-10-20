"""
用户设置 API 路由

提供用户个人设置相关的端点：
- 两步验证 (2FA) 启用/禁用/验证
- 设备管理（列表/移除）
- 用户偏好设置（语言、时区）
- 数据导出/导入
- 登录历史
"""
from datetime import datetime, timezone
from typing import Optional, List
import json
import zipfile
import io
import uuid
import os

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from fastapi.responses import StreamingResponse, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc

from ..api.deps import get_db_session, get_current_active_user, CurrentUser, require_role
from ..models import User, UserRole
from ..models.user_device import UserDevice

router = APIRouter(prefix="/users/me/settings", tags=["用户设置"])


# ── 两步验证 (2FA) ──

@router.get("/2fa/status", summary="查询 2FA 状态")
async def get_2fa_status(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db_session),
):
    """查询当前用户的 2FA 启用状态"""
    return {
        "enabled": bool(current_user.two_factor_enabled),
    }


@router.post("/2fa/enable", summary="开启 2FA 绑定（生成密钥，未启用）")
async def enable_2fa(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db_session),
):
    """生成两步验证密钥与备用码。

    注意：此端点只生成/保存密钥，**不会立即启用** 2FA（two_factor_enabled 保持 False）。
    用户在前端完成验证码校验（POST /2fa/verify 通过）后才会真正启用，
    避免"未完成绑定就锁死账户"的问题。
    """
    from ..core.security.totp import generate_secret, totp_uri

    # 生成密钥
    secret = generate_secret(20)

    # 保存密钥（不启用）
    current_user.two_factor_secret = secret
    current_user.two_factor_enabled = False
    await db.commit()

    # 生成备用验证码（10 个一次性码）
    import secrets as _secrets
    backup_codes = [_secrets.token_hex(3) for _ in range(10)]

    return {
        "enabled": False,
        "secret": secret,
        "otpauth_url": totp_uri(secret, issuer="RMFOOD", account=current_user.email or current_user.username),
        "backup_codes": backup_codes,
        "message": "请输入身份验证器中的验证码完成绑定（绑定成功后才启用两步验证）",
    }


@router.post("/2fa/disable", summary="禁用 2FA")
async def disable_2fa(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db_session),
):
    """禁用两步验证"""
    current_user.two_factor_secret = None
    current_user.two_factor_enabled = False
    await db.commit()
    return {"enabled": False, "message": "两步验证已禁用"}


@router.post("/2fa/verify", summary="验证 2FA 验证码（通过后启用）")
async def verify_2fa(
    code: str = Query(..., min_length=6, max_length=6),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db_session),
):
    """验证 2FA 验证码是否正确。

    若用户处于"待绑定"状态（two_factor_secret 存在但 two_factor_enabled=False），
    验证通过后将其标记为已启用——即"确认绑定"步骤。
    """
    if not current_user.two_factor_secret:
        raise HTTPException(status_code=400, detail="2FA 尚未启用")

    from ..core.security.totp import verify_totp

    if verify_totp(current_user.two_factor_secret, code):
        # 确认绑定：验证通过后真正启用 2FA
        if not current_user.two_factor_enabled:
            current_user.two_factor_enabled = True
            await db.commit()
        return {"valid": True, "enabled": True, "message": "验证码正确，两步验证已启用"}
    raise HTTPException(status_code=400, detail="验证码错误")


# ── 设备管理 ──

@router.get("/devices", summary="当前用户设备列表")
async def list_devices(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db_session),
):
    """获取当前用户所有登录设备

    修复: 原实现引用了 UserDevice 并不存在的列（platform/browser/ip_address/
    last_active/is_current），而实际模型与 user_devices 表只有
    device_type / last_sync_at / is_active，访问缺失属性 → AttributeError → 500。
    现按真实列对齐；device_type 为枚举，输出其值字符串。
    """
    result = await db.execute(
        select(UserDevice)
        .where(UserDevice.user_id == current_user.id)
        .order_by(UserDevice.last_sync_at.desc().nullsfirst())
    )
    devices = result.scalars().all()

    return {
        "devices": [
            {
                "id": d.id,
                "device_name": d.device_name or "Unknown Device",
                "device_type": (d.device_type.value if d.device_type else "unknown"),
                "last_active": d.last_sync_at.isoformat() if d.last_sync_at else None,
                "is_active": bool(d.is_active),
                # 单设备场景：该设备必然是当前使用的设备，标记为本机，避免误删
                "is_current": len(devices) == 1,
            }
            for d in devices
        ],
        "total": len(devices),
    }


@router.delete("/devices/{device_id}", summary="移除设备")
async def remove_device(
    device_id: int,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db_session),
):
    """移除指定设备（踢出对应登录会话）"""
    result = await db.execute(
        select(UserDevice).where(
            UserDevice.id == device_id,
            UserDevice.user_id == current_user.id,
        )
    )
    device = result.scalar_one_or_none()
    if not device:
        raise HTTPException(status_code=404, detail="设备不存在")

    await db.delete(device)
    await db.commit()
    return {"message": "设备已移除"}


# ── 用户偏好设置 ──

@router.get("/preferences", summary="获取用户偏好")
async def get_preferences(
    current_user: User = Depends(get_current_active_user),
):
    """获取当前用户的偏好设置（语言、时区等）"""
    prefs = current_user.preferences or {}
    return {
        "language": prefs.get("language", "zh-CN"),
        "timezone": prefs.get("timezone", "Asia/Shanghai"),
        "theme": prefs.get("theme", "light"),
        "notifications": prefs.get("notifications", {}),
    }


@router.put("/preferences", summary="更新用户偏好")
async def update_preferences(
    preferences: dict,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db_session),
):
    """更新用户偏好设置"""
    if not current_user.preferences:
        current_user.preferences = {}
    current_user.preferences.update(preferences)
    await db.commit()

    return {
        "language": current_user.preferences.get("language", "zh-CN"),
        "timezone": current_user.preferences.get("timezone", "Asia/Shanghai"),
        "theme": current_user.preferences.get("theme", "light"),
        "message": "偏好设置已更新",
    }


# ── 数据导出 ──

@router.get("/export", summary="导出数据")
async def export_user_data(
    format: str = Query("json", pattern="^(json|csv|excel)$", description="导出格式：json/csv/excel"),
    scope: str = Query("profile,formulas,experiments,preferences", description="逗号分隔的数据范围"),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db_session),
):
    """按指定范围与格式导出用户数据。

    scope 支持：profile / formulas / experiments / preferences（逗号分隔）。
    format：json 返回 ZIP（内含 JSON）；csv 返回 CSV 文本；excel 返回 .xlsx 工作簿。
    """
    import io as _io
    import zipfile
    from datetime import datetime, timezone

    scopes = {s.strip() for s in scope.split(",") if s.strip()}
    data: dict = {
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "user_id": current_user.id,
        "username": current_user.username,
    }

    formulas = []
    experiments = []

    # 个人资料
    if "profile" in scopes:
        data["profile"] = {
            "username": current_user.username,
            "email": current_user.email,
            "full_name": current_user.full_name,
            "role": current_user.role,
        }

    # 配方
    if "formulas" in scopes:
        from ..models.formula import Formula
        result = await db.execute(select(Formula).where(Formula.creator_id == current_user.id))
        formulas = [
            {
                "id": f.id,
                "name": f.name,
                "description": f.description,
                "status": f.status.value if hasattr(f.status, "value") else f.status,
                "created_at": f.created_at.isoformat() if f.created_at else None,
                "updated_at": f.updated_at.isoformat() if f.updated_at else None,
            }
            for f in result.scalars().all()
        ]
        data["formulas"] = formulas

    # 实验
    if "experiments" in scopes:
        from ..models.experiment import Experiment
        result = await db.execute(select(Experiment).where(Experiment.user_id == current_user.id))
        experiments = [
            {
                "id": e.id,
                "name": e.name,
                "status": e.status.value if hasattr(e.status, "value") else e.status,
                "created_at": e.created_at.isoformat() if e.created_at else None,
            }
            for e in result.scalars().all()
        ]
        data["experiments"] = experiments

    # 偏好设置
    if "preferences" in scopes:
        data["preferences"] = current_user.preferences or {}

    if format == "json":
        json_bytes = json.dumps(data, ensure_ascii=False, indent=2).encode("utf-8")
        zip_buffer = _io.BytesIO()
        with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
            zf.writestr(f"rmfood_export_{current_user.id}.json", json_bytes.decode("utf-8"))
        zip_buffer.seek(0)
        return StreamingResponse(
            zip_buffer,
            media_type="application/zip",
            headers={"Content-Disposition": f'attachment; filename="rmfood_data_export_{current_user.id}.zip"'},
        )

    if format == "csv":
        import csv as csv_module
        csv_buffer = _io.StringIO()
        writer = csv_module.writer(csv_buffer)
        writer.writerow(["类型", "ID", "名称", "状态", "创建时间"])
        for f in formulas:
            writer.writerow(["配方", f["id"], f["name"], f["status"], f["created_at"]])
        for e in experiments:
            writer.writerow(["实验", e["id"], e["name"], e["status"], e["created_at"]])
        return Response(
            content=csv_buffer.getvalue(),
            media_type="text/csv; charset=utf-8",
            headers={"Content-Disposition": f'attachment; filename="rmfood_export_{current_user.id}.csv"'},
        )

    # excel
    from openpyxl import Workbook
    wb = Workbook()
    ws1 = wb.active
    ws1.title = "配方"
    ws1.append(["ID", "名称", "描述", "状态", "创建时间", "更新时间"])
    for f in formulas:
        ws1.append([f["id"], f["name"], f["description"], f["status"], f["created_at"], f["updated_at"]])
    ws2 = wb.create_sheet("实验")
    ws2.append(["ID", "名称", "状态", "创建时间"])
    for e in experiments:
        ws2.append([e["id"], e["name"], e["status"], e["created_at"]])
    xlsx_buffer = _io.BytesIO()
    wb.save(xlsx_buffer)
    xlsx_buffer.seek(0)
    return StreamingResponse(
        xlsx_buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="rmfood_export_{current_user.id}.xlsx"'},
    )


# ── 数据导入 ──

@router.post("/import", summary="导入数据")
async def import_user_data(
    file: UploadFile = File(..., description="JSON 格式导入文件"),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db_session),
):
    """导入之前导出的 JSON 数据"""
    content = await file.read()
    try:
        data = json.loads(content.decode("utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError) as e:
        raise HTTPException(status_code=400, detail=f"文件格式错误: {e}")

    imported = {"formulas": 0, "experiments": 0, "chat_sessions": 0}

    # 导入配方（跳过已存在的）
    if "formulas" in data:
        from ..models.formula import Formula
        for fd in data["formulas"]:
            existing = await db.execute(
                select(func.count(Formula.id)).where(Formula.name == fd.get("name", ""))
            )
            if existing.scalar() == 0:
                formula = Formula(
                    name=fd.get("name", "Imported Formula"),
                    description=fd.get("description", ""),
                    creator_id=current_user.id,
                )
                db.add(formula)
                imported["formulas"] += 1

    if imported["formulas"] > 0 or imported["experiments"] > 0 or imported["chat_sessions"] > 0:
        await db.commit()

    return {
        "success": True,
        "imported": imported,
        "message": f"导入完成：配方 {imported['formulas']} 条",
    }


# ── 登录历史 ──

@router.get("/login-history", summary="登录历史")
async def get_login_history(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db_session),
    limit: int = Query(20, ge=1, le=100),
):
    """获取当前用户的登录历史（从审计日志中提取）"""
    try:
        from ..models.system import AuditLog
        result = await db.execute(
            select(AuditLog)
            .where(AuditLog.user_id == current_user.id, AuditLog.action == "login")
            .order_by(desc(AuditLog.created_at))
            .limit(limit)
        )
        logs = result.scalars().all()
        return {
            "history": [
                {
                    "ip_address": log.ip_address,
                    "created_at": log.created_at.isoformat() if log.created_at else None,
                    "details": log.details or {},
                }
                for log in logs
            ],
            "total": len(logs),
        }
    except Exception as e:
        # 审计日志表可能不存在
        return {"history": [], "total": 0}


# ── 数据清除 ──

@router.post("/clear-data", summary="清除用户数据")
async def clear_user_data(
    confirm: str = Query(..., description="确认文本，必须为 'CLEAR ALL'"),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db_session),
):
    """清除当前用户的所有数据（软删除）"""
    if confirm != "CLEAR ALL":
        raise HTTPException(status_code=400, detail="请输入 CLEAR ALL 确认删除")

    # 软删除配方
    from ..models.formula import Formula
    await db.execute(
        Formula.__table__.update()
        .where(Formula.creator_id == current_user.id)
        .values(is_deleted=True)
    )

    # 软删除实验
    from ..models.experiment import Experiment
    await db.execute(
        Experiment.__table__.update()
        .where(Experiment.user_id == current_user.id)
        .values(is_deleted=True)
    )

    await db.commit()
    return {"message": "用户数据已全部清除"}
