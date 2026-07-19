"""
SymMap 深度清洗脚本
====================

第二轮清洗：
1. 将英文短语型 use_part 翻译为中文
2. 修正 name_eng 中混入的拉丁名/描述性文本
3. 清理重复别名
"""
import asyncio
import sys
import os
import re

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy import text
from sqlalchemy.orm import sessionmaker
from app.core.config import settings


# ════════════════════════════════════════════════
# 英文短语 → 中文药用部位
# ════════════════════════════════════════════════

PHRASE_PART_MAP = {
    'whole herb with root': '全草',
    'whole herb': '全草',
    'dried seed': '种子',
    'ripe seed': '种子',
    'dried aerial parts': '地上部分',
    'fresh bulb': '鳞茎',
    'resinous wood': '心材',
    'dried fruit': '果实',
    'dried root': '根',
    'dried rhizome': '根茎',
    'dried bark': '树皮',
    'dried leaf': '叶',
    'dried flower': '花',
    'dried stem': '茎',
    'dried seed coat': '种皮',
    'dried pericarp': '果皮',
    'dried fruit wall': '果皮',
    'dried aril': '假种皮',
    'dried placenta': '胎座',
    'dried receptacle': '花托',
    'dried calyx': '萼',
    'dried petal': '花瓣',
    'dried stamen': '雄蕊',
    'dried pistil': '雌蕊',
    'dried ovary': '子房',
    'dried capsule': '蒴果',
    'dried achene': '瘦果',
    'dried nut': '坚果',
    'dried drupe': '核果',
    'dried berry': '浆果',
    'dried schizocarp': '双悬果',
    'dried silique': '角果',
    'dried follicle': '蓇葖果',
    'dried legume': '荚果',
    'dried samara': '翅果',
    'dried cypsela': '瘦果（菊科）',
    'dried utricles': '胞果',
    'dried mericarp': '分果',
    'dried gynobase': '花柱基部',
    'dried peduncle': '花序梗',
    'dried pedicel': '花梗',
    'dried rachis': '花序轴',
    'dried spike': '穗',
    'dried panicle': '圆锥花序',
    'dried raceme': '总状花序',
    'dried umbel': '伞形花序',
    'dried cyme': '聚伞花序',
    'dried catkin': '柔荑花序',
    'dried head': '头状花序',
    'dried cyathium': '杯状聚伞花序',
    'dried spathe': '佛焰苞',
    'dried bract': '苞片',
    'dried stipule': '托叶',
    'dried thorn': '刺',
    'dried spine': '棘',
    'dried tendril': '卷须',
    'dried root hair': '根毛',
    'dried root tip': '根尖',
    'dried rootlet': '须根',
    'dried tuber': '块茎',
    'dried bulb': '鳞茎',
    'dried corm': '球茎',
    'dried rhizome': '根茎',
    'dried stolons': '匍匐茎',
    'dried branch': '枝条',
    'dried twig': '嫩枝',
    'dried wood': '木材',
    'dried heartwood': '心材',
    'dried sapwood': '边材',
    'dried cambium': '形成层',
    'dried phloem': '韧皮部',
    'dried xylem': '木质部',
    'dried pith': '髓',
    'dried cork': '木栓层',
    'dried epidermis': '表皮',
    'dried cuticle': '角质层',
    'dried resin': '树脂',
    'dried gum': '树胶',
    'dried latex': '乳汁',
    'dried exudate': '分泌物',
    'dried gall': '虫瘿',
    'dried sclerotium': '菌核',
    'dried spore': '孢子',
    'dried pollen': '花粉',
    'dried egg': '卵',
    'dried embryo': '胚',
    'dried cotyledon': '子叶',
    'dried hypocotyl': '下胚轴',
    'dried epicotyl': '上胚轴',
    'dried radicle': '胚根',
    'dried plumule': '胚芽',
    'dried seed coat': '种皮',
    'dried testa': '种皮',
    'dried aril': '假种皮',
    'dried hilum': '种脐',
    'dried micropyle': '珠孔',
    'dried chalaza': '合点',
}

# name_eng 中常见的拉丁名/描述性文本 → 纯英文名
ENG_NAME_FIXES = {
    # 格式: 包含的拉丁词 → 期望的中文名（用于查找）
    'root of': None,       # 去掉"xxx of ..."格式
    'rhizome of': None,
    'herb of': None,
    'leaf of': None,
    'fruit of': None,
    'seed of': None,
    'flower of': None,
    'bark of': None,
    'wood of': None,
    'stem of': None,
    'of Gansui': '甘遂',
    'of Common Turmeric': '姜黄',
    'of Siberian Cockleblur': '苍耳子',
    'of Spreading Hedyotis': '白花蛇舌草',
    'of Chelidonium': '白屈菜',
    'of Red Peony': '赤芍',
    'of Morinda': '巴戟天',
    'of Platycladi': '柏子仁',
    'of Zanthoxyli': '花椒',
    'of Celosiae': '鸡冠花',
    'of Ampelopsis': '白蔹',
    'of Piperis Longi': '荜茇',
    'of Solani': '白毛藤',
    'of Cleomis': '白花菜子',
    'of Dysosmae': '八角莲',
    'of Chelidonii': '白屈菜',
}


