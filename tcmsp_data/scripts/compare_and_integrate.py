"""
TCMSP-E 数据与数据库数据双向比对脚本
三级匹配：精确匹配 → 模糊匹配 → 未匹配
生成结构化对比报告 comparison_report.json
"""

import json
import re
import time
from datetime import datetime, timezone
from difflib import SequenceMatcher

# ======================== 文件路径配置 ========================
TCMSPE_PATH = r"d:\RMFOOD配方平台\tcmsp_data\tcmspe_browse_list.json"
DB_PATH = r"d:\RMFOOD配方平台\tcmsp_data\db_herbs_export.json"
REPORT_PATH = r"d:\RMFOOD配方平台\tcmsp_data\comparison_report.json"

FUZZY_THRESHOLD = 0.80  # 模糊匹配阈值


# ======================== 工具函数 ========================

def normalize_latin_name(name: str) -> str:
    """拉丁学名归一化：转小写、去多余空格、去标点差异"""
    if not name:
        return ""
    name = name.strip().lower()
    # 统一连字符与空格
    name = re.sub(r"[\s\-]+", " ", name)
    # 去除首尾标点
    name = name.strip(" .,-")
    return name


def similarity(a: str, b: str) -> float:
    """计算两个字符串的相似度（SequenceMatcher ratio）"""
    if not a or not b:
        return 0.0
    return SequenceMatcher(None, a.strip(), b.strip()).ratio()


def load_json(path: str) -> dict:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


# ======================== 三级匹配核心逻辑 ========================

def perform_matching(tcmspe_herbs: list, db_herbs: list) -> dict:
    """
    对 TCMSP-E 的每条记录，在 DB 中查找匹配项
    返回分类结果字典
    """
    matched = []       # Level 1 精确匹配
    fuzzy_matched = [] # Level 2 模糊匹配
    missing = []       # Level 3 未匹配

    # 预处理 DB 数据，建立索引加速查找
    db_by_cn = {}
    db_by_latin = {}
    for db_item in db_herbs:
        cn_key = db_item.get("name_cn", "").strip()
        latin_key = normalize_latin_name(db_item.get("name_latin", ""))
        if cn_key:
            db_by_cn[cn_key] = db_item
        if latin_key:
            db_by_latin[latin_key] = db_item

    db_matched_ids = set()  # 记录已被精确匹配的 DB id

    for tcmspe in tcmspe_herbs:
        tcmspe_cn = tcmspe.get("name_cn", "").strip()
        tcmspe_latin_raw = tcmspe.get("name_latin", "")
        tcmspe_latin_norm = normalize_latin_name(tcmspe_latin_raw)

        # ---- Level 1: 精确匹配 ----
        db_match = None
        match_method = None

        # 1a) name_cn 精确匹配
        if tcmspe_cn and tcmspe_cn in db_by_cn:
            candidate = db_by_cn[tcmspe_cn]
            if candidate["id"] not in db_matched_ids:
                db_match = candidate
                match_method = "name_cn_exact"
                db_matched_ids.add(candidate["id"])

        # 1b) name_latin 归一化后精确匹配
        if db_match is None and tcmspe_latin_norm and tcmspe_latin_norm in db_by_latin:
            candidate = db_by_latin[tcmspe_latin_norm]
            if candidate["id"] not in db_matched_ids:
                db_match = candidate
                match_method = "name_latin_exact"
                db_matched_ids.add(candidate["id"])

        if db_match is not None:
            matched.append({
                "tcmspe": tcmspe,
                "db": db_match,
                "method": match_method,
            })
            continue

        # ---- Level 2: 模糊匹配 ----
        best_score = 0
        best_db = None
        best_field = None
        best_reason = ""

        for db_item in db_herbs:
            if db_item["id"] in db_matched_ids:
                continue

            db_cn = db_item.get("name_cn", "").strip()
            db_latin_norm = normalize_latin_name(db_item.get("name_latin", ""))

            # 计算 name_cn 相似度
            cn_score = similarity(tcmspe_cn, db_cn) if tcmspe_cn and db_cn else 0
            # 计算 name_latin 相似度
            latin_score = similarity(tcmspe_latin_norm, db_latin_norm) if tcmspe_latin_norm and db_latin_norm else 0

            current_best = max(cn_score, latin_score)
            if current_best > best_score and current_best > FUZZY_THRESHOLD:
                best_score = current_best
                best_db = db_item
                if cn_score >= latin_score:
                    best_field = "name_cn"
                    best_reason = (
                        f"name_cn 相似度 {cn_score:.2%}: "
                        f"TCMSP-E='{tcmspe_cn}' vs DB='{db_cn}'"
                    )
                else:
                    best_field = "name_latin"
                    best_reason = (
                        f"name_latin 相似度 {latin_score:.2%}: "
                        f"TCMSP-E='{tcmspe_latin_raw}' vs DB='{db_item.get('name_latin', '')}'"
                    )

        if best_db is not None:
            fuzzy_matched.append({
                "tcmspe": tcmspe,
                "db": best_db,
                "score": round(best_score, 4),
                "field": best_field,
                "reason": best_reason,
            })
            db_matched_ids.add(best_db["id"])
            continue

        # ---- Level 3: 未匹配 ----
        missing.append({
            "tcmspe": tcmspe,
            "detail_url": tcmspe.get("detail_url", ""),
            "tcmsp_token": tcmspe.get("tcmsp_token", ""),
        })

    return {
        "matched": matched,
        "fuzzy_matched": fuzzy_matched,
        "missing": missing,
    }


