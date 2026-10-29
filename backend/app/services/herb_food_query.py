"""药食同源疾病→中药查询服务

提供 疾病名 → 靶点 → 化合物 → 中药 的多层展开查询，
支持中英双语疾病名映射和模糊搜索。
"""

import logging
from dataclasses import dataclass, field
from typing import Optional

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════
# 中文疾病名 → 英文疾病名精确映射
# ═══════════════════════════════════════════

CN_TO_EN_DISEASE: dict[str, str] = {
    "糖尿病": "Diabetes Mellitus",
    "高血压": "Essential Hypertension",
    "高血脂": "Hyperlipidemia",
    "肥胖症": "Obesity",
    "失眠": "Sleep Deprivation",
    "消化不良": "Dyspepsia",
    "免疫力低下": "Immune System Diseases",
    "肝损伤": "Liver diseases",
    "痛风": "Gout",
    "慢性咽炎": "Pharyngitis",
    "慢性胃炎": "Gastritis, Atrophic",
    "贫血": "Anemia",
    "痴呆": "Dementia",
    "阿尔茨海默": "Alzheimer's Disease",
    "冠心病": "Coronary Artery Disease",
    "抑郁症": "Depression",
    "哮喘": "Asthma",
    "类风湿": "Rheumatoid Arthritis",
    "帕金森": "Parkinson Disease",
    "胃炎": "Gastritis",
    "肝炎": "Hepatitis",
    "肾炎": "Nephritis",
    "肺炎": "Pneumonia",
    "中风": "Stroke",
    "便秘": "Constipation",
    "腹泻": "Diarrhea",
    "咳嗽": "Cough",
    "感冒": "Common Cold",
    "过敏": "Hypersensitivity",
    "衰老": "Aging",
    "疲劳": "Fatigue",
    "脱发": "Alopecia",
    "痤疮": "Acne Vulgaris",
    "银屑病": "Psoriasis",
    "白癜风": "Vitiligo",
    "骨质疏松": "Osteoporosis",
    "更年期": "Menopause",
    "前列腺": "Prostatic Hyperplasia",
    "乳腺癌": "Breast Cancer",
    "肺癌": "Lung Cancer",
    "胃癌": "Stomach Cancer",
    "肝癌": "Liver Cancer",
    "结肠癌": "Colon Cancer",
    "胰腺癌": "Pancreatic Cancer",
    "食管癌": "Esophageal Cancer",
    "白血病": "Leukemia",
    "淋巴瘤": "Lymphoma",
    "黑色素瘤": "Melanoma",
    "甲状腺": "Thyroid",
    "胰腺炎": "Pancreatitis",
    "支气管炎": "Bronchitis",
    "鼻窦炎": "Sinusitis",
    "关节炎": "Arthritis",
    "脊柱炎": "Spondylitis",
    "心肌梗死": "Myocardial Infarction",
    "心力衰竭": "Heart Failure",
    "动脉硬化": "Atherosclerosis",
    "偏头痛": "Migraine",
    "癫痫": "Epilepsy",
    "红斑狼疮": "Lupus Erythematosus",
    "克罗恩": "Crohn Disease",
    "溃疡性结肠炎": "Ulcerative Colitis",
    "肾结石": "Kidney Calculi",
    "尿路感染": "Urinary Tract Infection",
    "前列腺炎": "Prostatic Cancer",
    "子宫肌瘤": "Uterine Fibroids",
    "子宫内膜异位": "Endometriosis",
    "多囊卵巢": "Polycystic Ovary Syndrome",
    "不孕": "Infertility",
    "青光眼": "Glaucoma",
    "白内障": "Cataract",
    "湿疹": "Eczema",
    "荨麻疹": "Urticaria",
    "带状疱疹": "Herpes Zoster",
    "真菌感染": "Fungal Infection",
    "结核": "Tuberculosis",
    "乙肝": "Hepatitis B",
    "丙肝": "Hepatitis C",
    "甲亢": "Hyperthyroidism",
    "甲减": "Hypothyroidism",
    "败血症": "Sepsis",
    "烧伤": "Burns",
    "骨折": "Fractures",
    "纤维化": "Fibrosis",
    "水肿": "Edema",
    "血栓": "Thrombosis",
    "缺血": "Ischemia",
    "梗死": "Infarction",
}


# ═══════════════════════════════════════════
# 数据模型
# ═══════════════════════════════════════════

