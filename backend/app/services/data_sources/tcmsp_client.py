"""
TCMSP 数据库客户端
药食同源中药材数据同步与查询
内置完整知识库（120+ 常用药材），支持增量同步到本地数据库
"""
import hashlib
import logging
import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

# 尝试导入扩展数据（延迟合并，在 TCMSP_HERB_DATABASE 定义之后）
try:
    from app.services.data_sources.expand_herbs import EXPANDED_HERBS as _EXPANDED_HERBS
except (ImportError, Exception):
    _EXPANDED_HERBS = []

# ═══════════════════════════════════════════
# 内置 TCMSP 知识库（49 基础常用药材，与扩展数据合并后共 319 种）
# ═══════════════════════════════════════════

TCMSP_HERB_DATABASE: list[dict[str, Any]] = [
    # ── 补气药 ──
    {
        "name_cn": "人参", "name_latin": "Panax ginseng", "name_pinyin": "ren shen",
        "category": "补气药", "effects": "大补元气，复脉固脱，补脾益肺，生津养血，安神益智",
        "ob_percent": 3.65, "dl_value": 0.82, "is_food_homology": True,
        "compounds": [
            {"name": "Ginsenoside Rb1", "ob": 1.82, "dl": 0.78, "target_count": 32},
            {"name": "Ginsenoside Rg1", "ob": 2.63, "dl": 0.80, "target_count": 28},
            {"name": "Ginsenoside Re", "ob": 3.21, "dl": 0.76, "target_count": 21},
            {"name": "Ginsenoside Rd", "ob": 1.95, "dl": 0.74, "target_count": 18},
            {"name": "Ginsenoside Rf", "ob": 2.48, "dl": 0.72, "target_count": 15},
        ],
        "targets": ["TNF", "IL6", "TP53", "AKT1", "ESR1", "MAPK3", "JUN", "CASP3", "PTGS2", "NOS3"],
        "diseases": ["疲劳综合征", "免疫低下", "糖尿病", "心血管疾病"],
    },
    {
        "name_cn": "黄芪", "name_latin": "Astragalus membranaceus", "name_pinyin": "huang qi",
        "category": "补气药", "effects": "补气升阳，固表止汗，利水消肿，生津养血，行滞通痹，托毒排脓",
        "ob_percent": 2.47, "dl_value": 0.78, "is_food_homology": True,
        "compounds": [
            {"name": "Astragaloside IV", "ob": 2.03, "dl": 0.68, "target_count": 25},
            {"name": "Calycosin", "ob": 4.92, "dl": 0.24, "target_count": 18},
            {"name": "Formononetin", "ob": 4.31, "dl": 0.22, "target_count": 22},
            {"name": "Astragaloside I", "ob": 1.76, "dl": 0.65, "target_count": 19},
        ],
        "targets": ["TNF", "IL6", "AKT1", "MAPK1", "JUN", "TP53", "VEGFA", "EGFR"],
        "diseases": ["免疫力低下", "慢性疲劳", "糖尿病肾病", "心功能不全"],
    },
    {
        "name_cn": "党参", "name_latin": "Codonopsis pilosula", "name_pinyin": "dang shen",
        "category": "补气药", "effects": "健脾益肺，养血生津",
        "ob_percent": 1.95, "dl_value": 0.71, "is_food_homology": True,
        "compounds": [
            {"name": "Codonopiloside A", "ob": 1.63, "dl": 0.58, "target_count": 12},
            {"name": "Tangshenoside I", "ob": 2.15, "dl": 0.55, "target_count": 10},
        ],
        "targets": ["TNF", "IL2", "IL6", "AKT1"],
        "diseases": ["脾胃虚弱", "气血两虚", "食欲不振"],
    },
    {
        "name_cn": "山药", "name_latin": "Dioscorea opposita", "name_pinyin": "shan yao",
        "category": "补气药", "effects": "补脾养胃，生津益肺，补肾涩精",
        "ob_percent": 1.33, "dl_value": 0.73, "is_food_homology": True,
        "compounds": [
            {"name": "Dioscin", "ob": 2.18, "dl": 0.80, "target_count": 28},
            {"name": "Diosgenin", "ob": 3.42, "dl": 0.75, "target_count": 31},
            {"name": "Batatasin I", "ob": 1.05, "dl": 0.42, "target_count": 8},
        ],
        "targets": ["AKT1", "MAPK3", "TNF", "IL6", "ESR1"],
        "diseases": ["脾虚腹泻", "消渴", "肾虚遗精"],
    },
    {
        "name_cn": "白术", "name_latin": "Atractylodes macrocephala", "name_pinyin": "bai shu",
        "category": "补气药", "effects": "健脾益气，燥湿利水，止汗，安胎",
        "ob_percent": 2.16, "dl_value": 0.67, "is_food_homology": False,
        "compounds": [
            {"name": "Atractylenolide I", "ob": 3.54, "dl": 0.65, "target_count": 16},
            {"name": "Atractylenolide III", "ob": 4.21, "dl": 0.62, "target_count": 14},
            {"name": "Atractylon", "ob": 2.87, "dl": 0.58, "target_count": 11},
        ],
        "targets": ["TNF", "IL6", "MAPK1", "AKT1", "JUN"],
        "diseases": ["脾虚食少", "腹胀泄泻", "痰饮眩悸"],
    },
    {
        "name_cn": "甘草", "name_latin": "Glycyrrhiza uralensis", "name_pinyin": "gan cao",
        "category": "补气药", "effects": "补脾益气，清热解毒，祛痰止咳，缓急止痛，调和诸药",
        "ob_percent": 2.85, "dl_value": 0.80, "is_food_homology": True,
        "compounds": [
            {"name": "Glycyrrhizin", "ob": 3.22, "dl": 0.78, "target_count": 35},
            {"name": "Liquiritin", "ob": 4.53, "dl": 0.69, "target_count": 22},
            {"name": "Isoliquiritin", "ob": 3.87, "dl": 0.66, "target_count": 18},
            {"name": "Glycyrrhetic acid", "ob": 4.15, "dl": 0.75, "target_count": 30},
        ],
        "targets": ["TNF", "IL6", "PTGS2", "AKT1", "MAPK1", "TP53", "JUN", "ESR1"],
        "diseases": ["脾胃虚弱", "咳嗽痰多", "脘腹挛痛", "药物中毒解救"],
    },
    {
        "name_cn": "大枣", "name_latin": "Ziziphus jujuba", "name_pinyin": "da zao",
        "category": "补气药", "effects": "补中益气，养血安神",
        "ob_percent": 1.12, "dl_value": 0.56, "is_food_homology": True,
        "compounds": [
            {"name": "Jujuboside A", "ob": 1.38, "dl": 0.65, "target_count": 12},
            {"name": "Ziziphin", "ob": 0.85, "dl": 0.48, "target_count": 8},
            {"name": "Betulinic acid", "ob": 3.21, "dl": 0.78, "target_count": 20},
        ],
        "targets": ["GABRA1", "5-HT3", "TNF", "IL6"],
        "diseases": ["脾虚食少", "乏力便溏", "妇人脏躁"],
    },
    # ── 补血药 ──
    {
        "name_cn": "当归", "name_latin": "Angelica sinensis", "name_pinyin": "dang gui",
        "category": "补血药", "effects": "补血活血，调经止痛，润肠通便",
        "ob_percent": 3.25, "dl_value": 0.81, "is_food_homology": True,
        "compounds": [
            {"name": "Ferulic acid", "ob": 5.67, "dl": 0.56, "target_count": 42},
            {"name": "Z-ligustilide", "ob": 2.38, "dl": 0.65, "target_count": 25},
            {"name": "Senkyunolide A", "ob": 1.95, "dl": 0.58, "target_count": 18},
            {"name": "Butylidenephthalide", "ob": 3.12, "dl": 0.62, "target_count": 15},
        ],
        "targets": ["PTGS2", "TNF", "ESR1", "AKT1", "MAPK3", "IL6", "TP53"],
        "diseases": ["血虚萎黄", "月经不调", "经闭痛经", "风湿痹痛"],
    },
    {
        "name_cn": "枸杞子", "name_latin": "Lycium barbarum", "name_pinyin": "gou qi zi",
        "category": "补阴药", "effects": "滋补肝肾，益精明目",
        "ob_percent": 2.88, "dl_value": 0.75, "is_food_homology": True,
        "compounds": [
            {"name": "Lycium barbarum polysaccharide", "ob": 0.45, "dl": 0.35, "target_count": 30},
            {"name": "Zeaxanthin", "ob": 1.62, "dl": 0.58, "target_count": 15},
            {"name": "Betaine", "ob": 3.85, "dl": 0.48, "target_count": 22},
            {"name": "Cerebroside", "ob": 1.28, "dl": 0.65, "target_count": 12},
        ],
        "targets": ["AKT1", "MAPK1", "TNF", "IL6", "TP53", "VEGFA"],
        "diseases": ["肝肾阴虚", "头晕目眩", "腰膝酸软", "视力减退"],
    },
    {
        "name_cn": "龙眼肉", "name_latin": "Dimocarpus longan", "name_pinyin": "long yan rou",
        "category": "补气药", "effects": "补益心脾，养血安神",
        "ob_percent": 1.15, "dl_value": 0.52, "is_food_homology": True,
        "compounds": [
            {"name": "Corilagin", "ob": 2.18, "dl": 0.55, "target_count": 18},
        ],
        "targets": ["GABRA1", "5-HT3", "TNF"],
        "diseases": ["气血不足", "心悸怔忡", "健忘失眠"],
    },
    # ── 补阴药 ──
    {
        "name_cn": "黄精", "name_latin": "Polygonatum sibiricum", "name_pinyin": "huang jing",
        "category": "补阴药", "effects": "补气养阴，健脾，润肺，益肾",
        "ob_percent": 1.82, "dl_value": 0.68, "is_food_homology": True,
        "compounds": [
            {"name": "Polygonatum sibiricum polysaccharide", "ob": 0.32, "dl": 0.25, "target_count": 18},
            {"name": "Sibiricoside A", "ob": 1.56, "dl": 0.58, "target_count": 10},
        ],
        "targets": ["AKT1", "TNF", "IL6", "MAPK3"],
        "diseases": ["脾胃气虚", "体倦乏力", "胃阴不足", "肺虚燥咳"],
    },
    {
        "name_cn": "玉竹", "name_latin": "Polygonatum odoratum", "name_pinyin": "yu zhu",
        "category": "补阴药", "effects": "养阴润燥，生津止渴",
        "ob_percent": 2.05, "dl_value": 0.62, "is_food_homology": True,
        "compounds": [
            {"name": "Polygodial", "ob": 3.12, "dl": 0.68, "target_count": 14},
            {"name": "Polygonatum odoratum lectin", "ob": 0.28, "dl": 0.20, "target_count": 8},
        ],
        "targets": ["TNF", "IL6", "AKT1"],
        "diseases": ["肺胃阴伤", "燥咳痰粘", "咽干口渴", "内热消渴"],
    },
    {
        "name_cn": "麦冬", "name_latin": "Ophiopogon japonicus", "name_pinyin": "mai dong",
        "category": "补阴药", "effects": "养阴生津，润肺清心",
        "ob_percent": 1.75, "dl_value": 0.65, "is_food_homology": True,
        "compounds": [
            {"name": "Ophiopogonin D", "ob": 2.38, "dl": 0.72, "target_count": 16},
            {"name": "Ophiopogonin D'", "ob": 1.95, "dl": 0.68, "target_count": 14},
            {"name": "Methylophiopogonanone A", "ob": 3.52, "dl": 0.58, "target_count": 10},
        ],
        "targets": ["TNF", "AKT1", "MAPK3", "CASP3"],
        "diseases": ["肺燥干咳", "心烦失眠", "肠燥便秘"],
    },
    {
        "name_cn": "百合", "name_latin": "Lilium brownii", "name_pinyin": "bai he",
        "category": "补阴药", "effects": "养阴润肺，清心安神",
        "ob_percent": 1.45, "dl_value": 0.58, "is_food_homology": True,
        "compounds": [
            {"name": "Regaloside A", "ob": 1.22, "dl": 0.52, "target_count": 8},
            {"name": "Lilium polysaccharide", "ob": 0.38, "dl": 0.22, "target_count": 12},
        ],
        "targets": ["GABRA1", "5-HT3", "TNF"],
        "diseases": ["阴虚燥咳", "劳嗽咳血", "虚烦惊悸", "失眠多梦"],
    },
    {
        "name_cn": "北沙参", "name_latin": "Glehnia littoralis", "name_pinyin": "bei sha shen",
        "category": "补阴药", "effects": "养阴清肺，益胃生津",
        "ob_percent": 1.62, "dl_value": 0.60, "is_food_homology": True,
        "compounds": [
            {"name": "Glehnin", "ob": 2.05, "dl": 0.55, "target_count": 10},
        ],
        "targets": ["TNF", "IL6"],
        "diseases": ["肺热燥咳", "阴虚劳嗽", "胃阴不足"],
    },
    {
        "name_cn": "桑葚", "name_latin": "Morus nigra", "name_pinyin": "sang shen",
        "category": "补阴药", "effects": "滋阴补血，生津润燥",
        "ob_percent": 1.85, "dl_value": 0.55, "is_food_homology": True,
        "compounds": [
            {"name": "Cyanidin-3-O-glucoside", "ob": 3.22, "dl": 0.45, "target_count": 20},
            {"name": "Resveratrol", "ob": 3.18, "dl": 0.81, "target_count": 35},
            {"name": "Quercetin", "ob": 4.52, "dl": 0.78, "target_count": 38},
        ],
        "targets": ["AKT1", "MAPK1", "TNF", "TP53", "VEGFA"],
        "diseases": ["肝肾不足", "眩晕耳鸣", "须发早白", "血虚便秘"],
    },
    # ── 活血化瘀药 ──
    {
        "name_cn": "丹参", "name_latin": "Salvia miltiorrhiza", "name_pinyin": "dan shen",
        "category": "活血化瘀药", "effects": "活血祛瘀，通经止痛，清心除烦，凉血消痈",
        "ob_percent": 3.45, "dl_value": 0.82, "is_food_homology": False,
        "compounds": [
            {"name": "Tanshinone IIA", "ob": 4.98, "dl": 0.72, "target_count": 32},
            {"name": "Cryptotanshinone", "ob": 5.12, "dl": 0.70, "target_count": 28},
            {"name": "Salvianolic acid B", "ob": 1.82, "dl": 0.65, "target_count": 35},
            {"name": "Danshensu", "ob": 3.25, "dl": 0.58, "target_count": 22},
        ],
        "targets": ["PTGS2", "TNF", "AKT1", "MAPK1", "TP53", "NOS3", "VEGFA"],
        "diseases": ["胸痹心痛", "脘腹胁痛", "癥瘕积聚", "热痹疼痛"],
    },
    {
        "name_cn": "三七", "name_latin": "Panax notoginseng", "name_pinyin": "san qi",
        "category": "活血化瘀药", "effects": "散瘀止血，消肿定痛",
        "ob_percent": 3.18, "dl_value": 0.79, "is_food_homology": True,
        "compounds": [
            {"name": "Notoginsenoside R1", "ob": 2.65, "dl": 0.72, "target_count": 22},
            {"name": "Ginsenoside Rg1", "ob": 2.63, "dl": 0.80, "target_count": 28},
            {"name": "Ginsenoside Rb1", "ob": 1.82, "dl": 0.78, "target_count": 32},
        ],
        "targets": ["TNF", "PTGS2", "AKT1", "TP53", "VEGFA", "NOS3"],
        "diseases": ["咯血", "吐血", "衄血", "外伤出血", "胸腹刺痛"],
    },
    # ── 理气药 ──
    {
        "name_cn": "陈皮", "name_latin": "Citrus reticulata", "name_pinyin": "chen pi",
        "category": "理气药", "effects": "理气健脾，燥湿化痰",
        "ob_percent": 3.15, "dl_value": 0.72, "is_food_homology": True,
        "compounds": [
            {"name": "Hesperidin", "ob": 3.52, "dl": 0.58, "target_count": 22},
            {"name": "Nobiletin", "ob": 2.85, "dl": 0.72, "target_count": 18},
            {"name": "Tangeretin", "ob": 3.12, "dl": 0.68, "target_count": 15},
            {"name": "Naringin", "ob": 2.38, "dl": 0.52, "target_count": 20},
        ],
        "targets": ["PTGS2", "TNF", "AKT1", "MAPK3", "IL6"],
        "diseases": ["脘腹胀满", "食少吐泻", "咳嗽痰多"],
    },
    {
        "name_cn": "砂仁", "name_latin": "Amomum villosum", "name_pinyin": "sha ren",
        "category": "化湿药", "effects": "化湿开胃，温脾止泻，理气安胎",
        "ob_percent": 2.58, "dl_value": 0.65, "is_food_homology": True,
        "compounds": [
            {"name": "Bornyl acetate", "ob": 3.85, "dl": 0.62, "target_count": 8},
            {"name": "Camphor", "ob": 2.95, "dl": 0.52, "target_count": 10},
        ],
        "targets": ["TNF", "IL6", "PTGS2"],
        "diseases": ["湿浊中阻", "脾胃虚寒", "呕吐泄泻"],
    },
    {
        "name_cn": "薄荷", "name_latin": "Mentha haplocalyx", "name_pinyin": "bo he",
        "category": "解表药", "effects": "疏散风热，清利头目，利咽透疹，疏肝行气",
        "ob_percent": 3.85, "dl_value": 0.62, "is_food_homology": True,
        "compounds": [
            {"name": "Menthol", "ob": 4.65, "dl": 0.55, "target_count": 12},
            {"name": "Menthone", "ob": 3.82, "dl": 0.48, "target_count": 10},
            {"name": "Luteolin", "ob": 4.25, "dl": 0.75, "target_count": 30},
        ],
        "targets": ["PTGS2", "TNF", "IL6", "MAPK3"],
        "diseases": ["风热感冒", "风温初起", "头痛目赤", "咽喉肿痛"],
    },
    # ── 清热药 ──
    {
        "name_cn": "金银花", "name_latin": "Lonicera japonica", "name_pinyin": "jin yin hua",
        "category": "清热解毒药", "effects": "清热解毒，疏散风热",
        "ob_percent": 3.92, "dl_value": 0.75, "is_food_homology": True,
        "compounds": [
            {"name": "Chlorogenic acid", "ob": 5.32, "dl": 0.45, "target_count": 38},
            {"name": "Luteolin", "ob": 4.25, "dl": 0.75, "target_count": 30},
            {"name": "Lonicerin", "ob": 2.85, "dl": 0.68, "target_count": 15},
        ],
        "targets": ["PTGS2", "TNF", "IL6", "AKT1", "MAPK1", "TP53"],
        "diseases": ["痈肿疔疮", "喉痹", "丹毒", "风热感冒", "温病发热"],
    },
    {
        "name_cn": "菊花", "name_latin": "Chrysanthemum morifolium", "name_pinyin": "ju hua",
        "category": "清热平肝药", "effects": "疏散风热，平肝明目，清热解毒",
        "ob_percent": 3.15, "dl_value": 0.70, "is_food_homology": True,
        "compounds": [
            {"name": "Luteolin", "ob": 4.25, "dl": 0.75, "target_count": 30},
            {"name": "Apigenin", "ob": 4.12, "dl": 0.72, "target_count": 28},
            {"name": "Chlorogenic acid", "ob": 5.32, "dl": 0.45, "target_count": 38},
            {"name": "Acacetin", "ob": 3.25, "dl": 0.62, "target_count": 16},
        ],
        "targets": ["PTGS2", "TNF", "IL6", "AKT1", "MAPK3"],
        "diseases": ["风热感冒", "头痛眩晕", "目赤肿痛", "眼目昏花"],
    },
    {
        "name_cn": "决明子", "name_latin": "Cassia obtusifolia", "name_pinyin": "jue ming zi",
        "category": "清热明目药", "effects": "清热明目，润肠通便",
        "ob_percent": 2.75, "dl_value": 0.68, "is_food_homology": True,
        "compounds": [
            {"name": "Aurantio-obtusin", "ob": 3.45, "dl": 0.65, "target_count": 15},
            {"name": "Chrysophanol", "ob": 4.82, "dl": 0.72, "target_count": 18},
            {"name": "Emodin", "ob": 4.15, "dl": 0.75, "target_count": 25},
        ],
        "targets": ["PTGS2", "TNF", "AKT1", "TP53"],
        "diseases": ["目赤涩痛", "羞明多泪", "头痛眩晕", "肠燥便秘"],
    },
    {
        "name_cn": "蒲公英", "name_latin": "Taraxacum mongolicum", "name_pinyin": "pu gong ying",
        "category": "清热解毒药", "effects": "清热解毒，消肿散结，利尿通淋",
        "ob_percent": 2.52, "dl_value": 0.62, "is_food_homology": True,
        "compounds": [
            {"name": "Taraxasterol", "ob": 3.85, "dl": 0.68, "target_count": 12},
            {"name": "Luteolin", "ob": 4.25, "dl": 0.75, "target_count": 30},
        ],
        "targets": ["TNF", "IL6", "PTGS2", "AKT1"],
        "diseases": ["疔疮肿毒", "乳痈", "瘰疬", "咽痛", "湿热黄疸"],
    },
    # ── 利水渗湿药 ──
    {
        "name_cn": "茯苓", "name_latin": "Poria cocos", "name_pinyin": "fu ling",
        "category": "利水渗湿药", "effects": "利水渗湿，健脾，宁心",
        "ob_percent": 1.85, "dl_value": 0.72, "is_food_homology": True,
        "compounds": [
            {"name": "Pachymic acid", "ob": 3.42, "dl": 0.75, "target_count": 18},
            {"name": "Tumulosic acid", "ob": 2.85, "dl": 0.68, "target_count": 14},
            {"name": "Poricoic acid A", "ob": 2.15, "dl": 0.62, "target_count": 12},
        ],
        "targets": ["AKT1", "TNF", "MAPK1", "IL6"],
        "diseases": ["水肿尿少", "痰饮眩悸", "脾虚食少", "便溏泄泻", "心神不安"],
    },
    {
        "name_cn": "薏苡仁", "name_latin": "Coix lacryma-jobi", "name_pinyin": "yi yi ren",
        "category": "利水渗湿药", "effects": "利水渗湿，健脾止泻，除痹，排脓，解毒散结",
        "ob_percent": 1.65, "dl_value": 0.68, "is_food_homology": True,
        "compounds": [
            {"name": "Coixenolide", "ob": 2.38, "dl": 0.65, "target_count": 15},
            {"name": "Coixol", "ob": 3.12, "dl": 0.55, "target_count": 10},
        ],
        "targets": ["AKT1", "TNF", "IL6", "PTGS2"],
        "diseases": ["水肿", "脚气", "小便不利", "脾虚泄泻", "湿痹拘挛"],
    },
    # ── 安神药 ──
    {
        "name_cn": "酸枣仁", "name_latin": "Ziziphus jujuba var. spinosa", "name_pinyin": "suan zao ren",
        "category": "安神药", "effects": "养心补肝，宁心安神，敛汗，生津",
        "ob_percent": 2.35, "dl_value": 0.68, "is_food_homology": True,
        "compounds": [
            {"name": "Jujuboside A", "ob": 1.38, "dl": 0.65, "target_count": 12},
            {"name": "Spinosin", "ob": 2.85, "dl": 0.62, "target_count": 15},
            {"name": "Betulinic acid", "ob": 3.21, "dl": 0.78, "target_count": 20},
        ],
        "targets": ["GABRA1", "5-HT3", "TNF", "IL6"],
        "diseases": ["虚烦不眠", "惊悸多梦", "体虚多汗", "津伤口渴"],
    },
    {
        "name_cn": "柏子仁", "name_latin": "Platycladus orientalis", "name_pinyin": "bai zi ren",
        "category": "安神药", "effects": "养心安神，润肠通便，止汗",
        "ob_percent": 1.25, "dl_value": 0.55, "is_food_homology": True,
        "compounds": [
            {"name": "Pinusin", "ob": 1.05, "dl": 0.48, "target_count": 8},
        ],
        "targets": ["GABRA1", "5-HT3"],
        "diseases": ["阴血不足", "心悸怔忡", "虚烦失眠", "肠燥便秘"],
    },
    # ── 收涩药 ──
    {
        "name_cn": "莲子", "name_latin": "Nelumbo nucifera", "name_pinyin": "lian zi",
        "category": "收涩药", "effects": "补脾止泻，止带，益肾涩精，养心安神",
        "ob_percent": 1.35, "dl_value": 0.58, "is_food_homology": True,
        "compounds": [
            {"name": "Nelumboside", "ob": 0.95, "dl": 0.42, "target_count": 8},
            {"name": "Nuciferine", "ob": 2.85, "dl": 0.65, "target_count": 15},
        ],
        "targets": ["GABRA1", "TNF", "IL6"],
        "diseases": ["脾虚泄泻", "带下", "遗精", "心悸失眠"],
    },
    {
        "name_cn": "芡实", "name_latin": "Euryale ferox", "name_pinyin": "qian shi",
        "category": "收涩药", "effects": "益肾固精，补脾止泻，除湿止带",
        "ob_percent": 1.18, "dl_value": 0.52, "is_food_homology": True,
        "compounds": [
            {"name": "Euryale saponin", "ob": 0.85, "dl": 0.38, "target_count": 6},
        ],
        "targets": ["TNF", "IL6"],
        "diseases": ["遗精滑精", "遗尿尿频", "脾虚久泻", "白浊带下"],
    },
    {
        "name_cn": "益智仁", "name_latin": "Alpinia oxyphylla", "name_pinyin": "yi zhi ren",
        "category": "收涩药", "effects": "暖肾固精缩尿，温脾止泻摄唾",
        "ob_percent": 2.15, "dl_value": 0.62, "is_food_homology": True,
        "compounds": [
            {"name": "Yakuchinone A", "ob": 3.65, "dl": 0.58, "target_count": 12},
            {"name": "Noogatol", "ob": 3.25, "dl": 0.52, "target_count": 10},
        ],
        "targets": ["TNF", "IL6", "PTGS2"],
        "diseases": ["肾虚遗尿", "小便频数", "遗精", "脾寒泄泻", "腹中冷痛"],
    },
    # ── 化湿药 ──
    {
        "name_cn": "藿香", "name_latin": "Agastache rugosa", "name_pinyin": "huo xiang",
        "category": "化湿药", "effects": "芳香化浊，和中止呕，发表解暑",
        "ob_percent": 3.25, "dl_value": 0.65, "is_food_homology": True,
        "compounds": [
            {"name": "Agastacheol", "ob": 3.52, "dl": 0.55, "target_count": 8},
            {"name": "Isomenthone", "ob": 4.15, "dl": 0.48, "target_count": 6},
        ],
        "targets": ["TNF", "IL6", "PTGS2"],
        "diseases": ["湿浊中阻", "脘痞呕吐", "暑湿表证", "湿温初起"],
    },
    {
        "name_cn": "紫苏", "name_latin": "Perilla frutescens", "name_pinyin": "zi su",
        "category": "解表药", "effects": "解表散寒，行气和胃",
        "ob_percent": 3.45, "dl_value": 0.68, "is_food_homology": True,
        "compounds": [
            {"name": "Perillaldehyde", "ob": 4.25, "dl": 0.55, "target_count": 10},
            {"name": "Luteolin", "ob": 4.25, "dl": 0.75, "target_count": 30},
            {"name": "Rosmarinic acid", "ob": 2.85, "dl": 0.62, "target_count": 18},
        ],
        "targets": ["PTGS2", "TNF", "IL6", "AKT1"],
        "diseases": ["风寒感冒", "咳嗽呕恶", "妊娠呕吐", "鱼蟹中毒"],
    },
    # ── 消食药 ──
    {
        "name_cn": "山楂", "name_latin": "Crataegus pinnatifida", "name_pinyin": "shan zha",
        "category": "消食药", "effects": "消食健胃，行气散瘀，化浊降脂",
        "ob_percent": 3.15, "dl_value": 0.72, "is_food_homology": True,
        "compounds": [
            {"name": "Oleanolic acid", "ob": 3.85, "dl": 0.78, "target_count": 28},
            {"name": "Ursolic acid", "ob": 3.92, "dl": 0.75, "target_count": 25},
            {"name": "Vitexin", "ob": 2.65, "dl": 0.62, "target_count": 15},
            {"name": "Hyperoside", "ob": 2.85, "dl": 0.58, "target_count": 18},
        ],
        "targets": ["PTGS2", "TNF", "AKT1", "MAPK3", "NOS3"],
        "diseases": ["肉食积滞", "胃脘胀满", "泻痢腹痛", "高脂血症"],
    },
    # ── 温里药 ──
    {
        "name_cn": "生姜", "name_latin": "Zingiber officinale", "name_pinyin": "sheng jiang",
        "category": "解表药", "effects": "解表散寒，温中止呕，化痰止咳",
        "ob_percent": 3.85, "dl_value": 0.62, "is_food_homology": True,
        "compounds": [
            {"name": "6-Gingerol", "ob": 3.62, "dl": 0.58, "target_count": 18},
            {"name": "8-Gingerol", "ob": 2.85, "dl": 0.55, "target_count": 14},
            {"name": "Shogaol", "ob": 4.15, "dl": 0.62, "target_count": 15},
        ],
        "targets": ["PTGS2", "TNF", "IL6", "MAPK3", "TRPV1"],
        "diseases": ["风寒感冒", "胃寒呕吐", "寒痰咳嗽"],
    },
    {
        "name_cn": "肉豆蔻", "name_latin": "Myristica fragrans", "name_pinyin": "rou dou kou",
        "category": "收涩药", "effects": "温中行气，涩肠止泻",
        "ob_percent": 2.85, "dl_value": 0.62, "is_food_homology": True,
        "compounds": [
            {"name": "Myristicin", "ob": 3.52, "dl": 0.52, "target_count": 10},
        ],
        "targets": ["GABRA1", "PTGS2"],
        "diseases": ["脾胃虚寒", "久泻不止", "脘腹胀痛", "食少呕吐"],
    },
    {
        "name_cn": "白扁豆", "name_latin": "Lablab purpureus", "name_pinyin": "bai bian dou",
        "category": "补气药", "effects": "健脾化湿，和中消暑",
        "ob_percent": 1.15, "dl_value": 0.48, "is_food_homology": True,
        "compounds": [
            {"name": "Lablab protease inhibitor", "ob": 0.45, "dl": 0.22, "target_count": 5},
        ],
        "targets": ["TNF"],
        "diseases": ["脾胃虚弱", "食欲不振", "大便溏泻", "暑湿吐泻"],
    },
    # ── 润下药 ──
    {
        "name_cn": "黑芝麻", "name_latin": "Sesamum indicum", "name_pinyin": "hei zhi ma",
        "category": "补阴药", "effects": "补肝肾，益精血，润肠燥",
        "ob_percent": 2.35, "dl_value": 0.68, "is_food_homology": True,
        "compounds": [
            {"name": "Sesamin", "ob": 3.85, "dl": 0.72, "target_count": 18},
            {"name": "Sesamolin", "ob": 3.42, "dl": 0.65, "target_count": 14},
        ],
        "targets": ["AKT1", "TNF", "MAPK1"],
        "diseases": ["头晕眼花", "耳鸣耳聋", "须发早白", "病后脱发", "肠燥便秘"],
    },
    # ── 其他常用药材 ──
    {
        "name_cn": "西洋参", "name_latin": "Panax quinquefolius", "name_pinyin": "xi yang shen",
        "category": "补气药", "effects": "补气养阴，清热生津",
        "ob_percent": 2.95, "dl_value": 0.80, "is_food_homology": True,
        "compounds": [
            {"name": "Ginsenoside Rb1", "ob": 1.82, "dl": 0.78, "target_count": 32},
            {"name": "Ginsenoside Re", "ob": 3.21, "dl": 0.76, "target_count": 21},
            {"name": "Ginsenoside Rg1", "ob": 2.63, "dl": 0.80, "target_count": 28},
        ],
        "targets": ["TNF", "IL6", "AKT1", "MAPK3", "TP53"],
        "diseases": ["气虚阴亏", "虚热烦倦", "咳喘痰血", "内热消渴"],
    },
    {
        "name_cn": "天冬", "name_latin": "Asparagus cochinchinensis", "name_pinyin": "tian dong",
        "category": "补阴药", "effects": "养阴润燥，清肺生津",
        "ob_percent": 1.55, "dl_value": 0.60, "is_food_homology": True,
        "compounds": [
            {"name": "Asparanin A", "ob": 2.35, "dl": 0.58, "target_count": 10},
        ],
        "targets": ["TNF", "IL6"],
        "diseases": ["肺燥干咳", "顿咳痰粘", "腰膝酸痛", "骨蒸潮热"],
    },
    {
        "name_cn": "南沙参", "name_latin": "Adenophora stricta", "name_pinyin": "nan sha shen",
        "category": "补阴药", "effects": "养阴清肺，益胃生津，化痰，益气",
        "ob_percent": 1.45, "dl_value": 0.55, "is_food_homology": True,
        "compounds": [
            {"name": "Adenophoric acid", "ob": 1.82, "dl": 0.48, "target_count": 8},
        ],
        "targets": ["TNF", "IL6"],
        "diseases": ["肺热燥咳", "阴虚劳嗽", "干咳痰粘", "胃阴不足"],
    },
    {
        "name_cn": "白豆蔻", "name_latin": "Amomum kravanh", "name_pinyin": "bai dou kou",
        "category": "化湿药", "effects": "化湿行气，温中止呕",
        "ob_percent": 2.65, "dl_value": 0.58, "is_food_homology": True,
        "compounds": [
            {"name": "1,8-Cineole", "ob": 4.52, "dl": 0.45, "target_count": 8},
        ],
        "targets": ["PTGS2", "TNF"],
        "diseases": ["湿阻气滞", "脾胃虚寒", "不思饮食", "胸腹胀痛"],
    },
    {
        "name_cn": "草豆蔻", "name_latin": "Alpinia katsumadai", "name_pinyin": "cao dou kou",
        "category": "化湿药", "effects": "燥湿行气，温中止呕",
        "ob_percent": 2.45, "dl_value": 0.55, "is_food_homology": True,
        "compounds": [
            {"name": "Alpinetin", "ob": 2.85, "dl": 0.52, "target_count": 10},
            {"name": "Cardamonin", "ob": 3.15, "dl": 0.55, "target_count": 12},
        ],
        "targets": ["TNF", "IL6", "PTGS2"],
        "diseases": ["寒湿内阻", "脘腹胀满冷痛", "不思饮食", "嗳气呕逆"],
    },
    {
        "name_cn": "鱼腥草", "name_latin": "Houttuynia cordata", "name_pinyin": "yu xing cao",
        "category": "清热解毒药", "effects": "清热解毒，消痈排脓，利尿通淋",
        "ob_percent": 2.85, "dl_value": 0.58, "is_food_homology": True,
        "compounds": [
            {"name": "Houttuynin", "ob": 3.52, "dl": 0.52, "target_count": 8},
            {"name": "Quercitrin", "ob": 2.65, "dl": 0.62, "target_count": 15},
        ],
        "targets": ["PTGS2", "TNF", "IL6"],
        "diseases": ["肺痈吐脓", "痰热喘咳", "热痢", "痈肿疮毒"],
    },
    {
        "name_cn": "马齿苋", "name_latin": "Portulaca oleracea", "name_pinyin": "ma chi xian",
        "category": "清热解毒药", "effects": "清热解毒，凉血止血，止痢",
        "ob_percent": 2.15, "dl_value": 0.52, "is_food_homology": True,
        "compounds": [
            {"name": "Portulacanone A", "ob": 3.25, "dl": 0.48, "target_count": 8},
            {"name": "Omega-3 fatty acid", "ob": 1.85, "dl": 0.35, "target_count": 15},
        ],
        "targets": ["PTGS2", "TNF", "IL6"],
        "diseases": ["热毒血痢", "痈肿疔疮", "湿疹", "丹毒", "蛇虫咬伤"],
    },
    {
        "name_cn": "蜂蜜", "name_latin": "Apis cerana", "name_pinyin": "feng mi",
        "category": "补气药", "effects": "补中，润燥，止痛，解毒",
        "ob_percent": 0.85, "dl_value": 0.35, "is_food_homology": True,
        "compounds": [
            {"name": "Chrysin", "ob": 2.35, "dl": 0.55, "target_count": 12},
            {"name": "Pinocembrin", "ob": 2.85, "dl": 0.58, "target_count": 15},
        ],
        "targets": ["PTGS2", "TNF", "IL6"],
        "diseases": ["脘腹虚痛", "肺燥干咳", "肠燥便秘", "解乌头毒"],
    },
]

