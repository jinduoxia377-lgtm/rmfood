"""
MMID 药用植物图像数据库爬虫 v3
===============================
使用正确的字段名匹配逻辑解析详情页
"""
import asyncio
import aiohttp
import asyncpg
import json
import re
import os
from datetime import datetime


async def scrape_all():
    print("=" * 70)
    print("  MMID 药用植物图像数据库爬虫 v3")
    print("=" * 70)

    # 获取所有页面的 pid
    print(f"\n[1] 提取所有 PID...")
    all_pids = []

    async with aiohttp.ClientSession() as session:
        for page in range(1, 16):
            try:
                async with session.get(
                    f'https://sys01.lib.hkbu.edu.hk/cmed/mmid/index.php?lang=cht&page={page}',
                    headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'},
                    timeout=30
                ) as resp:
                    html = await resp.text('utf-8')
                pids = re.findall(r'pid=([A-Z]\d{5})', html)
                all_pids.extend(pids)
                print(f"  第 {page}/15 页: {len(pids)} 个 PID")
                await asyncio.sleep(0.3)
            except Exception as e:
                print(f"  第 {page}/15 页 失败: {e}")

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
                    detail_html = await resp.text('utf-8', errors='replace')

                record = {'pid': pid}

                # 使用 【字段名】 格式解析
                # 中文名
                m = re.search(r'【中文名】\s*(.+?)【', detail_html)
                if not m:
                    m = re.search(r'【中文名】\s*(.+?)$', detail_html, re.DOTALL)
                if m:
                    record['name_ch'] = m.group(1).strip()

                # 拼音
                m = re.search(r'【拼音】\s*(.+?)【', detail_html)
                if not m:
                    m = re.search(r'【拼音】\s*(.+?)$', detail_html, re.DOTALL)
                if m:
                    record['name_pinyin'] = m.group(1).strip()

                # 英文
                m = re.search(r'【英文】\s*(.+?)【', detail_html)
                if not m:
                    m = re.search(r'【英文】\s*(.+?)$', detail_html, re.DOTALL)
                if m:
                    record['name_eng'] = m.group(1).strip()

                # 拉丁名
                m = re.search(r'【拉丁名】\s*(.+?)【', detail_html)
                if not m:
                    m = re.search(r'【拉丁名】\s*(.+?)$', detail_html, re.DOTALL)
                if m:
                    record['name_latin'] = m.group(1).strip()

                # 类别
                m = re.search(r'【類別】\s*(.+?)【', detail_html)
                if not m:
                    m = re.search(r'【類別】\s*(.+?)$', detail_html, re.DOTALL)
                if m:
                    record['type_ch'] = m.group(1).strip()

                # 来源
                m = re.search(r'【來源】\s*(.+?)【', detail_html)
                if not m:
                    m = re.search(r'【來源】\s*(.+?)$', detail_html, re.DOTALL)
                if m:
                    record['source'] = m.group(1).strip()

                # 产地
                m = re.search(r'【產地】\s*(.+?)【', detail_html)
                if not m:
                    m = re.search(r'【產地】\s*(.+?)$', detail_html, re.DOTALL)
                if m:
                    record['region'] = m.group(1).strip()

                # 性状
                m = re.search(r'【性狀】\s*(.+?)【', detail_html)
                if not m:
                    m = re.search(r'【性狀】\s*(.+?)$', detail_html, re.DOTALL)
                if m:
                    record['characteristic'] = m.group(1).strip()

                # 品质要求
                m = re.search(r'【品質要求】\s*(.+?)【', detail_html)
                if not m:
                    m = re.search(r'【品質要求】\s*(.+?)$', detail_html, re.DOTALL)
                if m:
                    record['quality'] = m.group(1).strip()

                # 性味
                m = re.search(r'【性味】\s*(.+?)【', detail_html)
                if not m:
                    m = re.search(r'【性味】\s*(.+?)$', detail_html, re.DOTALL)
                if m:
                    record['taste'] = m.group(1).strip()

                # 功效
                m = re.search(r'【功效】\s*(.+?)【', detail_html)
                if not m:
                    m = re.search(r'【功效】\s*(.+?)$', detail_html, re.DOTALL)
                if m:
                    record['function'] = m.group(1).strip()

                # 炙品
                m = re.search(r'【炙品】\s*(.+?)【', detail_html)
                if not m:
                    m = re.search(r'【炙品】\s*(.+?)$', detail_html, re.DOTALL)
                if m:
                    record['roast'] = m.group(1).strip()

                # 注解
                m = re.search(r'【註解】\s*(.+?)$', detail_html, re.DOTALL)
                if m:
                    record['desc'] = m.group(1).strip()

                all_records.append(record)

            except Exception as e:
                print(f"  获取 {pid} 失败: {e}")

            if (i + 1) % 50 == 0:
                print(f"  进度: {i+1}/{len(all_pids)}")

            await asyncio.sleep(0.5)

    print(f"\n  获取完成: {len(all_records)} 条")

    # 检查数据完整性
    with_name = sum(1 for r in all_records if r.get('name_ch'))
    print(f"  有中文名的: {with_name}")

    # 保存 JSON
    print(f"\n[3] 保存数据...")
    output_file = os.path.join(os.path.dirname(__file__), 'mmid_data_v3.json')
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
    for rec in all_records:
        try:
            await conn.execute('''
                INSERT INTO tcm_herbs
                    (name_cn, name_latin, name_pinyin, category,
                     effects, tcmsp_id, source_version,
                     synced_at, created_at)
                VALUES ($1, $2, $3, $4, $5, $6, 'v5.0-mmid', NOW(), NOW())
                ON CONFLICT (name_cn) DO UPDATE SET
                    name_latin = EXCLUDED.name_latin,
                    name_pinyin = EXCLUDED.name_pinyin,
                    category = EXCLUDED.category,
                    effects = EXCLUDED.effects,
                    tcmsp_id = EXCLUDED.tcmsp_id,
                    source_version = EXCLUDED.source_version,
                    synced_at = NOW()
            ''',
                rec.get('name_ch', ''),
                rec.get('name_latin', ''),
                rec.get('name_pinyin', ''),
                rec.get('type_ch', ''),
                rec.get('function', ''),
                f'MMID_{rec.get("pid", "")}',
            )
            inserted += 1
        except Exception as e:
            print(f"  插入 {rec.get('name_ch', rec.get('pid', ''))} 失败: {e}")

    await conn.close()
    print(f"  已导入: {inserted} 条")

    print(f"\n{'=' * 70}")
    print(f"  爬取完成!")
    print(f"  总记录: {len(all_records)} 条")
    print(f"  导入: {inserted} 条")
    print(f"{'=' * 70}")


if __name__ == "__main__":
    asyncio.run(scrape_all())
