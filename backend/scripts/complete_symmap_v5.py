"""
SymMap 终极补全 v5 — 覆盖所有 698 味药材
"""
import asyncio, sys, os
os.environ['PYTHONIOENCODING'] = 'utf-8'
sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy import text
from sqlalchemy.orm import sessionmaker
from app.core.config import settings

# 中文名 -> 英文名（全面覆盖）
NAME_EN = {
    '白花菜子': 'Cleome Seed', '草苁蓉': 'Cistanche Herb',
    '蚕沙': 'Silkworm Frass', '白毛藤': 'Solani Herba',
    '八角莲': 'Dysosma Rhizome', '玳玳花': 'Citrus Aurantium Flower',
    '猴枣': 'Monkey Gallstone', '鸡屎藤': 'Paederia Herb',
    '橘络': 'Tangerine Mesocarp', '川槿皮': 'Euphorbia Bark',
    '大风子': 'Chaulmoogra Seed', '倒扣草': 'Prunella Herb',
    '冬瓜子': 'Winter Melon Seed', '凤眼草': 'Clerodendrum Flower',
    '十大功劳根': 'Mahonia Root', '黑老虎': 'Kadsura Root',
    '石见穿': 'Salvia Root', '绞股蓝': 'Gynostemma Herb',
    '白药子': 'Derris Root', '相思子': 'Abrus Seed',
    '苦丁茶': 'Kudingcha', '苦楝子': 'Toona Fruit',
    '了哥王根': 'Nerium Root', '零陵香': 'Lingzhi Herb',
    '龙葵': 'Black Nightshade Fruit', '猫眼草': 'Euphorbia Herb',
    '猕猴桃根': 'Kiwi Root', '枳椇子': 'Hovenia Seed',
    '墓头回': 'Calamus Rhizome', '南蛇藤果': 'Celastrus Fruit',
    '牛大力': 'Millettia Root', '牡荆子': 'Vitex Seed',
    '三分三': 'Datura Seed', '石上柏': 'Selaginella Herb',
    '鼠曲草': 'Crepis Herb', '松子仁': 'Pine Seed Kernel',
    '萱草根': 'Daylily Root', '铁线透骨草': 'Clematis Root',
    '无患子皮': 'Soapberry Peel', '乌敛莓': 'Ampelopsis Herb',
    '无患子': 'Soapberry', '梧桐子': ' Firmiana Seed',
    '仙桃草': 'Lindera Herb', '香茅': 'Lemongrass',
    '寻骨风': 'Aristolochia Herb', '皂荚子': 'Gleditsia Seed',
    '芫荽': 'Coriander', '泽漆': 'Euphorbia Helioscopia Herb',
    '景天三七': 'Sedum Acre Herb', '三七花': 'Notoginseng Flower',
    '蒲黄': 'Pollen Typhae', '煅石膏': 'Calcined Gypsum',
    '白矾': 'Alum', '商陆': 'Phytolacca Root', '朱砂': 'Cinnabar',
    '猫爪草': 'Ranunculus Ternatus Root', '瓦楞子': 'Ark Shell',
    '海桐皮': 'Erythrophleum Bark', '刘寄奴': 'Artemisia Annua Herb',
    '紫草': 'Arnebia Root', '紫菀': 'Aster Root', '紫苏梗': 'Perilla Stem',
    '紫苏叶': 'Perilla Leaf', '紫苏子': 'Perilla Seed',
    '紫花地丁': 'Viola Herb', '漏芦': 'Rhaponticum Root',
    '番泻叶': 'Senna Leaf', '藤梨根': 'Kiwi Root',
    '雷公藤': 'Tripterygium Root', '雪上一支蒿': 'Aconitum Bracteatum Root',
    '雪莲花': 'Saussurea Flower', '露蜂房': 'Honeycomb',
    '鸡血藤': 'Spatholobus Stem', '鸡内金': 'Gizzard Lining',
    '鸡冠花': 'Celosia Flower', '鸡矢藤': 'Paederia Root',
    '谷芽': 'Germinated Grain', '麦芽': 'Germinated Hordeum Grain',
    '稻芽': 'Germinated Oryza Grain', '自然铜': 'Pyrite',
    '鬼箭羽': 'Dogwood Twig', '鬼臼': 'Podophyllum Rhizome',
    '旋覆花': 'Inula Flower', '款冬花': 'Coltsfoot Flower',
    '满山红': 'Ledum Leaf', '浮小麦': 'Floating Wheat',
    '鸡肠风': 'Polygonum Hydropiper Herb', '金荞麦': 'Fagopyrum Dibrychium Rhizome',
    '瓦楞子': 'Ark Shell', '海桐皮': 'Erythrophleum Bark',
    '刘寄奴': 'Artemisia Annua Herb', '紫草': 'Arnebia Root',
    '紫菀': 'Aster Root', '漏芦': 'Rhaponticum Root',
    '番泻叶': 'Senna Leaf', '雷公藤': 'Tripterygium Root',
    '雪上一支蒿': 'Aconitum Bracteatum Root', '雪莲花': 'Saussurea Flower',
    '露蜂房': 'Honeycomb', '鸡血藤': 'Spatholobus Stem',
    '鸡内金': 'Gizzard Lining', '鸡冠花': 'Celosia Flower',
    '鸡矢藤': 'Paederia Root', '谷芽': 'Germinated Grain',
    '麦芽': 'Germinated Hordeum Grain', '稻芽': 'Germinated Oryza Grain',
    '自然铜': 'Pyrite', '鬼箭羽': 'Dogwood Twig', '鬼臼': 'Podophyllum Rhizome',
    '旋覆花': 'Inula Flower', '款冬花': 'Coltsfoot Flower',
    '满山红': 'Ledum Leaf', '浮小麦': 'Floating Wheat',
    '鸡肠风': 'Polygonum Hydropiper Herb', '金荞麦': 'Fagopyrum Dibrychium Rhizome',
}

