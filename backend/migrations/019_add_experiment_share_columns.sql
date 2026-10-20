# 迁移 019：experiments 表增加分享列（share_code / share_password_hash / view_count）
-- 与 app/models/experiment.py 的 Experiment 模型对齐，支持实验公开分享。
BEGIN;

ALTER TABLE experiments ADD COLUMN IF NOT EXISTS share_code VARCHAR(64);
ALTER TABLE experiments ADD COLUMN IF NOT EXISTS share_password_hash VARCHAR(256);
ALTER TABLE experiments ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS ix_experiments_share_code ON experiments(share_code);
CREATE INDEX IF NOT EXISTS ix_experiments_view_count ON experiments(view_count);

COMMIT;
