"""HKBU MMID 詳細頁面爬蟲 - 補充性味、功效、產地等傳統中藥字段

從 MMID 列表頁已有的 pid 出發，逐個抓取 detail.php 頁面，
提取以下傳統中藥核心字段：
  - 性味 (nature_flavor): 如 "味苦，性寒"
  - 功效 (efficacy): 如 "攻積滯；清洩熱；瀉火；涼血；活血；解毒"
  - 產地 (origin): 主產地區域
  - 炮製 (processing): 炮製方法
  - 來源 (source): 植物來源（科屬、學名）
  - 性狀 (characteristics): 外觀特徵
  - 品質 (quality): 品質評價標準
  - 毒性 (toxicity): 毒性信息
  - 歸經 (meridians): 歸經信息

輸出 enriched_mmid_herbs.json，可直接合併入現有 herb 數據庫。
"""
import json
import os
import re
import sys
import time

BASEDIR = os.path.dirname(os.path.abspath(__file__))
FULL_DATA_PATH = os.path.join(BASEDIR, "mmid_full_data.json")
OUTPUT_PATH = os.path.join(BASEDIR, "enriched_mmid_herbs.json")

# 性味到英文字段映射
NATURE_MAP = {
    "寒": "cold", "熱": "hot", "溫": "warm", "涼": "cool",
    "平": "neutral", "微寒": "slightly_cold", "微溫": "slightly_warm",
    "微涼": "slightly_cool", "大熱": "very_hot", "大寒": "very_cold",
}

FLAVOR_MAP = {
    "辛": "pungent", "甘": "sweet", "苦": "bitter", "酸": "sour",
    "鹹": "salty", "淡": "bland", "澀": "astringent", "甜": "sweet",
    "微辛": "slightly_pungent", "微甘": "slightly_sweet",
    "微苦": "slightly_bitter",
}

MERIDIAN_KEYWORDS = [
    "心", "肺", "脾", "胃", "肝", "膽", "腎", "大腸", "小腸",
    "膀胱", "三焦", "心包", "任脈", "督脈",
]


def parse_nature_flavor(text: str) -> dict:
    """解析性味文本，返回 {nature, flavor, toxicity}"""
    result = {"nature": None, "flavor": [], "toxicity": None}
    if not text:
        return result

    for cn_val, en_val in NATURE_MAP.items():
        if cn_val in text:
            result["nature"] = en_val
            break

    for cn_val, en_val in FLAVOR_MAP.items():
        if cn_val in text:
            result["flavor"].append(en_val)

    toxicity_patterns = {
        "有毒": "toxic",
        "有小毒": "slightly_toxic",
        "有大毒": "very_toxic",
    }
    for cn_val, en_val in toxicity_patterns.items():
        if cn_val in text:
            result["toxicity"] = en_val
            break

    return result


def extract_meridians(full_text: str) -> list:
    """從功效文本中提取歸經信息"""
    meridians = []
    for m in MERIDIAN_KEYWORDS:
        if m in full_text:
            meridians.append(m)
    return list(set(meridians))


def fetch_detail(pid: str) -> dict | None:
    """抓取單個藥材的詳細頁面，返回提取的字段"""
    url = f"https://sys01.lib.hkbu.edu.hk/cmed/mmid/detail.php?lang=cht&pid={pid}"
    try:
        import urllib.request
        req = urllib.request.Request(
            url,
            headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
        )
        resp = urllib.request.urlopen(req, timeout=15)
        raw = resp.read()

        # 頁面實際使用 UTF-8 編碼（已驗證）
        html = raw.decode("utf-8")

        # 使用正則表達式提取 table#info 的內容
        match = re.search(r'id=["\']info["\'][^>]*>(.*?)</table>', html, re.DOTALL)
        if not match:
            return None

        table_html = match.group(1)

        # 提取所有 <td> 單元格
        cells = re.findall(r'<td[^>]*>(.*?)</td>', table_html, re.DOTALL)

        # 剝離 HTML 標籤，得到純文本
        stripped = []
        for c in cells:
            text = re.sub(r'<[^>]+>', '', c).strip().replace('\t', '').replace('\r', '')
            if text:
                stripped.append(text)

        if not stripped:
            return None

        # 交替配對：標籤、值、標籤、值...
        fields = {}
        for i in range(0, len(stripped) - 1, 2):
            label = stripped[i].strip("【】[]")
            value = stripped[i + 1].strip()
            if label and value:
                fields[label] = value

        if not fields:
            return None

        result = {}

        # 性味
        xf_text = fields.get("性味", "")
        result["nature_flavor_raw"] = xf_text
        nf = parse_nature_flavor(xf_text)
        result["nature"] = nf["nature"]
        result["flavor"] = nf["flavor"]
        result["toxicity"] = nf["toxicity"]

        # 功效
        result["efficacy"] = fields.get("功效", "")

        # 產地
        result["origin"] = fields.get("產地", "")

        # 炮製（頁面用「炮品」或「炙品」）
        result["processing"] = fields.get("炮品", fields.get("炙品", ""))

        # 來源（植物學信息）
        result["botanical_source"] = fields.get("來源", "")

        # 性狀
        result["characteristics"] = fields.get("性狀", "")

        # 品質
        result["quality"] = fields.get("品質", "")

        # 註解
        result["notes"] = fields.get("註解", "")

        # 分類（植物部位）
        result["botanical_class"] = fields.get("類別", "")

        # 嘗試從功效文本中提取歸經
        efficacy_text = result["efficacy"]
        result["meridians"] = extract_meridians(efficacy_text)

        return result

    except Exception as e:
        print(f"  [ERROR] pid={pid}: {e}", file=sys.stderr)
        return None


