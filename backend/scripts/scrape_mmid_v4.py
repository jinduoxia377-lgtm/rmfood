"""
MMID 药用植物图像数据库爬虫 v4
===============================
修复编码问题和解析逻辑
"""
import asyncio
import aiohttp
import asyncpg
import json
import re
import os
from datetime import datetime


def parse_detail_from_html(html):
    """从文本解析详情页"""
    record = {}

    # 提取所有文本内容（去除HTML标签）
    texts = re.sub(r'<[^>]+>', ' ', html)
    texts = re.sub(r'\s+', ' ', texts).strip()

    # 按字段提取
    # 中文名
    m = re.search(r'中文名[：:]?\s*(.+?)(?:拼音|英文|拉丁|類別|來源|產地|性狀|品質|性味|功效|炙品|註解|$)', texts, re.DOTALL)
    if m:
        record['name_ch'] = m.group(1).strip()[:100]

    # 拼音
    m = re.search(r'拼音[：:]?\s*(.+?)(?:英文|拉丁|中文名|類別|來源|產地|性狀|品質|性味|功效|炙品|註解|$)', texts, re.DOTALL)
    if m:
        record['name_pinyin'] = m.group(1).strip()[:100]

    # 英文
    m = re.search(r'英文[：:]?\s*(.+?)(?:拉丁|中文名|拼音|類別|來源|產地|性狀|品質|性味|功效|炙品|註解|$)', texts, re.DOTALL)
    if m:
        record['name_eng'] = m.group(1).strip()[:200]

    # 拉丁名
    m = re.search(r'拉丁名[：:]?\s*(.+?)(?:英文名|中文名|拼音|類別|來源|產地|性狀|品質|性味|功效|炙品|註解|$)', texts, re.DOTALL)
    if m:
        record['name_latin'] = m.group(1).strip()[:200]

    # 类别
    m = re.search(r'類別[：:]?\s*(.+?)(?:來源|產地|性狀|品質|性味|功效|炙品|註解|中文名|拼音|英文|拉丁|$)', texts, re.DOTALL)
    if m:
        record['type_ch'] = m.group(1).strip()[:50]

    # 来源
    m = re.search(r'來源[：:]?\s*(.+?)(?:產地|性狀|品質|性味|功效|炙品|註解|類別|中文名|拼音|英文|拉丁|$)', texts, re.DOTALL)
    if m:
        record['source'] = m.group(1).strip()[:200]

    # 产地
    m = re.search(r'產地[：:]?\s*(.+?)(?:性狀|品質|性味|功效|炙品|註解|來源|類別|中文名|拼音|英文|拉丁|$)', texts, re.DOTALL)
    if m:
        record['region'] = m.group(1).strip()[:200]

    # 性状
    m = re.search(r'性狀[：:]?\s*(.+?)(?:品質要求|性味|功效|炙品|註解|產地|來源|類別|中文名|拼音|英文|拉丁|$)', texts, re.DOTALL)
    if m:
        record['characteristic'] = m.group(1).strip()[:500]

    # 品质要求
    m = re.search(r'品質要求[：:]?\s*(.+?)(?:性味|功效|炙品|註解|性狀|產地|來源|類別|中文名|拼音|英文|拉丁|$)', texts, re.DOTALL)
    if m:
        record['quality'] = m.group(1).strip()[:300]

    # 性味
    m = re.search(r'性味[：:]?\s*(.+?)(?:功效|炙品|註解|品質要求|性狀|產地|來源|類別|中文名|拼音|英文|拉丁|$)', texts, re.DOTALL)
    if m:
        record['taste'] = m.group(1).strip()[:200]

    # 功效
    m = re.search(r'功效[：:]?\s*(.+?)(?:炙品|註解|性味|品質要求|性狀|產地|來源|類別|中文名|拼音|英文|拉丁|$)', texts, re.DOTALL)
    if m:
        record['function'] = m.group(1).strip()[:500]

    # 炙品
    m = re.search(r'炙品[：:]?\s*(.+?)(?:註解|功效|性味|品質要求|性狀|產地|來源|類別|中文名|拼音|英文|拉丁|$)', texts, re.DOTALL)
    if m:
        record['roast'] = m.group(1).strip()[:500]

    # 注解
    m = re.search(r'註解[：:]?\s*(.+?)$', texts, re.DOTALL)
    if m:
        record['desc'] = m.group(1).strip()[:500]

    return record


async def scrape_all():
    print("=" * 70)
    print("  MMID 药用植物图像数据库爬虫 v4")
    print("=" * 70)

    # 获取所有页面的 pid - MMID 每页 4 条，共 105 页
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
                pids = re.findall(r'pid=([A-Z]\d{5})', html)
                # 去重
                unique_pids = list(set(pids))
                all_pids.extend(unique_pids)
                if page % 20 == 0 or page == 1:
                    print(f"  第 {page}/105 页: {len(unique_pids)} 个 PID (累计 {len(all_pids)})")
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
                    # 注意: MMID 网站返回的是 GBK 编码！
                    raw_bytes = await resp.read()

                    # 尝试多种编码
                    html = None
                    for enc in ['gbk', 'gb2312', 'gb18030', 'big5', 'utf-8']:
                        try:
                            html = raw_bytes.decode(enc)
                            break
                        except:
                            continue

                    if html is None:
                        html = raw_bytes.decode('utf-8', errors='replace')

                record = {'pid': pid}
                record.update(parse_detail_from_html(html))
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
    output_file = os.path.join(os.path.dirname(__file__), 'mmid_data_v4.json')
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

    # 插入新数据（不用 ON CONFLICT，直接 INSERT）
    inserted = 0
    skipped = 0
    for rec in all_records:
        try:
            # 先检查是否已存在
            existing = await conn.fetchval(
                'SELECT id FROM tcm_herbs WHERE tcmsp_id = $1',
                f'MMID_{rec.get("pid", "")}'
            )
            if existing:
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
            skipped += 1

    print(f"  已导入: {inserted} 条, 跳过: {skipped} 条")

    await conn.close()
    print(f"  已导入: {inserted} 条")

    print(f"\n{'=' * 70}")
    print(f"  爬取完成!")
    print(f"  总记录: {len(all_records)} 条")
    print(f"  有中文名: {with_name}")
    print(f"  导入: {inserted} 条")
    print(f"{'=' * 70}")


if __name__ == "__main__":
    asyncio.run(scrape_all())
