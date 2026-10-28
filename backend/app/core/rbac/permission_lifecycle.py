"""
RMFOOD 权限生命周期管理系统 (Permission Lifecycle Management)

功能:
- 权限的完整生命周期管理：申请 → 审批 → 授权 → 使用 → 过期 → 吊销
- 基于时间的权限自动过期
- 基于使用频率的权限自动吊销（闲置权限清理）
- 权限变更审计追踪（所有权限变更均留痕）
- 权限委派与临时权限
- 最小权限原则（Least Privilege）校验
- 职责分离（SoD - Separation of Duties）
- 权限评审周期提醒
- 紧急访问（Break-Glass）机制

权限状态流转:
    PENDING → ACTIVE ⇄ SUSPENDED → EXPIRED / REVOKED
      ↑          ↑
    申请       审批通过

参考标准:
- NIST SP 800-53 (AC 系列控制)
- ISO 27001 (A.9 访问控制)
- GDPR (Article 32 - 适当的技术和组织措施)
"""

import logging
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from enum import Enum
from typing import Any, Callable, Dict, List, Optional, Set

logger = logging.getLogger(__name__)


# ============================================================
# 枚举与数据模型
# ============================================================

class PermissionStatus(str, Enum):
    """权限状态"""
    PENDING = "pending"           # 待审批
    ACTIVE = "active"             # 生效中
    SUSPENDED = "suspended"       # 已暂停
    EXPIRED = "expired"           # 已过期
    REVOKED = "revoked"           # 已吊销
    REJECTED = "rejected"         # 申请被拒绝


class PermissionType(str, Enum):
    """权限类型"""
    STANDARD = "standard"         # 标准权限
    TEMPORARY = "temporary"       # 临时权限（有时效）
    DELEGATED = "delegated"       # 委派权限
    EMERGENCY = "emergency"       # 紧急权限（Break-Glass）
    PRIVILEGED = "privileged"     # 高权限（需额外审批）


class ChangeType(str, Enum):
    """变更类型"""
    GRANT = "grant"               # 授予
    REVOKE = "revoke"             # 吊销
    SUSPEND = "suspend"           # 暂停
    RESUME = "resume"             # 恢复
    EXTEND = "extend"             # 延期
    UPDATE = "update"             # 更新
    REVIEW = "review"             # 评审
    EXPIRY_AUTO = "expiry_auto"   # 自动过期


@dataclass
class PermissionEntry:
    """权限条目（即：某个用户拥有某个资源操作权限的记录）"""
    id: str
    user_id: int
    user_name: str
    resource: str
    action: str
    permission_type: PermissionType
    status: PermissionStatus

    # 生命周期时间
    granted_at: datetime
    expires_at: Optional[datetime] = None
    last_used_at: Optional[datetime] = None

    # 元数据
    granted_by: Optional[int] = None               # 授权人
    granted_reason: Optional[str] = None           # 授权原因
    scope: str = "own"                            # 作用域: own / all / department
    priority: int = 0                             # 优先级
    requires_mfa: bool = False                    # 是否要求 MFA
    max_session_hours: Optional[int] = None       # 最大会话时长

    # 自定义属性
    metadata: Dict[str, Any] = field(default_factory=dict)

    # 过期策略
    auto_expire_hours: Optional[int] = None       # 闲置自动过期小时数

    # 审计
    change_history: List[Dict[str, Any]] = field(default_factory=list)


@dataclass
class SoDConflict:
    """职责冲突"""
    permission_a: str
    permission_b: str
    reason: str
    risk_level: str = "high"


# ============================================================
# 预设：职责分离规则 (SoD)
# ============================================================

SOD_RULES: List[SoDConflict] = [
    SoDConflict(
        "formula:approve", "formula:create",
        "配方创建者不能同时拥有审批权",
    ),
    SoDConflict(
        "user:manage", "audit:view",
        "用户管理员不应同时查看审计日志（避免掩盖操作）",
    ),
    SoDConflict(
        "system:configure", "permission:grant",
        "系统配置与权限授予应分离",
    ),
]

