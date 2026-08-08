"""
SymMap 终极补全 v4 — 通过拉丁名推导英文名
"""
import asyncio, sys, os
os.environ['PYTHONIOENCODING'] = 'utf-8'
sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy import text
from sqlalchemy.orm import sessionmaker
from app.core.config import settings

# 拉丁名关键词 -> 英文名
LATIN_EN = {
    'Crinis Carbonisatus': 'Hair Charcoal',
    'Draconis Sanguis': 'Dragon Blood',
    'Hydrargyri Oxydum Rubrum': 'Red Mercury Oxide',
    'Sappan Lignum': 'Sappan Wood',
    'Agrimoniae Herba': 'Agrimony Herb',
    'Calamina': 'Calamine',
    'Calomelas': 'Calomel',
    'Stalactitum': 'Stalactite',
    'Limonitum': 'Hematite Limonite',
    'Genkwa Flos': 'Genkwa Flower',
    'Mantidis Ootheca': 'Mantis Egg Case',
    'Trachycarpi Petiolus': 'Palma Leaf Stalk',
    'Realgar': 'Realgar',
    'Bletillae Rhizoma': 'Bletilla Rhizome',
    'Aconiti Radix': 'Monkshood Root',
    'Cortex Ailanthi': 'Tree of Heaven Bark',
    'Rubi Fructus': 'Raspberry',
    'Euphorbiae Semen Pulveratum': 'Spurge Seed Powder',
    'Aconiti Radix Cocta': 'Prepared Monkshood Root',
    'Strychni Semen Pulveratum': 'Strichnos Seed Powder',
    'Crotonis Semen Pulveratum': 'Croton Seed Powder',
    'Ardisiae Crenatae Radix': 'Ardisia Root',
    'Knoxiae Radix': 'Knoxia Root',
    'Aconiti Kusnezoffii Radix Cocta': 'Prepared Kusnezoff Monkshood',
    'Nelumbinis Rhizomatis Nodus': 'Lotus Node',
    'Euphorbiae Ebracteolatae Radix': 'Leafless Spurge Root',
    'Sepiae Endoconcha': 'Cuttlebone',
    'Phytolaccae Radix': 'Phytolacca Root',
    'Typhae Pollen': 'Pollen Typhae',
    'Pollen Typhae': 'Pollen Typhae',
    'Gypsum Ustum': 'Calcined Gypsum',
    'Alumen': 'Alum',
    'Cinnabaris': 'Cinnabar',
    'Ranunculi Ternati Radix': 'Ranunculus Ternatus Root',
    'Concha Arkae': 'Ark Shell',
    'Cortex Erythrophlei': 'Erythrophleum Bark',
    'Radix Arnebiae': 'Arnebia Root',
    'Radix Asteris': 'Aster Root',
    'Caulis Perillae': 'Perilla Stem',
    'Folium Perillae': 'Perilla Leaf',
    'Semen Perillae': 'Perilla Seed',
    'Herba Violae': 'Viola Herb',
    'Radix Rhapontici': 'Rhaponticum Root',
    'Folium Sennae': 'Senna Leaf',
    'Flos Saussurae': 'Saussurea Flower',
    'Concha Ostreae': 'Oyster Shell',
    'Radix et Rhizoma Rhei': 'Rhubarb Root',
    'Rhizoma Zingiberis': 'Ginger Rhizome',
    'Fructus Evodiae': 'Evodia Fruit',
    'Rhizoma Corydalisis': 'Corydalis Rhizome',
    'Herba Leonuri': 'Leonurus Herb',
    'Fructus Corni': 'Cornus Fruit',
    'Rhizoma Polygonati': 'Polygonatum Rhizome',
    'Bulbus Lilii': 'Lily Bulb',
    'Rhizoma Gastrodiae': 'Gastrodia Rhizome',
    'Folium Isatidis': 'Isatis Leaf',
    'Radix Bupleuri': 'Bupleurum Root',
    'Rhizoma Pinelliae': 'Pinellia Rhizome',
    'Pericarpium Citri Reticulatae': 'Tangerine Peel',
    'Radix Costi': 'Costus Root',
    'Fructus Amomi': 'Amomum Fruit',
    'Flos Caryophylli': 'Clove Bud',
    'Fructus Foeniculi': 'Fennel Fruit',
    'Fructus Anisi Stellati': 'Star Anise Fruit',
    'Radix Salviae Miltiorrhizae': 'Salvia Root',
    'Semen Pruni': 'Peach Seed',
    'Flos Carthami': 'Safflower Flower',
    'Radix Notoginseng': 'Notoginseng Root',
    'Rhizoma Curcumae': 'Curcuma Rhizome',
    'Rhizoma Sparganii': 'Sparganium Rhizome',
    'Fructus Ligustri Lucidi': 'Ligustrum Fruit',
    'Radix Achyranthis Bidentatae': 'Achyranthes Root',
    'Cortex Eucommiae': 'Eucommia Bark',
    'Radix Dipsaci': 'Dipsacus Root',
    'Radix Morindae Officinalis': 'Morinda Root',
    'Herba Cistanches': 'Cistanche Herb',
    'Fructus Cynomorii': 'Cynomorium Fruit',
    'Herba Epimedii': 'Epimedium Herb',
    'Fructus Psoraleae': 'Psoralea Fruit',
    'Semen Cuscutae': 'Dodder Seed',
    'Fructus Lycii': 'Goji Berry',
    'Fructus Schisandrae': 'Schisandra Fruit',
    'Rhizoma Anemarrhenae': 'Anemarrhena Rhizome',
    'Bulbus Ophiopogonis': 'Ophiopogon Tuber',
    'Radix Asparagi': 'Asparagus Root',
    'Bulbus Lilii': 'Lily Bulb',
    'Corium Testudinis': 'Turtle Shell',
    'Carapax et Plastrum Testudinis': 'Turtle Shell',
    'Carapax Trionycis': 'Softshell Turtle Shell',
    'Cornu Cervi Pantotrichum': 'Velvet Antler',
    'Concha Meretricis': 'Clam Shell',
    'Concha Haliotidis': 'Abalone Shell',
    'Concha Arcae': 'Ark Shell',
    'Endoconcha Sepiae': 'Cuttlebone',
    'Calculus Bovis': 'Calculus Bovis',
    'Felix Tigris': 'Tiger Gallstone',
    'Secretio Bufonis': 'Toad Venom',
    'Concrementum Bombyzu': 'Silkworm Concretion',
    'Exuvatio Bombyzu': 'Silkworm Slough',
    'Corium Serpentis': 'Snake Slough',
    'Scorpio': 'Scorpion',
    'Centipeda': 'Centipede',
    'Hirudo': 'Leech',
    'Mylabris': 'Spanish Fly',
    'Folium Mori': 'Mulberry Leaf',
    'Ramulus Mori': 'Mulberry Twig',
    'Fructus Mori': 'Mulberry Fruit',
    'Radix Paeoniae Alba': 'White Peony Root',
    'Radix Paeoniae Rubra': 'Red Peony Root',
    'Radix Glycyrrhizae': 'Licorice Root',
    'Rhizoma Zingiberis Recens': 'Fresh Ginger Rhizome',
    'Rhizoma Zingiberis Siccum': 'Dried Ginger Rhizome',
    'Fructus Phyllanthi': 'Phyllanthus Fruit',
    'Fructus Gardeniae': 'Gardenia Fruit',
    'Radix et Rhizoma Scutellariae': 'Skullcap Root',
    'Cortex Phellodendri': 'Phellodendron Bark',
    'Rhizoma Belamcandae': 'Belamcanda Rhizome',
    'Fructus Crataegi': 'Hawthorn Fruit',
    'Radix et Rhizoma Cyperi': 'Cyperus Rhizome',
    'Rhizoma Acori Tatarinowii': 'Acorus Rhizome',
    'Fructus Magnoliae Officinalis': 'Magnolia Fruit',
    'Cortex Magnoliae Officinalis': 'Magnolia Bark',
    'Rhizoma et Radix Bistortae': 'Bistort Rhizome',
    'Rhizoma et Radix Arisaematis': 'Arisaema Rhizome',
    'Rhizoma Polygoni Multiflori': 'Fleeceflower Rhizome',
    'Radix et Rhizoma Rhemanniae': 'Rehmannia Root',
    'Fructus Forsythiae': 'Forsythia Fruit',
    'Flos Lonicerae Japonicae': 'Honeysuckle Flower',
    'Herba Taraxaci': 'Dandelion Herb',
    'Herba Siegesbeckiae': 'Siegesbeckia Herb',
    'Herba Lycopi': 'Lycopodium Herb',
    'Fructus Xanthii': 'Xanthium Fruit',
    'Flos Cartami': 'Safflower Flower',
    'Semen Persicae': 'Peach Seed',
    'Fructus Amomi Rotundus': 'Round Amomum Fruit',
    'Semen Plantaginis': 'Plantago Seed',
    'Folium Menthae': 'Mint Leaf',
    'Flos Magnoliae': 'Magnolia Flower',
    'Rhizoma et Radix Notopterygii': 'Notopterygium Rhizome',
    'Radix et Rhizoma Ligustici': 'Ligusticum Rhizome',
    'Fructus Zizyphi Spinosi': 'Jujube Seed',
    'Semen Zizyphi Spinosi': 'Jujube Seed (Unripe)',
    'Herba Viticis Negundo': 'Negundo Vine Herb',
    'Rhizoma et Radix Arisaematis Cum Bile': 'Bile-treated Arisaema Rhizome',
    'Radix et Rhizoma Bistortae': 'Bistort Root',
    'Radix et Rhizoma Rhemanniae Preparata': 'Prepared Rehmannia Root',
    'Radix Glycyrrhizae Usta': 'Burnt Licorice Root',
    'Radix et Rhizoma Imperatae': 'Imperata Root',
    'Herba Hierbae': 'Hierba Herb',
    'Radix et Rhizoma Longanae': 'Longan Root',
    'Fructus Citri Reticulatae Viridis': 'Green Tangerine Fruit',
    'Pericarpium Citri Reticulatae Blancae': 'White Tangerine Peel',
    'Rhizoma et Radix Salviae Miltiorrhizae': 'Salvia Root',
    'Fructus Schisandrae Chinensis': 'Schisandra Fruit',
    'Fructus Schisandrae Sphenantherae': 'South Schisandra Fruit',
    'Herba Menthae': 'Mint Herb',
    'Radix et Rhizoma Ligustici Chuanxiong': 'Chuanxiong Rhizome',
    'Rhizoma Polygoni Multiflori Preparatum': 'Prepared Fleeceflower Rhizome',
    'Radix Glycyrrhizae Preparata': 'Prepared Licorice Root',
    'Rhizoma et Radix Bistortae': 'Bistort Rhizome',
    'Fructus Evodiae': 'Evodia Fruit',
    'Fructus Corni': 'Cornus Fruit',
    'Fructus Ligustri Lucidi': 'Ligustrum Fruit',
    'Radix Achyranthis Bidentatae': 'Achyranthes Root',
    'Radix Paeoniae Alba': 'White Peony Root',
    'Radix Paeoniae Rubra': 'Red Peony Root',
    'Radix Glycyrrhizae': 'Licorice Root',
    'Fructus Crataegi': 'Hawthorn Fruit',
    'Rhizoma Zingiberis': 'Ginger Rhizome',
    'Flos Lonicerae': 'Honeysuckle Flower',
    'Herba Taraxaci': 'Dandelion Herb',
    'Fructus Xanthii Sibirici': 'Xanthium Fruit',
    'Radix et Rhizoma Rhemanniae': 'Rehmannia Root',
    'Radix Bupleuri': 'Bupleurum Root',
    'Rhizoma Pinelliae': 'Pinellia Rhizome',
    'Pericarpium Citri Reticulatae': 'Tangerine Peel',
    'Radix Costi': 'Costus Root',
    'Fructus Amomi': 'Amomum Fruit',
    'Flos Caryophylli': 'Clove Bud',
    'Fructus Foeniculi': 'Fennel Fruit',
    'Fructus Anisi Stellati': 'Star Anise Fruit',
    'Radix Salviae Miltiorrhizae': 'Salvia Root',
    'Semen Pruni': 'Peach Seed',
    'Flos Carthami': 'Safflower Flower',
    'Radix Notoginseng': 'Notoginseng Root',
    'Rhizoma Curcumae': 'Curcuma Rhizome',
    'Rhizoma Sparganii': 'Sparganium Rhizome',
    'Fructus Ligustri Lucidi': 'Ligustrum Fruit',
    'Radix Achyranthis Bidentatae': 'Achyranthes Root',
    'Cortex Eucommiae': 'Eucommia Bark',
    'Radix Dipsaci': 'Dipsacus Root',
    'Radix Morindae Officinalis': 'Morinda Root',
    'Herba Cistanches': 'Cistanche Herb',
    'Fructus Cynomorii': 'Cynomorium Fruit',
    'Herba Epimedii': 'Epimedium Herb',
    'Fructus Psoraleae': 'Psoralea Fruit',
    'Semen Cuscutae': 'Dodder Seed',
    'Fructus Lycii': 'Goji Berry',
    'Fructus Schisandrae': 'Schisandra Fruit',
    'Rhizoma Anemarrhenae': 'Anemarrhena Rhizome',
    'Bulbus Ophiopogonis': 'Ophiopogon Tuber',
    'Radix Asparagi': 'Asparagus Root',
}


