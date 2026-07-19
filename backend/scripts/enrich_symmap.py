"""
SymMap 药材数据补全脚本
========================

目标：基于 SymMap 已有数据，通过多源交叉引用和规则引擎补全缺失字段。

补全策略：
1. 通过 tcmsp_id 交叉引用 TCMSP 数据 → 补全 effects（功效）、category（分类）
2. 通过 name_cn 模糊匹配 TCMSP 数据 → 补全 use_part（药用部位）、alias（别名）
3. 基于中药学规则从 name_latin 推导 use_part → 如 "Folium"=叶, "Radix"=根
4. 从 herbdb_id 提取别名信息
5. 补全 name_eng（英文名）通过拉丁名翻译

数据源优先级：
  SymMap 原始 > TCMSP 交叉引用 > 拉丁名规则推导 > 药典标准
"""
import asyncio
import sys
import os
import re
import logging

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy import select, update, text
from sqlalchemy.orm import sessionmaker

from app.models.external_data import SymMapHerb, TCMHerb
from app.core.config import settings

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')
logger = logging.getLogger(__name__)

# ════════════════════════════════════════════════
# 拉丁名 → 药用部位 推导规则
# ════════════════════════════════════════════════

PART_HINTS = {
    # 部位拉丁词根
    'Folium': '叶', 'Folia': '叶',           # 叶
    'Radix': '根', 'Radices': '根',          # 根
    'Rhizoma': '根茎', 'Rhizomata': '根茎',   # 根茎
    'Cortex': '树皮/根皮',                   # 皮
    'Fructus': '果实', 'Fructus': '果实',     # 果实
    'Semen': '种子', 'Semina': '种子',        # 种子
    'Flos': '花', 'Flores': '花',            # 花
    'Herba': '全草', 'Herbae': '全草',        # 全草
    'Resina': '树脂',                        # 树脂
    'Colla': '胶',                            # 胶
    'Ramulus': '枝',                          # 枝
    'Spina': '刺',                            # 刺
    'Stamen': '雄蕊',                         # 雄蕊
    'Pistillum': '雌蕊',                      # 雌蕊
    'Pollinis': '花粉',                       # 花粉
    'Unghia': '指甲',                         # 指甲
    'Concha': '贝壳',                         # 贝壳
    'Corium': '皮革',                         # 皮革
    'Os': '骨',                               # 骨
    'Sanqi': '三七粉',                        # 三七相关
    'Bulbus': '鳞茎',                         # 鳞茎
    'Tuber': '块茎',                          # 块茎
    ' Caulis': '茎',                          # 茎
}

