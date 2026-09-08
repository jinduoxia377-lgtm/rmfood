"""
RMFOOD 配方平台 — ETL 数据同步管道
=====================================
Phase 1: EXTRACT  — 源数据提取与预校验
Phase 2: TRANSFORM — 数据校正与富化（基于 TCMSP 金标）
Phase 3: LOAD     — 事务性批量回写
Phase 4: ID 序列重建
Phase 5: VERIFY   — 同步后验证与报告

运行方式:
    python etl_sync_pipeline.py

依赖: asyncpg (pip install asyncpg)
数据库: PostgreSQL @ localhost:5432 (from .env DATABASE_URL)
"""

import asyncio
import asyncpg
import hashlib
import json
import sys
import time
from datetime import datetime, timezone
from typing import Any

# ════════════════════════════════════════════════
# 常量定义
# ════════════════════════════════════════════════

from scripts.db_utils import get_asyncpg_dsn; DB_URL = get_asyncpg_dsn()
EXPECTED_RECORD_COUNT = 292
SOURCE_VERSION = "etl_v1.0"

# ════════════════════════════════════════════════
# TCMSP 官方金标参考数据集（从 herb_cross_validation.py 提取）
# ════════════════════════════════════════════════

TCMSP_GOLDEN: dict[str, dict[str, Any]] = {
    # ── 补气药 ──
    "人参": {"latin": "Panax ginseng C.A.Mey.", "cat": "补气药", "ob_range": (3.0, 4.5), "dl_range": (0.7, 0.9), "food": True},
    "黄芪": {"latin": "Astragalus membranaceus (Fisch.) Bge.", "cat": "补气药", "ob_range": (2.0, 3.5), "dl_range": (0.6, 0.85), "food": True},
    "党参": {"latin": "Codonopsis pilosula (Franch.) Nannf.", "cat": "补气药", "ob_range": (1.5, 3.0), "dl_range": (0.55, 0.8), "food": True},
    "白术": {"latin": "Atractylodes macrocephala Koidz.", "cat": "补气药", "ob_range": (2.5, 4.0), "dl_range": (0.6, 0.85), "food": True},
    "山药": {"latin": "Dioscorea opposita Thunb.", "cat": "补气药", "ob_range": (2.5, 4.0), "dl_range": (0.55, 0.8), "food": True},
    "甘草": {"latin": "Glycyrrhiza uralensis Fisch.", "cat": "补气药", "ob_range": (3.0, 4.5), "dl_range": (0.65, 0.9), "food": True},
    "大枣": {"latin": "Ziziphus jujuba Mill.", "cat": "补气药", "ob_range": (2.5, 4.0), "dl_range": (0.5, 0.75), "food": True},
    "太子参": {"latin": "Pseudostellaria heterophylla (Miq.) Pax", "cat": "补气药", "ob_range": (1.5, 3.0), "dl_range": (0.5, 0.75), "food": True},
    # ── 补阳药 ──
    "鹿茸": {"latin": "Cervi Cornu Pantotrichum", "cat": "补阳药", "ob_range": (1.0, 3.0), "dl_range": (0.4, 0.7), "food": False},
    "淫羊藿": {"latin": "Epimedium brevicornum Maxim.", "cat": "补阳药", "ob_range": (2.5, 4.5), "dl_range": (0.5, 0.75), "food": False},
    "肉苁蓉": {"latin": "Cistanche deserticola Y.C.Ma", "cat": "补阳药", "ob_range": (2.0, 4.0), "dl_range": (0.45, 0.7), "food": False},
    "杜仲": {"latin": "Eucommia ulmoides Oliv.", "cat": "补阳药", "ob_range": (2.5, 4.5), "dl_range": (0.55, 0.8), "food": True},
    "巴戟天": {"latin": "Morinda officinalis How.", "cat": "补阳药", "ob_range": (2.5, 4.5), "dl_range": (0.45, 0.7), "food": False},
    "菟丝子": {"latin": "Cuscuta chinensis Lam.", "cat": "补阳药", "ob_range": (2.0, 4.0), "dl_range": (0.45, 0.7), "food": True},
    "补骨脂": {"latin": "Psoralea corylifolia L.", "cat": "补阳药", "ob_range": (2.0, 4.0), "dl_range": (0.4, 0.65), "food": False},
    "益智仁": {"latin": "Alpinia oxyphylla Miq.", "cat": "补阳药", "ob_range": (2.0, 3.5), "dl_range": (0.4, 0.65), "food": True},
    "冬虫夏草": {"latin": "Cordyceps sinensis (Berk.) Sacc.", "cat": "补阳药", "ob_range": (1.0, 3.0), "dl_range": (0.35, 0.6), "food": False},
    # ── 补阴药 ──
    "北沙参": {"latin": "Glehnia littoralis F.Schmidt ex Miq.", "cat": "补阴药", "ob_range": (2.0, 3.5), "dl_range": (0.5, 0.75), "food": True},
    "南沙参": {"latin": "Adenophora stricta Miq.", "cat": "补阴药", "ob_range": (1.5, 3.0), "dl_range": (0.45, 0.7), "food": False},
    "麦冬": {"latin": "Ophiopogon japonicus (L.f) Ker-Gawl.", "cat": "补阴药", "ob_range": (2.5, 4.0), "dl_range": (0.55, 0.8), "food": True},
    "天冬": {"latin": "Asparagus cochinchinensis (Lour.) Merr.", "cat": "补阴药", "ob_range": (1.5, 3.0), "dl_range": (0.4, 0.65), "food": False},
    "石斛": {"latin": "Dendrobium nobile Lindl.", "cat": "补阴药", "ob_range": (2.0, 4.0), "dl_range": (0.45, 0.7), "food": False},
    "玉竹": {"latin": "Polygonatum odoratum (Mill.) Druce", "cat": "补阴药", "ob_range": (2.5, 4.0), "dl_range": (0.55, 0.8), "food": True},
    "枸杞子": {"latin": "Lycium chinense Mill.", "cat": "补阴药", "ob_range": (3.0, 4.5), "dl_range": (0.6, 0.85), "food": True},
    "女贞子": {"latin": "Ligustrum lucidum Ait.", "cat": "补阴药", "ob_range": (2.0, 3.5), "dl_range": (0.45, 0.7), "food": False},
    "百合": {"latin": "Lilii brownii var. viridulum Baker", "cat": "补阴药", "ob_range": (2.5, 4.0), "dl_range": (0.55, 0.8), "food": True},
    "龟甲": {"latin": "Testudinis Carapax et Plastrum", "cat": "补阴药", "ob_range": (0.5, 2.0), "dl_range": (0.25, 0.5), "food": False},
    # ── 补血药 ──
    "当归": {"latin": "Angelica sinensis (Oliv.) Diels", "cat": "补血药", "ob_range": (3.0, 4.5), "dl_range": (0.6, 0.85), "food": False},
    "熟地黄": {"latin": "Rehmannia glutinosa (Gaertn.) Libosch. ex Steud.", "cat": "补血药", "ob_range": (2.5, 4.0), "dl_range": (0.5, 0.75), "food": False},
    "白芍": {"latin": "Paeonia lactiflora Pall.", "cat": "补血药", "ob_range": (3.0, 4.5), "dl_range": (0.6, 0.85), "food": True},
    "阿胶": {"latin": "Asini Corii Colla", "cat": "补血药", "ob_range": (1.0, 3.0), "dl_range": (0.3, 0.55), "food": True},
    "何首乌": {"latin": "Polygonum multiflorum Thunb.", "cat": "补血药", "ob_range": (2.0, 4.0), "dl_range": (0.45, 0.7), "food": True},
    "龙眼肉": {"latin": "Longan Arillus", "cat": "补血药", "ob_range": (2.5, 4.0), "dl_range": (0.5, 0.75), "food": True},
    # ── 清热解毒药 ──
    "金银花": {"latin": "Lonicera japonica Thunb.", "cat": "清热解毒药", "ob_range": (3.0, 4.5), "dl_range": (0.55, 0.8), "food": False},
    "连翘": {"latin": "Forsythia suspensa (Thunb.) Vahl", "cat": "清热解毒药", "ob_range": (3.0, 4.5), "dl_range": (0.55, 0.8), "food": False},
    "板蓝根": {"latin": "Isatis indigotica Fort.", "cat": "清热解毒药", "ob_range": (2.5, 4.0), "dl_range": (0.5, 0.75), "food": False},
    "蒲公英": {"latin": "Taraxacum mongolicum Hand.-Mazz.", "cat": "清热解毒药", "ob_range": (2.5, 4.0), "dl_range": (0.45, 0.7), "food": True},
    "鱼腥草": {"latin": "Houttuynia cordata Thunb.", "cat": "清热解毒药", "ob_range": (2.5, 4.0), "dl_range": (0.4, 0.65), "food": True},
    "穿心莲": {"latin": "Andrographis paniculata (Burm.f.) Nees", "cat": "清热解毒药", "ob_range": (3.0, 4.5), "dl_range": (0.5, 0.75), "food": False},
    "野菊花": {"latin": "Chrysanthema indicum L.", "cat": "清热解毒药", "ob_range": (2.5, 4.0), "dl_range": (0.45, 0.7), "food": False},
    "白花蛇舌草": {"latin": "Hedyotis diffusa Willd.", "cat": "清热解毒药", "ob_range": (2.0, 4.0), "dl_range": (0.4, 0.65), "food": False},
    # ── 解表药 ──
    "麻黄": {"latin": "Ephedra sinica Stapf", "cat": "解表药", "ob_range": (3.0, 4.5), "dl_range": (0.55, 0.8), "food": False},
    "桂枝": {"latin": "Cinnamomum cassia Presl", "cat": "解表药", "ob_range": (3.0, 4.5), "dl_range": (0.55, 0.8), "food": False},
    "防风": {"latin": "Saposhnikovia divaricata (Turcz.) Schischk.", "cat": "解表药", "ob_range": (2.5, 4.0), "dl_range": (0.5, 0.75), "food": False},
    "荆芥": {"latin": "Schizonepeta tenuifolia Briq.", "cat": "解表药", "ob_range": (2.5, 4.0), "dl_range": (0.5, 0.75), "food": False},
    "紫苏叶": {"latin": "Perilla frutescens (L.) Britt.", "cat": "解表药", "ob_range": (2.5, 4.0), "dl_range": (0.5, 0.75), "food": True},
    "生姜": {"latin": "Zingiber officinale Roscoe", "cat": "解表药", "ob_range": (3.0, 4.5), "dl_range": (0.6, 0.85), "food": True},
    "菊花": {"latin": "Chrysanthemum morifolium Ramat.", "cat": "解表药", "ob_range": (2.5, 4.0), "dl_range": (0.5, 0.75), "food": True},
    "柴胡": {"latin": "Bupleurum chinense DC.", "cat": "解表药", "ob_range": (3.0, 4.5), "dl_range": (0.6, 0.85), "food": False},
    "葛根": {"latin": "Pueraria lobata (Willd.) Ohwi", "cat": "解表药", "ob_range": (3.0, 4.5), "dl_range": (0.55, 0.8), "food": True},
    "薄荷": {"latin": "Mentha haplocalyx Briq.", "cat": "解表药", "ob_range": (3.0, 4.5), "dl_range": (0.55, 0.8), "food": True},
    # ── 活血化瘀药 ──
    "川芎": {"latin": "Ligusticum chuanxiong Hort.", "cat": "活血化瘀药", "ob_range": (3.0, 4.5), "dl_range": (0.55, 0.8), "food": False},
    "丹参": {"latin": "Salvia miltiorrhiza Bge.", "cat": "活血化瘀药", "ob_range": (3.0, 4.5), "dl_range": (0.55, 0.8), "food": False},
    "红花": {"latin": "Carthamus tinctorius L.", "cat": "活血化瘀药", "ob_range": (3.0, 4.5), "dl_range": (0.55, 0.8), "food": False},
    "桃仁": {"latin": "Prunus persica (L.) Batsch", "cat": "活血化瘀药", "ob_range": (2.5, 4.0), "dl_range": (0.5, 0.75), "food": False},
    "三七": {"latin": "Panax notoginseng (Burk.) F.H.Chen", "cat": "活血化瘀药", "ob_range": (3.0, 4.5), "dl_range": (0.6, 0.85), "food": False},
    "郁金": {"latin": "Curcuma aromatica Salisb.", "cat": "活血化瘀药", "ob_range": (2.5, 4.0), "dl_range": (0.5, 0.75), "food": False},
    "延胡索": {"latin": "Corydalis yanhusuo W.T.Wang", "cat": "活血化瘀药", "ob_range": (3.0, 4.5), "dl_range": (0.55, 0.8), "food": False},
    "益母草": {"latin": "Leonurus japonicus Houtt.", "cat": "活血化瘀药", "ob_range": (2.5, 4.0), "dl_range": (0.45, 0.7), "food": False},
    # ── 利水渗湿药 ──
    "茯苓": {"latin": "Poria cocos (Schw.) Wolf", "cat": "利水渗湿药", "ob_range": (2.5, 4.0), "dl_range": (0.5, 0.75), "food": True},
    "泽泻": {"latin": "Alisma orientale (Sam.) Juzep.", "cat": "利水渗湿药", "ob_range": (2.5, 4.0), "dl_range": (0.5, 0.75), "food": True},
    "薏苡仁": {"latin": "Coix lacryma-jobi L.var.ma-yuen Stapf", "cat": "利水渗湿药", "ob_range": (2.5, 4.0), "dl_range": (0.55, 0.8), "food": True},
    "车前子": {"latin": "Plantago asiatica L.", "cat": "利水渗湿药", "ob_range": (2.5, 4.0), "dl_range": (0.5, 0.75), "food": True},
    "茵陈": {"latin": "Artemisia capillaris Thunb.", "cat": "利水渗湿药", "ob_range": (2.5, 4.0), "dl_range": (0.45, 0.7), "food": False},
    # ── 理气药 ──
    "陈皮": {"latin": "Citri Reticulatae Pericarpium", "cat": "理气药", "ob_range": (3.0, 4.5), "dl_range": (0.55, 0.8), "food": True},
    "枳实": {"latin": "Citrus aurantium L.", "cat": "理气药", "ob_range": (2.5, 4.0), "dl_range": (0.5, 0.75), "food": False},
    "木香": {"latin": "Aucklandia lappa Decne.", "cat": "理气药", "ob_range": (2.5, 4.0), "dl_range": (0.5, 0.75), "food": False},
    "香附": {"latin": "Cyperus rotundus L.", "cat": "理气药", "ob_range": (2.5, 4.0), "dl_range": (0.5, 0.75), "food": False},
    "厚朴": {"latin": "Magnolia officinalis Rehd.et Wils.", "cat": "理气药", "ob_range": (2.5, 4.0), "dl_range": (0.5, 0.75), "food": False},
    # ── 化痰止咳平喘药 ──
    "半夏": {"latin": "Pinellia ternata (Thunb.) Breit.", "cat": "化痰止咳平喘药", "ob_range": (2.5, 4.0), "dl_range": (0.45, 0.7), "food": False},
    "桔梗": {"latin": "Platycodon grandiflorum (Jacq.) A.DC.", "cat": "化痰止咳平喘药", "ob_range": (2.5, 4.0), "dl_range": (0.55, 0.8), "food": False},
    "川贝母": {"latin": "Fritillaria cirrhosa D.Don", "cat": "化痰止咳平喘药", "ob_range": (2.0, 3.5), "dl_range": (0.45, 0.7), "food": False},
    "浙贝母": {"latin": "Fritillaria thunbergii Miq.", "cat": "化痰止咳平喘药", "ob_range": (2.5, 4.0), "dl_range": (0.5, 0.75), "food": False},
    "杏仁": {"latin": "Prunus armeniaca L.var.ansu Maxim.", "cat": "化痰止咳平喘药", "ob_range": (2.5, 4.0), "dl_range": (0.5, 0.75), "food": True},
    "紫菀": {"latin": "Aster tataricus L.f.", "cat": "化痰止咳平喘药", "ob_range": (2.0, 3.5), "dl_range": (0.45, 0.7), "food": False},
    "款冬花": {"latin": "Farfaria fritschii (Diels) Wang et Tang", "cat": "化痰止咳平喘药", "ob_range": (2.0, 3.5), "dl_range": (0.4, 0.65), "food": False},
    # ── 安神药 ──
    "酸枣仁": {"latin": "Ziziphi spinosae Semen", "cat": "安神药", "ob_range": (2.5, 4.0), "dl_range": (0.5, 0.75), "food": False},
    "远志": {"latin": "Polygala tenuifolia Willd.", "cat": "安神药", "ob_range": (2.0, 3.5), "dl_range": (0.4, 0.65), "food": False},
    "柏子仁": {"latin": "Platycladus orientalis (L.) Franco", "cat": "安神药", "ob_range": (2.5, 4.0), "dl_range": (0.5, 0.75), "food": True},
    "合欢皮": {"latin": "Albizia julibrissin Durazz.", "cat": "安神药", "ob_range": (2.0, 3.5), "dl_range": (0.45, 0.7), "food": False},
    # ── 平肝息风药 ──
    "天麻": {"latin": "Gastrodia elata Bl.", "cat": "平肝息风药", "ob_range": (2.5, 4.0), "dl_range": (0.5, 0.75), "food": False},
    "钩藤": {"latin": "Uncaria rhynchophylla (Miq.) Havil.", "cat": "平肝息风药", "ob_range": (2.5, 4.0), "dl_range": (0.45, 0.7), "food": False},
    "石决明": {"latin": "Haliotidis Concha", "cat": "平肝息风药", "ob_range": (0.5, 2.0), "dl_range": (0.2, 0.45), "food": False},
    "牡蛎": {"latin": "Ostreae Concha", "cat": "平肝息风药", "ob_range": (0.5, 2.0), "dl_range": (0.2, 0.45), "food": True},
    "全蝎": {"latin": "Buthus martensii Karsch", "cat": "平肝息风药", "ob_range": (1.5, 3.0), "dl_range": (0.35, 0.6), "food": False},
    # ── 止血药 ──
    "三七": {"latin": "Panax notoginseng (Burk.) F.H.Chen", "cat": "止血药", "ob_range": (3.0, 4.5), "dl_range": (0.6, 0.85), "food": False},
    "白及": {"latin": "Bletilla striata (Thunb.ex A.Murray)Rchb.F.", "cat": "止血药", "ob_range": (2.0, 3.5), "dl_range": (0.4, 0.65), "food": False},
    "蒲黄": {"latin": "Typha angustifolia L.", "cat": "止血药", "ob_range": (2.0, 3.5), "dl_range": (0.4, 0.65), "food": False},
    # ── 温里药 ──
    "附子": {"latin": "Aconiti Lateralis Radix Praeparata", "cat": "温里药", "ob_range": (2.5, 4.0), "dl_range": (0.4, 0.65), "food": False},
    "干姜": {"latin": "Zingiber officinale Roscoe", "cat": "温里药", "ob_range": (3.0, 4.5), "dl_range": (0.55, 0.8), "food": True},
    "肉桂": {"latin": "Cinnamomum cassia Presl", "cat": "温里药", "ob_range": (3.0, 4.5), "dl_range": (0.55, 0.8), "food": False},
    "吴茱萸": {"latin": "Evodia rutaecarpa (Juss.) Benth.", "cat": "温里药", "ob_range": (2.5, 4.0), "dl_range": (0.45, 0.7), "food": False},
    "小茴香": {"latin": "Foeniculum vulgare Mill.", "cat": "温里药", "ob_range": (3.0, 4.5), "dl_range": (0.55, 0.8), "food": True},
    "花椒": {"latin": "Zanthoxylum bungeanum Maxim.", "cat": "温里药", "ob_range": (3.0, 4.5), "dl_range": (0.5, 0.75), "food": True},
    "八角茴香": {"latin": "Illicium verum Hook.f.", "cat": "温里药", "ob_range": (3.0, 4.5), "dl_range": (0.55, 0.8), "food": True},
    # ── 收涩药 ──
    "五味子": {"latin": "Schisandra chinensis (Turcz.) Baill.", "cat": "收涩药", "ob_range": (3.0, 4.5), "dl_range": (0.55, 0.8), "food": False},
    "乌梅": {"latin": "Prunus mume (Sieb.) Sieb.et Zucc.", "cat": "收涩药", "ob_range": (2.5, 4.0), "dl_range": (0.5, 0.75), "food": True},
    "山茱萸": {"latin": "Cornus officinalis Sieb.et Zucc.", "cat": "收涩药", "ob_range": (2.5, 4.0), "dl_range": (0.5, 0.75), "food": False},
    "莲子": {"latin": "Nelumbo nucifera Gaertn.", "cat": "收涩药", "ob_range": (2.5, 4.0), "dl_range": (0.5, 0.75), "food": True},
    "芡实": {"latin": "Euryale ferox Salisb.", "cat": "收涩药", "ob_range": (2.0, 3.5), "dl_range": (0.5, 0.75), "food": True},
    # ── 消食药 ──
    "山楂": {"latin": "Crataegus pinnatifida Bge.var.major N.E.Br.", "cat": "消食药", "ob_range": (3.0, 4.5), "dl_range": (0.55, 0.8), "food": True},
    "麦芽": {"latin": "Hordeum vulgare L.", "cat": "消食药", "ob_range": (2.5, 4.0), "dl_range": (0.55, 0.8), "food": True},
    "莱菔子": {"latin": "Raphanus sativus L.", "cat": "消食药", "ob_range": (2.5, 4.0), "dl_range": (0.5, 0.75), "food": True},
    "鸡内金": {"latin": "Gallus gallus domesticus", "cat": "消食药", "ob_range": (2.0, 3.5), "dl_range": (0.4, 0.65), "food": True},
    "神曲": {"latin": "Massa Medicata Fermentata", "cat": "消食药", "ob_range": (2.5, 4.0), "dl_range": (0.5, 0.75), "food": True},
    # ── 驱虫药 ──
    "槟榔": {"latin": "Areca catechu L.", "cat": "驱虫药", "ob_range": (3.0, 4.5), "dl_range": (0.5, 0.75), "food": False},
    "使君子": {"latin": "Quisqualis indica L.", "cat": "驱虫药", "ob_range": (2.0, 3.5), "dl_range": (0.4, 0.65), "food": False},
    # ── 外用药 ──
    "冰片": {"latin": "Borneolum Syntheticum", "cat": "外用药", "ob_range": (2.5, 4.0), "dl_range": (0.45, 0.7), "food": False},
    "朱砂": {"latin": "Cinnabaris", "cat": "外用药", "ob_range": (0.5, 2.0), "dl_range": (0.15, 0.4), "food": False},
    # ── 祛风湿药 ──
    "独活": {"latin": "Angelica pubescens Maxim.f.biserrata Shan et Yuan", "cat": "祛风湿药", "ob_range": (2.5, 4.0), "dl_range": (0.45, 0.7), "food": False},
    "威灵仙": {"latin": "Clematis chinensis Osbeck", "cat": "祛风湿药", "ob_range": (2.5, 4.0), "dl_range": (0.45, 0.7), "food": False},
    "秦艽": {"latin": "Gentiana macrophylla Pall.", "cat": "祛风湿药", "ob_range": (2.5, 4.0), "dl_range": (0.5, 0.75), "food": False},
    "五加皮": {"latin": "Acanthopanax gracilistylus W.W.Smith", "cat": "祛风湿药", "ob_range": (2.5, 4.0), "dl_range": (0.5, 0.75), "food": False},
    # ── 化湿药 ──
    "苍术": {"latin": "Atractylodes lancea (Thunb.) DC.", "cat": "化湿药", "ob_range": (2.5, 4.0), "dl_range": (0.5, 0.75), "food": False},
    "砂仁": {"latin": "Amomum villosum Lour.", "cat": "化湿药", "ob_range": (2.5, 4.0), "dl_range": (0.5, 0.75), "food": True},
    "豆蔻": {"latin": "Amomum kravanh Pierre ex Gagnep.", "cat": "化湿药", "ob_range": (2.5, 4.0), "dl_range": (0.5, 0.75), "food": True},
    # ── 开窍药 ──
    "麝香": {"latin": "Moschus", "cat": "开窍药", "ob_range": (1.5, 3.0), "dl_range": (0.3, 0.55), "food": False},
    "苏合香": {"latin": "Styrax", "cat": "开窍药", "ob_range": (2.0, 3.5), "dl_range": (0.4, 0.65), "food": False},
    # ── 其他常用药材（含非标准分类）──
    "大黄": {"latin": "Rheum palmatum L.", "cat": "泻下药", "ob_range": (2.5, 4.0), "dl_range": (0.5, 0.75), "food": False},
    "芒硝": {"latin": "Mirabilitum", "cat": "泻下药", "ob_range": (1.0, 3.0), "dl_range": (0.15, 0.4), "food": False},
    "火麻仁": {"latin": "Cannabis sativa L.", "cat": "润下药", "ob_range": (2.5, 4.0), "dl_range": (0.5, 0.75), "food": True},
    "黄芩": {"latin": "Scutellaria baicalensis Georgi", "cat": "清热燥湿药", "ob_range": (3.0, 4.5), "dl_range": (0.55, 0.8), "food": False},
    "黄连": {"latin": "Coptis chinensis Franch.", "cat": "清热燥湿药", "ob_range": (3.0, 4.5), "dl_range": (0.55, 0.8), "food": False},
    "黄柏": {"latin": "Phellodendron chinense Schneid.", "cat": "清热燥湿药", "ob_range": (2.5, 4.0), "dl_range": (0.5, 0.75), "food": False},
    "栀子": {"latin": "Gardenia jasminoides Ellis", "cat": "清热泻火药", "ob_range": (3.0, 4.5), "dl_range": (0.55, 0.8), "food": False},
    "知母": {"latin": "Anemarrhena asphodeloides Bge.", "cat": "清热泻火药", "ob_range": (2.5, 4.0), "dl_range": (0.5, 0.75), "food": False},
    "生地黄": {"latin": "Rehmannia glutinosa (Gaertn.) Libosch.", "cat": "清热凉血药", "ob_range": (2.5, 4.0), "dl_range": (0.5, 0.75), "food": False},
    "玄参": {"latin": "Scrophularia ningpoensis Hemsl.", "cat": "清热凉血药", "ob_range": (2.5, 4.0), "dl_range": (0.5, 0.75), "food": False},
    "地骨皮": {"latin": "Lycii Cortex", "cat": "清虚热药", "ob_range": (2.0, 3.5), "dl_range": (0.45, 0.7), "food": False},
    "胡黄连": {"latin": "Picrorhiza scrophulariiflora Pennell", "cat": "清虚热药", "ob_range": (2.0, 3.5), "dl_range": (0.45, 0.7), "food": False},
    "细辛": {"latin": "Asarum heterotropoides Fr.Schmidt var.mandshuricum (Maxim.) Kitag.", "cat": "解表药", "ob_range": (3.0, 4.5), "dl_range": (0.5, 0.75), "food": False},
    "牛膝": {"latin": "Achyranthes bidentata BL.", "cat": "活血化瘀药", "ob_range": (2.5, 4.0), "dl_range": (0.5, 0.75), "food": False},
    "龙胆": {"latin": "Gentiana scabra Bge.", "cat": "清热燥湿药", "ob_range": (2.5, 4.0), "dl_range": (0.5, 0.75), "food": False},
    "苦参": {"latin": "Sophora flavescens Ait.", "cat": "清热燥湿药", "ob_range": (2.5, 4.0), "dl_range": (0.5, 0.75), "food": False},
    "白头翁": {"latin": "Pulsatilla chinensis (Bge.) Regel", "cat": "清热解毒药", "ob_range": (2.0, 3.5), "dl_range": (0.45, 0.7), "food": False},
    "马齿苋": {"latin": "Portulaca oleracea L.", "cat": "清热解毒药", "ob_range": (3.0, 4.5), "dl_range": (0.55, 0.8), "food": True},
    "赤芍": {"latin": "Paeonia lactiflora Pall.", "cat": "清热凉血药", "ob_range": (3.0, 4.5), "dl_range": (0.55, 0.8), "food": False},
    "牡丹皮": {"latin": "Moutan Cortex", "cat": "清热凉血药", "ob_range": (3.0, 4.5), "dl_range": (0.55, 0.8), "food": False},
    "地榆": {"latin": "Sanguisorba officinalis L.", "cat": "止血药", "ob_range": (2.5, 4.0), "dl_range": (0.5, 0.75), "food": False},
    "槐花": {"latin": "Sophora japonica L.", "cat": "止血药", "ob_range": (2.5, 4.0), "dl_range": (0.5, 0.75), "food": False},
    "侧柏叶": {"latin": "Biota orientalis (L.) Endl.", "cat": "止血药", "ob_range": (2.5, 4.0), "dl_range": (0.5, 0.75), "food": False},
    "艾叶": {"latin": "Artemisia argyi Levl.et Vant.", "cat": "温经止血药", "ob_range": (3.0, 4.5), "dl_range": (0.55, 0.8), "food": False},
    "刺蒺藜": {"latin": "Tribulus terrestris L.", "cat": "平肝息风药", "ob_range": (2.5, 4.0), "dl_range": (0.5, 0.75), "food": False},
    "决明子": {"latin": "Cassia obtusifolia L.", "cat": "清热明目药", "ob_range": (3.0, 4.5), "dl_range": (0.55, 0.8), "food": True},
    "夏枯草": {"latin": "Prunella vulgaris L.", "cat": "清热泻火药", "ob_range": (2.5, 4.0), "dl_range": (0.5, 0.75), "food": False},
    "金钱草": {"latin": "Desmodium styracifolium (Osb.) Merr.", "cat": "利水渗湿药", "ob_range": (2.5, 4.0), "dl_range": (0.5, 0.75), "food": False},
    "虎杖": {"latin": "Polygonum cuspidatum Sieb.et Zucc.", "cat": "利水渗湿药", "ob_range": (2.5, 4.0), "dl_range": (0.5, 0.75), "food": False},
    "桑白皮": {"latin": "Mori Cortex", "cat": "止咳平喘药", "ob_range": (2.5, 4.0), "dl_range": (0.5, 0.75), "food": False},
    "葶苈子": {"latin": "Lepidium apetalum Willd.", "cat": "止咳平喘药", "ob_range": (2.0, 3.5), "dl_range": (0.45, 0.7), "food": False},
    "白果": {"latin": "Ginkgo biloba L.", "cat": "止咳平喘药", "ob_range": (2.5, 4.0), "dl_range": (0.5, 0.75), "food": True},
    "胖大海": {"latin": "Sterculia lychnophora Hance", "cat": "止咳平喘药", "ob_range": (2.0, 3.5), "dl_range": (0.4, 0.65), "food": True},
    "番泻叶": {"latin": "Senna alexandrina Mill.", "cat": "泻下药", "ob_range": (3.0, 4.5), "dl_range": (0.5, 0.75), "food": False},
    "甘遂": {"latin": "Kansui radix", "cat": "峻下逐水药", "ob_range": (1.0, 3.0), "dl_range": (0.25, 0.5), "food": False},
    "商陆": {"latin": "Phytolacca acinosa Roxb.", "cat": "峻下逐水药", "ob_range": (1.5, 3.0), "dl_range": (0.3, 0.55), "food": False},
    "雄黄": {"latin": "Realgar", "cat": "外用药", "ob_range": (0.5, 2.0), "dl_range": (0.15, 0.4), "food": False},
    "硫磺": {"latin": "Sulfur", "cat": "外用药", "ob_range": (1.0, 3.0), "dl_range": (0.2, 0.45), "food": False},
    "蛇床子": {"latin": "Cnidium monnieri (L.) Cuss.", "cat": "祛风湿药", "ob_range": (2.5, 4.0), "dl_range": (0.5, 0.75), "food": False},
    "木瓜": {"latin": "Chaenomeles sinensis (Thouin) Koehne", "cat": "祛风湿药", "ob_range": (2.5, 4.0), "dl_range": (0.5, 0.75), "food": True},
    "桑枝": {"latin": "Mori Ramulus", "cat": "祛风湿药", "ob_range": (2.0, 3.5), "dl_range": (0.45, 0.7), "food": False},
    "桑寄生": {"latin": "Taxilli Herba", "cat": "祛风湿药", "ob_range": (2.0, 3.5), "dl_range": (0.45, 0.7), "food": False},
    "狗脊": {"latin": "Cibotium barometz (L.) J.Sm.", "cat": "祛风湿药", "ob_range": (2.0, 3.5), "dl_range": (0.45, 0.7), "food": False},
    "续断": {"latin": "Dipsacus asper Wall.ex Henry", "cat": "祛风湿药", "ob_range": (2.0, 3.5), "dl_range": (0.45, 0.7), "food": False},
    "骨碎补": {"latin": "Drynaria fortunei (Kunze) J.Sm.", "cat": "祛风湿药", "ob_range": (1.5, 3.0), "dl_range": (0.35, 0.6), "food": False},
    "红景天": {"latin": "Rhodiola rosea L.", "cat": "补气药", "ob_range": (2.0, 3.5), "dl_range": (0.5, 0.75), "food": False},
    "绞股蓝": {"latin": "Gynostemma pentaphyllum (Thunb.) Makino", "cat": "补气药", "ob_range": (2.0, 3.5), "dl_range": (0.5, 0.75), "food": True},
    "灵芝": {"latin": "Ganoderma lucidum (Leyss.ex Fr.) Karst.", "cat": "安神药", "ob_range": (1.5, 3.0), "dl_range": (0.4, 0.65), "food": False},
    "西洋参": {"latin": "Panax quinquefolius L.", "cat": "补气药", "ob_range": (2.5, 4.0), "dl_range": (0.55, 0.8), "food": True},
    "银杏叶": {"latin": "Ginkgo biloba L.", "cat": "活血化瘀药", "ob_range": (2.5, 4.0), "dl_range": (0.5, 0.75), "food": False},
    "红参": {"latin": "Panax ginseng C.A.Mey.(red ginseng)", "cat": "补气药", "ob_range": (2.5, 4.0), "dl_range": (0.55, 0.8), "food": False},
    "仙茅": {"latin": "Curculigo orchioides Gaertn.", "cat": "补阳药", "ob_range": (2.0, 3.5), "dl_range": (0.4, 0.65), "food": False},
    "海马": {"latin": "Hippocampus", "cat": "补阳药", "ob_range": (1.0, 3.0), "dl_range": (0.3, 0.55), "food": False},
    "蛤蚧": {"latin": "Gecko gecko Linnaeus", "cat": "补阳药", "ob_range": (1.0, 3.0), "dl_range": (0.3, 0.55), "food": False},
    "紫河车": {"latin": "Placenta Hominis", "cat": "补阳药", "ob_range": (1.0, 2.5), "dl_range": (0.25, 0.5), "food": False},
    "韭菜子": {"latin": "Allium tuberosum Rottl.", "cat": "补阳药", "ob_range": (2.0, 3.5), "dl_range": (0.4, 0.65), "food": True},
    "沙苑子": {"latin": "Astragalus complanatus R.Br.", "cat": "补阳药", "ob_range": (2.0, 3.5), "dl_range": (0.4, 0.65), "food": False},
    "锁阳": {"latin": "Cynomorium songaricup Rupr.", "cat": "补阳药", "ob_range": (1.5, 3.0), "dl_range": (0.35, 0.6), "food": False},
    "核桃仁": {"latin": "Juglans regia L.", "cat": "补肾/润肠", "ob_range": (2.5, 4.0), "dl_range": (0.5, 0.75), "food": True},
    "黑芝麻": {"latin": "Sesamum indicum L.", "cat": "补阴药", "ob_range": (3.0, 4.5), "dl_range": (0.55, 0.8), "food": True},
    "蜂蜜": {"latin": "Mel", "cat": "补气药", "ob_range": (3.0, 4.5), "dl_range": (0.55, 0.8), "food": True},
    "饴糖": {"latin": "Maltose", "cat": "补气药", "ob_range": (3.0, 4.5), "dl_range": (0.55, 0.8), "food": True},
    "桑椹": {"latin": "Morus alba L.", "cat": "补血药", "ob_range": (2.5, 4.0), "dl_range": (0.5, 0.75), "food": True},
    "墨旱莲": {"latin": "Eclipta prostrata L.", "cat": "补阴药", "ob_range": (2.0, 3.5), "dl_range": (0.45, 0.7), "food": False},
    "鳖甲": {"latin": "Trionycis Carapax", "cat": "补阴药", "ob_range": (0.5, 2.0), "dl_range": (0.25, 0.5), "food": False},
    "珍珠": {"latin": "Margarita", "cat": "安神药", "ob_range": (0.5, 2.0), "dl_range": (0.2, 0.45), "food": False},
    "珍珠母": {"latin": "Concha Margaritifera Usta", "cat": "平肝息风药", "ob_range": (0.5, 2.0), "dl_range": (0.2, 0.45), "food": False},
    "琥珀": {"latin": "Succinum", "cat": "安神药", "ob_range": (1.0, 3.0), "dl_range": (0.3, 0.55), "food": False},
    "磁石": {"latin": "Magnetite", "cat": "安神药", "ob_range": (0.5, 2.0), "dl_range": (0.2, 0.45), "food": False},
    "代赭石": {"latin": "Haematitum", "cat": "平肝息风药", "ob_range": (0.5, 2.0), "dl_range": (0.2, 0.45), "food": False},
    "刺五加": {"latin": "Acanthopanax senticosus (Rupr.et Maxim.) Harms", "cat": "补气药", "ob_range": (2.0, 3.5), "dl_range": (0.5, 0.75), "food": False},
    "芦根": {"latin": "Phragmites communis Trin.", "cat": "清热泻火药", "ob_range": (2.5, 4.0), "dl_range": (0.5, 0.75), "food": False},
    "天花粉": {"latin": "Trichosanthes kirilowii Maxim.", "cat": "清热生津", "ob_range": (2.0, 3.5), "dl_range": (0.45, 0.7), "food": False},
    "淡竹叶": {"latin": "Lophatherum gracile Brongn.", "cat": "清热泻火药", "ob_range": (2.0, 3.5), "dl_range": (0.45, 0.7), "food": False},
    "密蒙花": {"latin": "Buddleja officinalis Maxim.", "cat": "清热明目药", "ob_range": (2.0, 3.5), "dl_range": (0.4, 0.65), "food": False},
    "青葙子": {"latin": "Celosia argentea L.", "cat": "清热明目药", "ob_range": (2.0, 3.5), "dl_range": (0.4, 0.65), "food": False},
    "谷精草": {"latin": "Eriocaulon buergerianum Koern.", "cat": "清热明目药", "ob_range": (2.0, 3.5), "dl_range": (0.4, 0.65), "food": False},
    "明党参": {"latin": "Changium smyrnioides Wolff", "cat": "补气药", "ob_range": (2.0, 3.5), "dl_range": (0.45, 0.7), "food": False},
    "佛手": {"latin": "Citri Sarcodactylis Fructus", "cat": "理气药", "ob_range": (2.5, 4.0), "dl_range": (0.5, 0.75), "food": True},
    "香橼": {"latin": "Citri Fructus", "cat": "理气药", "ob_range": (2.5, 4.0), "dl_range": (0.5, 0.75), "food": True},
    "玫瑰花": {"latin": "Rosae Rugosae Flos", "cat": "理气药", "ob_range": (2.0, 3.5), "dl_range": (0.45, 0.7), "food": False},
    "绿萼梅": {"latin": "Mume Flos", "cat": "理气药", "ob_range": (2.0, 3.5), "dl_range": (0.45, 0.7), "food": False},
    "薤白": {"latin": "Allii Macrostemonis Bulbus", "cat": "理气药", "ob_range": (2.5, 4.0), "dl_range": (0.5, 0.75), "food": True},
    "柿蒂": {"latin": "Kaki Calyx", "cat": "理气药", "ob_range": (2.0, 3.5), "dl_range": (0.4, 0.65), "food": True},
    "刀豆": {"latin": "Canavalia gladiata (Jacq.) DC.", "cat": "温里药", "ob_range": (2.0, 3.5), "dl_range": (0.4, 0.65), "food": True},
    "荜茇": {"latin": "Piper longum L.", "cat": "温里药", "ob_range": (2.5, 4.0), "dl_range": (0.5, 0.75), "food": False},
    "高良姜": {"latin": "Alpinia officinarum Hance", "cat": "温里药", "ob_range": (2.5, 4.0), "dl_range": (0.5, 0.75), "food": False},
    "丁香": {"latin": "Syzygium aromaticum (L.) Merr.et Perry", "cat": "温里药", "ob_range": (3.0, 4.5), "dl_range": (0.55, 0.8), "food": False},
    "胡椒": {"latin": "Piper nigrum L.", "cat": "温里药", "ob_range": (3.0, 4.5), "dl_range": (0.55, 0.8), "food": True},
    "草豆蔻": {"latin": "Alpinia katsumadai Hayata", "cat": "化湿药", "ob_range": (2.5, 4.0), "dl_range": (0.5, 0.75), "food": True},
    "草果": {"latin": "Tsaoko Fructus", "cat": "化湿药", "ob_range": (2.5, 4.0), "dl_range": (0.5, 0.75), "food": False},
    "佩兰": {"latin": "Eupatorium fortunei Turcz.", "cat": "化湿药", "ob_range": (2.5, 4.0), "dl_range": (0.5, 0.75), "food": False},
    "藿香": {"latin": "Agastache rugosa (Fisch.et Mey.) O.Ktze.", "cat": "化湿药", "ob_range": (2.5, 4.0), "dl_range": (0.5, 0.75), "food": True},
    "苍耳子": {"latin": "Xanthium sibiricum Patr.", "cat": "解表药", "ob_range": (2.0, 3.5), "dl_range": (0.4, 0.65), "food": False},
    "辛夷": {"latin": "Magnolia liliflora Desr.", "cat": "解表药", "ob_range": (2.0, 3.5), "dl_range": (0.4, 0.65), "food": False},
    "升麻": {"latin": "Cimicifuga heracleifolia Kom.", "cat": "解表药", "ob_range": (2.5, 4.0), "dl_range": (0.5, 0.75), "food": False},
    "淡豆豉": {"latin": "Sojae Semen Praeparatum", "cat": "解表药", "ob_range": (2.5, 4.0), "dl_range": (0.5, 0.75), "food": True},
    "豨莶草": {"latin": "Siegesbeckia orientalis L.", "cat": "祛风湿药", "ob_range": (2.0, 3.5), "dl_range": (0.4, 0.65), "food": False},
    "络石藤": {"latin": "Trachelospermi Jasminoides Caulis et Folium", "cat": "祛风湿药", "ob_range": (2.0, 3.5), "dl_range": (0.4, 0.65), "food": False},
    "老鹳草": {"latin": "Geranium wilfordii Maxim.", "cat": "祛风湿药", "ob_range": (2.0, 3.5), "dl_range": (0.4, 0.65), "food": False},
    "伸筋草": {"latin": "Lycopodium japonicum Thunb.", "cat": "祛风湿药", "ob_range": (1.5, 3.0), "dl_range": (0.35, 0.6), "food": False},
    "海桐皮": {"latin": "Pittospori Cortex", "cat": "祛风湿药", "ob_range": (2.0, 3.5), "dl_range": (0.4, 0.65), "food": False},
    "徐长卿": {"latin": "Cynanchum paniculatum (Bge.) Kitag.", "cat": "祛风湿药", "ob_range": (2.5, 4.0), "dl_range": (0.5, 0.75), "food": False},
    "千年健": {"latin": "Homalomena occulta (Lour.) Schott", "cat": "祛风湿药", "ob_range": (2.0, 3.5), "dl_range": (0.4, 0.65), "food": False},
    "雪莲花": {"latin": "Saussurea involucrata (Kar.et Kir.) Sch.-Bip.", "cat": "祛风湿药", "ob_range": (1.5, 3.0), "dl_range": (0.35, 0.6), "food": False},
    "路路通": {"latin": "Liquidambar formosana Hance", "cat": "祛风湿药", "ob_range": (2.0, 3.5), "dl_range": (0.4, 0.65), "food": False},
    "穿山龙": {"latin": "Discorea nipponica Makino", "cat": "祛风湿药", "ob_range": (2.0, 3.5), "dl_range": (0.4, 0.65), "food": False},
    "丝瓜络": {"latin": "Luffa cylindrica (L.) Roem.", "cat": "祛风湿药", "ob_range": (2.0, 3.5), "dl_range": (0.4, 0.65), "food": True},
    "桑叶": {"latin": "Mori Folium", "cat": "解表药", "ob_range": (2.5, 4.0), "dl_range": (0.5, 0.75), "food": False},
    "蔓荆子": {"latin": "Vitex trifolia L.", "cat": "解表药", "ob_range": (2.5, 4.0), "dl_range": (0.5, 0.75), "food": False},
    "牛蒡子": {"latin": "Arctium lappa L.", "cat": "解表药", "ob_range": (2.5, 4.0), "dl_range": (0.5, 0.75), "food": True},
    "蝉蜕": {"latin": "Cicadae Periostracum", "cat": "解表药", "ob_range": (2.0, 3.5), "dl_range": (0.4, 0.65), "food": False},
    "浮小麦": {"latin": "Triticum aestivum L.", "cat": "收涩药", "ob_range": (2.5, 4.0), "dl_range": (0.5, 0.75), "food": True},
    "麻黄根": {"latin": "Ephedrae Radix et Rhizoma", "cat": "收涩药", "ob_range": (2.5, 4.0), "dl_range": (0.5, 0.75), "food": False},
    "糯稻根须": {"latin": "Oryza sativa L.", "cat": "收涩药", "ob_range": (2.0, 3.5), "dl_range": (0.45, 0.7), "food": True},
    "石榴皮": {"latin": "Granati Pericarpium", "cat": "收涩药", "ob_range": (2.5, 4.0), "dl_range": (0.5, 0.75), "food": True},
    "椿皮": {"latin": "Ailanthi Cortex", "cat": "收涩药/清热", "ob_range": (2.0, 3.5), "dl_range": (0.4, 0.65), "food": False},
    "诃子": {"latin": "Chebulae Fructus", "cat": "收涩药", "ob_range": (2.5, 4.0), "dl_range": (0.5, 0.75), "food": False},
    "肉豆蔻": {"latin": "Myristica fragrans Houtt.", "cat": "收涩药", "ob_range": (2.5, 4.0), "dl_range": (0.5, 0.75), "food": True},
    "赤石脂": {"latin": "Halloysitum Rubrum", "cat": "收涩药", "ob_range": (0.5, 2.0), "dl_range": (0.15, 0.4), "food": False},
    "禹余粮": {"latin": "Limonitum", "cat": "收涩药", "ob_range": (0.5, 2.0), "dl_range": (0.15, 0.4), "food": False},
    "罂粟壳": {"latin": "Papaveris Pericarpium", "cat": "收涩药", "ob_range": (2.0, 3.5), "dl_range": (0.4, 0.65), "food": False},
    "南瓜子": {"latin": "Cucurbita moschata Duch.", "cat": "驱虫药", "ob_range": (2.5, 4.0), "dl_range": (0.5, 0.75), "food": True},
    "鹤草芽": {"latin": "Agrimoni Gemma", "cat": "驱虫药", "ob_range": (1.5, 3.0), "dl_range": (0.35, 0.6), "food": False},
    "雷丸": {"latin": "Omphalia lapidescens Schroet.", "cat": "驱虫药", "ob_range": (1.0, 3.0), "dl_range": (0.3, 0.55), "food": False},
    "鹤虱": {"latin": "Carpesium abrotanoides L.", "cat": "驱虫药", "ob_range": (2.0, 3.5), "dl_range": (0.4, 0.65), "food": False},
    "芜荑": {"latin": "Ulmus macrocarpa Hance", "cat": "驱虫药", "ob_range": (1.5, 3.0), "dl_range": (0.35, 0.6), "food": False},
    "大风子": {"latin": "Hydnocarpi Semen", "cat": "驱虫药/外用", "ob_range": (1.5, 3.0), "dl_range": (0.3, 0.55), "food": False},
    "土荆皮": {"latin": "Pseudolaricis Cortex", "cat": "外用药", "ob_range": (1.5, 3.0), "dl_range": (0.35, 0.6), "food": False},
    "炉甘石": {"latin": "Calamina", "cat": "外用药", "ob_range": (0.5, 2.0), "dl_range": (0.2, 0.45), "food": False},
    "硼砂": {"latin": "Borax", "cat": "外用药", "ob_range": (1.0, 3.0), "dl_range": (0.25, 0.5), "food": False},
    "儿茶": {"latin": "Catechu", "cat": "外用药", "ob_range": (2.0, 3.5), "dl_range": (0.4, 0.65), "food": False},
    "砒石": {"latin": "Arsenicum Sublimatum", "cat": "外用药", "ob_range": (0.3, 1.5), "dl_range": (0.1, 0.3), "food": False},
    "铅丹": {"latin": "Minium", "cat": "外用药", "ob_range": (0.3, 1.5), "dl_range": (0.1, 0.3), "food": False},
    "轻粉": {"latin": "Calomelas", "cat": "外用药", "ob_range": (0.3, 1.5), "dl_range": (0.1, 0.3), "food": False},
    "斑蝥": {"latin": "Mylabris", "cat": "外用药", "ob_range": (1.0, 3.0), "dl_range": (0.25, 0.5), "food": False},
    "蟾酥": {"latin": "Bufonis Venenum", "cat": "外用药", "ob_range": (1.5, 3.0), "dl_range": (0.3, 0.55), "food": False},
    "马钱子": {"latin": "Strychnos nux-vomica L.", "cat": "外用药", "ob_range": (1.5, 3.0), "dl_range": (0.25, 0.5), "food": False},
    "蛇蜕": {"latin": "Serpentes Slough", "cat": "祛风药", "ob_range": (1.0, 3.0), "dl_range": (0.3, 0.55), "food": False},
    "蜂房": {"latin": "Vespae Nidus", "cat": "攻毒杀虫", "ob_range": (1.5, 3.0), "dl_range": (0.35, 0.6), "food": False},
    "土鳖虫": {"latin": "Eupolyphaga seu Steleophaga", "cat": "活血化瘀药", "ob_range": (1.5, 3.0), "dl_range": (0.3, 0.55), "food": False},
    "水蛭": {"latin": "Hirudo", "cat": "活血化瘀药", "ob_range": (1.0, 3.0), "dl_range": (0.25, 0.5), "food": False},
    "虻虫": {"latin": "Tabanus", "cat": "活血化瘀药", "ob_range": (1.0, 3.0), "dl_range": (0.25, 0.5), "food": False},
    "莪术": {"latin": "Curcuma phaeoculis Val.", "cat": "活血化瘀药", "ob_range": (2.0, 3.5), "dl_range": (0.45, 0.7), "food": False},
    "三棱": {"latin": "Sparganium stoloniferum Buch.-Ham.", "cat": "活血化瘀药", "ob_range": (2.0, 3.5), "dl_range": (0.45, 0.7), "food": False},
    "穿山甲": {"latin": "Manitis Squama", "cat": "活血通经/下乳", "ob_range": (1.5, 3.0), "dl_range": (0.3, 0.55), "food": False},
    "王不留行": {"latin": "Vaccaria segetalis (Neck.) Garcke", "cat": "活血调经", "ob_range": (2.5, 4.0), "dl_range": (0.5, 0.75), "food": False},
    "月季花": {"latin": "Rosae Chinensis Flos", "cat": "活血调经", "ob_range": (2.0, 3.5), "dl_range": (0.45, 0.7), "food": False},
    "凌霄花": {"latin": "Campsis grandiflora (Thunb.) Schumann", "cat": "活血调经", "ob_range": (2.0, 3.5), "dl_range": (0.45, 0.7), "food": False},
    "刘寄奴": {"latin": "Artemisia anomala S.Moore", "cat": "活血化瘀药", "ob_range": (2.0, 3.5), "dl_range": (0.45, 0.7), "food": False},
    "自然铜": {"latin": "Pyritum", "cat": "活血化瘀药", "ob_range": (0.5, 2.0), "dl_range": (0.2, 0.45), "food": False},
    "皂荚刺": {"latin": "Gleditsiae Spina", "cat": "消肿排脓", "ob_range": (2.0, 3.5), "dl_range": (0.4, 0.65), "food": False},
    "血竭": {"latin": "Draconis Sanguis", "cat": "活血化瘀药", "ob_range": (1.5, 3.0), "dl_range": (0.3, 0.55), "food": False},
    "降香": {"latin": "Dalbergiae Odoriferae Lignum", "cat": "活血化瘀药", "ob_range": (2.5, 4.0), "dl_range": (0.5, 0.75), "food": False},
    "片姜黄": {"latin": "Curcumae Rhizoma", "cat": "活血化瘀药", "ob_range": (2.5, 4.0), "dl_range": (0.5, 0.75), "food": False},
    "姜黄": {"latin": "Curcumae Longae Rhizoma", "cat": "活血化瘀药", "ob_range": (2.5, 4.0), "dl_range": (0.5, 0.75), "food": False},
    "乳香": {"latin": "Olibanum", "cat": "活血化瘀药", "ob_range": (2.0, 3.5), "dl_range": (0.4, 0.65), "food": False},
    "没药": {"latin": "Myrrha", "cat": "活血化瘀药", "ob_range": (2.0, 3.5), "dl_range": (0.4, 0.65), "food": False},
    "五灵脂": {"latin": "Trogopterus dung", "cat": "活血化瘀药", "ob_range": (1.5, 3.0), "dl_range": (0.35, 0.6), "food": False},
    "鸡血藤": {"latin": "Spatholobi Caulis et Radix", "cat": "活血化瘀药", "ob_range": (2.0, 3.5), "dl_range": (0.45, 0.7), "food": False},
    "紫草": {"latin": "Lithospermum erythrorhizon Sieb.et Zucc.", "cat": "清热凉血药", "ob_range": (2.0, 3.5), "dl_range": (0.4, 0.65), "food": False},
    "紫花地丁": {"latin": "Violae yedoensis Herba", "cat": "清热解毒药", "ob_range": (2.0, 3.5), "dl_range": (0.4, 0.65), "food": False},
    "大青叶": {"latin": "Isatidis Folium", "cat": "清热解毒药", "ob_range": (2.5, 4.0), "dl_range": (0.5, 0.75), "food": False},
    "射干": {"latin": "Belamcanda chinensis (L.) DC.", "cat": "清热解毒药", "ob_range": (2.5, 4.0), "dl_range": (0.5, 0.75), "food": False},
    "山豆根": {"latin": "Sophorae Tonkinensis Radix et Rhizoma", "cat": "清热解毒药", "ob_range": (2.0, 3.5), "dl_range": (0.4, 0.65), "food": False},
    "马勃": {"latin": "Lasiosphaera calvatia fenzlii Reich.", "cat": "清热解毒药", "ob_range": (1.5, 3.0), "dl_range": (0.35, 0.6), "food": False},
    "熊胆": {"latin": "Ursi Fel", "cat": "清热解毒药", "ob_range": (1.5, 3.0), "dl_range": (0.35, 0.6), "food": False},
    "鸦胆子": {"latin": "Bruceae Fructus", "cat": "清热解毒药", "ob_range": (2.0, 3.5), "dl_range": (0.4, 0.65), "food": False},
    "半边莲": {"latin": "Lobelia chinensis Lour.", "cat": "清热解毒药", "ob_range": (2.0, 3.5), "dl_range": (0.4, 0.65), "food": False},
    "白蔹": {"latin": "Ampelopsis japonica (Thunb.) Makino", "cat": "清热解毒药", "ob_range": (2.0, 3.5), "dl_range": (0.4, 0.65), "food": False},
    "漏芦": {"latin": "Rhapontici Radix", "cat": "清热解毒药", "ob_range": (2.0, 3.5), "dl_range": (0.4, 0.65), "food": False},
    "贯众": {"latin": "Dryopteris crassirhizoma Nakai", "cat": "清热解毒药", "ob_range": (2.0, 3.5), "dl_range": (0.4, 0.65), "food": False},
    "重楼": {"latin": "Paris polyphylla Smith var.chinensis (Franch.) Hara", "cat": "清热解毒药", "ob_range": (2.0, 3.5), "dl_range": (0.4, 0.65), "food": False},
    "四季青": {"latin": "Ilex chinensis Sims", "cat": "清热解毒药", "ob_range": (2.0, 3.5), "dl_range": (0.4, 0.65), "food": False},
    "败酱草": {"latin": "Patrinia scabiosaefolia Fisch.ex Trev.", "cat": "清热解毒药", "ob_range": (2.0, 3.5), "dl_range": (0.4, 0.65), "food": False},
    "土茯苓": {"latin": "Smilax glabra Roxb.", "cat": "清热解毒药", "ob_range": (2.0, 3.5), "dl_range": (0.45, 0.7), "food": False},
    "大蓟": {"latin": "Cirsium japonicum DC.", "cat": "止血药", "ob_range": (2.0, 3.5), "dl_range": (0.4, 0.65), "food": False},
    "小蓟": {"latin": "Cephalanoplos segetum (Bge.) Kitam.", "cat": "止血药", "ob_range": (2.0, 3.5), "dl_range": (0.4, 0.65), "food": False},
    "茜草": {"latin": "Rubia cordifolia L.", "cat": "止血药", "ob_range": (2.5, 4.0), "dl_range": (0.5, 0.75), "food": False},
    "苎麻根": {"latin": "Boehmeria nivea (L.) Gaudich.", "cat": "止血药", "ob_range": (2.0, 3.5), "dl_range": (0.4, 0.65), "food": False},
    "棕榈炭": {"latin": "Trachycarpi Carbonisatus", "cat": "止血药", "ob_range": (2.0, 3.5), "dl_range": (0.4, 0.65), "food": False},
    "藕节": {"latin": "Nelumbinis Rhizoma Nodus", "cat": "止血药", "ob_range": (2.5, 4.0), "dl_range": (0.5, 0.75), "food": True},
    "仙鹤草": {"latin": "Agrimonia pilosa Ledeb.", "cat": "止血药", "ob_range": (2.5, 4.0), "dl_range": (0.5, 0.75), "food": False},
    "炮姜": {"latin": "Zingiber officinale Roscoe Preparata", "cat": "温经止血药", "ob_range": (2.5, 4.0), "dl_range": (0.5, 0.75), "food": True},
    "百部": {"latin": "Stemonae Radix", "cat": "止咳平喘药", "ob_range": (2.5, 4.0), "dl_range": (0.5, 0.75), "food": False},
    "紫苏子": {"latin": "Perillae Fructus", "cat": "止咳平喘药", "ob_range": (2.5, 4.0), "dl_range": (0.5, 0.75), "food": True},
    "枇杷叶": {"latin": "Eriobotryae Folium", "cat": "止咳平喘药", "ob_range": (2.5, 4.0), "dl_range": (0.5, 0.75), "food": False},
    "白前": {"latin": "Cynanchi stauntonii Rhizoma et Radix", "cat": "止咳平喘药", "ob_range": (2.0, 3.5), "dl_range": (0.45, 0.7), "food": False},
    "前胡": {"latin": "Peucedani Radix", "cat": "止咳平喘药", "ob_range": (2.0, 3.5), "dl_range": (0.45, 0.7), "food": False},
    "旋覆花": {"latin": "Inulae Flos", "cat": "止咳平喘药", "ob_range": (2.0, 3.5), "dl_range": (0.45, 0.7), "food": False},
    "竹茹": {"latin": "Bambusae Caulis in Taeniam", "cat": "化痰止呕", "ob_range": (2.0, 3.5), "dl_range": (0.45, 0.7), "food": False},
    "竹沥": {"latin": "Bambusae Succus", "cat": "清热化痰", "ob_range": (2.0, 3.5), "dl_range": (0.4, 0.65), "food": False},
    "天竺黄": {"latin": "Concretio Silicea Bambusae", "cat": "清热化痰", "ob_range": (1.5, 3.0), "dl_range": (0.35, 0.6), "food": False},
    "海蛤壳": {"latin": "Concha Meretricis Cyclinae", "cat": "清肺化痰", "ob_range": (1.0, 3.0), "dl_range": (0.3, 0.55), "food": False},
    "海藻": {"latin": "Sargassum", "cat": "消痰软坚", "ob_range": (1.5, 3.0), "dl_range": (0.35, 0.6), "food": False},
    "昆布": {"latin": "Ecklonia kurome Okam.", "cat": "消痰软坚", "ob_range": (1.5, 3.0), "dl_range": (0.35, 0.6), "food": True},
    "礞石": {"latin": "Lapis Chloriti", "cat": "坠痰下气", "ob_range": (0.5, 2.0), "dl_range": (0.2, 0.45), "food": False},
    "石韦": {"latin": "Pyrrosiae Folium", "cat": "利尿通淋", "ob_range": (2.0, 3.5), "dl_range": (0.45, 0.7), "food": False},
    "萹蓄": {"latin": "Polygonum aviculare L.", "cat": "利尿通淋", "ob_range": (2.0, 3.5), "dl_range": (0.4, 0.65), "food": False},
    "瞿麦": {"latin": "Dianthus superbus L.", "cat": "利尿通淋", "ob_range": (2.0, 3.5), "dl_range": (0.4, 0.65), "food": False},
    "地肤子": {"latin": "Kochiae Fructus", "cat": "利尿通淋", "ob_range": (2.0, 3.5), "dl_range": (0.4, 0.65), "food": False},
    "海金沙": {"latin": "Lygodii Spora", "cat": "利尿通淋", "ob_range": (2.0, 3.5), "dl_range": (0.4, 0.65), "food": False},
    "萆薢": {"latin": "Dioscorea septemloba Thunb.", "cat": "利湿去浊", "ob_range": (2.0, 3.5), "dl_range": (0.4, 0.65), "food": False},
    "垂盆草": {"latin": "Sarmentosum", "cat": "利湿退黄", "ob_range": (2.0, 3.5), "dl_range": (0.4, 0.65), "food": True},
    "溪黄草": {"latin": "Isodon serra (Maxim.) Kudo", "cat": "利湿退黄", "ob_range": (2.0, 3.5), "dl_range": (0.4, 0.65), "food": False},
    "猪苓": {"latin": "Polyporus umbellatus (Pers.) Fries", "cat": "利水渗湿药", "ob_range": (2.0, 3.5), "dl_range": (0.45, 0.7), "food": False},
    "泽漆": {"latin": "Euphorbia helioscopia L.", "cat": "利水消肿", "ob_range": (1.5, 3.0), "dl_range": (0.35, 0.6), "food": False},
    "椒目": {"latin": "Zanthoxyli Semen", "cat": "利水消肿", "ob_range": (2.0, 3.5), "dl_range": (0.4, 0.65), "food": False},
    "冬瓜皮": {"latin": "Benincasae Exocarpium", "cat": "利水消肿", "ob_range": (2.0, 3.5), "dl_range": (0.45, 0.7), "food": True},
    "玉米须": {"latin": "Maydis Stigma", "cat": "利水消肿", "ob_range": (2.5, 4.0), "dl_range": (0.5, 0.75), "food": True},
    "葫芦": {"latin": "Lagenaria siceraria var.hispida", "cat": "利水消肿", "ob_range": (2.0, 3.5), "dl_range": (0.4, 0.65), "food": True},
    "香加皮": {"latin": "Periplocae Cortex", "cat": "利水消肿", "ob_range": (2.0, 3.5), "dl_range": (0.4, 0.65), "food": False},
    "枳椇子": {"latin": "Hovenia dulcis Thunb.", "cat": "利水消肿/解酒", "ob_range": (2.5, 4.0), "dl_range": (0.5, 0.75), "food": True},
    "京大戟": {"latin": "Euphorbia pekinensis Rupr.", "cat": "峻下逐水药", "ob_range": (1.0, 3.0), "dl_range": (0.25, 0.5), "food": False},
    "芫花": {"latin": "Genkwa Flos", "cat": "峻下逐水药", "ob_range": (1.0, 3.0), "dl_range": (0.25, 0.5), "food": False},
    "牵牛子": {"latin": "Pharbitis nil (L.) Choisy", "cat": "峻下逐水药", "ob_range": (2.0, 3.5), "dl_range": (0.4, 0.65), "food": False},
    "巴豆": {"latin": "Crotonis Fructus", "cat": "峻下逐水药", "ob_range": (1.5, 3.0), "dl_range": (0.3, 0.55), "food": False},
    "千金子": {"latin": "Euphorbia lathyris L.", "cat": "峻下逐水药", "ob_range": (1.5, 3.0), "dl_range": (0.3, 0.55), "food": False},
    "郁李仁": {"latin": "Prunus japonica Thunb.", "cat": "润下药", "ob_range": (2.5, 4.0), "dl_range": (0.5, 0.75), "food": True},
    "松子仁": {"latin": "Pini Koranensis Semen", "cat": "润下药", "ob_range": (2.5, 4.0), "dl_range": (0.5, 0.75), "food": True},
    "芦荟": {"latin": "Aloe vera (L.) Burm.f.", "cat": "攻下药", "ob_range": (2.0, 3.5), "dl_range": (0.4, 0.65), "food": False},
    "苦楝皮": {"latin": "Melia azedarach L.", "cat": "驱虫药", "ob_range": (2.0, 3.5), "dl_range": (0.4, 0.65), "food": False},
}

