# -*- coding: utf-8 -*-
"""用 TCMSP（Traditional Chinese Medicine Systems Pharmacology）补 food_materials 的
OB%(口服生物利用度) / DL(类药性) / bioavailability_score。

数据源：TCMSP 旧版 old.tcmsp-e.com（免费、无需登录，开放可编程访问）
  - browse.php?qc=herbs        页内内嵌全部 502 味药材 JSON 索引（herb_cn_name/herb_pinyin/herb_en_name）
  - tcmsp.php                  取免费 token（隐藏 input，复用）
  - tcmspsearch.php?qr=<拉丁名>&qsr=herb_en_name&token=<token>  药材详情，内嵌 Kendo grid
    compound 数据（字段 ob/dl/mw/alogp/caco2/... ，ob/dl 为字符串需转 float）
- OB 为 in-silico 预测值（非人体实测），但是该领域公认权威开源口径。

严谨聚合（口径透明、可复现，非伪造）：
  用 TCMSP 标准 ADME 阈值过滤「活性/类药」compound：OB>=30% 且 DL>=0.18
    -> ob_percent          = 过滤后 compound 的 OB 均值（保留 2 位小数）
    -> dl_value            = 过滤后 compound 的 DL 中位数（保留 4 位小数）
    -> bioavailability_score = ob_percent / 100（归一到 0-1，口径：活性 compound 集 OB 均值/100）
  若过滤后无 compound（该药材无达标活性成分）-> 诚实跳过留空。

覆盖纠正（Lead 已授权）：现有 11 行为整数伪数据(OB 40/60/80、DL 0.5-1.0、bioavailability_score 全 0.0)，
  用 TCMSP 真实派生值替换 = 纠错。**覆盖前强制备份原值**到 sidecar（可回滚）。

来源可追溯：
  - source_db 标 'tcm_sp'（OB/DL 现由 TCMSP 派生，列级溯源更真实；原 source_db 备份到 sidecar 可还原）
  - sidecar provenance 记每行：id/name_cn/纳入 compound 数/阈值/OB均值/DL中位数/TCMSP herb 名/原值(若覆盖)
  - data_quality = 0.70（派生/in-silico 预测口径，低于法规实测口径）

幂等 + 可回滚：
  - 幂等守卫 WHERE source_db IS DISTINCT FROM 'tcm_sp'：已纠正行重跑跳过 -> 0 更新
  - 备份按 material id 键控、跨重跑合并且不覆盖已有原值
  - --restore 读 sidecar 还原 ob/dl/bio/source_db/data_quality 原值

用法：
  python scripts/tcmsp_backfill_obdl.py                        # dry-run：打印计划，不写库
  python scripts/tcmsp_backfill_obdl.py --apply --yes-i-know   # 确认守卫通过，写库
  python scripts/tcmsp_backfill_obdl.py --restore              # 从 sidecar 回滚
"""
import argparse
import asyncio
import json
import re
import statistics
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import httpx

DB_DSN = "postgresql://postgres:password@localhost:5432/rmfood"
UA = "RMFOODFP/1.0 (TCMSP OB/DL enrichment; dev@rmfoodfp.local)"
BASE = "https://old.tcmsp-e.com"
SIDECAR = Path(__file__).resolve().parent / "tcmsp_obdl_provenance.json"

PER_REQUEST_SLEEP = 0.2
RETRIES = 4
BACKOFF = 1.5

# TCMSP 标准 ADME 筛选阈值（文献通用）
OB_THRESHOLD = 30.0
DL_THRESHOLD = 0.18

SOURCE_DB = "tcm_sp"          # 短 token（varchar(50)）
DATA_QUALITY = 0.70           # 派生/in-silico 预测口径
BIO_DENOM = 100.0             # bioavailability_score = ob_percent / 100


# ────────────────────────── TCMSP 抓取 ──────────────────────────

def _client():
    return httpx.Client(timeout=30.0, headers={"User-Agent": UA},
                        follow_redirects=True, verify=False)


def _get(client, url, params=None):
    """带重试 + 指数退避的 GET。失败返回 None。"""
    for attempt in range(RETRIES):
        try:
            r = client.get(url, params=params)
            if r.status_code == 200:
                return r.text
            time.sleep(BACKOFF * (attempt + 1))
        except Exception:
            time.sleep(BACKOFF * (attempt + 1))
    return None


def get_token(client):
    """从 tcmsp.php 隐藏 input 取免费 token。"""
    html = _get(client, f"{BASE}/tcmsp.php")
    if not html:
        return None
    m = re.search(r'name="token"[^>]*value="([^"]*)"', html)
    return m.group(1) if m else None