async def deep_clean():
    print("=" * 70)
    print("  SymMap 深度清洗 v2")
    print("=" * 70)

    engine = create_async_engine(settings.database.url, echo=False, pool_pre_ping=True)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    stats = {'use_part_fixed': 0, 'name_eng_fixed': 0, 'name_eng_cleared': 0}

    async with async_session() as session:
        # ─── 1. 清洗 use_part ───
        print("\n[1/3] 清洗药用部位...")
        r = await session.execute(text("""
            SELECT symmap_id, name_cn, use_part
            FROM symmap_herbs
            WHERE use_part IS NOT NULL AND use_part <> ''
            AND use_part ~ '[a-zA-Z]'
            AND LENGTH(use_part) > 3
        """))
        rows = r.fetchall()
        print(f"  找到 {len(rows)} 条含英文的 use_part")

        for sid, name_cn, en_part in rows:
            key = en_part.strip().lower()
            cn_part = PHRASE_PART_MAP.get(key)
            if cn_part:
                await session.execute(
                    text("UPDATE symmap_herbs SET use_part = :part WHERE symmap_id = :id"),
                    {"part": cn_part, "id": sid}
                )
                stats['use_part_fixed'] += 1
                print(f"    {name_cn}: [{en_part}] -> [{cn_part}]")

        # ─── 2. 清洗 name_eng ───
        print("\n[2/3] 清洗英文名...")
        r = await session.execute(text("""
            SELECT symmap_id, name_cn, name_eng
            FROM symmap_herbs
            WHERE name_eng IS NOT NULL AND name_eng <> ''
            AND (
                name_eng ~ '[Rr]hizome|[Rr]oot|[Hh]erba|[Hh]erb|[Cc]ortex|[Rr]adix|[Ss]emen|[Ff]olium|[Ff]ructus|[Ll]ilii|[Pp]iper|[Ss]olan'
                OR LENGTH(name_eng) > 25
                OR name_eng ~ '[a-z]+ of [A-Z]'
            )
        """))
        rows = r.fetchall()
        print(f"  找到 {len(rows)} 条可疑 name_eng")

        for sid, name_cn, en_eng in rows:
            # 尝试从 COMMON_EN 映射中找到正确英文名
            eng = find_good_eng_name(name_cn)
            if eng:
                await session.execute(
                    text("UPDATE symmap_herbs SET name_eng = :eng WHERE symmap_id = :id"),
                    {"eng": eng, "id": sid}
                )
                stats['name_eng_fixed'] += 1
                print(f"    {name_cn}: [{en_eng}] -> [{eng}]")
            else:
                # 没有英文名就清空
                await session.execute(
                    text("UPDATE symmap_herbs SET name_eng = NULL WHERE symmap_id = :id"),
                    {"id": sid}
                )
                stats['name_eng_cleared'] += 1

        # ─── 3. 清理 alias 中的特殊字符 ───
        print("\n[3/3] 清理别名数据...")
        r = await session.execute(text("""
            SELECT symmap_id, name_cn, alias
            FROM symmap_herbs
            WHERE alias IS NOT NULL AND alias <> ''
            AND alias ~ '(bar|\\?)'
        """))
        rows = r.fetchall()
        for sid, name_cn, alias in rows:
            # 清理乱码/特殊字符
            cleaned = re.sub(r'[?�]', '', alias)
            cleaned = re.sub(r'\s+', ' ', cleaned).strip()
            if cleaned and cleaned != alias:
                await session.execute(
                    text("UPDATE symmap_herbs SET alias = :alias WHERE symmap_id = :id"),
                    {"alias": cleaned, "id": sid}
                )
                stats['name_eng_fixed'] += 1  # count as alias fix too

        await session.commit()

    await engine.dispose()

    print(f"\n清洗报告:")
    print(f"  use_part 修正: {stats['use_part_fixed']} 条")
    print(f"  name_eng 修正: {stats['name_eng_fixed']} 条")
    print(f"  name_eng 清空: {stats['name_eng_cleared']} 条")
    print(f"\n{'=' * 70}")