def main():
    if not os.path.exists(FULL_DATA_PATH):
        print(f"錯誤: 找不到 {FULL_DATA_PATH}")
        sys.exit(1)

    with open(FULL_DATA_PATH, "r", encoding="utf-8") as f:
        basic_herbs = json.load(f)

    print(f"Loaded {len(basic_herbs)} basic herbs from MMID")

    enriched = []
    failed = []

    for i, herb in enumerate(basic_herbs):
        pid = herb.get("pid", "")
        if not pid:
            failed.append(herb["cn"])
            continue

        print(f"[{i+1}/{len(basic_herbs)}] Fetching {herb['cn']} (pid={pid})...")
        detail = fetch_detail(pid)

        if detail:
            merged = {
                "pid": pid,
                "name_cn": herb["cn"],
                "name_latin": herb.get("latin", ""),
                "name_pinyin": herb.get("pinyin", ""),
                "name_eng": herb.get("eng", ""),
                "category": herb.get("type", ""),
                "nature": detail.get("nature"),
                "flavor": detail.get("flavor", []),
                "toxicity": detail.get("toxicity"),
                "nature_flavor_raw": detail.get("nature_flavor_raw", ""),
                "efficacy": detail.get("efficacy", ""),
                "origin": detail.get("origin", ""),
                "processing": detail.get("processing", ""),
                "botanical_source": detail.get("botanical_source", ""),
                "characteristics": detail.get("characteristics", ""),
                "quality": detail.get("quality", ""),
                "notes": detail.get("notes", ""),
                "botanical_class": detail.get("botanical_class", ""),
                "meridians": detail.get("meridians", []),
            }
            enriched.append(merged)
        else:
            failed.append(herb["cn"])

        if (i + 1) % 20 == 0:
            print(f"  Progress: {i+1}/{len(basic_herbs)}, OK: {len(enriched)}, Fail: {len(failed)}")
            time.sleep(2)
        elif i < len(basic_herbs) - 1:
            time.sleep(0.3)

    result = {
        "total": len(basic_herbs),
        "enriched": len(enriched),
        "failed": len(failed),
        "herbs": enriched,
        "failures": failed,
    }

    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    print(f"\n{'='*50}")
    print(f"Done! Total: {result['total']}, Success: {result['enriched']}, Failed: {result['failed']}")
    if failed:
        print(f"Failed herbs: {failed[:20]}...")

    # 統計
    nature_counts = {}
    flavor_counts = {}
    toxicity_counts = {}
    efficacy_count = 0
    origin_count = 0
    processing_count = 0
    meridian_count = 0
    nature_raw_count = 0
    source_count = 0
    for h in enriched:
        n = h.get("nature")
        if n:
            nature_counts[n] = nature_counts.get(n, 0) + 1
        for f in h.get("flavor", []):
            flavor_counts[f] = flavor_counts.get(f, 0) + 1
        t = h.get("toxicity")
        if t:
            toxicity_counts[t] = toxicity_counts.get(t, 0) + 1
        if h.get("efficacy"):
            efficacy_count += 1
        if h.get("origin"):
            origin_count += 1
        if h.get("processing"):
            processing_count += 1
        if h.get("meridians") and len(h["meridians"]) > 0:
            meridian_count += 1
        if h.get("nature_flavor_raw"):
            nature_raw_count += 1
        if h.get("botanical_source"):
            source_count += 1

    print("\n四氣分佈:")
    for k, v in sorted(nature_counts.items(), key=lambda x: -x[1]):
        print(f"  {k}: {v}")

    print("\n五味分佈 (Top 10):")
    for k, v in sorted(flavor_counts.items(), key=lambda x: -x[1])[:10]:
        print(f"  {k}: {v}")

    if toxicity_counts:
        print("\n毒性分佈:")
        for k, v in sorted(toxicity_counts.items(), key=lambda x: -x[1]):
            print(f"  {k}: {v}")

    print("\n字段覆蓋率:")
    print(f"  性味原文: {nature_raw_count}/{result['enriched']}")
    print(f"  功效: {efficacy_count}/{result['enriched']}")
    print(f"  產地: {origin_count}/{result['enriched']}")
    print(f"  炮製: {processing_count}/{result['enriched']}")
    print(f"  植物來源: {source_count}/{result['enriched']}")
    print(f"  歸經: {meridian_count}/{result['enriched']}")

    # 顯示樣本
    if enriched:
        h = enriched[0]
        print(f"\nSample: {h['name_cn']}")
        print(f"  nature: {h.get('nature')}")
        print(f"  flavor: {h.get('flavor')}")
        print(f"  efficacy: {str(h.get('efficacy', ''))[:100]}")
        print(f"  origin: {h.get('origin')}")
        print(f"  processing: {str(h.get('processing', ''))[:100]}")
        print(f"  botanical_source: {str(h.get('botanical_source', ''))[:100]}")


if __name__ == "__main__":
    main()
