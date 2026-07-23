"""
食品原料数据导入管线

用于 Potion AI VFT × RMFOOD 深度融合方案。
导入中国药食同源目录、常见食品原料等基础数据。

用法:
    python -m scripts.import_food_materials
"""
import asyncio
import logging
import sys
import os

# 确保 backend 在 path 中
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

# ── 药食同源目录数据 (基于卫健委官方目录) ──

YAO_SHI_TONG_YUAN_DATA = [
    # (name_cn, name_latin, name_en, category, sub_category, effects, toxicity, safe_dose_max, description, aliases)
    ("山药", "Dioscorea opposita", "Chinese Yam", "中药材", "根茎类",
     ["健脾养胃", "润肺止咳", "益肾固精"], "无毒", 30,
     "薯蓣科植物薯蓣的干燥根茎。味甘性平，归脾、肺、肾经。", ["淮山药", "薯蓣"]),
    ("茯苓", "Poria cocos", "Poria", "中药材", "菌类",
     ["利水渗湿", "健脾宁心"], "无毒", 15,
     "多孔菌科真菌茯苓的干燥菌核。味甘淡性平，归心、肺、脾、肾经。", ["云苓", "茯灵"]),
    ("山楂", "Crataegus pinnatifida", "Hawthorn", "中药材", "果实类",
     ["消食健胃", "行气散瘀", "化浊降脂"], "无毒", 10,
     "蔷薇科植物山里红或山楂的干燥成熟果实。", ["山里红"]),
    ("马齿苋", "Portulaca oleracea", "Purslane", "中药材", "全草类",
     ["清热解毒", "凉血止血"], "无毒", 15,
     "马齿苋科植物马齿苋的干燥全草。", ["马苋", "长寿菜"]),
    ("乌梅", "Prunus mume", "Japanese Apricot", "中药材", "果实类",
     ["敛肺止咳", "涩肠止泻", "生津止渴", "安蛔止痛"], "无毒", 10,
     "蔷薇科植物梅的干燥近成熟果实。", ["熏梅"]),
    ("木瓜", "Chaenomeles sinensis", "Chinese Quince", "中药材", "果实类",
     ["舒筋活络", "和胃化湿"], "无毒", 10,
     "蔷薇科植物贴梗海棠的干燥近成熟果实。", ["宣木瓜"]),
    ("火麻仁", "Cannabis sativa", "Hemp Seed", "中药材", "果实类",
     ["润肠通便"], "无毒", 10,
     "桑科植物大麻的干燥成熟种子。", ["大麻仁", "麻子仁"]),
    ("代代花", "Citrus aurantium", "Bitter Orange Flower", "中药材", "花类",
     ["理气宽胸", "开胃止呕"], "无毒", 5,
     "芸香科植物酸橙及其栽培变种的花蕾。"),
    ("玉竹", "Polygonatum odoratum", "Solomon's Seal", "中药材", "根茎类",
     ["养阴润燥", "生津止渴"], "无毒", 10,
     "百合科植物玉竹的干燥根茎。", ["葳蕤", "尾参"]),
    ("甘草", "Glycyrrhiza uralensis", "Licorice Root", "中药材", "根茎类",
     ["补脾益气", "清热解毒", "祛痰止咳", "调和诸药"], "无毒", 10,
     "豆科植物甘草、胀果甘草或光果甘草的干燥根和根茎。", ["甜草根", "红甘草"]),
    ("白芷", "Angelica dahurica", "Chinese Angelica", "中药材", "根茎类",
     ["解表散寒", "祛风止痛", "通鼻窍", "消肿排脓"], "无毒", 10,
     "伞形科植物白芷或杭白芷的干燥根。"),
    ("白果", "Ginkgo biloba", "Ginkgo Nut", "中药材", "果实类",
     ["敛肺定喘", "止带缩尿"], "无毒", 10,
     "银杏科植物银杏的干燥成熟种子。", ["银杏", "公孙果"]),
    ("白扁豆", "Lablab purpureus", "Hyacinth Bean", "中药材", "果实类",
     ["健脾化湿", "和中消暑"], "无毒", 15,
     "豆科植物扁豆的干燥种子。"),
    ("白茅根", "Imperata cylindrica", "Cogongrass Root", "中药材", "根茎类",
     ["凉血止血", "清热利尿"], "无毒", 15,
     "禾本科植物白茅的干燥根茎。", ["白根", "地筋"]),
    ("决明子", "Cassia obtusifolia", "Cassia Seed", "中药材", "果实类",
     ["清热明目", "润肠通便"], "无毒", 15,
     "豆科植物决明或小决明的干燥成熟种子。", ["草决明", "还瞳子"]),
    ("百合", "Lilium brownii", "Lily Bulb", "中药材", "鳞茎类",
     ["养阴润肺", "清心安神"], "无毒", 15,
     "百合科植物百合的干燥肉质鳞叶。", ["夜合花"]),
    ("杜仲叶", "Eucommia ulmoides", "Eucommia Leaf", "普通食品", "植物叶",
     ["补肝肾", "强筋骨"], "无毒", 10,
     "杜仲树的干燥叶片。", ["思仙"]),
    ("牡蛎", "Gaetostrea gigas", "Oyster", "普通食品", "水产品",
     ["补钙", "富含锌"], "无毒", 50,
     "牡蛎属动物的贝壳或全体。", ["海蛎子"]),
    ("亚麻仁", "Linum usitatissimum", "Flaxseed", "普通食品", "坚果种子类",
     ["润肠通便", "富含Omega-3"], "无毒", 15,
     "亚麻科植物亚麻的干燥成熟种子。", ["胡麻仁"]),
    ("低聚木糖", "Xylooligosaccharide", "XOS", "食品添加剂", "益生元",
     ["调节肠道菌群", "促进双歧杆菌增殖"], "无毒", 5,
     "由2-7个木糖分子组成的低聚糖。"),
    ("佛手", "Citrus medica", "Finger Citron", "中药材", "果实类",
     ["疏肝理气", "和胃止痛", "燥湿化痰"], "无毒", 6,
     "芸香科植物佛手的干燥果实。", ["佛手柑", "五指柑"]),
    ("余甘子", "Phyllanthus emblica", "Indian Gooseberry", "中药材", "果实类",
     ["清热凉血", "消炎解毒", "生津止咳"], "无毒", 10,
     "大戟科植物余甘子的干燥成熟果实。", ["庵摩勒", "滇橄榄"]),
    ("杏叶", "Prunus armeniaca", "Apricot Leaf", "普通食品", "植物叶",
     ["润肺止咳"], "无毒", 10,
     "蔷薇科植物杏的干燥叶。"),
    ("玫瑰花", "Rosa rugosa", "Rose", "中药材", "花类",
     ["行气解郁", "活血止痛"], "无毒", 6,
     "蔷薇科植物玫瑰的干燥花蕾。", ["红玫瑰"]),
    ("罗汉果", "Siraitia grosvenorii", "Monk Fruit", "中药材", "果实类",
     ["清热润肺", "利咽开音", "滑肠通便"], "无毒", 15,
     "葫芦科植物罗汉果的干燥果实。"),
    ("鱼腥草", "Houttuynia cordata", "Houttuynia", "中药材", "全草类",
     ["清热解毒", "消痈排脓", "利尿通淋"], "无毒", 15,
     "三白草科植物蕺菜的干燥全草。", ["折耳根", "岑草"]),
    ("知母", "Anemarrhena asphodeloides", "Anemarrhena", "中药材", "根茎类",
     ["清热泻火", "生津润燥"], "无毒", 10,
     "百合科植物知母的干燥根茎。", ["知母草"]),
    ("苦杏仁", "Prunus armeniaca var. ansu", "Bitter Apricot Kernel", "中药材", "果实类",
     ["降气止咳平喘", "润肠通便"], "小毒", 5,
     "蔷薇科植物山杏、西伯利亚杏、东北杏或杏的干燥成熟种子。", ["杏核仁"]),
    ("胖大海", "Sterculia lychnophora", "Malva Nut", "中药材", "果实类",
     ["清热润肺", "利咽开音", "润肠通便"], "无毒", 3,
     "梧桐科植物胖大海的干燥种子。", ["大海", "大发"]),
    ("胖大海", "Sterculia lychnophora", "Malva Nut", "中药材", "果实类",
     ["清热润肺", "利咽开音", "润肠通便"], "无毒", 3,
     "梧桐科植物胖大海的干燥种子。", ["大海", "大发"]),
    ("薏苡仁", "Coix lacryma-jobi", "Job's Tears", "中药材", "果实类",
     ["利水渗湿", "健脾止泻", "除痹排脓"], "无毒", 30,
     "禾本科植物薏苡的干燥成熟种子。", ["薏米", "苡仁"]),
    ("薤白", "Allium macrostemon", "Smallhead Garlic", "中药材", "鳞茎类",
     ["通阳散结", "行气导滞"], "无毒", 6,
     "百合科植物小根蒜的干燥鳞茎。", ["小根蒜"]),
    ("鲜白茅根", "Imperata cylindrica", "Fresh Cogongrass Root", "中药材", "根茎类",
     ["凉血止血", "清热利尿"], "无毒", 30,
     "禾本科植物白茅的新鲜根茎。"),
    ("鲜石斛", "Dendrobium nobile", "Fresh Dendrobium", "中药材", "茎类",
     ["益胃生津", "滋阴清热"], "无毒", 15,
     "兰科植物铁皮石斛、环草石斛等的新鲜茎。", ["吊兰花"]),
    ("葛花", "Pueraria lobata", "Kudzu Flower", "中药材", "花类",
     ["解酒醒脾"], "无毒", 3,
     "豆科植物野葛的干燥花。"),
    ("墨旱莲", "Eclipta prostrata", "Eclipta", "中药材", "全草类",
     ["滋补肝肾", "凉血止血"], "无毒", 10,
     "菊科植物鳢肠的干燥全草。", ["旱莲草"]),
    ("高良姜", "Alpinia officinarum", "Lesser Galangal", "中药材", "根茎类",
     ["温胃止呕", "散寒止痛"], "无毒", 6,
     "姜科植物高良姜的干燥根茎。", ["良姜"]),
]

