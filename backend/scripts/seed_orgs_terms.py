# -*- coding: utf-8 -*-
"""Seed organizations and terms data - fixed timezone"""
import asyncio, sys
sys.path.insert(0, 'D:/RMFOODFP/backend')

from app.core.database.session import get_session_factory
from sqlalchemy import text
from datetime import datetime

async def seed():
    Session = get_session_factory()
    async with Session() as db:
        # Use naive datetime (no timezone)
        now = datetime.now()
        
        # Get existing user ID for owner
        r = await db.execute(text("SELECT id FROM users LIMIT 1"))
        user_row = r.fetchone()
        owner_id = user_row[0] if user_row else 1
        print(f"Using owner_id: {owner_id}")
        
        # Seed organizations (3 records)
        orgs = [
            ('华夏中医药研究院', 'professional'),
            ('同仁堂健康科技', 'professional'),
            ('云南白药研发中心', 'enterprise'),
        ]
        inserted = 0
        for name, plan in orgs:
            rc = await db.execute(text("SELECT COUNT(*) FROM organizations WHERE name = :n"), {'n': name})
            if rc.scalar_one() > 0:
                continue
            oid = 1000 + inserted * 100
            await db.execute(text("""
                INSERT INTO organizations (id, name, slug, description, logo_url, owner_id,
                    plan, settings, created_at, updated_at)
                VALUES (:id, :name, :slug, :desc, '', :owner, :plan, '{}', :ca, :ua)
            """), {
                'id': oid,
                'name': name,
                'slug': name[:4].lower(),
                'desc': f'{name}简介',
                'owner': owner_id,
                'plan': plan,
                'ca': now,
                'ua': now,
            })
            inserted += 1
        print(f"Organizations: {inserted} inserted")
        
        # Seed term_categories (10 records)
        cats = [
            '补气药', '补血药', '活血祛瘀药', '清热解毒药', '解表药',
            '温里药', '理气药', '消食化湿药', '安神药', '祛风湿药'
        ]
        inserted = 0
        for i, name in enumerate(cats):
            rc = await db.execute(text("SELECT COUNT(*) FROM term_categories WHERE name = :n"), {'n': name})
            if rc.scalar_one() > 0:
                continue
            cid = 2000 + inserted * 100
            await db.execute(text("""
                INSERT INTO term_categories (id, name, description, level, sort_order, created_at, updated_at)
                VALUES (:id, :name, :desc, 1, :sort, :ca, :ua)
            """), {
                'id': cid,
                'name': name,
                'desc': f'{name}分类',
                'sort': i,
                'ca': now,
                'ua': now,
            })
            inserted += 1
        print(f"Categories: {inserted} inserted")
        
        # Seed terms (20 records)
        terms = [
            ('人参', '补气药', '大补元气'),
            ('黄芪', '补气药', '补气升阳'),
            ('当归', '补血药', '补血活血'),
            ('丹参', '活血祛瘀药', '活血祛瘀'),
            ('金银花', '清热解毒药', '清热解毒'),
            ('茯苓', '化痰药', '利水渗湿'),
            ('陈皮', '理气药', '理气健脾'),
            ('甘草', '补气药', '补脾益气'),
            ('酸枣仁', '安神药', '养心安神'),
            ('柴胡', '解表药', '疏肝解郁'),
            ('川芎', '活血祛瘀药', '活血行气'),
            ('白芍', '补血药', '养血敛阴'),
            ('熟地黄', '补血药', '滋阴补血'),
            ('连翘', '清热解毒药', '消肿散结'),
            ('半夏', '化痰药', '燥湿化痰'),
            ('薄荷', '解表药', '疏散风热'),
            ('桂枝', '温里药', '温通经脉'),
            ('附子', '温里药', '回阳救逆'),
            ('白术', '补气药', '健脾益气'),
            ('山药', '补气药', '健脾益胃'),
        ]
        cat_result = await db.execute(text("SELECT id, name FROM term_categories"))
        cat_map = {row[1]: row[0] for row in cat_result.fetchall()}
        
        inserted = 0
        for term_name, cat_name, definition in terms:
            cat_id = cat_map.get(cat_name)
            if not cat_id:
                continue
            rc = await db.execute(text("SELECT COUNT(*) FROM terms WHERE term = :t"), {'t': term_name})
            if rc.scalar_one() > 0:
                continue
            tid = 3000 + inserted * 100
            await db.execute(text("""
                INSERT INTO terms (id, term, definition, category_id, is_standard, confidence, created_at, updated_at)
                VALUES (:id, :term, :def, :cat_id, TRUE, 0.95, :ca, :ua)
            """), {
                'id': tid,
                'term': term_name,
                'def': definition,
                'cat_id': cat_id,
                'ca': now,
                'ua': now,
            })
            inserted += 1
        print(f"Terms: {inserted} inserted")
        
        await db.commit()
        print("\nDone!")

asyncio.run(seed())
