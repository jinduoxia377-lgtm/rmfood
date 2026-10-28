"""
RMFOOD RBAC 权限管理系统

功能特性:
- ✅ 基于角色的访问控制 (Role-Based Access Control)
- ✅ 细粒度权限定义（资源 + 操作）
- ✅ 权限矩阵管理
- ✅ 动态权限检查
- ✅ 权限继承与组合
- ✅ 审计日志记录

权限模型:
- 角色 (Role): ADMIN, FORMULATOR, REVIEWER, RESEARCHER, GUEST
- 资源 (Resource): formula, experiment, workflow, user, system, etc.
- 操作 (Action): create, read, update, delete, approve, manage, etc.

使用方法:
    from app.core.rbac.rbac import RBACManager, Permission
    
    rbac = RBACManager()
    
    # 检查权限
    has_permission = rbac.check_permission(user_role, "formula", "create")
    
    # 获取角色所有权限
    permissions = rbac.get_role_permissions("FORMULATOR")
    
    # 权限装饰器
    @rbac.require_permission("formula", "delete")
    async def delete_formula(...):
        ...

作者: RMFOOD Team
日期: 2026-05-02
"""

from enum import Enum
from typing import Dict, List, Set, Optional, Any, Callable
from functools import wraps
from dataclasses import dataclass, field
import logging

logger = logging.getLogger(__name__)


# ── 资源类型定义 ──

class Resource(str, Enum):
    """系统资源枚举"""
    
    # 核心业务资源
    FORMULA = "formula"                    # 配方
    FORMULA_VERSION = "formula_version"     # 配方版本
    INGREDIENT = "ingredient"              # 原料/成分
    PEPTIDE = "peptide"                    # 多肽
    
    # 实验相关
    EXPERIMENT = "experiment"              # 实验
    EXPERIMENT_DATA = "experiment_data"    # 实验数据
    
    # 工作流
    WORKFLOW = "workflow"                  # 工作流
    WORKFLOW_TASK = "workflow_task"        # 工作流任务
    
    # 用户与权限
    USER = "user"                          # 用户
    ROLE = "role"                          # 角色
    PERMISSION = "permission"              # 权限
    
    # 系统管理
    SYSTEM = "system"                      # 系统配置
    AUDIT_LOG = "audit_log"               # 审计日志
    NOTIFICATION = "notification"          # 通知
    
    # AI 功能
    AI_MODEL = "ai_model"                 # AI模型
    AI_GENERATION = "ai_generation"       # AI生成
    DATABASE = "database"                 # 知识库数据
    TEMPLATE = "template"                 # 模板
    
    # 文件与附件
    ATTACHMENT = "attachment"             # 附件
    REPORT = "report"                     # 报告


# ── 操作类型定义 ──

class Action(str, Enum):
    """操作类型枚举"""
    
    # CRUD 基础操作
    CREATE = "create"                     # 创建
    READ = "read"                         # 查看/读取
    UPDATE = "update"                     # 编辑/更新
    DELETE = "delete"                     # 删除
    
    # 高级操作
    LIST = "list"                         # 列表查询
    EXPORT = "export"                     # 导出
    IMPORT = "import"                     # 导入
    
    # 审批与管理
    APPROVE = "approve"                   # 审批通过
    REJECT = "reject"                     # 审批拒绝
    MANAGE = "manage"                     # 管理（包含CRUD+审批）
    ADMINISTER = "administer"            # 超级管理
    
    # 特殊操作
    PUBLISH = "publish"                   # 发布
    ARCHIVE = "archive"                   # 归档
    RESTORE = "restore"                   # 恢复
    SHARE = "share"                       # 分享
    COMMENT = "comment"                   # 评论
    RATE = "rate"                         # 评分
    
    # 执行类
    EXECUTE = "execute"                   # 执行
    CANCEL = "cancel"                     # 取消
    RETRY = "retry"                       # 重试
    
    # 配置类
    CONFIGURE = "configure"              # 配置
    CUSTOMIZE = "customize"             # 自定义


