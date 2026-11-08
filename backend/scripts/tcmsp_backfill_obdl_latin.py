# -*- coding: utf-8 -*-
"""food_materials OB%/DL 拉丁名二次匹配（承接 tcmsp_backfill_obdl.py 的 name_cn 精确匹配）。

背景：上一轮按 name_cn 精确匹配 TCMSP 502 药材索引回填了 83 行真实 OB/DL。本轮对仍未命中的行
按拉丁名二次匹配，提升覆盖率。

【关键前提——实测已确证】
TCMSP 索引的 herb_en_name 是【药典拉丁名】（药用部位属格 + 属名），不是植物学双名，例如：
  桂花 Osmanthus fragrans -> 索引无 Osmanthus
  白扁豆 Lablab Semen Album / 扁豆花 Dolichos Lablab L
  白茅根 Imperatae Rhizoma / 槐花 Sophora Japonica L.
故【精确拉丁双名匹配】与【属名模糊匹配】都无法恢复多数药材——因为 TCMSP 502 味索引里
根本不含 山楂(Crataegus)/肉桂(Cinnamomum)/天麻(Gastrodia)/石斛(Dendrobium)/杏仁(Prunus)/
蒲公英(Taraxacum)/莲子(Nelumbo)/枣(Ziziphus) 等 A 类属（实测 31 属中 20 属不在索引）。
拉丁名扩展的天花板由 TCMSP 收录范围决定，而非匹配算法。

【防伪造核心——严格 allowlist，绝不模糊猜测】
拉丁名匹配天然一对多（同属不同种、同种不同药用部位药性迥异）。为不伪造：
  - 仅当【属 + 种 + 药用部位】三者在 TCMSP 条目与 food_materials 间明确一致时才匹配；
  - 用人工确认的 STRICT/LATIN_ALLOWLIST 白名单驱动，非白名单一律诚实跳过；
  - 同种不同部位（槐米=花蕾 vs 槐花=开放花；紫苏籽=果 vs 紫苏=叶；橘皮/桔红=皮 vs 陈皮）明确跳过。

聚合口径（与 tcmsp_backfill_obdl.py 完全一致，可复现）：
  TCMSP 标准 ADME 阈值 OB>=30% 且 DL>=0.18 过滤活性 compound
    -> ob_percent = 活性 compound 的 OB 均值
    -> dl_value   = 活性 compound 的 DL 中位数
    -> bioavailability_score = ob_percent / 100
  无达标活性 compound -> 诚实留空。OB 为 in-silico 预测值（非人体实测）。

硬约束：dry-run 默认；--apply 需 --yes-i-know；幂等（跳过 source_db='tcm_sp' 及非空行）；
可回滚（原值多为 NULL，仍记 provenance）；礼貌限流（sleep+token 复用+重试+UA）；绝不伪造。

用法：
  python scripts/tcmsp_backfill_obdl_latin.py                        # dry-run
  python scripts/tcmsp_backfill_obdl_latin.py --apply --yes-i-know   # 写库
  python scripts/tcmsp_backfill_obdl_latin.py --restore              # 从 sidecar 回滚
"""
import argparse
import asyncio
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from tcmsp_backfill_obdl import (  # noqa: E402  复用已验证的抓取/聚合逻辑
    DATA_QUALITY,
    DB_DSN,
    PER_REQUEST_SLEEP,
    SOURCE_DB,
    _client,
    aggregate_ob_dl,
    backup_original,
    fetch_herb_compounds,
    fetch_herb_index,
    get_token,
)

SIDECAR = Path(__file__).resolve().parent / "tcmsp_obdl_latin_provenance.json"

# ── 严格白名单：food_materials.id -> TCMSP herb_en_name（拉丁，索引内实际字段值）──
# 仅收录【同属+同种+同药用部位】人工确认一致的条目。逐条理由见注释。
LATIN_MATCHES = {
    # Citrus aurantium 花 = 玳玳花（TCMSP 条目即 Citrus Aurantium，花，同种同部位）
    40: "Citrus Aurantium",
    # Zingiber officinale 鲜根茎 = 生姜（同种；姜=鲜姜，区别于干姜 Zingiberis Rhizoma）
    69: "Zingiber Officinale Roscoe",
    # Lablab purpureus 花：TCMSP「扁豆花 Dolichos Lablab L」——Dolichos lablab 为 Lablab
    # purpureus 异名（同种），部位同为花。
    32: "Dolichos Lablab L",
}

# 明确跳过并说明理由（B 类同种不同部位 / 同名不同物 / 物种不在 TCMSP），保证审计透明。
SKIP_REASONS = {
    63: "槐米(花蕾) vs TCMSP 槐花(开放花)：同种不同药用部位，药性有别，跳过",
    132: "紫苏籽(果实) vs TCMSP 紫苏(叶)：同种不同部位，跳过（紫苏子=果亦非籽）",
    76: "橘皮(皮) vs TCMSP 陈皮(皮)：同种但橘皮/陈皮炮制程度不同，一对多(Citrus)，跳过",
    73: "桔红 vs TCMSP 陈皮：同属同种不同采收/炮制，与橘皮重复指向陈皮，跳过",
    122: "益智仁(种子) vs TCMSP 益智(果实)：同种不同部位，跳过",
    113: "鲜白茅根(鲜根) vs TCMSP 白茅根(干根茎)：鲜/干不同，且索引种名未标，跳过",
    46: "地黄(生地) vs TCMSP 熟地黄(炮制)：同种不同炮制品，跳过",
    137: "制何首乌(炮制) vs 索引无 Polygonum：物种不在 TCMSP，跳过",
}