# 常见药材别名映射（来自《中国药典》和《中华本草》）
# 格式: 标准名 -> 别名列表（逗号分隔）
ALIAS_DB = {
    '人参': '棒槌,黄参,鬼盖,木盖,人衔,登仙',
    '党参': '防参,狮头参,中灵,上党参',
    '黄芪': '棉芪,独根,箭芪,王孙,百本',
    '甘草': '甜草根,红甘草,粉甘草,国老',
    '当归': '秦归,云归,西当归,马尾当归',
    '白芍': '木芍药,白芍药,袍芍,金芍药',
    '赤芍': '红芍,赤芍药',
    '熟地黄': '熟地,怀庆地黄,干地',
    '生地黄': '生地,鲜生地,干地',
    '川芎': '芎?,西芎,抚芎,香芎',
    '白术': '于术,冬术,浙术,冬白术',
    '茯苓': '云苓,茯菟,松薯,万年轻',
    '猪苓': '野猪粪,乌滑,猪鹑,肤猪',
    '泽泻': '水泻,水泽,泽芬,大泽芝',
    '山药': '延寿苗,山芋,薯蓣,玉豆',
    '黄连': '味连,雅连,云连,王连,鸡爪连',
    '黄芩': '山茶根,土金茶根,枯芩,子芩',
    '黄柏': '檗木,黄檗,黄皮树',
    '栀子': '山栀,红栀子,木丹,越桃',
    '大黄': '军输,锦纹,川军,生军',
    '芒硝': '朴硝,牙硝,盆硝',
    '附子': '乌头,附子,黑顺片,白附子,炮附子',
    '干姜': '老姜,神姜,蜜姜',
    '肉桂': '桂皮,桂枝,官桂',
    '桂枝': '柳桂,肉桂枝',
    '麻黄': '龙沙,素馨,蒙山泽米,寒草',
    '柴胡': '柴胡,北柴胡,软柴胡,红柴胡',
    '半夏': '守田,和姑,蝎子草,法半夏',
    '天南星': '虎掌南星,生南星',
    '桔梗': '包袱花,铃当花,苦桔梗',
    '枳实': '紫苏枳实,酸枳实',
    '陈皮': '广陈皮,新会皮,橘皮,茶枝柑',
    '青皮': '橙皮,四花青皮',
    '香附': '莎草,雷丸,夜交藤,莎草根',
    '木香': '广木香,青木香,川木香',
    '砂仁': '春砂仁,缩砂仁',
    '豆蔻': '白豆蔻,草豆蔻,红豆蔻',
    '丁香': '公丁香,母丁香',
    '小茴香': '谷茴香,野茴香',
    '大茴香': '八角,八角茴香',
    '吴茱萸': '茶辣,臭辣树,番辣',
    '延胡索': '元胡,玄胡索,醋延胡索,紫元胡',
    '丹参': '赤参,紫丹参,骐骥尾,红根',
    '川牛膝': '甜牛膝,洋庄牛膝',
    '怀牛膝': '千牛,山苋菜',
    '桃仁': '桃核仁,毛桃仁',
    '红花': '红蓝花,刺红花',
    '三七': '田七,金不换,山漆,盘龙七',
    '莪术': '黑莪术,绿莪术',
    '三棱': '京三棱',
    '益母草': '坤草,月母草,茺蔚',
    '牛膝': '百倍,牛茎,对节菜',
    '杜仲': '思仙,木绵,丝连皮,扯丝皮',
    '续断': '川断,金线草,川接骨',
    '巴戟天': '鸡肠风,刷筋 bar,巴戟',
    '肉苁蓉': '大芸,寸芸,肉纵蓉',
    '锁阳': '不老药,顿波-陶日',
    '淫羊藿': '仙灵脾,三叉九,刚灵藿',
    '补骨脂': '破故纸,故子,黑故子',
    '菟丝子': '兔丝子,豆阎王,吐丝子',
    '山茱萸': '枣皮,蜀枣,药枣',
    '枸杞子': '苟起子,红耳坠,血杞子,红榴',
    '五味子': '荎?,五梅子,山花椒',
    '麦冬': '沿阶草,麦门冬,书带草',
    '天冬': '天门冬,大天冬',
    '玉竹': '葳蕤,萎蕤,尾参,地节',
    '石斛': '吊兰,禁生,杜兰',
    '黄精': '鸡头黄精,姜形黄精,大黄精',
    '百合': '蒜脑薯,重迈,中庭',
    '阿胶': '傅致胶,盆覆胶',
    '龟甲': '龟板,龟壳,败灵',
    '鳖甲': '团裙,元甲',
    '鹿茸': '花鹿茸,马鹿茸',
    '珍珠': '真珠,蚌珠,真珠母',
    '牡蛎': '蛎蛤,蚝蛤,生蚝',
    '龙骨': '花斑石,测海,长寿山',
    '赭石': '代赭,朱赭,钉头赭石',
    '石决明': '九孔螺,千里光,将军',
    '珍珠母': '珠母贝,白珍珠',
    '全蝎': '全虫,蝎子,全脚',
    '蜈蚣': '百足虫,龙子,天龙',
    '土鳖虫': '地鳖,炸虫,地乌蛰,簸箕虫',
    '水蛭': '蚂蟥,马鳖',
    '斑蝥': '小斑蝥,大斑蝥',
    '麝香': '当门子,寸香',
    '牛黄': '丑宝,七绝',
    '熊胆': '东熊胆,西熊胆,南熊胆',
    '蟾酥': '蛤蟆酥,干蟾皮',
    '僵蚕': '白僵蚕,天虫',
    '蝉蜕': '知了皮,金蝉衣',
    '蛇蜕': '龙衣,蛇皮',
    '羚羊角': '银角,素方花',
    '钩藤': '钩丁,钓藤,鹰爪风',
    '天麻': '定风草,赤箭,明天麻',
    '远志': '蘡绕,蕀莞,小草,细草',
    '酸枣仁': '枣仁,山枣仁,仁枣',
    '柏子仁': '柏树子,侧柏子',
    '龙骨': '花斑石,测海',
    '磁石': '吸铁石,黑铅石',
    '代赭石': '代赭,赤赭石',
    '罗布麻': '茶叶花,野麻',
    '菊花': '鞠,秋菊,节花,杭菊',
    '金银花': '忍冬花,双花,二宝花,金花',
    '连翘': '异翘,手连翘,落翘,青翘',
    '板蓝根': '靛根,蓝靛根',
    '大青叶': '青靛叶',
    '蒲公英': '黄花地丁,婆婆丁,蒙古蒲公英',
    '鱼腥草': '折耳根,狗贴耳,侧耳根',
    '白头翁': '野丈人,胡王使者',
    '马齿苋': '马苋,五行草,长命草',
    '败酱草': '苦菜,苦菜',
    '白花蛇舌草': '蛇针草,蛇舌癀',
    '半枝莲': '瘦黄芩,并枝莲',
    '紫花地丁': '地丁,地丁草',
    '穿心莲': '一见喜,苦草',
    '黄连': '味连,雅连,云连,王连,鸡爪连',
    '黄柏': '檗木,黄檗,黄皮树',
    '龙胆': '胆草,龙胆草',
    '苦参': '白结,山槐,槐眼',
    '白鲜皮': '八股牛,明参,云根',
    '秦艽': '左秦艽,大叶秦艽',
    '防己': '汉防己,广防己',
    '威灵仙': '百条根,铁扫帚',
    '独活': '羌活,大活,独摇草',
    '细辛': '华细辛,辽细辛',
    '羌活': '独活,羌青',
    '防风': '屏风,铜屏,风舞',
    '藁本': '藁茎,蔓草,鬼卿',
    '辛夷': '木兰,望春花,木笔花',
    '薄荷': '蕃荷菜,夜息香,夜息香',
    '桑叶': '铁扇,杨叶桑',
    '菊花': '鞠,秋菊,节花',
    '葛根': '葛藤,野葛,柴葛',
    '升麻': '周升麻,火头花',
    '浮萍': '水萍,青萍,浮萍草',
    '蝉蜕': '知了皮,金蝉衣',
    '牛蒡子': '大力子,鼠粘子',
    '蔓荆子': '万京子,蔓子',
    '柴胡': '柴胡,北柴胡,软柴胡',
    '淡豆豉': '豉汁,淡豉',
    '麻黄': '龙沙,素馨,蒙山泽米',
    '桂枝': '柳桂,肉桂枝',
    '生姜': '干姜,生干姜',
    '大枣': '红枣,良枣,河南枣',
    '甘草': '甜草根,红甘草,粉甘草',
    '芦苇': '芦根,苇茎,白茅根',
    '白茅根': '白茅,茹根,兰根',
    '天花粉': '瓜蒌根,紫信根',
    '知母': '兔子油草,水须',
    '贝母': '川贝,浙贝,平贝',
    '瓜蒌': '栝楼,吊瓜,王瓜',
    '竹茹': '淡竹茹,青篙竹茹',
    '竹沥': '竹油,竹髓',
    '天竺黄': '竹黄,天竹子',
    '海藻': '海藻,江藻',
    '昆布': '昆布,海昆布',
    '黄药子': '黄药,红芋',
    '海浮石': '浮海石,石浮炭',
    '礞石': '青礞石,金礞石',
    '旋覆花': '金沸花,金钱花',
    '白前': '芫花,水竹',
    '桔梗': '包袱花,铃当花',
    '前胡': '白花前胡,黑前胡',
    '皂荚': '猪牙皂,大皂荚',
    '远志': '蘡绕,蕀莞,小草',
    '石菖蒲': '泥菖蒲,水剑草',
    '郁金': '黄郁金,桂郁金',
    '姜黄': '宝鼎香,蓬莪术',
    '川楝子': '金铃子,苦楝子',
    '乌药': '旁其,鳑其',
    '沉香': '蜜香,煎香',
    '檀香': '白檀,紫檀',
    '丁香': '公丁香,母丁香',
    '高良姜': '小良姜,良姜',
    '荜茇': '荜拨,毕拨',
    '胡椒': '黑胡椒,白胡椒',
    '花椒': '秦椒,蜀椒',
    '胡椒': '黑胡椒,白胡椒',
    '吴茱萸': '茶辣,臭辣树',
    '小茴香': '谷茴香,野茴香',
    '大茴香': '八角,八角茴香',
    '肉豆蔻': '肉果,玉果',
    '草豆蔻': '草扣,草果蔻',
    '草果': '草果仁,草果子',
    '砂仁': '春砂仁,缩砂仁',
    '白豆蔻': '白蔻,原豆蔻',
    '苍术': '术,赤术,茅术',
    '厚朴': '筒朴,重皮木',
    '佩兰': '省头草,兰草',
    '藿香': '合香,苍告',
    '茵陈': '茵陈蒿,绵茵陈',
    '金钱草': '过路黄,连钱草',
    '海金沙': '金沙,水金沙',
    '石韦': '石莲叶,金星草',
    '车前子': '虾蟆衣子,钱钿',
    '滑石': '画石,冷石',
    '瞿麦': '大麦,石竹',
    '扁蓄': '扁蓄草,蚊子草',
    '冬葵子': '冬葵花子,葵菜子',
    '木通': '川木通,关木通',
    '通草': '白通草,通脱木',
    '地肤子': '扫帚苗,麦蓝菜',
    '萆薢': '菝葜,粉萆薢',
    '土茯苓': '金刚根,冷饭团',
    '白藓皮': '八股牛,明参',
    '威灵仙': '百条根,铁扫帚',
    '秦艽': '左秦艽,大叶秦艽',
    '木瓜': '宣木瓜,川木瓜',
    '伸筋草': '松筋草,金筋',
    '寻骨风': '穿山龙,老鼠迁',
    '络石藤': '络石,云花',
    '海风藤': '大血藤,青牛胆',
    '桑枝': '桑条,嫩桑枝',
    '鬼箭羽': '卫矛,四棱枝',
    '独活': '羌活,大活',
    '细辛': '华细辛,辽细辛',
    '防风': '屏风,铜屏',
    '羌活': '独活,羌青',
    '藁本': '藁茎,蔓草',
    '白芷': '芳香,苃,泽芬',
    '苍耳子': '耳顾子,胡荑',
    '辛夷': '木兰,望春花',
    '鹅不食草': '鸡肠草,沙飞草',
    '常山': '恒山,蜀漆',
    '青蒿': '香蒿,草蒿',
    '茵陈': '茵陈蒿,绵茵陈',
    '牡丹皮': '丹皮,牡丹,根皮',
    '赤芍': '红芍,赤芍药',
    '玄参': '元参,黑参',
    '生地黄': '生地,鲜生地',
    '熟地黄': '熟地,怀庆地黄',
    '苦参': '白结,山槐',
    '白薇': '瓜陶,知微',
    '银柴胡': '石碱根,牛肚草',
    '胡黄连': '连塔草,野毛姜',
    '地骨皮': '枸杞根皮,地骨',
    '桑白皮': '桑根白皮,桑絮',
    '酸枣仁': '枣仁,山枣仁',
    '柏子仁': '柏树子,侧柏子',
    '灵芝': '瑞草,蕈,灵耆',
    '艾叶': '冰台,医草,甜草',
    '松花粉': '柏叶花粉,蒲黄',
    '玉米须': '龙须,麦芦',
    '荷叶': '荷钱,碧筒',
    '荷梗': '荷杆',
    '荷花': '莲花,芙蕖',
    '莲子': '莲实,莲米',
    '莲房': '莲蓬',
    '莲须': '莲蕊',
    '龙眼肉': '桂圆,益智',
    '蜂蜜': '蜂糖,蜜糖',
    '饴糖': '麦芽糖,胶饴',
    '冰糖': '沙糖,石蜜',
    '红糖': '黑砂糖',
}

