import sys
sys.path.insert(0, r'D:\RMFOODFP\backend')

# Test import
try:
    from app.services.data_sources.dfbp_client import DFBP_PEPTIDE_DATABASE
    print(f"DFBP total: {len(DFBP_PEPTIDE_DATABASE)}")
    for p in DFBP_PEPTIDE_DATABASE[:3]:
        seq_raw = p.get('sequence', '')
        seq_clean = seq_raw.upper().replace('-', '')
        print(f"  {seq_raw!r} -> {seq_clean!r}")
except Exception as e:
    print(f"Import error: {e}")

# Test the food_database module
try:
    from app.services.peptide_analyzer.food_database import get_food_peptide_database
    db = get_food_peptide_database()
    stats = db.get_statistics()
    print(f"\nfood_database stats:")
    print(f"  total_peptides: {stats['total_peptides']}")
    print(f"  activities: {list(stats['activities'].keys())}")
except Exception as e:
    print(f"food_database error: {e}")
    import traceback
    traceback.print_exc()
