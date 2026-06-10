"""RMFOOD @提及解析器

用于解析文本中的@提及，支持：
- @username 格式识别
- 自动补全建议查询
- 最大提及数量限制（防骚扰）
- 团队成员上下文感知
"""
import re
import logging
from typing import Tuple, List, Optional, Set
from dataclasses import dataclass

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.team_member import TeamMember
from app.models.user_model import User

logger = logging.getLogger(__name__)

MENTION_PATTERN = r'@(\w+)'
MAX_MENTIONS_PER_MESSAGE = 10


@dataclass
class MentionResult:
    """提及结果"""
    cleaned_text: str
    mentioned_user_ids: List[int]
    mentioned_usernames: List[str]


@dataclass
class MentionSuggestion:
    """提及建议"""
    user_id: int
    username: str
    avatar_url: Optional[str] = None
    role: Optional[str] = None


def parse_mentions(text: str) -> Tuple[str, List[str]]:
    """
    解析文本中的@提及
    
    输入: "@john 请看一下这个prompt @alice"
    输出: (" 请看一下这个prompt ", ["john", "alice"])
    
    支持格式：
    - @username （字母数字下划线）
    
    Args:
        text: 包含@提及的文本
        
    Returns:
        元组 (清理后的文本, 提及的用户名列表)
    """
    matches = re.findall(MENTION_PATTERN, text)
    
    unique_usernames = list(dict.fromkeys(matches))
    
    if len(unique_usernames) > MAX_MENTIONS_PER_MESSAGE:
        logger.warning(f"超过最大提及数量限制: {len(unique_usernames)} > {MAX_MENTIONS_PER_MESSAGE}")
        unique_usernames = unique_usernames[:MAX_MENTIONS_PER_MESSAGE]

    cleaned_text = re.sub(MENTION_PATTERN, '', text)
    cleaned_text = ' '.join(cleaned_text.split())

    return cleaned_text, unique_usernames


async def resolve_mentions_to_user_ids(
    db: AsyncSession,
    usernames: List[str],
    team_id: Optional[int] = None,
) -> List[int]:
    """
    将用户名列表转换为用户ID列表
    
    如果提供了team_id，只返回团队成员内的匹配项
    
    Args:
        db: 数据库会话
        usernames: 用户名列表
        team_id: 可选的团队ID（限制范围）
        
    Returns:
        匹配的用户ID列表
    """
    if not usernames:
        return []

    query = select(User.id, User.username).where(
        User.username.in_(usernames)
    )

    result = await db.execute(query)
    users = result.all()

    username_to_id = {username: uid for uid, username in users}

    if team_id:
        member_result = await db.execute(
            select(TeamMember.user_id).where(TeamMember.team_id == team_id)
        )
        team_member_ids = set(row[0] for row in member_result.all())

        resolved_ids = []
        for username in usernames:
            user_id = username_to_id.get(username)
            if user_id and user_id in team_member_ids:
                resolved_ids.append(user_id)
        
        return resolved_ids

    return [username_to_id.get(uname) for uname in usernames if uname in username_to_id]


async def get_mention_suggestions(
    db: AsyncSession,
    prefix: str,
    team_id: Optional[int] = None,
    limit: int = 5,
) -> List[MentionSuggestion]:
    """
    获取@提及自动补全建议
    
    根据输入前缀搜索匹配的团队成员用户名
    
    Args:
        db: 数据库会话
        prefix: 输入的前缀（如"jo"）
        team_id: 可选的团队ID（限制搜索范围）
        limit: 返回的最大数量
        
        Returns:
        建议列表
    """
    if not prefix or len(prefix) < 1:
        return []

    pattern = f"{prefix}%"

    if team_id:
        query = (
            select(User.id, User.username, TeamMember.role)
            .join(TeamMember, User.id == TeamMember.user_id)
            .where(
                TeamMember.team_id == team_id,
                User.username.ilike(pattern),
            )
            .limit(limit)
        )
    else:
        query = (
            select(User.id, User.username)
            .where(User.username.ilike(pattern))
            .limit(limit)
        )

    result = await db.execute(query)
    rows = result.all()

    suggestions = []
    for row in rows:
        user_id = row[0]
        username = row[1]
        role = row[2] if len(row) > 2 else None

        suggestions.append(MentionSuggestion(
            user_id=user_id,
            username=username,
            role=role.value if hasattr(role, 'value') else str(role) if role else None,
        ))

    logger.debug(f"@提及建议: prefix='{prefix}', count={len(suggestions)}")

    return suggestions


async def parse_and_resolve_mentions(
    text: str,
    db: AsyncSession,
    team_id: Optional[int] = None,
) -> MentionResult:
    """
    解析文本并解析@提及为用户ID（一步完成）
    
    Args:
        text: 原始文本
        db: 数据库会话
        team_id: 可选的团队ID
        
    Returns:
        MentionResult对象
    """
    cleaned_text, usernames = parse_mentions(text)

    user_ids = await resolve_mentions_to_user_ids(db, usernames, team_id)

    return MentionResult(
        cleaned_text=cleaned_text,
        mentioned_user_ids=user_ids,
        mentioned_usernames=usernames,
    )


def extract_mentions_from_content(content: str) -> Set[str]:
    """
    从内容中提取所有@提及（不验证存在性）
    
    用于快速扫描或预处理场景
    
    Args:
        content: 文本内容
        
    Returns:
        提及的用户名集合
    """
    matches = re.findall(MENTION_PATTERN, content)
    return set(matches)


def has_excessive_mentions(text: str, max_allowed: int = MAX_MENTIONS_PER_MESSAGE) -> bool:
    """
    检查文本是否包含过多的@提及（防骚扰）
    
    Args:
        text: 要检查的文本
        max_allowed: 允许的最大提及数
        
    Returns:
        是否超出限制
    """
    mentions = extract_mentions_from_content(text)
    return len(mentions) > max_allowed


def format_mentions_for_display(text: str, mention_links: Optional[Dict[str, str]] = None) -> str:
    """
    将@提及格式化为可点击链接或特殊标记
    
    Args:
        text: 原始文本
        mention_links: 用户名到链接/标记的映射
        
    Returns:
        格式化后的文本
    """
    if not mention_links:

        def replace_match(match):
            username = match.group(1)
            return f'<span class="mention">@{username}</span>'

        return re.sub(MENTION_PATTERN, replace_match, text)

    def replace_with_link(match):
        username = match.group(1)
        link = mention_links.get(username, '#')
        return f'<a href="{link}" class="mention">@{username}</a>'

    return re.sub(MENTION_PATTERN, replace_with_link, text)
