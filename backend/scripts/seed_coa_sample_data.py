"""COA sample data initialization script"""
import sys, os
os.environ.setdefault('PYTHONIOENCODING', 'utf-8')
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import asyncio
from sqlalchemy import text
from app.core.database import engine
from app.models.peptide_batch_coa import PeptideBatchCOA, COATestItem

SAMPLE_COA_DATA = {
    "product_name_cn": "鱼胶原蛋白肽",
    "product_name_en": "Hydrolyzed-Collagen-Fish",
    "product_type": "其他食品",
    "product_code": "AMO-06",
    "spec": "20千克/袋",
    "batch_no": "20240518",
    "mfg_date": "2024-05-18T00:00:00+00:00",
    "gb_standard": "GB31645—2018",
    "test_conclusion": "合格",
    "qualified": True,
    "tested_by": "张检验",
    "checked_by": "李校对",
    "approved_by": "王批准",
    "inspection_basis": "检测、判定依据: GB31645—2018 《鱼胶原蛋白肽》",
    "test_items": [
        {"category": "sensory", "item_name": "色泽", "item_name_en": "Color",
         "standard": "具有本品应有的色泽", "result": "符合标准", "judgment": "符合"},
        {"category": "sensory", "item_name": "性状", "item_name_en": "State",
         "standard": "均匀性粉末状或颗粒状，无结块现象",
         "result": "符合标准", "judgment": "符合"},
        {"category": "sensory", "item_name": "气味与滋味", "item_name_en": "Smell and Taste",
         "standard": "具有本品固有的滋味和气味，无异味",
         "result": "符合标准", "judgment": "符合"},
        {"category": "sensory", "item_name": "杂质", "item_name_en": "Impurity",
         "standard": "无正常视力可见外来杂质",
         "result": "符合标准", "judgment": "符合"},
        {"category": "chemical", "item_name": "水分含量(%)", "item_name_en": "Moisture Content(%)",
         "standard": "≤ 7.0", "result": "4.43", "unit": "%", "judgment": "符合"},
        {"category": "chemical", "item_name": "灰分(干基,% )", "item_name_en": "Ash(dry base,% )",
         "standard": "≤ 7.0", "result": "1.0", "unit": "%", "judgment": "符合"},
        {"category": "chemical", "item_name": "粗蛋白质(干基,% )", "item_name_en": "Crude Protein(dry base,% )",
         "standard": "≥ 80.0", "result": "98.0", "unit": "%", "judgment": "符合"},
        {"category": "chemical", "item_name": "肽含量(干基,% )", "item_name_en": "Peptide Content(dry base,% )",
         "standard": "≥ 80.0", "result": "100", "unit": "%", "judgment": "符合"},
        {"category": "microbial", "item_name": "菌落总数(CFU/g)", "item_name_en": "Total Bacteria(CFU/g)",
         "standard": "n=5,c=2,m=10^4,M=10^5",
         "result": "10,10,10,10,10", "judgment": "符合"},
        {"category": "microbial", "item_name": "大肠菌群(CFU/g)", "item_name_en": "Coliforms(CFU/g)",
         "standard": "n=5,c=2,m=10,M=10^2",
         "result": "<10x5", "judgment": "符合"},
        {"category": "packaging", "item_name": "净含量", "item_name_en": "Net Weight",
         "standard": "20千克/袋", "result": "20.05千克/袋", "judgment": "符合"},
        {"category": "packaging", "item_name": "产品包装", "item_name_en": "Packaging",
         "standard": "包装整洁、卫生，密封完好",
         "result": "符合标准", "judgment": "符合"},
        {"category": "packaging", "item_name": "标签", "item_name_en": "Label",
         "standard": "GB 7718和GB 28050的要求",
         "result": "符合标准", "judgment": "符合"},
    ]
}


async def main():
    from datetime import datetime, timezone
    mfg_date = datetime(2024, 5, 18, tzinfo=timezone.utc)

    async with engine.begin() as conn:
        # Check existing
        r = await conn.execute(text("SELECT COUNT(*) FROM peptide_batch_coas"))
        if r.scalar() > 0:
            print("Data already exists, skipping.")
            return

        # Insert COA
        result = await conn.execute(text("""
            INSERT INTO peptide_batch_coas
            (product_name_cn, product_name_en, product_type, product_code, spec,
             batch_no, mfg_date, gb_standard, test_conclusion, qualified,
             tested_by, checked_by, approved_by, inspection_basis)
            VALUES (:name_cn, :name_en, :ptype, :code, :spec, :batch, :mfg, :std, :conclusion, :qual,
                    :tested, :checked, :approved, :basis)
            RETURNING id
        """, {
            "name_cn": SAMPLE_COA_DATA["product_name_cn"],
            "name_en": SAMPLE_COA_DATA["product_name_en"],
            "ptype": SAMPLE_COA_DATA["product_type"],
            "code": SAMPLE_COA_DATA["product_code"],
            "spec": SAMPLE_COA_DATA["spec"],
            "batch": SAMPLE_COA_DATA["batch_no"],
            "mfg": mfg_date,
            "std": SAMPLE_COA_DATA["gb_standard"],
            "conclusion": SAMPLE_COA_DATA["test_conclusion"],
            "qual": SAMPLE_COA_DATA["qualified"],
            "tested": SAMPLE_COA_DATA["tested_by"],
            "checked": SAMPLE_COA_DATA["checked_by"],
            "approved": SAMPLE_COA_DATA["approved_by"],
            "basis": SAMPLE_COA_DATA["inspection_basis"],
        }))
        coa_id = r.scalar_one()

        # Insert test items
        for idx, item in enumerate(SAMPLE_COA_DATA["test_items"]):
            await conn.execute(text("""
                INSERT INTO coa_test_items
                (coa_id, category, item_name, item_name_en, standard, result, unit, judgment, sort_order)
                VALUES (:coa_id, :cat, :name, :name_en, :std, :result, :unit, :judgment, :sort)
            """, {
                "coa_id": coa_id,
                **item,
                "sort": idx,
            }))

        print(f"Created COA batch_no={SAMPLE_COA_DATA['batch_no']}, id={coa_id}")
        print(f"Created {len(SAMPLE_COA_DATA['test_items'])} test items")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