# ════════════════════════════════════════════════
# 药食同源完整目录（从 tcmsp_client.py 提取，规范化处理）
# ════════════════════════════════════════════════

FOOD_HOMOLOGY_CATALOG_RAW = {
    "八角茴香", "刀豆", "姜", "枣", "山药", "山楂", "小茴香", "木瓜", "龙眼肉",
    "决明子", "百合", "肉豆蔻", "肉桂", "莲子", "芡实", "花椒", "麦芽", "赤小豆",
    "佛手", "杏仁", "昆布", "桃仁", "桑葚", "淡豆豉", "黑芝麻", "黑胡椒", "蜂蜜",
    "榧子", "薏苡仁", "枸杞子", "胖大海", "金银花", "余甘子", "葛根", "鱼腥草",
    "蒲公英", "益智仁", "藿香", "酸枣仁", "芦根", "荷叶", "乌梢蛇", "蝉蜕",
    "五加皮", "杜仲叶", "沙棘", "牡蛎", "乌梅", "橘皮", "薄荷", "紫苏", "薤白",
    "覆盆子", "玫瑰花", "人参叶", "制何首乌", "芦荟", "三七", "牛蒡根", "北沙参",
    "南沙参", "天冬", "麦冬", "丹参", "西洋参", "黄芪", "白术", "补骨脂", "当归",
    "党参", "肉苁蓉", "锁阳", "黄精", "玉竹", "白芍", "菊花", "桑叶", "黄荆子",
    "鸡内金", "青果", "栀子", "甘草", "罗汉果", "砂仁", "草豆蔻", "陈皮", "香橼",
    "香薷", "茯苓", "人参", "山银花", "芫荽", "松花粉", "粉葛", "布渣叶",
    "夏枯草", "山奈", "西红花", "草果", "姜黄", "荜茇", "铁皮石斛", "天麻",
    "山茱萸", "杜仲", "熟地黄", "化橘红", "人参须", "小蓟", "川牛膝", "木香",
    "五味子", "太子参", "白芷", "白茅根", "沙棘", "柏子仁", "桔梗",
    "莱菔子", "高良姜", "淡竹叶", "菊苣", "黄芥子", "紫苏子", "槐米", "鲜白茅根",
    "鲜芦根", "蝮蛇", "橘红", "橘络", "广藿香",
}

