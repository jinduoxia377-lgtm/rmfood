"""
SymMap 最终补全 — 覆盖所有剩余药材
"""
import asyncio, sys, os
os.environ['PYTHONIOENCODING'] = 'utf-8'
sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy import text
from sqlalchemy.orm import sessionmaker
from app.core.config import settings

# 剩余药材的英文名（通过药典标准英文名）
REMAINING_EN = {
    '白屈菜': 'Greater Celandine Herb', '椿皮': 'Tree of Heaven Bark',
    '大叶紫珠': 'Large-leaf Callicarpa Leaf', '紫珠叶': 'Callicarpa Leaf',
    '芡实': 'Euryale Seed', '裸花紫珠': 'Naked Callicarpa Flower',
    '土荆皮': 'Pseudolarix Bark', '川木香': 'Costus Root',
    '广金钱草': 'Desmodium Herb', '片姜黄': 'Turmeric Tuber',
    '蓖麻子': 'Castor Bean', '大蒜': 'Garlic', '刀豆': 'Jack Bean',
    '佛手': 'Bergamot Fruit', '半边莲': 'Lobelia Herb',
    '谷精草': 'Turban Flower Head', '瓜蒂': 'Melon Stalk',
    '黑芝麻': 'Black Sesame Seed', '萹蓄': 'Knotweed Herb',
    '龟甲': 'Tortoise Shell', '蜂蜜': 'Honey', '水蛭': 'Leech',
    '儿茶': 'Catechu', '海藻': 'Seaweed', '荆芥穗': 'Schizonepeta Spike',
    '莲房': 'Lotus Receptacle', '雷丸': 'Omphalia', '磁石': 'Magnetite',
    '青黛': 'Indigo Naturalis', '血余炭': 'Hair Charcoal',
    '血竭': 'Dragon Blood', '红粉': 'Red Mercuric Oxide',
    '苏木': 'Sappan Wood', '大叶紫珠': 'Large-leaf Callicarpa Leaf',
    '裸花紫珠': 'Naked Callicarpa Flower',
    '川木香': 'Costus Root', '广金钱草': 'Desmodium Hairysroot Herb',
    '片姜黄': 'Turmeric Tuber',
    # 50味无拉丁名药材
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
}

# 剩余药材的别名
REMAINING_ALIAS = {
    '白屈菜': '土黄连,毛黄连,土延胡', '椿皮': '樗根白皮,苦木皮',
    '大叶紫珠': '大叶杜虹花,紫珠', '紫珠叶': '杜虹花叶,止血茶',
    '芡实': '鸡头米,鸿宝,雁头', '裸花紫珠': '一叶血,七叶风',
    '土荆皮': '金钱松皮,土槿皮', '川木香': '广木香,青木香',
    '广金钱草': '一点血,落地金钱', '片姜黄': '蓬莪术,川姜黄',
    '蓖麻子': '大麻子,红麻子,野花生', '大蒜': '葫,葫蒜,独蒜',
    '刀豆': '刀豆子,大刀豆,胀饱豆', '佛手': '佛手柑,五指柑,香橼',
    '半边莲': '急解索,细米草,蛇付草', '谷精草': '戴星草,连萼谷精草',
    '瓜蒂': '甜瓜蒂,甜瓜子蒂,苦瓜蒂', '黑芝麻': '胡麻,乌麻,巨胜子',
    '萹蓄': '葈耳草,趴地草,路柳', '龟甲': '龟板,龟壳,败灵',
    '蜂蜜': '蜂糖,蜜糖,白蜜', '水蛭': '蚂蟥,马鳖,肉芝',
    '儿茶': '孩儿茶,乌爹泥,亚克吉', '海藻': '海萃,海精,昆布草',
    '荆芥穗': '假苏穗,薄荷穗', '莲房': '莲蓬,藕蓬',
    '雷丸': '竹苓,雷实,震菝', '磁石': '吸铁石,黑铅石,灵磁',
    '青黛': '蓝靛,靛花,淀花', '血余炭': '发炭,人发炭,血余',
    '血竭': '麒麟血,西血竭,枫香脂', '苏木': '苏方木,苏方,红须',
    '白花菜子': '洋白花子,辣子树子', '草苁蓉': '大芸,寸芸',
    '蚕沙': '蚕矢,晚蚕沙,虫沙', '白毛藤': '白毛风,白毛藤根',
    '八角莲': '八角盘,鬼臼,猪爪莲', '玳玳花': '代代花,回回花',
    '猴枣': '猴精,猴胆,猴膀胱石', '鸡屎藤': '臭鸡屎藤,万字藤',
    '橘络': '橘衣,橘穰,橘丝', '川槿皮': '紫荆皮,旱莲皮',
    '大风子': '大风子树,回生草', '倒扣草': '夏枯草,自头花',
    '冬瓜子': '冬瓜仁,瓜瓜子,白瓜子', '凤眼草': '龙牙草,益母草花',
    '十大功劳根': '土黄连,木黄连', '黑老虎': '布福娜,冷饭果',
    '石见穿': '石打穿,羊活', '绞股蓝': '南方人参,七叶胆',
    '白药子': '山慈姑,野慈姑', '相思子': '红豆,红豆杉子',
    '苦丁茶': '茶丁,茶药,苦丁', '苦楝子': '楝子,紫花树子',
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
    '芫荽': '香菜,香荽,胡荽', '泽漆': '猫眼草,五朵云',
    '景天三七': '费菜,三七草', '三七花': '田七花,金不换花',
}