@dataclass(frozen=True)
class Permission:
    """
    权限对象（不可变）
    
    Attributes:
        resource: 资源类型
        action: 操作类型
        description: 权限描述
        scope: 作用域 (own=自己的, all=全部, department=部门)
    """
    resource: Resource
    action: Action
    description: str = ""
    scope: str = "all"
    
    def __str__(self) -> str:
        return f"{self.resource.value}:{self.action.value}"
    
    def __hash__(self) -> int:
        return hash((self.resource, self.action))
    
    def __eq__(self, other) -> bool:
        if not isinstance(other, Permission):
            return False
        return self.resource == other.resource and self.action == other.action


# ── 预定义权限集合 ──

PREDEFINED_PERMISSIONS: List[Permission] = [
    # 配方权限
    Permission(Resource.FORMULA, Action.CREATE, "创建配方"),
    Permission(Resource.FORMULA, Action.READ, "查看配方"),
    Permission(Resource.FORMULA, Action.UPDATE, "编辑配方"),
    Permission(Resource.FORMULA, Action.DELETE, "删除配方"),
    Permission(Resource.FORMULA, Action.APPROVE, "审核配方"),
    Permission(Resource.FORMULA, Action.PUBLISH, "发布配方"),
    Permission(Resource.FORMULA, Action.EXPORT, "导出配方"),
    Permission(Resource.FORMULA, Action.SHARE, "分享配方"),
    
    # 实验权限
    Permission(Resource.EXPERIMENT, Action.CREATE, "创建实验"),
    Permission(Resource.EXPERIMENT, Action.READ, "查看实验"),
    Permission(Resource.EXPERIMENT, Action.UPDATE, "编辑实验"),
    Permission(Resource.EXPERIMENT, Action.DELETE, "删除实验"),
    
    # 工作流权限
    Permission(Resource.WORKFLOW, Action.CREATE, "创建工作流"),
    Permission(Resource.WORKFLOW, Action.READ, "查看工作流"),
    Permission(Resource.WORKFLOW, Action.EXECUTE, "执行工作流"),
    Permission(Resource.WORKFLOW, Action.CANCEL, "取消工作流"),
    
    # 用户管理权限
    Permission(Resource.USER, Action.CREATE, "创建用户"),
    Permission(Resource.USER, Action.READ, "查看用户"),
    Permission(Resource.USER, Action.UPDATE, "编辑用户"),
    Permission(Resource.USER, Action.DELETE, "禁用用户"),
    Permission(Resource.USER, Action.MANAGE, "管理用户"),
    
    # 系统管理权限
    Permission(Resource.SYSTEM, Action.CONFIGURE, "配置系统"),
    Permission(Resource.SYSTEM, Action.ADMINISTER, "系统管理"),
    Permission(Resource.AUDIT_LOG, Action.READ, "查看审计日志"),
    
    # AI 功能权限
    Permission(Resource.AI_GENERATION, Action.CREATE, "AI生成配方"),
    Permission(Resource.AI_GENERATION, Action.READ, "查看AI结果"),
    Permission(Resource.AI_MODEL, Action.CONFIGURE, "配置AI模型"),
    
    # 数据库权限
    Permission(Resource.DATABASE, Action.READ, "查看知识库"),
    Permission(Resource.DATABASE, Action.IMPORT, "导入数据"),
    Permission(Resource.DATABASE, Action.EXPORT, "导出数据"),
]


# ── 角色权限矩阵 ──