# 规范化后的药食同源目录（去除括号注释，统一名称）
def _normalize_catalog_name(name: str) -> str:
    """规范化目录名称：去除括号及括号内容、空格"""
    name = name.split("（")[0].split("(")[0].strip()
    return name

FOOD_HOMOLOGY_CATALOG = {_normalize_catalog_name(n) for n in FOOD_HOMOLOGY_CATALOG_RAW}

# ════════════════════════════════════════════════
# 分类映射表：非标准分类 → TCMSP 标准26类体系
# ════════════════════════════════════════════════

CATEGORY_NORMALIZATION_MAP: dict[str, str] = {
    "清热平肝药": "解表药",
    "补肾/润肠": "补阳药",
    "补虚/润下": "补气药",
    "温经止血药": "止血药",
    "清热生津": "清热泻火药",
    "清热化痰": "化痰止咳平喘药",
    "清肺化痰": "化痰止咳平喘药",
    "消痰软坚": "化痰止咳平喘药",
    "坠痰下气": "化痰止咳平喘药",
    "化痰止呕": "化痰止咳平喘药",
    "化痰药": "化痰止咳平喘药",
    "止咳平喘药": "化痰止咳平喘药",
    "泻肺平喘": "化痰止咳平喘药",
    "泻肺行水": "利水渗湿药",
    "利尿通淋": "利水渗湿药",
    "利湿去浊": "利水渗湿药",
    "利湿退黄": "利水渗湿药",
    "利水消肿": "利水渗湿药",
    "利水消肿/解酒": "利水渗湿药",
    "攻下药": "泻下药",
    "润下药": "泻下药",
    "峻下逐水药": "泻下药",
    "清热燥湿药": "清热解毒药",
    "清热解暑药": "清热解毒药",
    "清热泻火药": "清热解毒药",
    "清热凉血药": "清热解毒药",
    "清虚热药": "清热解毒药",
    "清热明目药": "清热解毒药",
    "活血调经": "活血化瘀药",
    "活血疗伤": "活血化瘀药",
    "消肿排脓": "清热解毒药",
    "活血通经/下乳": "活血化瘀药",
    "祛风药": "祛风湿药",
    "攻毒杀虫": "驱虫药",
    "驱虫药/外用": "驱虫药",
    "收涩药/清热": "收涩药",
}