def find_good_eng_name(name_cn: str) -> str:
    """查找正确的英文名"""
    COMMON_EN = {
        '人参': 'Ginseng', '党参': 'Codonopsis Root', '黄芪': 'Astragalus Root',
        '甘草': 'Licorice Root', '当归': 'Angelica Sinensis Root',
        '白芍': 'White Peony Root', '赤芍': 'Red Peony Root',
        '熟地黄': 'Rehmannia Root (Prepared)', '生地黄': 'Rehmannia Root',
        '川芎': 'Szechwan Lovage Root', '白术': 'Atractylodes Rhizome',
        '茯苓': 'Poria', '猪苓': 'Polyporus', '泽泻': 'Alisma Rhizome',
        '山药': 'Chinese Yam Rhizome', '黄连': 'Coptis Rhizome',
        '黄芩': 'Baikal Skullcap Root', '黄柏': 'Amur Cork Tree Bark',
        '栀子': 'Gardenia Fruit', '大黄': 'Rhubarb Root',
        '芒硝': 'Mirabilite', '附子': 'Fleeceflower Root (Prepared)',
        '干姜': 'Dried Ginger Rhizome', '肉桂': 'Cinnamon Bark',
        '桂枝': 'Cassia Twig', '麻黄': 'Ephedra Herb',
        '柴胡': 'Bupleurum Root', '半夏': 'Pinellia Tuber',
        '天南星': 'Arisaema Rhizome', '桔梗': 'Platycodon Root',
        '枳实': 'Bitter Orange Fruit (Immature)', '陈皮': 'Tangerine Peel',
        '青皮': 'Green Tangerine Peel', '香附': 'Cyperus Rhizome',
        '木香': 'Costus Root', '砂仁': 'Amomum Fruit',
        '豆蔻': 'Cardamom Fruit', '丁香': 'Clove Bud',
        '小茴香': 'Fennel Fruit', '大茴香': 'Star Anise Fruit',
        '吴茱萸': 'Evodia Fruit', '延胡索': 'Corydalis Rhizome',
        '丹参': 'Salvia Root', '川牛膝': 'Cyathula Root',
        '怀牛膝': 'Achyranthes Root', '桃仁': 'Peach Seed',
        '红花': 'Safflower Flower', '三七': 'Notoginseng Root',
        '莪术': 'Curcuma Rhizome', '三棱': 'Samal Rhizome',
        '益母草': 'Leonurus Herb', '牛膝': 'Achyranthes Root',
        '杜仲': 'Eucommia Bark', '续断': 'Dipsacus Root',
        '巴戟天': 'Morinda Root', '肉苁蓉': 'Cistanche Herb',
        '锁阳': 'Cynomorium', '淫羊藿': 'Epimedium Herb',
        '补骨脂': 'Psoralea Fruit', '菟丝子': 'Dodder Seed',
        '山茱萸': 'Cornus Fruit', '枸杞子': 'Goji Berry',
        '五味子': 'Schisandra Fruit', '麦冬': 'Ophiopogon Tuber',
        '天冬': 'Asparagus Root', '玉竹': 'Polygonatum Rhizome',
        '石斛': 'Dendrobium Stem', '黄精': 'Polygonatum Rhizome',
        '百合': 'Lily Bulb', '阿胶': 'Donkey-hide Gelatin',
        '龟甲': 'Turtle Shell', '鳖甲': 'Softshell Turtle Shell',
        '鹿茸': 'Velvet Antler', '珍珠': 'Pearl',
        '牡蛎': 'Oyster Shell', '龙骨': 'Fossil Bone',
        '赭石': 'Haematite', '石决明': 'Abalone Shell',
        '珍珠母': 'Mother-of-Pearl', '全蝎': 'Scorpion',
        '蜈蚣': 'Centipede', '土鳖虫': 'Ground Beetle',
        '水蛭': 'Leech', '斑蝥': 'Spanish Fly',
        '麝香': 'Musk', '牛黄': 'Calculus Bovis',
        '熊胆': 'Bear Gallstone', '蟾酥': 'Toad Venom',
        '僵蚕': 'Stiff Silkworm', '蝉蜕': 'Cicada Slough',
        '蛇蜕': 'Snake Slough', '羚羊角': 'Antelope Horn',
        '钩藤': 'Uncaria Twig', '天麻': 'Gastrodia Rhizome',
        '石菖蒲': 'Acorus Rhizome', '远志': 'Polygala Root',
        '酸枣仁': 'Jujube Seed', '柏子仁': 'Platycladi Seed',
        '磁石': 'Magnetite', '代赭石': 'Haematite',
        '罗布麻': 'Apocynum Leaf', '菊花': 'Chrysanthemum Flower',
        '金银花': 'Honeysuckle Flower', '连翘': 'Forsythia Fruit',
        '板蓝根': 'Isatis Root', '大青叶': 'Isatis Leaf',
        '蒲公英': 'Dandelion Herb', '鱼腥草': 'Houttuynia Herb',
        '白头翁': 'Pulsatilla Root', '马齿苋': 'Purslane Herb',
        '败酱草': 'Patrinia Herb', '白花蛇舌草': 'Hedyotis Herb',
        '半枝莲': 'Scutellaria Herb', '紫花地丁': 'Viola Herb',
        '穿心莲': 'Andrographis Herb', '龙胆': 'Gentian Root',
        '苦参': 'Sophora Root', '白鲜皮': 'Dictamnus Bark',
        '秦艽': 'Gentian Rhizome', '防己': 'Stephania Root',
        '威灵仙': 'Clematis Root', '独活': 'Angelica Pubescens Root',
        '细辛': 'Asarum Herb', '羌活': 'Notopterygium Rhizome',
        '防风': 'Saposhnikovia Root', '藁本': 'Ligusticum Rhizome',
        '辛夷': 'Magnolia Bud', '薄荷': 'Peppermint Herb',
        '桑叶': 'Mulberry Leaf', '葛根': 'Kudzu Root',
        '升麻': 'Cimicifuga Rhizome', '浮萍': 'Duckweed',
        '牛蒡子': 'Arctium Fruit', '蔓荆子': 'Vitex Fruit',
        '淡豆豉': 'Soja Seed (Prepared)', '生姜': 'Fresh Ginger Rhizome',
        '大枣': 'Jujube Fruit', '甘草': 'Licorice Root',
        '白茅根': 'Imperata Rhizome', '天花粉': 'Trichosanthes Root',
        '知母': 'Anemarrhena Rhizome', '贝母': 'Fritillaria Bulb',
        '瓜蒌': 'Trichosanthes Fruit', '竹茹': 'Bamboo Shavings',
        '竹沥': 'Bamboo Sap', '天竺黄': 'Bamboo Manna',
        '海藻': 'Seaweed', '昆布': 'Kelp', '黄药子': 'Dioscorea Bulbil',
        '海浮石': 'Pumice', '礞石': 'Mica Schist',
        '旋覆花': 'Inula Flower', '白前': 'Cynanchum Rhizome',
        '前胡': 'Peucedanum Root', '皂荚': 'Gleditsia Fruit',
        '郁金': 'Curcuma Root Tubers', '姜黄': 'Turmeric Rhizome',
        '川楝子': 'Toona Fruit', '乌药': 'Lindera Root',
        '沉香': 'Agarwood', '檀香': 'Sandalwood',
        '高良姜': 'Galangal Rhizome', '荜茇': 'Long Pepper Fruit',
        '胡椒': 'Pepper Fruit', '花椒': 'Zanthoxylum Fruit',
        '肉豆蔻': 'Nutmeg', '草豆蔻': 'Arenga Catkin',
        '草果': 'Tsaoko Fruit', '白豆蔻': 'White Cardamom',
        '苍术': 'Atractylodes Rhizome', '厚朴': 'Magnolia Bark',
        '佩兰': 'Eupatorium Herb', '藿香': 'Patchouli Herb',
        '茵陈': 'Artemisia Scoparia Herb', '金钱草': 'Lysimachia Herb',
        '海金沙': 'Lygodium Spore', '石韦': 'Pyrrosia Leaf',
        '车前子': 'Plantago Seed', '滑石': 'Talc',
        '瞿麦': 'Dianthus Herb', '扁蓄': 'Persicaria Herb',
        '冬葵子': 'Mallow Seed', '木通': 'Akebia Stem',
        '通草': 'Tetrapanax Pith', '地肤子': 'Kochia Fruit',
        '萆薢': 'Dioscorea Hypoglauca Rhizome', '土茯苓': 'Smilax Rhizome',
        '松花粉': 'Pine Pollen', '玉米须': 'Corn Silk',
        '荷叶': 'Lotus Leaf', '荷梗': 'Lotus Stem',
        '荷花': 'Lotus Flower', '莲子': 'Lotus Seed',
        '莲房': 'Lotus receptacle', '莲须': 'Lotus Stamen',
        '龙眼肉': 'Longan Aril', '蜂蜜': 'Honey',
        '饴糖': 'Malt Sugar', '冰糖': 'Rock Sugar',
        '红糖': 'Brown Sugar', '菊花': 'Chrysanthemum Flower',
        '桑白皮': 'Mulberry Root Bark', '地骨皮': 'Lycium Bark',
        '银柴胡': 'Stellaria Root', '胡黄连': 'Picrorhiza Rhizome',
        '雷公藤': 'Tripterygium Root', '徐长卿': 'Radix Cynanchi Paniculati',
        '青蒿': 'Artemisia Annua Herb', '牡丹皮': 'Moutan Bark',
    }
    return COMMON_EN.get(name_cn, '')


if __name__ == "__main__":
    asyncio.run(deep_clean())