def extract_kendo_data_array(html):
    """稳健提取页内第一个 kendoGrid dataSource 的 data:[...]（括号配平）。"""
    idx = html.find("kendoGrid")
    if idx < 0:
        idx = 0
    m = re.compile(r"data\s*:\s*\[").search(html, idx)
    if not m:
        return None
    start = m.end() - 1
    depth = 0
    in_str = False
    esc = False
    for i in range(start, len(html)):
        ch = html[i]
        if in_str:
            if esc:
                esc = False
            elif ch == "\\":
                esc = True
            elif ch == '"':
                in_str = False
            continue
        if ch == '"':
            in_str = True
        elif ch == "[":
            depth += 1
        elif ch == "]":
            depth -= 1
            if depth == 0:
                return html[start:i + 1]
    return None


def fetch_herb_index(client):
    """抓全部药材索引，返回 {herb_cn_name: {pinyin, latin}}。"""
    html = _get(client, f"{BASE}/browse.php", params={"qc": "herbs"})
    if not html:
        return {}
    arr = extract_kendo_data_array(html)
    if not arr:
        return {}
    try:
        herbs = json.loads(arr)
    except json.JSONDecodeError:
        return {}
    idx = {}
    for h in herbs:
        cn = h.get("herb_cn_name")
        if cn and cn not in idx:
            idx[cn] = {"pinyin": h.get("herb_pinyin"), "latin": h.get("herb_en_name")}
    return idx


def fetch_herb_compounds(client, token, latin):
    """取某药材详情页的 compound 列表（含 ob/dl 真实值）。返回 list[dict]。"""
    html = _get(client, f"{BASE}/tcmspsearch.php",
                params={"qr": latin, "qsr": "herb_en_name", "token": token})
    if not html:
        return []
    arr = extract_kendo_data_array(html)
    if not arr:
        return []
    try:
        data = json.loads(arr)
    except json.JSONDecodeError:
        return []
    return data if isinstance(data, list) else []


def aggregate_ob_dl(compounds):
    """按 TCMSP 阈值过滤活性 compound 并聚合。返回 dict 或 None（无达标成分）。"""
    active = []
    for c in compounds:
        try:
            ob = float(c.get("ob"))
            dl = float(c.get("dl"))
        except (TypeError, ValueError):
            continue
        if ob >= OB_THRESHOLD and dl >= DL_THRESHOLD:
            active.append((ob, dl))
    if not active:
        return None
    obs = [o for o, _ in active]
    dls = [d for _, d in active]
    ob_mean = round(statistics.fmean(obs), 2)
    dl_median = round(statistics.median(dls), 4)
    return {
        "ob_percent": ob_mean,
        "dl_value": dl_median,
        "bioavailability_score": round(ob_mean / BIO_DENOM, 4),
        "n_compounds": len(active),
        "n_total": len(compounds),
    }


# ────────────────────────── sidecar（provenance + 备份）──────────────────────────

