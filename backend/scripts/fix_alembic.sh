#!/usr/bin/env bash
# fix_alembic.sh -- Rename all Alembic migration files to date-stamped format
# and update revision/down_revision strings inside each file.
#
# Run from the repository root (where backend/ lives):
#   bash fix_alembic.sh
#
# IMPORTANT: This script renames files in-place and runs sed to update
# revision ID strings. Create a git commit or backup before running.

set -euo pipefail

VERSIONS_DIR="backend/alembic/versions"

if [ ! -d "$VERSIONS_DIR" ]; then
    echo "ERROR: $VERSIONS_DIR does not exist. Run from repo root." >&2
    exit 1
fi

# ---- helper: extract old revision id from a Python file ----
get_revision() {
    grep "^revision\s*=" "$1" | sed "s/.*=\s*[\"']\([^\"]*\)[\"'].*/\1/"
}

# =============================================
# 1. 001 -> 20260502_000000_initial_schema
# =============================================
echo "[1/32] 001_initial_schema.py -> 20260502_000000_initial_schema.py"
mv "$VERSIONS_DIR/001_initial_schema.py" "$VERSIONS_DIR/20260502_000000_initial_schema.py"
sed -i "s/revision: str = '001_initial'/revision: str = '20260502_000000_initial'/g" \
    "$VERSIONS_DIR/20260502_000000_initial_schema.py"

# =============================================
# 2. 002_add_account_security -> 20260502_000100_account_security
# =============================================
echo "[2/32] 002_add_account_security.py -> 20260502_000100_account_security.py"
mv "$VERSIONS_DIR/002_add_account_security.py" "$VERSIONS_DIR/20260502_000100_account_security.py"
sed -i "s/revision: str = '002_account_security'/revision: str = '20260502_000100_account_security'/g" \
    "$VERSIONS_DIR/20260502_000100_account_security.py"
sed -i "s/down_revision: Union\[str, None\] = '001_initial'/down_revision: Union[str, None] = '20260502_000000_initial'/g" \
    "$VERSIONS_DIR/20260502_000100_account_security.py"

# =============================================
# 3. 002_formula_deep_integration -> 20260503_000000_formula_deep_integration
# =============================================
echo "[3/32] 002_formula_deep_integration.py -> 20260503_000000_formula_deep_integration.py"
mv "$VERSIONS_DIR/002_formula_deep_integration.py" "$VERSIONS_DIR/20260503_000000_formula_deep_integration.py"
sed -i "s/revision: str = '002_formula_deep_integration'/revision: str = '20260503_000000_formula_deep_integration'/g" \
    "$VERSIONS_DIR/20260503_000000_formula_deep_integration.py"
sed -i "s/down_revision: Union\[str, None\] = '002_account_security'/down_revision: Union[str, None] = '20260502_000100_account_security'/g" \
    "$VERSIONS_DIR/20260503_000000_formula_deep_integration.py"

# =============================================
# 4. 003_sss_enterprise_features -> 20260502_001000_sss_enterprise
# =============================================
echo "[4/32] 003_sss_enterprise_features.py -> 20260502_001000_sss_enterprise.py"
mv "$VERSIONS_DIR/003_sss_enterprise_features.py" "$VERSIONS_DIR/20260502_001000_sss_enterprise.py"
sed -i "s/revision = '003_sss'/revision = '20260502_001000_sss_enterprise'/g" \
    "$VERSIONS_DIR/20260502_001000_sss_enterprise.py"
sed -i "s/down_revision = '002_formula_deep_integration'/down_revision = '20260503_000000_formula_deep_integration'/g" \
    "$VERSIONS_DIR/20260502_001000_sss_enterprise.py"

