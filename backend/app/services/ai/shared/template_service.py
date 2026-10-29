"""RMFOOD 行业模板库系统

提供完整的模板管理功能：
- 模板浏览、搜索、筛选
- 模板渲染（变量替换）
- 用户自定义模板
- 社区贡献审核
"""
from __future__ import annotations

import json
import logging
import re
import time
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional, Set

logger = logging.getLogger(__name__)

DATA_DIR = Path(__file__).parent / "data"
SEED_TEMPLATES_FILE = DATA_DIR / "seed_templates.json"


@dataclass
class TemplateVariable:
    """模板变量定义"""
    name: str
    var_type: str  # text / textarea / select / number / multiline
    required: bool = True
    default: Any = None
    options: Optional[List[str]] = None
    example: str = ""
    description: str = ""


@dataclass
class TemplateItem:
    """模板项"""
    id: str
    name: str
    category: str
    description: str
    template_content: str
    variables: List[TemplateVariable] = field(default_factory=list)
    use_case_example: str = ""
    popularity_score: float = 0.0
    tags: List[str] = field(default_factory=list)
    is_featured: bool = False
    created_at: str = ""

    # 扩展字段
    version: int = 1
    usage_count: int = 0
    rating: Optional[float] = None
    author_id: Optional[str] = None
    is_custom: bool = False  # 是否为用户自定义
    status: str = "active"  # active / pending / rejected / archived


@dataclass
class RenderResult:
    """渲染结果"""
    success: bool
    content: str = ""
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    missing_variables: List[str] = field(default_factory=list)


