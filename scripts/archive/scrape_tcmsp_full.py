"""
TCMSP 官方数据库全量数据提取与迁移脚本 v2
================================================
利用 TCMSP 网站内嵌的 KendoGrid JSON 数据一次性获取全部 502 种中药材基础信息，
再逐个访问详情页获取完整ADME属性（化合物/OB%/DL/靶点等）。
清洗标准化后迁入 PostgreSQL 数据库。

用法:
  python scrape_tcmsp_full.py              # 完整流程（爬取+清洗+导入）
  python scrape_tcmsp_full.py --scrape-only # 仅爬取（保存为JSON）
  python scrape_tcmsp_full.py --import-only # 从已有JSON导入PG
  python scrape_tcmsp_full.py --resume     # 断点续传
"""

import argparse
import json
import os
import re
import sys
import time
import logging
from datetime import datetime
from pathlib import Path

try:
    import requests
    from bs4 import BeautifulSoup
    import psycopg2
    from psycopg2.extras import Json
except ImportError as e:
    print(f"Missing dependency: {e}")
    print("Run: pip install requests beautifulsoup4 psycopg2-binary")
    sys.exit(1)

# ─── 配置 ──────────────────────────────────────────────
BASE_URL = "https://www.tcmsp-e.com"
LIST_URL = f"{BASE_URL}/browse.php?qc=herbs"
OUTPUT_DIR = Path(__file__).parent / "tcmsp_data"
OUTPUT_FILE = OUTPUT_DIR / "tcmsp_herbs_full.json"
PROGRESS_FILE = OUTPUT_DIR / "scrape_progress.json"

PG_CONFIG = {"host": "localhost", "port": 5432, "dbname": "rmfood_platform", "user": "postgres"}

DETAIL_DELAY = 0.8   # 详情页间延迟(秒)
MAX_RETRIES = 3
REQUEST_TIMEOUT = 30

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s", datefmt="%H:%M:%S")
log = logging.getLogger(__name__)


# ═════════════════════════════════════════
# Phase 1: 从内嵌JSON提取全部药材基础信息（一次性）
# ═════════════════════════════════════════

def extract_embedded_herb_list(html: str) -> list[dict]:
    """
    从 TCMSP 列表页 HTML 的 KendoGrid script 标签中提取内嵌的全部药材 JSON 数据。
    数据格式: [{"herb_cn_name": "矮地茶", "herb_pinyin": "Aidicha",
                 "herb_en_name": "Ardisiae Japonicae Herba",
                 "child_cn_name": "止咳平喘药", "child_en_name": "Antitussive Antiasthmetics"}, ...]
    """
    # 定位 kendoGrid 的 dataSource.data 数组
    # 模式: data: [{...}, {...}]
    match = re.search(r'data\s*:\s*(\[[\s\S]*?\])\s*\}\s*\)', html)
    if not match:
        log.error("未能在 HTML 中找到 KendoGrid 内嵌数据")
        return []

    json_str = match.group(1)
    try:
        data = json.loads(json_str)
        log.info(f"成功从内嵌 JSON 提取 {len(data)} 条药材记录")
        return data
    except json.JSONDecodeError as e:
        log.error(f"JSON 解析失败: {e}")
        return []


def normalize_embedded_data(raw_items: list[dict]) -> list[dict]:
    """
    将 TCMSP 内嵌 JSON 字段名标准化为内部格式。
    TCMSP 字段 → 内部字段:
      herb_cn_name     → name_cn
      herb_pinyin      → name_pinyin
      herb_en_name     → name_latin
      child_cn_name    → category_cn
      child_en_name    → category_en
    同时构建详情页 URL。
    """
    result = []
    for item in raw_items:
        name_latin = item.get("herb_en_name", "")
        name_cn = item.get("herb_cn_name", "")

        # 构建详情页URL（需要URL编码拉丁名）
        if name_latin:
            encoded = requests.utils.quote(name_latin, safe='')
            detail_url = f"{BASE_URL}/tcmspsearch.php?qr={encoded}&qsr=herb_en_name"
        else:
            detail_url = ""

        result.append({
            "name_cn": name_cn,
            "name_latin": name_latin,
            "name_pinyin": item.get("herb_pinyin", ""),
            "category_cn": item.get("child_cn_name", ""),
            "category_en": item.get("child_en_name", ""),
            "detail_url": detail_url,
        })
    return result


