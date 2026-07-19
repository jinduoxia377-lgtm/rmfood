"""
MMID 药用植物图像数据库爬虫 v2
===============================
改进解析逻辑，确保获取全部 420 条记录
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
    print("  MMID 药用植物图像数据库爬虫 v2")
    print("=" * 70)

    # 获取所有 pid
    all_pids = []
    for page in range(1, 16):
        all_pids.append(f"B{page:03d}{(page-1)*28+1:05d}")

    # 直接从首页提取所有 pid
    print(f"\n[1] 提取所有 PID...")
    async with aiohttp.ClientSession() as session:
        async with session.get(
            'https://sys01.lib.hkbu.edu.hk/cmed/mmid/index.php?lang=cht',
            headers={'User-Agent': 'Mozilla/5.0'},
            timeout=30
        ) as resp:
            html = await resp.text('utf-8')

        # 提取所有 pid
        pids = re.findall(r'pid=([A-Z]\d{5})', html)
        print(f"  首页 PID: {len(pids)} 个")

        # 获取所有页面的 pid
        for page in range(2, 16):
            async with session.get(
                f'https://sys01.lib.hkbu.edu.hk/cmed/mmid/index.php?lang=cht&page={page}',
                headers={'User-Agent': 'Mozilla/5.0'},
                timeout=30
            ) as resp:
                page_html = await resp.text('utf-8')
            page_pids = re.findall(r'pid=([A-Z]\d{5})', page_html)
            pids.extend(page_pids)
            await asyncio.sleep(0.3)

        # 去重
        all_pids = list(set(pids))
        print(f"  去重后 PID: {len(all_pids)} 个")

    # 获取每条记录的详细信息
    print(f"\n[2] 获取 {len(all_pids)} 条详细信息...")
    all_records = []

    async with aiohttp.ClientSession() as session:
        for i, pid in enumerate(all_pids):
            try:
                async with session.get(
                    f'https://sys01.lib.hkbu.edu.hk/cmed/mmid/detail.php?lang=cht&pid={pid}',
                    headers={'User-Agent': 'Mozilla/5.0'},
                    timeout=30
                ) as resp:
                    detail_html = await resp.text('utf-8')

                # 解析详情页
                record = {'pid': pid}

                # 提取所有文本
                texts = re.findall(r'>([^<]+)<', detail_html)

                # 查找关键词后面的内容
                for j, text in enumerate(texts):
                    text = text.strip()
                    if not text:
                        continue

                    # 中文名
                    if text == '中文名' or text == '中文':
                        if j+1 < len(texts):
                            record['name_ch'] = texts[j+1].strip()

                    # 拉丁名
                    elif text == '拉丁名' or text == '拉丁':
                        if j+1 < len(texts):
                            record['name_latin'] = texts[j+1].strip()

                    # 英文名
                    elif text == '英文名' or text == '英文':
                        if j+1 < len(texts):
                            record['name_eng'] = texts[j+1].strip()

                    # 拼音
                    elif text == '拼音':
                        if j+1 < len(texts):
                            record['name_pinyin'] = texts[j+1].strip()

                    # 类别
                    elif text == '类别' or text == '分類':
                        if j+1 < len(texts):
                            record['type_ch'] = texts[j+1].strip()

                    # 来源
                    elif text == '来源' or text == '來源':
                        if j+1 < len(texts):
                            record['source'] = texts[j+1].strip()

                    # 产地
                    elif text == '产地' or text == '產地':
                        if j+1 < len(texts):
                            record['region'] = texts[j+1].strip()

                    # 性味
                    elif text == '性味':
                        if j+1 < len(texts):
                            record['taste'] = texts[j+1].strip()

                    # 功效
                    elif text == '功效':
                        if j+1 < len(texts):
                            record['function'] = texts[j+1].strip()

                    # 性状
                    elif text == '性状' or text == '性狀':
                        if j+1 < len(texts):
                            record['characteristic'] = texts[j+1].strip()

                    # 品质
                    elif text == '品质' or text == '品質':
                        if j+1 < len(texts):
                            record['quality'] = texts[j+1].strip()

                    # 炙品
                    elif text == '炙品':
                        if j+1 < len(texts):
                            record['roast'] = texts[j+1].strip()

                    # 注解
                    elif text == '注解':
                        if j+1 < len(texts):
                            record['desc'] = texts[j+1].strip()

                all_records.append(record)

            except Exception as e:
                print(f"  获取 {pid} 失败: {e}")

            if (i + 1) % 50 == 0:
                print(f"  进度: {i+1}/{len(all_pids)}")

            await asyncio.sleep(0.5)

    print(f"\n  获取完成: {len(all_records)} 条")

    # 检查数据完整性
    with_fields = sum(1 for r in all_records if r.get('name_ch'))
    print(f"  有中文名的: {with_fields}")

    # 保存 JSON
    print(f"\n[3] 保存数据...")
    output_file = os.path.join(os.path.dirname(__file__), 'mmid_data_v2.json')
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
                     effects, source, region, tcmsp_id, source_version,
                     synced_at, created_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'v5.0-mmid', NOW(), NOW())
            ''',
                rec.get('name_ch', ''),
                rec.get('name_latin', ''),
                rec.get('name_pinyin', ''),
                rec.get('type_ch', ''),
                rec.get('function', ''),
                rec.get('source', ''),
                rec.get('region', ''),
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