def load_sidecar():
    if SIDECAR.exists():
        try:
            return json.loads(SIDECAR.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            return {}
    return {}


def save_sidecar(data):
    SIDECAR.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def backup_original(sidecar, mid, name_cn, orig):
    """按 id 键控备份原值；已有备份不覆盖（保留首次原值，保证可回滚到最初）。"""
    key = str(mid)
    if key in sidecar.get("materials", {}):
        return False
    sidecar.setdefault("materials", {})[key] = {
        "id": mid, "name_cn": name_cn, "original": orig,
    }
    return True


# ────────────────────────── 主流程 ──────────────────────────

async def run(dry_run):
    import asyncpg
    conn = await asyncpg.connect(DB_DSN)
    sidecar = load_sidecar()
    updated = corrected = filled = skipped_nocompound = 0
    plan = []
    try:
        rows = await conn.fetch(
            "SELECT id, name_cn, ob_percent, dl_value, bioavailability_score, "
            "source_db, data_quality FROM food_materials ORDER BY id")
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
            print(f"TCMSP 药材索引 {len(index)} 味；token={token[:8]}...")

            matched = [(r["id"], r["name_cn"], index[r["name_cn"]])
                       for r in rows if r["name_cn"] in index]
            # 幂等前置过滤：已是 tcm_sp 来源的行视为已处理，跳过（重跑 0 抓取/0 更新）
            already = [m for m in matched if
                       rows[[r["id"] for r in rows].index(m[0])]["source_db"] == SOURCE_DB]
            matched = [m for m in matched if m not in already]
            print(f"food_materials={len(rows)} 行；name_cn 精确命中 TCMSP={len(matched) + len(already)} 行"
                  f"（其中已处理跳过={len(already)}）；未命中留空={len(rows) - len(matched) - len(already)} 行\n")

            for mid, name_cn, meta in matched:
                latin = meta["latin"]
                compounds = fetch_herb_compounds(client, token, latin)
                time.sleep(PER_REQUEST_SLEEP)
                agg = aggregate_ob_dl(compounds)
                if not agg:
                    skipped_nocompound += 1
                    plan.append((mid, name_cn, None, "无达标活性 compound(OB>=30&DL>=0.18)，留空"))
                    continue
                orig = {
                    "ob_percent": rows[[r["id"] for r in rows].index(mid)]["ob_percent"],
                    "dl_value": rows[[r["id"] for r in rows].index(mid)]["dl_value"],
                    "bioavailability_score": rows[[r["id"] for r in rows].index(mid)]["bioavailability_score"],
                    "source_db": rows[[r["id"] for r in rows].index(mid)]["source_db"],
                    "data_quality": rows[[r["id"] for r in rows].index(mid)]["data_quality"],
                }
                is_correction = orig["ob_percent"] is not None or orig["dl_value"] is not None
                action = "纠正伪数据" if is_correction else "填充空值"
                plan.append((mid, name_cn, agg, action))
                if not dry_run:
                    backup_original(sidecar, mid, name_cn, orig)
                    await conn.execute(
                        "UPDATE food_materials SET ob_percent=$2, dl_value=$3, "
                        "bioavailability_score=$4, source_db=$5, data_quality=$6, "
                        "updated_at=NOW() WHERE id=$1 AND source_db IS DISTINCT FROM $5",
                        mid, agg["ob_percent"], agg["dl_value"],
                        agg["bioavailability_score"], SOURCE_DB, DATA_QUALITY)
                    updated += 1
                    if is_correction:
                        corrected += 1
                    else:
                        filled += 1

        # ── 报告 ──
        print("=== 计划 ===")
        for mid, name_cn, agg, action in plan:
            if agg:
                print(f"  id={mid} {name_cn}: [{action}] ob={agg['ob_percent']} "
                      f"dl={agg['dl_value']} bio={agg['bioavailability_score']} "
                      f"(活性 compound {agg['n_compounds']}/{agg['n_total']})")
            else:
                print(f"  id={mid} {name_cn}: 留空 — {action}")
        n_agg = sum(1 for p in plan if p[2])
        print("\n=== 统计 ===")
        print(f"  可算出 OB/DL：{n_agg} 行（填充空值 {filled} + 纠正伪数据 {corrected}）"
              if not dry_run else f"  可算出 OB/DL：{n_agg} 行（dry-run 未写库）")
        print(f"  无达标活性成分留空：{skipped_nocompound} 行")
        print(f"  name_cn 未命中 TCMSP（诚实留空）：{len(rows) - len(matched)} 行")
        if not dry_run:
            save_sidecar(sidecar)
            print(f"\n[APPLY] 更新 {updated} 行；source_db={SOURCE_DB} data_quality={DATA_QUALITY}")
            print(f"[APPLY] 备份/provenance 已写入 {SIDECAR.name}（{len(sidecar.get('materials', {}))} 行）")
        else:
            print("\n[dry-run] 未写库。确认后执行： "
                  "python scripts/tcmsp_backfill_obdl.py --apply --yes-i-know")
    finally:
        await conn.close()


async def restore():
    sidecar = load_sidecar()
    mats = sidecar.get("materials", {})
    if not mats:
        print("[restore] sidecar 无备份，无需回滚。")
        return
    import asyncpg
    conn = await asyncpg.connect(DB_DSN)
    n = 0
    try:
        for key, rec in mats.items():
            o = rec["original"]
            await conn.execute(
                "UPDATE food_materials SET ob_percent=$2, dl_value=$3, "
                "bioavailability_score=$4, source_db=$5, data_quality=$6, "
                "updated_at=NOW() WHERE id=$1",
                rec["id"], o["ob_percent"], o["dl_value"],
                o["bioavailability_score"], o["source_db"], o["data_quality"])
            n += 1
        print(f"[restore] 已回滚 {n} 行到原值（ob/dl/bio/source_db/data_quality）。")
        print("[restore] 提示：sidecar 备份保留未删，如需清空请手动处理。")
    finally:
        await conn.close()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true", help="实际写库（默认 dry-run）")
    ap.add_argument("--yes-i-know", action="store_true", help="--apply 的二次确认硬守卫")
    ap.add_argument("--restore", action="store_true", help="从 sidecar 回滚到原值")
    args = ap.parse_args()

    if args.restore:
        asyncio.run(restore())
        return
    if args.apply and not args.yes_i_know:
        print("[REFUSING] --apply 需二次确认：请加 --yes-i-know（先跑 dry-run 核对计划）。")
        sys.exit(3)
    asyncio.run(run(dry_run=not args.apply))


if __name__ == "__main__":
    main()
