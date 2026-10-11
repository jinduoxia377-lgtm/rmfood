# 迁移 018：统一 attachments 表与 Attachment 模型（system.py）的列定义
# 背景：attachments 表实际列 (filename/original_name/related_type/related_id)
# 与模型 Attachment (file_name/original_file_name/formula_id/experiment_id) 不一致，
# 导致 /attachments 查询报 UndefinedColumn → 503。
# 表当前 0 行数据，安全迁移：重命名旧列 + 新增模型所需列。
BEGIN;

ALTER TABLE attachments RENAME COLUMN filename TO file_name;
ALTER TABLE attachments RENAME COLUMN original_name TO original_file_name;

ALTER TABLE attachments ADD COLUMN IF NOT EXISTS formula_id BIGINT REFERENCES formulas(id) ON DELETE SET NULL;
ALTER TABLE attachments ADD COLUMN IF NOT EXISTS experiment_id BIGINT REFERENCES experiments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS ix_attachments_formula_id ON attachments(formula_id);
CREATE INDEX IF NOT EXISTS ix_attachments_experiment_id ON attachments(experiment_id);
CREATE INDEX IF NOT EXISTS ix_attachments_uploaded_by ON attachments(uploaded_by);

COMMIT;