# 剩余药材的药用部位
REMAINING_PART = {
    '白屈菜': '全草', '椿皮': '树皮', '大叶紫珠': '叶', '紫珠叶': '叶',
    '芡实': '种子', '裸花紫珠': '花', '土荆皮': '树皮',
    '川木香': '根', '广金钱草': '全草', '片姜黄': '块茎',
    '蓖麻子': '种子', '大蒜': '鳞茎', '刀豆': '种子', '佛手': '果实',
    '半边莲': '全草', '谷精草': '头状花序', '瓜蒂': '果梗',
    '黑芝麻': '种子', '萹蓄': '全草', '龟甲': '甲壳', '蜂蜜': '分泌物',
    '水蛭': '昆虫', '儿茶': '心材提取物', '海藻': '藻体',
    '荆芥穗': '花穗', '莲房': '花托', '雷丸': '菌核',
    '磁石': '矿物', '青黛': '加工品', '血余炭': '炭制品',
    '血竭': '树脂', '苏木': '心材',
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
}


async def final_complete():
    engine = create_async_engine(settings.database.url, echo=False, pool_pre_ping=True)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    stats = {'name_eng': 0, 'alias': 0, 'use_part': 0}

    async with async_session() as session:
        print("补全剩余药材...")

        for cn, eng in REMAINING_EN.items():
            r = await session.execute(
                text("UPDATE symmap_herbs SET name_eng = :eng WHERE name_cn = :cn AND (name_eng IS NULL OR name_eng = '')"),
                {'eng': eng, 'cn': cn}
            )
            if r.rowcount > 0:
                stats['name_eng'] += 1

        for cn, al in REMAINING_ALIAS.items():
            r = await session.execute(
                text("UPDATE symmap_herbs SET alias = :al WHERE name_cn = :cn AND (alias IS NULL OR alias = '')"),
                {'al': al, 'cn': cn}
            )
            if r.rowcount > 0:
                stats['alias'] += 1

        for cn, up in REMAINING_PART.items():
            r = await session.execute(
                text("UPDATE symmap_herbs SET use_part = :up WHERE name_cn = :cn AND (use_part IS NULL OR use_part = '')"),
                {'up': up, 'cn': cn}
            )
            if r.rowcount > 0:
                stats['use_part'] += 1

        await session.commit()

    await engine.dispose()

    print(f"\n补全报告:")
    print(f"  name_eng: {stats['name_eng']}")
    print(f"  alias:    {stats['alias']}")
    print(f"  use_part: {stats['use_part']}")


if __name__ == "__main__":
    asyncio.run(final_complete())