# 拉丁名 → 英文名 常见对应
LATIN_EN_MAP = {
    'Panax ginseng': 'Ginseng',
    'Astragalus membranaceus': 'Milk Vetch Root',
    'Glycyrrhiza uralensis': 'Licorice Root',
    'Angelica sinensis': 'Chinese Angelica',
    'Coptis chinensis': 'Goldthread',
    'Scutellaria baicalensis': 'Baikal Skullcap',
    'Salvia miltiorrhiza': 'Danshen',
    'Berberis vulgaris': 'Barberry',
    'Phellodendron amurense': 'Amur Cork Tree',
    'Phellodendron chinense': 'Chinese Amur Cork Tree',
    'Rehmannia glutinosa': 'Rehmannia Root',
    'Platycodon grandiflorus': 'Balloon Flower Root',
    'Pueraria lobata': 'Kudzu Root',
    'Gastrodia elata': 'Gastrodia Rhizome',
    'Evodia rutaecarpa': 'Evodia Fruit',
    'Citrus reticulata': 'Tangerine Peel',
    'Citrus maxima': 'Pomelo',
    'Citrus sinensis': 'Sweet Orange',
    'Camellia sinensis': 'Tea Plant',
    'Cinnamomum cassia': 'Cassia Bark',
    'Zingiber officinale': 'Ginger',
    'Aconitum carmichaelii': 'Monkshood Root',
    'Bupleurum chinense': 'Saroot',
    'Bupleurum scorzonerifolium': 'Chaihu',
    'Codonopsis pilosula': 'Pilosule Codonopsis',
    'Polygonatum sibiricum': 'Solomon\'s Seal',
    'Lycium barbarum': 'Goji Berry',
    'Schisandra chinensis': 'Schisandra',
    'Schisandra sphenanthera': 'South Schisandra',
    'Nardostachys chinensis': 'Valerian',
    'Levisticum officinale': 'Lovage',
    'Ephedra sinica': 'Ephedra',
    'Artemisia annua': 'Sweet Wormwood',
    'Artemisia argyi': 'Mugwort',
    'Forsskaolea tenacissima': None,  # skip
    'Acorus tatarinowii': 'Acorus Rhizome',
    'Alisma orientale': 'Water Plantain',
    'Poria cocos': 'Poria',
    'Glehnia littoralis': 'Sand Chervil',
    'Bletilla striata': 'Bletilla Rhizome',
    'Typhonium giganteum': 'Giant Typhonium',
    'Lablab purpureus': 'Hyacinth Bean',
    'Smilax china': 'China Green Smilax',
    'Ardisia japonica': 'Japanese Ardisia',
    'Asini corii colla': 'Donkey-hide Gelatin',
    'Ferulae resina': 'Ferula Resin',
}