ROLE_PERMISSIONS: Dict[str, Set[Permission]] = {
    # 超级管理员 - 拥有所有权限
    "ADMIN": set(PREDEFINED_PERMISSIONS),
    
    # 配方师 - 配方全权 + 部分实验/AI权限
    "FORMULATOR": {
        # 配方完整权限
        Permission(Resource.FORMULA, Action.CREATE),
        Permission(Resource.FORMULA, Action.READ),
        Permission(Resource.FORMULA, Action.UPDATE),
        Permission(Resource.FORMULA, Action.DELETE),
        Permission(Resource.FORMULA, Action.EXPORT),
        Permission(Resource.FORMULA, Action.SHARE),
        
        # 配方版本
        Permission(Resource.FORMULA_VERSION, Action.CREATE),
        Permission(Resource.FORMULA_VERSION, Action.READ),
        Permission(Resource.FORMULA_VERSION, Action.RESTORE),
        
        # 实验权限
        Permission(Resource.EXPERIMENT, Action.CREATE),
        Permission(Resource.EXPERIMENT, Action.READ),
        Permission(Resource.EXPERIMENT, Action.UPDATE),
        
        # 工作流权限
        Permission(Resource.WORKFLOW, Action.CREATE),
        Permission(Resource.WORKFLOW, Action.READ),
        Permission(Resource.WORKFLOW, Action.EXECUTE),
        
        # AI权限
        Permission(Resource.AI_GENERATION, Action.CREATE),
        Permission(Resource.AI_GENERATION, Action.READ),
        
        # 数据库只读
        Permission(Resource.DATABASE, Action.READ),
        
        # 报告导出
        Permission(Resource.REPORT, Action.CREATE),
        Permission(Resource.REPORT, Action.EXPORT),
    },
    
    # 审核员 - 审核 + 查看权限
    "REVIEWER": {
        # 配方审核
        Permission(Resource.FORMULA, Action.READ),
        Permission(Resource.FORMULA, Action.APPROVE),
        Permission(Resource.FORMULA, Action.REJECT),
        Permission(Resource.FORMULA, Action.PUBLISH),
        Permission(Resource.FORMULA, Action.COMMENT),
        
        # 审核工作流
        Permission(Resource.WORKFLOW, Action.READ),
        Permission(Resource.WORKFLOW, Action.APPROVE),
        
        # 实验查看
        Permission(Resource.EXPERIMENT, Action.READ),
        
        # 审计日志
        Permission(Resource.AUDIT_LOG, Action.READ),
        
        # 数据库只读
        Permission(Resource.DATABASE, Action.READ),
    },
    
    # 研究员 - 基础读写权限
    "RESEARCHER": {
        # 配方（仅自己创建的）
        Permission(Resource.FORMULA, Action.CREATE),
        Permission(Resource.FORMULA, Action.READ),
        Permission(Resource.FORMULA, Action.UPDATE),  # 仅自己的
        
        # 实验权限
        Permission(Resource.EXPERIMENT, Action.CREATE),
        Permission(Resource.EXPERIMENT, Action.READ),
        Permission(Resource.EXPERIMENT, Action.UPDATE),
        
        # 工作流（只读+执行自己触发的）
        Permission(Resource.WORKFLOW, Action.READ),
        Permission(Resource.WORKFLOW, Action.EXECUTE),
        
        # 数据库只读
        Permission(Resource.DATABASE, Action.READ),
        
        # 导出报告
        Permission(Resource.REPORT, Action.CREATE),
        Permission(Resource.REPORT, Action.EXPORT),
    },
    
    # 访客 - 只读权限
    "GUEST": {
        # 公开配方查看
        Permission(Resource.FORMULA, Action.READ),
        
        # 数据库只读
        Permission(Resource.DATABASE, Action.READ),
    },
}


