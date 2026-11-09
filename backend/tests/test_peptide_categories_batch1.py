# -*- coding: utf-8 -*-
"""批次1 集成测试：品类载体行 + 序列级确证肽入库（路径1 扩充）。

验证真实本地库状态（seed_peptide_categories.py --apply 后）：
  1. 5 个品类载体行存在（大豆肽粉/胶原蛋白肽/豌豆肽/乳清肽/蛋清肽），food_homology=False。
  2. 7 条序列级确证肽入库，provenance=literature_confirmed，DOI 非空。
  3. 关联正确：肽挂对应载体。
  4. 蛋清肽载体无序列肽（不硬凑）。
  5. 既有路径1 的 5 条（7941/7942/7953/7961/7966）未被动。
库不可用时 skip。
"""
import os

import pytest

DSN = os.environ.get("RMFOOD_TEST_DSN", "postgresql://postgres:password@localhost:5432/rmfood")
asyncpg = pytest.importorskip("asyncpg")

CARRIERS = {161: "大豆肽粉", 162: "胶原蛋白肽", 163: "豌豆肽", 164: "乳清肽", 165: "蛋清肽"}
NEW_PEPTIDES = {
    "SKWQHQQDSCRKQLQGVNLTPCEKHIMEKIQGRGDDDDDDDDD": (161, "Lunasin"),
    "Gly-Pro-Hyp": (162, "GPH"),
    "Hyp-Gly": (162, "HG"),
    "YLVN": (163, "YLVN"),
    "EEHLCFR": (163, "EEHLCFR"),
    "TFY": (163, "TFY"),
    "Tyr-Leu-Leu-Phe-Gly-Val": (164, "Beta-lactorphin"),
}
PATH1_IDS = [7941, 7942, 7953, 7961, 7966]


async def _conn():
    return await asyncpg.connect(DSN)


@pytest.mark.asyncio
async def test_category_carriers_exist():
    conn = await _conn()
    try:
        for cid, name in CARRIERS.items():
            row = await conn.fetchrow(
                "SELECT name_cn, food_homology, review_status FROM food_materials WHERE id=$1", cid)
            assert row is not None, f"载体 {name}(id={cid}) 不存在"
            assert row["name_cn"] == name
            assert row["food_homology"] is False, f"{name} food_homology 应 False"
    finally:
        await conn.close()


@pytest.mark.asyncio
async def test_sequence_peptides_inserted_with_doi():
    conn = await _conn()
    try:
        for seq, (fm_id, name) in NEW_PEPTIDES.items():
            row = await conn.fetchrow(
                "SELECT id, provenance, literature_doi, evidence_note, food_material_id "
                "FROM bioactive_peptides "
                "WHERE sequence=$1 AND provenance='literature_confirmed'", seq)
            assert row is not None, f"确证肽 {name}({seq}) 未入库"
            assert row["provenance"] == "literature_confirmed"
            # 诚实溯源：DOI 或 evidence_note(PMID) 至少一个非空（不留错 DOI 冒充）
            assert row["literature_doi"] or row["evidence_note"], f"{name} 无 DOI 也无 evidence_note"
            assert row["food_material_id"] == fm_id, f"{name} 关联载体错误"
    finally:
        await conn.close()


@pytest.mark.asyncio
async def test_wrong_dois_nulled_and_pmid_in_evidence_note():
    """引用纠错：β-lactorphin + 胶原肽错 DOI 已置 NULL，PMID 存 evidence_note。"""
    conn = await _conn()
    try:
        # β-lactorphin(id132)：错 DOI 已 NULL，evidence_note 含 PMID 10399349
        r = await conn.fetchrow(
            "SELECT literature_doi, evidence_note, provenance, food_material_id "
            "FROM bioactive_peptides WHERE id=132")
        assert r["literature_doi"] is None, "β-lactorphin 错 DOI 应置 NULL"
        assert "10399349" in (r["evidence_note"] or ""), "β-lactorphin evidence_note 应含 PMID 10399349"
        assert r["provenance"] == "literature_confirmed"
        assert r["food_material_id"] == 164, "β-lactorphin 应仍挂乳清肽164"
        # 胶原肽 Gly-Pro-Hyp(id127)/Hyp-Gly(id128)：错 IJMS DOI 已 NULL，evidence_note 含 PMID 31905705
        for pid in (127, 128):
            r = await conn.fetchrow(
                "SELECT literature_doi, evidence_note FROM bioactive_peptides WHERE id=$1", pid)
            assert r["literature_doi"] is None, f"id{pid} 错 IJMS DOI 应置 NULL"
            assert "31905705" in (r["evidence_note"] or ""), f"id{pid} evidence_note 应含 PMID 31905705"
        # Lunasin(id126)：正确 DOI 保留 + evidence_note 补充
        r = await conn.fetchrow(
            "SELECT literature_doi, evidence_note FROM bioactive_peptides WHERE id=126")
        assert r["literature_doi"] == "10.1038/nbt1099-1171", "Lunasin 正确 DOI 应保留"
        assert r["evidence_note"], "Lunasin evidence_note 应补充"
        # 豌豆肽(id129)：正确 DOI 保留 + evidence_note
        r = await conn.fetchrow(
            "SELECT literature_doi, evidence_note FROM bioactive_peptides WHERE id=129")
        assert r["literature_doi"] == "10.3390/molecules28072952", "豌豆肽正确 DOI 应保留"
        assert "37049715" in (r["evidence_note"] or "")

    finally:
        await conn.close()


