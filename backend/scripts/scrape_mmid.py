"""
MMID 药用植物图像数据库爬虫
============================
来源: https://sys01.lib.hkbu.edu.hk/cmed/mmid/
总量: 420 条记录, 15 页, 每页 28 条

字段:
- pid: 记录编号 (B00001 ~ B00420)
- name_ch: 中文名
- name_pinyin: 拼音
- name_eng: 英文名
- name_latin: 拉丁名
- type_ch: 类别 (12类)
- source: 来源
- region: 产地
- characteristic: 性状
- quality: 品质要求
- taste: 性味
- function: 功效
- roast: 炙品
- desc: 注解
"""
import asyncio
import aiohttp
import asyncpg
import json
import re
import time
import os
import sys
from datetime import datetime
from html.parser import HTMLParser

# HTML 解析器 - 提取纯文本
class TextExtractor(HTMLParser):
    def __init__(self):
        super().__init__()
        self.text = []
        self.in_td = False

    def handle_starttag(self, tag, attrs):
        if tag == 'td':
            self.in_td = True

    def handle_endtag(self, tag):
        if tag == 'td':
            self.in_td = False

    def handle_data(self, data):
        self.text.append(data.strip())

    def get_text(self):
        return ''.join(self.text)


async def fetch_page(session, page_num, lang='cht'):
    """获取一页数据"""
    url = f'https://sys01.lib.hkbu.edu.hk/cmed/mmid/index.php?lang={lang}&page={page_num}'
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
    }

    try:
        async with session.get(url, headers=headers, timeout=30) as resp:
            if resp.status == 200:
                html = await resp.text('utf-8')
                return html
            else:
                print(f"  页面 {page_num} 状态码: {resp.status}")
                return None
    except Exception as e:
        print(f"  页面 {page_num} 请求失败: {e}")
        return None


def parse_page_html(html):
    """解析一页 HTML，提取药材记录"""
    records = []

    # 提取每条记录的 pid
    pids = re.findall(r'pid=([A-Z]\d{5})', html)

    # 提取中文名
    names_ch = re.findall(r'<td[^>]*>([^<]+?)<br[^>]*>([^<]*)</td>', html)

    # 提取拉丁名 (蓝色字体)
    latins = re.findall(r'<font color="blue">\s*(.*?)\s*</font>', html)

    # 提取英文名
    engs = re.findall(r'<td[^>]*>([^<]+?)<br[^>]*>([^<]*)</td>', html)

    # 提取类别
    types = re.findall(r'</td>\s*<td[^>]*>([^<]+?)</td>', html)

    # 更精确地提取每条记录的各个字段
    # 找到所有 tr 记录行
    rows = re.findall(r'<tr[^>]*>(.*?)</tr>', html, re.DOTALL)

    for i, row in enumerate(rows):
        if i == 0:  # 跳过表头
            continue

        # 提取 pid
        pid_match = re.search(r'pid=([A-Z]\d{5})', row)
        pid = pid_match.group(1) if pid_match else f'B{len(records)+1:05d}'

        # 提取中文名
        name_ch_match = re.search(r'<td[^>]*>\s*(.+?)<br[^>]*>([^<]*)', row)
        name_ch = name_ch_match.group(1).strip() if name_ch_match else ''
        name_pinyin = name_ch_match.group(2).strip() if name_ch_match else ''

        # 提取拉丁名
        latin_match = re.search(r'<font color="blue">\s*(.*?)\s*</font>', row)
        name_latin = latin_match.group(1).strip() if latin_match else ''

        # 提取英文名
        eng_match = re.search(r'</td>\s*<td[^>]*>([^<]+?)<br[^>]*>([^<]*)</td>', row)
        name_eng = eng_match.group(1).strip() if eng_match else ''
        name_eng2 = eng_match.group(2).strip() if eng_match else ''
        if name_eng2:
            name_eng = f"{name_eng} {name_eng2}".strip()

        # 提取类别
        type_match = re.search(r'</td>\s*<td[^>]*>([^<]+?)</td>\s*<td[^>]*>&nbsp;</td>', row)
        type_ch = type_match.group(1).strip() if type_match else ''

        # 跳过没有 pid 的行
        if not pid or pid.startswith('B') and len(pid) == 6:
            records.append({
                'pid': pid,
                'name_ch': name_ch,
                'name_pinyin': name_pinyin,
                'name_latin': name_latin,
                'name_eng': name_eng,
                'type_ch': type_ch,
            })

    return records