# 普通食品原料补充
COMMON_FOODS_DATA = [
    # (name_cn, category, sub_category, effects, description)
    ("大米", "普通食品", "谷物类", ["提供能量", "健脾和胃"], "稻米的种子，主要碳水化合物来源。"),
    ("小麦", "普通食品", "谷物类", ["养心安神", "健脾益气"], "小麦的种子，面粉的主要原料。"),
    ("玉米", "普通食品", "谷物类", ["健脾养胃", "通便"], "玉蜀黍的干燥成熟种子。"),
    ("大豆", "普通食品", "豆类", ["健脾宽中", "润肠排毒"], "大豆的种子，优质植物蛋白来源。"),
    ("花生", "普通食品", "坚果类", ["健脾和胃", "润肺化痰"], "落花生科植物花生的干燥成熟种子。"),
    ("黑芝麻", "普通食品", "坚果类", ["补肝肾", "益精血", "润肠燥"], "胡麻科植物脂麻的干燥成熟种子。"),
    ("核桃仁", "普通食品", "坚果类", ["补肾温肺", "润肠通便"], "胡桃科植物胡桃的干燥种仁。", ["胡桃仁"]),
    ("蜂蜜", "普通食品", "天然甜味剂", ["补中益气", "润燥止痛"], "蜜蜂科昆虫中华蜜蜂或意大利蜂所酿。"),
    ("生姜", "普通食品", "调味品", ["解表散寒", "温中止呕"], "姜科植物姜的新鲜根茎。", ["老姜", "干姜"]),
    ("大蒜", "普通食品", "调味品", ["解毒消肿", "杀虫"], "百合科植物蒜的鳞茎。"),
    ("枸杞子", "Lycium barbarum", "普通食品", "果实类", ["滋补肝肾", "益精明目"], "茄科植物宁夏枸杞的干燥成熟果实。", ["苟起子", "红耳坠"]),
    ("菊花", "Chrysanthemum morifolium", "普通食品", "花类", ["疏散风热", "平肝明目", "清热解毒"], "菊科植物菊的干燥头状花序。", ["杭菊花", "甘菊"]),
    ("桑叶", "Morus alba", "普通食品", "植物叶类", ["疏散风热", "清肺润燥", "清肝明目"], "桑科植物桑的干燥叶。", ["霜桑叶"]),
    ("薄荷", "Mentha haplocalyx", "普通食品", "全草类", ["疏散风热", "清利头目", "利咽透疹", "疏肝行气"], "唇形科植物薄荷的干燥地上部分。", ["夜息香"]),
    ("陈皮", "Citrus reticulata", "普通食品", "果皮类", ["理气健脾", "燥湿化痰"], "芸香科植物橘及其栽培变种的干燥成熟果皮。", ["广陈皮", "橘红"]),
    ("莲子", "Nelumbo nucifera", "普通食品", "果实类", ["补脾止泻", "益肾涩精", "养心安神"], "睡莲科植物莲的干燥成熟种子。"),
    ("桂圆肉", "Dimocarpus longan", "普通食品", "果实类", ["补益心脾", "养血安神"], "无患子科植物龙眼的假种皮。", ["龙眼肉"]),
    ("赤小豆", "Vigna umbellata", "普通食品", "豆类", ["利水消肿", "解毒排脓"], "豆科植物赤小豆或赤豆的干燥种子。", ["红小豆"]),
    ("荷叶", "Nelumbo nucifera", "普通食品", "叶类", ["清暑化湿", "升发清阳", "凉血止血"], "睡莲科植物莲的干燥叶。", ["莲花叶"]),
    ("淡竹叶", "Lophatherum gracile", "普通食品", "全草类", ["清热泻火", "除烦止渴", "利尿通淋"], "禾本科植物淡竹叶的干燥茎叶。", ["竹叶"]),
    ("百合", "Lilium brownii", "普通食品", "鳞茎类", ["养阴润肺", "清心安神"], "百合科植物卷丹、百合或细叶百合的干燥肉质鳞叶。"),
    ("桑葚", "Morus alba", "普通食品", "果实类", ["滋阴补血", "生津润燥"], "桑科植物桑的干燥果穗。", ["桑椹", "桑枣"]),
    ("麦芽", "Hordeum vulgare", "普通食品", "果实类", ["行气消食", "健脾开胃", "回乳消胀"], "禾本科植物大麦的成熟果实经发芽干燥而成。", ["大麦芽"]),
    ("火麻仁", "Cannabis sativa", "普通食品", "果实类", ["润肠通便"], "桑科植物大麻的干燥成熟种子。"),
    ("枳椇子", "Hovenia dulcis", "普通食品", "果实类", ["解酒毒", "止渴除烦", "止呕", "止泻"], "鼠李科植物枳椇的干燥成熟种子。", ["拐枣"]),
]


