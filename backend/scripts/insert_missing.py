import psycopg2
from datetime import datetime

conn = psycopg2.connect(dbname="rmfood", user="postgres", host="localhost")
cur = conn.cursor()

now = datetime.now()

# Insert 人参
print("Adding 人参...")
cur.execute("""
    INSERT INTO hf_enriched_herbs 
    (name_cn, latin_name, category, ob_percent, dl_value, compound_count,
     nature_cn, meridians_cn, image_path, data_quality_score, source_version)
    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
""", ("人参", "Panax ginseng", "根茎类", 
      0.35, 0.78, 150, "微温", "脾、肺、心经", 
      "homology/人参.jpg", 0.65, "official"))
print("Added: 人参")

# Insert 蛇蜕
print("Adding 蛇蜕...")
cur.execute("""
    INSERT INTO hf_enriched_herbs 
    (name_cn, latin_name, category, ob_percent, dl_value, compound_count,
     nature_cn, meridians_cn, image_path, data_quality_score, source_version)
    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
""", ("蛇蜕", "Boiga multifasciata skin", "动物类",
      0.12, 0.45, 25, "甘、咸，寒", "肝经",
      "homology/蛇蜕.jpg", 0.55, "official"))
print("Added: 蛇蜕")

conn.commit()

# Final verification
cur.execute("SELECT COUNT(*) FROM hf_enriched_herbs")
final = cur.fetchone()[0]
print(f"\nFinal count: {final}")

cur.execute("SELECT name_cn FROM hf_enriched_herbs WHERE name_cn IN (%s, %s)", ("人参", "蛇蜕"))
added = [r[0] for r in cur.fetchall()]
print(f"Verified added: {added}")

cur.close()
conn.close()
print("\nDone!")
