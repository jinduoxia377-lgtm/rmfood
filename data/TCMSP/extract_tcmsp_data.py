#!/usr/bin/env python3
"""
TCMSP-E 数据提取脚本 v3
从 https://tcmsp-e.com/browse.php 提取完整中药系统药理学数据库

输出文件:
  tcmsp_herbs.json/csv       - 中药材列表 (502条)
  tcmsp_ingredients.json/csv - 化学成分/分子数据 (13729条)
  tcmsp_targets.json/csv     - 药物靶点列表 (3339条)
  tcmsp_diseases.json/csv    - 疾病列表 (867条)
"""
import re, json, csv, urllib.request

BASE_URL = "https://tcmsp-e.com"
HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
OUTPUT_DIR = "E:/TCMSP"


def fetch_html(qc):
    url = f"{BASE_URL}/browse.php?qc={qc}&page=1&rp=10000"
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=60) as resp:
        return resp.read().decode("utf-8", errors="ignore")


def extract_json_objects(html, marker_key, marker_pattern):
    pattern = re.compile(rf'("{marker_key}":"((?:[^"\\]|\\.)*)")')
    marker_positions = [(m.start(), m.group(2)) for m in pattern.finditer(html)]
    records = []
    for pos, marker_value in marker_positions:
        if not re.search(marker_pattern, marker_value):
            continue
        start = pos
        while start > 0 and html[start] != '{':
            start -= 1
        if html[start] != '{':
            continue
        obj_start = start
        depth = 0
        end = obj_start
        in_string = False
        escape = False
        for i in range(obj_start, len(html)):
            c = html[i]
            if escape:
                escape = False
                continue
            if c == '\\':
                escape = True
                continue
            if c == '"':
                in_string = not in_string
                continue
            if in_string:
                continue
            if c == '{':
                depth += 1
            elif c == '}':
                depth -= 1
                if depth == 0:
                    end = i
                    break
        obj_str = html[obj_start:end + 1]
        try:
            records.append(json.loads(obj_str))
        except json.JSONDecodeError:
            continue
    seen = set()
    deduped = []
    for obj in records:
        key = str(obj)
        if key not in seen:
            seen.add(key)
            deduped.append(obj)
    return deduped


def save_json(data, filename):
    with open(f"{OUTPUT_DIR}/{filename}", "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def save_csv(data, filename):
    with open(f"{OUTPUT_DIR}/{filename}", "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=data[0].keys())
        w.writeheader()
        w.writerows(data)


def main():
    print("=" * 50)
    print("TCMSP-E Data Extraction v3")
    print("=" * 50)

    # Ingredients
    print("\n[1/4] Ingredients (molecules)...")
    ing_html = fetch_html("ingredients")
    ingredients = extract_json_objects(ing_html, "MOL_ID", r"MOL\d+")
    ingredients = [i for i in ingredients if "molecule_name" in i]
    save_json(ingredients, "tcmsp_ingredients.json")
    save_csv(ingredients, "tcspd_ingredients.csv")
    print(f"  Extracted: {len(ingredients)} molecules")

    # Herbs
    print("\n[2/4] Herbs...")
    herb_html = fetch_html("herbs")
    herbs = extract_json_objects(herb_html, "herb_cn_name", r".+")
    herbs = [h for h in herbs if "herb_en_name" in h]
    save_json(herbs, "tcmsp_herbs.json")
    save_csv(herbs, "tcmsp_herbs.csv")
    print(f"  Extracted: {len(herbs)} herbs")

    # Targets
    print("\n[3/4] Targets...")
    tar_html = fetch_html("targets")
    targets = extract_json_objects(tar_html, "TAR_ID", r"TAR\d+")
    targets = [t for t in targets if "target_name" in t]
    save_json(targets, "tcmsp_targets.json")
    save_csv(targets, "tcmsp_targets.csv")
    print(f"  Extracted: {len(targets)} targets")

    # Diseases
    print("\n[4/4] Diseases...")
    dis_html = fetch_html("diseases")
    diseases = extract_json_objects(dis_html, "DIS_ID", r"DIS\d+")
    diseases = [d for d in diseases if "disease_name" in d]
    save_json(diseases, "tcmsp_diseases.json")
    save_csv(diseases, "tcmsp_diseases.csv")
    print(f"  Extracted: {len(diseases)} diseases")

    print("\n" + "=" * 50)
    print("COMPLETE")
    print(f"  Herbs: {len(herbs)}")
    print(f"  Ingredients: {len(ingredients)}")
    print(f"  Targets: {len(targets)}")
    print(f"  Diseases: {len(diseases)}")
    print("=" * 50)


if __name__ == "__main__":
    main()