# ======================== 分类一致性检查 ========================

def check_category_consistency(matched_results: list, fuzzy_results: list) -> dict:
    """
    对已匹配（含精确+模糊）条目，比较 category 字段是否一致
    TCMSP-E: category_cn   vs   DB: category
    """
    consistent = 0
    inconsistent_details = []

    all_matched = matched_results + fuzzy_results

    for item in all_matched:
        tcmspe_cat = item["tcmspe"].get("category_cn", "").strip()
        db_cat = item["db"].get("category", "").strip()

        if tcmspe_cat == db_cat:
            consistent += 1
        else:
            inconsistent_details.append({
                "name_cn_tcmspe": item["tcmspe"].get("name_cn", ""),
                "name_cn_db": item["db"].get("name_cn", ""),
                "category_tcmspe": tcmspe_cat,
                "category_db": db_cat,
                "match_type": item.get("method", "fuzzy"),
            })

    return {
        "consistent": consistent,
        "inconsistent": len(inconsistent_details),
        "details": inconsistent_details,
    }


# ======================== 字段审计 ========================

def audit_fields(matched_results: list, fuzzy_results: list) -> dict:
    """
    对已匹配的 DB 记录，审计各字段非空率及异常值检测
    """
    all_matched = matched_results + fuzzy_results
    total = len(all_matched)

    effects_nonempty = 0
    compounds_nonempty = 0
    targets_nonempty = 0
    diseases_nonempty = 0

    ob_anomalies = []
    dl_anomalies = []

    for item in all_matched:
        db = item["db"]

        # 非空统计
        if db.get("effects") and str(db["effects"]).strip():
            effects_nonempty += 1
        if db.get("compounds") and len(db["compounds"]) > 0:
            compounds_nonempty += 1
        if db.get("targets") and len(db["targets"]) > 0:
            targets_nonempty += 1
        if db.get("diseases") and len(db["diseases"]) > 0:
            diseases_nonempty += 1

        # OB 异常检测：正常范围 [0, 100]，超出视为异常
        ob_val = db.get("ob_percent")
        if ob_val is not None:
            try:
                ob_float = float(ob_val)
                if ob_float < 0 or ob_float > 100:
                    ob_anomalies.append({
                        "name_cn": db.get("name_cn", ""),
                        "ob_percent": ob_float,
                        "reason": "OB 百分比超出 [0, 100] 范围",
                    })
            except (TypeError, ValueError):
                ob_anomalies.append({
                    "name_cn": db.get("name_cn", ""),
                    "ob_percent": ob_val,
                    "reason": "OB 值非数值类型",
                })

        # DL 异常检测：正常范围 [0, 1]，超出视为异常
        dl_val = db.get("dl_value")
        if dl_val is not None:
            try:
                dl_float = float(dl_val)
                if dl_float < 0 or dl_float > 1:
                    dl_anomalies.append({
                        "name_cn": db.get("name_cn", ""),
                        "dl_value": dl_float,
                        "reason": "DL 值超出 [0, 1] 范围",
                    })
            except (TypeError, ValueError):
                dl_anomalies.append({
                    "name_cn": db.get("name_cn", ""),
                    "dl_value": dl_val,
                    "reason": "DL 值非数值类型",
                })

    def pct(n):
        return f"{n / total * 100:.1f}%" if total > 0 else "N/A"

    return {
        "effects_nonempty_pct": pct(effects_nonempty),
        "compounds_nonempty_pct": pct(compounds_nonempty),
        "targets_nonempty_pct": pct(targets_nonempty),
        "diseases_nonempty_pct": pct(diseases_nonempty),
        "ob_anomalies": ob_anomalies,
        "dl_anomalies": dl_anomalies,
    }


