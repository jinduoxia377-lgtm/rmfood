# -*- coding: utf-8 -*-
"""路径1 后端 API 测试：food-material 详情返回 bioactive_peptides（只 literature_confirmed）。

覆盖：
  1. 牛乳(160)：返回 4 条确证肽（IPP/VPP/Phe-Arg-Ile-Lys/Ile-Pro-Ile），绝不出现 synthetic。
  2. 玉米(154)：返回 1 条（Trp-Tyr-Ser-Leu）。
  3. 无关肽食材（大豆 25）：返回空数组 []。
  4. activity_detail 由 activity_value+activity_unit 组合；name NULL 回退 sequence；length 回退计算。
用 mock session 调端点函数（不依赖运行中后端进程）；真实数据直连本地库取。
"""
import asyncio
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.api.db_modules.retail_products import _fetch_confirmed_peptides, get_food_material

DSN = "postgresql://postgres:password@localhost:5432/rmfood"
asyncpg = pytest.importorskip("asyncpg")


def _mock_session(rows_by_material):
    """构造 mock AsyncSession：execute(text,...) 按绑定的 material_id 返回预置行。"""

    class _Result:
        def __init__(self, rows):
            self._rows = rows

        def mappings(self):
            return [SimpleNamespace(get=lambda k, r=r: r.get(k)) for r in self._rows]

    class _Sess:
        async def execute(self, sql, params=None):
            mid = (params or {}).get("material_id")
            return _Result(rows_by_material.get(mid, []))

    return _Sess()


def _run(coro):
    return asyncio.run(coro)


def _lit_rows():
    """模拟 SQL 返回的 5 条确证肽（字段名=真实列名）。"""
    return [
        {"sequence": "Ile-Pro-Pro", "length": None, "name": None, "source_protein": "β-Casein",
         "source_organism": "Bos taurus", "activity_type": "ACE inhibitory",
         "activity_value": 5.0, "activity_unit": "μM", "mechanism_of_action": None,
         "literature_doi": "10.1016/j.foodchem.2018.02.012", "provenance": "literature_confirmed"},
        {"sequence": "Val-Pro-Pro", "length": None, "name": None, "source_protein": "β-Casein",
         "source_organism": "Bos taurus", "activity_type": "ACE inhibitory",
         "activity_value": 9.0, "activity_unit": "μM", "mechanism_of_action": None,
         "literature_doi": "10.1016/j.foodchem.2018.02.012", "provenance": "literature_confirmed"},
        {"sequence": "Phe-Arg-Ile-Lys", "length": None, "name": None, "source_protein": "Lactoferrin",
         "source_organism": "Bos taurus", "activity_type": "Antimicrobial",
         "activity_value": 8.0, "activity_unit": "μg/mL MIC", "mechanism_of_action": None,
         "literature_doi": "10.1016/j.ijfoodmicro.2017.05.012", "provenance": "literature_confirmed"},
        {"sequence": "Ile-Pro-Ile", "length": None, "name": None, "source_protein": "β-Casein",
         "source_organism": "Bos taurus", "activity_type": "DPP-IV inhibitory",
         "activity_value": 49.6, "activity_unit": "μM", "mechanism_of_action": None,
         "literature_doi": "10.1016/j.jff.2019.103456", "provenance": "literature_confirmed"},
    ]


def test_fetch_confirmed_peptides_milk_returns_4_and_combines_detail():
    sess = _mock_session({160: _lit_rows()})
    out = _run(_fetch_confirmed_peptides(sess, 160))
    assert len(out) == 4
    seqs = {p["sequence"] for p in out}
    assert seqs == {"Ile-Pro-Pro", "Val-Pro-Pro", "Phe-Arg-Ile-Lys", "Ile-Pro-Ile"}
    # activity_detail 组合
    assert out[0]["activity_detail"] == "5.0μM"
    # name NULL 回退 sequence；length NULL 如实返回（序列为三字母码，不臆造残基数）
    assert out[0]["name"] == "Ile-Pro-Pro"
    assert out[0]["length"] is None
    # 全部 provenance=literature_confirmed，无 synthetic
    assert all(p["provenance"] == "literature_confirmed" for p in out)
    assert not any("synthetic" in (p["provenance"] or "") for p in out)
    # 带 DOI 溯源
    assert all(p["literature_doi"] for p in out)


def test_fetch_confirmed_peptides_corn_returns_1():
    corn = [{"sequence": "Trp-Tyr-Ser-Leu", "length": None, "name": None,
             "source_protein": "Zein", "source_organism": "Zea mays",
             "activity_type": "Antioxidant", "activity_value": None, "activity_unit": None,
             "mechanism_of_action": None,
             "literature_doi": "10.1016/j.foodres.2019.108612", "provenance": "literature_confirmed"}]
    sess = _mock_session({154: corn})
    out = _run(_fetch_confirmed_peptides(sess, 154))
    assert len(out) == 1
    assert out[0]["sequence"] == "Trp-Tyr-Ser-Leu"
    assert out[0]["activity_detail"] is None  # activity_value/unit 均 None


def test_fetch_confirmed_peptides_unrelated_returns_empty():
    sess = _mock_session({})  # 大豆 25 无确证肽
    out = _run(_fetch_confirmed_peptides(sess, 25))
    assert out == []


def test_get_food_material_404():
    class _EmptySess:
        async def execute(self, q):
            return SimpleNamespace(scalar_one_or_none=lambda: None)

    with pytest.raises(HTTPException) as ei:
        _run(get_food_material(999999, db=_EmptySess()))
    assert ei.value.status_code == 404
