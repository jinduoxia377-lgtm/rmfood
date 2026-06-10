"""
TCMSP 中药材数据完整审计与抽样复核脚本
对 500 条 tcm_herbs 记录执行全面质量审计
"""

import json
import random
from datetime import datetime

import psycopg2
from psycopg2.extras import RealDictCursor

# ── 数据库连接配置 ──
DB_CONFIG = {
    "host": "localhost",
    "port": 5432,
    "dbname": "rmfood_platform",
    "user": "postgres",
}

REPORT_PATH = r"d:\RMFOOD配方平台\tcmsp_data\final_audit_report.json"


def get_connection():
    return psycopg2.connect(**DB_CONFIG)


def audit_field_coverage(cur):
    """字段覆盖率审计：统计每个关键字段的非空率和数据质量"""
    print("\n" + "=" * 60)
    print("  [1/4] 字段覆盖率审计")
    print("=" * 60)

    cur.execute("""
        SELECT
          COUNT(*) as total,
          COUNT(name_cn) as name_cn_filled,
          COUNT(name_latin) as name_latin_filled,
          COUNT(category) as category_filled,
          COUNT(effects) as effects_filled,
          COUNT(compounds) as compounds_filled,
          SUM(CASE WHEN jsonb_array_length(compounds) > 0 THEN 1 ELSE 0 END) as compounds_has_data,
          COUNT(targets) as targets_filled,
          SUM(CASE WHEN jsonb_array_length(targets) > 0 THEN 1 ELSE 0 END) as targets_has_data,
          COUNT(diseases) as diseases_filled,
          SUM(CASE WHEN jsonb_array_length(diseases) > 0 THEN 1 ELSE 0 END) as diseases_has_data,
          COUNT(ob_percent) as ob_filled,
          COUNT(dl_value) as dl_filled
        FROM tcm_herbs
    """)
    row = cur.fetchone()
    total = row["total"]

    fields = [
        ("name_cn", "name_cn_filled", None),
        ("name_latin", "name_latin_filled", None),
        ("category", "category_filled", None),
        ("effects", "effects_filled", None),
        ("compounds", "compounds_has_data", None),  # 使用 has_data（至少1个化合物）
        ("targets", "targets_has_data", None),
        ("diseases", "diseases_has_data", None),
        ("ob_percent", "ob_filled", None),
        ("dl_value", "dl_filled", None),
    ]

    coverage = {}
    for field_name, col_key, _ in fields:
        filled = row[col_key]
        pct = round(100.0 * filled / total, 1) if total > 0 else 0
        coverage[field_name] = {"filled": filled, "pct": f"{pct}%"}
        bar = "█" * int(pct / 2) + "░" * (50 - int(pct / 2))
        print(f"  {field_name:<14}: {filled:>4}/{total:<4} ({pct:>5}%) {bar}")

    return coverage, total