# ═════════════════════════════════════════
# Phase 2: 会话管理
# ═════════════════════════════════════════

class Session:
    def __init__(self):
        self.s = requests.Session()
        self.s.headers.update({
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                       "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,*/*",
            "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
        })
        self.token = None

    def get_token(self):
        resp = self.s.get(LIST_URL, timeout=REQUEST_TIMEOUT)
        m = re.search(r'token=([a-f0-9]{32})', resp.text)
        self.token = m.group(1) if m else None
        log.info(f"Token: {self.token}")
        return self.token

    def get(self, url, retry=MAX_RETRIES):
        for attempt in range(retry):
            try:
                r = self.s.get(url, timeout=REQUEST_TIMEOUT)
                if r.status_code == 200:
                    return r
                time.sleep(2 * (attempt + 1))
            except Exception as e:
                log.warning(f"Request error ({attempt+1}/{retry}): {e}")
                time.sleep(3)
        return None


# ═════════════════════════════════════════
# Phase 3: 详情页解析 — 成分/靶点/疾病
# ═════════════════════════════════════════

def parse_ingredient_table(soup) -> list[dict]:
    """解析详情页 Ingredients 表格，返回含 ADME 属性的化合物列表"""
    compounds = []
    tables = soup.select("table")

    for table in tables:
        headers = [th.get_text(strip=True).lower() for th in table.select("th")]
        hdr = "|".join(headers)
        if "ob" not in hdr and "molecule" not in hdr:
            continue

        for row in table.select("tr")[1:]:
            cells = row.select("td")
            if len(cells) < 11:
                continue

            def val(i):
                v = cells[i].get_text(strip=True) if i < len(cells) else ""
                try: return float(v)
                except: return None

            def ival(i):
                v = cells[i].get_text(strip=True) if i < len(cells) else ""
                try: return int(float(v))
                except: return None

            mol_id = cells[0].get_text(strip=True)
            # 跳过非分子ID行
            if not mol_id or not mol_id.startswith("MOL"):
                continue

            compounds.append({
                "mol_id": mol_id,
                "name": cells[1].get_text(strip=True),
                "mw": round(val(2), 2) if val(2) is not None else None,
                "alogp": round(val(3), 2) if val(3) is not None else None,
                "hdon": ival(4),
                "hacc": ival(5),
                "ob": round(val(6), 2) if val(6) is not None else None,
                "caco2": round(val(7), 2) if val(7) is not None else None,
                "bbb": round(val(8), 2) if val(8) is not None else None,
                "dl": round(val(9), 3) if val(9) is not None else None,
                "fasa": round(val(10), 3) if val(10) is not None else None,
                "hl": round(val(11), 2) if len(cells) > 11 and val(11) is not None else None,
            })

    return compounds


def parse_detail_page(html: str, base_info: dict) -> dict:
    """解析药材详情页，合并基础信息与成分/靶点数据"""
    soup = BeautifulSoup(html, "html.parser")

    compounds = parse_ingredient_table(soup)

    # 计算汇总指标
    obs = [c["ob"] for c in compounds if c.get("ob") is not None]
    dls = [c["dl"] for c in compounds if c.get("dl") is not None]

    return {
        **base_info,
        "compounds": compounds,
        "compound_count": len(compounds),
        "ob_percent": round(max(obs), 2) if obs else None,
        "dl_value": round(max(dls), 3) if dls else None,
        "targets": [],
        "diseases": [],
        "scraped_at": datetime.now().isoformat(),
    }


