"""直接通过 SQLAlchemy 创建10个普通食品多肽配方案例"""
import asyncio
import sys
import os
import random
import string
from datetime import datetime, timezone

# 设置工作目录为 backend 以便 .env 能被正确加载
_backend_dir = os.path.join(os.path.dirname(__file__), '..', 'backend')
os.chdir(_backend_dir)
sys.path.insert(0, _backend_dir)

# 显式设置必要的环境变量（避免 .env 加载路径问题）
os.environ.setdefault('SECRET_KEY', 'rmfood-2024-quantum-peptide-formulation-platform-production-secret-key-minimum-64-chars-long')
os.environ.setdefault('DATABASE_URL', 'postgresql+asyncpg://postgres:@localhost:5432/rmfood_db')
os.environ.setdefault('ADMIN_USERNAME', 'admin')
os.environ.setdefault('ADMIN_PASSWORD', 'admin123')
os.environ.setdefault('ENV', 'development')

from app.core.session import engine, async_session_factory
from app.models.formula import Formula
from app.models.enums import FormulaStatus
from app.models.user_model import User


def random_code():
    """生成配方编码 RMF-YYYYMMDD-XXXX"""
    today = datetime.now(timezone.utc).strftime("%Y%m%d")
    chars = string.ascii_uppercase + string.digits
    rand = ''.join(random.choices(chars, k=4))
    return f"RMF-{today}-{rand}"


