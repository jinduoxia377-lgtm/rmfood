import sys
sys.path.insert(0, r'D:\RMFOODFP\backend')
sys.stdout.reconfigure(encoding='utf-8')
print('=== 1. 当前运行进程 import 的模块文件路径 ===')
import app.services.ai_models.advanced_peptide_analyzer as m
print('module file:', m.__file__)
print('module has _compute_herb_interactions:', hasattr(m.AdvancedPeptideAnalyzer, '_compute_herb_interactions'))

print()
print('=== 2. 磁盘上文件是否含新字段 ===')
disk = open(r'D:\RMFOODFP\backend\app\services\ai_models\advanced_peptide_analyzer.py', encoding='utf-8').read()
print('磁盘含 herb_interactions:', 'herb_interactions' in disk)
print('磁盘含 _compute_herb_interactions:', '_compute_herb_interactions' in disk)
print('磁盘含 overall_synergy_score_adjusted:', 'overall_synergy_score_adjusted' in disk)
print('磁盘仍含 fallback_8herb_map:', 'fallback_8herb_map' in disk)

print()
print('=== 3. food_peptide_service 磁盘 vs 模块 ===')
import app.services.peptide_analyzer.food_peptide_service as fs
disk2 = open(r'D:\RMFOODFP\backend\app\services\peptide_analyzer\food_peptide_service.py', encoding='utf-8').read()
print('磁盘含 ml_library_real_count:', 'ml_library_real_count' in disk2)
print('磁盘含 程序合成:', '程序合成' in disk2)

print()
print('=== 4. 直接调 _get_herb_primary_effects（黄芪）===')
an = m.AdvancedPeptideAnalyzer()
r = an._get_herb_primary_effects('黄芪')
print('黄芪 effects:', r)
print()
print('=== 5. 直接调 _compute_herb_interactions（人参+黄芪）===')
r2 = an._compute_herb_interactions(['人参','黄芪','菊花'], 0.45)
print('配伍结果:', r2)
