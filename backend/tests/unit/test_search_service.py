"""app/infrastructure/search_service.py 单元测试

覆盖搜索模型与 InMemoryIndexService（开发/测试用降级方案）。
"""

from app.infrastructure.search_service import (
    IndexType,
    SearchHit,
    SearchResult,
    SuggestionResult,
    InMemoryIndexService,
)


class TestModels:
    def test_index_type_values(self):
        assert IndexType.FORMULAS.value == "formulas"
        assert IndexType.HERBS.value == "herbs"
        assert IndexType.PEPTIDES.value == "peptides"

    def test_search_hit_to_dict(self):
        hit = SearchHit(id="f1", index_type=IndexType.FORMULAS, title="养气方", description="补气")
        d = hit.to_dict()
        assert d["id"] == "f1"
        assert d["title"] == "养气方"

    def test_search_result_to_dict(self):
        result = SearchResult(hits=[], total=0, took_ms=1.0, query="q", index_types=[IndexType.FORMULAS])
        d = result.to_dict()
        assert d["total"] == 0
        assert d["query"] == "q"

    def test_suggestion_result_to_dict(self):
        s = SuggestionResult(text="养气方", index_type=IndexType.FORMULAS)
        d = s.to_dict()
        assert d["text"] == "养气方"


class TestInMemoryIndexService:
    async def test_index_and_search(self):
        svc = InMemoryIndexService()
        await svc.index_document(IndexType.FORMULAS, "f1", {"title": "养气配方", "description": "补气"})
        result = await svc.search("补气", index_types=[IndexType.FORMULAS])
        assert result.total == 1
        assert result.hits[0].id == "f1"

    async def test_bulk_index(self):
        svc = InMemoryIndexService()
        n = await svc.bulk_index(
            IndexType.FORMULAS,
            [{"id": "a", "title": "A"}, {"id": "b", "title": "B"}],
        )
        assert n == 2

    async def test_search_filter(self):
        svc = InMemoryIndexService()
        await svc.index_document(IndexType.FORMULAS, "f1", {"title": "A", "status": "draft"})
        await svc.index_document(IndexType.FORMULAS, "f2", {"title": "B", "status": "published"})
        result = await svc.search("", index_types=[IndexType.FORMULAS], filters={"status": "draft"})
        assert result.total == 1
        assert result.hits[0].id == "f1"

    async def test_search_pagination(self):
        svc = InMemoryIndexService()
        await svc.bulk_index(IndexType.FORMULAS, [{"id": f"f{i}", "title": f"配方{i}"} for i in range(5)])
        result = await svc.search("配方", index_types=[IndexType.FORMULAS], page=1, page_size=2)
        assert result.total == 5
        assert len(result.hits) == 2

    async def test_suggest(self):
        svc = InMemoryIndexService()
        await svc.index_document(IndexType.FORMULAS, "f1", {"title": "养气配方"})
        suggestions = await svc.suggest("养气", index_type=IndexType.FORMULAS)
        assert len(suggestions) >= 1
        assert suggestions[0].text == "养气配方"

    async def test_delete_document(self):
        svc = InMemoryIndexService()
        await svc.index_document(IndexType.FORMULAS, "f1", {"title": "A"})
        assert await svc.delete_document(IndexType.FORMULAS, "f1") is True
        assert await svc.delete_document(IndexType.FORMULAS, "f1") is False

    async def test_create_and_delete_indices(self):
        svc = InMemoryIndexService()
        assert await svc.create_indices() == len(list(IndexType))
        await svc.index_document(IndexType.FORMULAS, "f1", {"title": "A"})
        deleted = await svc.delete_indices()
        assert deleted >= 1

    async def test_stats(self):
        svc = InMemoryIndexService()
        await svc.index_document(IndexType.FORMULAS, "f1", {"title": "A"})
        stats = await svc.get_stats()
        assert stats["backend"] == "memory"
        assert stats["indices"]["formulas"]["document_count"] == 1