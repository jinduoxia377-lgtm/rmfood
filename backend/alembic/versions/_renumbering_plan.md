# Alembic Migration Renumbering Plan

> Generated: 2026-07-24
> Purpose: Eliminate naming conflicts and establish a consistent date-stamped revision ID scheme.

## Problem Statement

1. **Duplicate "002" prefix**: Two files `002_add_account_security.py` and `002_formula_deep_integration.py` share the same numeric prefix. They have different `revision` IDs (`002_account_security` vs `002_formula_deep_integration`) so Alembic does not crash, but the filenames create human confusion and make it harder to spot ordering issues.

2. **Inconsistent revision IDs**: Files use abbreviated revision strings (`003_sss`, `004_peptide`, `018b_split_tcm_herbs`), UUID-style auto-generated IDs (`f21c3fe4ee7b`, `fb1974aceb83`), and full descriptive strings all in the same directory.

3. **Gap in numbering**: Files jump from `023_` directly to `027_`. There is no 024/025/026 -- however, this gap is filled by date-stamped file `20260708_*` (logical position 26). The numbering is inconsistent but functionally complete.

## Complete BEFORE -> AFTER Mapping

| # | Before (filename) | Before (revision ID) | After (filename) | After (revision ID) |
|---|---|---|---|---|
| 1 | `001_initial_schema.py` | `001_initial` | `20260502_000000_initial_schema.py` | `20260502_000000_initial` |
| 2 | `002_add_account_security.py` | `002_account_security` | `20260502_000100_account_security.py` | `20260502_000100_account_security` |
| 3 | `002_formula_deep_integration.py` | `002_formula_deep_integration` | `20260503_000000_formula_deep_integration.py` | `20260503_000000_formula_deep_integration` |
| 4 | `003_sss_enterprise_features.py` | `003_sss` | `20260502_001000_sss_enterprise.py` | `20260502_001000_sss_enterprise` |
| 5 | `004_add_peptide_analysis_design.py` | `004_peptide` | `20260503_000100_peptide_analysis.py` | `20260503_000100_peptide_analysis` |
| 6 | `005_upgrade_notification_system.py` | `005_upgrade_notification_system` | `20260504_000000_upgrade_notifications.py` | `20260504_000000_upgrade_notifications` |
| 7 | `006_add_terminology_tables.py` | `006_terminology` | `20260517_000000_terminology_tables.py` | `20260517_000000_terminology_tables` |
| 8 | `007_add_cloud_sync_team_ai_tables.py` | `007_cloud_sync` | `20260520_000000_cloud_sync_team_ai.py` | `20260520_000000_cloud_sync_team_ai` |
| 9 | `008_add_performance_indexes.py` | `008_performance` | `20260602_000000_performance_indexes.py` | `20260602_000000_performance_indexes` |
| 10 | `009_add_missing_fk_indexes.py` | `009_missing_fk` | `20260603_000000_missing_fk_indexes.py` | `20260603_000000_missing_fk_indexes` |
| 11 | `010_add_fulltext_search.py` | `010_fulltext` | `20260603_010000_fulltext_search.py` | `20260603_010000_fulltext_search` |
| 12 | `011_add_soft_delete.py` | `011_soft_delete` | `20260603_020000_soft_delete.py` | `20260603_020000_soft_delete` |
| 13 | `012_add_audit_fields.py` | `012_audit` | `20260603_030000_audit_fields.py` | `20260603_030000_audit_fields` |
| 14 | `013_add_composite_indexes.py` | `013_composite` | `20260603_040000_composite_indexes.py` | `20260603_040000_composite_indexes` |
| 15 | `014_add_knowledge_graph_tables.py` | `014_knowledge_graph` | `20260603_050000_knowledge_graph.py` | `20260603_050000_knowledge_graph` |
| 16 | `015_enhance_tcm_dfbp_tables.py` | `015_tcm_dfbp` | `20260603_060000_enhance_tcm_dfbp.py` | `20260603_060000_enhance_tcm_dfbp` |
| 17 | `016_add_search_persistence.py` | `016_add_search_persistence` | `20260624_000000_search_persistence.py` | `20260624_000000_search_persistence` |
| 18 | `017_bigint_timezone_upgrade.py` | `017_bigint_timezone_upgrade` | `20260630_000000_bigint_timezone_upgrade.py` | `20260630_000000_bigint_timezone_upgrade` |
| 19 | `018_add_rls_policies.py` | `018_add_rls_policies` | `20260630_010000_add_rls_policies.py` | `20260630_010000_add_rls_policies` |
| 20 | `018_split_tcm_herbs_mmid.py` | `018b_split_tcm_herbs` | `20260702_000000_split_tcm_herbs_mmid.py` | `20260702_000000_split_tcm_herbs_mmid` |
| 21 | `019_add_json_gin_indexes.py` | `019_add_json_gin_indexes` | `20260630_020000_add_json_gin_indexes.py` | `20260630_020000_add_json_gin_indexes` |
| 22 | `020_add_share_fields.py` | `020_add_share_fields` | `20260702_010000_add_share_fields.py` | `20260702_010000_add_share_fields` |
| 23 | `021_add_symmap_herbs_table.py` | `021_add_symmap_herbs_table` | `20260703_000000_symmap_herbs_table.py` | `20260703_000000_symmap_herbs_table` |
| 24 | `022_fix_symmap_herbdb_id_length.py` | `022_fix_symmap_herbdb_id_length` | `20260703_010000_fix_symmap_herbdb_id.py` | `20260703_010000_fix_symmap_herbdb_id` |
| 25 | `023_increase_symmap_field_lengths.py` | `023_symmap_field_lengths` | `20260703_020000_increase_symmap_lengths.py` | `20260703_020000_increase_symmap_lengths` |
| 26 | `20260708_183155_add_extra_knowledge_and_source_to_tcm_.py` | `f21c3fe4ee7b` | `20260708_183155_add_extra_knowledge_source_tcm_herbs.py` | `20260708_183155_extra_knowledge_source` |
| 27 | `027_potion_vft_integration.py` | `027_potion_vft_integration` | `20260718_000000_potion_vft_integration.py` | `20260718_000000_potion_vft_integration` |
| 28 | `028_enable_pgvector.py` | `028_enable_pgvector` | `20260720_000000_enable_pgvector.py` | `20260720_000000_enable_pgvector` |
| 29 | `029_fix_pantry_schema.py` | `029_fix_pantry_schema` | `20260720_010000_fix_pantry_schema.py` | `20260720_010000_fix_pantry_schema` |
| 30 | `030_add_openfoodfacts_support.py` | `030_add_openfoodfacts_support` | `20260720_020000_add_openfoodfacts_support.py` | `20260720_020000_add_openfoodfacts_support` |
| 31 | `031_add_off_safety_fields.py` | `031_add_off_safety_fields` | `20260722_000000_add_off_safety_fields.py` | `20260722_000000_add_off_safety_fields` |
| 32 | `20260723_113212_add_organization_id_column_to_formulas_.py` | `fb1974aceb83` | `20260723_113212_add_organization_id_to_all.py` | `20260723_113212_add_organization_id` |

