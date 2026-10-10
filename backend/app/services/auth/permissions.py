"""RMFOOD 团队协作权限定义

定义团队协作模块的权限层级和角色矩阵：
- 资源层级（team, category, prompt_template, version）
- 预定义角色权限矩阵（owner, admin, member, guest）
- 权限继承规则
"""
from typing import Optional  # A-27
from typing import Dict, List, Set, Any
from dataclasses import dataclass, field
from enum import Enum


class TeamResource(str, Enum):
    """团队协作资源类型"""
    TEAM = "team"
    CATEGORY = "category"
    PROMPT_TEMPLATE = "prompt_template"
    VERSION = "version"
    COMMENT = "comment"
    NOTIFICATION = "notification"


class TeamAction(str, Enum):
    """操作类型"""
    VIEW = "view"
    CREATE = "create"
    EDIT = "edit"
    DELETE = "delete"
    MANAGE = "manage"
    ADMIN = "admin"
    SHARE = "share"
    ROLLBACK = "rollback"


RESOURCE_HIERARCHY: Dict[str, List[str]] = {
    "team": ["view", "manage", "delete", "admin"],
    "category": ["view", "create", "edit", "delete", "manage"],
    "prompt_template": ["view", "edit", "delete", "share", "admin"],
    "version": ["view", "create", "rollback"],
    "comment": ["view", "create", "delete"],
    "notification": ["view", "manage"],
}


ROLE_PERMISSIONS: Dict[str, Dict[str, List[str]]] = {
    "owner": {
        "team": ["*"],
        "category": ["*"],
        "prompt_template": ["*"],
        "version": ["*"],
        "comment": ["*"],
        "notification": ["*"],
    },
    "admin": {
        "team": ["view", "manage"],
        "category": ["*"],
        "prompt_template": ["*"],
        "version": ["*"],
        "comment": ["*"],
        "notification": ["view", "manage"],
    },
    "member": {
        "team": ["view"],
        "category": ["view", "create", "edit"],
        "prompt_template": ["view", "edit", "share"],
        "version": ["view"],
        "comment": ["view", "create", "delete"],
        "notification": ["view"],
    },
    "guest": {
        "team": ["view"],
        "category": ["view"],
        "prompt_template": ["view"],
        "version": ["view"],
        "comment": ["view"],
        "notification": ["view"],
    },
}


@dataclass
class PermissionCheck:
    """权限检查请求"""
    resource_type: str
    resource_id: int
    action: str


@dataclass
class PermissionResult:
    """权限检查结果"""
    allowed: bool
    reason: Optional[str] = None
    required_role: Optional[str] = None


def check_role_permission(
    role: str,
    resource: str,
    action: str,
) -> bool:
    """
    检查指定角色是否拥有特定资源的操作权限
    
    Args:
        role: 角色 (owner/admin/member/guest)
        resource: 资源类型 (team/category/prompt_template/version)
        action: 操作 (view/create/edit/delete/manage等)
        
    Returns:
        是否有权限
    """
    role_perms = ROLE_PERMISSIONS.get(role.lower(), {})
    resource_perms = role_perms.get(resource.lower(), [])
    
    if "*" in resource_perms:
        return True
    
    return action.lower() in [p.lower() for p in resource_perms]


def get_role_permissions(role: str) -> Dict[str, List[str]]:
    """
    获取角色的所有权限
    
    Args:
        role: 角色名称
        
    Returns:
        权限字典 {resource_type: [actions]}
    """
    return ROLE_PERMISSIONS.get(role.lower(), {})


def get_all_permissions_for_role(role: str) -> Set[str]:
    """
    获取角色的所有权限字符串集合
    
    格式: {"resource:action"}
    
    Args:
        role: 角色名称
        
    Returns:
        权限字符串集合
    """
    permissions = set()
    role_perms = get_role_permissions(role)
    
    for resource, actions in role_perms.items():
        for action in actions:
            if action == "*":
                all_actions = RESOURCE_HIERARCHY.get(resource, [])
                for a in all_actions:
                    permissions.add(f"{resource}:{a}")
            else:
                permissions.add(f"{resource}:{action}")
    
    return permissions
