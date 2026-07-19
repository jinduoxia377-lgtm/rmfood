"""RMFOOD 枚举定义模块"""

import enum


class UserRole(str, enum.Enum):
    GUEST = "guest"
    RESEARCHER = "researcher"
    FORMULATOR = "formulator"
    REVIEWER = "reviewer"
    ADMIN = "admin"


class FormulaStatus(str, enum.Enum):
    DRAFT = "draft"
    PENDING_REVIEW = "pending_review"
    APPROVED = "approved"
    PUBLISHED = "published"
    REJECTED = "rejected"
    ARCHIVED = "archived"


class ExperimentStatus(str, enum.Enum):
    PLANNED = "planned"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class WorkflowStatus(str, enum.Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    FAILED = "failed"


class TaskStatus(str, enum.Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"
    SKIPPED = "skipped"


class NotificationType(str, enum.Enum):
    SYSTEM = "system"
    FORMULA_REVIEW = "formula_review"
    EXPERIMENT_COMPLETE = "experiment_complete"
    AI_TASK_DONE = "ai_task_done"
    DATA_SYNC = "data_sync"


class NotificationStatus(str, enum.Enum):
    UNREAD = "unread"
    READ = "read"
    ARCHIVED = "archived"


class DeviceType(str, enum.Enum):
    WEB = "web"
    IOS = "ios"
    ANDROID = "android"
    DESKTOP = "desktop"


class TeamRole(str, enum.Enum):
    OWNER = "owner"
    ADMIN = "admin"
    MEMBER = "member"
    GUEST = "guest"


class SyncAction(str, enum.Enum):
    CREATE = "create"
    UPDATE = "update"
    DELETE = "delete"
    CONFLICT = "conflict"
    MERGE = "merge"


class SyncStatus(str, enum.Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"
    CONFLICT = "conflict"


class SuggestionType(str, enum.Enum):
    INGREDIENT_REPLACEMENT = "ingredient_replacement"
    PROCESS_IMPROVEMENT = "process_improvement"
    COST_OPTIMIZATION = "cost_optimization"
    NUTRITION_ENHANCEMENT = "nutrition_enhancement"
    TASTE_ADJUSTMENT = "taste_adjustment"


# ──────────── 数据分类（ADR-003） ────────────


class DataClassification(str, enum.Enum):
    """
    四层数据分类模型

    L1 PUBLIC   — 公开数据，基本安全防护
    L2 INTERNAL — 内部数据，访问控制
    L3 SECRET   — 机密数据，加密 + 角色隔离
    L4 TOP_SECRET — 绝密数据，全量审计 + 动态水印
    """
    PUBLIC = "public"
    INTERNAL = "internal"
    SECRET = "secret"
    TOP_SECRET = "top_secret"