def detect_anomalies(cur):
    """异常值检测：OB%、DL、空化合物等"""
    print("\n" + "=" * 60)
    print("  [2/4] 异常值检测")
    print("=" * 60)

    anomalies = {}

    # OB% 异常值 (>100 或 <0)
    cur.execute(
        "SELECT id, name_cn, ob_percent FROM tcm_herbs WHERE ob_percent > 100 OR ob_percent < 0"
    )
    ob_anomalies = [dict(r) for r in cur.fetchall()]
    anomalies["ob_anomalies"] = ob_anomalies
    print(f"  OB% 异常值 (>100 或 <0): {len(ob_anomalies)} 条")
    for a in ob_anomalies[:5]:
        print(f"    - ID={a['id']} {a['name_cn']}: OB%={a['ob_percent']}")
    if len(ob_anomalies) > 5:
        print(f"    ... 还有 {len(ob_anomalies)-5} 条")

    # DL 异常值 (>1 或 <0)
    cur.execute(
        "SELECT id, name_cn, dl_value FROM tcm_herbs WHERE dl_value > 1 OR dl_value < 0"
    )
    dl_anomalies = [dict(r) for r in cur.fetchall()]
    anomalies["dl_anomalies"] = dl_anomalies
    print(f"  DL 异常值 (>1 或 <0):     {len(dl_anomalies)} 条")
    for a in dl_anomalies[:5]:
        print(f"    - ID={a['id']} {a['name_cn']}: DL={a['dl_value']}")
    if len(dl_anomalies) > 5:
        print(f"    ... 还有 {len(dl_anomalies)-5} 条")

    # 化合物数为 0 或 NULL 的记录
    cur.execute(
        "SELECT id, name_cn, compounds FROM tcm_herbs WHERE compounds IS NULL OR jsonb_array_length(compounds) = 0"
    )
    empty_compounds = [dict(r) for r in cur.fetchall()]
    anomalies["empty_compounds"] = empty_compounds
    print(f"  空化合物记录:            {len(empty_compounds)} 条")
    for e in empty_compounds[:10]:
        print(f"    - ID={e['id']} {e['name_cn']}")
    if len(empty_compounds) > 10:
        print(f"    ... 还有 {len(empty_compounds)-10} 条")

    # targets 为空的记录
    cur.execute(
        "SELECT id, name_cn FROM tcm_herbs WHERE targets IS NULL OR jsonb_array_length(targets) = 0"
    )
    empty_targets = [dict(r) for r in cur.fetchall()]
    anomalies["empty_targets"] = empty_targets
    print(f"  空 targets 记录:           {len(empty_targets)} 条")

    # diseases 为空的记录
    cur.execute(
        "SELECT id, name_cn FROM tcm_herbs WHERE diseases IS NULL OR jsonb_array_length(diseases) = 0"
    )
    empty_diseases = [dict(r) for r in cur.fetchall()]
    anomalies["empty_diseases"] = empty_diseases
    print(f"  空 diseases 记录:          {len(empty_diseases)} 条")

    return anomalies


def sampling_verification(cur, total_records, sample_size=100):
    """抽样复核：随机抽取记录进行质量检查"""
    print("\n" + "=" * 60)
    print(f"  [3/4] 抽样复核 (抽样率: {sample_size}/{total_records} = {sample_size*100//total_records}%)")
    print("=" * 60)

    # 获取所有 ID
    cur.execute("SELECT id FROM tcm_herbs ORDER BY id")
    all_ids = [r["id"] for r in cur.fetchall()]

    # 随机抽样
    random.seed(42)  # 固定种子保证可复现
    sample_ids = random.sample(all_ids, min(sample_size, len(all_ids)))

    # 批量获取抽样记录
    cur.execute(
        """
        SELECT id, name_cn, name_latin, category,
               compounds, targets, diseases
        FROM tcm_herbs WHERE id = ANY(%s)
        """,
        (list(sample_ids),),
    )
    records = cur.fetchall()

    passed = 0
    failed = 0
    failure_details = []

    for r in records:
        issues = []

        # name_cn 不为空且长度 >= 2
        if not r["name_cn"] or len(str(r["name_cn"]).strip()) < 2:
            issues.append(f"name_cn为空或过短: '{r['name_cn']}'")

        # name_latin 不为空
        if not r["name_latin"] or str(r["name_latin"]).strip() == "":
            issues.append(f"name_latin为空")

        # category 不为空
        if not r["category"] or str(r["category"]).strip() == "":
            issues.append(f"category为空")

        # compounds 数组长度合理 (0-500)
        cc = jsonb_array_len_safe(r["compounds"])
        if cc is None or cc > 500:
            issues.append(f"compounds数量异常: {cc}")

        # targets 数组长度合理 (0-500)
        tc = jsonb_array_len_safe(r["targets"])
        if tc is None or tc > 500:
            issues.append(f"targets数量异常: {tc}")

        # diseases 数组长度合理 (0-500)
        dc = jsonb_array_len_safe(r["diseases"])
        if dc is None or dc > 500:
            issues.append(f"diseases数量异常: {dc}")

        if issues:
            failed += 1
            failure_details.append({
                "id": r["id"],
                "name_cn": str(r["name_cn"]),
                "issues": issues,
            })
        else:
            passed += 1

    pass_rate = round(100.0 * passed / len(records), 1) if records else 0
    print(f"  抽样总数:   {len(records)}")
    print(f"  通过:       {passed}")
    print(f"  未通过:     {failed}")
    print(f"  通过率:     {pass_rate}%")

    if failure_details:
        print(f"\n  未通过详情:")
        for f in failure_details[:20]:
            print(f"    - ID={f['id']} {f['name_cn']}: {'; '.join(f['issues'])}")
        if len(failure_details) > 20:
            print(f"    ... 还有 {len(failure_details)-20} 条")

    return {
        "sample_size": len(records),
        "passed": passed,
        "failed": failed,
        "pass_rate": f"{pass_rate}%",
        "failure_details": failure_details,
    }