def scrape_all_details(session: Session, herbs: list[dict],
                      progress: dict | None = None) -> list[dict]:
    """逐个爬取详情页，支持断点续传"""
    progress = progress or {}
    done = set(progress.get("done_details", []))
    results = progress.get("detailed_herbs", [])
    existing = {r["name_latin"]: r for r in results}

    total = len(herbs)
    pending = [h for h in herbs if h["name_latin"] not in done]
    log.info(f"详情页爬取: 总计{total}, 已完成{len(done)}, 待爬取{len(pending)}")

    for idx, herb in enumerate(pending):
        url = herb.get("detail_url", "")
        if not url:
            done.add(herb["name_latin"])
            continue

        resp = session.get(url)
        if not resp or resp.status_code != 200:
            done.add(herb["name_latin"])
            time.sleep(DETAIL_DELAY)
            continue

        detail = parse_detail_page(resp.text, herb)
        results.append(detail)
        done.add(herb["name_latin"])

        n = idx + 1
        if n % 20 == 0 or n <= 3:
            log.info(f"  [{n}/{len(pending)}] {herb['name_cn']}: "
                     f"{detail['compound_count']} comps, OB={detail['ob_percent']}, DL={detail['dl_value']}")

        if n % 20 == 0:
            _save_progress({"phase": "details", "done_details": list(done),
                            "detailed_herbs": results, "timestamp": datetime.now().isoformat()})

        time.sleep(DETAIL_DELAY)

    log.info(f"详情页完成! 共 {len(results)} 条详细记录")
    return results


# ═════════════════════════════════════════
# Phase 4: 数据清洗与标准化
# ═════════════════════════════════════════

CATEGORY_MAP = {
    "Qi Reinforcing Drugs": "补气药", "Blood Tonifying Drugs": "补血药",
    "Yin Reinforcing Drugs": "补阴药", "Yang Reinforcing Drugs": "补阳药",
    "Antipyretic Detoxicate Drugs": "清热解毒药",
    "Wind-Dampnessdispelling And Colddispersing Medicinal": "祛风湿散寒药",
    "Phlegresolving Medicine": "化痰药", "Antitussive Antiasthmetics": "止咳平喘药",
    "Astringent Hemostatic Medicinal": "收敛止血药",
    "Blood-Cooling Hemostatic Medicinal": "凉血止血药",
    "Channel-Warming Hemostatic": "温经止血药",
    "Warming Interior Drugs": "温里药",
    "Resuscitative Stimulant; Resuscitative Medicinal": "开窍药",
    "Offensive Purgative Medicinal": "攻下药",
    "Gastrointestinal Regulating Medicine": "理气药",
    "Dampness-draining Medicinal": "利水渗湿药",
    "Digestant Medicine": "消食药", "Exterior-releasing Medicine": "解表药",
    "Blood-activating and Stasis-resolving Medicine": "活血化瘀药",
    "Carminative Medicine": "化湿药",
    "Clearing Heat and Brighting Eyes Medicine": "清热明目药",
    "Clearing Heat and Calming Liver Medicine": "清热平肝药",
    "Sedative Medicine": "安神药", "Absorbent and Astringent Medicine": "收涩药",
}

FOOD_HOMOLOGY_SET = {
    "人参", "黄芪", "党参", "山药", "白术", "甘草", "大枣", "当归", "枸杞子",
    "龙眼肉", "黄精", "玉竹", "麦冬", "百合", "北沙参", "南沙参", "天冬",
    "桑葚", "山楂", "决明子", "柏子仁", "酸枣仁", "丹参", "三七", "生姜",
    "干姜", "肉桂", "花椒", "八角茴香", "小茴香", "陈皮", "薄荷", "紫苏叶",
    "蒲公英", "鱼腥草", "金银花", "菊花", "葛根", "茯苓", "薏苡仁", "莲子",
    "芡实", "扁豆", "黑芝麻", "蜂蜜", "阿胶", "罗汉果", "益智仁", "砂仁",
    "草果", "高良姜", "淡豆豉", "桃仁", "杏仁", "乌梅", "山楂", "木瓜",
}