async def fetch_detail(session, pid, lang='cht'):
    """获取单条记录的详细信息"""
    url = f'https://sys01.lib.hkbu.edu.hk/cmed/mmid/detail.php?lang={lang}&pid={pid}'
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
    }

    try:
        async with session.get(url, headers=headers, timeout=30) as resp:
            if resp.status == 200:
                html = await resp.text('utf-8')
                return html
            else:
                return None
    except Exception as e:
        return None


def parse_detail_html(html, base_record):
    """解析详情页 HTML，提取完整信息"""
    record = dict(base_record)

    # 提取来源 (Source)
    source_match = re.search(r'<b>來源</b>[^<]*<br[^>]*>([^<]+)', html)
    record['source'] = source_match.group(1).strip() if source_match else ''

    # 提取产地 (Production Regions)
    region_match = re.search(r'<b>產地</b>[^<]*<br[^>]*>(.+?)<br', html)
    if region_match:
        record['region'] = region_match.group(1).strip()
    else:
        record['region'] = ''

    # 提取性状 (Macroscopic Features)
    char_match = re.search(r'<b>性狀</b>[^<]*<br[^>]*>(.+?)<br', html)
    if char_match:
        record['characteristic'] = char_match.group(1).strip()
    else:
        record['characteristic'] = ''

    # 提取品质要求 (Quality Requirements)
    quality_match = re.search(r'<b>品質要求</b>[^<]*<br[^>]*>(.+?)<br', html)
    if quality_match:
        record['quality'] = quality_match.group(1).strip()
    else:
        record['quality'] = ''

    # 提取性味 (Properties)
    taste_match = re.search(r'<b>性味</b>[^<]*<br[^>]*>(.+?)<br', html)
    if taste_match:
        record['taste'] = taste_match.group(1).strip()
    else:
        record['taste'] = ''

    # 提取功效 (Functions)
    func_match = re.search(r'<b>功效</b>[^<]*<br[^>]*>(.+?)<br', html)
    if func_match:
        record['function'] = func_match.group(1).strip()
    else:
        record['function'] = ''

    # 提取炙品 (Processed Form)
    roast_match = re.search(r'<b>炙品</b>[^<]*<br[^>]*>(.+?)<br', html)
    if roast_match:
        record['roast'] = roast_match.group(1).strip()
    else:
        record['roast'] = ''

    # 提取注解 (Technical Terms)
    desc_match = re.search(r'<b>注解</b>[^<]*<br[^>]*>(.+?)<br', html)
    if desc_match:
        record['desc'] = desc_match.group(1).strip()
    else:
        record['desc'] = ''

    return record


