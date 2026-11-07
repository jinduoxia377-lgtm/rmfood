# -*- coding: utf-8 -*-
"""为 food_materials 补 image_url（Wikimedia Commons 开放许可图片）。

数据源：Wikimedia Commons API（commons.wikimedia.org/w/api.php）
  - 免费开放、CC 授权（多为 CC-BY / CC-BY-SA / 公有领域）、可按名检索、无需 key。
  - 流程：list=search(学名优先) -> 取 File: 标题 -> prop=imageinfo 取直接 URL(thumburl/url)。
  - 礼貌限流：每请求 sleep ~0.5s + 4 重试指数退避 + UA 标识 RMFOODFP/1.0。

字段：只填 image_url（varchar 500，存 800px thumburl，稳定且前端可直接用）。
  - only-fill 幂等：WHERE image_url IS NULL；重跑 0 更新。
  - 绝不伪造：检索不到/非栅格图(排除 pdf/svg)/歧义条目 -> 留空跳过。
  - 来源可追溯：source_db 已有法规溯源值(china_food_regulations 等)故不覆盖；图片溯源写入
    sidecar 清单 backend/scripts/food_material_images_provenance.json（id->url/file/method）。

精度策略（三层，逐层降置信）：
  1) 人工权威学名映射 SCI_NAMES（最准）-> 搜学名，命中标题含学名的栅格图 -> data_quality 标 HIGH
  2) 无学名 -> 搜中文名，仅取标题含中文名/常见词的栅格图 -> 标 MEDIUM
  3) 兜底搜中文名取首个栅格图 -> 标 LOW（可能错配，dry-run 列出供复核，apply 可选 --include-low 才写）
歧义/加工品类（阿胶 等）明确 SKIP，不硬填。

用法：
  python scripts/enrich_food_material_images.py                          # dry-run
  python scripts/enrich_food_material_images.py --apply --yes-i-know     # 写库（HIGH+MEDIUM）
  python scripts/enrich_food_material_images.py --apply --yes-i-know --include-low  # 连 LOW 也写
"""
import argparse
import asyncio
import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import httpx

DB_DSN = "postgresql://postgres:password@localhost:5432/rmfood"
UA = "RMFOODFP/1.0 (open-source herb image enrichment; dev@rmfoodfp.local)"
COMMONS = "https://commons.wikimedia.org/w/api.php"
BACKUP_PATH = Path(__file__).resolve().parent / "food_material_images_provenance.json"

RASTER = ("image/jpeg", "image/png", "image/webp", "image/tiff")
THUMB_WIDTH = 800
PER_REQUEST_SLEEP = 0.15
RETRIES = 4
BACKOFF = 1.5

DQ_HIGH = 0.90   # 学名精确匹配
DQ_MED = 0.75    # 中文名标题匹配
DQ_LOW = 0.55    # 兜底首命中（可能错配）