## Dependency Chain (After Renaming)

```
20260502_000000_initial                    (root, down_revision=None)
    |
    +---> 20260502_000100_account_security
    |         |
    |         +---> 20260503_000000_formula_deep_integration
    |         |             |
    |         |             +---> 20260503_000100_peptide_analysis  <-- merges both branches
    |         |                        |
    |         |                        +---> 20260504_000000_upgrade_notifications
    |         |                                |
    |         |                                +---> ... (single linear chain continues) ...
    |         |
    +---> 20260502_001000_sss_enterprise  <-- parallel branch (converges at #5 above)
              |
              +---> (same merge point at #5)

After step 5, the chain is purely linear through step 32.
```

This means `alembic heads` will show exactly ONE head after the rename (at step 32), which is the correct single-trunk state.

## Naming Convention Rule Going Forward

All new migration files MUST follow this pattern:

```
YYYYMMDD_HHMMSS_short_description.py
```

With revision ID using the same date + sequence suffix:

```
revision = 'YYYYMMDD_HHMMSS_short_description'
```

No more abbreviated shortcodes (`003_sss`), no more UUIDs from autogenerate, no more tuple down_revisions unless you intentionally maintain parallel branches.

## Risks and Notes

1. **Diamond merge at step 5**: File `004_add_peptide_analysis_design.py` has `down_revision = ('20260502_001000_sss_enterprise', '20260503_000000_formula_deep_integration')` -- a tuple pointing to two parents. This is valid Alembic for divergent-then-convergent branches. After renaming, this relationship is preserved.

2. **Gap 024-026**: No migrations are actually missing between steps 25 and 27. The date-stamped file `20260708_*` fills that logical position. The rename consolidates everything into a continuous 32-step chain.

3. **Down_revision references in files 3-5**: These three files reference each other via the old shortcodes. The bash script updates all cross-references as part of the sequential rename process. Verify after running by checking `alembic history` shows a clean linear chain.

4. **Rollback**: Since no database is accessible, test with:
   ```bash
   cd backend && alembic heads    # should show exactly 1 head
   cd backend && alembic history  # should show clean chain from base to head
   ```

## Execution

Run from repo root:
```bash
bash fix_alembic.sh
```

Then verify:
```bash
cd backend
alembic heads                  # expect 1 head
alembic history                # expect clean full chain
python -c "from alembic.script import ScriptDirectory; print('OK')"  # basic import check
```
