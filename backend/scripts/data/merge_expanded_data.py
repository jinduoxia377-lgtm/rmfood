"""
数据扩展整合脚本 - Phase 6
将 expand_herbs 和 expand_peptides 合并到主数据库
"""
import sys
sys.path.insert(0, '.')

# 导入扩展数据
try:
    from app.services.data_sources.expand_herbs import EXPANDED_HERBS
    print(f"已加载 EXPANDED_HERBS: {len(EXPANDED_HERBS)} 条")
except ImportError as e:
    print(f"无法导入 EXPANDED_HERBS: {e}")
    EXPANDED_HERBS = []

try:
    from app.services.data_sources.expand_peptides import EXPANDED_PEPTIDES
    print(f"已加载 EXPANDED_PEPTIDES: {len(EXPANDED_PEPTIDES)} 条")
except ImportError as e:
    print(f"无法导入 EXPANDED_PEPTIDES: {e}")
    EXPANDED_PEPTIDES = []

# 导入主数据库
from app.services.data_sources.tcmsp_client import TCMSP_HERB_DATABASE, TCMSPSyncService
from app.services.data_sources.dfbp_client import DFBP_PEPTIDE_DATABASE, DFBPSyncService

def get_all_herbs():
    """合并所有药材数据"""
    existing_names = {h["name_cn"] for h in TCMSP_HERB_DATABASE}
    new_herbs = [h for h in EXPANDED_HERBS if h["name_cn"] not in existing_names]
    return TCMSP_HERB_DATABASE + new_herbs

def get_all_peptides():
    """合并所有多肽数据"""
    existing_ids = {p["dfbp_id"] for p in DFBP_PEPTIDE_DATABASE}
    new_peptides = [p for p in EXPANDED_PEPTIDES if p.get("dfbp_id") not in existing_ids]
    return DFBP_PEPTIDE_DATABASE + new_peptides

def count_by_category(herbs):
    """按类别统计药材"""
    cats = {}
    for h in herbs:
        cat = h.get("category", "其他")
        cats[cat] = cats.get(cat, 0) + 1
    return cats

def count_by_activity(peptides):
    """按活性类型统计多肽"""
    acts = {}
    for p in peptides:
        act = p.get("activity_type", "未分类")
        acts[act] = acts.get(act, 0) + 1
    return acts

if __name__ == "__main__":
    # 统计当前数据
    print("\n" + "="*60)
    print("📊 Phase 6 数据扩展统计报告")
    print("="*60)
    
    all_herbs = get_all_herbs()
    all_peptides = get_all_peptides()
    
    print(f"\n🍀 药材数据库:")
    print(f"   - 原有数据: {len(TCMSP_HERB_DATABASE)} 种")
    print(f"   - 新增数据: {len(EXPANDED_HERBS)} 种")
    print(f"   - 去重后总计: {len(all_herbs)} 种")
    
    herb_cats = count_by_category(all_herbs)
    print(f"\n   按药理分类:")
    for cat, count in sorted(herb_cats.items(), key=lambda x: -x[1]):
        print(f"     {cat}: {count} 种")
    
    print(f"\n🧬 多肽数据库:")
    print(f"   - 原有数据: {len(DFBP_PEPTIDE_DATABASE)} 条")
    print(f"   - 新增数据: {len(EXPANDED_PEPTIDES)} 条")
    print(f"   - 去重后总计: {len(all_peptides)} 条")
    
    pep_acts = count_by_activity(all_peptides)
    print(f"\n   按活性类型:")
    for act, count in sorted(pep_acts.items(), key=lambda x: -x[1]):
        print(f"     {act}: {count} 条")
    
    print("\n" + "="*60)