# ════════════════════════════════════════════════
# 工具函数
# ════════════════════════════════════════════════

def compute_sha256(values: list[str]) -> str:
    """计算字符串列表的 SHA256 校验和"""
    concatenated = "|".join(sorted(str(v) for v in values))
    return hashlib.sha256(concatenated.encode("utf-8")).hexdigest()


def normalize_category(cat: str | None) -> str:
    """将非标准分类归一化为 TCMSP 标准分类（迭代归一化直到稳定）"""
    if not cat:
        return "未分类"
    current = cat
    visited = set()
    max_iterations = 10
    for _ in range(max_iterations):
        if current in visited:
            break  # 防止循环
        visited.add(current)
        if current in CATEGORY_NORMALIZATION_MAP:
            current = CATEGORY_NORMALIZATION_MAP[current]
        else:
            break
    return current


def check_food_homology(name_cn: str) -> bool:
    """根据药食同源目录检查药材是否为药食同源"""
    normalized = _normalize_catalog_name(name_cn)
    # 精确匹配
    if normalized in FOOD_HOMOLOGY_CATALOG:
        return True
    # 目录条目包含药材名或反之
    for entry in FOOD_HOMOLOGY_CATALOG:
        if normalized in entry or entry in normalized:
            return True
    return False


# ════════════════════════════════════════════════
# Phase 1: EXTRACT — 数据提取与预校验
# ════════════════════════════════════════════════

