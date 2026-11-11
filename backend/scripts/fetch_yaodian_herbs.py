# -*- coding: utf-8 -*-
"""药典抓取管道：中国药典2025一部(antpedia codex-cn-2025 镜像)。
- 只读抓取药典 herb 页，抽【性味与归经/功能与主治/用法与用量/注意】。
- only-fill 幂等：只填 tcm_herbs 空字段，非空跳过；带 source_url + source 标注。
- dry-run 默认；--apply 需 --yes-i-know。
- 诚实：药典不收录/「注意」没写的软禁忌 -> 留空不编。
URL: https://www.antpedia.com/codex-cn-2025/1/{NNNN}_{name_urlenc}.html
字段抽取按药典页面文本顺序（性味->功能主治->用量->注意），见 _parse()。
"""
import argparse
import asyncio
import json
import re
import sys
import time
from pathlib import Path

BASE = "https://www.antpedia.com/codex-cn-2025/1"
SRC_TOKEN = "中国药典2025一部"
HERBS_JSON = Path(__file__).resolve().parent / "yaodian_herbs_map.json"


def load_map():
    """herb name_cn -> page URL。来自 yaodian_herbs_map.json（由抓取 category/herb.html 索引生成）。"""
    return json.loads(HERBS_JSON.read_text(encoding="utf-8"))


def _parse(html):
    """从药典 herb 页 HTML 抽四字段。药典正文顺序: 性味归经/功能主治(功效·主治)/用法用量/注意。
    抽不到/软禁忌返回 ''（诚实留空）。"""
    from html import unescape
    text = re.sub(r"<script.*?</script>|<style.*?</style>", " ", html, flags=re.S)
    text = re.sub(r"<[^>]+>", "\n", text)
    text = unescape(text)
    lines = [ln.strip() for ln in text.split("\n") if ln.strip()]
    # 去掉纯章节标记/导航噪声行
    noise = {"功效 · 主治", "功效·主治", "性味与归经", "用法与用量",
             "注意", "用法用量", "贮藏", "贮藏要点", "鉴别", "含量测定", "检查", "浸出物", "图谱"}
    body_lines = [ln for ln in lines if ln not in noise
                  and not re.fullmatch(r"[一二三四五六七八九十]", ln)]
    body = "\n".join(body_lines)

    res = {"properties": "", "functions": "", "indications": "", "dosage": "", "contraindications": ""}
    # 导航噪声行（去尾部"相关仪器/关联条目/同类条目"块）
    nav = ("相关仪器", "关联条目", "同类条目", "站内互链", "纸本对照", "上一", "下一", "液相色谱仪")
    core = [ln for ln in body_lines if not any(nv in ln for nv in nav)]
    # 用量: 短块 "15～30g" / "煎服，2～10g"
    m = re.search(r"(?:煎服[，,]?)?\s*\d+(?:\.\d+)?\s*[~～]\s*\d+(?:\.\d+)?\s*g(?:\s*。)?", body)
    if m:
        res["dosage"] = re.sub(r"\s+", "", m.group(0)).strip("。，")
    # 注意/禁忌: 只取药典【注意与禁忌】字段的紧邻下一行，绝不抓【本草纲目】等古籍段。
    #   页面可能有多个"注意与禁忌"标题(摘要/正文)，遍历取第一个【下一行是真硬禁忌】的；全无则留空。
    guji = ("本草纲目", "气味", "本经", "食疗", "救荒本草", "别录", "纲目")
    hdrs = [i for i, ln in enumerate(core) if ln.strip() == "注意与禁忌"]
    for idx in hdrs:
        if idx + 1 >= len(core):
            continue
        nxt = core[idx + 1].strip()
        if not nxt or nxt == "图":
            continue
        if any(g in nxt for g in guji):
            continue  # 紧邻行是古籍段 -> 跳过
        if "原文未明确" in nxt or "遵医嘱" in nxt:
            continue  # 药典明确说无具体禁忌 -> 跳过(留空)
        if re.search(r"慎用|禁用|忌服|忌食|忌|不宜", nxt) and not any(
                x in nxt for x in ["用量", "功能", "贮藏", "鉴别", "测定", "检查"]):
            res["contraindications"] = nxt
            break
    # 功能主治: 药典页有多个"功能与主治"标题（摘要/正文），取第一个【下一行是真实内容句】的块。
    #   内容句特征: 含"。"或"用于"，且不是纯章节标签（如"功效 · 主治"）。
    section_labels = {"功效 · 主治", "功效·主治", "性味与归经", "用法与用量", "注意与禁忌", "用法用量",
                      "功能与主治", "贮藏", "贮藏要点", "鉴别", "含量测定", "检查", "浸出物"}
    hdr = [i for i, ln in enumerate(core) if ln.strip() == "功能与主治"]
    best_fn, best_ind = "", ""
    for h in hdr:
        if h + 1 >= len(core):
            continue
        blk = core[h + 1].strip()
        if blk in section_labels or not blk or blk == "图":
            continue
        if "用于" in blk:
            parts = blk.split("用于", 1)
            fn = parts[0].strip().rstrip("。，")
            ind = ("用于" + parts[1]).strip()
            # 取主治最完整（最长"用于"段）的块，避免命中摘要页的简写版
            if len(ind) > len(best_ind):
                best_fn, best_ind = fn, ind
        elif "。" in blk and not best_fn:
            best_fn = blk.split("。")[0].strip().rstrip("。，")
    res["functions"] = best_fn
    res["indications"] = best_ind[:200]
    return res