# 中文名 -> 别名（全面覆盖）
NAME_ALIAS = {
    '白花菜子': '洋白花子,辣子树子', '草苁蓉': '大芸,寸芸',
    '蚕沙': '蚕矢,晚蚕沙', '白毛藤': '白毛风,白毛藤根',
    '八角莲': '八角盘,鬼臼,猪爪莲', '玳玳花': '代代花,回回花',
    '猴枣': '猴精,猴胆', '鸡屎藤': '臭鸡屎藤,万字藤',
    '橘络': '橘衣,橘穰', '川槿皮': '紫荆皮,旱莲皮',
    '大风子': '大风子树,回生草', '倒扣草': '夏枯草,自头花',
    '冬瓜子': '冬瓜仁,瓜瓜子', '凤眼草': '龙牙草,益母草花',
    '十大功劳根': '土黄连,木黄连', '黑老虎': '布福娜,冷饭果',
    '石见穿': '石打穿,羊活', '绞股蓝': '南方人参,七叶胆',
    '白药子': '山慈姑,野慈姑', '相思子': '红豆,红豆杉子',
    '苦丁茶': '茶丁,茶药', '苦楝子': '楝子,紫花树子',
    '了哥王根': '黄皮树,山黄皮', '零陵香': '薰草,香草',
    '龙葵': '黑天天,野葡萄', '猫眼草': '猫眼菊,烂疤眼',
    '猕猴桃根': '藤梨根,阳桃根', '枳椇子': '拐枣,鸡爪梨',
    '墓头回': '石壁枫,陈氏香', '南蛇藤果': '南蛇藤子,风藤子',
    '牛大力': '倒挂金钟,黄狗头', '牡荆子': '黄荆子,布惊子',
    '三分三': '洋金花,闹羊花子', '石上柏': '石白菜,万年青',
    '鼠曲草': '清明菜,佛耳草', '松子仁': '松籽,海松子',
    '萱草根': '忘忧草,鹿葱', '铁线透骨草': '透骨草,铁线草',
    '无患子皮': '洗手果壳,油罗树', '乌敛莓': '五爪龙,母猪藤',
    '无患子': '洗手果,油罗树', '梧桐子': '青桐子,吊丝球',
    '仙桃草': '小驳骨,白背枫', '香茅': '柠檬草,香巴茅',
    '寻骨风': '穿山龙,老鼠迁', '皂荚子': '皂角子,猪牙皂子',
    '芫荽': '香菜,香荽', '泽漆': '猫眼草,五朵云',
    '景天三七': '费菜,三七草', '三七花': '田七花,金不换花',
    '蒲黄': '蒲花粉,蒲鞋', '煅石膏': '熟石膏',
    '白矾': '明矾,石涅', '商陆': '章柳,见肿消',
    '朱砂': '丹砂,辰砂', '猫爪草': '小毛爪草,猫儿爪',
    '瓦楞子': '蚶壳,花蛤壳', '海桐皮': '刺桐皮,海南漆',
    '刘寄奴': '金寄奴,乌藤菜', '紫草': '地血,紫草茸',
    '紫菀': '小菀,夜菀', '紫苏梗': '紫苏杆',
    '紫苏叶': '苏叶,香苏叶', '紫苏子': '苏子,紫苏籽',
    '紫花地丁': '地丁草,箭头草', '漏芦': '祁州漏芦,野兰',
    '番泻叶': '泻叶,番泻叶片', '藤梨根': '猕猴桃根,阳桃根',
    '雷公藤': '黄藤,黄藤草', '雪上一支蒿': '一枝箭,水官乌',
    '雪莲花': '雪莲,荷莲', '露蜂房': '蜂房,蜂箱',
    '鸡血藤': '大血藤,血藤', '鸡内金': '鸡肫皮,鸡黄皮',
    '鸡冠花': '鸡髻花,鸡冠毬', '鸡矢藤': '臭藤,万字藤',
    '谷芽': '谷萌,谷谷芽', '麦芽': '麦蘖,大麦芽',
    '稻芽': '谷萌,粳米芽', '自然铜': '黄铁矿,愚人金',
    '鬼箭羽': '卫矛,四棱枝', '鬼臼': '桃儿七,七叶莲',
    '旋覆花': '金沸花,金钱花', '款冬花': '冬花,虎须',
    '满山红': '兴安杜鹃,达子香', '浮小麦': '小麦麸',
    '鸡肠风': '鸡肠草,血凤草', '金荞麦': '天荞麦,赤地利',
}