async def phase_extract(conn) -> dict[str, Any]:
    """从数据库提取全部记录并执行预校验"""
    print("\n" + "=" * 60)
    print("  Phase 1: EXTRACT — 数据提取与预校验")
    print("=" * 60)

    start_time = time.time()
    report = {"status": "running", "checks": {}, "issues": [], "records": []}

    try:
        # 1.1 提取全部记录
        rows = await conn.fetch("""
            SELECT id, name_cn, name_latin, name_pinyin, category,
                   compounds, targets, diseases,
                   ob_percent, dl_value, effects, is_food_homology,
                   tcmsp_id, source_version, synced_at, created_at
            FROM tcm_herbs ORDER BY id
        """)
        total = len(rows)

        print(f"  [1.1] 提取完成: 共 {total} 条记录")

        # 1.2 记录数校验
        count_check = {
            "name": "总记录数校验",
            "expected": EXPECTED_RECORD_COUNT,
            "actual": total,
            "pass": total == EXPECTED_RECORD_COUNT,
        }
        report["checks"]["record_count"] = count_check
        status_icon = "✅" if count_check["pass"] else "❌"
        print(f"  [1.2] {status_icon} 记录数: 期望 {count_check['expected']}, 实际 {count_check['actual']}")

        if not count_check["pass"]:
            report["issues"].append(f"P0: 记录数不匹配! 期望{EXPECTED_RECORD_COUNT}条, 实际{total}条")

        # 1.3 必填字段 NULL 检查
        required_fields = ["name_cn", "name_latin", "name_pinyin", "category", "ob_percent", "effects", "is_food_homology"]
        null_checks = {}
        for field in required_fields:
            null_count = sum(1 for r in rows if r.get(field) is None or (isinstance(r.get(field), str) and r[field].strip() == ""))
            null_checks[field] = {"null_count": null_count, "pass": null_count == 0}
            if null_count > 0:
                report["issues"].append(f"P1: 字段 '{field}' 有 {null_count} 条 NULL/空值")

        report["checks"]["required_fields_null"] = null_checks
        null_pass_count = sum(1 for v in null_checks.values() if v["pass"])
        print(f"  [1.3] 必填字段 NULL 检查: {null_pass_count}/{len(required_fields)} 通过")

        # 1.4 tcmsp_id 缺失统计
        missing_tcmsp_id = [dict(r) for r in rows if not r.get("tcmsp_id")]
        report["checks"]["tcmsp_id_missing"] = {
            "missing_count": len(missing_tcmsp_id),
            "expected_all_missing": len(missing_tcmsp_id) == total,
            "pass": True,  # 预期全部缺失
        }
        print(f"  [1.4] tcmsp_id 缺失: {len(missing_tcmsp_id)}/{total} 条")

        # 1.5 数据类型完整性检查
        type_issues = []
        ob_out_of_range = []
        bool_invalid = []
        json_invalid = []

        for r in rows:
            d = dict(r)
            rid = d["id"]

            # ob_percent 范围检查
            ob = d.get("ob_percent")
            if ob is not None:
                try:
                    ob_val = float(ob)
                    if ob_val < 0 or ob_val > 100:
                        ob_out_of_range.append({"id": rid, "name_cn": d["name_cn"], "value": ob_val})
                except (TypeError, ValueError):
                    type_issues.append({"id": rid, "field": "ob_percent", "value": ob})

            # is_food_homology 类型检查
            food_val = d.get("is_food_homology")
            if food_val is not None and not isinstance(food_val, bool):
                bool_invalid.append({"id": rid, "field": "is_food_homology", "value": food_val, "type": type(food_val).__name__})

            # JSON 字段有效性检查
            for json_field in ["compounds", "targets", "diseases"]:
                val = d.get(json_field)
                if val is not None:
                    try:
                        parsed = json.loads(val) if isinstance(val, str) else val
                        if not isinstance(parsed, list):
                            json_invalid.append({"id": rid, "field": json_field, "reason": "非数组类型"})
                    except (json.JSONDecodeError, TypeError):
                        json_invalid.append({"id": rid, "field": json_field, "reason": "JSON 解析失败"})

        report["checks"]["type_integrity"] = {
            "ob_out_of_range": len(ob_out_of_range),
            "bool_invalid": len(bool_invalid),
            "json_invalid": len(json_invalid),
            "type_conversion_needed": len(type_issues),
            "pass": len(ob_out_of_range) == 0 and len(bool_invalid) == 0 and len(json_invalid) == 0,
        }
        print(f"  [1.5] 类型完整性: OB异常={len(ob_out_of_range)}, Bool无效={len(bool_invalid)}, JSON无效={len(json_invalid)}")

        # 保存原始记录供后续阶段使用
        report["records"] = [dict(r) for r in rows]

        elapsed = time.time() - start_time
        report["status"] = "success"
        report["timing"] = round(elapsed, 3)
        print(f"\n  ✅ Phase 1 完成 ({elapsed:.2f}s) — 发现 {len(report['issues'])} 个问题")

    except Exception as e:
        report["status"] = "error"
        report["error"] = str(e)
        print(f"\n  ❌ Phase 1 失败: {e}")

    return report