# 人工权威学名映射（中文名 -> 拉丁学名）。覆盖常见药食同源药材；无把握的不硬塞。
SCI_NAMES = {
    "枸杞子": "Lycium barbarum", "山药": "Dioscorea polystachya", "黄芪": "Astragalus membranaceus",
    "人参": "Panax ginseng", "桂花": "Osmanthus fragrans", "金银花": "Lonicera japonica",
    "山楂": "Crataegus pinnatifida", "薏苡仁": "Coix lacryma-jobi", "大豆": "Glycine max",
    "黑芝麻": "Sesamum indicum", "核桃仁": "Juglans regia", "八角茴香": "Illicium verum",
    "白扁豆": "Lablab purpureus", "白果": "Ginkgo biloba", "白芷": "Angelica dahurica",
    "百合": "Lilium lancifolium", "薄荷": "Mentha haplocalyx", "草果": "Amomum tsaoko",
    "赤小豆": "Vigna angularis", "当归": "Angelica sinensis", "党参": "Codonopsis pilosula",
    "地黄": "Rehmannia glutinosa", "丁香": "Syzygium aromaticum", "甘草": "Glycyrrhiza uralensis",
    "菊花": "Chrysanthemum morifolium", "麦芽": "Hordeum vulgare", "木瓜": "Chaenomeles speciosa",
    "普洱茶": "Camellia sinensis", "桑葚": "Morus alba", "砂仁": "Amomum villosum",
    "山药豆": "Dioscorea polystachya", "生姜": "Zingiber officinale", "石榴": "Punica granatum",
    "丝瓜": "Luffa aegyptiaca", "桃仁": "Prunus persica", "甜杏仁": "Prunus dulcis",
    "小茴香": "Foeniculum vulgare", "薤白": "Allium chinense", "玄参": "Scrophularia ningpoensis",
    "紫苏": "Perilla frutescens", "肉豆蔻": "Myristica fragrans", "胡椒": "Piper nigrum",
    "花椒": "Zanthoxylum bungeanum", "莲子": "Nelumbo nucifera", "荷叶": "Nelumbo nucifera",
    "西洋参": "Panax quinquefolius", "罗汉果": "Siraitia grosvenorii", "火麻仁": "Cannabis sativa",
    "代代花": "Citrus aurantium", "佛手": "Citrus medica", "葛根": "Pueraria montana",
    "栀子": "Gardenia jasminoides", "决明子": "Cassia obtusifolia", "荔枝": "Litchi chinensis",
    "龙眼肉": "Dimocarpus longan", "罗汉果肉": "Siraitia grosvenorii", "白芍": "Paeonia lactiflora",
    "淡竹叶": "Lophatherum gracile", "菊花脑": "Chrysanthemum nankingense", "榧子": "Torreya grandis",
    "乌梅": "Prunus mume", "胖大海": "Sterculia lychnophora", "青果": "Canarium album",
    "肉苁蓉": "Cistanche deserticola", "玉竹": "Polygonatum odoratum", "黄精": "Polygonatum sibiricum",
    "苦丁茶": "Ilex kudingcha", "昆布": "Saccharina japonica",
    # —— 第二批：常见食材/药材（原走中文名兜底易错配，补学名提准）——
    "橘皮": "Citrus reticulata", "陈皮": "Citrus reticulata", "姜黄": "Curcuma longa",
    "桔梗": "Platycodon grandiflorum", "菊苣": "Cichorium intybus", "莱菔子": "Raphanus sativus",
    "灵芝": "Ganoderma lucidum", "马齿苋": "Portulaca oleracea", "玫瑰花": "Rosa rugosa",
    "墨旱莲": "Eclipta prostrata", "大米": "Oryza sativa", "小麦": "Triticum aestivum",
    "玉米": "Zea mays", "花生": "Arachis hypogaea", "大蒜": "Allium sativum",
    "高良姜": "Alpinia officinarum", "覆盆子": "Rubus idaeus", "蝮蛇": "Agkistrodon halys",
    "白扁豆花": "Lablab purpurascens", "荜茇": "Piper longum", "刀豆": "Canavalia gladiata",
    "杜仲叶": "Eucommia ulmoides", "杏叶": "Ginkgo biloba", "葛花": "Pueraria montana",
    "茯苓": "Wolfiporia extensa", "茯苓皮": "Wolfiporia extensa",
    "鲜芦根": "Phragmites australis", "鲜白茅根": "Imperata cylindrica",
    "何首乌": "Polygonum multiflorum", "石斛": "Dendrobium officinale",
    "知母": "Anemarrhena asphodeloides", "三七": "Panax notoginseng",
    "白茅根": "Imperata cylindrica", "芦根": "Phragmites australis", "淡菜": "Mytilus edulis",
    "牡蛎": "Ostrea gigas", "阿胶": "Equus asinus", "鸡内金": "Gallus gallus",
}

# 明确跳过：加工品/歧义/无稳图，不硬填
SKIP = {"阿胶", "淡豆豉", "神曲", "麦芽糖", "蜂蜜", "蜂胶"}


def is_raster(mime):
    return mime in RASTER