# =============================================
# 5. 004_add_peptide_analysis_design -> 20260503_000100_peptide_analysis
# =============================================
echo "[5/32] 004_add_peptide_analysis_design.py -> 20260503_000100_peptide_analysis.py"
mv "$VERSIONS_DIR/004_add_peptide_analysis_design.py" "$VERSIONS_DIR/20260503_000100_peptide_analysis.py"
sed -i "s/revision = '004_peptide'/revision = '20260503_000100_peptide_analysis'/g" \
    "$VERSIONS_DIR/20260503_000100_peptide_analysis.py"
# Tuple down_revision: ('003_sss', '002_formula_deep_integration')
sed -i "s/down_revision = ('003_sss', '002_formula_deep_integration')/down_revision = ('20260502_001000_sss_enterprise', '20260503_000000_formula_deep_integration')/g" \
    "$VERSIONS_DIR/20260503_000100_peptide_analysis.py"

# =============================================
# 6. 005_upgrade_notification_system -> 20260504_000000_upgrade_notifications
# =============================================
echo "[6/32] 005_upgrade_notification_system.py -> 20260504_000000_upgrade_notifications.py"
mv "$VERSIONS_DIR/005_upgrade_notification_system.py" "$VERSIONS_DIR/20260504_000000_upgrade_notifications.py"
sed -i "s/revision: str = '005_upgrade_notification_system'/revision: str = '20260504_000000_upgrade_notifications'/g" \
    "$VERSIONS_DIR/20260504_000000_upgrade_notifications.py"
sed -i "s/down_revision: Union\[str, None\] = '004_peptide'/down_revision: Union[str, None] = '20260503_000100_peptide_analysis'/g" \
    "$VERSIONS_DIR/20260504_000000_upgrade_notifications.py"

# =============================================
# 7. 006_add_terminology_tables -> 20260517_000000_terminology_tables
# =============================================
echo "[7/32] 006_add_terminology_tables.py -> 20260517_000000_terminology_tables.py"
mv "$VERSIONS_DIR/006_add_terminology_tables.py" "$VERSIONS_DIR/20260517_000000_terminology_tables.py"
sed -i "s/revision: str = '006_terminology'/revision: str = '20260517_000000_terminology_tables'/g" \
    "$VERSIONS_DIR/20260517_000000_terminology_tables.py"
sed -i "s/down_revision: Union\[str, None\] = '005_upgrade_notification_system'/down_revision: Union[str, None] = '20260504_000000_upgrade_notifications'/g" \
    "$VERSIONS_DIR/20260517_000000_terminology_tables.py"

# =============================================
# 8. 007_add_cloud_sync_team_ai_tables -> 20260520_000000_cloud_sync_team_ai
# =============================================
echo "[8/32] 007_add_cloud_sync_team_ai_tables.py -> 20260520_000000_cloud_sync_team_ai.py"
mv "$VERSIONS_DIR/007_add_cloud_sync_team_ai_tables.py" "$VERSIONS_DIR/20260520_000000_cloud_sync_team_ai.py"
sed -i "s/revision: str = '007_cloud_sync'/revision: str = '20260520_000000_cloud_sync_team_ai'/g" \
    "$VERSIONS_DIR/20260520_000000_cloud_sync_team_ai.py"
sed -i "s/down_revision: Union\[str, None\] = '006_terminology'/down_revision: Union[str, None] = '20260517_000000_terminology_tables'/g" \
    "$VERSIONS_DIR/20260520_000000_cloud_sync_team_ai.py"

# =============================================
# 9. 008_add_performance_indexes -> 20260602_000000_performance_indexes
# =============================================
echo "[9/32] 008_add_performance_indexes.py -> 20260602_000000_performance_indexes.py"
mv "$VERSIONS_DIR/008_add_performance_indexes.py" "$VERSIONS_DIR/20260602_000000_performance_indexes.py"
sed -i "s/revision = '008_performance'/revision = '20260602_000000_performance_indexes'/g" \
    "$VERSIONS_DIR/20260602_000000_performance_indexes.py"
sed -i "s/down_revision = '007_cloud_sync'/down_revision = '20260520_000000_cloud_sync_team_ai'/g" \
    "$VERSIONS_DIR/20260602_000000_performance_indexes.py"

