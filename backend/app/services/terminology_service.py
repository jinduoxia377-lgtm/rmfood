"""专业术语服务 (Async版本)
提供术语验证、纠错、标准化等核心功能
"""
import difflib
import logging
import re
from collections import defaultdict
from typing import Dict, List, Optional, Tuple

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.terminology import (
    Term,
    TermCategory,
    TermNormalizationRule,
    TermValidation,
    TermVariant,
)
from app.schemas.terminology import TermCategoryOut, TermOut, TermValidationResponse

logger = logging.getLogger(__name__)


class TerminologyService:
    """术语服务主类"""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.normalization_rules: List[TermNormalizationRule] = []
        self.term_index: Dict[str, Term] = {}
        self.term_names: List[str] = []
        self.category_index: defaultdict = defaultdict(list)
        # 延迟加载索引
        self._indexed = False

    async def _ensure_indexed(self):
        """确保索引已构建"""
        if self._indexed:
            return
        await self._load_normalization_rules()
        await self._build_term_index()
        self._indexed = True

    async def _load_normalization_rules(self):
        """加载标准化规则"""
        result = await self.db.execute(
            select(TermNormalizationRule).where(TermNormalizationRule.enabled.is_(True))
        )
        rules = result.scalars().all()
        self.normalization_rules = sorted(rules, key=lambda r: r.priority)

    async def _build_term_index(self):
        """构建术语索引用于快速搜索"""
        result = await self.db.execute(select(Term))
        terms = result.scalars().all()
        self.term_index = {t.term.lower(): t for t in terms}
        self.term_names = [t.term.lower() for t in terms]
        self.category_index = defaultdict(list)
        for term in terms:
            self.category_index[term.category_id].append(term)
        self._indexed = True

    def normalize_term(self, term: str) -> str:
        """术语标准化预处理"""
        if not term:
            return term

        # 1. 去除首尾空格
        result = term.strip()

        # 2. 去除特殊字符和多余空格
        result = re.sub(r'\s+', '', result)

        # 3. 应用标准化规则
        for rule in self.normalization_rules:
            if rule.rule_type == "regex":
                result = re.sub(rule.pattern, rule.replacement, result)
            elif rule.rule_type == "exact":
                if result == rule.pattern:
                    result = rule.replacement

        # 4. 转换为小写（用于匹配）
        return result.lower()

    async def validate_term(self, input_term: str, category_id: Optional[int] = None,
                            strict_mode: bool = False) -> TermValidationResponse:
        """验证术语并返回纠错建议"""
        await self._ensure_indexed()
        normalized_input = self.normalize_term(input_term)

        if not normalized_input:
            return TermValidationResponse(
                input_term=input_term,
                is_valid=False,
                confidence=0.0,
                correction_needed=True
            )

        # 1. 精确匹配
        if normalized_input in self.term_index:
            term = self.term_index[normalized_input]
            if category_id and term.category_id != category_id:
                pass
            else:
                await self._record_validation(input_term, term.id, True, 1.0)
                return TermValidationResponse(
                    input_term=input_term,
                    is_valid=True,
                    confidence=1.0,
                    matched_term=self._term_to_out(term)
                )

        # 2. 搜索变体（同义词、拼写错误等）
        variant_match = await self._search_variants(normalized_input, category_id)
        if variant_match:
            term, confidence = variant_match
            await self._record_validation(input_term, term.id, True, confidence)
            return TermValidationResponse(
                input_term=input_term,
                is_valid=True,
                confidence=confidence,
                matched_term=self._term_to_out(term),
                correction_needed=confidence < 1.0
            )

        # 3. 模糊匹配
        suggestions = await self._fuzzy_search(normalized_input, category_id, limit=5)

        if suggestions:
            best_suggestion = suggestions[0]
            if not strict_mode and best_suggestion['confidence'] >= 0.8:
                term = await self._get_term_by_id(best_suggestion['term_id'])
                if term:
                    await self._record_validation(input_term, term.id, True, best_suggestion['confidence'])
                    return TermValidationResponse(
                        input_term=input_term,
                        is_valid=True,
                        confidence=best_suggestion['confidence'],
                        matched_term=self._term_to_out(term),
                        suggested_term=term.term,
                        correction_needed=True,
                        alternatives=suggestions[1:]
                    )
            else:
                await self._record_validation(input_term, None, False, 0.0)
                return TermValidationResponse(
                    input_term=input_term,
                    is_valid=False,
                    confidence=0.0,
                    suggested_term=suggestions[0]['term'] if suggestions else None,
                    correction_needed=True,
                    alternatives=suggestions
                )

        # 4. 完全不匹配
        await self._record_validation(input_term, None, False, 0.0)
        return TermValidationResponse(
            input_term=input_term,
            is_valid=False,
            confidence=0.0,
            correction_needed=True
        )

    async def batch_validate_terms(self, terms: List[str], category_id: Optional[int] = None,
                                   strict_mode: bool = False) -> List[TermValidationResponse]:
        """批量验证术语"""
        results = []
        for term in terms:
            result = await self.validate_term(term, category_id, strict_mode)
            results.append(result)
        return results

    async def _search_variants(self, term: str, category_id: Optional[int]) -> Optional[Tuple[Term, float]]:
        """搜索术语变体"""
        result = await self.db.execute(select(TermVariant).where(TermVariant.variant == term))
        variants = result.scalars().all()

        for variant in variants:
            term_obj = await self._get_term_by_id(variant.term_id)
            if term_obj:
                if not category_id or term_obj.category_id == category_id:
                    return term_obj, variant.similarity
        return None

    async def _fuzzy_search(self, term: str, category_id: Optional[int], limit: int = 5) -> List[Dict]:
        """模糊搜索术语"""
        await self._ensure_indexed()
        candidates = []

        if category_id and category_id in self.category_index:
            term_list = self.category_index[category_id]
        else:
            term_list = list(self.term_index.values())

        for t in term_list:
            normalized_term = self.normalize_term(t.term)
            if normalized_term:
                similarity = self._calculate_similarity(term, normalized_term)
                if similarity >= 0.6:
                    candidates.append({
                        'term_id': t.id,
                        'term': t.term,
                        'confidence': similarity,
                        'category_id': t.category_id
                    })

        candidates.sort(key=lambda x: -x['confidence'])
        return candidates[:limit]

    def _calculate_similarity(self, str1: str, str2: str) -> float:
        """计算两个字符串的相似度"""
        ratio = difflib.SequenceMatcher(None, str1, str2).ratio()

        # 如果一个是另一个的子串，提高相似度
        if str1 in str2 or str2 in str1:
            ratio = min(1.0, ratio * 1.2)

        return ratio

    async def _record_validation(self, input_term: str, term_id: Optional[int],
                                 is_valid: bool, confidence: float):
        """记录验证结果"""
        validation = TermValidation(
            input_term=input_term,
            matched_term_id=term_id,
            is_valid=is_valid,
            confidence=confidence,
            correction_needed=not is_valid or confidence < 1.0
        )
        self.db.add(validation)
        await self.db.commit()

        # 更新术语使用频率
        if term_id:
            term = await self._get_term_by_id(term_id)
            if term:
                term.frequency = (term.frequency or 0) + 1
                await self.db.commit()

    async def _get_term_by_id(self, term_id: int) -> Optional[Term]:
        """根据ID获取术语"""
        result = await self.db.execute(select(Term).where(Term.id == term_id))
        return result.scalar_one_or_none()

    async def _term_to_out(self, term: Term) -> TermOut:
        """转换为输出格式"""
        result = await self.db.execute(select(TermCategory).where(TermCategory.id == term.category_id))
        category = result.scalar_one_or_none()
        return TermOut(
            id=term.id,
            term=term.term,
            term_en=term.term_en,
            pinyin=term.pinyin,
            pinyin_abbr=term.pinyin_abbr,
            abbreviation=term.abbreviation,
            definition=term.definition,
            definition_en=term.definition_en,
            category_id=term.category_id,
            category_name=category.name if category else None,
            subcategory=term.subcategory,
            unit=term.unit,
            examples=term.examples,
            synonyms=term.synonyms,
            related_terms=term.related_terms,
            source=term.source,
            is_standard=term.is_standard,
            confidence=term.confidence,
            frequency=term.frequency,
            created_at=term.created_at,
            updated_at=term.updated_at
        )

    async def get_term(self, term_id: int) -> Optional[TermOut]:
        """获取单个术语"""
        term = await self._get_term_by_id(term_id)
        if term:
            return await self._term_to_out(term)
        return None

    async def search_terms(self, query: str, category_id: Optional[int] = None,
                           fuzzy_search: bool = True, max_results: int = 10) -> List[TermOut]:
        """搜索术语"""
        await self._ensure_indexed()
        query_normalized = self.normalize_term(query)

        if not query_normalized:
            return []

        if fuzzy_search:
            suggestions = await self._fuzzy_search(query_normalized, category_id, max_results)
            results = []
            for s in suggestions:
                term = await self._get_term_by_id(s['term_id'])
                if term:
                    results.append(await self._term_to_out(term))
            return results
        else:
            stmt = select(Term)
            if category_id:
                stmt = stmt.where(Term.category_id == category_id)

            stmt = stmt.where(
                or_(
                    Term.term.ilike(f"%{query_normalized}%"),
                    Term.term_en.ilike(f"%{query_normalized}%"),
                    Term.pinyin.ilike(f"%{query_normalized}%")
                )
            ).limit(max_results)
            result = await self.db.execute(stmt)
            terms = result.scalars().all()

            return [await self._term_to_out(t) for t in terms]

    async def get_categories(self) -> List[TermCategoryOut]:
        """获取所有分类"""
        result = await self.db.execute(select(TermCategory).order_by(TermCategory.sort_order))
        categories = result.scalars().all()
        return [TermCategoryOut.from_orm(c) for c in categories]

    async def get_category_by_id(self, category_id: int) -> Optional[TermCategoryOut]:
        """根据ID获取分类"""
        result = await self.db.execute(select(TermCategory).where(TermCategory.id == category_id))
        category = result.scalar_one_or_none()
        if category:
            return TermCategoryOut.from_orm(category)
        return None

    async def suggest_terms(self, input_term: str, limit: int = 5,
                            include_synonyms: bool = True) -> List[Dict]:
        """获取术语建议"""
        await self._ensure_indexed()
        normalized_input = self.normalize_term(input_term)

        if not normalized_input:
            return []

        # 获取模糊匹配结果
        suggestions = await self._fuzzy_search(normalized_input, None, limit)

        # 如果包含同义词，添加更多建议
        if include_synonyms and suggestions:
            for suggestion in suggestions:
                term = await self._get_term_by_id(suggestion['term_id'])
                if term and term.synonyms:
                    for synonym in term.synonyms[:3]:
                        if synonym.lower() != normalized_input:
                            suggestions.append({
                                'term': synonym,
                                'confidence': suggestion['confidence'] * 0.8,
                                'is_synonym': True
                            })

        # 去重并排序
        seen = set()
        unique_suggestions = []
        for s in suggestions:
            key = s['term'] if isinstance(s, dict) else s
            if key not in seen:
                seen.add(key)
                unique_suggestions.append(s)

        unique_suggestions.sort(key=lambda x: -x['confidence'])
        return unique_suggestions[:limit]

    async def add_term_variant(self, term_id: int, variant: str,
                               similarity: float = 0.8, variant_type: str = "synonym"):
        """添加术语变体"""
        result = await self.db.execute(select(TermVariant).where(TermVariant.variant == variant))
        existing = result.scalar_one_or_none()
        if existing:
            existing.similarity = similarity
            existing.variant_type = variant_type
        else:
            new_variant = TermVariant(
                variant=variant,
                term_id=term_id,
                similarity=similarity,
                variant_type=variant_type
            )
            self.db.add(new_variant)
        await self.db.commit()
        self._indexed = False

    async def add_normalization_rule(self, pattern: str, replacement: str,
                                     rule_type: str = "regex", priority: int = 100,
                                     description: Optional[str] = None):
        """添加标准化规则"""
        rule = TermNormalizationRule(
            pattern=pattern,
            replacement=replacement,
            rule_type=rule_type,
            priority=priority,
            description=description,
            enabled=True
        )
        self.db.add(rule)
        await self.db.commit()
        self._indexed = False

    async def update_statistics(self):
        """更新统计信息"""
        from app.models.terminology import TermStatistics
        result = await self.db.execute(select(TermCategory))
        categories = result.scalars().all()

        for category in categories:
            result = await self.db.execute(
                select(func.count()).where(Term.category_id == category.id).select_from(Term)
            )
            term_count = result.scalar()
            result = await self.db.execute(
                select(func.count()).select_from(TermValidation)
            )
            validation_count = result.scalar()
            result = await self.db.execute(
                select(func.count()).where(TermValidation.correction_needed.is_(True)).select_from(TermValidation)
            )
            correction_count = result.scalar()

            result = await self.db.execute(
                select(TermStatistics).where(TermStatistics.category_id == category.id)
            )
            stats = result.scalar_one_or_none()

            if stats:
                stats.total_terms = term_count
                stats.validation_count = validation_count
                stats.correction_count = correction_count
                stats.accuracy_rate = (validation_count - correction_count) / max(validation_count, 1)
            else:
                stats = TermStatistics(
                    category_id=category.id,
                    total_terms=term_count,
                    validation_count=validation_count,
                    correction_count=correction_count,
                    accuracy_rate=(validation_count - correction_count) / max(validation_count, 1)
                )
                self.db.add(stats)

        await self.db.commit()