FORMULAS = [
    {
        "name": "人参皂苷多肽抗疲劳配方",
        "description": "以人参皂苷为核心活性成分，复配黄芪多糖与枸杞多糖，通过AMPK/SIRT1通路激活能量代谢，协同提升运动耐力与抗疲劳能力。适用于运动人群及易疲劳亚健康人群。",
        "target_effects": ["抗疲劳", "提升精力", "增强耐力"],
        "composition": {
            "active_components": ["人参皂苷Rg1+Rb1", "黄芪甲苷", "枸杞多糖"],
            "peptide_content_mg_per_100g": 50,
            "saponin_content_mg_per_100g": 200
        },
        "processing_method": "低温酶解提取→超滤分级→喷雾干燥→微胶囊包埋",
        "dosage": "每次5-10g，每日2次，温水冲服",
        "storage_conditions": "密封、置阴凉干燥处，避免阳光直射",
        "shelf_life": 730,
        "safety_check": {"toxicology": "急性毒性试验阴性", "heavy_metals": "合格", "microbial": "合格"},
        "synergy_analysis": {"synergy_score": 0.87, "key_pairs": [["人参皂苷", "黄芪甲苷"], ["枸杞多糖", "小分子肽"]]},
    },
    {
        "name": "黄芪多糖胶原蛋白肽免疫调节配方",
        "description": "以黄芪多糖与胶原蛋白肽为核心，黄芪多糖通过TLR4/MyD88通路激活巨噬细胞，胶原三肽(<1000Da)促进免疫球蛋白合成，二者协同增强非特异性免疫功能。",
        "target_effects": ["增强免疫力", "调节免疫", "抗感染"],
        "composition": {
            "active_components": ["黄芪多糖", "胶原蛋白三肽", "黄芪甲苷IV"],
            "peptide_content_mg_per_100g": 80,
            "polysaccharide_content_mg_per_100g": 500
        },
        "processing_method": "黄芪水提醇沉得多糖→深海鱼胶原酶解→膜分离纯化→冻干成型",
        "dosage": "每次8-12g，每日2次",
        "storage_conditions": "密封、冷藏保存(2-8°C)",
        "shelf_life": 540,
    },
    {
        "name": "枸杞多糖大豆肽护眼配方",
        "description": "枸杞多糖富含玉米黄素与β-胡萝卜素，配合低聚肽改善肝脏对维生素A的储存与转运，协同维护视网膜黄斑区色素密度，缓解视疲劳。",
        "target_effects": ["护眼明目", "缓解视疲劳", "抗氧化"],
        "composition": {
            "active_components": ["枸杞多糖LBP-1", "大豆低聚肽", "玉米黄素", "β-胡萝卜素"],
            "peptide_content_mg_per_100g": 60,
            "zeaxanthin_content_mg_per_100g": 2
        },
        "processing_method": "枸杞子低温萃取→大豆酶解低聚肽→玉米黄素纳米乳包埋→混合均质",
        "dosage": "每次6-10g，每日2次，餐后服用",
        "storage_conditions": "密封、置阴凉干燥处",
        "shelf_life": 600,
    },
    {
        "name": "葛根素小麦肽尿酸管理配方",
        "description": "葛根总黄酮(葛根素、大豆苷元)抑制黄嘌呤氧化酶活性，配合小麦低聚肽促进尿酸排泄，从生成抑制与排泄促进双通道管理尿酸水平。",
        "target_effects": ["辅助降尿酸", "疏肝理气", "解酒护肝"],
        "composition": {
            "active_components": ["葛根素Puerarin", "大豆苷", "小麦低聚肽", "桑叶DNJ"],
            "peptide_content_mg_per_100g": 40,
            "puerarin_content_mg_per_100g": 100
        },
        "processing_method": "葛根粉提取得葛根素→小麦蛋白碱性蛋白酶水解→桑叶热水提取DNJ→喷雾干燥",
        "dosage": "每次5-8g，每日2次，饮酒前服用效果更佳",
        "storage_conditions": "密封、置阴凉干燥处，避免阳光直射",
        "shelf_life": 660,
    },
    {
        "name": "纳豆激酶红曲多肽心血管养护配方",
        "description": "纳豆激酶直接降解纤维蛋白，红曲霉素(莫纳可林K)调节脂质代谢，配合大豆肽促进一氧化氮合成、扩张血管，三位一体守护心血管健康。",
        "target_effects": ["辅助降血压", "调节血脂", "心血管养护"],
        "composition": {
            "active_components": ["纳豆激酶Nattokinase", "红曲霉素", "大豆低聚肽", "辅酶Q10"],
            "peptide_content_mg_per_100g": 70,
            "nattokinase_activity_fu_per_g": 2000
        },
        "processing_method": "纳豆发酵提取纳豆激酶→红曲米发酵得红曲霉素→大豆酶解→低温混合制粒",
        "dosage": "每次8-15g，每日1-2次，遵医嘱服用",
        "storage_conditions": "密封、冷藏保存，纳豆激酶需2-8°C避光保存",
        "shelf_life": 365,
    },
    {
        "name": "GABA茶肽助眠配方",
        "description": "茶氨酸与GABA协同调节α脑波、促进放松，配合水解茶叶肽降低皮质醇水平，从神经递质与内分泌双途径改善睡眠质量，不含褪黑素。",
        "target_effects": ["改善睡眠", "舒缓压力", "安神助眠"],
        "composition": {
            "active_components": ["GABA", "茶氨酸L-Theanine", "水解茶叶肽", "酸枣仁皂苷"],
            "peptide_content_mg_per_100g": 30,
            "gaba_content_mg_per_100g": 500
        },
        "processing_method": "茶叶低温超临界CO2萃取→GABA发酵法制备→酸枣仁水提醇沉→复配混合",
        "dosage": "每次5-10g，睡前30分钟温水冲服",
        "storage_conditions": "密封、置阴凉干燥处",
        "shelf_life": 540,
    },
    {
        "name": "益生菌后生元乳酸肽肠道健康配方",
        "description": "乳酸菌发酵产生的后生元(有机酸、细菌碎片、代谢产物)配合乳酸菌来源活性肽(LPP)，调节肠道菌群平衡，促进短链脂肪酸生成，维护肠屏障功能。",
        "target_effects": ["调节肠道菌群", "改善便秘", "促进营养吸收"],
        "composition": {
            "active_components": ["乳酸菌后生元", "乳酸三肽LTP", "低聚果糖FOS", "菊粉"],
            "peptide_content_mg_per_100g": 45,
            "probiotic_strains_count": 6
        },
        "processing_method": "乳酸菌液态发酵→巴氏杀菌得后生元→菌体蛋白酶解→添加益生元→喷雾干燥",
        "dosage": "每次6-10g，每日1-2次，温水(<40°C)冲服",
        "storage_conditions": "密封、冷藏保存",
        "shelf_life": 270,
    },
    {
        "name": "熊果酸白藜芦醇灵芝肽代谢调节配方",
        "description": "山楂熊果酸激活PPARα促进脂肪酸氧化，白藜芦醇激活SIRT1延长寿命通路，灵芝三萜保肝降脂，灵芝肽增强免疫，四效合一调节糖脂代谢。",
        "target_effects": ["辅助降血糖", "调节血脂", "保肝护肝"],
        "composition": {
            "active_components": ["熊果酸Ursolic Acid", "白藜芦醇", "灵芝三萜", "灵芝多肽"],
            "peptide_content_mg_per_100g": 55,
            "resveratrol_content_mg_per_100g": 10
        },
        "processing_method": "山楂叶提取熊果酸→红酒酵母发酵白藜芦醇→灵芝子实体醇提三萜→灵芝菌丝体发酵得肽",
        "dosage": "每次8-12g，每日2次，餐前服用",
        "storage_conditions": "密封、置阴凉干燥处，避光保存",
        "shelf_life": 730,
    },
    {
        "name": "虾青素藻油肽抗氧化配方",
        "description": "雨生红球藻天然虾青素(抗氧化力为维生素E的6000倍)配合DHA/EPA藻油，加入海参低聚肽清除自由基、减轻氧化应激损伤，全面抗衰老。",
        "target_effects": ["抗衰老", "抗氧化", "美容养颜"],
        "composition": {
            "active_components": ["虾青素Astaxanthin", "DHA藻油", "EPA", "海参低聚肽"],
            "peptide_content_mg_per_100g": 65,
            "astaxanthin_content_mg_per_100g": 4
        },
        "processing_method": "雨生红球藻微囊化虾青素→DHA/EPA藻油提取→海参脾脏低温酶解→脂质体包裹共递送",
        "dosage": "每次6-10g，每日1-2次，随餐服用",
        "storage_conditions": "密封、冷藏避光保存",
        "shelf_life": 480,
    },
    {
        "name": "乳铁蛋白骨肽钙镁VD骨骼健康配方",
        "description": "I型胶原肽(含羟脯氨酸重复序列)直接刺激成骨细胞增殖，配合碳酸钙、维生素D3促进钙沉积，乳铁蛋白增强铁吸收，构建骨骼健康完整链条。",
        "target_effects": ["强健骨骼", "补钙促吸收", "关节灵活"],
        "composition": {
            "active_components": ["I型胶原肽", "碳酸钙", "维生素D3", "乳铁蛋白Lactoferrin", "镁"],
            "peptide_content_mg_per_100g": 90,
            "calcium_content_mg_per_100g": 300
        },
        "processing_method": "动物骨骼I型胶原低温酶解→微胶囊包埋VD3→矿化复合→压片/灌装",
        "dosage": "每次10-15g，每日2次，餐后服用，配合适量运动",
        "storage_conditions": "密封、置阴凉干燥处",
        "shelf_life": 600,
    },
]