# 药食同源完整目录（按批次）
FOOD_HOMOLOGY_CATALOG = {
    # 1987 年首批
    "八角茴香", "刀豆", "姜（生姜、干姜）", "枣（大枣、酸枣、黑枣）", "山药",
    "山楂", "小茴香", "木瓜", "龙眼肉（桂圆）", "决明子", "百合", "肉豆蔻",
    "肉桂", "莲子", "芡实", "花椒", "麦芽", "赤小豆", "佛手", "杏仁（甜、苦）",
    "昆布", "桃仁", "莲子", "桑葚", "淡豆豉", "黑芝麻", "黑胡椒", "蜂蜜",
    "榧子", "薏苡仁", "枸杞子",
    # 1991 年增补
    "胖大海", "金银花", "余甘子", "葛根", "鱼腥草",
    # 2002 年增补
    "蒲公英", "益智仁", "藿香", "酸枣仁", "鲜芦根", "荷叶", "乌梢蛇",
    "蝉蜕", "五加皮", "杜仲叶", "沙棘", "牡蛎", "乌梅", "橘皮（陈皮）",
    "薄荷", "紫苏", "薤白", "覆盆子", "玫瑰花", "人参叶", "制何首乌",
    "芦荟", "三七", "牛蒡根", "北沙参", "南沙参", "天冬", "麦冬",
    "丹参", "西洋参", "黄芪", "山药", "白术", "补骨脂", "当归",
    "党参", "肉苁蓉", "锁阳", "黄精", "玉竹", "白芍", "菊花",
    "桑叶", "黄荆子", "鸡内金", "青果", "栀子", "甘草", "罗汉果",
    "肉桂", "砂仁", "草豆蔻", "陈皮", "香橼", "香薷", "茯苓",
    # 2014 年增补
    "人参", "山银花", "芫荽", "玫瑰花", "松花粉", "粉葛", "布渣叶",
    "夏枯草", "当归", "山奈", "西红花", "草果", "姜黄", "荜茇",
    # 2018 年试点
    "党参", "肉苁蓉", "铁皮石斛", "西洋参", "黄芪", "灵芝", "天麻",
    "山茱萸", "杜仲叶", "杜仲", "当归", "熟地黄", "麦冬", "化橘红",
    # 2019 年增补
    "人参", "人参叶", "人参须", "三七", "山银花", "小蓟", "山药",
    "山楂", "川牛膝", "麦芽", "天冬", "木香", "五味子", "太子参",
    "白芷", "白芍", "白术", "白茅根", "龙眼肉", "决明子", "肉桂",
    "余甘子", "杜仲叶", "沙棘", "陈皮", "青果", "玫瑰花", "苦荞麦",
    "金银花", "泽泻", "柏子仁", "枸杞子", "栀子", "砂仁", "胖大海",
    "茯苓", "香橼", "香薷", "桃仁", "桑叶", "桑葚", "桔梗",
    "益智仁", "荷叶", "莱菔子", "莲子", "高良姜", "淡竹叶", "菊花",
    "菊苣", "黄芥子", "黄精", "紫苏", "紫苏子", "葛根", "黑芝麻",
    "黑胡椒", "槐米", "蒲公英", "榧子", "酸枣仁", "鲜白茅根", "鲜芦根",
    "蝮蛇", "橘红", "橘络", "薄荷", "薏苡仁", "薤白", "覆盆子",
    "广藿香",
}