async def scrape_all():
    """爬取所有页面"""
    print("=" * 70)
    print("  MMID 药用植物图像数据库爬虫")
    print("=" * 70)

    total_pages = 15
    all_records = []

    # 第一步: 获取所有列表页
    print(f"\n[1] 获取 {total_pages} 页列表数据...")
    async with aiohttp.ClientSession() as session:
        for page in range(1, total_pages + 1):
            html = await fetch_page(session, page)
            if html:
                records = parse_page_html(html)
                all_records.extend(records)
                print(f"  第 {page}/{total_pages} 页: {len(records)} 条")
                await asyncio.sleep(0.5)  # 礼貌延迟
            else:
                print(f"  第 {page}/{total_pages} 页: 获取失败")

    print(f"\n  列表页共获取: {len(all_records)} 条")

    # 第二步: 获取详情页 (分批获取，避免被封)
    print(f"\n[2] 获取 {len(all_records)} 条详细信息...")
    detailed_records = []
    errors = 0

    async with aiohttp.ClientSession() as session:
        for i, rec in enumerate(all_records):
            if i % 20 == 0 and i > 0:
                print(f"  进度: {i}/{len(all_records)}")
                await asyncio.sleep(1)  # 每20条休息1秒

            detail_html = await fetch_detail(session, rec['pid'])
            if detail_html:
                detailed = parse_detail_html(detail_html, rec)
                detailed_records.append(detailed)
            else:
                # 详情页获取失败，保留列表页数据
                detailed_records.append(rec)
                errors += 1

            await asyncio.sleep(0.3)  # 礼貌延迟

    print(f"\n  详情获取: {len(detailed_records)} 条")
    print(f"  失败: {errors} 条")

    # 第三步: 保存为 JSON 文件
    print(f"\n[3] 保存数据...")
    output_file = os.path.join(os.path.dirname(__file__), 'mmid_data.json')
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(detailed_records, f, ensure_ascii=False, indent=2)
    print(f"  已保存到: {output_file}")
    print(f"  文件大小: {os.path.getsize(output_file) / 1024:.1f} KB")

    # 第四步: 统计
    print(f"\n[4] 数据统计:")
    types = {}
    regions = {}
    for r in detailed_records:
        t = r.get('type_ch', '')
        types[t] = types.get(t, 0) + 1
        reg = r.get('region', '')
        if reg:
            # 产地可能有多个，用逗号分隔
            for region in reg.split(','):
                region = region.strip()
                if region:
                    regions[region] = regions.get(region, 0) + 1

    print(f"  类别分布:")
    for t, c in sorted(types.items(), key=lambda x: -x[1]):
        print(f"    {t}: {c}")

    print(f"  产地 TOP 10:")
    for r, c in sorted(regions.items(), key=lambda x: -x[1])[:10]:
        print(f"    {r}: {c}")

    # 第五步: 导入数据库
    print(f"\n[5] 导入数据库...")
    conn = await asyncpg.connect(
        host='localhost', port=5432,
        user='rmfood', password='rmfood_secure_password_123',
        database='rmfood_db'
    )

    # 清空现有 mmid 数据
    await conn.execute('DELETE FROM tcm_herbs WHERE source_version = \'v5.0-mmid\'')

    # 插入新数据
    inserted = 0
    for rec in detailed_records:
        try:
            await conn.execute('''
                INSERT INTO tcm_herbs
                    (name_cn, name_latin, name_pinyin, category,
                     effects, is_food_homology, tcmsp_id, source_version,
                     synced_at, created_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, 'v5.0-mmid', NOW(), NOW())
                ON CONFLICT (name_cn) DO UPDATE SET
                    name_latin = EXCLUDED.name_latin,
                    name_pinyin = EXCLUDED.name_pinyin,
                    category = EXCLUDED.category,
                    effects = EXCLUDED.effects,
                    is_food_homology = EXCLUDED.is_food_homology,
                    tcmsp_id = EXCLUDED.tcmsp_id,
                    source_version = EXCLUDED.source_version,
                    synced_at = NOW()
            ''',
                rec.get('name_ch', ''),
                rec.get('name_latin', ''),
                rec.get('name_pinyin', ''),
                rec.get('type_ch', ''),
                rec.get('function', ''),
                False,  # MMID 没有药食同源标记
                f'MMID_{rec.get("pid", "")}',
            )
            inserted += 1
        except Exception as e:
            print(f"  插入 {rec.get('name_ch', rec.get('pid', ''))} 失败: {e}")

    await conn.close()
    print(f"  已导入: {inserted} 条")

    print(f"\n{'=' * 70}")
    print(f"  爬取完成!")
    print(f"  总记录: {len(detailed_records)} 条")
    print(f"  导入: {inserted} 条")
    print(f"{'=' * 70}")

    return detailed_records


if __name__ == "__main__":
    asyncio.run(scrape_all())
