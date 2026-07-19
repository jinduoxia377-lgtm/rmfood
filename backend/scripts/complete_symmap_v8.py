"""
SymMap 终极补全 v8 — 通过拉丁名匹配 MMID 批量补全
"""
import asyncio, sys, os
os.environ['PYTHONIOENCODING'] = 'utf-8'
sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy import text
from sqlalchemy.orm import sessionmaker
from app.core.config import settings

async def complete():
    engine = create_async_engine(settings.database.url, echo=False, pool_pre_ping=True)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    stats = {}

    async with async_session() as session:
        # 1. 通过拉丁名匹配 MMID 补全 name_eng
        print("[1/3] 拉丁名匹配 MMID 补全 name_eng...")
        r = await session.execute(text("""
            UPDATE symmap_herbs s
            SET name_eng = m.name_eng
            FROM mmid_herbs m
            WHERE s.name_latin IS NOT NULL AND s.name_latin <> ''
              AND m.name_latin IS NOT NULL AND m.name_latin <> ''
              AND m.name_eng IS NOT NULL AND m.name_eng <> ''
              AND (s.name_eng IS NULL OR s.name_eng = '')
              AND (
                  LOWER(s.name_latin) LIKE LOWER(m.name_latin) || '%'
                  OR LOWER(m.name_latin) LIKE LOWER(s.name_latin) || '%'
                  OR LOWER(s.name_latin) = LOWER(m.name_latin)
              )
        """))
        stats['name_eng_latin'] = r.rowcount
        print(f"  补全: {stats['name_eng_latin']} 味")

        # 2. 通过 name_cn 模糊匹配补全 alias
        print("[2/3] 通过别名库补全 alias...")
        # 直接使用 Python 循环
        alias_db = {
            '白屈菜': '土黄连,土延胡,毛黄连', '蓖麻子': '大麻子,红麻子',
            '大蒜': '葫,葫蒜', '刀豆': '刀豆子,大刀豆', '佛手': '佛手柑,五指柑',
            '半边莲': '急解索,细米草', '谷精草': '戴星草,连萼谷精草',
            '瓜蒂': '甜瓜蒂,甜瓜子蒂', '黑芝麻': '胡麻,乌麻', '萹蓄': '葈耳草,趴地草',
            '龟甲': '龟板,龟壳,败灵', '蜂蜜': '蜂糖,蜜糖', '水蛭': '蚂蟥,马鳖',
            '儿茶': '孩儿茶,乌爹泥', '海藻': '海萃,海精', '荆芥穗': '假苏穗',
            '莲房': '莲蓬', '雷丸': '竹苓,雷实', '磁石': '吸铁石,黑铅石', '青黛': '蓝靛',
            '血余炭': '发炭,人发炭', '血竭': '麒麟血,西血竭', '红粉': '三仙丹,红升丹',
            '苏木': '苏方木,苏方', '大叶紫珠': '大叶杜虹花', '紫珠叶': '杜虹花叶',
            '芡实': '鸡头米,鸿宝', '裸花紫珠': '一叶血,止血茶',
            '土荆皮': '金钱松皮,土槿皮', '川木香': '广木香', '广金钱草': '一点血',
            '片姜黄': '蓬莪术,川姜黄', '椿皮': '樗根白皮,苦木皮',
        }
        updated = 0
        for cn, al in alias_db.items():
            r = await session.execute(
                text("UPDATE symmap_herbs SET alias = :al WHERE name_cn = :cn AND (alias IS NULL OR alias = '')"),
                {'al': al, 'cn': cn}
            )
            updated += r.rowcount
        stats['alias'] = updated
        print(f"  补全: {stats['alias']} 味")

        # 3. 通过拉丁名补全 use_part
        print("[3/3] 通过拉丁名补全 use_part...")
        PART_HINTS = {
            'Folium': '叶', 'Folia': '叶', 'Radix': '根', 'Radices': '根',
            'Rhizoma': '根茎', 'Rhizomata': '根茎', 'Cortex': '皮',
            'Fructus': '果实', 'Semen': '种子', 'Flos': '花', 'Flores': '花',
            'Herba': '全草', 'Herbae': '全草', 'Resina': '树脂', 'Colla': '胶',
            'Bulbus': '鳞茎', 'Tuber': '块茎', ' Caulis': '茎',
            'Periostracum': '外壳', 'Pollinis': '花粉', 'Concha': '贝壳',
            'Carbonisatus': '炭', 'Oxidum': '氧化物', 'Lignum': '木材',
            'Calamina': '矿物', 'Realgar': '矿物', 'Cinnabaris': '矿物',
            'Alumen': '矿物', 'Gypsum': '矿物', 'Stalactitum': '矿物',
            'Limonitum': '矿物', 'Calomelas': '矿物', 'Hydrargyri': '矿物',
            'Crinis': '毛发', 'Sanguis': '血液', 'Ootheca': '卵鞘',
            'Petiolus': '叶柄', 'Pulveratum': '粉末', 'Cocta': '制',
            'Pollen': '花粉', 'Mel': '蜂蜜', 'Testudinis': '龟甲',
            'Cervi': '鹿角', 'Sepiae': '海螵蛸', 'Draconis': '血竭',
            'Sappan': '苏木', 'Hydrargyri': '红粉', 'Bovis': '体外牛黄',
            'Cordyceps': '冬虫夏草', 'Pheretima': '地龙',
            'Cera': '虫白蜡', 'Junci': '灯心草', 'Cirsii': '大蓟',
            'Lophatheri': '淡竹叶', 'Rehmanniae': '地黄',
            'Eucommiae': '杜仲', 'Liquidambaris': '枫香脂',
            'Ilicis': '枸骨叶', 'Agrimoniae': '仙鹤草',
            'Genkwa': '芫花', 'Mantidis': '桑螵蛸',
            'Trachycarpi': '棕榈', 'Ardisiae': '朱砂根',
            'Knoxiae': '红大戟', 'Aconiti': '制草乌',
            'Bolbostemmatis': '土贝母', 'Cuscutae': '菟丝子',
            'Pseudolaricis': '土荆皮', 'Toosendan': '川楝子',
            'Pulsatillae': '白头翁', 'Arecae': '大腹皮',
            'Inulae': '土木香', 'Alpiniae': '益智',
            'Haematitum': '赭石', 'Testudinis': '龟甲',
            'Haliotidis': '石决明', 'Mel': '蜂蜜',
            'Paridis': '重楼', 'Piperis': '荜茇',
            'Artemisiae': '猪苓', 'Gardeniae': '焦栀子',
            'Changii': '明党参', 'Schizonepetae': '荆芥炭',
            'Poriae': '茯苓皮', 'Hedysari': '炙红芪',
            'Rhodiolae': '红景天', 'Bovis': '体外培育牛黄',
            'Polygoni': '何首乌', 'Bovis Calculus': '体外培育牛黄',
        }

        r = await session.execute(text("""
            SELECT symmap_id, name_latin FROM symmap_herbs
            WHERE (use_part IS NULL OR use_part = '')
              AND name_latin IS NOT NULL AND name_latin <> ''
        """))
        updated_part = 0
        for sid, name_latin in r.fetchall():
            latin_upper = name_latin.upper()
            best = ''
            best_len = 0
            for lk, lv in PART_HINTS.items():
                if lk.upper() in latin_upper and len(lk) > best_len:
                    best = lv
                    best_len = len(lk)
            if best:
                await session.execute(
                    text("UPDATE symmap_herbs SET use_part = :up WHERE symmap_id = :id"),
                    {'up': best, 'id': sid}
                )
                updated_part += 1
        stats['use_part'] = updated_part
        print(f"  补全: {stats['use_part']} 味")

        await session.commit()

    await engine.dispose()

    print(f"\n补全报告:")
    for k, v in stats.items():
        print(f"  {k}: {v}")


if __name__ == "__main__":
    asyncio.run(complete())
