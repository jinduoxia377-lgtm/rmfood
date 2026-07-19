"""
⚠️ EXPERIMENTAL — 协作系统未完全实现

此模块中的所有服务均为实验性实现。以下功能尚未持久化到数据库：
- 评论创建/查询/解决/表情反应
- 文件共享/版本管理
- 实时协作会话

前端不应依赖这些功能作为生产级特性。
完整实现在后续 Sprint 中逐步推进。
"""

from datetime import datetime, timezone
from typing import List, Dict, Optional, Any
from dataclasses import dataclass, field
from enum import Enum
import re
import json
import logging

logger = logging.getLogger(__name__)


class MentionType(str, Enum):
    USER = "user"
    TEAM = "team"
    ROLE = "role"


@dataclass
class Mention:
    """@提及"""
    id: str  # 格式: @username 或 @userid
    type: MentionType
    display_name: str
    user_id: Optional[int] = None
    resolved: bool = False
    notified_at: Optional[datetime] = None


@dataclass
class Comment:
    """评论"""
    id: int
    content: str
    author_id: int
    author_name: str
    resource_type: str  # formula/experiment/workflow etc.
    resource_id: int
    parent_id: Optional[int] = None  # 支持回复线程
    mentions: List[Mention] = field(default_factory=list)
    attachments: List[Dict] = field(default_factory=list)
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    is_deleted: bool = False
    is_resolved: bool = False
    reactions: Dict[str, List[int]] = field(default_factory=dict)  # {emoji: [user_ids]}
    
    def to_dict(self) -> Dict:
        return {
            "id": self.id,
            "content": self.content[:500],
            "author": self.author_name,
            "author_id": self.author_id,
            "mentions": [{"id": m.id, "name": m.display_name} for m in self.mentions],
            "attachments": self.attachments[:3],
            "created_at": self.created_at.isoformat(),
            "reactions": {k: len(v) for k, v in self.reactions.items()},
            "reply_count": 0,  # 需要从DB查询
            "is_resolved": self.is_resolved,
        }


@dataclass 
class CollaborationSession:
    """实时协作会话"""
    session_id: str
    resource_type: str
    resource_id: int
    participants: List[int] = field(default_factory=list)
    cursors: Dict[int, Dict[str, Any]] = field(default_factory=dict)  # {user_id: {position, selection}}
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    last_activity: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


# ── @提及解析器 ──

class MentionParser:
    """解析文本中的@提及"""
    
    MENTION_PATTERN = re.compile(r'@(\w[\w.-]{2,49})')
    TEAM_PATTERN = re.compile(r'@(team|团队|组)\s*([\w\u4e00-\u9fff]+)')
    
    @classmethod
    def parse(cls, text: str) -> List[str]:
        """提取所有@提及"""
        if not text:
            return []
        
        mentions = set()
        
        # 匹配 @username
        for match in cls.MENTION_PATTERN.finditer(text):
            mentions.add(match.group(0))
        
        # 匹配 @team name
        for match in cls.TEAM_PATTERN.finditer(text):
            mentions.add(match.group(0))
        
        return list(mentions)
    
    @classmethod
    def render_mentions(cls, text: str, mention_map: Dict[str, Dict]) -> str:
        """将@提及渲染为可点击的链接/Mention组件"""
        def replace_mention(match):
            mention_str = match.group(0)
            info = mention_map.get(mention_str)
            
            if info:
                user_id = info.get('user_id')
                name = info.get('display_name', mention_str[1:])
                return f'<span class="mention" data-user-id="{user_id}" data-name="@{name}">{mention_str}</span>'
            
            return match.group(0)
        
        return cls.MENTION_PATTERN.sub(replace_mention, text)


# ── 评论服务 ──

class CommentService:
    """评论与协作业务逻辑"""
    
    def __init__(self, db):
        self.db = db
    
    async def add_comment(
        self,
        resource_type: str,
        resource_id: int,
        author_id: int,
        content: str,
        parent_id: Optional[int] = None,
        attachments: Optional[List[Dict]] = None,
    ) -> Comment:
        """添加评论（自动解析@提及）

        NOTE: 协作系统尚在开发中。此方法返回一个内存 Comment 对象，
        但未持久化到数据库。完整实现在 TODO 列表中。
        """
        # 解析提及
        raw_mentions = MentionParser.parse(content)

        # 验证并解析提及的用户
        resolved_mentions = []
        for mention_str in raw_mentions:
            username = mention_str.lstrip('@')
            # TODO: 从数据库查询用户
            resolved_mentions.append(Mention(
                id=mention_str,
                type=MentionType.USER,
                display_name=username,
            ))

        comment = Comment(
            id=0,  # 由DB生成
            content=content,
            author_id=author_id,
            author_name="",  # 从DB查询
            resource_type=resource_type,
            resource_id=resource_id,
            parent_id=parent_id,
            mentions=resolved_mentions,
            attachments=attachments or [],
        )

        # TODO: 写入数据库

        # 发送通知给被提及的用户
        for mention in resolved_mentions:
            await self._send_mention_notification(mention, comment)

        logger.info(f"💬 新评论: {resource_type}/{resource_id} by user={author_id}, mentions={len(resolved_mentions)}")
        logger.warning("⚠️ 协作系统未完全实现 — 评论未持久化到数据库")

        return comment
    
    async def get_comments(
        self,
        resource_type: str,
        resource_id: int,
        include_deleted: bool = False,
        thread_depth: int = 3,
    ) -> List[Comment]:
        """获取资源的评论列表（支持线程化回复）

        NOTE: 协作系统尚未实现数据库查询。
        """
        logger.warning("⚠️ 协作系统未实现 — get_comments 返回空列表")
        return []

    async def resolve_comment(self, comment_id: int, resolver_id: int) -> bool:
        """标记评论为已解决/关闭"""
        logger.warning("⚠️ 协作系统未实现 — resolve_comment 未持久化")
        return True

    async def add_reaction(self, comment_id: int, user_id: int, emoji: str) -> bool:
        """添加表情反应"""
        logger.warning("⚠️ 协作系统未实现 — add_reaction 未持久化")
        return True

    async def get_activity_timeline(
        self,
        resource_type: str,
        resource_id: int,
        limit: int = 50,
    ) -> List[Dict]:
        """获取资源活动时间线"""
        logger.warning("⚠️ 协作系统未实现 — get_activity_timeline 返回空列表")
        return []