# ======================== 主流程 ========================

def main():
    print("=" * 60)
    print("  TCMSP-E ↔ 数据库 双向比对分析工具")
    print("=" * 60)

    # 1. 加载数据
    print("\n[1/5] 加载数据文件...")
    tcmspe_data = load_json(TCMSPE_PATH)
    db_data = load_json(DB_PATH)

    tcmspe_herbs = tcmspe_data.get("herbs", [])
    db_herbs = db_data.get("herbs", [])

    tcmspe_total = len(tcmspe_herbs)
    db_total = len(db_herbs)
    print(f"  TCMSP-E 数据: {tcmspe_total} 条")
    print(f"  数据库数据:   {db_total} 条")

    # 2. 执行三级匹配
    print("\n[2/5] 执行三级匹配算法...")
    t_start = time.time()
    results = perform_matching(tcmspe_herbs, db_herbs)
    elapsed = time.time() - t_start

    matched = results["matched"]
    fuzzy_matched = results["fuzzy_matched"]
    missing = results["missing"]

    print(f"  耗时: {elapsed:.3f}s")
    print(f"  ✅ 精确匹配 (Level 1): {len(matched)} 条")
    print(f"  ⚠️  模糊匹配 (Level 2): {len(fuzzy_matched)} 条")
    print(f"  ❌ 未匹配   (Level 3): {len(missing)} 条")

    # 3. 分类一致性检查
    print("\n[3/5] 检查分类字段一致性...")
    cat_result = check_category_consistency(matched, fuzzy_matched)
    total_matched_for_cat = cat_result["consistent"] + cat_result["inconsistent"]
    print(f"  一致: {cat_result['consistent']} / 不一致: {cat_result['inconsistent']}")

    # 4. 字段审计
    print("\n[4/5] 审计数据库字段完整性...")
    field_audit = audit_fields(matched, fuzzy_matched)
    print(f"  effects 非空率:  {field_audit['effects_nonempty_pct']}")
    print(f"  compounds 非空率: {field_audit['compounds_nonempty_pct']}")
    print(f"  targets 非空率:  {field_audit['targets_nonempty_pct']}")
    print(f"  diseases 非空率: {field_audit['diseases_nonempty_pct']}")
    print(f"  OB 异常数:       {len(field_audit['ob_anomalies'])}")
    print(f"  DL 异常数:       {len(field_audit['dl_anomalies'])}")

    # 5. 构建并保存报告
    print("\n[5/5] 生成对比报告...")

    # 构建模糊匹配详情列表（精简版）
    fuzzy_details = []
    for fm in fuzzy_matched:
        fuzzy_details.append({
            "name_cn_tcmspe": fm["tcmspe"].get("name_cn", ""),
            "name_cn_db": fm["db"].get("name_cn", ""),
            "score": fm["score"],
            "field": fm["field"],
            "reason": fm["reason"],
        })

    # 构建未匹配药材完整信息
    missing_herbs = []
    for m in missing:
        missing_herbs.append({
            "name_cn": m["tcmspe"].get("name_cn", ""),
            "name_pinyin": m["tcmspe"].get("name_pinyin", ""),
            "name_latin": m["tcmspe"].get("name_latin", ""),
            "category_cn": m["tcmspe"].get("category_cn", ""),
            "detail_url": m["detail_url"],
            "tcmsp_token": m["tcmsp_token"],
        })

    report = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "summary": {
            "tcmspe_total": tcmspe_total,
            "db_total": db_total,
            "matched": {
                "count": len(matched),
                "pct": f"{len(matched) / tcmspe_total * 100:.1f}%" if tcmspe_total > 0 else "N/A",
            },
            "fuzzy_matched": {
                "count": len(fuzzy_matched),
                "pct": f"{len(fuzzy_matched) / tcmspe_total * 100:.1f}%" if tcmspe_total > 0 else "N/A",
                "details": fuzzy_details,
            },
            "missing": {
                "count": len(missing),
                "pct": f"{len(missing) / tcmspe_total * 100:.1f}%" if tcmspe_total > 0 else "N/A",
                "herbs": missing_herbs,
            },
        },
        "category_comparison": cat_result,
        "field_audit": field_audit,
    }

    with open(REPORT_PATH, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    print(f"  报告已保存: {REPORT_PATH}")

    # ===== 打印最终统计摘要 =====
    print("\n" + "=" * 60)
    print("  📊 比对结果摘要")
    print("=" * 60)
    print(f"  TCMSP-E 总数:     {tcmspe_total}")
    print(f"  数据库总数:       {db_total}")
    print(f"  ─────────────────────────────────────")
    print(f"  ✅ 精确匹配:      {len(matched):>4} 条 ({len(matched)/tcmspe_total*100:>5.1f}%)")
    print(f"  ⚠️  模糊匹配:      {len(fuzzy_matched):>4} 条 ({len(fuzzy_matched)/tcmspe_total*100:>5.1f}%)")
    print(f"  ❌ 未匹配:        {len(missing):>4} 条 ({len(missing)/tcmspe_total*100:>5.1f}%)")
    print(f"  ─────────────────────────────────────")
    print(f"  分类一致:         {cat_result['consistent']:>4} 条")
    print(f"  分类不一致:       {cat_result['inconsistent']:>4} 条")
    print(f"  ─────────────────────────────────────")
    print(f"  effects 非空率:   {field_audit['effects_nonempty_pct']}")
    print(f"  compounds 非空率:  {field_audit['compounds_nonempty_pct']}")
    print(f"  targets 非空率:   {field_audit['targets_nonempty_pct']}")
    print(f"  diseases 非空率:  {field_audit['diseases_nonempty_pct']}")
    print(f"  OB 异常值:        {len(field_audit['ob_anomalies']):>4} 个")
    print(f"  DL 异常值:        {len(field_audit['dl_anomalies']):>4} 个")

    if missing:
        print(f"\n  ⚠️  未匹配药材清单（需补全）:")
        for m in missing:
            print(f"    - {m['tcmspe'].get('name_cn', '')} | URL: {m['detail_url'][:60]}...")

    if fuzzy_matched:
        print(f"\n  ⚠️  模糊匹配详情:")
        for fm in fuzzy_matched:
            print(f"    - TCMSP-E: '{fm['tcmspe'].get('name_cn', '')}' ↔ DB: '{fm['db'].get('name_cn', '')}' "
                  f"| 分数={fm['score']:.2%} | {fm['reason']}")

    print("\n✅ 比对完成！")


if __name__ == "__main__":
    main()
