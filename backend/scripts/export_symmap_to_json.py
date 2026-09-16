"""
SymMap Excel 数据导出与分析脚本
"""
import openpyxl
import json
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')

SYMMap_DIR = 'D:/RMFOODFP/data/SymMap'

def read_xlsx(sheet_path):
    """读取Excel文件，返回(headers, rows)"""
    wb = openpyxl.load_workbook(sheet_path, read_only=True, data_only=True)
    ws = wb.active
    rows = list(ws.iter_rows(values_only=True))
    wb.close()
    if not rows:
        return [], []
    headers = rows[0]
    data_rows = rows[1:]
    return headers, data_rows

def main():
    # 1. 导出SMHB药材数据
    print("=" * 60)
    print("  SymMap 数据导出")
    print("=" * 60)

    # SMHB - 药材
    path = os.path.join(SYMMap_DIR, 'SymMap v2.0, SMHB file.xlsx')
    headers, rows = read_xlsx(path)
    active = [r for r in rows if r[-1] != 1]
    herbs = []
    for r in active:
        herb = {}
        for i, h in enumerate(headers):
            if h and r[i] is not None:
                herb[h] = r[i]
        herbs.append(herb)

    out_path = os.path.join(SYMMap_DIR, 'symmap_herbs.json')
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(herbs, f, ensure_ascii=False, indent=2)
    print(f"[SMHB] 药材: {len(herbs)} 条 -> {out_path}")

    # 字段覆盖率
    field_counts = {}
    for h in herbs:
        for k, v in h.items():
            field_counts[k] = field_counts.get(k, 0) + (1 if v else 0)
    print("  字段覆盖率:")
    for k, v in sorted(field_counts.items(), key=lambda x: -x[1]):
        pct = v * 100 // len(herbs)
        print(f"    {k}: {v}/{len(herbs)} ({pct}%)")

    # 2. 导出SMIT化合物数据
    path = os.path.join(SYMMap_DIR, 'SymMap v2.0, SMIT file.xlsx')
    headers, rows = read_xlsx(path)
    active = [r for r in rows if r[-1] != 1]
    ingredients = []
    for r in active:
        item = {}
        for i, h in enumerate(headers):
            if h and r[i] is not None:
                item[h] = r[i]
        ingredients.append(item)

    out_path = os.path.join(SYMMap_DIR, 'symmap_ingredients.json')
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(ingredients, f, ensure_ascii=False, indent=2)
    print(f"\n[SMIT] 化合物: {len(ingredients)} 条 -> {out_path}")

    # 3. 导出SMTT靶点数据
    path = os.path.join(SYMMap_DIR, 'SymMap v2.0, SMTT file.xlsx')
    headers, rows = read_xlsx(path)
    active = [r for r in rows if r[-1] != 1]
    targets = []
    for r in active:
        item = {}
        for i, h in enumerate(headers):
            if h and r[i] is not None:
                item[h] = r[i]
        targets.append(item)

    out_path = os.path.join(SYMMap_DIR, 'symmap_targets.json')
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(targets, f, ensure_ascii=False, indent=2)
    print(f"[SMTT] 靶点: {len(targets)} 条 -> {out_path}")

    # 4. 导出SMDE疾病数据
    path = os.path.join(SYMMap_DIR, 'SymMap v2.0, SMDE file.xlsx')
    headers, rows = read_xlsx(path)
    active = [r for r in rows if r[-1] != 1]
    diseases = []
    for r in active:
        item = {}
        for i, h in enumerate(headers):
            if h and r[i] is not None:
                item[h] = r[i]
        diseases.append(item)

    out_path = os.path.join(SYMMap_DIR, 'symmap_diseases.json')
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(diseases, f, ensure_ascii=False, indent=2)
    print(f"[SMDE] 疾病: {len(diseases)} 条 -> {out_path}")

    # 5. 导出SMSY证候数据
    path = os.path.join(SYMMap_DIR, 'SymMap v2.0, SMSY file.xlsx')
    headers, rows = read_xlsx(path)
    active = [r for r in rows if r[-1] != 1]
    syndromes = []
    for r in active:
        item = {}
        for i, h in enumerate(headers):
            if h and r[i] is not None:
                item[h] = r[i]
        syndromes.append(item)

    out_path = os.path.join(SYMMap_DIR, 'symmap_syndromes.json')
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(syndromes, f, ensure_ascii=False, indent=2)
    print(f"[SMSY] 证候: {len(syndromes)} 条 -> {out_path}")

    # 6. 导出SMTS症状数据
    path = os.path.join(SYMMap_DIR, 'SymMap v2.0, SMTS file.xlsx')
    headers, rows = read_xlsx(path)
    active = [r for r in rows if r[-1] != 1]
    symptoms = []
    for r in active:
        item = {}
        for i, h in enumerate(headers):
            if h and r[i] is not None:
                item[h] = r[i]
        symptoms.append(item)

    out_path = os.path.join(SYMMap_DIR, 'symmap_symptoms.json')
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(symptoms, f, ensure_ascii=False, indent=2)
    print(f"[SMTS] 症状: {len(symptoms)} 条 -> {out_path}")

    # 7. 导出SMMS症状数据
    path = os.path.join(SYMMap_DIR, 'SymMap v2.0, SMMS file.xlsx')
    headers, rows = read_xlsx(path)
    active = [r for r in rows if r[-1] != 1]
    mm_symptoms = []
    for r in active:
        item = {}
        for i, h in enumerate(headers):
            if h and r[i] is not None:
                item[h] = r[i]
        mm_symptoms.append(item)

    out_path = os.path.join(SYMMap_DIR, 'symmap_mm_symptoms.json')
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(mm_symptoms, f, ensure_ascii=False, indent=2)
    print(f"[SMMS] 症状: {len(mm_symptoms)} 条 -> {out_path}")

    print(f"\n{'=' * 60}")
    print(f"  导出完成！共 7 个JSON文件")
    print(f"{'=' * 60}")

if __name__ == '__main__':
    main()
