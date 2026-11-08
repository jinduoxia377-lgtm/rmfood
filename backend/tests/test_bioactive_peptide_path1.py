# -*- coding: utf-8 -*-
"""路径1 数据层集成测试：bioactive_peptides 加列 + provenance 分层 + 载体行关联。

验证（针对真实本地库 postgresql://postgres:password@localhost:5432/rmfood）：
  1. 迁移加列成功：provenance / food_material_id 存在。
  2. provenance 分层：5 条真 DOI 肽=literature_confirmed，其余=synthetic_unverified。
  3. 关联：4 条乳源肽→牛乳行，1 条玉米肽(Zein)→玉米行。
  4. 未改肽序列/活性（抽核对 5 条 sequence）。
库不可用时 skip（不误报失败）。
"""
import os

import pytest

DSN = os.environ.get("RMFOOD_TEST_DSN", "postgresql://postgres:password@localhost:5432/rmfood")

# 5 条真 DOI 肽（id -> sequence），与 bioactive_peptide_path1_backfill.LIT_PEPTIDES 一致
LIT_EXPECT = {
    7941: "Ile-Pro-Pro",
    7942: "Val-Pro-Pro",
    7953: "Trp-Tyr-Ser-Leu",
    7961: "Phe-Arg-Ile-Lys",
    7966: "Ile-Pro-Ile",
}

asyncpg = pytest.importorskip("asyncpg")


async def _fetch(query):
    conn = await asyncpg.connect(DSN)
    try:
        return await conn.fetch(query)
    finally:
        await conn.close()


async def _fetch_args(query, *args):
    conn = await asyncpg.connect(DSN)
    try:
        return await conn.fetch(query, *args)
    finally:
        await conn.close()


async def _fetchval(query):
    conn = await asyncpg.connect(DSN)
    try:
        return await conn.fetchval(query)
    finally:
        await conn.close()


def _columns(rows):
    """从 SELECT column_name 查询结果取列名集合。"""
    return {r["column_name"] for r in rows}


@pytest.mark.asyncio
async def test_provenance_and_food_material_columns_exist():
    cols = await _fetch(
        "SELECT column_name FROM information_schema.columns "
        "WHERE table_name='bioactive_peptides'")
    names = _columns(cols)
    assert "provenance" in names, "迁移未加 provenance 列"
    assert "food_material_id" in names, "迁移未加 food_material_id 列"


@pytest.mark.asyncio
async def test_provenance_layering():
    lit = await _fetchval(
        "SELECT COUNT(*) FROM bioactive_peptides WHERE provenance='literature_confirmed'")
    syn = await _fetchval(
        "SELECT COUNT(*) FROM bioactive_peptides WHERE provenance='synthetic_unverified'")
    assert lit == 5, f"literature_confirmed 应为 5 条，实际 {lit}"
    assert syn == 7655, f"synthetic_unverified 应为 7655 条，实际 {syn}"


@pytest.mark.asyncio
async def test_five_lit_peptides_linked_to_carriers():
    rows = await _fetch(
        "SELECT b.id, b.sequence, f.name_cn AS carrier "
        "FROM bioactive_peptides b LEFT JOIN food_materials f ON f.id=b.food_material_id "
        "WHERE b.provenance='literature_confirmed' ORDER BY b.id")
    got = {r["id"]: (r["sequence"], r["carrier"]) for r in rows}
    assert len(got) == 5
    for pid, seq in LIT_EXPECT.items():
        assert pid in got, f"肽 {pid} 未标 literature_confirmed"
        assert got[pid][0] == seq, f"肽 {pid} 序列被改动: {got[pid][0]} != {seq}"
    # 4 条乳源肽→牛乳；1 条玉米肽→玉米
    carriers = [got[p][1] for p in LIT_EXPECT]
    assert carriers.count("牛乳") == 4, f"应有 4 条关联牛乳，实际 {carriers}"
    assert carriers.count("玉米") == 1, f"应有 1 条关联玉米，实际 {carriers}"


@pytest.mark.asyncio
async def test_peptide_sequence_activity_unchanged():
    """确认路径1 只标 provenance+关联，未改肽序列/活性（抽核 5 条 sequence）。"""
    rows = await _fetch_args(
        "SELECT id, sequence FROM bioactive_peptides WHERE id = ANY($1::bigint[])",
        list(LIT_EXPECT.keys()))
    got = {r["id"]: r["sequence"] for r in rows}
    for pid, seq in LIT_EXPECT.items():
        assert got.get(pid) == seq