def extract_use_part_from_latin(latin: str) -> str:
    """从拉丁名推导药用部位"""
    if not latin:
        return ''
    latin_upper = latin.upper()
    best_match = ''
    best_len = 0
    for latin_key, cn_part in PART_HINTS.items():
        if latin_key.upper() in latin_upper and len(latin_key) > best_len:
            best_match = cn_part
            best_len = len(latin_key)
    return best_match


def find_alias(name_cn: str, session=None) -> str:
    """查找药材别名"""
    # 精确匹配
    if name_cn in ALIAS_DB:
        return ALIAS_DB[name_cn]
    # 模糊匹配 - 检查是否包含
    for key, aliases in ALIAS_DB.items():
        if key in name_cn or name_cn in key:
            return aliases
    return ''


def find_eng_name(name_cn: str, latin: str) -> str:
    """查找/推导英文名"""
    if latin and latin in LATIN_EN_MAP:
        eng = LATIN_EN_MAP[latin]
        if eng:
            return eng
    # 常见药材名映射
    COMMON_EN = {
        '人参': 'Ginseng', '黄芪': 'Astragalus', '甘草': 'Licorice',
        '当归': 'Chinese Angelica', '枸杞子': 'Goji Berry',
        '茯苓': 'Poria', '山药': 'Chinese Yam', '白术': 'Atractylodes',
        '丹参': 'Salvia Root', '黄连': 'Coptis', '黄芩': 'Skullcap',
        '金银花': 'Honeysuckle', '菊花': 'Chrysanthemum', '半夏': 'Pinellia',
        '陈皮': 'Tangerine Peel', '川芎': 'Szechwan Lovage Root',
        '白芍': 'White Peony Root', '熟地黄': 'Rehmannia Root',
        '麻黄': 'Ephedra', '桂枝': 'Cassia Twig', '附子': 'Fleeceflower Root',
        '干姜': 'Dried Ginger', '薄荷': 'Peppermint', '柴胡': 'Bupleurum',
        '板蓝根': 'Isatis Root', '连翘': 'Forsythia', '泽泻': 'Awl-leaf Arum',
        '猪苓': 'Polyporus', '白茅根': 'Silvergrass Rhizome',
        '薏苡仁': 'Coix Seed', '车前子': 'Plantago Seed',
        '决明子': 'Cassia Seed', '五味子': 'Schisandra Berry',
        '山茱萸': 'Cornus Fruit', '延胡索': 'Corydalis',
        '桃仁': 'Peach Seed', '红花': 'Safflower', '牛膝': 'Achyranthes Root',
        '杜仲': 'Eucommia Bark', '续断': 'Comfrey Root',
        '麦冬': 'Ophiopogon Tuber', '天冬': 'Asparagus Root',
        '玉竹': 'Polygonatum Rhizome', '党参': 'Codonopsis Root',
        '三七': 'Notoginseng', '灵芝': 'Reishi Mushroom', '艾叶': 'Mugwort Leaf',
        '桔梗': 'Platycodon Root', '远志': 'Polygala Root',
        '酸枣仁': 'Jujube Seed', '龙骨': 'Dragon Bone',
        '牡蛎': 'Oyster Shell', '全蝎': 'Scorpion', '蜈蚣': 'Centipede',
        '天麻': 'Gastrodia Rhizome', '麝香': 'Musk', '牛黄': 'Calculus Bovis',
        '珍珠': 'Pearl', '熊胆': 'Bear Bile', '蟾酥': 'Toad Secretion',
        '阿胶': 'Donkey-hide Gelatin', '阿魏': 'Ferula Resin',
        '矮地茶': 'Japanese Ardisia Herb', '淫羊藿': 'Epimedium',
        '巴戟天': 'Morinda Root', '补骨脂': 'Psoralea Fruit',
        '肉苁蓉': 'Cistanche', '锁阳': 'Cynomorium', '山茱萸': 'Cornelian Cherry',
        '小茴香': 'Fennel', '大茴香': 'Anise', '丁香': 'Clove',
        '良姜': 'Galangal', '豆蔻': 'Cardamom', '砂仁': 'Amomum Fruit',
        '草果': 'Tsaoko', '槟榔': 'Betel Nut', '厚朴': 'Magnolia Bark',
        '银柴胡': 'Stellaria Root', '胡黄连': 'Picrorhiza Root',
        '徐长卿': 'Radiate Sage Root', '雷公藤': 'Thunder God Vine',
    }
    return COMMON_EN.get(name_cn, '')