def build_food_material_records():
    """构建食品原料数据记录列表"""
    records = []

    # 药食同源目录
    for item in YAO_SHI_TONG_YUAN_DATA:
        name_cn = item[0]
        name_latin = item[1] if len(item) > 1 else None
        name_en = item[2] if len(item) > 2 else None
        category = item[3] if len(item) > 3 else "中药材"
        sub_category = item[4] if len(item) > 4 else None
        effects = item[5] if len(item) > 5 else []
        toxicity = item[6] if len(item) > 6 else "无毒"
        safe_dose_max = item[7] if len(item) > 7 else None
        description = item[8] if len(item) > 8 else None
        aliases = item[9] if len(item) > 9 else []

        records.append({
            "name_cn": name_cn,
            "name_latin": name_latin,
            "name_en": name_en,
            "aliases": aliases,
            "category": category,
            "sub_category": sub_category,
            "food_homology": True,
            "toxicity_class": toxicity,
            "effects": effects,
            "description": description,
            "safe_dose_max": safe_dose_max,
            "regulatory_status": "已批准",
            "source_db": "卫健委药食同源目录",
            "data_quality": 0.95,
            "review_status": "approved",
        })

    # 普通食品
    for item in COMMON_FOODS_DATA:
        name_cn = item[0]
        name_latin = item[1] if len(item) > 1 else None
        category = item[2] if len(item) > 2 else "普通食品"
        sub_category = item[3] if len(item) > 3 else None
        effects = item[4] if len(item) > 4 else []
        description = item[5] if len(item) > 5 else None
        aliases = item[6] if len(item) > 6 else []

        records.append({
            "name_cn": name_cn,
            "name_latin": name_latin,
            "aliases": aliases,
            "category": category,
            "sub_category": sub_category,
            "food_homology": False,
            "toxicity_class": "无毒",
            "effects": effects,
            "description": description,
            "regulatory_status": "已批准",
            "source_db": "国内食品数据库",
            "data_quality": 0.9,
            "review_status": "approved",
        })

    return records