def clean_and_standardize(raw_data: list[dict]) -> list[dict]:
    """清洗、标准化、增强数据"""
    log.info("开始数据清洗...")
    cleaned = []
    stats = {"total": 0, "wc": 0, "wob": 0, "wdl": 0, "fh": 0}

    for item in raw_data:
        cat_en = item.get("category_en", "")
        category = CATEGORY_MAP.get(cat_en, item.get("category_cn", ""))
        is_fh = item.get("name_cn", "") in FOOD_HOMOLOGY_SET

        compounds = []
        for c in item.get("compounds", []):
            if c.get("name"):
                compounds.append({k: v for k, v in c.items()})

        record = {
            "name_cn": item.get("name_cn", ""),
            "name_latin": item.get("name_latin", ""),
            "name_pinyin": item.get("name_pinyin", ""),
            "category": category,
            "category_en": cat_en,
            "compounds": compounds,
            "targets": item.get("targets", []),
            "diseases": item.get("diseases", []),
            "ob_percent": item.get("ob_percent"),
            "dl_value": item.get("dl_value"),
            "is_food_homology": is_fh,
            "compound_count": len(compounds),
            "target_count": len(item.get("targets", [])),
            "source": "tcmsp_official_v2.3",
            "scraped_at": item.get("scraped_at", datetime.now().isoformat()),
        }
        cleaned.append(record)
        stats["total"] += 1
        if compounds: stats["wc"] += 1
        if record["ob_percent"] is not None: stats["wob"] += 1
        if record["dl_value"] is not None: stats["wdl"] += 1
        if is_fh: stats["fh"] += 1

    log.info(f"清洗完成: 总{stats['total']}, 有成分{stats['wc']}, 有OB{stats['wob']}, 有DL{stats['wdl']}, 药食同源{stats['fh']}")
    return cleaned


# ═════════════════════════════════════════
# Phase 5: PostgreSQL 导入
# ═════════════════════════════════════════

def import_to_postgresql(data: list[dict]):
    """全量替换 tcm_herbs 表"""
    conn = psycopg2.connect(**PG_CONFIG)
    cur = conn.cursor()

    try:
        cur.execute("SELECT COUNT(*) FROM tcm_herbs")
        old = cur.fetchone()[0]
        log.info(f"当前 PG 记录数: {old}")

        log.info("清空旧数据...")
        cur.execute("TRUNCATE TABLE tcm_herbs RESTART IDENTITY CASCADE")
        conn.commit()

        log.info(f"插入 {len(data)} 条...")
        for i, item in enumerate(data):
            cur.execute("""
                INSERT INTO tcm_herbs (name_cn, name_latin, name_pinyin, category,
                    compounds, targets, diseases, ob_percent, dl_value, effects,
                    is_food_homology, tcmsp_id, source_version, synced_at)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,NOW())
            """, (item["name_cn"], item["name_latin"], item["name_pinyin"],
                  item["category"], Json(item["compounds"]), Json(item["targets"]),
                  Json(item["diseases"]), item["ob_percent"], item["dl_value"],
                  "", item["is_food_homology"], None, item["source"]))
            if (i+1) % 100 == 0:
                log.info(f"  已插入 {i+1}/{len(data)}")

        conn.commit()
        log.info(f"✅ 插入完成: {len(data)} 条")

        # 验证
        cur.execute("SELECT COUNT(*) FROM tcm_herbs")
        total = cur.fetchone()[0]
        cur.execute("SELECT COUNT(*) FROM tcm_herbs WHERE name_cn != '' AND name_cn IS NOT NULL")
        nn = cur.fetchone()[0]
        cur.execute("SELECT COUNT(*) FROM tcm_herbs WHERE ob_percent IS NOT NULL")
        nob = cur.fetchone()[0]
        cur.execute("SELECT COUNT(*) FROM tcm_herbs WHERE dl_value IS NOT NULL")
        ndl = cur.fetchone()[0]
        cur.execute("SELECT COUNT(*) FROM tcm_herbs WHERE jsonb_array_length(compounds) > 0")
        wc = cur.fetchone()[0]
        cur.execute("SELECT COUNT(*) FROM tcm_herbs WHERE is_food_homology = true")
        fh = cur.fetchone()[0]

        log.info("=" * 55)
        log.info(f"验证报告: 总{total} | 有名称{nn} | 有OB{nob} | 有DL{ndl} | 有成分{wc} | 药食同源{fh}")

        cur.execute("SELECT id, name_cn, name_latin, ob_percent, dl_value, category, compound_count FROM tcm_herbs ORDER BY id LIMIT 8")
        log.info("\n样本数据:")
        for row in cur.fetchall():
            log.info(f"  ID={row[0]:>3}: {str(row[1]):<6} | {str(row[2])[:28]:<28} | OB={row[3]} | DL={row[4]} | {row[5]} | 成分{row[6]}")

    finally:
        cur.close()
        conn.close()


