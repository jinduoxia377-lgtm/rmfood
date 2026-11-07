# -*- coding: utf-8 -*-
"""用 Open Prices 开放 API（Open Food Facts 旗下，免费无 key，ODbL）补 retail_products 的 price/currency。

数据源：GET https://prices.openfoodfacts.org/api/v1/prices?product_code={barcode}&size=100
  响应 {items:[...], page, pages, size, total}；每 item 含 price/currency/price_per/date/...
  无 key，ODbL 许可，社区服务 → 礼貌限流（每请求 sleep + 429 长退避重试）。

范围：仅 source='openfoodfacts' 且 external_id 为条码的 100 行；manual 行（58 行中文产品）不动。

价格聚合（同条码多价格，如实反映）：
  1) 仅取 price 非 None 且 >0 的观测；
  2) 按 currency 分组，取**众数币种**（观测条数最多的币种）；
  3) price = 该众数币种下所有观测价的**中位数**（稳健、抗单条极端值）；
  4) 若存在被舍弃的少数币种观测，如实降低 data_quality（多币种=0.80，单币种=0.90）。
  绝不跨币种硬折算汇率（无合规汇率源，折算即伪造）。

诚实不伪造：
  - Open Prices total=0（无该条码价格）→ 留空跳过；
  - 全部观测 price 缺失/为 0 → 留空跳过；
  - 非条码 external_id（如 'probiotics'）→ API 自然 total=0，留空。

only-fill 与覆盖（一处有意覆盖，见下）：
  - 仅处理当前 price IS NULL 的行（幂等：重跑因 price 已非空而 0 更新）；
  - **currency 会随 price 一并写入**：现有 currency 是 OFF 导入的占位 'CNY'（100/100 行皆 CNY，
    连摩洛哥 611xxx 产品也标 CNY），并非真实观测币种。若只填 price 会造出「EUR 价挂 CNY 标」
    的错配垃圾。故本脚本把 (price, currency) 作为一组真实观测值一并写入并覆盖占位 CNY，
    且在 BACKUP_PATH 备份原始 price/currency/data_quality 以便回滚。这是唯一覆盖点，已在此明示。

用法：
  python scripts/openprices_backfill_price.py                       # dry-run：打印计划+覆盖率，不写库
  python scripts/openprices_backfill_price.py --apply               # 二次确认后写库
  python scripts/openprices_backfill_price.py --apply --yes-i-know  # 确认守卫通过，写库
"""
import argparse
import asyncio
import json
import statistics
import sys
import time
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import httpx

DB_DSN = "postgresql://postgres:password@localhost:5432/rmfood"
API_BASE = "https://prices.openfoodfacts.org/api/v1/prices"
USER_AGENT = "RMFOOD-DataPipeline/1.0"
BACKUP_PATH = Path(__file__).resolve().parent / "openprices_backfill_backup.json"

# 限流/重试（社区服务，礼貌）
PER_REQUEST_SLEEP = 0.6   # 每请求后 sleep，≈100 req/min 以下
RETRIES = 4               # 网络/429 重试次数
BACKOFF = 1.5             # 指数退避基数
TIMEOUT = 20.0
FETCH_SIZE = 100          # 单条码最多取 100 条价格（足够算中位数/众数）

DQ_SINGLE_CUR = 0.90      # 单币种、多观测，置信高
DQ_MULTI_CUR = 0.80       # 存在少数异币种被舍弃，如实降级


def _is_empty(val) -> bool:
    if val is None:
        return True
    if isinstance(val, (list, tuple, dict)):
        return len(val) == 0
    return str(val).strip() == ""


def aggregate(items):
    """把一个条码的价格观测聚合成 (price, currency, n_used, n_total, multi_cur)。

    返回 None 表示无可用价格（诚实跳过）。
    """
    obs = [(it.get("price"), it.get("currency"))
           for it in items
           if isinstance(it.get("price"), (int, float)) and it.get("price") > 0
           and it.get("currency")]
    if not obs:
        return None
    n_total = len(obs)
    by_cur = {}
    for p, c in obs:
        by_cur.setdefault(c, []).append(p)
    # 众数币种 = 观测条数最多的币种（平票取价格观测更多者；再平取字典序，确定性）
    dom_cur = sorted(by_cur.items(), key=lambda kv: (-len(kv[1]), kv[0]))[0][0]
    prices = by_cur[dom_cur]
    price = statistics.median(prices)
    multi = len(by_cur) > 1
    return price, dom_cur, len(prices), n_total, multi