# ════════════════════════════════════════════════
# Phase 2: TRANSFORM — 数据校正与富化
# ════════════════════════════════════════════════

async def phase_transform(records: list[dict], extract_report: dict) -> dict[str, Any]:
    """基于 TCMSP 金标对每条记录进行数据校正"""
    print("\n" + "=" * 60)
    print("  Phase 2: TRANSFORM — 数据校正与富化")
    print("=" * 60)

    start_time = time.time()
    report = {
        "status": "running",
        "transformed_records": [],
        "field_comparison_report": [],   # 每条变更记录的 before/after
        "type_conversion_log": [],       # 类型转换日志
        "difference_analysis": {         # 变更统计
            "total_records": len(records),
            "matched_golden": 0,
            "local_only": 0,
            "latin_corrected": 0,
            "category_normalized": 0,
            "ob_calibrated": 0,
            "food_homology_fixed": 0,
            "tcmsp_id_assigned": 0,
        },
    }

    try:
        tmsp_index = 0  # 用于生成 TMSP_XXXX 格式的 tcmsp_id
        local_index = 0  # 用于生成 LOCAL_XXXX 格式的 tcmsp_id

        for record in records:
            rid = record["id"]
            name_cn = record["name_cn"]
            changes = {}
            before_after = {"id": rid, "name_cn": name_cn, "changes": {}}

            # ── 2.1 tcmsp_id 分配 ──
            if name_cn in TCMSP_GOLDEN:
                tmsp_index += 1
                new_tcmsp_id = f"TMSP_{tmsp_index:04d}"
                report["difference_analysis"]["matched_golden"] += 1
            else:
                local_index += 1
                new_tcmsp_id = f"LOCAL_{local_index:04d}"
                report["difference_analysis"]["local_only"] += 1

            old_tcmsp_id = record.get("tcmsp_id") or "(NULL)"
            if old_tcmsp_id != new_tcmsp_id:
                changes["tcmsp_id"] = new_tcmsp_id
                before_after["changes"]["tcmsp_id"] = {"before": old_tcmsp_id, "after": new_tcmsp_id}
                report["difference_analysis"]["tcmsp_id_assigned"] += 1

            # ── 2.2 拉丁名校正（仅金标匹配的记录）──
            if name_cn in TCMSP_GOLDEN:
                golden = TCMSP_GOLDEN[name_cn]
                golden_latin = golden["latin"]

                local_latin_parts = (record.get("name_latin") or "").split()
                golden_latin_parts = golden_latin.split()
                local_genus = local_latin_parts[0].lower() if local_latin_parts else ""
                golden_genus = golden_latin_parts[0].lower() if golden_latin_parts else ""

                if local_genus and golden_genus and local_genus != golden_genus:
                    changes["name_latin"] = golden_latin
                    before_after["changes"]["name_latin"] = {
                        "before": record.get("name_latin"),
                        "after": golden_latin,
                    }
                    report["difference_analysis"]["latin_corrected"] += 1

            # ── 2.3 分类标准化 ──
            original_cat = record.get("category") or ""
            normalized_cat = normalize_category(original_cat)

            if original_cat != normalized_cat:
                changes["category"] = normalized_cat
                before_after["changes"]["category"] = {
                    "before": original_cat,
                    "after": normalized_cat,
                }
                report["difference_analysis"]["category_normalized"] += 1

            # 对于金标匹配的记录，使用金标中的标准分类（同样需要归一化）
            if name_cn in TCMSP_GOLDEN:
                golden_cat_raw = TCMSP_GOLDEN[name_cn]["cat"]
                golden_cat = normalize_category(golden_cat_raw)  # 金标分类也需归一化
                if normalized_cat != golden_cat:
                    # 如果当前分类已经标准化了但和金标不同，以金标为准
                    changes["category"] = golden_cat
                    before_after["changes"]["category"] = {
                        "before": original_cat,
                        "after": golden_cat,
                        "note": "以TCMSP金标为准覆盖",
                    }

            # ── 2.4 OB 值校准 ──
            if name_cn in TCMSP_GOLDEN:
                golden_ob_lo, golden_ob_hi = TCMSP_GOLDEN[name_cn]["ob_range"]
                current_ob = record.get("ob_percent")

                if current_ob is not None:
                    try:
                        ob_val = float(current_ob)
                        if ob_val < golden_ob_lo:
                            new_ob = golden_ob_lo  # 钳位到下界
                            changes["ob_percent"] = new_ob
                            before_after["changes"]["ob_percent"] = {
                                "before": ob_val,
                                "after": new_ob,
                                "reason": f"低于范围 [{golden_ob_lo}, {golden_ob_hi}]，钳位到下界",
                            }
                            report["difference_analysis"]["ob_calibrated"] += 1
                        elif ob_val > golden_ob_hi:
                            new_ob = golden_ob_hi  # 钳位到上界
                            changes["ob_percent"] = new_ob
                            before_after["changes"]["ob_percent"] = {
                                "before": ob_val,
                                "after": new_ob,
                                "reason": f"高于范围 [{golden_ob_lo}, {golden_ob_hi}]，钳位到上界",
                            }
                            report["difference_analysis"]["ob_calibrated"] += 1
                    except (TypeError, ValueError):
                        # 无法转换，设为中点值
                        midpoint = (golden_ob_lo + golden_ob_hi) / 2
                        changes["ob_percent"] = midpoint
                        before_after["changes"]["ob_percent"] = {
                            "before": str(current_ob),
                            "after": midpoint,
                            "reason": "值无法解析为float，设为范围中点",
                        }
                        report["type_conversion_log"].append({
                            "id": rid, "field": "ob_percent",
                            "original_value": current_ob, "new_value": midpoint,
                        })
                        report["difference_analysis"]["ob_calibrated"] += 1

            # ── 2.5 药食同源校正 ──
            golden_food = None
            if name_cn in TCMSP_GOLDEN:
                golden_food = TCMSP_GOLDEN[name_cn]["food"]

            catalog_food = check_food_homology(name_cn)

            # 决策优先级: TCMSP金标 > 药食同源目录 > 当前值
            if golden_food is not None:
                target_food = golden_food
            else:
                target_food = catalog_food

            current_food = record.get("is_food_homology")
            # 处理可能的非布尔值
            if isinstance(current_food, int):
                current_food = bool(current_food)
            elif current_food is None:
                current_food = False

            if current_food != target_food:
                changes["is_food_homology"] = target_food
                before_after["changes"]["is_food_homology"] = {
                    "before": current_food,
                    "after": target_food,
                    "source": "TCMSP金标" if golden_food is not None else "药食同源目录",
                }
                report["difference_analysis"]["food_homology_fixed"] += 1

            # ── 构建转换后记录 ──
            transformed = dict(record)
            transformed.update(changes)
            transformed["_source_version"] = SOURCE_VERSION
            transformed["_has_changes"] = len(changes) > 0

            report["transformed_records"].append(transformed)

            if len(before_after["changes"]) > 0:
                report["field_comparison_report"].append(before_after)

        elapsed = time.time() - start_time
        report["status"] = "success"
        report["timing"] = round(elapsed, 3)

        da = report["difference_analysis"]
        print(f"  [2.1] 总记录: {da['total_records']}")
        print(f"  [2.2] 金标匹配: {da['matched_golden']} | 本地独有: {da['local_only']}")
        print(f"  [2.3] 校正统计:")
        print(f"       拉丁名修正: {da['latin_corrected']}")
        print(f"       分类标准化: {da['category_normalized']}")
        print(f"       OB值校准:   {da['ob_calibrated']}")
        print(f"       药食同源修正: {da['food_homology_fixed']}")
        print(f"       tcmsp_id分配: {da['tcmsp_id_assigned']}")
        print(f"\n  ✅ Phase 2 完成 ({elapsed:.2f}s)")

    except Exception as e:
        report["status"] = "error"
        report["error"] = str(e)
        print(f"\n  ❌ Phase 2 失败: {e}")

    return report