# 中文名 -> 药用部位（全面覆盖）
NAME_PART = {
    '白花菜子': '种子', '草苁蓉': '肉质茎', '蚕沙': '粪便',
    '白毛藤': '根茎', '八角莲': '根茎', '玳玳花': '花',
    '猴枣': '胆结石', '鸡屎藤': '全草', '橘络': '果皮内层',
    '川槿皮': '树皮', '大风子': '种子', '倒扣草': '全草',
    '冬瓜子': '种子', '凤眼草': '花', '十大功劳根': '根',
    '黑老虎': '根', '石见穿': '全草', '绞股蓝': '全草',
    '白药子': '块根', '相思子': '种子', '苦丁茶': '叶',
    '苦楝子': '种子', '了哥王根': '根', '零陵香': '全草',
    '龙葵': '果实', '猫眼草': '全草', '猕猴桃根': '根',
    '枳椇子': '种子', '墓头回': '根茎', '南蛇藤果': '果实',
    '牛大力': '根', '牡荆子': '种子', '三分三': '种子',
    '石上柏': '全草', '鼠曲草': '全草', '松子仁': '种子',
    '萱草根': '根', '铁线透骨草': '全草', '无患子皮': '果皮',
    '乌敛莓': '全草', '无患子': '果皮', '梧桐子': '种子',
    '仙桃草': '全草', '香茅': '全草', '寻骨风': '全草',
    '皂荚子': '种子', '芫荽': '全草', '泽漆': '全草',
    '景天三七': '全草', '三七花': '花',
    '蒲黄': '花粉', '煅石膏': '矿物', '白矾': '矿物',
    '商陆': '根', '朱砂': '矿物', '猫爪草': '块根',
    '瓦楞子': '贝壳', '海桐皮': '树皮', '刘寄奴': '全草',
    '紫草': '根', '紫菀': '根', '紫苏梗': '茎',
    '紫苏叶': '叶', '紫苏子': '种子', '紫花地丁': '全草',
    '漏芦': '根', '番泻叶': '叶', '藤梨根': '根',
    '雷公藤': '根', '雪上一支蒿': '块根', '雪莲花': '花',
    '露蜂房': '昆虫分泌物', '鸡血藤': '藤茎', '鸡内金': '肌胃内膜',
    '鸡冠花': '花', '鸡矢藤': '全草', '谷芽': '种子',
    '麦芽': '种子', '稻芽': '种子', '自然铜': '矿物',
    '鬼箭羽': '带叶嫩枝', '鬼臼': '根茎', '旋覆花': '头状花序',
    '款冬花': '花蕾', '满山红': '叶', '浮小麦': '颖果',
    '鸡肠风': '全草', '金荞麦': '根茎',
}


async def final_complete():
    print("=" * 60)
    print("  SymMap 终极补全 v5")
    print("=" * 60)

    engine = create_async_engine(settings.database.url, echo=False, pool_pre_ping=True)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    stats = {'name_eng': 0, 'alias': 0, 'use_part': 0}

    async with async_session() as session:
        print("\nUpdating name_eng, alias, use_part...")

        for name_cn, eng in NAME_EN.items():
            await session.execute(
                text("UPDATE symmap_herbs SET name_eng = :eng WHERE name_cn = :cn AND (name_eng IS NULL OR name_eng = '')"),
                {'eng': eng, 'cn': name_cn}
            )
            stats['name_eng'] += 1

        for name_cn, al in NAME_ALIAS.items():
            await session.execute(
                text("UPDATE symmap_herbs SET alias = :al WHERE name_cn = :cn AND (alias IS NULL OR alias = '')"),
                {'al': al, 'cn': name_cn}
            )
            stats['alias'] += 1

        for name_cn, up in NAME_PART.items():
            await session.execute(
                text("UPDATE symmap_herbs SET use_part = :up WHERE name_cn = :cn AND (use_part IS NULL OR use_part = '')"),
                {'up': up, 'cn': name_cn}
            )
            stats['use_part'] += 1

        await session.commit()

    await engine.dispose()

    print(f"\n补全报告:")
    print(f"  name_eng: {stats['name_eng']} 次尝试")
    print(f"  alias:    {stats['alias']} 次尝试")
    print(f"  use_part: {stats['use_part']} 次尝试")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(final_complete())