async def fetch(session, url, sem):
    async with sem:
        for _ in range(2):
            try:
                async with session.get(url, timeout=30) as r:
                    if r.status == 200:
                        return await r.text()
            except Exception:
                time.sleep(1)
        return None


async def process(names, limit, apply):
    """抓取+解析+（apply 时）only-fill 写库。"""
    import aiohttp
    herb_map = load_map()
    sem = asyncio.Semaphore(3)
    targets = [(n, u) for n, u in herb_map.items() if (not names or n in names)][:limit]
    print(f"[{'apply' if apply else 'dry-run'}] 目标 {len(targets)} 味（映射表共 {len(herb_map)} 味）。\n")
    conn = None
    n_upd = n_skip = n_nofill = 0
    if apply:
        import asyncpg
        conn = await asyncpg.connect("postgresql://postgres:password@localhost:5432/rmfood")
    async with aiohttp.ClientSession() as s:
        for name, url in targets:
            html = await fetch(s, url, sem)
            if not html:
                print(f"✗ {name}: 抓取失败 {url}")
                continue
            f = _parse(html)
            if not apply:
                print(f"● {name}  src={SRC_TOKEN}")
                print(f"    URL={url}")
                print(f"    dosage={f['dosage'] or '(空)'}")
                print(f"    contraindications={f['contraindications'] or '(空)'}")
                print(f"    functions={f['functions'][:50] or '(空)'}")
                print(f"    indications={f['indications'][:60] or '(空)'}\n")
                time.sleep(0.3)
                continue
            # apply: 找 herb 行（按 name_cn），only-fill 空字段
            row = await conn.fetchrow(
                "SELECT id, dosage, contraindications, functions, indications FROM tcm_herbs WHERE name_cn=$1", name)
            if not row:
                n_skip += 1
                continue
            sets, vals, i = [], [], 1
            for col in ["dosage", "contraindications", "functions", "indications"]:
                cur = row[col]
                new = f[col]
                if (cur is None or str(cur).strip() == "") and new:
                    sets.append(f"{col}=${i}")
                    vals.append(new)
                    i += 1
            if not sets:
                n_nofill += 1
                continue
            sets.append(f"source_url=${i}")
            vals.append(url)
            i += 1
            sets.append(f"source=${i}")
            vals.append(SRC_TOKEN)
            i += 1
            sets.append("updated_at=NOW()")
            await conn.execute(
                f"UPDATE tcm_herbs SET {', '.join(sets)} WHERE id=${i}", *vals, row["id"])
            n_upd += 1
            time.sleep(0.3)
    if conn:
        await conn.close()
    print(f"\n汇总: 更新={n_upd} 无空可填={n_nofill} 库无此herb={n_skip}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--yes-i-know", action="store_true")
    ap.add_argument("--names", default="")  # 逗号分隔 herb 名，空=全部映射表
    ap.add_argument("--limit", type=int, default=12)
    a = ap.parse_args()
    if a.apply and not a.yes_i_know:
        print("[REFUSING] --apply 需 --yes-i-know（先 dry-run 核对）。")
        sys.exit(3)
    names = set(a.names.split(",")) if a.names else None
    if not names and a.limit <= 0:
        pass
    asyncio.run(process(names, a.limit if a.limit > 0 else 10**9, a.apply))


if __name__ == "__main__":
    main()
