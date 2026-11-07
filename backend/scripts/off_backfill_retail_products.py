# -*- coding: utf-8 -*-
"""用 Open Food Facts 开放 API 补全 retail_products 中 100 行 OFF 来源行的缺失字段。

合规/不伪造/可回滚：
  - 数据源：OFF API v2 `GET /api/v2/product/{barcode}.json`，免费无 key，ODbL 许可。
  - User-Agent: RMFOODFP/1.0 (复用 OFFClient 默认 UA)，遵守 OFF 合理使用（≤60 req/min）。
  - 限流：OFFClient 内置 TokenBucket(60rpm)；失败指数退避重试。
  - 仅补 OFF 来源行（source='openfoodfacts' 且有 external_id 条码）；manual 行不动。
  - only-fill 不覆盖：仅填空(NULL/空数组/空串)字段，非空一律跳过；幂等（重跑 0 更新）。
  - 绝不伪造：OFF 返回 ABSENT/None 的字段跳过、诚实留空（不碰 price/effects 等）。
  - 可回滚：改前把每行原值备份到 backend/scripts/off_backfill_backup.json。

字段映射（复用 OFFMapper，保持与既有导入管道一致）：
  categories_tags → category（OFFMapper._derive_category，取首个可读名，去 en: 前缀）
  image_front_url/image_* → image_urls（OFFMapper._extract_images）
  quantity + packaging → package_size
  allergens_tags → allergens_tags
  ingredients_text → full_ingredients
改 category / full_ingredients 后用 chinese_nlp.build_retail_search_tokens 重算
search_tokens_{a..d}（与 retail_products.py `_set_retail_search_tokens` 同一逻辑；
迁移 022 触发器据 token 列自动重建 search_vector，无需重启后端）。

用法：
  python scripts/off_backfill_retail_products.py                       # dry-run：打印计划，不写库
  python scripts/off_backfill_retail_products.py --apply               # 二次确认后写库
  python scripts/off_backfill_retail_products.py --apply --yes-i-know  # 确认守卫通过，写库
"""
import argparse
import asyncio
import json
import sys
import time
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services.openfoodfacts.client import OFFClient, RateLimitedError
from app.services.openfoodfacts.mapper import OFFMapper

DB_DSN = "postgresql://postgres:password@localhost:5432/rmfood"
DATA_QUALITY = 0.90
BACKUP_PATH = Path(__file__).resolve().parent / "off_backfill_backup.json"
# OFF 到本沙箱间歇可达（SSL/连接/读超时偶发，实测约 1/3 成功率）→ 网络层多重试 + 温和退避。
# 实测调参：attempts=6、backoff=1.5、单次超时 10s；成功率随重试显著提升。
NET_RETRIES = 6
NET_BACKOFF = 1.5
PER_ATTEMPT_TIMEOUT = 10.0


def _is_empty(val) -> bool:
    """空判定：None / 空串 / 空数组 / 空 dict。"""
    if val is None:
        return True
    if isinstance(val, (list, tuple, dict)):
        return len(val) == 0
    return str(val).strip() == ""


def fetch_product(client: OFFClient, barcode: str):
    """带网络层重试的条码查询（覆盖 SSL/连接类瞬态错误）。

    返回 (product_or_None, status)：
      status='ok'       -> product 为 dict
      status='not_found'-> OFF 明确 404（该条码不存在，非瞬态）
      status='error'    -> 网络失败（超时/连接，可重试）
    """
    last_err = None
    for attempt in range(NET_RETRIES):
        try:
            product = client.search_by_barcode(barcode)
            return product, ("ok" if product else "not_found")
        except RateLimitedError as e:
            # 429 限流：非「不存在」。用 Retry-After（或递增长退避）等待后重试，
            # 绝不当成数据缺失留空。
            wait = max(e.retry_after or 0.0, 10.0 * (attempt + 1))
            print(f"    [429] {barcode} 被限流，{wait:.0f}s 后重试 "
                  f"({attempt + 1}/{NET_RETRIES})", flush=True)
            time.sleep(wait)
            last_err = e
            continue
        except Exception as e:  # httpx.ConnectError / SSL / ReadTimeout 等网络瞬态
            # 共享 client 的已知缺陷：连接异常时 response 未绑定即访问 .status_code，
            # 抛 AttributeError —— 属代码级错误，重试无意义，立即失败。
            if isinstance(e, AttributeError):
                if attempt < NET_RETRIES - 1:
                    time.sleep(0.5)
                    continue
                return None, f"error:{type(e).__name__}"
            last_err = e
            wait = NET_BACKOFF ** attempt
            print(f"    [retry] {barcode} 网络错误 {type(e).__name__}: {wait:.1f}s 后重试 "
                  f"({attempt + 1}/{NET_RETRIES})", flush=True)
            time.sleep(wait)
    # 重试耗尽：区分「限流耗尽」与「网络失败」
    if isinstance(last_err, RateLimitedError):
        return None, "rate_limited"
    return None, f"error:{type(last_err).__name__}"