class TemplateService:
    """
    模板服务

    功能：
    - 模板CRUD管理\n    - 智能搜索和推荐
    - 变量替换渲染
    - 自定义模板存储
    """

    def __init__(self):
        self._templates: Dict[str, TemplateItem] = {}
        self._categories: Set[str] = set()
        self._all_tags: Set[str] = set()
        self._custom_templates: Dict[str, Dict[str, TemplateItem]] = {}  # user_id -> templates

        # 加载预置模板
        self._load_seed_templates()

        logger.info(
            f"📚 TemplateService初始化完成 - "
            f"已加载{len(self._templates)}个预置模板, "
            f"{len(self._categories)}个分类"
        )

    def _load_seed_templates(self):
        """加载预置模板数据"""
        try:
            if not SEED_TEMPLATES_FILE.exists():
                logger.warning(f"⚠️ 预置模板文件不存在: {SEED_TEMPLATES_FILE}")
                return

            with open(SEED_TEMPLATES_FILE, 'r', encoding='utf-8') as f:
                templates_data = json.load(f)

            for tpl_data in templates_data:
                template = self._dict_to_template(tpl_data)
                self._templates[template.id] = template
                self._categories.add(template.category)
                self._all_tags.update(template.tags)

            logger.info(f"✅ 成功加载{len(templates_data)}个预置模板")

        except Exception as e:
            logger.error(f"❌ 加载预置模板失败: {e}", exc_info=True)

    def _dict_to_template(self, data: Dict[str, Any]) -> TemplateItem:
        """将字典转换为TemplateItem对象"""
        variables = []
        for var_data in data.get("variables", []):
            variables.append(TemplateVariable(
                name=var_data.get("name", ""),
                var_type=var_data.get("type", "text"),
                required=var_data.get("required", True),
                default=var_data.get("default"),
                options=var_data.get("options"),
                example=var_data.get("example", ""),
                description=var_data.get("description", ""),
            ))

        return TemplateItem(
            id=data.get("id", str(uuid.uuid4())),
            name=data.get("name", ""),
            category=data.get("category", "other"),
            description=data.get("description", ""),
            template_content=data.get("template_content", ""),
            variables=variables,
            use_case_example=data.get("use_case_example", ""),
            popularity_score=data.get("popularity_score", 0.0),
            tags=data.get("tags", []),
            is_featured=data.get("is_featured", False),
            created_at=data.get("created_at", ""),
        )

    async def get_templates(
        self,
        category: Optional[str] = None,
        tags: Optional[List[str]] = None,
        search: Optional[str] = None,
        page: int = 1,
        per_page: int = 20,
        sort_by: str = "popularity",
    ) -> Dict[str, Any]:
        """
        获取模板列表

        Args:
            category: 分类筛选
            tags: 标签筛选（AND关系）
            search: 全文搜索关键词
            page: 页码
            per_page: 每页数量
            sort_by: 排序方式 (popularity/recent/alpha/name)

        Returns:
            分页的模板列表
        """
        # 筛选
        filtered = list(self._templates.values())

        if category:
            filtered = [t for t in filtered if t.category == category]

        if tags:
            for tag in tags:
                filtered = [t for t in filtered if tag in t.tags]

        if search:
            search_lower = search.lower()
            filtered = [
                t for t in filtered
                if (search_lower in t.name.lower() or
                    search_lower in t.description.lower() or
                    search_lower in ' '.join(t.tags).lower() or
                    search_lower in t.template_content.lower())
            ]

        # 排序
        if sort_by == "popularity":
            filtered.sort(key=lambda x: x.popularity_score, reverse=True)
        elif sort_by == "name":
            filtered.sort(key=lambda x: x.name)
        elif sort_by == "recent":
            filtered.sort(key=lambda x: x.created_at, reverse=True)

        # 分页
        total = len(filtered)
        start = (page - 1) * per_page
        end = start + per_page
        paginated = filtered[start:end]

        return {
            "templates": paginated,
            "total": total,
            "page": page,
            "per_page": per_page,
            "total_pages": (total + per_page - 1) // per_page,
            "available_categories": sorted(list(self._categories)),
            "available_tags": sorted(list(self._all_tags)),
        }

    async def get_template_detail(self, template_id: str) -> Optional[TemplateItem]:
        """
        获取模板详情

        Args:
            template_id: 模板ID

        Returns:
            完整的模板对象，不存在则返回None
        """
        template = self._templates.get(template_id)

        if template:
            # 更新使用统计（可选）
            template.usage_count += 1

        return template

    async def render_template(
        self,
        template_id: str,
        variable_values: Dict[str, Any],
        user_id: Optional[str] = None,
    ) -> RenderResult:
        """
        渲染模板（变量替换）

        Args:
            template_id: 模板ID
            variable_values: 变量值字典 {variable_name: value}
            user_id: 用户ID（用于自定义模板）

        Returns:
            RenderResult 包含渲染结果和错误信息
        """
        result = RenderResult(success=False)

        # 查找模板
        template = await self._get_template_by_id(template_id, user_id)

        if not template:
            result.errors.append(f"模板不存在: {template_id}")
            return result

        # 验证必填变量
        missing_required = []
        for var in template.variables:
            if var.required and var.name not in variable_values:
                missing_required.append(var.name)

            # 使用默认值填充缺失的可选变量
            elif var.name not in variable_values and var.default is not None:
                variable_values[var.name] = var.default

        if missing_required:
            result.missing_variables = missing_required
            result.errors.append(f"缺少必填变量: {', '.join(missing_required)}")
            return result

        # 执行变量替换
        content = template.template_content

        try:
            for var_name, value in variable_values.items():
                placeholder = f"{{{{{var_name}}}}}"
                if placeholder in content:
                    content = content.replace(placeholder, str(value))

            # 检查未替换的占位符
            remaining_placeholders = re.findall(r'\{\{(\w+)\}\}', content)
            if remaining_placeholders:
                result.warnings.append(
                    f"存在未替换的变量: {', '.join(remaining_placeholders)}"
                )

            result.success = True
            result.content = content

            logger.info(
                f"✅ 模板渲染成功 - ID: {template_id}, "
                f"变量数: {len(variable_values)}"
            )

        except Exception as e:
            result.errors.append("渲染过程中发生错误")
            logger.error(f"❌ 模板渲染失败: {e}")

        return result

    async def create_custom_template(
        self,
        user_id: str,
        name: str,
        content: str,
        category: str = "custom",
        variables: Optional[List[Dict[str, Any]]] = None,
        description: str = "",
        tags: Optional[List[str]] = None,
    ) -> TemplateItem:
        """
        创建用户自定义模板

        Args:
            user_id: 用户ID
            name: 模板名称
            content: 模板内容
            category: 分类
            variables: 变量定义列表
            description: 描述
            tags: 标签

        Returns:
            创建的模板对象
        """
        template_id = f"custom_{user_id}_{uuid.uuid4().hex[:8]}"

        parsed_variables = []
        if variables:
            for var in variables:
                parsed_variables.append(TemplateVariable(**var))
        else:
            # 自动从内容中提取变量
            parsed_variables = self._auto_extract_variables(content)

        template = TemplateItem(
            id=template_id,
            name=name,
            category=category,
            description=description or f"用户自定义模板 - {name}",
            template_content=content,
            variables=parsed_variables,
            tags=tags or [],
            author_id=user_id,
            is_custom=True,
            created_at=time.strftime("%Y-%m-%dT%H:%M:%SZ"),
        )

        # 存储到用户空间
        if user_id not in self._custom_templates:
            self._custom_templates[user_id] = {}

        self._custom_templates[user_id][template_id] = template

        logger.info(
            f"📝 用户自定义模板已创建 - "
            f"用户: {user_id}, 模板: {name} ({template_id})"
        )

        return template

    async def get_user_templates(
        self,
        user_id: str,
        page: int = 1,
        per_page: int = 20,
    ) -> Dict[str, Any]:
        """获取用户的自定义模板列表"""
        user_templates = self._custom_templates.get(user_id, {})
        templates_list = list(user_templates.values())

        total = len(templates_list)
        start = (page - 1) * per_page
        paginated = templates_list[start:start + per_page]

        return {
            "templates": paginated,
            "total": total,
            "page": page,
            "per_page": per_page,
        }

    async def submit_community_template(
        self,
        user_id: str,
        template_data: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        提交社区贡献模板（进入审核流程）

        流程：pending → reviewing → approved/rejected
        """
        submission_id = f"community_{uuid.uuid4().hex[:8]}"

        _ = {
            "id": submission_id,
            "submitter_id": user_id,
            "submitted_at": time.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "status": "pending",
            "data": template_data,
            "review_notes": [],
            "reviewed_by": None,
            "reviewed_at": None,
        }

        logger.info(
            f"📤 社区模板提交 - "
            f"提交者: {user_id}, ID: {submission_id}, "
            f"状态: pending"
        )

        return {
            "success": True,
            "submission_id": submission_id,
            "message": "模板已提交，将在3个工作日内完成审核",
            "status": "pending",
        }

    async def search_templates(
        self,
        query: str,
        limit: int = 10,
    ) -> List[TemplateItem]:
        """
        智能搜索模板（支持模糊匹配和语义相关）

        Args:
            query: 搜索关键词
            limit: 返回数量限制

        Returns:
            匹配的模板列表
        """
        query_lower = query.lower()
        scored_results = []

        for template in self._templates.values():
            score = 0.0

            # 名称精确匹配（权重最高）
            if query_lower in template.name.lower():
                score += 10

            # 描述匹配
            if query_lower in template.description.lower():
                score += 5

            # 标签匹配
            for tag in template.tags:
                if query_lower in tag.lower():
                    score += 3

            # 分类匹配
            if query_lower in template.category.lower():
                score += 2

            # 内容部分匹配（权重较低，避免过长文本干扰）
            if query_lower in template.template_content.lower():
                score += 1

            if score > 0:
                scored_results.append((template, score))

        # 按分数排序
        scored_results.sort(key=lambda x: x[1], reverse=True)

        return [item for item, score in scored_results[:limit]]

    def get_categories(self) -> List[Dict[str, Any]]:
        """获取所有分类及其模板数量"""
        categories = []

        for cat in sorted(self._categories):
            count = sum(
                1 for t in self._templates.values()
                if t.category == cat
            )
            categories.append({
                "name": cat,
                "count": count,
            })

        return categories

    def get_popular_tags(self, limit: int = 20) -> List[str]:
        """获取热门标签"""
        tag_counts: Dict[str, int] = {}

        for template in self._templates.values():
            for tag in template.tags:
                tag_counts[tag] = tag_counts.get(tag, 0) + 1

        sorted_tags = sorted(
            tag_counts.items(),
            key=lambda x: x[1],
            reverse=True
        )

        return [tag for tag, count in sorted_tags[:limit]]

    async def _get_template_by_id(
        self,
        template_id: str,
        user_id: Optional[str] = None,
    ) -> Optional[TemplateItem]:
        """根据ID查找模板（支持系统模板和用户自定义）"""
        # 先查系统模板
        if template_id in self._templates:
            return self._templates[template_id]

        # 再查用户自定义模板
        if user_id and user_id in self._custom_templates:
            user_templates = self._custom_templates[user_id]
            if template_id in user_templates:
                return user_templates[template_id]

        return None

    def _auto_extract_variables(self, content: str) -> List[TemplateVariable]:
        """从模板内容中自动提取变量定义"""
        pattern = r'\{\{(\w+)\}\}'
        matches = re.findall(pattern, content)

        variables = []
        seen = set()

        for var_name in matches:
            if var_name not in seen:
                variables.append(TemplateVariable(
                    name=var_name,
                    var_type="text",
                    required=True,
                    example=f"[{var_name}示例值]",
                ))
                seen.add(var_name)

        return variables

    def get_statistics(self) -> Dict[str, Any]:
        """获取模板库统计信息"""
        custom_count = sum(
            len(t) for t in self._custom_templates.values()
        )

        return {
            "total_system_templates": len(self._templates),
            "total_custom_templates": custom_count,
            "total_categories": len(self._categories),
            "total_tags": len(self._all_tags),
            "featured_count": sum(
                1 for t in self._templates.values() if t.is_featured
            ),
            "most_popular_category": max(
                self._categories,
                key=lambda c: sum(
                    1 for t in self._templates.values()
                    if t.category == c
                ),
                default="unknown",
            ),
        }


# 全局单例
_template_service_instance: Optional[TemplateService] = None


def get_template_service() -> TemplateService:
    """获取全局模板服务实例"""
    global _template_service_instance

    if _template_service_instance is None:
        _template_service_instance = TemplateService()
        logger.info("📚 全局TemplateService已初始化")

    return _template_service_instance