def jsonb_array_len_safe(val):
    """安全获取 JSONB 数组长度"""
    if val is None:
        return 0
    try:
        import json
        if isinstance(val, str):
            arr = json.loads(val)
            return len(arr) if isinstance(arr, list) else 0
        elif hasattr(val, "__len__"):
            return len(val)
        return 0
    except Exception:
        return 0


def check_new_records(cur):
    """特别检查新增的 2 条记录（灯盏细辛、蒿本）"""
    print("\n" + "=" * 60)
    print("  [4/4] 新增记录专项检查 (ID=499 灯盏细辛, ID=500 蒿本)")
    print("=" * 60)

    new_records_check = {}

    for herb_id, herb_name in [(499, "灯盏细辛"), (500, "蒿本")]:
        cur.execute(
            """
            SELECT id, name_cn, name_latin, category, effects,
                   compounds, targets, diseases, ob_percent, dl_value
            FROM tcm_herbs WHERE id = %s
            """,
            (herb_id,),
        )
        r = cur.fetchone()

        if not r:
            new_records_check[herb_name] = {
                "error": f"未找到 ID={herb_id} 的记录",
                "status": "MISSING",
            }
            print(f"  ❌ {herb_name} (ID={herb_id}): 记录不存在!")
            continue

        compounds_count = jsonb_array_len_safe(r["compounds"])
        targets_count = jsonb_array_len_safe(r["targets"])
        diseases_count = jsonb_array_len_safe(r["diseases"])

        issues = []
        if not r["name_cn"]:
            issues.append("name_cn为空")
        if not r["name_latin"]:
            issues.append("name_latin为空")
        if not r["category"]:
            issues.append("category为空")
        if not r["effects"]:
            issues.append("effects为空")
        if compounds_count == 0:
            issues.append("compounds为空")
        if targets_count == 0:
            issues.append("targets为空")
        if diseases_count == 0:
            issues.append("diseases为空")
        if r["ob_percent"] is None:
            issues.append("ob_percent为空")
        if r["dl_value"] is None:
            issues.append("dl_value为空")

        status = "OK" if not issues else "ISSUE"

        record_info = {
            "id": r["id"],
            "name_cn": str(r["name_cn"]),
            "name_latin": str(r["name_latin"]),
            "category": str(r["category"]),
            "has_effects": bool(r["effects"]),
            "compounds_count": compounds_count,
            "targets_count": targets_count,
            "diseases_count": diseases_count,
            "ob_percent": float(r["ob_percent"]) if r["ob_percent"] is not None else None,
            "dl_value": float(r["dl_value"]) if r["dl_value"] is not None else None,
            "status": status,
        }
        if issues:
            record_info["issues"] = issues

        new_records_check[herb_name] = record_info

        icon = "✅" if status == "OK" else "❌"
        print(f"\n  {icon} {herb_name} (ID={herb_id})")
        print(f"     name_cn:    {r['name_cn']}")
        print(f"     name_latin: {r['name_latin']}")
        print(f"     category:   {r['category']}")
        print(f"     effects:    {'有' if r['effects'] else '无'}")
        print(f"     compounds:  {compounds_count}")
        print(f"     targets:    {targets_count}")
        print(f"     diseases:   {diseases_count}")
        print(f"     OB%:        {r['ob_percent']}")
        print(f"     DL:         {r['dl_value']}")
        if issues:
            print(f"     ⚠️  问题: {', '.join(issues)}")

    return new_records_check