@dataclass
class HerbEvidence:
    """单味中药的证据链节点"""
    target_name: str
    compound_name: str


@dataclass
class RankedHerb:
    """排序后的中药结果"""
    herb_name_cn: str
    herb_name_en: Optional[str]
    target_count: int
    compound_count: int
    evidence: list[HerbEvidence] = field(default_factory=list)


@dataclass
class DiseaseStats:
    """疾病图谱统计"""
    disease_en: str
    target_count: int
    compound_count: int
    herb_count: int


# ═══════════════════════════════════════════
# 查询服务
# ═══════════════════════════════════════════

class HerbFoodQueryService:
    """药食同源疾病→中药查询服务"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def resolve_disease(self, query: str) -> Optional[str]:
        """将中文或英文疾病名解析为数据库中的英文疾病名（支持模糊匹配）"""
        q = query.strip()
        if not q:
            return None

        # 1. 精确中文→英文映射
        if q in CN_TO_EN_DISEASE:
            exact = CN_TO_EN_DISEASE[q]
            # 先尝试精确匹配
            result = await self.db.execute(
                text("SELECT id, name_en FROM herb_food_diseases WHERE name_en = :en LIMIT 1"),
                {"en": exact},
            )
            if result.fetchone():
                return exact
            # 精确匹配失败时回退到前缀匹配
            result = await self.db.execute(
                text("SELECT name_en FROM herb_food_diseases WHERE name_en LIKE :pat LIMIT 1"),
                {"pat": f"{exact}%"},
            )
            row = result.fetchone()
            if row:
                return row[0]

        # 2. 精确英文匹配（大小写不敏感）
        result = await self.db.execute(
            text("SELECT id, name_en FROM herb_food_diseases WHERE LOWER(name_en) = LOWER(:q) LIMIT 1"),
            {"q": q},
        )
        row = result.fetchone()
        if row:
            return row[1]

        # 3. 前缀匹配（处理疾病名变体如 "Diabetes Mellitus, Non-Insulin-Dependent"）
        result = await self.db.execute(
            text("SELECT name_en FROM herb_food_diseases WHERE name_en ILIKE :pat LIMIT 1"),
            {"pat": f"{q}%"},
        )
        row = result.fetchone()
        if row:
            return row[0]

        # 4. 模糊子串匹配
        result = await self.db.execute(
            text("SELECT name_en FROM herb_food_diseases WHERE LOWER(name_en) LIKE LOWER(:pat) LIMIT 1"),
            {"pat": f"%{q}%"},
        )
        row = result.fetchone()
        if row:
            return row[0]

        return None

    async def search_diseases(self, query: str, limit: int = 20) -> list[dict]:
        """搜索可匹配的疾病列表（中英文模糊匹配）"""
        q = query.strip()
        if not q:
            return []

        # 优先匹配中文名
        result = await self.db.execute(
            text("""
                SELECT id, name_en, name_cn
                FROM herb_food_diseases
                WHERE name_cn LIKE :pat_cn
                   OR name_en ILIKE :pat_en
                ORDER BY
                    CASE WHEN name_cn LIKE :pat_cn THEN 0 ELSE 1 END,
                    name_cn
                LIMIT :limit
            """),
            {"pat_cn": f"%{q}%", "pat_en": f"%{q}%", "limit": limit},
        )
        rows = result.fetchall()
        return [{"id": r[0], "name_en": r[1], "name_cn": r[2]} for r in rows]

    async def get_disease_stats(self, disease_en: str) -> Optional[DiseaseStats]:
        """获取疾病在图谱中的统计数据"""
        result = await self.db.execute(
            text("""
                SELECT d.id, d.name_en, d.name_cn
                FROM herb_food_diseases d
                WHERE d.name_en = :en
                LIMIT 1
            """),
            {"en": disease_en},
        )
        row = result.fetchone()
        if not row:
            return None

        dis_id = row[0]

        # 靶点数
        tgt_result = await self.db.execute(
            text("SELECT COUNT(DISTINCT td.target_id) FROM herb_food_target_disease td WHERE td.disease_id = :did"),
            {"did": dis_id},
        )
        target_count = tgt_result.scalar() or 0

        # 化合物数
        comp_result = await self.db.execute(
            text("""
                SELECT COUNT(DISTINCT ct.compound_id)
                FROM herb_food_compound_target ct
                JOIN herb_food_target_disease td ON ct.target_id = td.target_id
                WHERE td.disease_id = :did
            """),
            {"did": dis_id},
        )
        compound_count = comp_result.scalar() or 0

        # 中药数
        herb_result = await self.db.execute(
            text("""
                SELECT COUNT(DISTINCT hc.herb_id)
                FROM herb_food_herb_compound hc
                JOIN herb_food_compound_target ct ON hc.compound_id = ct.compound_id
                JOIN herb_food_target_disease td ON ct.target_id = td.target_id
                WHERE td.disease_id = :did
            """),
            {"did": dis_id},
        )
        herb_count = herb_result.scalar() or 0

        return DiseaseStats(
            disease_en=disease_en,
            target_count=target_count,
            compound_count=compound_count,
            herb_count=herb_count,
        )

    async def rank_herbs_for_disease(
        self,
        disease_en: str,
        top_k: int = 15,
    ) -> list[RankedHerb]:
        """
        一站式查询：疾病 → 中药排序

        按 关联靶点数 → 关联化合物数 降序排列。
        证据链：每个中药的 Top-5 最强靶点（按化合物数排序）。
        """
        # 查找疾病ID
        dis_result = await self.db.execute(
            text("SELECT id FROM herb_food_diseases WHERE name_en = :en LIMIT 1"),
            {"en": disease_en},
        )
        dis_row = dis_result.fetchone()
        if not dis_row:
            return []
        dis_row[0]

        # 核心查询：展开 疾病→靶点→化合物→中药
        sql = text("""
            SELECT
                h.id        AS herb_id,
                h.name_cn   AS herb_name_cn,
                h.name_en   AS herb_name_en,
                COUNT(DISTINCT td.target_id)                              AS target_count,
                COUNT(DISTINCT ct.compound_id)                            AS compound_count,
                t.gene_symbol                                               AS tgt_symbol,
                t.protein_name                                              AS tgt_name,
                c.name_en                                                   AS comp_name
            FROM herb_food_diseases d
            JOIN herb_food_target_disease td ON td.disease_id = d.id
            JOIN herb_food_compound_target ct ON ct.target_id = td.target_id
            JOIN herb_food_compounds c ON c.id = ct.compound_id
            JOIN herb_food_herb_compound hc ON hc.compound_id = c.id
            JOIN herb_food_herbs h ON h.id = hc.herb_id
            JOIN herb_food_targets t ON t.id = td.target_id
            WHERE d.name_en = :en
            GROUP BY h.id, h.name_cn, h.name_en, t.gene_symbol, t.protein_name, c.name_en
            ORDER BY target_count DESC, compound_count DESC
        """)
        rows = await self.db.execute(sql, {"en": disease_en})
        all_rows = rows.fetchall()

        # 聚合：按中药分组
        herb_data: dict[int, dict] = {}
        for row in all_rows:
            herb_id, herb_cn, herb_en, tgt_cnt, comp_cnt, tgt_sym, tgt_name, comp_name = row
            if herb_id not in herb_data:
                herb_data[herb_id] = {
                    "herb_id": herb_id,
                    "herb_name_cn": herb_cn,
                    "herb_name_en": herb_en,
                    "target_count": tgt_cnt,
                    "compound_count": comp_cnt,
                    "evidence_map": {},  # (tgt_sym, tgt_name) → set of compounds
                }
            key = (tgt_sym or "", tgt_name or "")
            herb_data[herb_id]["evidence_map"].setdefault(key, set()).add(comp_name or "")

        # 构建证据链（每个中药取 Top-5 靶点，按化合物数降序）
        ranked: list[RankedHerb] = []
        for herb_id, data in herb_data.items():
            evidence_list: list[HerbEvidence] = []
            sorted_targets = sorted(
                data["evidence_map"].items(),
                key=lambda x: len(x[1]),
                reverse=True,
            )
            for (tgt_sym, tgt_name), comps in sorted_targets[:5]:
                evidence_list.append(HerbEvidence(
                    target_name=tgt_name or tgt_sym,
                    compound_name=list(comps)[0] if comps else "",
                ))

            ranked.append(RankedHerb(
                herb_name_cn=data["herb_name_cn"],
                herb_name_en=data["herb_name_en"],
                target_count=data["target_count"],
                compound_count=data["compound_count"],
                evidence=evidence_list,
            ))

        # 最终排序：靶点数 → 化合物数 降序
        ranked.sort(key=lambda x: (x.target_count, x.compound_count), reverse=True)
        return ranked[:top_k]

    async def get_herb_disease_chain(
        self,
        herb_name: str,
        disease_en: str,
        max_ingredients: int = 8,
        max_genes: int = 12,
    ) -> dict:
        """
        获取指定中药与疾病之间的分子关联链路。

        Returns:
            {
                "compounds": [(id, name_en), ...],
                "targets": [(id, gene_symbol), ...],
                "compound_target_map": {compound_id: [(target_id, gene_symbol), ...]},
            }
        """
        # 查找中药ID
        herb_result = await self.db.execute(
            text("SELECT id FROM herb_food_herbs WHERE name_cn = :name LIMIT 1"),
            {"name": herb_name},
        )
        herb_row = herb_result.fetchone()
        if not herb_row:
            return {"compounds": [], "targets": [], "compound_target_map": {}}
        herb_id = herb_row[0]

        # 查找疾病ID
        dis_result = await self.db.execute(
            text("SELECT id FROM herb_food_diseases WHERE name_en = :en LIMIT 1"),
            {"en": disease_en},
        )
        dis_row = dis_result.fetchone()
        if not dis_row:
            return {"compounds": [], "targets": [], "compound_target_map": {}}
        dis_id = dis_row[0]

        # 查询交集：该中药的化合物 × 该疾病的靶点
        sql = text("""
            SELECT
                c.id   AS compound_id,
                c.name_en AS compound_name,
                t.id   AS target_id,
                t.gene_symbol AS target_symbol,
                t.protein_name AS target_name
            FROM herb_food_herb_compound hc
            JOIN herb_food_compound_target ct ON ct.compound_id = hc.compound_id
            JOIN herb_food_targets t ON t.id = ct.target_id
            JOIN herb_food_compounds c ON c.id = ct.compound_id
            WHERE hc.herb_id = :hid
              AND ct.target_id IN (
                  SELECT target_id FROM herb_food_target_disease WHERE disease_id = :did
              )
            ORDER BY c.id, t.id
        """)
        rows = await self.db.execute(sql, {"hid": herb_id, "did": dis_id})
        all_rows = rows.fetchall()

        if not all_rows:
            return {"compounds": [], "targets": [], "compound_target_map": {}}

        # 按化合物计数排序，取 Top N
        from collections import Counter
        comp_counts = Counter(r[0] for r in all_rows)
        top_compounds = [cid for cid, _ in comp_counts.most_common(max_ingredients)]

        # 按靶点计数排序，取 Top N
        tgt_counts = Counter(r[3] for r in all_rows if r[0] in top_compounds)
        top_targets = [sym for sym, _ in tgt_counts.most_common(max_genes)]

        # 构建结果
        compound_target_map: dict[int, list[tuple]] = {}
        compounds_set: set[int] = set()
        targets_set: set[str] = set()

        for cid, cname, tid, tsym, tname in all_rows:
            if cid not in top_compounds:
                continue
            if tsym not in top_targets:
                continue
            compounds_set.add(cid)
            targets_set.add(tsym)
            compound_target_map.setdefault(cid, []).append((tid, tsym, tname))

        return {
            "compounds": [
                (cid, cname)
                for cid, cname, *_ in all_rows
                if cid in compounds_set
            ][:max_ingredients],
            "targets": [
                (tsym, tname)
                for *_, tsym, tname in all_rows
                if tsym in targets_set
            ][:max_genes],
            "compound_target_map": {
                cid: [(tid, tsym, tname) for tid, tsym, tname in pairs]
                for cid, pairs in compound_target_map.items()
            },
        }

    async def get_all_herbs(self) -> list[dict]:
        """返回所有药食同源中药列表（用于前端下拉选择）"""
        result = await self.db.execute(
            text("SELECT id, name_cn, name_en FROM herb_food_herbs ORDER BY name_cn")
        )
        return [{"id": r[0], "name_cn": r[1], "name_en": r[2]} for r in result.fetchall()]

    async def get_all_diseases(self) -> list[dict]:
        """返回所有可查询疾病列表（中英文）"""
        result = await self.db.execute(
            text("SELECT id, name_en, name_cn FROM herb_food_diseases ORDER BY name_en")
        )
        return [{"id": r[0], "name_en": r[1], "name_cn": r[2]} for r in result.fetchall()]