async def import_records(db, records):
    """批量导入记录到数据库"""
    from sqlalchemy import select, func
    from app.models.food_material import FoodMaterial

    # 检查是否已有数据
    count_result = await db.execute(select(func.count(FoodMaterial.id)))
    existing_count = count_result.scalar() or 0

    if existing_count > 0:
        logger.info(f"数据库中已有 {existing_count} 条食品原料记录，跳过导入")
        return 0

    # 插入数据
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc)

    inserted = 0
    for rec in records:
        material = FoodMaterial(
            name_cn=rec["name_cn"],
            name_latin=rec.get("name_latin"),
            name_en=rec.get("name_en"),
            aliases=rec.get("aliases"),
            category=rec["category"],
            sub_category=rec.get("sub_category"),
            food_homology=rec["food_homology"],
            toxicity_class=rec["toxicity_class"],
            active_ingredients=[],
            effects=rec.get("effects"),
            indications="",
            safe_dose_max=rec.get("safe_dose_max"),
            regulatory_status=rec["regulatory_status"],
            description=rec.get("description"),
            source_db=rec["source_db"],
            data_quality=rec["data_quality"],
            review_status=rec["review_status"],
            created_at=now,
            updated_at=now,
        )
        db.add(material)
        inserted += 1

    await db.commit()
    logger.info(f"成功导入 {inserted} 条食品原料记录")
    return inserted


async def main():
    """主入口"""
    from app.core.session import engine
    from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

    async_session = async_sessionmaker(engine, expire_on_commit=False)

    records = build_food_material_records()
    logger.info(f"准备导入 {len(records)} 条食品原料记录")

    async with async_session() as db:
        count = await import_records(db, records)

    if count > 0:
        logger.info("数据导入完成！")
        logger.info("下一步: 运行 backend/scripts/generate_embeddings.py 生成向量嵌入")
    else:
        logger.info("无需导入（数据已存在）")


if __name__ == "__main__":
    asyncio.run(main())
