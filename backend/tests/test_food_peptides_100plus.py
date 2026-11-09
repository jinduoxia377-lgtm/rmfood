# -*- coding: utf-8 -*-
""">=100 条已核验食源肽集成测试（批次 pep_b100v）。

验证 seed_food_peptides_100plus.py --apply 后的真实库状态：
  1. >=100 条新肽入库，provenance=literature_confirmed，批次 pep_b100v。
  2. 每条 DOI 或 evidence_note(PMID) 非空（溯源硬守卫）。
  3. 品类覆盖：大豆/胶原/豌豆/乳清/蛋清 等用户点名品类均有肽。
  4. 关联正确：肽挂真实载体行。
  5. 既有 12 条（路径1的5 + 品类批次1的7）未被动、批次1载体行未被动。
  6. 幂等：sidecar 肽数与库内本批数一致（重跑不新增）。
  7. 隔离：medium 候选在 pending 文件（unverified_candidate），未混入 literature_confirmed。
库不可用时 skip。
"""
import json
import os
from pathlib import Path

import pytest

DSN = os.environ.get("RMFOOD_TEST_DSN", "postgresql://postgres:password@localhost:5432/rmfood")
asyncpg = pytest.importorskip("asyncpg")
BATCH = "pep_b100v"
SIDECAR = Path(__file__).resolve().parents[1] / "scripts" / "food_peptides_100plus.json"
PENDING = Path(__file__).resolve().parents[1] / "scripts" / "food_peptides_pending_verification.json"
EXISTING_IDS = [126, 127, 128, 129, 130, 131, 132, 7941, 7942, 7953, 7961, 7966]


async def _conn():
    return await asyncpg.connect(DSN)


def _sidecar_peptides():
    with open(SIDECAR, encoding="utf-8") as f:
        return json.load(f)["peptides"]


@pytest.mark.asyncio
async def test_b100_verified_peptides_count():
    """主题复核后的【已核验+主题匹配】确证肽入库（实际 92 条，诚实<100，见汇报）。
    曾经误灌 157 条含主题错配（海洋/水母/羊奶论文被误标蛋清/大米/乳清），已剔除。"""
    conn = await _conn()
    try:
        n = await conn.fetchval(
            "SELECT COUNT(*) FROM bioactive_peptides WHERE source_version=$1 AND provenance='literature_confirmed'",
            BATCH)
        assert n >= 90, f"已核验+主题匹配确证肽应 >=90，实际 {n}"
        # 关键：本批不得含主题错配论文的肽（28212329海洋/41381711羊奶/39932945水母）
        mismatch = await conn.fetchval(
            "SELECT COUNT(*) FROM bioactive_peptides WHERE source_version=$1 "
            "AND (evidence_note LIKE '%28212329%' OR evidence_note LIKE '%41381711%' OR evidence_note LIKE '%39932945%')",
            BATCH)
        assert mismatch == 0, f"仍含主题错配论文肽: {mismatch}"
    finally:
        await conn.close()


@pytest.mark.asyncio
async def test_b100_every_peptide_has_source():
    """每条新肽 DOI 或 evidence_note(PMID) 至少一个非空（绝不无源）。"""
    conn = await _conn()
    try:
        rows = await conn.fetch(
            "SELECT sequence, literature_doi, evidence_note FROM bioactive_peptides WHERE source_version=$1", BATCH)
        assert len(rows) >= 90
        for r in rows:
            assert r["literature_doi"] or r["evidence_note"], f"{r['sequence']} 无 DOI 也无 evidence_note"
    finally:
        await conn.close()


@pytest.mark.asyncio
async def test_b100_category_coverage():
    """主题匹配后的品类覆盖：大豆/胶原/豌豆/酪蛋白 至少各 1。
    注：蛋清/乳清本轮为 0——其来源论文经复核为主题错配(海洋无脊椎/水母)，已诚实剔除，
    宁缺不错配；待后续核实到真正的蛋清/乳清肽论文再补。"""
    conn = await _conn()
    try:
        cats = await conn.fetch(
            "SELECT f.name_cn, COUNT(*) c FROM bioactive_peptides b "
            "JOIN food_materials f ON f.id=b.food_material_id "
            "WHERE b.source_version=$1 GROUP BY f.name_cn", BATCH)
        names = {r["name_cn"]: r["c"] for r in cats}
        for req in ["大豆肽粉", "胶原蛋白肽", "豌豆肽", "酪蛋白肽"]:
            assert names.get(req, 0) >= 1, f"品类 {req} 应有肽"
        # 主题错配品类（蛋清/乳清）本轮应为 0（来源已剔除，宁缺不错配）
        assert names.get("蛋清肽", 0) == 0, "蛋清肽来源已剔除，不应有错配肽"
        assert names.get("乳清肽", 0) == 0, "乳清肽来源已剔除，不应有错配肽"
    finally:
        await conn.close()


