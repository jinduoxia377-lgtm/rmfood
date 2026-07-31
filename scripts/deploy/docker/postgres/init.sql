-- PostgreSQL 初始化脚本
-- 安装 pgvector 扩展

CREATE EXTENSION IF NOT EXISTS vector;

-- 验证扩展已安装
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_extension WHERE extname = 'vector'
    ) THEN
        RAISE EXCEPTION 'pgvector extension failed to install';
    END IF;
END
$$;