# =============================================
# 10. 009_add_missing_fk_indexes -> 20260603_000000_missing_fk_indexes
# =============================================
echo "[10/32] 009_add_missing_fk_indexes.py -> 20260603_000000_missing_fk_indexes.py"
mv "$VERSIONS_DIR/009_add_missing_fk_indexes.py" "$VERSIONS_DIR/20260603_000000_missing_fk_indexes.py"
sed -i "s/revision: str = '009_missing_fk'/revision: str = '20260603_000000_missing_fk_indexes'/g" \
    "$VERSIONS_DIR/20260603_000000_missing_fk_indexes.py"
sed -i "s/down_revision: Union\[str, None\] = '008_performance'/down_revision: Union[str, None] = '20260602_000000_performance_indexes'/g" \
    "$VERSIONS_DIR/20260603_000000_missing_fk_indexes.py"

# =============================================
# 11. 010_add_fulltext_search -> 20260603_010000_fulltext_search
# =============================================
echo "[11/32] 010_add_fulltext_search.py -> 20260603_010000_fulltext_search.py"
mv "$VERSIONS_DIR/010_add_fulltext_search.py" "$VERSIONS_DIR/20260603_010000_fulltext_search.py"
sed -i "s/revision: str = '010_fulltext'/revision: str = '20260603_010000_fulltext_search'/g" \
    "$VERSIONS_DIR/20260603_010000_fulltext_search.py"
sed -i "s/down_revision: Union\[str, None\] = '009_missing_fk'/down_revision: Union[str, None] = '20260603_000000_missing_fk_indexes'/g" \
    "$VERSIONS_DIR/20260603_010000_fulltext_search.py"

# =============================================
# 12. 011_add_soft_delete -> 20260603_020000_soft_delete
# =============================================
echo "[12/32] 011_add_soft_delete.py -> 20260603_020000_soft_delete.py"
mv "$VERSIONS_DIR/011_add_soft_delete.py" "$VERSIONS_DIR/20260603_020000_soft_delete.py"
sed -i "s/revision: str = '011_soft_delete'/revision: str = '20260603_020000_soft_delete'/g" \
    "$VERSIONS_DIR/20260603_020000_soft_delete.py"
sed -i "s/down_revision: Union\[str, None\] = '010_fulltext'/down_revision: Union[str, None] = '20260603_010000_fulltext_search'/g" \
    "$VERSIONS_DIR/20260603_020000_soft_delete.py"

# =============================================
# 13. 012_add_audit_fields -> 20260603_030000_audit_fields
# =============================================
echo "[13/32] 012_add_audit_fields.py -> 20260603_030000_audit_fields.py"
mv "$VERSIONS_DIR/012_add_audit_fields.py" "$VERSIONS_DIR/20260603_030000_audit_fields.py"
sed -i "s/revision: str = '012_audit'/revision: str = '20260603_030000_audit_fields'/g" \
    "$VERSIONS_DIR/20260603_030000_audit_fields.py"
sed -i "s/down_revision: Union\[str, None\] = '011_soft_delete'/down_revision: Union[str, None] = '20260603_020000_soft_delete'/g" \
    "$VERSIONS_DIR/20260603_030000_audit_fields.py"

# =============================================
# 14. 013_add_composite_indexes -> 20260603_040000_composite_indexes
# =============================================
echo "[14/32] 013_add_composite_indexes.py -> 20260603_040000_composite_indexes.py"
mv "$VERSIONS_DIR/013_add_composite_indexes.py" "$VERSIONS_DIR/20260603_040000_composite_indexes.py"
sed -i "s/revision: str = '013_composite'/revision: str = '20260603_040000_composite_indexes'/g" \
    "$VERSIONS_DIR/20260603_040000_composite_indexes.py"
sed -i "s/down_revision: Union\[str, None\] = '012_audit'/down_revision: Union[str, None] = '20260603_030000_audit_fields'/g" \
    "$VERSIONS_DIR/20260603_040000_composite_indexes.py"