async def complete():
    print("=" * 60)
    print("  SymMap 终极补全 v4")
    print("=" * 60)

    engine = create_async_engine(settings.database.url, echo=False, pool_pre_ping=True)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    stats = {'name_eng': 0, 'alias': 0, 'use_part': 0}

    async with async_session() as session:
        # 1. 通过拉丁名补全 name_eng
        print("\n[1/3] 通过拉丁名补全 name_eng...")
        r = await session.execute(text("""
            SELECT symmap_id, name_latin FROM symmap_herbs
            WHERE (name_eng IS NULL OR name_eng = '') AND name_latin IS NOT NULL AND name_latin <> ''
        """))
        rows = r.fetchall()
        for sid, name_latin in rows:
            latin_lower = name_latin.lower()
            for latin_key, eng_val in LATIN_EN.items():
                if latin_key.lower() in latin_lower:
                    await session.execute(
                        text("UPDATE symmap_herbs SET name_eng = :eng WHERE symmap_id = :id"),
                        {'eng': eng_val, 'id': sid}
                    )
                    stats['name_eng'] += 1
                    break

        # 2. 通过 herbdb_id 补全 alias
        print("[2/3] 通过 herbdb_id 补全 alias...")
        # 从已有 alias 的药材中提取模式
        r = await session.execute(text("""
            SELECT name_cn, alias FROM symmap_herbs
            WHERE alias IS NOT NULL AND alias <> ''
        """))
        alias_map = {row[0]: row[1] for row in r.fetchall()}

        # 对于没有 latin 但有 herbdb_id 的药材，尝试通过 name_cn 匹配别名库
        r = await session.execute(text("""
            SELECT symmap_id, name_cn FROM symmap_herbs
            WHERE (alias IS NULL OR alias = '')
        """))
        for sid, name_cn in r.fetchall():
            if name_cn in alias_map:
                await session.execute(
                    text("UPDATE symmap_herbs SET alias = :al WHERE symmap_id = :id"),
                    {'al': alias_map[name_cn], 'id': sid}
                )
                stats['alias'] += 1

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
            'Crinis': '毛发', 'Sanguis': '血液',
            'Ootheca': '卵鞘', 'Petiolus': '叶柄',
            'Pulveratum': '粉末', 'Cocta': '制',
            'Pollen': '花粉', 'Fructus': '果实', 'Semen': '种子',
            'Folium': '叶', 'Herba': '全草', 'Radix': '根', 'Rhizoma': '根茎',
            'Cortex': '皮', 'Flos': '花', 'Bulbus': '鳞茎', 'Tuber': '块茎',
            'Caulis': '茎', 'Ramulus': '枝', 'Spina': '刺',
            'Concha': '贝壳', 'Os': '骨', 'Corium': '皮', 'Unghia': '指甲',
        }

        r = await session.execute(text("""
            SELECT symmap_id, name_latin FROM symmap_herbs
            WHERE (use_part IS NULL OR use_part = '') AND name_latin IS NOT NULL AND name_latin <> ''
        """))
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
                stats['use_part'] += 1

        await session.commit()

    await engine.dispose()

    print(f"\n补全报告:")
    print(f"  name_eng: {stats['name_eng']}")
    print(f"  alias:    {stats['alias']}")
    print(f"  use_part: {stats['use_part']}")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(complete())