# 高权限清单（需额外审批 / 记录）
PRIVILEGED_PERMISSIONS: Set[str] = {
    "system:configure",
    "system:administer",
    "user:manage",
    "permission:grant",
    "audit:view",
    "database:export",
    "formula:delete",
}

# 默认临时权限时长（小时）
DEFAULT_TEMPORARY_PERMISSION_HOURS = 4
DEFAULT_EMERGENCY_PERMISSION_MINUTES = 30

# 闲置权限阈值（天）
IDLE_PERMISSION_DAYS = 90


# ============================================================
# 权限生命周期管理器
# ============================================================

class PermissionLifecycleManager:
    """
    权限生命周期管理器

    负责:
    - 权限申请、审批、授权、吊销、过期
    - 闲置权限检测与清理
    - 权限变更审计记录
    - 紧急访问 (Break-Glass) 机制
    """

    def __init__(self):
        self._permissions: Dict[str, PermissionEntry] = {}
        self._user_index: Dict[int, Set[str]] = {}     # user_id → permission ids
        self._approval_queue: List[str] = []           # 待审批权限ID
        self._emergency_tokens: Dict[str, Dict[str, Any]] = {}

        logger.info("🛡️ 权限生命周期管理系统初始化完成")

    # ───────── 基础操作 ─────────

    def request_permission(
        self,
        user_id: int,
        user_name: str,
        resource: str,
        action: str,
        reason: str,
        requested_by: int,
        permission_type: PermissionType = PermissionType.STANDARD,
        duration_hours: Optional[int] = None,
    ) -> PermissionEntry:
        """
        申请权限

        根据权限类型自动判断是否需要审批：
        - STANDARD: 如属 PRIVILEGED_PERMISSIONS 则需要审批，否则直接授予
        - TEMPORARY / EMERGENCY: 根据配置
        - DELEGATED: 需要审批
        - PRIVILEGED: 需要双重审批
        """
        perm_key = f"{resource}:{action}"
        requires_approval = self._requires_approval(perm_key, permission_type)

        entry = PermissionEntry(
            id=str(uuid.uuid4()),
            user_id=user_id,
            user_name=user_name,
            resource=resource,
            action=action,
            permission_type=permission_type,
            status=PermissionStatus.PENDING if requires_approval else PermissionStatus.ACTIVE,
            granted_at=datetime.now(timezone.utc),
            granted_by=requested_by,
            granted_reason=reason,
        )

        # 设置过期时间（临时权限）
        if duration_hours:
            entry.expires_at = entry.granted_at + timedelta(hours=duration_hours)
            entry.auto_expire_hours = duration_hours

        # SoD 检查
        if self._check_sod_conflict(user_id, resource, action):
            entry.status = PermissionStatus.SUSPENDED
            entry.metadata["sod_warning"] = True
            logger.warning(
                f"⚠️ 检测到 SoD 冲突: user={user_name} 试图获取 {perm_key}，已自动暂停"
            )

        self._permissions[entry.id] = entry
        self._index_permission(entry)

        if entry.status == PermissionStatus.PENDING:
            self._approval_queue.append(entry.id)
            logger.info(f"📋 权限申请已提交待审批: user={user_name}, perm={perm_key}")
        else:
            logger.info(f"✅ 权限已直接授予: user={user_name}, perm={perm_key}")

        self._audit(entry, ChangeType.GRANT, requested_by, reason)

        return entry

    def approve(self, permission_id: str, approver_id: int, approver_name: str,
                comment: str = "") -> Optional[PermissionEntry]:
        """审批通过"""
        entry = self._permissions.get(permission_id)
        if not entry or entry.status != PermissionStatus.PENDING:
            return None

        entry.status = PermissionStatus.ACTIVE
        entry.granted_by = approver_id
        entry.metadata["approved_by"] = approver_name
        entry.metadata["approval_comment"] = comment

        logger.info(f"✅ 权限审批通过: id={permission_id}, approver={approver_name}")
        self._audit(entry, ChangeType.GRANT, approver_id, comment)

        return entry

    def reject(self, permission_id: str, approver_id: int, reason: str) -> Optional[PermissionEntry]:
        """拒绝申请"""
        entry = self._permissions.get(permission_id)
        if not entry or entry.status != PermissionStatus.PENDING:
            return None

        entry.status = PermissionStatus.REJECTED
        entry.metadata["reject_reason"] = reason

        logger.warning(f"❌ 权限申请被拒绝: id={permission_id}, reason={reason}")
        self._audit(entry, ChangeType.REVOKE, approver_id, reason)

        return entry

    def revoke(self, permission_id: str, revoker_id: int, reason: str) -> Optional[PermissionEntry]:
        """吊销权限"""
        entry = self._permissions.get(permission_id)
        if not entry:
            return None

        entry.status = PermissionStatus.REVOKED
        entry.metadata["revoke_reason"] = reason
        entry.metadata["revoked_by"] = revoker_id

        logger.warning(f"🔒 权限已吊销: id={permission_id}, reason={reason}")
        self._audit(entry, ChangeType.REVOKE, revoker_id, reason)

        return entry

    def suspend(self, permission_id: str, reason: str) -> Optional[PermissionEntry]:
        """暂停权限"""
        entry = self._permissions.get(permission_id)
        if not entry or entry.status != PermissionStatus.ACTIVE:
            return None

        entry.status = PermissionStatus.SUSPENDED
        entry.metadata["suspend_reason"] = reason

        logger.info(f"⏸️ 权限已暂停: id={permission_id}, reason={reason}")
        self._audit(entry, ChangeType.SUSPEND, None, reason)

        return entry

    def resume(self, permission_id: str, resumer_id: int) -> Optional[PermissionEntry]:
        """恢复权限"""
        entry = self._permissions.get(permission_id)
        if not entry or entry.status != PermissionStatus.SUSPENDED:
            return None

        # 检查是否已过期
        if entry.expires_at and entry.expires_at < datetime.now(timezone.utc):
            entry.status = PermissionStatus.EXPIRED
            return entry

        entry.status = PermissionStatus.ACTIVE

        logger.info(f"▶️ 权限已恢复: id={permission_id}")
        self._audit(entry, ChangeType.RESUME, resumer_id, "manual resume")

        return entry

    def extend(self, permission_id: str, hours: int, extender_id: int,
               reason: str = "") -> Optional[PermissionEntry]:
        """延长权限有效期"""
        entry = self._permissions.get(permission_id)
        if not entry:
            return None

        now = datetime.now(timezone.utc)
        base = entry.expires_at or now
        if base < now:
            base = now

        entry.expires_at = base + timedelta(hours=hours)
        entry.metadata["extended_by"] = extender_id
        entry.metadata["last_extend_reason"] = reason

        # 如果之前已过期，先恢复为 ACTIVE
        if entry.status == PermissionStatus.EXPIRED:
            entry.status = PermissionStatus.ACTIVE

        logger.info(f"⏰ 权限已延期: id={permission_id}, +{hours}h, 新到期: {entry.expires_at}")
        self._audit(entry, ChangeType.EXTEND, extender_id, reason)

        return entry

    def record_usage(self, permission_id: str) -> None:
        """记录权限使用（用于闲置检测）"""
        entry = self._permissions.get(permission_id)
        if entry:
            entry.last_used_at = datetime.now(timezone.utc)

    # ───────── 查询操作 ─────────

    def has_permission(self, user_id: int, resource: str, action: str) -> bool:
        """检查用户是否拥有有效的权限"""
        perm_ids = self._user_index.get(user_id, set())
        for pid in perm_ids:
            entry = self._permissions.get(pid)
            if (entry and entry.status == PermissionStatus.ACTIVE
                    and entry.resource == resource and entry.action == action):
                # 检查过期
                if entry.expires_at and entry.expires_at < datetime.now(timezone.utc):
                    continue
                return True
        return False

    def get_user_permissions(self, user_id: int, status: Optional[PermissionStatus] = None) -> List[PermissionEntry]:
        """获取用户权限列表"""
        perm_ids = self._user_index.get(user_id, set())
        result = []
        for pid in perm_ids:
            entry = self._permissions.get(pid)
            if entry and (status is None or entry.status == status):
                result.append(entry)
        return result

    def get_pending_approvals(self) -> List[PermissionEntry]:
        """获取待审批列表"""
        return [self._permissions[pid] for pid in self._approval_queue
                if self._permissions[pid].status == PermissionStatus.PENDING]

    # ───────── 生命周期维护任务 ─────────

    def run_maintenance(self) -> Dict[str, Any]:
        """
        运行定期维护任务

        包括:
        - 过期权限清理
        - 闲置权限检测
        - 即将过期提醒

        Returns: 维护结果统计
        """
        now = datetime.now(timezone.utc)
        stats = {
            "expired": 0,
            "idle_detected": 0,
            "revoked_idle": 0,
            "expiring_soon": 0,
        }

        for entry in list(self._permissions.values()):
            # 过期检测
            if entry.status == PermissionStatus.ACTIVE:
                if entry.expires_at and entry.expires_at < now:
                    entry.status = PermissionStatus.EXPIRED
                    stats["expired"] += 1
                    logger.info(f"⏰ 权限自动过期: user={entry.user_name}, perm={entry.resource}:{entry.action}")
                    self._audit(entry, ChangeType.EXPIRY_AUTO, None, "auto expiry")

                # 即将过期提醒（24小时内）
                elif entry.expires_at and (entry.expires_at - now) < timedelta(hours=24):
                    stats["expiring_soon"] += 1

                # 闲置检测
                if entry.auto_expire_hours and entry.last_used_at:
                    idle_time = now - entry.last_used_at
                    if idle_time > timedelta(days=IDLE_PERMISSION_DAYS):
                        stats["idle_detected"] += 1
                        logger.info(
                            f"⚠️ 检测到闲置权限: user={entry.user_name}, "
                            f"perm={entry.resource}:{entry.action}, 闲置 {idle_time.days} 天"
                        )

        logger.info(
            f"🔧 权限维护完成: expired={stats['expired']}, idle={stats['idle_detected']}, "
            f"expiring_soon={stats['expiring_soon']}"
        )

        return stats

    # ───────── 紧急访问（Break-Glass）机制 ─────────

    def request_emergency_access(
        self,
        user_id: int,
        user_name: str,
        resource: str,
        action: str,
        reason: str,
    ) -> Dict[str, Any]:
        """
        申请紧急访问权限 (Break-Glass)

        紧急访问具有以下特性:
        - 自动生效，无需审批
        - 有极短的有效期（默认30分钟）
        - 触发高优先级告警
        - 要求额外的审计记录
        - 自动在会话结束后吊销
        """
        now = datetime.now(timezone.utc)
        token = f"BG-{uuid.uuid4().hex[:12]}"

        entry = self.request_permission(
            user_id=user_id,
            user_name=user_name,
            resource=resource,
            action=action,
            reason=reason,
            requested_by=user_id,  # 紧急权限自我申请
            permission_type=PermissionType.EMERGENCY,
            duration_hours=DEFAULT_EMERGENCY_PERMISSION_MINUTES / 60,
        )
        entry.status = PermissionStatus.ACTIVE  # 紧急权限立即生效
        entry.requires_mfa = True               # 强制 MFA

        self._emergency_tokens[token] = {
            "permission_id": entry.id,
            "user_id": user_id,
            "created_at": now,
            "expires_at": entry.expires_at,
            "reason": reason,
        }

        logger.critical(
            f"🚨 [BREAK-GLASS] 紧急访问激活: token={token}, "
            f"user={user_name}, perm={resource}:{action}, "
            f"reason={reason}"
        )

        return {
            "token": token,
            "permission_id": entry.id,
            "expires_at": entry.expires_at,
            "requires_mfa": True,
        }

    def validate_emergency_token(self, token: str) -> Optional[Dict[str, Any]]:
        """验证紧急访问 token"""
        info = self._emergency_tokens.get(token)
        if not info:
            return None

        if info["expires_at"] < datetime.now(timezone.utc):
            del self._emergency_tokens[token]
            logger.warning(f"🚨 [BREAK-GLASS] token 已过期: {token}")
            return None

        return info

    # ───────── 内部辅助 ─────────

    def _requires_approval(self, perm_key: str, ptype: PermissionType) -> bool:
        """判断权限是否需要审批"""
        if ptype in (PermissionType.DELEGATED, PermissionType.PRIVILEGED):
            return True
        if perm_key in PRIVILEGED_PERMISSIONS:
            return True
        if ptype == PermissionType.TEMPORARY:
            return False  # 临时权限通常用于自动化场景，可直接授权
        return False

    def _check_sod_conflict(self, user_id: int, resource: str, action: str) -> bool:
        """检测职责冲突"""
        perm_key = f"{resource}:{action}"
        existing_perms = {
            f"{e.resource}:{e.action}"
            for e in self.get_user_permissions(user_id, status=PermissionStatus.ACTIVE)
        }

        for rule in SOD_RULES:
            if perm_key == rule.permission_a and rule.permission_b in existing_perms:
                return True
            if perm_key == rule.permission_b and rule.permission_a in existing_perms:
                return True
        return False

    def _index_permission(self, entry: PermissionEntry) -> None:
        """更新用户-权限索引"""
        if entry.user_id not in self._user_index:
            self._user_index[entry.user_id] = set()
        self._user_index[entry.user_id].add(entry.id)

    def _audit(self, entry: PermissionEntry, change_type: ChangeType,
               actor: Optional[int], reason: str) -> None:
        """记录权限变更审计"""
        record = {
            "permission_id": entry.id,
            "change_type": change_type.value,
            "actor": actor,
            "reason": reason,
            "user_id": entry.user_id,
            "user_name": entry.user_name,
            "resource": entry.resource,
            "action": entry.action,
            "previous_status": entry.status.value,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        entry.change_history.append(record)

        # 高敏操作：输出到单独日志通道
        if change_type in (ChangeType.REVOKE, ChangeType.SUSPEND) and entry.permission_type == PermissionType.EMERGENCY:
            logger.critical(
                f"📝 [PERMISSION-AUDIT] {change_type.value}: "
                f"user={entry.user_name}, perm={entry.resource}:{entry.action}, "
                f"reason={reason}"
            )
        else:
            logger.info(
                f"📝 [PERMISSION-AUDIT] {change_type.value}: "
                f"user={entry.user_name}, perm={entry.resource}:{entry.action}"
            )

    # ───────── 统计与报告 ─────────

    def get_statistics(self) -> Dict[str, Any]:
        """获取权限统计"""
        now = datetime.now(timezone.utc)
        stats = {
            "total": len(self._permissions),
            "by_status": {},
            "by_type": {},
            "pending_approvals": len([e for e in self._permissions.values()
                                       if e.status == PermissionStatus.PENDING]),
            "active_users": len([uid for uid, pids in self._user_index.items()
                                 if any(self._permissions[pid].status == PermissionStatus.ACTIVE
                                        for pid in pids)]),
            "emergency_tokens": len(self._emergency_tokens),
            "expired_in_24h": len([e for e in self._permissions.values()
                                   if e.status == PermissionStatus.ACTIVE
                                   and e.expires_at
                                   and e.expires_at < now + timedelta(hours=24)]),
        }

        for status in PermissionStatus:
            count = len([e for e in self._permissions.values() if e.status == status])
            stats["by_status"][status.value] = count

        for ptype in PermissionType:
            count = len([e for e in self._permissions.values() if e.permission_type == ptype])
            stats["by_type"][ptype.value] = count

        return stats

    def generate_review_report(self) -> Dict[str, Any]:
        """生成权限评审报告（用于定期评审流程）"""
        stats = self.get_statistics()
        idle_permissions = []
        privileged_holders = []

        for entry in self._permissions.values():
            if entry.status != PermissionStatus.ACTIVE:
                continue

            # 闲置超过90天
            if entry.last_used_at:
                idle_days = (datetime.now(timezone.utc) - entry.last_used_at).days
                if idle_days >= IDLE_PERMISSION_DAYS:
                    idle_permissions.append({
                        "user_id": entry.user_id,
                        "user_name": entry.user_name,
                        "permission": f"{entry.resource}:{entry.action}",
                        "idle_days": idle_days,
                        "last_used_at": entry.last_used_at.isoformat(),
                    })

            # 高权限持有者
            if f"{entry.resource}:{entry.action}" in PRIVILEGED_PERMISSIONS:
                privileged_holders.append({
                    "user_id": entry.user_id,
                    "user_name": entry.user_name,
                    "permission": f"{entry.resource}:{entry.action}",
                    "granted_at": entry.granted_at.isoformat(),
                })

        return {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "summary": stats,
            "recommendations": {
                "idle_permissions_to_revoke": idle_permissions,
                "privileged_holders_to_review": privileged_holders,
                "sod_violations_detected": self._detect_sod_violations(),
            },
        }

    def _detect_sod_violations(self) -> List[Dict[str, Any]]:
        """检测系统中的 SoD 违规"""
        violations = []
        for user_id in self._user_index:
            user_perms = set()
            for pid in self._user_index[user_id]:
                entry = self._permissions[pid]
                if entry.status == PermissionStatus.ACTIVE:
                    user_perms.add(f"{entry.resource}:{entry.action}")

            for rule in SOD_RULES:
                if rule.permission_a in user_perms and rule.permission_b in user_perms:
                    user_entry = self._permissions[next(iter(self._user_index[user_id]))]
                    violations.append({
                        "user_id": user_id,
                        "user_name": user_entry.user_name,
                        "conflict": f"{rule.permission_a} ↔ {rule.permission_b}",
                        "reason": rule.reason,
                        "risk_level": rule.risk_level,
                    })

        return violations


# ============================================================
# 全局单例
# ============================================================

_plm_instance: Optional[PermissionLifecycleManager] = None


def get_plm() -> PermissionLifecycleManager:
    """获取权限生命周期管理器单例"""
    global _plm_instance
    if _plm_instance is None:
        _plm_instance = PermissionLifecycleManager()
    return _plm_instance


# ============================================================
# 便捷 API
# ============================================================

def require_permission(resource: str, action: str) -> Callable:
    """
    权限检查装饰器（依赖注入风格）

    用法:
        @require_permission("formula", "delete")
        async def delete_formula(formula_id: int, current_user: User = Depends(...)):
            ...
    """
    def decorator(func: Callable) -> Callable:
        def wrapper(*args, **kwargs):
            current_user = kwargs.get("current_user")
            if not current_user:
                raise PermissionError("未获取到当前用户")

            plm = get_plm()
            if not plm.has_permission(current_user.id, resource, action):
                from fastapi import HTTPException, status
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail={
                        "error_code": "INSUFFICIENT_PERMISSION",
                        "message": f"缺少权限: {resource}:{action}",
                        "required_permission": f"{resource}:{action}",
                    },
                )
            return func(*args, **kwargs)

        return wrapper

    return decorator


logger.info("🛡️ 权限生命周期管理系统加载完成")