# =============================================
# 15. 014_add_knowledge_graph_tables -> 20260603_050000_knowledge_graph
# =============================================
echo "[15/32] 014_add_knowledge_graph_tables.py -> 20260603_050000_knowledge_graph.py"
mv "$VERSIONS_DIR/014_add_knowledge_graph_tables.py" "$VERSIONS_DIR/20260603_050000_knowledge_graph.py"
sed -i "s/revision: str = '014_knowledge_graph'/revision: str = '20260603_050000_knowledge_graph'/g" \
    "$VERSIONS_DIR/20260603_050000_knowledge_graph.py"
sed -i "s/down_revision: Union\[str, None\] = '013_composite'/down_revision: Union[str, None] = '20260603_040000_composite_indexes'/g" \
    "$VERSIONS_DIR/20260603_050000_knowledge_graph.py"

# =============================================
# 16. 015_enhance_tcm_dfbp_tables -> 20260603_060000_enhance_tcm_dfbp
# =============================================
echo "[16/32] 015_enhance_tcm_dfbp_tables.py -> 20260603_060000_enhance_tcm_dfbp.py"
mv "$VERSIONS_DIR/015_enhance_tcm_dfbp_tables.py" "$VERSIONS_DIR/20260603_060000_enhance_tcm_dfbp.py"
sed -i "s/revision: str = '015_tcm_dfbp'/revision: str = '20260603_060000_enhance_tcm_dfbp'/g" \
    "$VERSIONS_DIR/20260603_060000_enhance_tcm_dfbp.py"
sed -i "s/down_revision: Union\[str, None\] = '014_knowledge_graph'/down_revision: Union[str, None] = '20260603_050000_knowledge_graph'/g" \
    "$VERSIONS_DIR/20260603_060000_enhance_tcm_dfbp.py"

# =============================================
# 17. 016_add_search_persistence -> 20260624_000000_search_persistence
# =============================================
echo "[17/32] 016_add_search_persistence.py -> 20260624_000000_search_persistence.py"
mv "$VERSIONS_DIR/016_add_search_persistence.py" "$VERSIONS_DIR/20260624_000000_search_persistence.py"
sed -i "s/revision = '016_add_search_persistence'/revision = '20260624_000000_search_persistence'/g" \
    "$VERSIONS_DIR/20260624_000000_search_persistence.py"
sed -i "s/down_revision = '015_tcm_dfbp'/down_revision = '20260603_060000_enhance_tcm_dfbp'/g" \
    "$VERSIONS_DIR/20260624_000000_search_persistence.py"

# =============================================
# 18. 017_bigint_timezone_upgrade -> 20260630_000000_bigint_timezone_upgrade
# =============================================
echo "[18/32] 017_bigint_timezone_upgrade.py -> 20260630_000000_bigint_timezone_upgrade.py"
mv "$VERSIONS_DIR/017_bigint_timezone_upgrade.py" "$VERSIONS_DIR/20260630_000000_bigint_timezone_upgrade.py"
sed -i "s/revision = '017_bigint_timezone_upgrade'/revision = '20260630_000000_bigint_timezone_upgrade'/g" \
    "$VERSIONS_DIR/20260630_000000_bigint_timezone_upgrade.py"
sed -i "s/down_revision = '016_add_search_persistence'/down_revision = '20260624_000000_search_persistence'/g" \
    "$VERSIONS_DIR/20260630_000000_bigint_timezone_upgrade.py"

# =============================================
# 19. 018_add_rls_policies -> 20260630_010000_add_rls_policies
# =============================================
echo "[19/32] 018_add_rls_policies.py -> 20260630_010000_add_rls_policies.py"
mv "$VERSIONS_DIR/018_add_rls_policies.py" "$VERSIONS_DIR/20260630_010000_add_rls_policies.py"
sed -i "s/revision = '018_add_rls_policies'/revision = '20260630_010000_add_rls_policies'/g" \
    "$VERSIONS_DIR/20260630_010000_add_rls_policies.py"
