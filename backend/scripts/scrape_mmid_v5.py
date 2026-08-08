"""
MMID 药用植物图像数据库爬虫 v5 - 使用 BeautifulSoup 解析
========================================================
"""
import asyncio
import aiohttp
import asyncpg
import json
import re
import os
from datetime import datetime
from bs4 import BeautifulSoup


def parse_detail_with_bs4(html_bytes):
    """使用 BeautifulSoup 解析详情页"""
    # 尝试多种编码
    html = None
    for enc in ['utf-8', 'gbk', 'gb2312', 'gb18030', 'big5', 'big5hkscs']:
        try:
            html = html_bytes.decode(enc)
            break
        except:
            continue
    if html is None:
        html = html_bytes.decode('utf-8', errors='replace')

    soup = BeautifulSoup(html, 'html.parser')

    record = {}

    # 获取标题中的中文名
    title = soup.find('p', class_='title')
    if title:
        # 标题格式: 百部 <font>Baibu</font>
        record['name_ch'] = title.get_text(strip=True).split('<')[0].strip()
        # 获取英文名
        font = title.find('font')
        if font:
            record['name_eng'] = font.get_text(strip=True)

    # 获取所有 <tr> 行
    rows = soup.find_all('tr')
    for row in rows:
        cells = row.find_all(['td', 'th'])
        if len(cells) < 2:
            continue

        # 第一个单元格是标签，第二个是内容
        label_cell = cells[0]
        value_cell = cells[1]

        label = label_cell.get_text(strip=True)
        value = value_cell.get_text(strip=True)

        # 清理标签中的特殊字符
        label = re.sub(r'[<>&\s]', '', label)

        # 映射标签到字段
        if '中文名' in label or label in ['中文名', '名称']:
            record['name_ch'] = value[:200]
        elif '拼音' in label:
            record['name_pinyin'] = value[:100]
        elif '英文名' in label:
            record['name_eng'] = value[:200]
        elif '拉丁名' in label:
            record['name_latin'] = value[:300]
        elif '类别' in label:
            record['type_ch'] = value[:100]
        elif '来源' in label:
            record['source'] = value[:500]
        elif '产地' in label:
            record['region'] = value[:300]
        elif '性状' in label:
            record['characteristic'] = value[:1000]
        elif '品质要求' in label:
            record['quality'] = value[:500]
        elif '性味' in label:
            record['taste'] = value[:200]
        elif '功效' in label:
            record['function'] = value[:1000]
        elif '炙品' in label:
            record['roast'] = value[:1000]
        elif '注解' in label or '注' in label:
            record['desc'] = value[:500]

    return record


async def scrape_all():
    print("=" * 70)
    print("  MMID 药用植物图像数据库爬虫 v5 (BeautifulSoup)")
    print("=" * 70)

    # 获取所有页面的 pid
    print(f"\n[1] 提取所有 PID (每页 4 条，共 105 页)...")
    all_pids = []

    async with aiohttp.ClientSession() as session:
        for page in range(1, 106):
            try:
                async with session.get(
                    f'https://sys01.lib.hkbu.edu.hk/cmed/mmid/index.php?lang=cht&page={page}',
                    headers={'User-Agent': 'Mozilla/5.0'},
                    timeout=30
                ) as resp:
                    html = await resp.text('utf-8')
                pids = list(set(re.findall(r'pid=([A-Z]\d{5})', html)))
                all_pids.extend(pids)
                if page % 20 == 0 or page == 1:
                    print(f"  第 {page}/105 页: {len(pids)} 个 PID (累计 {len(all_pids)})")
                await asyncio.sleep(0.5)
            except Exception as e:
                print(f"  第 {page}/105 页 失败: {e}")
                await asyncio.sleep(1)

        all_pids = list(set(all_pids))
        print(f"  去重后: {len(all_pids)} 个 PID")

    # 获取每条记录的详细信息
    print(f"\n[2] 获取 {len(all_pids)} 条详细信息...")
    all_records = []

    async with aiohttp.ClientSession() as session:
        for i, pid in enumerate(all_pids):
            try:
                async with session.get(
                    f'https://sys01.lib.hkbu.edu.hk/cmed/mmid/detail.php?lang=cht&pid={pid}',
                    headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'},
                    timeout=30
                ) as resp:
                    raw_bytes = await resp.read()

                record = {'pid': pid}
                record.update(parse_detail_with_bs4(raw_bytes))
                all_records.append(record)

            except Exception as e:
                print(f"  获取 {pid} 失败: {e}")
                all_records.append({'pid': pid})

            if (i + 1) % 50 == 0:
                print(f"  进度: {i+1}/{len(all_pids)}")

            await asyncio.sleep(0.5)

    print(f"\n  获取完成: {len(all_records)} 条")

    # 检查数据完整性
    with_name = sum(1 for r in all_records if r.get('name_ch'))
    print(f"  有中文名的: {with_name}")

    # 保存 JSON
    print(f"\n[3] 保存数据...")
    output_file = os.path.join(os.path.dirname(__file__), 'mmid_data_v5.json')
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(all_records, f, ensure_ascii=False, indent=2)
    print(f"  已保存到: {output_file}")

    # 统计
    print(f"\n[4] 数据统计:")
    types = {}
    for r in all_records:
        t = r.get('type_ch', '未知')
        types[t] = types.get(t, 0) + 1

    print(f"  类别分布:")
    for t, c in sorted(types.items(), key=lambda x: -x[1]):
        print(f"    {t}: {c}")

    # 导入数据库
    print(f"\n[5] 导入数据库...")
    conn = await asyncpg.connect(
        host='localhost', port=5432,
        user='rmfood', password='rmfood_secure_password_123',
        database='rmfood_db'
    )

    # 清空旧数据
    await conn.execute("DELETE FROM tcm_herbs WHERE source_version = 'v5.0-mmid'")

    # 插入新数据
    inserted = 0
    skipped = 0
    errors = 0
    for rec in all_records:
        try:
            # 检查是否已存在
            existing = await conn.fetchval(
                'SELECT id FROM tcm_herbs WHERE tcmsp_id = $1',
                f'MMID_{rec.get("pid", "")}'
            )
            if existing:
                skipped += 1
                continue

            # 检查是否有中文名
            if not rec.get('name_ch', '').strip():
                skipped += 1
                continue

            await conn.execute('''
                INSERT INTO tcm_herbs
                    (name_cn, name_latin, name_pinyin, category,
                     effects, tcmsp_id, source_version,
                     synced_at, created_at)
                VALUES ($1, $2, $3, $4, $5, $6, 'v5.0-mmid', NOW(), NOW())
            ''',
                rec.get('name_ch', '').strip(),
                rec.get('name_latin', '').strip(),
                rec.get('name_pinyin', '').strip(),
                rec.get('type_ch', '').strip(),
                rec.get('function', '').strip(),
                f'MMID_{rec.get("pid", "")}',
            )
            inserted += 1
        except Exception as e:
            errors += 1

    await conn.close()
    print(f"  已导入: {inserted} 条")
    print(f"  跳过(无中文名): {skipped} 条")
    print(f"  错误: {errors} 条")

    print(f"\n{'=' * 70}")
    print(f"  爬取完成!")
    print(f"  总记录: {len(all_records)} 条")
    print(f"  有中文名: {with_name}")
    print(f"  导入: {inserted} 条")
    print(f"{'=' * 70}")


if __name__ == "__main__":
    asyncio.run(scrape_all())