# ── 文件共享服务 ──

class FileSharingService:
    """文件共享与版本管理"""
    
    async def upload_shared_file(
        self,
        uploader_id: int,
        file_data: bytes,
        filename: str,
        mime_type: str,
        resource_type: str,
        resource_id: int,
        permissions: Dict[str, List[int]],
        description: Optional[str] = None,
    ) -> Dict:
        """上传共享文件

        NOTE: 协作系统尚未实现文件持久化。
        """
        logger.warning("⚠️ 协作系统未实现 — 文件未保存到存储")
        return {
            "id": 0,
            "filename": filename,
            "original_name": filename,
            "size": len(file_data),
            "mime_type": mime_type,
            "uploader_id": uploader_id,
            "resource_type": resource_type,
            "resource_id": resource_id,
            "permissions": permissions,
            "description": description,
            "version": 1,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
    
    async def list_shared_files(
        self,
        resource_type: str,
        resource_id: int,
        user_id: int,
    ) -> List[Dict]:
        """列出用户有权限查看的共享文件"""
        logger.warning("⚠️ 协作系统未实现 — list_shared_files 返回空列表")
        return []
    
    async def create_file_version(
        self,
        file_id: int,
        uploader_id: int,
        file_data: bytes,
        change_description: str = "",
    ) -> Dict:
        """创建新版本"""
        logger.warning("⚠️ 协作系统未实现 — 版本未持久化")
        return {
            "file_id": file_id,
            "version_number": 0,
            "uploader_id": uploader_id,
            "size": len(file_data),
            "change_description": change_description,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
    
    async def get_file_versions(self, file_id: int) -> List[Dict]:
        """获取文件的版本历史"""
        logger.warning("⚠️ 协作系统未实现 — get_file_versions 返回空列表")
        return []


# ── 实时协作服务 ──

class RealtimeCollaborationService:
    """实时协作（基于WebSocket）"""
    
    def __init__(self):
        from ..core.websocket import connection_manager
        self.ws_manager = connection_manager
    
    async def join_session(
        self,
        session_id: str,
        user_id: int,
        user_info: Dict,
    ):
        """加入协作会话"""
        # 广播加入消息
        await self.ws_manager.broadcast_to_session(
            session_id,
            {
                "type": "collaborator_joined",
                "user_id": user_id,
                "user_info": user_info,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
        )
        
        logger.info(f"🤝 用户 {user_id} 加入协作会话 {session_id}")
    
    async def leave_session(self, session_id: str, user_id: int):
        """离开协作会话"""
        await self.ws_manager.broadcast_to_session(
            session_id,
            {
                "type": "collaborator_left",
                "user_id": user_id,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
        )
    
    async def broadcast_cursor_position(
        self,
        session_id: str,
        user_id: int,
        position: Dict[str, Any],
    ):
        """广播光标位置（用于显示其他用户的编辑位置）"""
        await self.ws_manager.broadcast_to_others(
            session_id,
            user_id,
            {
                "type": "cursor_update",
                "user_id": user_id,
                "position": position,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
        )
    
    async def broadcast_edit(
        self,
        session_id: str,
        user_id: int,
        operation: str,  # insert/delete/replace/format
        data: Dict,
    ):
        """广播编辑操作（OT算法友好）"""
        await self.ws_manager.broadcast_to_others(
            session_id,
            user_id,
            {
                "type": "remote_edit",
                "user_id": user_id,
                "operation": operation,
                "data": data,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
        )
    
    async def get_active_sessions(self, resource_type: str, resource_id: int) -> List[Dict]:
        """获取资源的活跃协作会话"""
        logger.warning("⚠️ 协作系统未实现 — 未查询Redis/DB")
        return []


async def _send_mention_notification(self, mention: Mention, comment: Comment):
    """发送@提及通知"""
    logger.warning("⚠️ 协作系统未实现 — 通知未持久化或未推送")
    pass