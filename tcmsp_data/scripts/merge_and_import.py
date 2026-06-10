"""
合并所有 TCMSP 爬取批次数据 → 导入 PostgreSQL
================================================
合并 batch_01_02.json + batch_03~50.json → tcmsp_herbs_full.json
然后调用 import_to_pg.py 完成导入
"""

import json
import os
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent

def merge_all_batches():
    """合并所有批次JSON文件为一个完整数组"""
    all_data = []
    source_files = []
    
    # 1. 浏览器爬取的前25条 (batch_01_02)
    f1 = SCRIPT_DIR / "batch_01_02.json"
    if f1.exists():
        with open(f1, "r", encoding="utf-8") as fp:
            raw = fp.read().strip()
            # 可能是双重JSON字符串 (evaluate_script filePath输出格式)
            data = json.loads(raw) if raw.startswith("[") or raw.startswith("{") else json.loads(json.loads(raw))
            records = data if isinstance(data, list) else data.get("data", [])
            all_data.extend(records)
            source_files.append((f1.name, len(records)))
            print(f"  ✅ {f1.name}: {len(records)} 条")
    
    # 2. 子代理爬取的 batch_03 ~ batch_50
    for i in range(3, 51):
        fname = f"batch_{i:02d}.json"
        fpath = SCRIPT_DIR / fname
        if fpath.exists():
            with open(fpath, "r", encoding="utf-8") as fp:
                data = json.load(fp)
                records = data if isinstance(data, list) else data.get("data", [])
                all_data.extend(records)
                source_files.append((fname, len(records)))
                print(f"  ✅ {fname}: {len(records)} 条")
    
    # 去重 (基于 name_latin)
    seen = set()
    unique = []
    dup_count = 0
    for item in all_data:
        key = item.get("name_latin", "") or item.get("name_cn", "")
        if key in seen:
            dup_count += 1
            continue
        seen.add(key)
        unique.append(item)
    
    print(f"\n{'='*55}")
    print(f"合并结果:")
    print(f"  源文件数:   {len(source_files)}")
    print(f"  原始总数:   {len(all_data)}")
    print(f"  去重后:     {len(unique)} (去除{dup_count}重复)")
    
    # 统计
    with_compounds = sum(1 for r in unique if r.get("compound_count", 0) > 0)
    with_ob = sum(1 for r in unique if r.get("ob_percent") is not None)
    with_dl = sum(1 for r in unique if r.get("dl_value") is not None)
    errors = sum(1 for r in unique if r.get("error"))
    
    print(f"  有化合物:   {with_compounds}/{len(unique)}")
    print(f"  有OB%值:   {with_ob}/{len(unique)}")
    print(f"  有DL值:    {with_dl}/{len(unique)}")
    print(f"  含错误:    {errors}")
    print(f"{'='*55}\n")
    
    # 构建最终输出
    output = {
        "success": True,
        "total": len(unique),
        "source_files": source_files,
        "stats": {
            "with_compounds": with_compounds,
            "with_ob": with_ob,
            "with_dl": with_dl,
            "errors": errors,
            "duplicates_removed": dup_count,
        },
        "scraped_at_merged": __import__("datetime").datetime.now().isoformat(),
        "data": unique,
    }
    
    # 保存合并文件
    output_path = SCRIPT_DIR / "tcmsp_herbs_full.json"
    with open(output_path, "w", encoding="utf-8") as fp:
        json.dump(output, fp, ensure_ascii=False, indent=2)
    
    print(f"📁 合并文件已保存: {output_path}")
    print(f"   文件大小: {os.path.getsize(output_path) / 1024 / 1024:.2f} MB")
    
    return output_path


if __name__ == "__main__":
    merged_file = merge_all_batches()
    print(f"\n✅ 合并完成! 输出文件: {merged_file}")
    print(f"\n下一步: python import_to_pg.py --input {merged_file}")
