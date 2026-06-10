"""
Update tcm_herbs table with effects, targets, diseases from TCMSP scrape results.
Reads tcmsp_targets_diseases_full.json and UPDATEs each record in PostgreSQL.
"""
import json
import psycopg2
from psycopg2.extras import Json
import sys

DB_CONFIG = {
    "host": "localhost",
    "port": 5432,
    "dbname": "rmfood_platform",
    "user": "postgres",
    "password": "postgres"
}

INPUT_FILE = r"d:\RMFOOD配方平台\tcmsp_data\tcmsp_targets_diseases_full.json"

def main():
    # 1. Load scraped data
    print(f"Loading {INPUT_FILE} ...")
    with open(INPUT_FILE, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    if isinstance(data, dict) and 'data' in data:
        records = data['data']
    elif isinstance(data, list):
        records = data
    else:
        print(f"Unexpected format: type={type(data)}")
        return
    
    print(f"Loaded {len(records)} herb records")
    
    # 2. Connect to DB
    conn = psycopg2.connect(**DB_CONFIG)
    cur = conn.cursor()
    
    # 3. Build name_cn -> id mapping
    cur.execute("SELECT id, name_cn FROM tcm_herbs ORDER BY id")
    db_herbs = {row[1]: row[0] for row in cur.fetchall()}
    print(f"DB has {len(db_herbs)} herbs")
    
    # 4. Statistics
    stats = {
        "matched": 0,
        "not_found": 0,
        "updated_effects": 0,
        "updated_targets": 0,
        "updated_diseases": 0,
        "total_targets": 0,
        "total_diseases": 0,
        "errors": 0
    }
    
    # 5. Update each herb
    for i, rec in enumerate(records):
        name_cn = rec.get("name_cn", "")
        
        if not name_cn:
            stats["errors"] += 1
            continue
        
        # Find matching DB record (exact match first, then fuzzy)
        db_id = db_herbs.get(name_cn)
        if not db_id:
            # Try partial match (some names may differ slightly)
            for db_name, dbid in db_herbs.items():
                if name_cn == db_name or name_cn in db_name or db_name in name_cn:
                    db_id = dbid
                    break
        
        if not db_id:
            stats["not_found"] += 1
            if stats["not_found"] <= 5:
                print(f"  NOT FOUND: [{i}] {name_cn}")
            continue
        
        # Extract fields
        effects = rec.get("effects") or ""
        targets = rec.get("targets") or []
        diseases = rec.get("diseases") or []
        
        # Validate types
        if isinstance(targets, str):
            try:
                targets = json.loads(targets)
            except:
                targets = []
        if isinstance(diseases, str):
            try:
                diseases = json.loads(diseases)
            except:
                diseases = []
        
        target_count = len(targets) if isinstance(targets, list) else 0
        disease_count = len(diseases) if isinstance(diseases, list) else 0
        
        # Execute UPDATE
        try:
            cur.execute("""
                UPDATE tcm_herbs
                SET effects = %s,
                    targets = %s,
                    diseases = %s
                WHERE id = %s
            """, (
                effects,
                Json(targets),
                Json(diseases),
                db_id
            ))
            
            stats["matched"] += 1
            stats["total_targets"] += target_count
            stats["total_diseases"] += disease_count
            
            if effects:
                stats["updated_effects"] += 1
            if target_count > 0:
                stats["updated_targets"] += 1
            if disease_count > 0:
                stats["updated_diseses"] += 1
                
        except Exception as e:
            stats["errors"] += 1
            if stats["errors"] <= 3:
                print(f"  ERROR updating {name_cn} (id={db_id}): {e}")
        
        # Progress every 50 records
        if (i + 1) % 50 == 0:
            print(f"  Processed {i+1}/{len(records)}...")
    
    conn.commit()
    
    # 6. Print final statistics
    print(f"\n{'='*60}")
    print(f"UPDATE COMPLETE")
    print(f"{'='*60}")
    print(f"  Total input records:   {len(records)}")
    print(f"  Matched & updated:    {stats['matched']}")
    print(f"  Not found in DB:      {stats['not_found']}")
    print(f"  Errors:               {stats['errors']}")
    print(f"  With effects:         {stats['updated_effects']}")
    print(f"  With targets:         {stats['updated_targets']}")
    print(f"  With diseases:        {stats.get('updated_diseses', 0)}")
    print(f"  Total target entries: {stats['total_targets']}")
    print(f"  Total disease entries:{stats['total_diseases']}")
    
    # 7. Verify DB state after update
    print(f"\n--- DB Verification ---")
    cur.execute("SELECT COUNT(*) FROM tcm_herbs WHERE effects IS NOT NULL AND effects != ''")
    print(f"  effects filled:       {cur.fetchone()[0]}")
    
    cur.execute("SELECT COUNT(*) FROM tcm_herbs WHERE targets IS NOT NULL AND jsonb_array_length(targets) > 0")
    print(f"  targets filled:       {cur.fetchone()[0]}")

    cur.execute("SELECT COUNT(*) FROM tcm_herbs WHERE diseases IS NOT NULL AND jsonb_array_length(diseases) > 0")
    print(f"  diseases filled:      {cur.fetchone()[0]}")
    
    # Sample check
    cur.execute("""
        SELECT id, name_cn, effects,
               CASE WHEN targets IS NULL THEN 0 ELSE jsonb_array_length(targets) END as tc,
               CASE WHEN diseases IS NULL THEN 0 ELSE jsonb_array_length(diseases) END as dc
        FROM tcm_herbs ORDER BY id LIMIT 5
    """)
    rows = cur.fetchall()
    print(f"\n  Sample (first 5):")
    for r in rows:
        eff_preview = (r[2] or "")[:30]
        print(f"    ID={r[0]}, Name={r[1]}, Effects='{eff_preview}', Targets={r[3]}, Diseases={r[4]}")
    
    cur.close()
    conn.close()

if __name__ == "__main__":
    main()