def extract_fields(product: dict, mapper: OFFMapper) -> dict:
    """从 OFF product 提取本次要回填的目标字段（复用 OFFMapper 逻辑）。"""
    mapped = mapper.map_product(product) or {}

    category = mapped.get("category")

    image_urls = mapped.get("image_urls") or []
    if not image_urls and product.get("image_url"):
        url = str(product["image_url"]).strip()
        if url.startswith("//"):
            url = "https:" + url
        image_urls = [url]

    quantity = (product.get("quantity") or "").strip()
    packaging = (product.get("packaging") or "").strip()
    if quantity and packaging and quantity.lower() != packaging.lower():
        package_size = f"{quantity} ({packaging})"
    else:
        package_size = quantity or packaging or None

    allergens_tags = product.get("allergens_tags") or []
    if isinstance(allergens_tags, str):
        allergens_tags = [t.strip() for t in allergens_tags.split(",") if t.strip()]

    full_ingredients = mapped.get("full_ingredients")

    return {
        "category": category,
        "image_urls": image_urls,
        "package_size": package_size,
        "allergens_tags": allergens_tags,
        "full_ingredients": full_ingredients,
    }


async def recompute_search_tokens(conn, product_id: int) -> None:
    """用最终行值重算 search_tokens_{a..d}（迁移 022 触发器据 token 重建 search_vector）。"""
    from app.services.search.chinese_nlp import get_nlp_pipeline

    row = await conn.fetchrow(
        "SELECT product_name, brand, category, sub_category, effects, target_population, "
        "full_ingredients, formulation_type, key_ingredients "
        "FROM retail_products WHERE id=$1", product_id)
    if not row:
        return
    nlp = get_nlp_pipeline()
    tok = nlp.build_retail_search_tokens(
        product_name=row["product_name"],
        brand=row["brand"],
        category=row["category"],
        sub_category=row["sub_category"],
        effects=row["effects"],
        target_population=row["target_population"],
        full_ingredients=row["full_ingredients"],
        formulation_type=row["formulation_type"],
        key_ingredients=row["key_ingredients"],
    )
    await conn.execute(
        "UPDATE retail_products SET search_tokens_a=$2, search_tokens_b=$3, "
        "search_tokens_c=$4, search_tokens_d=$5, updated_at=NOW() WHERE id=$1",
        product_id, tok["a"], tok["b"], tok["c"], tok["d"])


async def completeness(conn):
    """OFF 行目标字段完整度（前后对比用）。"""
    total = await conn.fetchval("SELECT COUNT(*) FROM retail_products WHERE source='openfoodfacts'")
    out = {"_total": total}
    for col in ("category", "image_urls", "package_size", "allergens_tags", "full_ingredients"):
        n = await conn.fetchval(
            f"SELECT COUNT(*) FROM retail_products WHERE source='openfoodfacts' "
            f"AND {col} IS NOT NULL AND {col}::text NOT IN ('', '{{}}', '[]')")
        out[col] = n
    return out