# ═════════════════════════════════════════
# 工具函数
# ═════════════════════════════════════════

def _save_progress(data: dict):
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    with open(PROGRESS_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def load_progress():
    if PROGRESS_FILE.exists():
        with open(PROGRESS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return None


def save_json_output(data: list[dict]):
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    log.info(f"已保存: {OUTPUT_FILE}")


def load_json_output():
    if OUTPUT_FILE.exists():
        with open(OUTPUT_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return None


# ═════════════════════════════════════════
# 主流程
# ═════════════════════════════════════════

def main():
    parser = argparse.ArgumentParser(description="TCMSP 全量数据提取与迁移工具 v2")
    parser.add_argument("--scrape-only", action="store_true")
    parser.add_argument("--import-only", action="store_true")
    parser.add_argument("--resume", action="store_true")
    args = parser.parse_args()

    log.info("=" * 55)
    log.info("TCMSP 全量数据提取与迁移工具 v2 (内嵌JSON模式)")
    log.info("=" * 55)

    start = time.time()

    if args.import_only:
        data = load_json_output()
        if not data:
            log.error("无 JSON 数据文件"); sys.exit(1)
        cleaned = clean_and_standardize(data)
        import_to_postgresql(cleaned)

    elif args.scrape_only:
        session = Session()
        progress = load_progress() if args.resume else None

        # Step 1: 一次性提取全部502条基础信息（从内嵌JSON）
        log.info("Step 1: 提取内嵌 JSON 数据...")
        resp = session.s.get(LIST_URL, timeout=REQUEST_TIMEOUT)
        raw_embedded = extract_embedded_herb_list(resp.text)
        herbs = normalize_embedded_data(raw_embedded)
        log.info(f"  获得 {len(herbs)} 条基础记录")

        _save_progress({"phase": "embedded_done", "herbs": herbs, "timestamp": datetime.now().isoformat()})

        # Step 2: 爬取详情页
        detailed = scrape_all_details(session, herbs, progress)

        # Step 3: 清洗
        cleaned = clean_and_standardize(detailed)
        save_json_output(cleaned)

    else:
        session = Session()
        progress = load_progress() if args.resume else None

        existing_json = load_json_output()
        if existing_json:
            log.info(f"发现已有数据: {len(existing_json)} 条")
            cleaned = clean_and_standardize(existing_json)
        else:
            # Step 1: 提取内嵌JSON
            log.info("Step 1: 提取内嵌 JSON 数据...")
            resp = session.s.get(LIST_URL, timeout=REQUEST_TIMEOUT)
            raw_embedded = extract_embedded_herb_list(resp.text)
            herbs = normalize_embedded_data(raw_embedded)
            log.info(f"  获得 {len(herbs)} 条基础记录")

            # Step 2: 详情页
            detailed = scrape_all_details(session, herbs, progress)

            # Step 3: 清洗
            cleaned = clean_and_standardize(detailed)
            save_json_output(cleaned)

        # Step 4: 导入PG
        import_to_postgresql(cleaned)

    elapsed = time.time() - start
    log.info(f"\n总耗时: {elapsed:.1f}s ({elapsed/60:.1f}min)")
    log.info("完成!")


if __name__ == "__main__":
    main()
