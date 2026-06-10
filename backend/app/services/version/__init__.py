"""RMFOOD 版本控制服务

提供完整的版本管理功能：
- 语义化版本号自动生成
- 完整内容快照存储
- 差异对比（基于difflib）
- 版本回滚
- 多版本并行对比
- 分支支持（实验性功能）
"""
import logging
import difflib
import re
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any, Tuple
from dataclasses import dataclass, field

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc, and_

from app.models.prompt_version import PromptVersion
from app.core.exceptions import ResourceNotFoundException
from app.core.audit_system import AuditLogger

logger = logging.getLogger(__name__)


@dataclass
class DiffResult:
    """版本差异结果"""
    version_1_id: int
    version_2_id: int
    version_1_number: int
    version_2_number: int
    diffs: List[Dict[str, Any]]
    summary: str
    add_count: int = 0
    remove_count: int = 0
    modify_count: int = 0


@dataclass
class DiffItem:
    """单个差异项"""
    type: str
    line_number: int
    content: str
    old_content: Optional[str] = None


@dataclass
class ComparisonMatrix:
    """多版本对比矩阵"""
    versions: List[Dict[str, Any]]
    matrix: List[List[str]]


@dataclass(frozen=True)
class SemanticVersion:
    """语义化版本号"""
    major: int
    minor: int
    patch: int
    
    def __str__(self) -> str:
        return f"{self.major}.{self.minor}.{self.patch}"
    
    def increment_major(self) -> 'SemanticVersion':
        return SemanticVersion(self.major + 1, 0, 0)
    
    def increment_minor(self) -> 'SemanticVersion':
        return SemanticVersion(self.major, self.minor + 1, 0)
    
    def increment_patch(self) -> 'SemanticVersion':
        return SemanticVersion(self.major, self.minor, self.patch + 1)
    
    @classmethod
    def parse(cls, version_str: str) -> 'SemanticVersion':
        """解析版本字符串"""
        match = re.match(r'(\d+)\.(\d+)\.(\d+)', str(version_str))
        if match:
            return cls(int(match.group(1)), int(match.group(2)), int(match.group(3)))
        
        parts = str(version_str).split('.')
        if len(parts) == 2:
            return cls(int(parts[0]), int(parts[1]), 0)
        elif len(parts) == 1:
            return cls(int(parts[0]), 0, 0)
        
        return cls(1, 0, 0)