class Commons:
    def __init__(self):
        self.cl = httpx.Client(timeout=20.0, headers={"User-Agent": UA})
        self.count = 0

    def _get(self, params):
        for a in range(RETRIES):
            try:
                r = self.cl.get(COMMONS, params=params)
                if r.status_code == 200:
                    self.count += 1
                    return r.json()
                if r.status_code == 429:
                    wait = 8.0 * (a + 1)
                    time.sleep(wait)
                    continue
                return None
            except Exception:
                time.sleep(BACKOFF ** a)
        return None

    def search_and_info(self, term, limit=8):
        """单次请求：generator=search + prop=imageinfo，返回按相关性排序的 [(title, url)]（仅栅格图）。"""
        d = self._get({"action": "query", "format": "json", "generator": "search",
                       "gsrsearch": term, "gsrnamespace": "6", "gsrlimit": str(limit),
                       "prop": "imageinfo", "iiprop": "url|mime", "iiurlwidth": str(THUMB_WIDTH)})
        if not d:
            return []
        pages = d.get("query", {}).get("pages", {})
        cands = sorted(pages.values(), key=lambda p: p.get("index", 99))
        out = []
        for p in cands:
            ii = p.get("imageinfo", [])
            if ii and is_raster(ii[0].get("mime", "")):
                url = ii[0].get("thumburl") or ii[0].get("url")
                if url:
                    out.append((p.get("title"), url))
        return out

    def close(self):
        self.cl.close()