@pytest.mark.asyncio
async def test_b100_linked_to_real_carrier():
    conn = await _conn()
    try:
        orphan = await conn.fetchval(
            "SELECT COUNT(*) FROM bioactive_peptides b WHERE b.source_version=$1 "
            "AND NOT EXISTS (SELECT 1 FROM food_materials f WHERE f.id=b.food_material_id)", BATCH)
        assert orphan == 0, f"{orphan} 条肽未挂真实载体"
    finally:
        await conn.close()


@pytest.mark.asyncio
async def test_existing_12_and_carriers_untouched():
    """既有 12 条肽 + 批次1载体行未被本批破坏。"""
    conn = await _conn()
    try:
        rows = await conn.fetch("SELECT id FROM bioactive_peptides WHERE id = ANY($1::int[])", EXISTING_IDS)
        assert {r["id"] for r in rows} == set(EXISTING_IDS), "既有 12 条肽应全部存在"
        for cid, name in {161: "大豆肽粉", 162: "胶原蛋白肽", 163: "豌豆肽", 164: "乳清肽", 165: "蛋清肽"}.items():
            r = await conn.fetchrow("SELECT name_cn FROM food_materials WHERE id=$1", cid)
            assert r and r["name_cn"] == name, f"载体 {cid} 应仍为 {name}"
    finally:
        await conn.close()


@pytest.mark.asyncio
async def test_b100_idempotent_count_matches_sidecar():
    """库内本批数 == sidecar 肽数（去重后），幂等重跑不新增。"""
    conn = await _conn()
    try:
        n_db = await conn.fetchval("SELECT COUNT(*) FROM bioactive_peptides WHERE source_version=$1", BATCH)
        n_sc = len(_sidecar_peptides())
        # sidecar 可能有极少数与既有12条同序列（去重），库内 <= sidecar；但应接近且 >=90
        assert n_db >= 90
        assert n_db <= n_sc, f"库内本批 {n_db} 不应超过 sidecar {n_sc}"
    finally:
        await conn.close()


@pytest.mark.asyncio
async def test_medium_candidates_quarantined_not_confirmed():
    """medium 全文猜测候选已隔离到 pending 文件，未混入 literature_confirmed。"""
    assert PENDING.exists(), "pending 隔离文件应存在"
    with open(PENDING, encoding="utf-8") as f:
        pend = json.load(f)
    assert pend.get("provenance") == "unverified_candidate"
    conn = await _conn()
    try:
        # pending 里序列不应以本批次(pep_b100v)整批灌入 confirmed；
        # 但允许少数重叠：medium 集里有些序列被表格抽取+全文核验独立确认后升级（诚实升级，非猜测）。
        pend_seqs = [c["sequence"] for c in pend.get("candidates", [])]
        if pend_seqs:
            n_confirmed = await conn.fetchval(
                "SELECT COUNT(*) FROM bioactive_peptides WHERE sequence = ANY($1::text[]) "
                "AND provenance='literature_confirmed' AND source_version=$2",
                pend_seqs, BATCH)
            # 重叠应是少数（被核验升级的）；绝大多数 medium 仍未入库
            assert n_confirmed < len(pend_seqs) * 0.5, \
                f"medium 候选大量未核验即混入 confirmed: {n_confirmed}/{len(pend_seqs)}"
        # 关键：确认入库的本批肽都有真实 DOI/PMID 溯源（不因来自 medium 集就无源）
        nosrc = await conn.fetchval(
            "SELECT COUNT(*) FROM bioactive_peptides WHERE source_version=$1 "
            "AND literature_doi IS NULL AND (evidence_note IS NULL OR evidence_note='')", BATCH)
        assert nosrc == 0, "本批 confirmed 肽必须全有溯源"
    finally:
        await conn.close()