@pytest.mark.asyncio
async def test_id7966_ile_pro_ile_doi_corrected():
    """id7966 Ile-Pro-Ile(Diprotin A)：错 DOI(Rosa Roxburghii) 已换成核实正确的 Diprotin A 文献。"""
    conn = await _conn()
    try:
        r = await conn.fetchrow(
            "SELECT literature_doi, evidence_note, provenance, food_material_id "
            "FROM bioactive_peptides WHERE id=7966")
        # 核实正确的 Diprotin A 文献 DOI（Rahfeld 1991, PMID 1671823），不再是错的 Rosa Roxburghii DOI
        assert r["literature_doi"] == "10.1016/0167-4838(91)90284-7", \
            f"id7966 DOI 应为核实正确的 Diprotin A 文献，实际 {r['literature_doi']}"
        assert r["literature_doi"] != "10.1016/j.jff.2019.103456", "错 DOI 应已清除"
        assert "1671823" in (r["evidence_note"] or ""), "evidence_note 应含 PMID 1671823"
        assert r["provenance"] == "literature_confirmed"
        assert r["food_material_id"] == 160, "id7966 应仍挂牛乳160"
    finally:
        await conn.close()


@pytest.mark.asyncio
async def test_egg_white_carrier_has_no_mismatched_sequence_peptide():
    """蛋清肽载体应无序列肽：原 egg_white 来源论文经复核为主题错配(海洋无脊椎综述 PMIID28212329)已剔除，
    宁缺不错配——不硬凑。待核实到真正的蛋清肽论文再补。"""
    conn = await _conn()
    try:
        n = await conn.fetchval(
            "SELECT COUNT(*) FROM bioactive_peptides WHERE food_material_id=165")
        assert n == 0, f"蛋清肽载体应有 0 条序列肽（主题错配来源已剔除，宁缺不错配），实际 {n}"
    finally:
        await conn.close()


@pytest.mark.asyncio
async def test_path1_five_peptides_untouched():
    conn = await _conn()
    try:
        rows = await conn.fetch(
            "SELECT id, sequence, provenance, food_material_id FROM bioactive_peptides "
            "WHERE id = ANY($1::bigint[])", PATH1_IDS)
        got = {r["id"]: (r["sequence"], r["provenance"], r["food_material_id"]) for r in rows}
        assert len(got) == 5, "路径1 的 5 条应仍在"
        # 牛乳(160)/玉米(154) 关联保持
        assert got[7941][2] == 160 and got[7942][2] == 160
        assert got[7953][2] == 154
    finally:
        await conn.close()


@pytest.mark.asyncio
async def test_seeding_idempotent():
    """重跑 seeding 应 0 新增（载体按 name_cn、肽按 sequence+activity_type 去重）。"""
    import subprocess
    import sys
    script = os.path.join(os.path.dirname(__file__), "..", "scripts", "seed_peptide_categories.py")
    before = await _count_batch()
    subprocess.run([sys.executable, script, "--apply", "--yes-i-know"],
                   capture_output=True, cwd=os.path.join(os.path.dirname(__file__), ".."))
    after = await _count_batch()
    assert before == after, f"重跑应幂等(0 新增)，实际 {before}->{after}"


async def _count_batch():
    conn = await _conn()
    try:
        return await conn.fetchval(
            "SELECT COUNT(*) FROM bioactive_peptides WHERE source_version='pep_cat_b1'")
    finally:
        await conn.close()