def find_image(c: Commons, cn, en):
    """返回 (url, file_title, method, dq) 或 None。method/dq 表明取图方式与置信。
    单次 search_and_info 请求（generator=search+imageinfo）取候选，逐层降置信。"""
    def resolve(term, sci_mode):
        cands = c.search_and_info(term)
        time.sleep(PER_REQUEST_SLEEP)
        if not cands:
            return None
        # 优先标题含关键词（学名/中文名）的文件
        for t, u in cands:
            tt = t.lower().replace(" ", "").replace("_", "")
            if term.lower().replace(" ", "") in tt:
                return (u, t, f"{'sci' if sci_mode else 'cn-title'}"
                              f"{':' + term if sci_mode else ''}",
                        DQ_HIGH if sci_mode else DQ_MED)
        # 标题不含关键词：学名模式仍可信（搜索按学名，首结果即该物种），降一档
        if sci_mode:
            t, u = cands[0]
            return (u, t, f"sci-broad:{term}", DQ_MED)
        # 中文名兜底：要求 Commons 标题与中文名至少共享一个汉字，否则视为错配弃用
        t, u = cands[0]
        if any(ch in t for ch in cn):
            return (u, t, "cn-fallback", DQ_LOW)
        return None

    # 1) 学名（最准）
    sci = SCI_NAMES.get(cn)
    if sci:
        r = resolve(sci, True)
        if r:
            return r
    # 2) 中文名
    r = resolve(cn, False)
    if r:
        return r
    return None


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--yes-i-know", action="store_true")
    ap.add_argument("--include-low", action="store_true", help="连带写入 LOW 置信(可能错配)的兜底命中")
    ap.add_argument("--report", default="",
                    help="把 dry-run 计划写入指定 JSON 文件（规避 stdout 捕获被中断，便于后台核对）")
    ap.add_argument("--id-min", type=int, default=0, help="只处理 id>=id-min 的行（分批用）")
    ap.add_argument("--id-max", type=int, default=0, help="只处理 id<=id-max 的行（分批用）")
    ap.add_argument("--rebuild-manifest", action="store_true",
                    help="不联网，从 DB 现有 image_url 重建溯源清单（只读 DB + 写 sidecar）")
    args = ap.parse_args()

    if args.apply and not args.yes_i_know:
        print("[REFUSING] --apply 需二次确认：请加 --yes-i-know（先 dry-run 核对命中率/明细）。")
        sys.exit(3)

    import asyncpg
    conn = await asyncpg.connect(DB_DSN)

    if args.rebuild_manifest:
        # 不联网：从 DB 现有 image_url（Wikimedia）重建溯源清单
        rows = await conn.fetch(
            "SELECT id, name_cn, image_url FROM food_materials "
            "WHERE image_url IS NOT NULL AND image_url<>'' AND image_url LIKE '%wikimedia%' ORDER BY id")
        items = []
        for r in rows:
            u = r["image_url"]
            # data_quality 无法从 URL 完全还原，按是否 thumb/学名不可辨 -> 记 0.75（保守）
            items.append({"id": r["id"], "name_cn": r["name_cn"], "image_url": u,
                          "commons_file": "(rebuilt from DB url)", "method": "rebuilt",
                          "data_quality": 0.75})
        manifest = {
            "generated_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
            "source": "Wikimedia Commons (CC / PD, via commons.wikimedia.org/w/api.php)",
            "note": "image_url 溯源清单（--rebuild-manifest 从 DB 重建，data_quality 为保守估计）。"
                    "source_db 未改动（保留法规溯源）。",
            "count": len(items),
            "items": items,
        }
        BACKUP_PATH.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"[rebuild-manifest] 已从 DB 重建 {BACKUP_PATH.name}（{len(items)} 条 image_url）")
        await conn.close()
        return

    c = Commons()
    try:
        rows = await conn.fetch(
            "SELECT id, name_cn, name_en, image_url FROM food_materials "
            "WHERE (image_url IS NULL OR image_url='') "
            "AND id >= $1 AND ($2 = 0 OR id <= $2) ORDER BY id",
            args.id_min, args.id_max)
        total = await conn.fetchval("SELECT COUNT(*) FROM food_materials")
        print("### food_materials image_url 回填（Wikimedia Commons，默认 dry-run）###")
        print(f"总行数={total}；image_url 为空待补={len(rows)}")

        plan = []   # (row, url, file, method, dq)
        skipped = []
        errors = []
        rep_path = Path(args.report) if args.report else None

        def write_report():
            """增量落盘：每行后重写报告，进程被杀也能保留已有进度。"""
            if not rep_path:
                return
            tmp = {"processed": len(plan) + len(skipped) + len(errors), "plan": plan, "skipped": skipped,
                   "errors": errors}
            rep_path.write_text(json.dumps(tmp, ensure_ascii=False, default=str, indent=2),
                                encoding="utf-8")

        for i, r in enumerate(rows, 1):
            cn = r["name_cn"]
            if cn in SKIP:
                skipped.append((r["id"], cn, "SKIP(加工品/歧义)"))
                write_report()
                continue
            try:
                res = find_image(c, cn, r["name_en"])
            except Exception as e:   # 网络/解析异常：记错并继续，不中断整轮
                errors.append((r["id"], cn, f"{type(e).__name__}: {e}"))
                print(f"  [{i}/{len(rows)}] id={r['id']} {cn} -> 异常 {type(e).__name__}，跳过", flush=True)
                write_report()
                time.sleep(PER_REQUEST_SLEEP)
                continue
            if res:
                url, file_t, method, dq = res
                plan.append((r, url, file_t, method, dq))
                print(f"  [{i}/{len(rows)}] id={r['id']} {cn} -> {method} dq={dq}\n      {file_t}\n      {url[:110]}", flush=True)
            else:
                skipped.append((r["id"], cn, "无命中"))
                print(f"  [{i}/{len(rows)}] id={r['id']} {cn} -> 无命中，留空", flush=True)
            write_report()
            time.sleep(PER_REQUEST_SLEEP)
        if errors:
            print(f"\n[异常行 {len(errors)}] " + "; ".join(f"id={a}({b}){c}" for a, b, c in errors))

        bym = {}
        for _r, _u, _f, m, _d in plan:
            k = m.split(":")[0]
            bym[k] = bym.get(k, 0) + 1
        highs = sum(1 for *_x, d in plan if d == DQ_HIGH)
        meds = sum(1 for *_x, d in plan if d == DQ_MED)
        lows = sum(1 for *_x, d in plan if d == DQ_LOW)
        writable = highs + meds + (lows if args.include_low else 0)
        print(f"\n=== 命中率：可补 {len(plan)}/{len(rows)} = {len(plan)/len(rows)*100:.1f}% "
              f"(HIGH={highs} MED={meds} LOW={lows}) ===")
        print(f"=== 本次将写 {writable} 行（{'含LOW' if args.include_low else 'HIGH+MED，LOW需--include-low'}）；"
              f"跳过/无命中 {len(skipped)} 行 ===")
        print(f"方法分布: {bym}")
        print("跳过/无命中明细: " + ", ".join(f"id={a}({b},{c})" for a, b, c in skipped))

        # 报告落盘（规避 stdout 捕获被中断；后台运行也能核对计划）
        if args.report:
            report = {
                "generated_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
                "source": "Wikimedia Commons (CC / PD, commons.wikimedia.org/w/api.php)",
                "total_rows": total,
                "empty_rows": len(rows),
                "hit_count": len(plan),
                "hit_rate": round(len(plan) / len(rows) * 100, 1) if rows else 0.0,
                "dq_high": highs, "dq_med": meds, "dq_low": lows,
                "method_dist": bym,
                "writable_without_low": highs + meds,
                "plan": [{"id": r["id"], "name_cn": r["name_cn"], "image_url": u,
                          "commons_file": f, "method": m, "data_quality": d}
                         for r, u, f, m, d in plan],
                "skipped": [{"id": a, "name_cn": b, "reason": c} for a, b, c in skipped],
                "errors": [{"id": a, "name_cn": b, "error": c} for a, b, c in errors],
            }
            Path(args.report).write_text(json.dumps(report, ensure_ascii=False, indent=2),
                                         encoding="utf-8")
            print(f"[报告] 已写 {args.report}")

        if not args.apply:
            print("\n[dry-run] 未写库。确认后： python scripts/enrich_food_material_images.py "
                  "--apply --yes-i-know" + (" --include-low" if lows else ""))
            return

        writable_plan = [(r, u, f, m, d) for r, u, f, m, d in plan
                         if d != DQ_LOW or args.include_low]
        # 溯源清单：与已有清单合并（分批/重跑不丢先前记录），按 id 去重
        existing = {}
        if BACKUP_PATH.exists():
            try:
                existing = {it["id"]: it for it in
                            json.loads(BACKUP_PATH.read_text(encoding="utf-8")).get("items", [])}
            except Exception:
                existing = {}
        for r, u, f, m, d in writable_plan:
            existing[r["id"]] = {"id": r["id"], "name_cn": r["name_cn"], "image_url": u,
                                 "commons_file": f, "method": m, "data_quality": d}
        if existing:
            manifest = {
                "generated_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
                "source": "Wikimedia Commons (CC / PD, via commons.wikimedia.org/w/api.php)",
                "note": "image_url 溯源清单（分批累积，按 id 去重）。source_db 未改动（保留法规溯源）。"
                        "dq: 0.9=学名精确,0.75=学名宽/中文名标题,0.55=兜底(可能错配,默认不写)。",
                "count": len(existing),
                "items": sorted(existing.values(), key=lambda x: x["id"]),
            }
            BACKUP_PATH.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
            print(f"\n[溯源] 清单已合并写 {BACKUP_PATH.name}（累计 {len(existing)} 条）")
        else:
            print("\n[溯源] 无命中，清单未变")

        updated = 0
        for r, u, f, m, d in writable_plan:
            res = await conn.execute(
                "UPDATE food_materials SET image_url=$2, updated_at=NOW() "
                "WHERE id=$1 AND image_url IS NULL", r["id"], u)
            if res.split()[-1] != "0":
                updated += 1
        after = await conn.fetchval(
            "SELECT COUNT(*) FROM food_materials WHERE image_url IS NOT NULL AND image_url<>''")
        print(f"\n[APPLY] 改动 {updated} 行；after image_url 非空={after}/{total}")
        print("[APPLY] 仅填 image_url（http 开头），未碰 source_db/data_quality；后端未重启")
    finally:
        await conn.close()
        c.close()


if __name__ == "__main__":
    asyncio.run(main())
