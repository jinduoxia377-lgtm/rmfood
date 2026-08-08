"""
SymMap 终极补全 — 通过 SQL 批量更新
"""
import asyncio
import sys, os
os.environ['PYTHONIOENCODING'] = 'utf-8'
sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy import text
from sqlalchemy.orm import sessionmaker
from app.core.config import settings

async def bulk_complete():
    engine = create_async_engine(settings.database.url, echo=False, pool_pre_ping=True)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    # name_eng 补全: name_cn -> eng 映射
    name_eng_pairs = [
        ('蒲黄', 'Pollen Typhae'), ('煅石膏', 'Gypsum Ustum'),
        ('白矾', 'Alumen'), ('商陆', 'Phytolacca Root'),
        ('朱砂', 'Cinnabar'), ('猫爪草', 'Ranunculus Ternatus Root'),
        ('瓦楞子', 'Ark Shell'), ('海桐皮', 'Erythrophleum Bark'),
        ('刘寄奴', 'Artemisia Annua Herb'), ('紫草', 'Arnebia Root'),
        ('紫菀', 'Aster Root'), ('紫苏梗', 'Perilla Stem'),
        ('紫苏叶', 'Perilla Leaf'), ('紫苏子', 'Perilla Seed'),
        ('紫花地丁', 'Viola Herb'), ('漏芦', 'Rhaponticum Root'),
        ('番泻叶', 'Senna Leaf'), ('熊胆粉', 'Bear Bile Powder'),
        ('藤梨根', 'Kiwi Root'), ('矮地茶', 'Ardisia Herb'),
        ('雷公藤', 'Tripterygium Root'), ('雪上一支蒿', 'Aconitum Bracteatum Root'),
        ('雪莲花', 'Saussurea Flower'), ('露蜂房', 'Honeycomb'),
        ('橘络', 'Tangerine Mesocarp'), ('橘核', 'Tangerine Seed'),
        ('橘红', 'Tangerine Peel (White)'), ('鸡血藤', 'Spatholobus Stem'),
        ('鸡内金', 'Gizzard Lining'), ('鸡冠花', 'Celosia Flower'),
        ('鸡矢藤', 'Paederia Root'), ('谷芽', 'Germinated Grain'),
        ('麦芽', 'Germinated Hordeum Grain'), ('稻芽', 'Germinated Oryza Grain'),
        ('自然铜', 'Pyrite'), ('鬼箭羽', 'Dogwood Twig'),
        ('鬼臼', 'Podophyllum Rhizome'), ('旋覆花', 'Inula Flower'),
        ('款冬花', 'Coltsfoot Flower'), ('满山红', 'Ledum Leaf'),
        ('浮小麦', 'Floating Wheat'), ('紫河车', 'Placenta Hominis'),
        ('鸡肠风', 'Polygonum Hydropiper Herb'), ('金荞麦', 'Fagopyrum Dibrychium Rhizome'),
        ('金樱子', 'Cherokee Rose Fruit'), ('金钱草', 'Lysimachia Herb'),
        ('金沸草', 'Inula Herb'), ('金果榄', 'Tinospora Root'),
        ('金线重楼', 'Paris Polyphylla'), ('金礞石', 'Micaceous Hematite'),
        ('金沸草', 'Inula Herb'), ('金铃子', 'Toona Fruit'),
        ('金不换', 'Notoginseng'), ('金毛狗脊', 'Cibotium Rhizome'),
        ('金荞麦', 'Fagopyrum Dibrychium Rhizome'), ('金线草', 'Polygonum Sieboldii Herb'),
        ('金盏花', 'Calendula Flower'), ('金樱子', 'Cherokee Rose Fruit'),
        ('金沸草', 'Inula Herb'), ('金果榄', 'Tinospora Root'),
        ('金线莲', 'Anoectochilus Herb'), ('金钗石斛', 'Dendrobium Nobile Stem'),
        ('金莲花', 'Trollius Flower'), ('金针菜', 'Daylily Flower'),
        ('金橘', 'Kumquat'), ('金樱子', 'Cherokee Rose Fruit'),
        ('金沸草', 'Inula Herb'), ('金果榄', 'Tinospora Root'),
        ('金线莲', 'Anoectochilus Herb'), ('金钗石斛', 'Dendrobium Nobile Stem'),
        ('金莲花', 'Trollius Flower'), ('金针菜', 'Hemerocallis Flower'),
        ('金橘', 'Fortune Tree Fruit'),
    ]

    # alias 补全
    alias_pairs = [
        ('八角莲', '八角盘,鬼臼,猪爪莲'), ('草苁蓉', '大芸,寸芸'),
        ('蚕沙', '蚕矢,晚蚕沙'), ('白毛藤', '白毛风,白毛藤根'),
        ('玳玳花', '代代花,回回花'), ('猴枣', '猴精,猴胆'),
        ('鸡屎藤', '臭鸡屎藤,万字藤'), ('川槿皮', '紫荆皮,旱莲皮'),
        ('橘络', '橘衣,橘穰'), ('鸡肠风', '鸡肠草,血凤草'),
        ('金荞麦', '天荞麦,赤地利'), ('瓦楞子', '蚶壳,花蛤壳'),
        ('海桐皮', '刺桐皮,海南漆'), ('刘寄奴', '金寄奴,乌藤菜'),
        ('紫草', '地血,紫草茸'), ('紫菀', '小菀,夜菀'),
        ('漏芦', '祁州漏芦,野兰'), ('番泻叶', '泻叶,番泻叶片'),
        ('藤梨根', '猕猴桃根,阳桃根'), ('雷公藤', '黄藤,黄藤草'),
        ('雪上一支蒿', '一枝箭,水官乌'), ('雪莲花', '雪莲,荷莲'),
        ('露蜂房', '蜂房,蜂箱'), ('鸡血藤', '大血藤,血藤'),
        ('谷芽', '谷萌,谷谷芽'), ('麦芽', '麦蘖,大麦芽'),
        ('稻芽', '谷萌,粳米芽'), ('自然铜', '黄铁矿,愚人金'),
        ('鬼箭羽', '卫矛,四棱枝'), ('鬼臼', '桃儿七,七叶莲'),
        ('旋覆花', '金沸花,金钱花'), ('款冬花', '冬花,虎须'),
        ('满山红', '兴安杜鹃,达子香'), ('浮小麦', '小麦麸'),
        ('紫河车', '胎盘,胞衣'), ('鸡肠风', '鸡肠草,血凤草'),
        ('金荞麦', '天荞麦,赤地利'), ('金樱子', '刺梨,山石榴'),
        ('金钱草', '过路黄,连钱草'), ('金沸草', '金狗花,野红花'),
        ('金果榄', '山乌龟,金线吊乌龟'), ('金线重楼', '七叶一枝花'),
        ('金礞石', '青礞石,金礞'), ('金盏花', '金盏菊,黄金菊'),
        ('金针菜', '黄花菜,忘忧草'), ('金钗石斛', '金钗,扁钗'),
        ('金莲花', '旱金莲,荷叶花'), ('金线莲', '金线兰,乌脚仙'),
        ('橘核', '橘莲子,橘米'),
    ]

    # use_part 补全
    use_part_pairs = [
        ('蒲黄', '花粉'), ('煅石膏', '矿物'), ('白矾', '矿物'),
        ('商陆', '根'), ('朱砂', '矿物'), ('猫爪草', '块根'),
        ('瓦楞子', '贝壳'), ('海桐皮', '树皮'), ('刘寄奴', '全草'),
        ('紫草', '根'), ('紫菀', '根茎'), ('紫苏梗', '茎'),
        ('紫苏叶', '叶'), ('紫苏子', '种子'), ('紫花地丁', '全草'),
        ('漏芦', '根'), ('番泻叶', '叶'), ('熊胆粉', '分泌物'),
        ('藤梨根', '根'), ('雷公藤', '根'), ('雪上一支蒿', '块根'),
        ('雪莲花', '花'), ('露蜂房', '昆虫分泌物'), ('橘络', '果皮内层'),
        ('鸡血藤', '藤茎'), ('鸡内金', '肌胃内膜'), ('鸡冠花', '花'),
        ('鸡矢藤', '全草'), ('谷芽', '种子'), ('麦芽', '种子'),
        ('稻芽', '种子'), ('自然铜', '矿物'), ('鬼箭羽', '带叶嫩枝'),
        ('鬼臼', '根茎'), ('旋覆花', '头状花序'), ('款冬花', '花蕾'),
        ('满山红', '叶'), ('浮小麦', '颖果'), ('紫河车', '胎盘'),
        ('鸡肠风', '全草'), ('金荞麦', '根茎'), ('金樱子', '果实'),
        ('金钱草', '全草'), ('金沸草', '全草'), ('金果榄', '块根'),
        ('金线重楼', '根茎'), ('金礞石', '矿物'), ('金盏花', '花'),
        ('金针菜', '花'), ('金钗石斛', '茎'), ('金莲花', '花'),
        ('金线莲', '全草'), ('橘核', '种子'), ('八角莲', '根茎'),
        ('草苁蓉', '茎'), ('蚕沙', '粪便'), ('白毛藤', '根茎'),
        ('玳玳花', '花'), ('猴枣', '结石'), ('鸡屎藤', '全草'),
        ('川槿皮', '树皮'), ('橘络', '果皮内层'), ('鸡肠风', '全草'),
        ('金荞麦', '根茎'), ('瓦楞子', '贝壳'), ('海桐皮', '树皮'),
        ('刘寄奴', '全草'), ('紫草', '根'), ('紫菀', '根'),
        ('漏芦', '根'), ('番泻叶', '叶'), ('藤梨根', '根'),
        ('雷公藤', '根'), ('雪上一支蒿', '块根'), ('雪莲花', '花'),
        ('露蜂房', '昆虫分泌物'), ('橘络', '果皮内层'), ('鸡血藤', '藤茎'),
        ('鸡内金', '肌胃内膜'), ('鸡冠花', '花'), ('鸡矢藤', '全草'),
        ('谷芽', '种子'), ('麦芽', '种子'), ('稻芽', '种子'),
        ('自然铜', '矿物'), ('鬼箭羽', '带叶嫩枝'), ('鬼臼', '根茎'),
        ('旋覆花', '头状花序'), ('款冬花', '花蕾'), ('满山红', '叶'),
        ('浮小麦', '颖果'), ('紫河车', '胎盘'), ('鸡肠风', '全草'),
        ('金荞麦', '根茎'), ('金樱子', '果实'), ('金钱草', '全草'),
        ('金沸草', '全草'), ('金果榄', '块根'), ('金线重楼', '根茎'),
        ('金礞石', '矿物'), ('金盏花', '花'), ('金针菜', '花'),
        ('金钗石斛', '茎'), ('金莲花', '花'), ('金线莲', '全草'),
        ('橘核', '种子'), ('八角莲', '根茎'), ('草苁蓉', '肉质茎'),
        ('蚕沙', '粪便'), ('白毛藤', '根茎'), ('玳玳花', '花'),
        ('猴枣', '胆结石'), ('鸡屎藤', '全草'), ('川槿皮', '树皮'),
        ('蒲黄', '花粉'), ('煅石膏', '矿物'), ('白矾', '矿物'),
        ('商陆', '根'), ('朱砂', '矿物'),
    ]

    async with async_session() as sess:
        print("Updating name_eng...")
        for cn, eng in name_eng_pairs:
            await sess.execute(
                text("UPDATE symmap_herbs SET name_eng = :eng WHERE name_cn = :cn AND (name_eng IS NULL OR name_eng = '')"),
                {'eng': eng, 'cn': cn}
            )

        print("Updating alias...")
        for cn, al in alias_pairs:
            await sess.execute(
                text("UPDATE symmap_herbs SET alias = :al WHERE name_cn = :cn AND (alias IS NULL OR alias = '')"),
                {'al': al, 'cn': cn}
            )

        print("Updating use_part...")
        for cn, up in use_part_pairs:
            await sess.execute(
                text("UPDATE symmap_herbs SET use_part = :up WHERE name_cn = :cn AND (use_part IS NULL OR use_part = '')"),
                {'up': up, 'cn': cn}
            )

        await sess.commit()

    await engine.dispose()
    print("Done.")

asyncio.run(bulk_complete())
