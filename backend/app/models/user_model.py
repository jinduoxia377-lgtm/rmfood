"""RMFOOD 用户模型"""
import logging
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import Integer, String, Text, Boolean, DateTime, JSON, Enum, BigInteger
from sqlalchemy.orm import Mapped, mapped_column, relationship, validates
from .base import Base
from .enums import UserRole
from app.models.utils import now_utc_mapped

logger = logging.getLogger(__name__)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    email: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(Text, nullable=False)
    full_name: Mapped[str | None] = mapped_column(String(100))
    role: Mapped[UserRole] = mapped_column(
        Enum(UserRole, native_enum=False),
        default=UserRole.RESEARCHER,
        nullable=False,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    department: Mapped[str | None] = mapped_column(String(100))
    phone: Mapped[str | None] = mapped_column(String(20))
    avatar_url: Mapped[str | None] = mapped_column(String(500))

    # ── 个人资料扩展字段（设置页「账户」模块）──────────────────
    position: Mapped[str | None] = mapped_column(String(100))
    bio: Mapped[str | None] = mapped_column(Text)
    website: Mapped[str | None] = mapped_column(String(255))
    github: Mapped[str | None] = mapped_column(String(100))
    linkedin: Mapped[str | None] = mapped_column(String(255))

    preferences: Mapped[dict | None] = mapped_column(JSON, default=dict)

    # ── 多租户隔离 ──────────────────────────────────────
    organization_id: Mapped[int | None] = mapped_column(
        BigInteger, nullable=True, index=True, comment="默认所属组织 ID"
    )
    last_login: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)  # 最后登录时间
    login_attempts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)  # 登录失败次数
    locked_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)  # 锁定截止时间

    # ── 两步验证 (2FA/TOTP) ──
    two_factor_secret: Mapped[str | None] = mapped_column(String(64), nullable=True)  # TOTP 密钥（Base32）
    two_factor_enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)  # 是否已启用 2FA

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc_mapped)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc_mapped, onupdate=now_utc_mapped)

    created_formulas: Mapped[list["Formula"]] = relationship(
        "Formula", back_populates="creator", foreign_keys="[Formula.creator_id]"
    )
    reviewed_formulas: Mapped[list["Formula"]] = relationship(
        "Formula", back_populates="reviewer", foreign_keys="[Formula.reviewer_id]"
    )
    experiments: Mapped[list["Experiment"]] = relationship("Experiment", back_populates="researcher")
    notifications: Mapped[list["Notification"]] = relationship("Notification", back_populates="user")

    devices: Mapped[list["UserDevice"]] = relationship(
        "UserDevice", back_populates="user", cascade="all, delete-orphan"
    )
    owned_teams: Mapped[list["Team"]] = relationship("Team", back_populates="owner", foreign_keys="[Team.owner_id]")
    team_memberships: Mapped[list["TeamMember"]] = relationship(
        "TeamMember", back_populates="user", foreign_keys="TeamMember.user_id"
    )
    sync_logs: Mapped[list["SyncLog"]] = relationship(
        "SyncLog", back_populates="user", cascade="all, delete-orphan"
    )
    
    # 肽相关关系
    peptide_designs: Mapped[list["PeptideDesign"]] = relationship(
        "PeptideDesign", back_populates="user", cascade="all, delete-orphan"
    )
    peptide_analyses: Mapped[list["PeptideAnalysis"]] = relationship(
        "PeptideAnalysis",
        back_populates="user",
        cascade="all, delete-orphan",
        foreign_keys="PeptideAnalysis.user_id"
    )
    # peptide_structure_analyses 关系已移除，避免循环导入问题
    ga_runs: Mapped[list["GARunRecord"]] = relationship(
        "GARunRecord", back_populates="user", cascade="all, delete-orphan"
    )

    # 配方案例关系
    created_cases: Mapped[list["FormulaCase"]] = relationship("FormulaCase", back_populates="creator", foreign_keys="[FormulaCase.created_by]")
    liked_cases: Mapped[list["CaseLike"]] = relationship("CaseLike", back_populates="user")
    commented_cases: Mapped[list["CaseComment"]] = relationship("CaseComment", back_populates="user")

    @property
    def permission_level(self) -> int:
        level_map = {
            UserRole.GUEST: 0,
            UserRole.RESEARCHER: 1,
            UserRole.FORMULATOR: 2,
            UserRole.REVIEWER: 3,
            UserRole.ADMIN: 4,
        }
        return level_map.get(self.role, 0)

    # ── 防御层：users.role 列在库里是 varchar（实际存大写的枚举名，如
    #    'ADMIN'/'GUEST'/'RESEARCHER'）。模型使用 Enum(UserRole, native_enum=False)
    #    映射为 VARCHAR，并按枚举「名称」（大写）持久化/读取，与现有数据一致，
    #    同时避免查询时引用不存在的 PG 原生枚举类型 userrole。
    #    这里在赋值阶段把字符串统一归一化为 UserRole 枚举成员；对已经是
    #    UserRole 成员的值保持原样（幂等、无副作用）。
    @validates("role")
    def _normalize_role_name(self, key, value):
        if isinstance(value, UserRole):
            return value
        if isinstance(value, str):
            # 兼容小写枚举值（'admin'）与大写枚举名（'ADMIN'）
            try:
                return UserRole(value.lower())
            except ValueError:
                pass
            try:
                return UserRole[value.upper()]
            except (KeyError, ValueError):
                pass
            # 未知角色（脏数据）：不直接抛错，回落到 RESEARCHER，避免
            # 单行脏数据把整张用户列表打挂；并打印告警便于后续修数。
            logger.warning(
                "User.role 归一化失败: 未知值 %r（id=%s），回落 RESEARCHER",
                value, getattr(self, "id", None),
            )
            return UserRole.RESEARCHER
        return value

    # ── 多设备登录支持 ──

    async def check_device_limit(self, db, max_devices: int = 5) -> tuple[bool, Optional["UserDevice"]]:
        """
        检查设备数量是否超过限制

        Args:
            db: 数据库会话
            max_devices: 最大允许设备数量（默认5）

        Returns:
            tuple[bool, Optional[UserDevice]]:
                - (True, None): 未超过限制
                - (False, oldest_device): 超过限制，返回最久未使用的设备（将被踢出）
        """
        from sqlalchemy import select, func
        from .user_device import UserDevice

        # 统计活跃设备数量
        result = await db.execute(
            select(func.count(UserDevice.id))
            .where(UserDevice.user_id == self.id, UserDevice.is_active == True)
        )
        active_count = result.scalar() or 0

        if active_count < max_devices:
            return True, None

        # 超过限制，查找最久未使用的设备
        result = await db.execute(
            select(UserDevice)
            .where(UserDevice.user_id == self.id, UserDevice.is_active == True)
            .order_by(UserDevice.last_sync_at.asc().nullsfirst())
            .limit(1)
        )
        oldest_device = result.scalar_one_or_none()

        return False, oldest_device

    async def register_device(
        self,
        db,
        device_id: str,
        device_type,
        device_name: str,
        max_devices: int = 5,
    ) -> dict:
        """
        注册/更新设备信息

        如果设备数量超过限制，自动踢出最久未使用的设备

        Args:
            db: 数据库会话
            device_id: 设备唯一标识符
            device_type: 设备类型（枚举值）
            device_name: 设备名称（如 "Chrome on Windows"）
            max_devices: 最大允许设备数

        Returns:
            dict: 操作结果信息
        """
        from datetime import datetime, timezone
        from sqlalchemy import select
        from .user_device import UserDevice

        current_time = datetime.now(timezone.utc)

        # 检查设备是否已注册
        result = await db.execute(
            select(UserDevice).where(
                UserDevice.user_id == self.id,
                UserDevice.device_id == device_id,
            )
        )
        existing_device = result.scalar_one_or_none()

        if existing_device:
            # 更新现有设备信息
            existing_device.device_name = device_name
            existing_device.device_type = device_type
            existing_device.last_sync_at = current_time
            existing_device.is_active = True

            return {
                "action": "updated",
                "device_id": device_id,
                "message": f"设备 '{device_name}' 已更新",
            }

        # 新设备，检查是否超过限制
        can_add, oldest_device = await self.check_device_limit(db, max_devices)

        if not can_add and oldest_device:
            # 踢出最久未使用的设备
            oldest_device.is_active = False
            logger.info(
                f"用户 {self.username} 设备超限，踢出设备: "
                f"{oldest_device.device_id} ({oldest_device.device_name})"
            )

        # 创建新设备记录
        new_device = UserDevice(
            device_id=device_id,
            user_id=self.id,
            device_type=device_type,
            device_name=device_name,
            last_sync_at=current_time,
            is_active=True,
        )
        db.add(new_device)

        action = "created" if can_add else "created_replaced"
        message = (
            f"设备 '{device_name}' 已注册"
            if can_add
            else f"设备 '{device_name}' 已注册（已替换最久未使用的设备）"
        )

        logger.info(f"用户 {self.username} {message}")

        return {
            "action": action,
            "device_id": device_id,
            "message": message,
        }

    async def remove_device(self, db, device_id: str) -> bool:
        """
        移除指定设备（用于用户主动登出设备）

        Args:
            db: 数据库会话
            device_id: 要移除的设备ID

        Returns:
            bool: 是否成功移除
        """
        from sqlalchemy import select
        from .user_device import UserDevice

        result = await db.execute(
            select(UserDevice).where(
                UserDevice.user_id == self.id,
                UserDevice.device_id == device_id,
            )
        )
        device = result.scalar_one_or_none()

        if device:
            device.is_active = False
            logger.info(f"用户 {self.username} 移除设备: {device_id} ({device.device_name})")
            return True

        return False

    async def get_active_devices(self, db):
        """
        获取所有活跃设备列表

        Args:
            db: 数据库会话

        Returns:
            List[UserDevice]: 活跃设备列表
        """
        from sqlalchemy import select
        from .user_device import UserDevice

        result = await db.execute(
            select(UserDevice)
            .where(UserDevice.user_id == self.id, UserDevice.is_active == True)
            .order_by(UserDevice.last_sync_at.desc())
        )
        return list(result.scalars().all())

    async def logout_all_devices(self, db) -> int:
        """
        登出所有设备（强制全部下线）

        Args:
            db: 数据库会话

        Returns:
            int: 被注销的设备数量
        """
        from sqlalchemy import select
        from .user_device import UserDevice

        result = await db.execute(
            select(UserDevice).where(
                UserDevice.user_id == self.id,
                UserDevice.is_active == True,
            )
        )
        devices = list(result.scalars().all())

        count = 0
        for device in devices:
            device.is_active = False
            count += 1

        if count > 0:
            logger.warning(f"用户 {self.username} 强制登出所有设备 (共{count}个)")

        return count


from .formula import Formula
from .experiment import Experiment
from .notification import Notification
from .formula_case import FormulaCase, CaseLike, CaseComment