def fetch_prices(client, barcode):
    """带重试的 Open Prices 查询。返回 (total, items, status)。"""
    url = f"{API_BASE}?product_code={barcode}&size={FETCH_SIZE}"
    last = None
    for attempt in range(RETRIES):
        try:
            r = client.get(url)
            if r.status_code == 200:
                d = r.json()
                return (d.get("total") or 0, d.get("items") or [], "ok")
            if r.status_code == 429:
                wait = max(8.0 * (attempt + 1), 8.0)
                print(f"      [429] {barcode} 限流，{wait:.0f}s 后重试 "
                      f"({attempt + 1}/{RETRIES})", flush=True)
                time.sleep(wait)
                last = "rate_limited"
                continue
            return 0, [], f"http{r.status_code}"
        except Exception as e:
            wait = BACKOFF ** attempt
            print(f"      [retry] {barcode} {type(e).__name__}，{wait:.1f}s 后重试 "
                  f"({attempt + 1}/{RETRIES})", flush=True)
            time.sleep(wait)
            last = f"error:{type(e).__name__}"
    return 0, [], (last or "error")


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true", help="实际写库（默认 dry-run）")
    ap.add_argument("--yes-i-know", action="store_true", help="--apply 的二次确认硬守卫")
    args = ap.parse_args()

    if args.apply and not args.yes_i_know:
        print("[REFUSING] --apply 需二次确认：请加 --yes-i-know（先跑 dry-run 核对计划/覆盖率）。")
        sys.exit(3)

    import asyncpg
    conn = await asyncpg.connect(DB_DSN)
    client = httpx.Client(timeout=TIMEOUT, headers={"User-Agent": USER_AGENT})
    try:
        rows = await conn.fetch(
            "SELECT id, external_id, product_name, price, currency, data_quality "
            "FROM retail_products WHERE source='openfoodfacts' "
            "AND external_id IS NOT NULL AND external_id <> '' "
            "AND price IS NULL ORDER BY id")   # only-fill：仅 price 为空的行
        total_off = await conn.fetchval(
            "SELECT COUNT(*) FROM retail_products WHERE source='openfoodfacts'")
        print("### Open Prices -> retail_products price/currency 回填（默认 dry-run）###")
        print(f"OFF 行总数={total_off}；其中 price 为空待补={len(rows)}")

        before = await conn.fetchrow(
            "SELECT COUNT(*) FILTER (WHERE price IS NOT NULL) AS price_filled, "
            "       COUNT(*) FILTER (WHERE currency IS NOT NULL AND currency<>'') AS cur_filled "
            "FROM retail_products WHERE source='openfoodfacts'")

        plan = []        # (row, price, cur, n_used, n_total, dq)
        no_price = []    # Open Prices total=0 / 无有效价
        net_fail = []    # 网络/限流耗尽（非数据缺失，可重跑）
        have_count = 0
        for idx, row in enumerate(rows, 1):
            barcode = row["external_id"]
            total, items, status = fetch_prices(client, barcode)
            if status == "ok":
                if total > 0:
                    have_count += 1
                agg = aggregate(items)
                if agg is None:
                    no_price.append((row["id"], barcode))
                    print(f"  [{idx}/{len(rows)}] id={row['id']} {barcode} -> 无有效价格，诚实留空", flush=True)
                else:
                    price, cur, n_used, n_total, multi = agg
                    dq = DQ_MULTI_CUR if multi else DQ_SINGLE_CUR
                    plan.append((row, price, cur, n_used, n_total, dq))
                    print(f"  [{idx}/{len(rows)}] id={row['id']} {barcode} -> 中位价 {price} {cur} "
                          f"(用 {n_used}/{n_total} 条{'，多币种' if multi else ''})", flush=True)
            elif status == "rate_limited":
                net_fail.append((row["id"], barcode, status))
                print(f"  [{idx}/{len(rows)}] id={row['id']} {barcode} -> 429 限流耗尽，非数据缺失可重跑", flush=True)
            else:
                # 含 http4xx/网络错误/total=0（total=0 时 status 也是 ok，已在上分支）
                no_price.append((row["id"], barcode))
                print(f"  [{idx}/{len(rows)}] id={row['id']} {barcode} -> 无价格({status})，诚实留空", flush=True)
            time.sleep(PER_REQUEST_SLEEP)

        cov = have_count / len(rows) * 100 if rows else 0.0
        print(f"\n=== 计划：将改动 {len(plan)} 行；无价格 {len(no_price)} 行；"
              f"限流/网络失败 {len(net_fail)} 行 ===")
        print(f"=== 覆盖率：有价条码 {have_count}/{len(rows)} = {cov:.1f}% ===")
        print(f"before 完整度：price {before['price_filled']}/{total_off}，"
              f"currency {before['cur_filled']}/{total_off}（注：currency 现为占位 CNY，将随 price 一并纠正）")
        print("将改动行明细：")
        for row, price, cur, n_used, n_total, dq in plan:
            print(f"  id={row['id']} {row['external_id']} {row['product_name'][:22]!r} -> "
                  f"price={price} currency={cur}（{n_used}/{n_total}条, dq={dq}）  "
                  f"原 price={row['price']} currency={row['currency']}")
        if net_fail:
            print("  限流/网络失败行（非数据缺失，可重跑补）: "
                  + ", ".join(f"id={r[0]}({r[1]})" for r in net_fail))

        if not args.apply:
            print("\n[dry-run] 未写库。确认后执行： "
                  "python scripts/openprices_backfill_price.py --apply --yes-i-know")
            return

        # ── 可回滚：备份被改动的 price/currency/data_quality 原值 ──
        backup = {
            "generated_at": datetime.now().isoformat(),
            "note": "Open Prices 回填前原值快照（仅被改动行）。currency 原多为占位 CNY，"
                    "本回填以真实观测 (price,currency) 一并覆盖占位值，可据此回滚。",
            "rows": [{"id": r["id"], "external_id": r["external_id"],
                      "original": {"price": r["price"], "currency": r["currency"],
                                   "data_quality": r["data_quality"]}}
                     for r, *_ in plan],
        }
        BACKUP_PATH.write_text(json.dumps(backup, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"\n[备份] 原值已写入 {BACKUP_PATH.name}（{len(backup['rows'])} 行）")

        # ── 写库（WHERE price IS NULL 守卫，幂等；不碰 search_tokens/search_vector）──
        updated = 0
        for row, price, cur, n_used, n_total, dq in plan:
            res = await conn.execute(
                "UPDATE retail_products SET price=$2, currency=$3, data_quality=$4, "
                "updated_at=NOW() WHERE id=$1 AND price IS NULL",
                row["id"], price, cur, dq)
            if res.split()[-1] != "0":
                updated += 1
        after = await conn.fetchrow(
            "SELECT COUNT(*) FILTER (WHERE price IS NOT NULL) AS price_filled, "
            "       COUNT(*) FILTER (WHERE currency IS NOT NULL AND currency<>'') AS cur_filled "
            "FROM retail_products WHERE source='openfoodfacts'")
        print(f"\n[APPLY] 改动 {updated} 行")
        print(f"[APPLY] after 完整度：price {after['price_filled']}/{total_off}，"
              f"currency {after['cur_filled']}/{total_off}")
        print("[APPLY] price 为数值，不影响 search_vector/search_tokens，无需重算 token；后端未重启")
        print("[APPLY] 来源=Open Prices(ODbL)，已记录 data_quality + updated_at=NOW()")
    finally:
        await conn.close()
        client.close()


if __name__ == "__main__":
    asyncio.run(main())