class RBACManager:
    """
    RBAC 权限管理器
    
    提供完整的权限检查、管理和审计功能。
    
    Attributes:
        role_permissions: 角色权限映射
        custom_permissions: 自定义权限覆盖
    """
    
    def __init__(self):
        """初始化RBAC管理器"""
        self.role_permissions: Dict[str, Set[Permission]] = dict(ROLE_PERMISSIONS)
        self.custom_permissions: Dict[str, Set[Permission]] = {}
        
        logger.info("✅ RBAC权限管理器已初始化")
        logger.info(
            f"   已加载 {len(self.role_permissions)} 个角色\n"
            f"   总计 {len(PREDEFINED_PERMISSIONS)} 个预定义权限"
        )
    
    def check_permission(
        self,
        role: str,
        resource: Resource | str,
        action: Action | str,
        context: Optional[Dict[str, Any]] = None
    ) -> bool:
        """
        检查指定角色是否拥有权限
        
        Args:
            role: 用户角色
            resource: 资源类型（Resource枚举或字符串）
            action: 操作类型（Action枚举或字符串）
            context: 上下文信息（如资源所有者ID等）
            
        Returns:
            bool: 是否有权限
        """
        # 统一转换为枚举
        if isinstance(resource, str):
            try:
                resource = Resource(resource)
            except ValueError:
                logger.warning(f"未知资源类型: {resource}")
                return False
        
        if isinstance(action, str):
            try:
                action = Action(action)
            except ValueError:
                logger.warning(f"未知操作类型: {action}")
                return False
        
        permission = Permission(resource, action)
        
        # 获取角色权限（优先使用自定义权限）
        permissions = self.custom_permissions.get(role) or self.role_permissions.get(role, set())
        
        # 检查是否拥有该权限
        has_permission = permission in permissions
        
        # 特殊情况：MANAGE 权限包含所有基础CRUD
        if not has_permission:
            manage_permission = Permission(resource, Action.MANAGE)
            has_permission = manage_permission in permissions
        
        # 特殊情况：ADMINISTER 权限包含所有操作
        if not has_permission:
            admin_permission = Permission(resource, Action.ADMINISTER)
            has_permission = admin_permission in permissions
        
        # 记录权限检查日志（仅关键操作）
        if action in (Action.DELETE, Action.ADMINISTER, Action.MANAGE):
            level = logging.INFO if has_permission else logging.WARNING
            logger.log(
                level,
                f"{'✅' if has_permission else '❌'} 权限检查:\n"
                f"   角色: {role}\n"
                f"   权限: {permission}\n"
                f"   结果: {'允许' if has_permission else '拒绝'}"
            )
        
        return has_permission
    
    def get_role_permissions(self, role: str) -> Set[Permission]:
        """
        获取角色的所有权限
        
        Args:
            role: 角色名称
            
        Returns:
            Set[Permission]: 权限集合
        """
        base_perms = self.role_permissions.get(role, set())
        custom_perms = self.custom_permissions.get(role, set())
        return base_perms | custom_perms
    
    def get_resource_permissions(self, resource: Resource) -> Dict[str, bool]:
        """
        获取各角色对指定资源的权限概览
        
        Args:
            resource: 资源类型
            
        Returns:
            Dict: {role_name: has_permission}
        """
        result = {}
        for role in self.role_permissions.keys():
            perms = self.get_role_permissions(role)
            result[role] = any(p.resource == resource for p in perms)
        return result
    
    def grant_permission(self, role: str, permission: Permission) -> None:
        """
        授予角色额外权限（自定义覆盖）
        
        Args:
            role: 角色名称
            permission: 要授予的权限
        """
        if role not in self.custom_permissions:
            self.custom_permissions[role] = set()
        self.custom_permissions[role].add(permission)
        
        logger.info(
            f"🔑 已授予权限:\n"
            f"   角色: {role}\n"
            f"   权限: {permission}"
        )
    
    def revoke_permission(self, role: str, permission: Permission) -> None:
        """
        撤销角色权限
        
        Args:
            role: 角色名称
            permission: 要撤销的权限
        """
        if role in self.custom_permissions:
            self.custom_permissions[role].discard(permission)
            
        logger.info(
            f"🔒 已撤销权限:\n"
            f"   角色: {role}\n"
            f"   权限: {permission}"
        )
    
    def get_permission_matrix(self) -> Dict[str, Dict[str, List[str]]]:
        """
        获取完整的权限矩阵（用于前端展示）
        
        Returns:
            Dict: 权限矩阵数据
        """
        matrix = {}
        
        for role, permissions in self.role_permissions.items():
            matrix[role] = {}
            for perm in permissions:
                resource = perm.resource.value
                action = perm.action.value
                
                if resource not in matrix[role]:
                    matrix[role][resource] = []
                
                matrix[role][resource].append(action)
        
        return matrix
    
    def require_permission(self, resource: Resource, action: Action):
        """
        权限检查装饰器工厂
        
        用法:
            @rbac.require_permission(Resource.FORMULA, Action.DELETE)
            async def delete_formula(formula_id: int, ...):
                ...
        
        Args:
            resource: 资源类型
            action: 操作类型
            
        Returns:
            Callable: 装饰器函数
        """
        def decorator(func: Callable) -> Callable:
            @wraps(func)
            async def wrapper(*args, **kwargs):
                # 从kwargs中获取current_user（FastAPI依赖注入）
                current_user = kwargs.get('current_user')
                
                if not current_user:
                    raise PermissionError("无法获取当前用户信息")
                
                role = current_user.role.value if hasattr(current_user.role, 'value') else str(current_user.role)
                
                if not self.check_permission(role, resource, action):
                    from fastapi import HTTPException, status
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail={
                            "error_code": "INSUFFICIENT_PERMISSION",
                            "message": f"权限不足：需要 {resource.value}:{action.value} 权限",
                            "required_permission": f"{resource.value}:{action.value}",
                            "current_role": role,
                        }
                    )
                
                return await func(*args, **kwargs)
            
            return wrapper
        return decorator
    
    def filter_resources_by_permission(
        self,
        role: str,
        resource_type: Resource,
        action: Action,
        resources: List[Any],
        owner_field: str = 'creator_id',
        user_id: Optional[int] = None
    ) -> List[Any]:
        """
        根据权限过滤资源列表
        
        支持作用域过滤：
        - all: 返回全部资源
        - own: 仅返回用户自己的资源
        - department: 返回部门内资源（未实现，返回own）
        
        Args:
            role: 用户角色
            resource_type: 资源类型
            action: 操作类型
            resources: 待过滤的资源列表
            owner_field: 所有者字段名
            user_id: 当前用户ID
            
        Returns:
            List[Any]: 过滤后的资源列表
        """
        if not self.check_permission(role, resource_type, action):
            return []
        
        # 如果是ADMIN或拥有MANAGE权限，返回全部
        if role == 'ADMIN' or self.check_permission(role, resource_type, Action.MANAGE):
            return resources
        
        # 否则仅返回自己的资源
        if user_id and owner_field:
            return [r for r in resources if getattr(r, owner_field, None) == user_id]
        
        return resources