async def run(dry_run):
    import json

    import asyncpg
    conn = await asyncpg.connect(DB_DSN)
    if SIDECAR.exists():
        try:
            sidecar = json.loads(SIDECAR.read_text(encoding="utf-8"))
        except Exception:
            sidecar = {}
    else:
        sidecar = {}
    updated = filled = 0
    report = []
    try:
        rows = await conn.fetch(
            "SELECT id, name_cn, name_latin, ob_percent, dl_value, bioavailability_score, "
            "source_db, data_quality FROM food_materials ORDER BY id")
        rowmap = {r["id"]: r for r in rows}
        with _client() as client:
            token = get_token(client)
            if not token:
                print("[FATAL] 无法获取 TCMSP token，终止。")
                return
            time.sleep(PER_REQUEST_SLEEP)
            index = fetch_herb_index(client)
            if not index:
                print("[FATAL] 无法获取 TCMSP 药材索引，终止。")
                return
            en2cn = {meta["latin"]: cn for cn, meta in index.items()}
            print(f"TCMSP 索引 {len(index)} 味；token={token[:8]}...")

            # 候选 = 白名单命中 且 该行仍为空且未被 tcm_sp 处理（幂等 + only-fill）
            for mid, latin_target in sorted(LATIN_MATCHES.items()):
                r = rowmap.get(mid)
                if r is None:
                    report.append((mid, "?", latin_target, None, "food_materials 无此 id，跳过"))
                    continue
                cn = r["name_cn"]
                if r["source_db"] == SOURCE_DB:
                    report.append((mid, cn, latin_target, None, "已处理(source_db=tcm_sp)，幂等跳过"))
                    continue
                if r["ob_percent"] is not None:
                    report.append((mid, cn, latin_target, None, "ob_percent 非空，only-fill 跳过"))
                    continue
                compounds = fetch_herb_compounds(client, token, latin_target)
                time.sleep(PER_REQUEST_SLEEP)
                agg = aggregate_ob_dl(compounds)
                tcmsp_cn = en2cn.get(latin_target, "?")
                if not agg:
                    report.append((mid, cn, f"{latin_target}({tcmsp_cn})", None,
                                   "无达标活性 compound(OB>=30&DL>=0.18)，诚实留空"))
                    continue
                report.append((mid, cn, f"{latin_target}({tcmsp_cn})", agg, "拉丁名匹配回填"))
                if not dry_run:
                    backup_original(sidecar, mid, cn, {
                        "ob_percent": r["ob_percent"], "dl_value": r["dl_value"],
                        "bioavailability_score": r["bioavailability_score"],
                        "source_db": r["source_db"], "data_quality": r["data_quality"]})
                    await conn.execute(
                        "UPDATE food_materials SET ob_percent=$2, dl_value=$3, "
                        "bioavailability_score=$4, source_db=$5, data_quality=$6, "
                        "updated_at=NOW() WHERE id=$1",
                        mid, agg["ob_percent"], agg["dl_value"],
                        agg["bioavailability_score"], SOURCE_DB, DATA_QUALITY)
                    updated += 1
                    filled += 1

        print("\n=== 拉丁名二次匹配报告（严格 allowlist）===")
        for mid, cn, tgt, agg, note in report:
            if agg:
                print(f"  id={mid} {cn}: <- {tgt} ob={agg['ob_percent']} dl={agg['dl_value']} "
                      f"bio={agg['bioavailability_score']} (活性 {agg['n_compounds']}/{agg['n_total']})")
            else:
                print(f"  id={mid} {cn}: 跳过/留空 — {note}")

        print("\n=== 白名单外显式跳过（同名同物不可确认）===")
        for mid, why in sorted(SKIP_REASONS.items()):
            r = rowmap.get(mid)
            cn = r["name_cn"] if r else "?"
            print(f"  id={mid} {cn}: {why}")

        n_fill = sum(1 for x in report if x[3])
        print("\n=== 统计 ===")
        print(f"  可拉丁名回填：{n_fill} 行" + ("" if dry_run else f"（已更新 {updated} 行）"))
        print(f"  白名单外诚实跳过：{len(SKIP_REASONS)} 行")
        print("  其余 45 行未命中中的 C 类(普通食品/动物源/添加剂)及物种不在 TCMSP 者：诚实留空")
        if not dry_run:
            SIDECAR.write_text(
                json.dumps(sidecar, ensure_ascii=False, indent=2), encoding="utf-8")
            print(f"\n[APPLY] 更新 {updated} 行；source_db={SOURCE_DB} data_quality={DATA_QUALITY}")
            print(f"[APPLY] provenance 已写入 {SIDECAR.name}")
        else:
            print("\n[dry-run] 未写库。确认后执行： "
                  "python scripts/tcmsp_backfill_obdl_latin.py --apply --yes-i-know")
    finally:
        await conn.close()


async def restore():
    import json
    if not SIDECAR.exists():
        print("[restore] 无 latin sidecar，无需回滚。")
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
            o = rec["original"]
            await conn.execute(
                "UPDATE food_materials SET ob_percent=$2, dl_value=$3, "
                "bioavailability_score=$4, source_db=$5, data_quality=$6, updated_at=NOW() "
                "WHERE id=$1",
                rec["id"], o["ob_percent"], o["dl_value"],
                o["bioavailability_score"], o["source_db"], o["data_quality"])
            n += 1
        print(f"[restore] 已回滚 {n} 行到原值。")
    finally:
        await conn.close()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--yes-i-know", action="store_true")
    ap.add_argument("--restore", action="store_true")
    args = ap.parse_args()
    if args.restore:
        asyncio.run(restore())
        return
    if args.apply and not args.yes_i_know:
        print("[REFUSING] --apply 需二次确认：请加 --yes-i-know（先 dry-run 核对计划）。")
        sys.exit(3)
    asyncio.run(run(dry_run=not args.apply))


if __name__ == "__main__":
    main()