sed -i "s/down_revision = '017_bigint_timezone_upgrade'/down_revision = '20260630_000000_bigint_timezone_upgrade'/g" \
    "$VERSIONS_DIR/20260630_010000_add_rls_policies.py"

# =============================================
# 20. 018_split_tcm_herbs_mmid -> 20260702_000000_split_tcm_herbs_mmid
# =============================================
echo "[20/32] 018_split_tcm_herbs_mmid.py -> 20260702_000000_split_tcm_herbs_mmid.py"
mv "$VERSIONS_DIR/018_split_tcm_herbs_mmid.py" "$VERSIONS_DIR/20260702_000000_split_tcm_herbs_mmid.py"
sed -i 's/revision = "018b_split_tcm_herbs"/revision = "20260702_000000_split_tcm_herbs_mmid"/g' \
    "$VERSIONS_DIR/20260702_000000_split_tcm_herbs_mmid.py"
sed -i 's/down_revision = "018_add_rls_policies"/down_revision = "20260630_010000_add_rls_policies"/g' \
    "$VERSIONS_DIR/20260702_000000_split_tcm_herbs_mmid.py"

# =============================================
# 21. 019_add_json_gin_indexes -> 20260630_020000_add_json_gin_indexes
# =============================================
echo "[21/32] 019_add_json_gin_indexes.py -> 20260630_020000_add_json_gin_indexes.py"
mv "$VERSIONS_DIR/019_add_json_gin_indexes.py" "$VERSIONS_DIR/20260630_020000_add_json_gin_indexes.py"
sed -i "s/revision = '019_add_json_gin_indexes'/revision = '20260630_020000_add_json_gin_indexes'/g" \
    "$VERSIONS_DIR/20260630_020000_add_json_gin_indexes.py"
sed -i "s/down_revision = '018b_split_tcm_herbs'/down_revision = '20260702_000000_split_tcm_herbs_mmid'/g" \
    "$VERSIONS_DIR/20260630_020000_add_json_gin_indexes.py"

# =============================================
# 22. 020_add_share_fields -> 20260702_010000_add_share_fields
# =============================================
echo "[22/32] 020_add_share_fields.py -> 20260702_010000_add_share_fields.py"
mv "$VERSIONS_DIR/020_add_share_fields.py" "$VERSIONS_DIR/20260702_010000_add_share_fields.py"
sed -i 's/revision = "020_add_share_fields"/revision = "20260702_010000_add_share_fields"/g' \
    "$VERSIONS_DIR/20260702_010000_add_share_fields.py"
sed -i 's/down_revision = "019_add_json_gin_indexes"/down_revision = "20260630_020000_add_json_gin_indexes"/g' \
    "$VERSIONS_DIR/20260702_010000_add_share_fields.py"

# =============================================
# 23. 021_add_symmap_herbs_table -> 20260703_000000_symmap_herbs_table
# =============================================
echo "[23/32] 021_add_symmap_herbs_table.py -> 20260703_000000_symmap_herbs_table.py"
mv "$VERSIONS_DIR/021_add_symmap_herbs_table.py" "$VERSIONS_DIR/20260703_000000_symmap_herbs_table.py"
sed -i 's/revision = "021_add_symmap_herbs_table"/revision = "20260703_000000_symmap_herbs_table"/g' \
    "$VERSIONS_DIR/20260703_000000_symmap_herbs_table.py"
sed -i 's/down_revision = "020_add_share_fields"/down_revision = "20260702_010000_add_share_fields"/g' \
    "$VERSIONS_DIR/20260703_000000_symmap_herbs_table.py"