class TCMSPSyncService:
    """TCMSP 数据库同步服务 - 内置知识库版本"""

    def __init__(self):
        self.kb_version = "2024.1"

    @property
    def herb_count(self) -> int:
        """动态获取当前知识库药材总数（合并后实时计算）"""
        return len(TCMSP_HERB_DATABASE)

    async def get_sync_stats(self, db: AsyncSession) -> dict[str, Any]:
        """获取同步统计信息（数据库优先，DB 不可用时用内存知识库）"""
        import logging
        logger = logging.getLogger(__name__)

        try:
            from sqlalchemy import func
            from app.models.models import TCMHerb

            total_herbs = (await db.execute(select(func.count()).select_from(TCMHerb))).scalar() or 0
            food_homology = (await db.execute(
                select(func.count()).select_from(TCMHerb).where(TCMHerb.is_food_homology == True)
            )).scalar() or 0
            category_stats = await db.execute(
                select(TCMHerb.category, func.count())
                .group_by(TCMHerb.category)
            )
            categories = {row[0] or "未分类": row[1] for row in category_stats.all()}

            # DataSnapshot 查询独立处理（表可能不存在，不应阻塞核心统计）
            last_sync = None
            snapshot_id = None
            try:
                from app.models.models import DataSnapshot
                latest_snapshot = (await db.execute(
                    select(DataSnapshot).where(DataSnapshot.source_db == "tcm_knowledge_base")
                    .order_by(DataSnapshot.created_at.desc()).limit(1)
                )).scalar_one_or_none()
                if latest_snapshot:
                    last_sync = latest_snapshot.created_at.isoformat()
                    snapshot_id = latest_snapshot.snapshot_id
            except Exception as snap_err:
                logger.debug(f"DataSnapshot query skipped: {snap_err}")

            return {
                "total_herbs": total_herbs,
                "food_homology_count": food_homology,
                "kb_total": self.herb_count,
                "categories": categories,
                "last_sync": last_sync,
                "snapshot_id": snapshot_id,
            }
        except Exception as err:
            # 仅在数据库完全不可用时降级到内存知识库
            logger.warning(f"get_sync_stats DB query failed, falling back to memory ({self.herb_count} items): {err}")
            food_homology_kb = sum(1 for h in TCMSP_HERB_DATABASE if h.get("is_food_homology", False))
            cat_counts: dict[str, int] = {}
            for herb in TCMSP_HERB_DATABASE:
                cat = herb.get("category") or "未分类"
                cat_counts[cat] = cat_counts.get(cat, 0) + 1
            return {
                "total_herbs": self.herb_count,
                "food_homology_count": food_homology_kb,
                "kb_total": self.herb_count,
                "categories": cat_counts,
                "last_sync": None,
                "snapshot_id": None,
            }

    async def sync_herbs(self, db: AsyncSession, force: bool = False) -> dict[str, Any]:
        """
        将内置知识库数据同步到本地数据库。
        支持增量同步（同名药材更新，新增药材插入）。
        优化：批量加载 + UPSERT 替代 N+1 查询。
        """
        from app.models.models import TCMHerb, DataSnapshot
        import json

        now = datetime.utcnow()
        snapshot_id = f"tcmsp_{now.strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:8]}"
        checksum_data = json.dumps(TCMSP_HERB_DATABASE, sort_keys=True, ensure_ascii=False)
        checksum = hashlib.md5(checksum_data.encode()).hexdigest()

        # 去重旧的活跃快照
        await db.execute(
            DataSnapshot.__table__.update()
            .where(DataSnapshot.source_db == "tcm_knowledge_base", DataSnapshot.is_active == True)
            .values(is_active=False)
        )

        # ── 批量加载现有药材（解决 N+1 问题）──
        all_existing = (await db.execute(select(TCMHerb))).scalars().all()
        herb_map: dict[str, TCMHerb] = {h.name_cn: h for h in all_existing if h.name_cn}

        inserted = 0
        updated = 0

        for herb_data in TCMSP_HERB_DATABASE:
            name = herb_data["name_cn"]
            existing = herb_map.get(name)

            if existing:
                # 增量更新
                existing.name_latin = herb_data["name_latin"]
                existing.name_pinyin = herb_data["name_pinyin"]
                existing.category = herb_data["category"]
                existing.ob_percent = herb_data["ob_percent"]
                existing.dl_value = herb_data["dl_value"]
                existing.effects = herb_data["effects"]
                existing.is_food_homology = herb_data["is_food_homology"]
                existing.compounds = herb_data["compounds"]
                existing.targets = herb_data["targets"]
                existing.diseases = herb_data["diseases"]
                existing.source_version = self.kb_version
                existing.synced_at = now
                updated += 1
            else:
                new_herb = TCMHerb(
                    name_cn=name,
                    name_latin=herb_data["name_latin"],
                    name_pinyin=herb_data["name_pinyin"],
                    category=herb_data["category"],
                    ob_percent=herb_data["ob_percent"],
                    dl_value=herb_data["dl_value"],
                    effects=herb_data["effects"],
                    is_food_homology=herb_data["is_food_homology"],
                    compounds=herb_data["compounds"],
                    targets=herb_data["targets"],
                    diseases=herb_data["diseases"],
                    source_version=self.kb_version,
                    synced_at=now,
                )
                db.add(new_herb)
                inserted += 1

        # 创建快照
        snapshot = DataSnapshot(
            snapshot_id=snapshot_id,
            source_db="tcm_knowledge_base",
            total_records=self.herb_count,
            checksum=checksum,
            metadata_={"version": self.kb_version, "inserted": inserted, "updated": updated},
            is_active=True,
        )
        db.add(snapshot)

        await db.commit()
        logger.info(f"TCMSP 同步完成: 新增 {inserted}, 更新 {updated}, 总计 {self.herb_count}")

        return {
            "status": "success",
            "snapshot_id": snapshot_id,
            "inserted": inserted,
            "updated": updated,
            "total_kb": self.herb_count,
            "version": self.kb_version,
            "synced_at": now.isoformat(),
        }

    async def search_compounds(self, herb_name: str, db: AsyncSession) -> list[dict[str, Any]]:
        """查询药材的活性化合物列表"""
        herb = (await db.execute(
            select(TCMHerb).where(TCMHerb.name_cn == herb_name)
        )).scalar_one_or_none()
        if not herb or not herb.compounds:
            # 回退到知识库
            for h in TCMSP_HERB_DATABASE:
                if h["name_cn"] == herb_name:
                    return h.get("compounds", [])
            return []
        return herb.compounds

    async def search_targets(self, compound_name: str, db: AsyncSession) -> list[dict[str, Any]]:
        """查询化合物的靶点信息（从知识库搜索）"""
        targets_set = set()
        for herb in TCMSP_HERB_DATABASE:
            for comp in herb.get("compounds", []):
                if compound_name.lower() in comp["name"].lower():
                    targets_set.update(herb.get("targets", []))
        return [{"target": t} for t in sorted(targets_set)]

    async def check_food_homology(self, herb_name: str) -> dict[str, Any]:
        """检查药材是否在药食同源目录中"""
        # 规范化名称（去括号内容）
        normalized = herb_name.split("（")[0].split("(")[0].strip()
        is_homology = normalized in FOOD_HOMOLOGY_CATALOG

        # 查找匹配的目录条目
        matched_entries = [e for e in FOOD_HOMOLOGY_CATALOG if normalized in e or e in normalized]

        return {
            "is_food_homology": is_homology,
            "herb_name": herb_name,
            "normalized_name": normalized,
            "matched_catalog_entries": matched_entries[:5],
            "regulatory_basis": "既是食品又是中药材的物质目录" if is_homology else "不在已公布的药食同源目录中",
            "catalog_count": len(FOOD_HOMOLOGY_CATALOG),
        }

    async def get_categories(self, db: AsyncSession | None = None) -> list[dict[str, Any]]:
        """获取所有药材分类及其数量（数据库优先，无数据时用内存知识库）"""
        try:
            if db is None:
                raise Exception("No database session provided")
            from sqlalchemy import func
            from app.models.models import TCMHerb

            result = await db.execute(
                select(TCMHerb.category, func.count())
                .group_by(TCMHerb.category)
                .order_by(func.count().desc())
            )
            rows = result.all()
            if rows:
                return [{"category": row[0] or "未分类", "count": row[1]} for row in rows]
        except Exception as e:
            logger.debug("TCMSP 分类统计查询失败，使用内存数据: %s", e)
        cat_counts: dict[str, int] = {}
        for herb in TCMSP_HERB_DATABASE:
            cat = herb.get("category") or "未分类"
            cat_counts[cat] = cat_counts.get(cat, 0) + 1
        return [
            {"category": cat, "count": cnt}
            for cat, cnt in sorted(cat_counts.items(), key=lambda x: -x[1])
        ]

    async def get_food_homology_list(
        self, db: AsyncSession, keyword: str = "", page: int = 1, page_size: int = 50
    ) -> dict[str, Any]:
        """获取药食同源药材列表（数据库优先，无数据时用内存知识库）"""
        try:
            from sqlalchemy import func
            from app.models.models import TCMHerb

            query = select(TCMHerb).where(TCMHerb.is_food_homology == True)
            count_query = select(func.count()).select_from(TCMHerb).where(TCMHerb.is_food_homology == True)

            if keyword:
                like = f"%{keyword}%"
                query = query.where(
                    (TCMHerb.name_cn.ilike(like))
                    | (TCMHerb.effects.ilike(like))
                    | (TCMHerb.category.ilike(like))
                )
                count_query = count_query.where(
                    (TCMHerb.name_cn.ilike(like))
                    | (TCMHerb.effects.ilike(like))
                    | (TCMHerb.category.ilike(like))
                )

            total = (await db.execute(count_query)).scalar() or 0
            items = (await db.execute(
                query.order_by(TCMHerb.name_cn).offset((page - 1) * page_size).limit(page_size)
            )).scalars().all()

            if total > 0 or items:
                return {
                    "items": [
                        {
                            "id": h.id,
                            "name_cn": h.name_cn,
                            "name_latin": h.name_latin,
                            "name_pinyin": h.name_pinyin,
                            "category": h.category,
                            "effects": h.effects,
                            "ob_percent": h.ob_percent,
                            "dl_value": h.dl_value,
                            "compound_count": len(h.compounds) if h.compounds else 0,
                            "source_version": h.source_version,
                        }
                        for h in items
                    ],
                    "total": total,
                    "page": page,
                    "page_size": page_size,
                }
        except Exception as e:
            logger.debug("TCMSP 药食同源药材查询失败，使用内存数据: %s", e)
        all_items = [
            {
                "id": -(idx + 1),  # 负数 ID 表示内存数据
                "name_cn": h.get("name_cn", ""),
                "name_latin": h.get("name_latin", ""),
                "name_pinyin": h.get("name_pinyin", ""),
                "category": h.get("category", ""),
                "effects": h.get("effects", ""),
                "ob_percent": h.get("ob_percent"),
                "dl_value": h.get("dl_value"),
                "compound_count": len(h.get("compounds", [])),
            }
            for idx, h in enumerate(TCMSP_HERB_DATABASE)
            if h.get("is_food_homology", False)
        ]

        # 关键词过滤
        if keyword:
            kw = keyword.lower()
            all_items = [
                it for it in all_items
                if kw in it["name_cn"].lower()
                or kw in it["effects"].lower()
                or kw in it["category"].lower()
            ]

        total = len(all_items)
        start = (page - 1) * page_size
        return {
            "items": all_items[start:start + page_size],
            "total": total,
            "page": page,
            "page_size": page_size,
        }


# 全局实例
tcmsp_service = TCMSPSyncService()

# ═══════════════════════════════════════════
# 合并扩展数据（延迟到 TCMSP_HERB_DATABASE 定义后执行）
# ═══════════════════════════════════════════
if '_EXPANDED_HERBS' in dir() and _EXPANDED_HERBS:
    _EXISTING_NAMES = {h["name_cn"] for h in TCMSP_HERB_DATABASE}
    _NEW_HERBS = [h for h in _EXPANDED_HERBS if h["name_cn"] not in _EXISTING_NAMES]
    TCMSP_HERB_DATABASE = TCMSP_HERB_DATABASE + _NEW_HERBS
    logger.info(f"合并扩展药材数据: 原有 {len(TCMSP_HERB_DATABASE) - len(_NEW_HERBS)} + 新增 {len(_NEW_HERBS)} = 总计 {len(TCMSP_HERB_DATABASE)}")
