# -*- coding: utf-8 -*-
"""策划 food_materials.active_ingredients：把 TCMSP 原始 compound 倾倒蒸馏成有药理学意义的活性成分列表。

背景：source_db='tcm_sp' 的 86 行 active_ingredients 是 TCMSP 原始 dump（菊花 359 / 紫苏 326 / 甘草 280…），
含噪声（'EIC'=内部ID、'Cholester'=截断、大量 trivial 化合物、超长系统命名），前端渲染成 badge 列表毫无可用性。
本轮用 tcmsp_backfill_obdl.py 同款 ADME 阈值（OB>=30% & DL>=0.18）筛出「活性 compound」，取其 molecule_name，
按 OB 降序、保留 top-N，策划成可用列表。这是数据质量提升，不是填补空缺。

策划口径（透明可复现、非伪造）：
  1) 阈值：OB>=30% 且 DL>=0.18（TCMSP 标准 ADME 阈值，识别活性/类药 compound）
  2) 噪声过滤（对 molecule_name）：
     - 长度 <4 的全大写缩写（EIC/ICO/DFV/MNN/QT 等 TCMSP 内部ID/占位）剔除
     - 含 '_' 的（Ginsenoside-Rh4_qt 等带 _qt 后缀的内部标记）剔除
     - 以 'ter' 结尾（Cholester/Phenolter 等明显截断串）剔除
     - 纯非字母/空名剔除；保留正常化合物名（含数字/括号/希腊字母的系统名按长度上限截留）
  3) 排序：按 OB 降序（活性最强在前，前端 badge 前排即关键活性成分）
  4) 上限 N=20：即使活性 compound 很多（如甘草）也只留 top-20，避免列表过长
  5) 无达标活性 compound 的行 -> 诚实留空 []，不硬凑

范围（保守）：只处理 source_db='tcm_sp' 的 86 行（有真实 TCMSP compound 数据）。
非 tcm_sp 行（china_food_regulations 等空数组/无 compound 数据）不动。

硬约束：dry-run 默认；--apply 需 --yes-i-know；幂等（sidecar curated 集合跳过已策划行）；
可回滚（覆盖前备份原 active_ingredients 到 sidecar，--restore）；礼貌限流；绝不伪造。

用法：
  python scripts/tcmsp_curate_active_ingredients.py                        # dry-run
  python scripts/tcmsp_curate_active_ingredients.py --apply --yes-i-know   # 写库
  python scripts/tcmsp_curate_active_ingredients.py --restore              # 回滚
"""
import argparse
import asyncio
import json
import re
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from tcmsp_backfill_obdl import (  # noqa: E402  复用已验证的抓取逻辑
    DB_DSN,
    DL_THRESHOLD,
    OB_THRESHOLD,
    PER_REQUEST_SLEEP,
    _client,
    fetch_herb_compounds,
    fetch_herb_index,
    get_token,
)

SIDECAR = Path(__file__).resolve().parent / "tcmsp_active_ingredients_provenance.json"
TOP_N = 20            # 每行最多保留的活性成分数（按 OB 降序）
MAX_NAME_LEN = 40     # 超长 IUPAC 系统命名对前端 badge 不友好，>40 剔除（原 60 收紧）


def is_noise(name):
    """判断 molecule_name 是否为噪声/内部ID/截断串。"""
    if not name or not str(name).strip():
        return True
    s = str(name).strip()
    if len(s) > MAX_NAME_LEN:
        return True
    # 长度<4 的全大写缩写：EIC/ICO/DFV/MNN/QT 等内部ID/占位（真实缩写如 DPPH 亦为检测标记，非成分）
    if len(s) < 4 and re.fullmatch(r"[A-Za-z]+", s) and s.isupper():
        return True
    # 带内部标记后缀 _qt / _ 等系统ID
    if "_" in s:
        return True
    # 明显截断串：以 ter 结尾（Cholester / Phenolter 等 TCMSP 截断）
    if s.endswith("ter") and len(s) <= 12 and " " not in s:
        return True
    # 供应商/数据库编号：ZINC03860434 / LMFA07010 等大写前缀+长数字，非化合物名
    if re.fullmatch(r"ZINC\d+", s) or re.fullmatch(r"[A-Z]{2,}\d{4,}", s):
        return True
    # 商品名/品牌名检测：含空格且某段是独立全大写缩写块(2-5 字符)，
    # 如 "Truflex OBP" 的 OBP / "Soy Lecithin IP" 的 IP —— 真实化合物名不会带独立全大写段。
    # 注：立体标记 (3R)/(2S,3R)/β 等含括号或非大写拉丁字符，不会被此规则误伤。
    if " " in s:
        for tok in re.findall(r"[A-Za-z]+", s):
            if 2 <= len(tok) <= 5 and tok.isupper() and tok.isalpha():
                return True
    return False