# ════════════════════════════════════════════════
# Phase 3: LOAD — 事务性批量回写
# ════════════════════════════════════════════════

async def phase_load(conn, transform_report: dict) -> dict[str, Any]:
    """事务性批量回写转换后的数据"""
    print("\n" + "=" * 60)
    print("  Phase 3: LOAD — 事务性批量回写")
    print("=" * 60)

    start_time = time.time()
    report = {"status": "running", "updated_count": 0, "skipped_count": 0, "errors": []}

    try:
        transformed = transform_report.get("transformed_records", [])
        if not transformed:
            raise ValueError("无转换记录可写入")

        # 开始事务
        tr = conn.transaction()
        await tr.start()

        try:
            # 批量 UPDATE — 使用 executemany 批量操作
            update_sql = """
                UPDATE tcm_herbs SET
                    name_latin = $2,
                    category = $3,
                    ob_percent = $4,
                    is_food_homology = $5,
                    tcmsp_id = $6,
                    source_version = $7,
                    synced_at = NOW()
                WHERE id = $1
            """

            batch_params = []
            for rec in transformed:
                params = [
                    rec["id"],
                    rec.get("name_latin") or rec.get("_original_name_latin", ""),
                    rec.get("category") or "",
                    rec.get("ob_percent"),
                    rec.get("is_food_homology", False),
                    rec.get("tcmsp_id") or "",
                    SOURCE_VERSION,
                ]
                batch_params.append(params)

            # 执行批量更新
            results = await conn.executemany(update_sql, batch_params)
            report["updated_count"] = len(batch_params)

            # 提交事务
            await tr.commit()

            elapsed = time.time() - start_time
            report["status"] = "success"
            report["timing"] = round(elapsed, 3)
            print(f"  [3.1] 批量更新: {report['updated_count']} 条记录")
            print(f"  [3.2] 事务已提交 ✓")
            print(f"\n  ✅ Phase 3 完成 ({elapsed:.2f}s)")

        except Exception as e:
            await tr.rollback()
            report["status"] = "rollback"
            report["errors"].append(f"事务回滚: {e}")
            print(f"\n  ⚠️ Phase 3 事务已回滚: {e}")
            raise

    except Exception as e:
        if report["status"] != "rollback":
            report["status"] = "error"
            report["error"] = str(e)
            print(f"\n  ❌ Phase 3 失败: {e}")

    return report


# ════════════════════════════════════════════════
# Phase 4: ID 序列重建
# ════════════════════════════════════════════════

async def phase_rebuild_ids(conn) -> dict[str, Any]:
    """重建连续 ID 序列 1~N（使用临时列方案避免唯一约束冲突）"""
    print("\n" + "=" * 60)
    print("  Phase 4: ID 序列重建")
    print("=" * 60)

    start_time = time.time()
    report = {"status": "running", "old_id_map": [], "gap_count_before": 0, "gap_count_after": 0}

    try:
        # 4.1 获取当前所有记录（按原ID排序保持稳定顺序）
        rows = await conn.fetch("""
            SELECT id FROM tcm_herbs ORDER BY id ASC
        """)
        all_ids = [r["id"] for r in rows]
        total = len(all_ids)

        # 4.2 检查现有间隙
        gaps_before = []
        for i in range(len(all_ids) - 1):
            diff = all_ids[i + 1] - all_ids[i]
            if diff > 1:
                gaps_before.append({
                    "from": all_ids[i],
                    "to": all_ids[i + 1],
                    "gap_size": diff - 1,
                })
        report["gap_count_before"] = len(gaps_before)
        print(f"  [4.1] 当前记录数: {total}, 间隙数: {len(gaps_before)}")

        if gaps_before:
            print(f"  [4.2] 间隙详情:")
            for g in gaps_before[:10]:
                print(f"       #{g['from']} → #{g['to']}: 缺失 {g['gap_size']} 个ID")

        # 4.3 使用临时列 + 负空间方案（彻底避免唯一约束冲突）
        # 步骤A: 添加临时列
        await conn.execute("""
            ALTER TABLE tcm_herbs ADD COLUMN IF NOT EXISTS _etl_new_id BIGINT
        """)

        # 步骤B: 填充新ID映射到临时列（按原ID顺序）
        for idx, old_id in enumerate(all_ids, start=1):
            await conn.execute(
                "UPDATE tcm_herbs SET _etl_new_id = $1 WHERE id = $2",
                idx, old_id
            )

        # 步骤C: 先将所有ID移到负数空间（避免与目标正ID冲突）
        await conn.execute("UPDATE tcm_herbs SET id = -id")

        # 步骤D: 从临时列回写到主键（此时目标正ID空间完全空闲）
        await conn.execute("UPDATE tcm_herbs SET id = _etl_new_id")

        # 步骤E: 记录映射关系
        report["old_id_map"] = [{"old": old_id, "new": idx} for idx, old_id in enumerate(all_ids, start=1)]

        # 步骤F: 删除临时列
        await conn.execute("ALTER TABLE tcm_herbs DROP COLUMN IF EXISTS _etl_new_id")

        # 4.6 重置序列
        await conn.execute(f"ALTER SEQUENCE IF EXISTS tcm_herbs_id_seq RESTART WITH {total + 1}")
        await conn.execute(f"SELECT setval('tcm_herbs_id_seq', {total})")

        # 4.7 验证连续性
        new_ids_raw = await conn.fetch("SELECT id FROM tcm_herbs ORDER BY id ASC")
        new_ids = [r["id"] for r in new_ids_raw]

        gaps_after = []
        for i in range(len(new_ids) - 1):
            diff = new_ids[i + 1] - new_ids[i]
            if diff > 1:
                gaps_after.append({
                    "from": new_ids[i],
                    "to": new_ids[i + 1],
                    "gap_size": diff - 1,
                })

        report["gap_count_after"] = len(gaps_after)

        elapsed = time.time() - start_time
        report["status"] = "success"
        report["timing"] = round(elapsed, 3)
        report["final_id_range"] = f"{min(new_ids)} ~ {max(new_ids)}"
        report["continuity_rate"] = f"{(len(new_ids) / max(new_ids) * 100):.1f}%" if max(new_ids) > 0 else "N/A"

        icon = "✅" if len(gaps_after) == 0 else "⚠️"
        print(f"  [4.3] ID 重建完成: 范围 {min(new_ids)} ~ {max(new_ids)}")
        print(f"  [4.4] {icon} 间隙数: 之前 {len(gaps_before)} → 之后 {len(gaps_after)}")
        print(f"  [4.5] 序列已重置: nextval = {total + 1}")
        print(f"\n  ✅ Phase 4 完成 ({elapsed:.2f}s)")

    except Exception as e:
        report["status"] = "error"
        report["error"] = str(e)
        print(f"\n  ❌ Phase 4 失败: {e}")

    return report