# =============================================
# 24. 022_fix_symmap_herbdb_id_length -> 20260703_010000_fix_symmap_herbdb_id
# =============================================
echo "[24/32] 022_fix_symmap_herbdb_id_length.py -> 20260703_010000_fix_symmap_herbdb_id.py"
mv "$VERSIONS_DIR/022_fix_symmap_herbdb_id_length.py" "$VERSIONS_DIR/20260703_010000_fix_symmap_herbdb_id.py"
sed -i 's/revision = "022_fix_symmap_herbdb_id_length"/revision = "20260703_010000_fix_symmap_herbdb_id"/g' \
    "$VERSIONS_DIR/20260703_010000_fix_symmap_herbdb_id.py"
sed -i 's/down_revision = "021_add_symmap_herbs_table"/down_revision = "20260703_000000_symmap_herbs_table"/g' \
    "$VERSIONS_DIR/20260703_010000_fix_symmap_herbdb_id.py"

# =============================================
# 25. 023_increase_symmap_field_lengths -> 20260703_020000_increase_symmap_lengths
# =============================================
echo "[25/32] 023_increase_symmap_field_lengths.py -> 20260703_020000_increase_symmap_lengths.py"
mv "$VERSIONS_DIR/023_increase_symmap_field_lengths.py" "$VERSIONS_DIR/20260703_020000_increase_symmap_lengths.py"
sed -i 's/revision = "023_symmap_field_lengths"/revision = "20260703_020000_increase_symmap_lengths"/g' \
    "$VERSIONS_DIR/20260703_020000_increase_symmap_lengths.py"
sed -i 's/down_revision = "022_fix_symmap_herbdb_id_length"/down_revision = "20260703_010000_fix_symmap_herbdb_id"/g' \
    "$VERSIONS_DIR/20260703_020000_increase_symmap_lengths.py"

# =============================================
# 26. 20260708_183155_add_extra... -> 20260708_183155_add_extra_knowledge_source_tcm_herbs
# =============================================
echo "[26/32] 20260708_183155_add_extra_knowledge_and_source_to_tcm_.py -> 20260708_183155_add_extra_knowledge_source_tcm_herbs.py"
OLD="20260708_183155_add_extra_knowledge_and_source_to_tcm_.py"
NEW="20260708_183155_add_extra_knowledge_source_tcm_herbs.py"
mv "$VERSIONS_DIR/$OLD" "$VERSIONS_DIR/$NEW"
sed -i "s/revision: str = 'f21c3fe4ee7b'/revision: str = '20260708_183155_extra_knowledge_source'/g" \
    "$VERSIONS_DIR/$NEW"
sed -i "s/down_revision: Union\[str, None\] = '023_symmap_field_lengths'/down_revision: Union[str, None] = '20260703_020000_increase_symmap_lengths'/g" \
    "$VERSIONS_DIR/$NEW"

# =============================================
# 27. 027_potion_vft_integration -> 20260718_000000_potion_vft_integration
# =============================================
echo "[27/32] 027_potion_vft_integration.py -> 20260718_000000_potion_vft_integration.py"
mv "$VERSIONS_DIR/027_potion_vft_integration.py" "$VERSIONS_DIR/20260718_000000_potion_vft_integration.py"
sed -i "s/revision = '027_potion_vft_integration'/revision = '20260718_000000_potion_vft_integration'/g" \
    "$VERSIONS_DIR/20260718_000000_potion_vft_integration.py"
sed -i "s/down_revision = 'f21c3fe4ee7b'/down_revision = '20260708_183155_extra_knowledge_source'/g" \
    "$VERSIONS_DIR/20260718_000000_potion_vft_integration.py"

# =============================================
# 28. 028_enable_pgvector -> 20260720_000000_enable_pgvector
# =============================================
echo "[28/32] 028_enable_pgvector.py -> 20260720_000000_enable_pgvector.py"
mv "$VERSIONS_DIR/028_enable_pgvector.py" "$VERSIONS_DIR/20260720_000000_enable_pgvector.py"
sed -i "s/revision = '028_enable_pgvector'/revision = '20260720_000000_enable_pgvector'/g" \
    "$VERSIONS_DIR/20260720_000000_enable_pgvector.py"