def calculate_quality_score(coverage, anomalies, sampling, new_records):
    """计算综合质量评分"""
    scores = []

    # 字段覆盖率得分 (权重 40%)
    field_weights = {
        "name_cn": 5,
        "name_latin": 5,
        "category": 5,
        "effects": 10,
        "compounds": 10,
        "targets": 8,
        "diseases": 8,
        "ob_percent": 3,
        "dl_value": 3,
    }
    total_weight = sum(field_weights.values())
    weighted_sum = 0
    for field, weight in field_weights.items():
        pct = float(coverage[field]["pct"].replace("%", ""))
        weighted_sum += (pct / 100.0) * weight
    field_score = round(weighted_sum / total_weight * 100, 1)
    scores.append(("字段覆盖率", field_score, 40))

    # 异常值得分 (权重 20%)
    anomaly_count = (
        len(anomalies.get("ob_anomalies", []))
        + len(anomalies.get("dl_anomalies", []))
        + len(anomalies.get("empty_compounds", []))
    )
    anomaly_score = max(0, 100 - anomaly_count * 2)
    scores.append(("异常值检测", anomaly_score, 20))

    # 抽样通过率 (权重 25%)
    sampling_score = float(sampling.get("pass_rate", "0%").replace("%", ""))
    scores.append(("抽样复核", sampling_score, 25))

    # 新增记录完整性 (权重 15%)
    new_ok = sum(1 for v in new_records.values() if v.get("status") == "OK")
    new_score = (new_ok / max(len(new_records), 1)) * 100
    scores.append(("新增记录", new_score, 15))

    # 加权总分
    overall = round(
        sum(s[1] * s[2] / 100.0 for s in scores), 1
    )

    return overall, scores


def main():
    print("=" * 60)
    print("  TCMSP 中药材数据完整审计报告")
    print(f"  审计时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)

    conn = get_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)

    try:
        # 1. 字段覆盖率审计
        coverage, total_records = audit_field_coverage(cur)

        # 2. 异常值检测
        anomalies = detect_anomalies(cur)

        # 3. 抽样复核
        sampling = sampling_verification(cur, total_records, sample_size=100)

        # 4. 新增记录检查
        new_records = check_new_records(cur)

        # 5. 计算综合质量评分
        quality_score, score_breakdown = calculate_quality_score(
            coverage, anomalies, sampling, new_records
        )

        # ── 生成报告 ──
        report = {
            "audit_timestamp": datetime.now().isoformat(),
            "total_records": total_records,
            "field_coverage": coverage,
            "anomaly_detection": {
                "ob_anomalies": anomalies["ob_anomalies"],
                "dl_anomalies": anomalies["dl_anomalies"],
                "empty_compounds": anomalies["empty_compounds"],
                "empty_targets_count": len(anomalies.get("empty_targets", [])),
                "empty_diseases_count": len(anomalies.get("empty_diseases", [])),
            },
            "sampling_verification": sampling,
            "new_records_check": new_records,
            "quality_score_breakdown": [
                {"dimension": name, "score": score, "weight": weight}
                for name, score, weight in score_breakdown
            ],
            "overall_quality_score": f"{quality_score}%",
            "recommendations": generate_recommendations(
                coverage, anomalies, sampling, new_records, quality_score
            ),
        }

        # 保存报告
        with open(REPORT_PATH, "w", encoding="utf-8") as f:
            json.dump(report, f, ensure_ascii=False, indent=2)

        # ── 打印摘要 ──
        print("\n" + "=" * 60)
        print("  📊 审计摘要")
        print("=" * 60)
        print(f"  总记录数:       {total_records}")
        print(f"  综合质量评分:   {quality_score}%")
        print(f"\n  各维度评分:")
        for name, score, weight in score_breakdown:
            bar_len = int(score / 2)
            bar = "█" * bar_len + "░" * (50 - bar_len)
            print(f"    {name:<12}: {score:>5}% (权重{weight:>2}%) {bar}")

        print(f"\n  验收标准检查:")
        effects_pct = float(coverage["effects"]["pct"].replace("%", ""))
        compounds_pct = float(coverage["compounds"]["pct"].replace("%", ""))
        targets_pct = float(coverage["targets"]["pct"].replace("%", ""))
        diseases_pct = float(coverage["diseases"]["pct"].replace("%", ""))
        sampling_pass = float(sampling["pass_rate"].replace("%", ""))

        checks = [
            ("effects 非空率 >= 95%", effects_pct >= 95, f"{effects_pct}%"),
            ("compounds 有数据率 >= 95%", compounds_pct >= 95, f"{compounds_pct}%"),
            ("targets 有数据率 >= 85%", targets_pct >= 85, f"{targets_pct}%"),
            ("diseases 有数据率 >= 90%", diseases_pct >= 90, f"{diseases_pct}%"),
            ("新增2条记录完整", all(v.get("status") == "OK" for v in new_records.values()), f"{sum(1 for v in new_records.values() if v.get('status')=='OK')}/2"),
            ("抽样通过率 >= 95%", sampling_pass >= 95, f"{sampling_pass}%"),
        ]

        all_passed = True
        for criteria, ok, detail in checks:
            icon = "✅" if ok else "❌"
            if not ok:
                all_passed = False
            print(f"    {icon} {criteria:<28} (实际: {detail})")

        print(f"\n  总体结论: {'🎉 全部验收通过!' if all_passed else '⚠️ 存在未达标项，请查看建议'}")
        print(f"\n  报告已保存至: {REPORT_PATH}")

    finally:
        cur.close()
        conn.close()