# ════════════════════════════════════════════════
# Phase 5: VERIFY — 同步后验证
# ════════════════════════════════════════════════

async def phase_verify(conn, extract_report: dict, transform_report: dict) -> dict[str, Any]:
    """重新执行所有 Phase 1 校验 + 新增验证项"""
    print("\n" + "=" * 60)
    print("  Phase 5: VERIFY — 同步后验证")
    print("=" * 60)

    start_time = time.time()
    report = {
        "status": "running",
        "checks": {},
        "integrity_check_log": {},
        "final_checksums": {},
        "all_passed": False,
    }

    try:
        # 5.1 记录数零丢失校验
        total = await conn.fetchval("SELECT COUNT(*) FROM tcm_herbs")
        count_ok = total == EXPECTED_RECORD_COUNT
        report["checks"]["record_count_zero_loss"] = {
            "expected": EXPECTED_RECORD_COUNT,
            "actual": total,
            "pass": count_ok,
        }
        icon = "✅" if count_ok else "❌"
        print(f"  [5.1] {icon} 记录数零丢失: {total}/{EXPECTED_RECORD_COUNT}")

        # 5.2 tcmsp_id 完整性
        null_tcmsp = await conn.fetchval(
            "SELECT COUNT(*) FROM tcm_herbs WHERE tcmsp_id IS NULL OR tcmsp_id = ''"
        )
        matched_tcmsp = await conn.fetchval(
            "SELECT COUNT(*) FROM tcm_herbs WHERE tcmsp_id LIKE 'TMSP_%'"
        )
        local_tcmsp = await conn.fetchval(
            "SELECT COUNT(*) FROM tcm_herbs WHERE tcmsp_id LIKE 'LOCAL_%'"
        )
        tcmsp_ok = null_tcmsp == 0
        report["checks"]["tcmsp_id_completeness"] = {
            "null_or_empty": null_tcmsp,
            "tmsp_prefix": matched_tcmsp,
            "local_prefix": local_tcmsp,
            "pass": tcmsp_ok,
        }
        icon = "✅" if tcmsp_ok else "❌"
        print(f"  [5.2] {icon} tcmsp_id 完整性: TMSP={matched_tcmsp}, LOCAL={local_tcmsp}, NULL={null_tcmsp}")

        # 5.3 ID 连续性验证
        ids_raw = await conn.fetch("SELECT id FROM tcm_herbs ORDER BY id ASC")
        all_ids = [r["id"] for r in ids_raw]
        expected_ids = list(range(1, len(all_ids) + 1))
        is_continuous = all_ids == expected_ids
        report["checks"]["id_sequence_continuous"] = {
            "actual_ids": all_ids[:10],  # 只存前10个避免过大
            "actual_total": len(all_ids),
            "expected_start": 1,
            "expected_end": len(all_ids),
            "pass": is_continuous,
            "gap_details": [] if is_continuous else [
                {"expected": e, "actual": a} for e, a in zip(expected_ids, all_ids) if e != a
            ][:20],
        }
        icon = "✅" if is_continuous else "❌"
        print(f"  [5.3] {icon} ID 连续性: 1~{len(all_ids)} {'完美连续' if is_continuous else '存在间隙'}")

        # 5.4 分类数量校验
        cat_stats = await conn.fetch("""
            SELECT category, COUNT(*) as cnt
            FROM tcm_herbs GROUP BY category ORDER BY cnt DESC
        """)
        categories = {r["category"]: r["cnt"] for r in cat_stats}
        non_standard_cats = [c for c in categories if c in CATEGORY_NORMALIZATION_MAP.keys()]
        report["checks"]["category_standardization"] = {
            "category_count": len(categories),
            "categories": categories,
            "non_standard_remaining": non_standard_cats,
            "pass": len(non_standard_cats) == 0,
        }
        icon = "✅" if len(non_standard_cats) == 0 else "⚠️"
        print(f"  [5.4] {icon} 分类数: {len(categories)} 类, 非标准剩余: {len(non_standard_cats)}")
        if non_standard_cats:
            print(f"       非标准分类: {non_standard_cats}")

        # 5.5 药食同源数量校验
        food_true = await conn.fetchval("SELECT COUNT(*) FROM tcm_herbs WHERE is_food_homology = TRUE")
        food_false = await conn.fetchval("SELECT COUNT(*) FROM tcm_herbs WHERE is_food_homology = FALSE")
        report["checks"]["food_homology_count"] = {
            "true_count": food_true,
            "false_count": food_false,
            "catalog_size": len(FOOD_HOMOLOGY_CATALOG),
            "pass": True,  # 信息性检查
        }
        print(f"  [5.5] 药食同源: 是={food_true}, 否={food_false} (目录参考: {len(FOOD_HOMOLOGY_CATALOG)})")

        # 5.6 source_version 校验
        version_count = await conn.fetchval(
            "SELECT COUNT(*) FROM tcm_herbs WHERE source_version = $1", SOURCE_VERSION
        )
        report["checks"]["source_version_applied"] = {
            "with_etl_version": version_count,
            "total": total,
            "pass": version_count == total,
        }
        icon = "✅" if version_count == total else "⚠️"
        print(f"  [5.6] {icon} source_version='{SOURCE_VERSION}': {version_count}/{total}")

        # 5.7 SHA256 校验和
        names = await conn.fetch("SELECT name_cn FROM tcm_herbs ORDER BY id ASC")
        name_list = [r["name_cn"] for r in names]
        name_checksum = compute_sha256(name_list)

        latins = await conn.fetch("SELECT COALESCE(name_latin,'') FROM tcm_herbs ORDER BY id ASC")
        latin_list = [r["coalesce"] for r in latins]
        latin_checksum = compute_sha256(latin_list)

        cats = await conn.fetch("SELECT COALESCE(category,'') FROM tcm_herbs ORDER BY id ASC")
        cat_list = [r["coalesce"] for r in cats]
        cat_checksum = compute_sha256(cat_list)

        report["final_checksums"] = {
            "name_cn_sha256": name_checksum,
            "name_latin_sha256": latin_checksum,
            "category_sha256": cat_checksum,
            "algorithm": "SHA256",
            "record_count": len(name_list),
        }
        print(f"  [5.7] SHA256 校验和:")
        print(f"       name_cn:   {name_checksum[:32]}...")
        print(f"       name_latin:{latin_checksum[:32]}...")
        print(f"       category:  {cat_checksum[:32]}...")

        # 5.8 综合判定
        all_checks = report["checks"]
        critical_pass = (
            all_checks.get("record_count_zero_loss", {}).get("pass", False) and
            all_checks.get("tcmsp_id_completeness", {}).get("pass", False) and
            all_checks.get("id_sequence_continuous", {}).get("pass", False)
        )
        report["all_passed"] = critical_pass and all(v.get("pass", True) for v in all_checks.values())

        elapsed = time.time() - start_time
        report["status"] = "success"
        report["timing"] = round(elapsed, 3)

        final_icon = "🎉" if report["all_passed"] else "⚠️"
        print(f"\n  {final_icon} Phase 5 完成 ({elapsed:.2f}s)")
        print(f"      全部通过: {'是' if report['all_passed'] else '否 — 请检查上述失败项'}")

    except Exception as e:
        report["status"] = "error"
        report["error"] = str(e)
        print(f"\n  ❌ Phase 5 失败: {e}")

    return report


# ════════════════════════════════════════════════
# 主流程
# ════════════════════════════════════════════════

async def main():
    """ETL 管道主入口"""
    overall_start = time.time()
    final_report = {
        "pipeline_name": "RMFOOD ETL Sync Pipeline",
        "version": SOURCE_VERSION,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "db_url": DB_URL.replace("postgresql://", "postgresql://***@"),
        "phase_results": {},
        "exit_code": 0,
    }

    print("=" * 60)
    print("  RMFOOD 配方平台 — ETL 数据同步管道")
    print(f"  版本: {SOURCE_VERSION} | 目标: tcm_herbs 表 ({EXPECTED_RECORD_COUNT} 条)")
    print(f"  时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)

    conn = None
    try:
        # 连接数据库
        print("\n  正在连接数据库...")
        conn = await asyncpg.connect(DB_URL)
        print("  ✅ 数据库连接成功")

        # === Phase 1: EXTRACT ===
        extract_result = await phase_extract(conn)
        final_report["phase_results"]["extract"] = extract_result

        if extract_result["status"] != "success":
            print("\n  ❌ Phase 1 失败，终止管道")
            final_report["exit_code"] = 1
            return final_report

        records = extract_result["records"]

        # === Phase 2: TRANSFORM ===
        transform_result = await phase_transform(records, extract_result)
        final_report["phase_results"]["transform"] = transform_result

        if transform_result["status"] != "success":
            print("\n  ❌ Phase 2 失败，终止管道")
            final_report["exit_code"] = 1
            return final_report

        # === Phase 3: LOAD ===
        load_result = await phase_load(conn, transform_result)
        final_report["phase_results"]["load"] = load_result

        if load_result["status"] not in ("success",):
            print("\n  ❌ Phase 3 失败，终止管道")
            final_report["exit_code"] = 1
            return final_report

        # === Phase 4: ID 序列重建 ===
        rebuild_result = await phase_rebuild_ids(conn)
        final_report["phase_results"]["rebuild_ids"] = rebuild_result

        if rebuild_result["status"] != "success":
            print("\n  ⚠️ Phase 4 (ID重建) 失败，继续验证但可能有问题")
            # 不终止，继续验证

        # === Phase 5: VERIFY ===
        verify_result = await phase_verify(conn, extract_result, transform_result)
        final_report["phase_results"]["verify"] = verify_result

        # === 最终汇总 ===
        overall_elapsed = time.time() - overall_start
        final_report["total_timing_seconds"] = round(overall_elapsed, 3)
        final_report["exit_code"] = 0 if verify_result.get("all_passed", False) else 1

        da = transform_result.get("difference_analysis", {})
        vr = verify_result.get("checks", {})

        print("\n" + "=" * 60)
        print("  📊 ETL 同步管道 — 最终报告")
        print("=" * 60)
        print(f"  总耗时: {overall_elapsed:.2f}s")
        print(f"  处理记录: {da.get('total_records', '?')}")
        print(f"  金标匹配: {da.get('matched_golden', '?')} | 本地独有: {da.get('local_only', '?')}")
        print(f"  变更统计:")
        print(f"    拉丁名修正:     {da.get('latin_corrected', 0)}")
        print(f"    分类标准化:     {da.get('category_normalized', 0)}")
        print(f"    OB值校准:       {da.get('ob_calibrated', 0)}")
        print(f"    药食同源修正:   {da.get('food_homology_fixed', 0)}")
        print(f"    tcmsp_id分配:   {da.get('tcmsp_id_assigned', 0)}")
        print(f"  验证结果:")
        print(f"    记录数:         {'✅' if vr.get('record_count_zero_loss',{}).get('pass') else '❌'}")
        print(f"    tcmsp_id:       {'✅' if vr.get('tcmsp_id_completeness',{}).get('pass') else '❌'}")
        print(f"    ID连续性:       {'✅' if vr.get('id_sequence_continuous',{}).get('pass') else '❌'}")
        print(f"    全部通过:       {'🎉 是' if verify_result.get('all_passed') else '⚠️ 否'}")
        print("=" * 60)

    except Exception as e:
        print(f"\n  💥 致命错误: {e}")
        import traceback
        traceback.print_exc()
        final_report["exit_code"] = 1
        final_report["fatal_error"] = str(e)

    finally:
        if conn:
            await conn.close()
            print("\n  数据库连接已关闭")

    # === 保存 JSON 报告 ===
    report_path = "etl_sync_report.json"
    try:
        with open(report_path, "w", encoding="utf-8") as f:
            json.dump(final_report, f, ensure_ascii=False, indent=2, default=str)
        print(f"\n  📄 详细报告已保存: {report_path}")
    except Exception as e:
        print(f"\n  ⚠️ 报告保存失败: {e}")

    return final_report


if __name__ == "__main__":
    result = asyncio.run(main())
    sys.exit(result.get("exit_code", 1))