async def main():
    async with async_session_factory() as session:
        # Get admin user
        from sqlalchemy import select
        result = await session.execute(select(User).where(User.username == "admin"))
        admin = result.scalar_one_or_none()
        if not admin:
            print("ERROR: admin user not found")
            sys.exit(1)
        print(f"Using user: {admin.username} (id={admin.id})")

        created = 0
        skipped = 0

        for i, fdata in enumerate(FORMULAS, 1):
            # Check if formula with this name already exists
            existing = await session.execute(
                select(Formula).where(Formula.name == fdata["name"])
            )
            if existing.scalar_one_or_none():
                print(f"[{i:2d}/10] SKIP (already exists): {fdata['name']}")
                skipped += 1
                continue

            formula = Formula(
                name=fdata["name"],
                code=random_code(),
                description=fdata.get("description"),
                target_effects=fdata.get("target_effects", []),
                composition=fdata.get("composition", {}),
                processing_method=fdata.get("processing_method"),
                dosage=fdata.get("dosage"),
                storage_conditions=fdata.get("storage_conditions"),
                shelf_life=fdata.get("shelf_life"),
                safety_check=fdata.get("safety_check"),
                synergy_analysis=fdata.get("synergy_analysis"),
                status=FormulaStatus.DRAFT,
                version=1,
                creator_id=admin.id,
            )
            session.add(formula)
            await session.flush()  # Get the ID
            created += 1
            print(f"[{i:2d}/10] CREATE: {formula.code} - {formula.name}")

        await session.commit()
        print(f"\n{'='*60}")
        print(f"Summary: {created} created, {skipped} skipped, total {len(FORMULAS)}")


if __name__ == "__main__":
    asyncio.run(main())