sed -i "s/down_revision = '027_potion_vft_integration'/down_revision = '20260718_000000_potion_vft_integration'/g" \
    "$VERSIONS_DIR/20260720_000000_enable_pgvector.py"

# =============================================
# 29. 029_fix_pantry_schema -> 20260720_010000_fix_pantry_schema
# =============================================
echo "[29/32] 029_fix_pantry_schema.py -> 20260720_010000_fix_pantry_schema.py"
mv "$VERSIONS_DIR/029_fix_pantry_schema.py" "$VERSIONS_DIR/20260720_010000_fix_pantry_schema.py"
sed -i "s/revision = '029_fix_pantry_schema'/revision = '20260720_010000_fix_pantry_schema'/g" \
    "$VERSIONS_DIR/20260720_010000_fix_pantry_schema.py"
sed -i "s/down_revision = '028_enable_pgvector'/down_revision = '20260720_000000_enable_pgvector'/g" \
    "$VERSIONS_DIR/20260720_010000_fix_pantry_schema.py"

# =============================================
# 30. 030_add_openfoodfacts_support -> 20260720_020000_add_openfoodfacts_support
# =============================================
echo "[30/32] 030_add_openfoodfacts_support.py -> 20260720_020000_add_openfoodfacts_support.py"
mv "$VERSIONS_DIR/030_add_openfoodfacts_support.py" "$VERSIONS_DIR/20260720_020000_add_openfoodfacts_support.py"
sed -i "s/revision = '030_add_openfoodfacts_support'/revision = '20260720_020000_add_openfoodfacts_support'/g" \
    "$VERSIONS_DIR/20260720_020000_add_openfoodfacts_support.py"
sed -i "s/down_revision = '029_fix_pantry_schema'/down_revision = '20260720_010000_fix_pantry_schema'/g" \
    "$VERSIONS_DIR/20260720_020000_add_openfoodfacts_support.py"

# =============================================
# 31. 031_add_off_safety_fields -> 20260722_000000_add_off_safety_fields
# =============================================
echo "[31/32] 031_add_off_safety_fields.py -> 20260722_000000_add_off_safety_fields.py"
mv "$VERSIONS_DIR/031_add_off_safety_fields.py" "$VERSIONS_DIR/20260722_000000_add_off_safety_fields.py"
sed -i "s/revision = '031_add_off_safety_fields'/revision = '20260722_000000_add_off_safety_fields'/g" \
    "$VERSIONS_DIR/20260722_000000_add_off_safety_fields.py"
sed -i "s/down_revision = '030_add_openfoodfacts_support'/down_revision = '20260720_020000_add_openfoodfacts_support'/g" \
    "$VERSIONS_DIR/20260722_000000_add_off_safety_fields.py"

# =============================================
# 32. 20260723_113212_add_organization_id_column_to_formulas_... -> ..._add_organization_id_to_all
# =============================================
echo "[32/32] 20260723_113212_add_organization_id_column_to_formulas_.py -> 20260723_113212_add_organization_id_to_all.py"
OLD2="20260723_113212_add_organization_id_column_to_formulas_.py"
NEW2="20260723_113212_add_organization_id_to_all.py"
mv "$VERSIONS_DIR/$OLD2" "$VERSIONS_DIR/$NEW2"
sed -i "s/revision: str = 'fb1974aceb83'/revision: str = '20260723_113212_add_organization_id'/g" \
    "$VERSIONS_DIR/$NEW2"
sed -i "s/down_revision: Union\[str, None\] = '031_add_off_safety_fields'/down_revision: Union[str, None] = '20260722_000000_add_off_safety_fields'/g" \
    "$VERSIONS_DIR/$NEW2"

echo ""
echo "All 32 migration files renamed and revision IDs updated."
echo ""
echo "Verification:"
echo "  cd backend && alembic heads"
echo "  cd backend && alembic current"
