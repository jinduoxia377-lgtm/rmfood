# -*- coding: utf-8 -*-
"""食源肽扩量集成测试（批次 pep_b100w + 上批 pep_b100v + 既有）。

验证 seed_food_peptides_100plus.py --apply（扩量批次 pep_b100w）后真实库状态：
  1. 库内 literature_confirmed 总数 >=150（上批91 + 本批129 + 既有12）。
  2. 本批 pep_b100w 每条 DOI/evidence_note 非空（溯源硬守卫）。
  3. 品类覆盖：蛋清肽/乳清肽/牛骨胶原蛋白肽 已补齐（用户点名品类），各 >=1。
  4. 主题一致性：无主题错配论文肽（28212329海洋/39932945水母/41381711羊奶/34375367鲑鲤/41154909豆谷）残留。
  5. 关联正确：肽挂真实载体；牛骨载体存在。
  6. 既有数据未动（路径1的5 + 品类批次1的7 + 上批91）。
  7. 幂等：本批数 <= sidecar 数（重跑不新增）。
库不可用时 skip。
"""
import json
import os
from pathlib import Path

import pytest

DSN = os.environ.get("RMFOOD_TEST_DSN", "postgresql://postgres:password@localhost:5432/rmfood")
asyncpg = pytest.importorskip("asyncpg")
BATCH = "pep_b100w"
SIDECAR = Path(__file__).resolve().parents[1] / "scripts" / "food_peptides_expansion_b100w.json"
MISMATCH_PMIDS = ["28212329", "39932945", "41381711", "34375367", "41154909"]
EXISTING_IDS = [126, 127, 128, 129, 130, 131, 132, 7941, 7942, 7953, 7961, 7966]


async def _conn():
    return await asyncpg.connect(DSN)


def _sidecar_peptides():
    with open(SIDECAR, encoding="utf-8") as f:
        return json.load(f)["peptides"]


@pytest.mark.asyncio
async def test_expansion_total_confirmed_ge_150():
    conn = await _conn()
    try:
        n = await conn.fetchval("SELECT COUNT(*) FROM bioactive_peptides WHERE provenance='literature_confirmed'")
        assert n >= 150, f"literature_confirmed 总应 >=150，实际 {n}"
    finally:
        await conn.close()


@pytest.mark.asyncio
async def test_expansion_batch_has_source():
    conn = await _conn()
    try:
        rows = await conn.fetch(
            "SELECT sequence, literature_doi, evidence_note FROM bioactive_peptides WHERE source_version=$1", BATCH)
        assert len(rows) >= 100, f"扩量批次应 >=100，实际 {len(rows)}"
        for r in rows:
            assert r["literature_doi"] or r["evidence_note"], f"{r['sequence']} 无溯源"
    finally:
        await conn.close()


@pytest.mark.asyncio
async def test_named_categories_filled():
    """用户点名品类已补齐：蛋清肽/乳清肽/牛骨胶原蛋白肽 各 >=1。"""
    conn = await _conn()
    try:
        names = {"蛋清肽": 0, "乳清肽": 0, "牛骨胶原蛋白肽": 0}
        rows = await conn.fetch(
            "SELECT f.name_cn, COUNT(*) c FROM bioactive_peptides b JOIN food_materials f "
            "ON f.id=b.food_material_id WHERE b.source_version=$1 GROUP BY 1", BATCH)
        got = {r["name_cn"]: r["c"] for r in rows}
        for k in names:
            assert got.get(k, 0) >= 1, f"点名品类 {k} 未补齐（{got.get(k,0)}）"
    finally:
        await conn.close()


@pytest.mark.asyncio
async def test_no_topic_mismatch_residue():
    """主题错配论文肽残留=0（上批踩坑的 5 篇错配 PMID）。"""
    conn = await _conn()
    try:
        pats = " OR ".join(f"evidence_note LIKE '%{p}%'" for p in MISMATCH_PMIDS)
        n = await conn.fetchval(
            f"SELECT COUNT(*) FROM bioactive_peptides WHERE source_version IN ('pep_b100v','pep_b100w') "
            f"AND ({pats})")
        assert n == 0, f"主题错配残留 {n}"
    finally:
        await conn.close()


@pytest.mark.asyncio
async def test_bovine_bone_carrier_exists():
    conn = await _conn()
    try:
        bb = await conn.fetchrow("SELECT id FROM food_materials WHERE name_cn='牛骨胶原蛋白肽'")
        assert bb, "牛骨胶原蛋白肽 载体行应存在"
        n = await conn.fetchval(
            "SELECT COUNT(*) FROM bioactive_peptides WHERE food_material_id=$1 AND source_version=$2",
            bb["id"], BATCH)
        assert n >= 1, "牛骨载体应挂有肽"
    finally:
        await conn.close()


@pytest.mark.asyncio
async def test_existing_data_untouched():
    conn = await _conn()
    try:
        rows = await conn.fetch("SELECT id FROM bioactive_peptides WHERE id = ANY($1::int[])", EXISTING_IDS)
        assert {r["id"] for r in rows} == set(EXISTING_IDS), "既有 12 条应全部存在"
        # 上批 pep_b100v 仍为 91
        v = await conn.fetchval("SELECT COUNT(*) FROM bioactive_peptides WHERE source_version='pep_b100v'")
        assert v == 91, f"上批 pep_b100v 应仍 91，实际 {v}"
    finally:
        await conn.close()


@pytest.mark.asyncio
async def test_expansion_idempotent():
    conn = await _conn()
    try:
        n_db = await conn.fetchval("SELECT COUNT(*) FROM bioactive_peptides WHERE source_version=$1", BATCH)
        n_sc = len(_sidecar_peptides())
        assert n_db >= 100
        assert n_db <= n_sc, f"库内 {n_db} 不应超 sidecar {n_sc}"
    finally:
        await conn.close()