def curate(compounds):
    """按 ADME 阈值筛活性 compound -> 噪声过滤 -> OB 降序 -> top-N。返回 (list, stats)。"""
    active = []
    for c in compounds:
        try:
            ob = float(c.get("ob"))
            dl = float(c.get("dl"))
        except (TypeError, ValueError):
            continue
        if ob >= OB_THRESHOLD and dl >= DL_THRESHOLD:
            nm = c.get("molecule_name")
            if is_noise(nm):
                continue
            active.append((ob, str(nm).strip()))
    active.sort(key=lambda x: x[0], reverse=True)
    names = [n for _, n in active[:TOP_N]]
    stats = {"n_active": len(active), "n_total": len(compounds),
             "threshold": f"OB>={OB_THRESHOLD}&DL>={DL_THRESHOLD}", "top_n": TOP_N}
    return names, stats


async def run(dry_run, force=False):
    import asyncpg
    conn = await asyncpg.connect(DB_DSN)
    sidecar = (json.loads(SIDECAR.read_text(encoding="utf-8"))
               if SIDECAR.exists() else {"materials": {}})
    curated_ids = set(sidecar.get("curated_ids", []))
    updated = 0
    report = []
    try:
        rows = await conn.fetch(
            "SELECT id, name_cn, active_ingredients, source_db FROM food_materials "
            "WHERE source_db='tcm_sp' ORDER BY id")
        # provenance: id -> tcmsp herb latin（obdl + latin 两份 sidecar 合并）
        prov = {}
        for p in (Path(__file__).resolve().parent / "tcmsp_obdl_provenance.json",
                  Path(__file__).resolve().parent / "tcmsp_obdl_latin_provenance.json"):
            if p.exists():
                for k, v in json.loads(p.read_text(encoding="utf-8")).get("materials", {}).items():
                    prov[int(k)] = v
        with _client() as client:
            token = get_token(client)
            if not token:
                print("[FATAL] 无法获取 TCMSP token，终止。")
                return
            time.sleep(PER_REQUEST_SLEEP)
            index = fetch_herb_index(client)
            cn2latin = {cn: meta["latin"] for cn, meta in index.items()}
            print(f"tcm_sp 行={len(rows)}；token={token[:8]}...；provenance 映射={len(prov)}")

            for r in rows:
                mid, cn = r["id"], r["name_cn"]
                latin = prov.get(mid, {}).get("tcmsp_herb") or cn2latin.get(cn)
                if not latin:
                    report.append((mid, cn, None, "无 TCMSP herb 映射，跳过"))
                    continue
                if mid in curated_ids and not force:
                    report.append((mid, cn, None, "已策划，幂等跳过"))
                    continue
                if mid in curated_ids and force:
                    # --force 重策划：重新抓取 TCMSP compound（真 ob/dl）重新策划，
                    # sidecar 的 original_active_ingredients 保留首次备份不覆盖（可回滚到最初 dump）。
                    compounds = fetch_herb_compounds(client, token, latin)
                    time.sleep(PER_REQUEST_SLEEP)
                    names, stats = curate(compounds)
                    old_n = len(sidecar.get("materials", {}).get(str(mid), {}).get(
                        "original_active_ingredients", []))
                    report.append((mid, cn, (names, stats, old_n), None))
                    if not dry_run:
                        sidecar["materials"][str(mid)]["new_active_ingredients"] = names
                        sidecar["materials"][str(mid)].update(stats)
                        await conn.execute(
                            "UPDATE food_materials SET active_ingredients=$2, updated_at=NOW() "
                            "WHERE id=$1", mid, names)
                        updated += 1
                    continue
                compounds = fetch_herb_compounds(client, token, latin)
                time.sleep(PER_REQUEST_SLEEP)
                names, stats = curate(compounds)
                old_n = len(r["active_ingredients"] or [])
                report.append((mid, cn, (names, stats, old_n), None))
                if not dry_run:
                    sidecar["materials"][str(mid)] = {
                        "id": mid, "name_cn": cn, "tcmsp_herb": latin,
                        "original_active_ingredients": r["active_ingredients"] or [],
                        "new_active_ingredients": names, **stats}
                    curated_ids.add(mid)
                    await conn.execute(
                        "UPDATE food_materials SET active_ingredients=$2, updated_at=NOW() "
                        "WHERE id=$1", mid, names)
                    updated += 1

        # 报告
        print("\n=== 策划报告（代表行：原 N 噪声 -> 新 top-N 活性成分）===")
        for mid, cn, data, note in report:
            if note:
                print(f"  id={mid} {cn}: 跳过 — {note}")
            else:
                names, stats, old_n = data
                head = ", ".join(names[:6]) if names else "(无达标活性成分->留空)"
                print(f"  id={mid} {cn}: {old_n}噪声 -> {len(names)}活性 [阈值{stats['threshold']} "
                      f"达标{stats['n_active']}] 前6: {head}")

        zero = [x for x in report if x[2] is None and "无达标" in (x[3] or "")]
        print("\n=== 统计 ===")
        print(f"  待策划 tcm_sp 行={len(rows)}；本轮策划={sum(1 for x in report if x[2])}")
        print(f"  无达标活性成分(诚实留空)={len(zero)}；幂等跳过={sum(1 for x in report if x[3] and '幂等' in x[3])}")
        if not dry_run:
            sidecar["curated_ids"] = sorted(curated_ids)
            SIDECAR.write_text(json.dumps(sidecar, ensure_ascii=False, indent=2), encoding="utf-8")
            print(f"\n[APPLY] 更新 {updated} 行；TOP_N={TOP_N} 阈值 OB>={OB_THRESHOLD}&DL>={DL_THRESHOLD}")
            print(f"[APPLY] provenance 已写入 {SIDECAR.name}")
        else:
            print("\n[dry-run] 未写库。确认后执行： "
                  "python scripts/tcmsp_curate_active_ingredients.py --apply --yes-i-know")
    finally:
        await conn.close()