def print_completeness(label, c):
    total = c["_total"]
    print(f"  [{label}] OFF 行={total}")
    for col in ("category", "image_urls", "package_size", "allergens_tags", "full_ingredients"):
        print(f"    {col}: {c[col]}/{total} 非空")


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true", help="实际写库（默认 dry-run）")
    ap.add_argument("--yes-i-know", action="store_true", help="--apply 的二次确认硬守卫")
    args = ap.parse_args()

    if args.apply and not args.yes_i_know:
        print("[REFUSING] --apply 需二次确认：请加 --yes-i-know（先跑 dry-run 核对计划）。")
        sys.exit(3)

    import asyncpg
    conn = await asyncpg.connect(DB_DSN)
    client = OFFClient()
    # 收紧单次请求超时（OFF 间歇可达，长超时会拖慢整体；配合多重试）
    client._http_client.timeout = PER_ATTEMPT_TIMEOUT
    mapper = OFFMapper()
    try:
        rows = await conn.fetch(
            "SELECT id, external_id, product_name, category, image_urls, package_size, "
            "allergens_tags, full_ingredients "
            "FROM retail_products WHERE source='openfoodfacts' "
            "AND external_id IS NOT NULL AND external_id <> '' ORDER BY id")
        print("### OFF 回填管道 —— 默认 dry-run，仅补 OFF 来源行，只填空不覆盖 ###")
        print(f"待处理 OFF 行数: {len(rows)}")
        before = await completeness(conn)
        print_completeness("before", before)

        plan = []      # (row, fields, to_fill dict)
        not_found = []  # OFF 明确 404：条码不存在（非瞬态，不伪造）
        net_fail = []   # 网络失败：超时/连接（可重试，本轮未取到）
        rate_limited = []  # 429 限流耗尽（非数据缺失，可重跑）
        for idx, row in enumerate(rows, 1):
            barcode = row["external_id"]
            product, status = fetch_product(client, barcode)
            if status == "ok":
                fields = extract_fields(product, mapper)
                # only-fill：仅保留目标为空的字段
                to_fill = {}
                for col, val in fields.items():
                    if _is_empty(val):
                        continue
                    if _is_empty(row[col]):
                        to_fill[col] = val
                filled = ",".join(to_fill.keys()) if to_fill else "-"
                print(f"  [{idx}/{len(rows)}] id={row['id']} {barcode} 抓取OK 可补[{filled}]", flush=True)
                if to_fill:
                    plan.append((row, fields, to_fill))
            elif status == "not_found":
                not_found.append((row["id"], barcode))
                print(f"  [{idx}/{len(rows)}] id={row['id']} {barcode} -> OFF 无此条码(404)，"
                      f"诚实留空不伪造", flush=True)
            elif status == "rate_limited":
                rate_limited.append((row["id"], barcode))
                print(f"  [{idx}/{len(rows)}] id={row['id']} {barcode} -> 429 限流耗尽，"
                      f"非数据缺失，可重跑", flush=True)
            else:
                net_fail.append((row["id"], barcode, status))
                print(f"  [{idx}/{len(rows)}] id={row['id']} {barcode} -> 网络失败({status})，"
                      f"本轮未取到", flush=True)
            time.sleep(0.3)  # 额外限流缓冲（叠加 TokenBucket）

        print(f"\n=== 计划：将改动 {len(plan)} 行；OFF 无此条码(404) {len(not_found)} 行；"
              f"429 限流耗尽 {len(rate_limited)} 行；网络失败 {len(net_fail)} 行 ===")
        if rate_limited:
            print("  429 限流行（非数据缺失，稍后重跑即可补）: "
                  + ", ".join(f"id={r[0]}({r[1]})" for r in rate_limited))
        if net_fail:
            print("  网络失败行（OFF 间歇可达，非数据缺失，可重跑）: "
                  + ", ".join(f"id={r[0]}({r[1]})" for r in net_fail))
        for row, _f, to_fill in plan:
            summary = "; ".join(
                f"{c}={'image_urls' if c == 'image_urls' else str(v)[:28]}"
                for c, v in to_fill.items())
            print(f"  id={row['id']} {row['external_id']} {row['product_name'][:22]!r} -> {summary}")

        # 统计各字段将补多少
        from collections import Counter
        colcnt = Counter(c for _r, _f, tf in plan for c in tf)
        print("将补字段计数: " + "; ".join(f"{k}={v}" for k, v in colcnt.items()))

        if not args.apply:
            print("\n[dry-run] 未写库。确认后执行： "
                  "python scripts/off_backfill_retail_products.py --apply --yes-i-know")
            return

        # ── 可回滚：改前备份原值 ──
        backup = {
            "generated_at": datetime.now().isoformat(),
            "note": "OFF 回填前原值快照（仅含被改动的行/字段），可直接据此回滚。",
            "rows": [],
        }
        for row, _f, to_fill in plan:
            backup["rows"].append({
                "id": row["id"],
                "external_id": row["external_id"],
                "original": {c: row[c] for c in to_fill},
            })
        BACKUP_PATH.write_text(
            json.dumps(backup, ensure_ascii=False, indent=2, default=str), encoding="utf-8")
        print(f"\n[备份] 原值已写入 {BACKUP_PATH.name}（{len(backup['rows'])} 行）")

        # ── 写库（逐字段 only-fill 守卫，幂等）──
        updated_rows = 0
        retokenized = 0
        array_cols = {"image_urls", "allergens_tags"}
        for row, _f, to_fill in plan:
            sets = []
            vals = []
            i = 2  # $1 = id
            for col, val in to_fill.items():
                cast = "::text[]" if col in array_cols else ""
                sets.append(f"{col}=${i}{cast}")
                vals.append(val)
                i += 1
            # 追加 data_quality/updated_at 记录（retail_products 无 source_db 列；
            # 来源已由 source='openfoodfacts' 标识，回填后更新 data_quality + updated_at）
            sets.append(f"data_quality=${i}")
            vals.append(DATA_QUALITY)
            i += 1
            sets.append("updated_at=NOW()")
            # 仅当所有目标字段当前仍为空才更新（WHERE 守卫保证幂等 + 不覆盖）
            guard = " AND ".join(f"{c} IS NULL" for c in to_fill)
            sql = f"UPDATE retail_products SET {', '.join(sets)} WHERE id=$1 AND {guard}"
            res = await conn.execute(sql, row["id"], *vals)
            if res.split()[-1] != "0":
                updated_rows += 1
                if "category" in to_fill or "full_ingredients" in to_fill:
                    await recompute_search_tokens(conn, row["id"])
                    retokenized += 1

        after = await completeness(conn)
        print(f"\n[APPLY] 改动 {updated_rows} 行；重算 search_tokens {retokenized} 行")
        print_completeness("after", after)
        print(f"[APPLY] source=openfoodfacts（已有），data_quality={DATA_QUALITY}，updated_at=NOW()")
        print("[APPLY] search_vector 由迁移022触发器据 search_tokens 自动重建，无需重启后端")
    finally:
        await conn.close()
        client.close()


if __name__ == "__main__":
    asyncio.run(main())