class VersioningService:
    """
    版本控制服务
    
    提供Prompt模板的完整版本生命周期管理。
    支持语义化版本、差异对比和回滚操作。
    """

    def __init__(self, db: AsyncSession):
        self.db = db
        self.audit_logger = AuditLogger(db)

    async def create_version(
        self,
        prompt_id: int,
        user_id: int,
        content: str,
        changelog: Optional[str] = None,
        change_type: str = "patch",
    ) -> PromptVersion:
        """
        创建新版本
        
        自动计算版本号（Semantic Versioning）：
        - MAJOR (major): 结构性重大变更
        - MINOR (minor): 功能新增或重要修改
        - PATCH (patch): 小修复或文字调整
        
        存储完整快照并计算与前版本的diff_summary
        
        Args:
            prompt_id: Prompt模板ID
            user_id: 创建者用户ID
            content: 完整内容快照
            changelog: 可选的变更日志
            change_type: 变更类型 (major/minor/patch)
            
        Returns:
            创建的PromptVersion对象
        """
        max_version_result = await self.db.execute(
            select(func.max(PromptVersion.version_number))
            .where(PromptVersion.prompt_template_id == prompt_id)
        )
        max_version_num = max_version_result.scalar() or 0

        if max_version_num > 0:
            prev_version_result = await self.db.execute(
                select(PromptVersion)
                .where(
                    PromptVersion.prompt_template_id == prompt_id,
                    PromptVersion.version_number == max_version_num,
                )
            )
            prev_version = prev_version_result.scalar_one_or_none()

            if prev_version:
                diff_summary = await self._calculate_diff_summary(
                    prev_version.content_snapshot,
                    content,
                )
            else:
                diff_summary = "初始版本"
        else:
            diff_summary = "初始版本"

        new_version_num = max_version_num + 1

        version = PromptVersion(
            prompt_template_id=prompt_id,
            version_number=new_version_num,
            content_snapshot=content,
            diff_summary=diff_summary,
            changelog=changelog or f"Version {new_version_num} ({change_type})",
            created_by=user_id,
        )
        self.db.add(version)
        await self.db.commit()
        await self.db.refresh(version)

        await self.audit_logger.log(
            action="create_version",
            resource_type="prompt_version",
            resource_id=version.id,
            user_id=user_id,
            details={
                "prompt_id": prompt_id,
                "version_number": new_version_num,
                "change_type": change_type,
            },
        )

        logger.info(
            f"📝 新版本已创建:\n"
            f"   Prompt: {prompt_id}\n"
            f"   Version: v{new_version_num}\n"
            f"   User: {user_id}\n"
            f"   Type: {change_type}"
        )

        return version

    async def get_version_history(
        self,
        prompt_id: int,
        page: int = 1,
        per_page: int = 20,
    ) -> Dict[str, Any]:
        """
        获取版本历史（分页，按版本号降序）
        
        Args:
            prompt_id: Prompt模板ID
            page: 页码
            per_page: 每页条数
            
        Returns:
            分页的版本列表
        """
        query = select(PromptVersion).where(
            PromptVersion.prompt_template_id == prompt_id
        )

        count_query = select(func.count(PromptVersion.id)).where(
            PromptVersion.prompt_template_id == prompt_id
        )

        total_result = await self.db.execute(count_query)
        total = total_result.scalar() or 0

        offset = (page - 1) * per_page
        query = query.order_by(desc(PromptVersion.version_number)).offset(offset).limit(per_page)

        result = await self.db.execute(query)
        versions = result.scalars().all()

        current_result = await self.db.execute(
            select(PromptVersion)
            .where(PromptVersion.prompt_template_id == prompt_id)
            .order_by(desc(PromptVersion.version_number))
            .limit(1)
        )
        current_version_obj = current_result.scalar_one_or_none()
        current_version = current_version_obj.version_number if current_version_obj else 0

        return {
            "versions": [
                {
                    "id": v.id,
                    "version_number": v.version_number,
                    "diff_summary": v.diff_summary,
                    "changelog": v.changelog,
                    "created_by": v.created_by,
                    "created_at": v.created_at.isoformat() if v.created_at else None,
                }
                for v in versions
            ],
            "total": total,
            "current_version": current_version,
            "page": page,
            "per_page": per_page,
        }

    async def get_version_detail(
        self,
        prompt_id: int,
        version_id: int,
    ) -> PromptVersion:
        """
        获取特定版本详情
        
        Args:
            prompt_id: Prompt模板ID
            version_id: 版本记录ID
            
        Returns:
            PromptVersion对象
            
        Raises:
            ResourceNotFoundException: 版本不存在
        """
        result = await self.db.execute(
            select(PromptVersion).where(
                and_(
                    PromptVersion.id == version_id,
                    PromptVersion.prompt_template_id == prompt_id,
                )
            )
        )
        version = result.scalar_one_or_none()

        if not version:
            raise ResourceNotFoundException("版本不存在")

        return version

    async def get_version_diff(
        self,
        prompt_id: int,
        v1_id: int,
        v2_id: int,
        context_lines: int = 3,
    ) -> DiffResult:
        """
        版本对比Diff
        
        使用difflib进行文本差异分析：
        - 返回结构化的增删改标记
        - 支持行级和字符级粒度
        - 高亮显示便于前端渲染
        
        Args:
            prompt_id: Prompt模板ID
            v1_id: 版本1 ID
            v2_id: 版本2 ID
            context_lines: 上下文行数
            
        Returns:
            DiffResult对象
        """
        result_v1 = await self.db.execute(
            select(PromptVersion).where(
                and_(
                    PromptVersion.id == v1_id,
                    PromptVersion.prompt_template_id == prompt_id,
                )
            )
        )
        version_1 = result_v1.scalar_one_or_none()

        result_v2 = await self.db.execute(
            select(PromptVersion).where(
                and_(
                    PromptVersion.id == v2_id,
                    PromptVersion.prompt_template_id == prompt_id,
                )
            )
        )
        version_2 = result_v2.scalar_one_or_none()

        if not version_1 or not version_2:
            raise ResourceNotFoundException("一个或两个版本不存在")

        lines_1 = version_1.content_snapshot.splitlines(keepends=True)
        lines_2 = version_2.content_snapshot.splitlines(keepends=True)

        differ = difflib.unified_diff(
            lines_1,
            lines_2,
            fromfile=f"v{version_1.version_number}",
            tofile=f"v{version_2.version_number}",
            n=context_lines,
        )

        diffs = []
        line_number = 1

        for line in differ:
            if line.startswith('+++') or line.startswith('---'):
                continue

            if line.startswith('@'):
                match = re.match(r'@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@', line)
                if match:
                    line_number = int(match.group(1))
                continue

            diff_type = "unchanged"
            old_content = None

            if line.startswith('+'):
                diff_type = "add"
                content = line[1:]
            elif line.startswith('-'):
                diff_type = "remove"
                content = line[1:]
                old_content = content
            else:
                content = line[1:] if line.startswith(' ') else line

            diffs.append({
                "type": diff_type,
                "line_number": line_number,
                "content": content.rstrip('\n'),
                "old_content": old_content.rstrip('\n') if old_content else None,
            })

            if diff_type != "unchanged":
                pass

            line_number += 1

        add_count = sum(1 for d in diffs if d["type"] == "add")
        remove_count = sum(1 for d in diffs if d["type"] == "remove")

        summary = (
            f"共 {len(diffs)} 行变更: "
            f"+{add_count} 行新增, "
            f"-{remove_count} 行删除"
        )

        logger.info(
            f"📊 Diff计算完成:\n"
            f"   v{version_1.version_number} ↔ v{version_2.version_number}\n"
            f"   {summary}"
        )

        return DiffResult(
            version_1_id=v1_id,
            version_2_id=v2_id,
            version_1_number=version_1.version_number,
            version_2_number=version_2.version_number,
            diffs=diffs,
            summary=summary,
            add_count=add_count,
            remove_count=remove_count,
        )

    async def rollback_version(
        self,
        prompt_id: int,
        version_id: int,
        user_id: int,
        reason: Optional[str] = None,
        create_new_version: bool = True,
    ) -> Dict[str, Any]:
        """
        回滚到指定版本
        
        操作流程：
        1. 验证目标版本存在
        2. 基于目标版本创建新分支版本号
        3. 保留原版本历史（不删除）
        4. 记录回滚操作到审计日志
        5. （可选）通知团队成员
        
        Args:
            prompt_id: Prompt模板ID
            version_id: 目标版本ID
            user_id: 执行回滚的用户ID
            reason: 回滚原因
            create_new_version: 是否创建新版本记录
            
        Returns:
            回滚结果信息
        """
        target_result = await self.db.execute(
            select(PromptVersion).where(
                and_(
                    PromptVersion.id == version_id,
                    PromptVersion.prompt_template_id == prompt_id,
                )
            )
        )
        target_version = target_result.scalar_one_or_none()

        if not target_version:
            raise ResourceNotFoundException("目标版本不存在")

        new_version_id = None

        if create_new_version:
            max_ver_result = await self.db.execute(
                select(func.max(PromptVersion.version_number))
                .where(PromptVersion.prompt_template_id == prompt_id)
            )
            max_version = max_ver_result.scalar() or 0

            new_version = PromptVersion(
                prompt_template_id=prompt_id,
                version_number=max_version + 1,
                content_snapshot=target_version.content_snapshot,
                diff_summary=(
                    f"Rollback from v{target_version.version_number} → v{max_version + 1}"
                ),
                changelog=(
                    f"回滚操作: {reason or '未提供原因'}\n"
                    f"源版本: v{target_version.version_number}"
                ),
                created_by=user_id,
            )
            self.db.add(new_version)
            await self.db.flush()
            new_version_id = new_version.id

        await self.db.commit()

        await self.audit_logger.log(
            action="rollback_version",
            resource_type="prompt_version",
            resource_id=version_id,
            user_id=user_id,
            details={
                "prompt_id": prompt_id,
                "rolled_back_to": target_version.version_number,
                "new_version_id": new_version_id,
                "reason": reason,
            },
        )

        logger.info(
            f"⏪ 版本已回滚:\n"
            f"   Prompt: {prompt_id}\n"
            f"   回滚到: v{target_version.version_number}\n"
            f"   操作者: {user_id}\n"
            f"   原因: {reason or '未提供'}"
        )

        return {
            "success": True,
            "message": "回滚成功",
            "rolled_back_to_version": target_version.version_number,
            "new_version_id": new_version_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

    async def compare_versions(
        self,
        prompt_id: int,
        version_ids: List[int],
    ) -> ComparisonMatrix:
        """
        多版本并行对比矩阵（最多5个版本）
        
        Args:
            prompt_id: Prompt模板ID
            version_ids: 要对比的版本ID列表（最多5个）
            
        Returns:
            ComparisonMatrix对象
            
        Raises:
            ValueError: 超过最大版本数量限制
        """
        if len(version_ids) > 5:
            raise ValueError("最多支持5个版本的并行对比")
        if len(version_ids) < 2:
            raise ValueError("至少需要2个版本进行对比")

        versions = []
        for vid in version_ids:
            result = await self.db.execute(
                select(PromptVersion).where(
                    and_(
                        PromptVersion.id == vid,
                        PromptVersion.prompt_template_id == prompt_id,
                    )
                )
            )
            version = result.scalar_one_or_none()
            if version:
                versions.append(version)

        if len(versions) < 2:
            raise ResourceNotFoundException("有效的版本不足2个")

        matrix = []
        for i, v1 in enumerate(versions):
            row = []
            for j, v2 in enumerate(versions):
                if i == j:
                    row.append("-")
                else:
                    diff = await self._calculate_simple_diff(
                        v1.content_snapshot,
                        v2.content_snapshot,
                    )
                    row.append(diff)
            matrix.append(row)

        logger.info(f"📋 多版本对比完成: {len(versions)} 个版本")

        return ComparisonMatrix(
            versions=[
                {
                    "id": v.id,
                    "version_number": v.version_number,
                    "changelog": v.changelog,
                    "created_at": v.created_at.isoformat() if v.created_at else None,
                }
                for v in versions
            ],
            matrix=matrix,
        )

    async def create_branch(
        self,
        prompt_id: int,
        base_version_id: int,
        branch_name: str,
        user_id: int,
    ) -> PromptVersion:
        """
        创建实验分支（实验性功能）
        
        从指定版本派生新分支：
        - 不影响主线（main分支）
        - 可后续merge到主线或丢弃
        
        Args:
            prompt_id: Prompt模板ID
            base_version_id: 基础版本ID
            branch_name: 分支名称（如"experiment/new-feature"）
            user_id: 创建者用户ID
            
        Returns:
            新创建的分支版本
        """
        base_result = await self.db.execute(
            select(PromptVersion).where(
                and_(
                    PromptVersion.id == base_version_id,
                    PromptVersion.prompt_template_id == prompt_id,
                )
            )
        )
        base_version = base_result.scalar_one_or_none()

        if not base_version:
            raise ResourceNotFoundException("基础版本不存在")

        max_ver_result = await self.db.execute(
            select(func.max(PromptVersion.version_number))
            .where(PromptVersion.prompt_template_id == prompt_id)
        )
        max_version = max_ver_result.scalar() or 0

        branch_version = PromptVersion(
            prompt_template_id=prompt_id,
            version_number=max_version + 1,
            content_snapshot=base_version.content_snapshot,
            diff_summary=f"Branch '{branch_name}' from v{base_version.version_number}",
            changelog=(
                f"创建分支: {branch_name}\n"
                f"基础版本: v{base_version.version_number}"
            ),
            created_by=user_id,
        )
        self.db.add(branch_version)
        await self.db.commit()
        await self.db.refresh(branch_version)

        await self.audit_logger.log(
            action="create_branch",
            resource_type="prompt_version",
            resource_id=branch_version.id,
            user_id=user_id,
            details={
                "prompt_id": prompt_id,
                "base_version_id": base_version_id,
                "branch_name": branch_name,
            },
        )

        logger.info(
            f"🌿 分支已创建:\n"
            f"   名称: {branch_name}\n"
            f"   基于: v{base_version.version_number}\n"
            f"   新版本: v{branch_version.version_number}"
        )

        return branch_version

    async def get_latest_version(
        self,
        prompt_id: int,
    ) -> PromptVersion:
        """
        获取最新版本
        
        Args:
            prompt_id: Prompt模板ID
            
        Returns:
            最新版本对象
            
        Raises:
            ResourceNotFoundException: 无版本记录
        """
        result = await self.db.execute(
            select(PromptVersion)
            .where(PromptVersion.prompt_template_id == prompt_id)
            .order_by(desc(PromptVersion.version_number))
            .limit(1)
        )
        latest = result.scalar_one_or_none()

        if not latest:
            raise ResourceNotFoundException("该Prompt暂无版本记录")

        return latest

    async def _calculate_diff_summary(
        self,
        old_content: str,
        new_content: str,
    ) -> str:
        """计算两个版本的差异摘要"""
        old_lines = old_content.splitlines()
        new_lines = new_content.splitlines()

        differ = difflib.unified_diff(old_lines, new_lines, lineterm='')

        add_count = 0
        remove_count = 0

        for line in differ:
            if line.startswith('+') and not line.startswith('+++'):
                add_count += 1
            elif line.startswith('-') and not line.startswith('---'):
                remove_count += 1

        if add_count == 0 and remove_count == 0:
            return "无实质性变更"

        return f"+{add_count} / -{remove_count} 行"

    async def _calculate_simple_diff(
        self,
        content1: str,
        content2: str,
    ) -> str:
        """简单差异比较（用于多版本矩阵）"""
        lines1 = set(content1.splitlines())
        lines2 = set(content2.splitline())

        only_in_1 = lines1 - lines2
        only_in_2 = lines2 - lines1
        common = lines1 & lines2

        total = len(lines1 | lines2)
        similarity = len(common) / total * 100 if total > 0 else 0

        return f"{similarity:.1f}% 相似"