async def restore():
    if not SIDECAR.exists():
        print("[restore] 无 sidecar，无需回滚。")
        return
    sidecar = json.loads(SIDECAR.read_text(encoding="utf-8"))
    mats = sidecar.get("materials", {})
    if not mats:
        print("[restore] sidecar 无备份。")
        return
    import asyncpg
    conn = await asyncpg.connect(DB_DSN)
    n = 0
    try:
        for key, rec in mats.items():
            await conn.execute(
                "UPDATE food_materials SET active_ingredients=$2, updated_at=NOW() WHERE id=$1",
                rec["id"], rec["original_active_ingredients"])
            n += 1
        print(f"[restore] 已回滚 {n} 行 active_ingredients 到原值。")
    finally:
        await conn.close()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--yes-i-know", action="store_true")
    ap.add_argument("--restore", action="store_true")
    ap.add_argument("--force", action="store_true",
                    help="重新策划已处理行（从 TCMSP 重新抓取+收紧规则，sidecar 原 dump 保留可回滚）")
    args = ap.parse_args()
    if args.restore:
        asyncio.run(restore())
        return
    if args.apply and not args.yes_i_know:
        print("[REFUSING] --apply 需二次确认：请加 --yes-i-know（先 dry-run 核对计划）。")
        sys.exit(3)
    asyncio.run(run(dry_run=not args.apply, force=args.force))


if __name__ == "__main__":
    main()