def generate_recommendations(coverage, anomalies, sampling, new_records, score):
    """基于审计结果生成改进建议"""
    recommendations = []

    # 检查各字段覆盖率
    for field, info in coverage.items():
        pct = float(info["pct"].replace("%", ""))
        thresholds = {
            "effects": (95, "功效(effects)字段"),
            "compounds": (95, "化合物(compounds)数据"),
            "targets": (85, "靶点(targets)数据"),
            "diseases": (90, "疾病(diseases)数据"),
        }
        if field in thresholds and pct < thresholds[field][0]:
            recommendations.append(
                f"[优先级高] {thresholds[field][1]}覆盖率仅 {pct}%，低于阈值 {thresholds[field][0]}%，建议补充数据"
            )

    # 异常值处理
    if anomalies["ob_anomalies"]:
        recommendations.append(
            f"[优先级中] 发现 {len(anomalies['ob_anomalies'])} 条 OB% 异常值记录，需要核查修正"
        )
    if anomalies["dl_anomalies"]:
        recommendations.append(
            f"[优先级中] 发现 {len(anomalies['dl_anomalies'])} 条 DL 异常值记录，需要核查修正"
        )
    if anomalies["empty_compounds"]:
        recommendations.append(
            f"[优先级高] {len(anomalies['empty_compounds'])} 条记录无化合物数据，严重影响核心功能"
        )

    # 抽样问题
    if sampling["failed"] > 0:
        recommendations.append(
            f"[优先级中] 抽样发现 {sampling['failed']} 条记录存在数据质量问题，需逐一修复"
        )

    # 新增记录问题
    for name, info in new_records.items():
        if info.get("status") != "OK":
            recommendations.append(
                f"[优先级高] 新增记录「{name}」存在数据缺失: {', '.join(info.get('issues', []))}"
            )

    # 总体评价
    if score >= 95:
        recommendations.append("[总体] 数据质量优秀，可投入生产使用")
    elif score >= 85:
        recommendations.append("[总体] 数据质量良好，建议修复上述问题后投入使用")
    elif score >= 70:
        recommendations.append("[总体] 数据质量一般，需要进行数据补全和清洗")
    else:
        recommendations.append("[总体] 数据质量较差，强烈建议进行全面数据修复后再使用")

    if not recommendations:
        recommendations.append("[总体] 数据质量优秀，所有指标均达标，无需额外操作")

    return recommendations


if __name__ == "__main__":
    main()
