"""爬取 HKBU MMID 药用植物图像数据库的全部药材数据 (420条)"""
import json
import os
import time
import urllib.request

from bs4 import BeautifulSoup

BASEDIR = os.path.dirname(os.path.abspath(__file__))
HERBS = []

def fetch_page(page: int) -> str:
    url = f"http://sys01.lib.hkbu.edu.hk/cmed/mmid/index.php?lang=cht&page={page}"
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"})
    resp = urllib.request.urlopen(req, timeout=15)
    return resp.read().decode("utf-8")

def main():
    print("正在爬取 HKBU MMID 数据库...")
    print("总共 420 条记录，每页 4 条，共 105 页")

    for page in range(1, 106):
        html = fetch_page(page)
        soup = BeautifulSoup(html, "lxml")
        rows = soup.select("table#list tbody tr")

        count = 0
        for row in rows:
            tds = row.find_all("td")
            if len(tds) < 8:
                continue

            # 中文名
            cn_text = tds[1].get_text(separator="\n", strip=True)
            lines = [ln for ln in cn_text.split("\n") if ln.strip()]
            cn = lines[0].strip() if lines else ""
            pinyin = lines[1].strip() if len(lines) >= 2 else ""

            # 拉丁名
            latin_tag = tds[3].find("font", color="blue")
            latin = latin_tag.get_text(strip=True) if latin_tag else ""

            # 英文名
            eng = tds[5].get_text(separator=" ", strip=True)

            # 类别
            herb_type = tds[7].get_text(strip=True)

            # PID
            a_tag = row.find("a", href=True)
            pid = ""
            if a_tag and "pid=" in a_tag["href"]:
                pid = a_tag["href"].split("pid=")[1]

            if cn and herb_type:
                HERBS.append({
                    "pid": pid,
                    "cn": cn,
                    "pinyin": pinyin,
                    "latin": latin,
                    "eng": eng,
                    "type": herb_type,
                })
                count += 1

        if page % 20 == 0 or page == 105:
            print(f"  进度: 第 {page}/105 页, 累计 {len(HERBS)} 种")

        # 礼貌延迟，避免请求过快
        if page % 10 == 0:
            time.sleep(1)

    # 去重
    seen = set()
    unique = []
    for h in HERBS:
        if h["cn"] not in seen:
            seen.add(h["cn"])
            unique.append(h)

    print(f"\n共计 {len(unique)} 种药材（去重后）")

    # 分类统计
    cats = {}
    for h in unique:
        cats[h["type"]] = cats.get(h["type"], 0) + 1
    print("\n分类统计:")
    for cat, cnt in sorted(cats.items(), key=lambda x: -x[1]):
        print(f"  {cat}: {cnt}")

    # 保存完整数据
    out_path = os.path.join(BASEDIR, "mmid_full_data.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(unique, f, ensure_ascii=False, indent=2)
    print(f"\n完整数据已保存到: {out_path}")

    # 统计现有数据对比
    existing_names_file = os.path.join(BASEDIR, "existing_herb_names.txt")
    if os.path.exists(existing_names_file):
        with open(existing_names_file, "r", encoding="utf-8") as f:
            existing = set(line.strip() for line in f if line.strip())

        mmid_names = set(h["cn"] for h in unique)
        new_herbs = mmid_names - existing
        overlap = mmid_names & existing

        print("\n对比现有数据:")
        print(f"  MMID数据库: {len(mmid_names)} 种")
        print(f"  现有数据:   {len(existing)} 种")
        print(f"  重叠:       {len(overlap)} 种")
        print(f"  新增:       {len(new_herbs)} 种")

        if new_herbs:
            print("\n新增药材名称:")
            for name in sorted(new_herbs):
                print(f"  {name}")

if __name__ == "__main__":
    main()