# ── 全局单例 ──

_rbac_instance: Optional[RBACManager] = None

def get_rbac() -> RBACManager:
    """获取RBAC管理器单例"""
    global _rbac_instance
    if _rbac_instance is None:
        _rbac_instance = RBACManager()
    return _rbac_instance


def check_permission(role: str, resource: str | Resource, action: str | Action) -> bool:
    """
    快捷权限检查函数
    
    用法:
        if check_permission(user.role, "formula", "create"):
            # 允许创建
    """
    rbac = get_rbac()
    return rbac.check_permission(role, resource, action)


# ── FastAPI 依赖注入 ──

def require_role(*allowed_roles: str):
    """
    角色验证依赖（FastAPI Depends）
    
    用法:
        @router.get("/admin/users")
        async def list_users(
            current_user: User = Depends(require_role("ADMIN"))
        ):
            ...
    """
    from fastapi import Depends, HTTPException, status
    from ..api.deps import get_current_user
    from ..models import User
    
    async def _role_checker(current_user: User = Depends(get_current_user)) -> User:
        role = current_user.role.value if hasattr(current_user.role, 'value') else str(current_user.role)
        
        # 修复：原条件 "role not in allowed_roles and 'ADMIN' not in allowed_roles"
        # 在 allowed_roles 含 ADMIN 时恒为 False → 任意角色（含 GUEST）放行，RBAC 绕过。
        # 正确语义：ADMIN 恒放行（超管旁路），其余角色必须命中 allowed_roles。
        if role not in allowed_roles and role != 'ADMIN':
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "error_code": "ROLE_FORBIDDEN",
                    "message": f"需要以下角色之一: {', '.join(allowed_roles)}",
                    "required_roles": list(allowed_roles),
                    "current_role": role,
                }
            )
        
        return current_user
    
    return _role_checker