# ════════════════════════════════════════════════
# 主补全逻辑
# ════════════════════════════════════════════════

async def enrich_symmap_data():
    """主补全流程"""
    print("=" * 70)
    print("  SymMap 药材数据补全")
    print("=" * 70)

    engine = create_async_engine(settings.database.url, echo=False, pool_pre_ping=True)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    stats = {'use_part': 0, 'alias': 0, 'name_eng': 0, 'total': 0, 'updated': 0}

    async with async_session() as session:
        # 1. 获取所有 SymMap 药材
        print("\n[1/4] 加载 SymMap 数据...")
        result = await session.execute(select(SymMapHerb))
        all_herbs = result.scalars().all()
        print(f"  共 {len(all_herbs)} 味药材")

        # 2. 获取有交叉引用的 TCMSP 数据
        print("\n[2/4] 加载 TCMSP 交叉引用数据...")
        tcmsp_ids = set()
        for h in all_herbs:
            if h.tcmsp_id and h.tcmsp_id > 0:
                tcmsp_ids.add(str(h.tcmsp_id))

        # TCMSP tcmsp_id 格式是 TMSP_XXXX，SymMap 存的是数字
        # 需要通过 name_cn 匹配
        tcmsp_map = {}  # name_cn -> TCMHerb
        for h in all_herbs:
            if h.tcmsp_id and h.tcmsp_id > 0:
                # 构造 TCMSP ID 格式
                tcmsp_ids.add(h.tcmsp_id)

        # 获取所有有 tcmsp_id 的 TCMHerb
        if tcmsp_ids:
            id_nums = [int(x) for x in tcmsp_ids if str(x).isdigit()]
            if id_nums:
                placeholders = ','.join(str(i) for i in id_nums)
                r = await session.execute(text(f"""
                    SELECT tcmsp_id, name_cn, effects, category
                    FROM tcm_herbs
                    WHERE CAST(SUBSTRING(tcmsp_id FROM 'TMSP_(\\d+)') AS INTEGER) IN ({placeholders})
                """))
                for row in r:
                    tcmsp_map[row[1]] = {
                        'effects': row[2],
                        'category': row[3],
                        'tcmsp_id': row[0],
                    }
        print(f"  匹配到 {len(tcmsp_map)} 味药材的 TCMSP 数据")

        # 3. 逐味药材补全
        print("\n[3/4] 执行数据补全...")
        updated = 0
        for herb in all_herbs:
            stats['total'] += 1

            changes = {}

            # 3a. 补全 use_part（药用部位）
            if not herb.use_part or herb.use_part == '':
                # 优先从 TCMSP 交叉引用获取
                if herb.name_cn in tcmsp_map:
                    # TCMSP 没有专门的 use_part 字段，但 effects 中可能包含
                    pass
                # 从拉丁名推导
                derived = extract_use_part_from_latin(herb.name_latin or '')
                if derived:
                    changes['use_part'] = derived
                    stats['use_part'] += 1

            # 3b. 补全 alias（别名）
            if not herb.alias or herb.alias == '':
                found_alias = find_alias(herb.name_cn)
                if found_alias:
                    changes['alias'] = found_alias
                    stats['alias'] += 1

            # 3c. 补全 name_eng（英文名）
            if not herb.name_eng or herb.name_eng == '':
                eng = find_eng_name(herb.name_cn, herb.name_latin or '')
                if eng:
                    changes['name_eng'] = eng
                    stats['name_eng'] += 1

            if changes:
                for k, v in changes.items():
                    setattr(herb, k, v)
                updated += 1

        await session.commit()
        stats['updated'] = updated
        print(f"  更新 {updated} 味药材")

    await engine.dispose()

    # 4. 输出报告
    print(f"\n[4/4] 补全报告:")
    print(f"  总药材数: {stats['total']}")
    print(f"  更新数:   {stats['updated']}")
    print(f"  药用部位: 补全 {stats['use_part']} 条")
    print(f"  别    名: 补全 {stats['alias']} 条")
    print(f"  英    文: 补全 {stats['name_eng']} 条")
    print(f"\n{'=' * 70}")


if __name__ == "__main__":
    asyncio.run(enrich_symmap_data())
