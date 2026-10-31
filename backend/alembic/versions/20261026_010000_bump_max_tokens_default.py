"""bump default max_tokens from 4096 to 16000 on ai_model_configs and ai_bots

Revision ID: 20261026_010000_bump_max_tokens_default
Revises: 20261019_010000
Create Date: 2026-10-26 00:30:00

P1-4 修复（2026-10-26）：统一 LLM 输出上限默认值 4096 -> 16000。

背景
----
智能对话走「专业配方设计卡」JSON blocks 协议，单条回复约 7-9k token
（21 个 block）。4096 的输出上限会把 JSON 截断在中途，前端
detectStructuredContent 解析失败后整张卡片降级为裸 JSON。

三处默认值互相矛盾：
- app/models/ai_model_config.py                 server_default="4096"   （建表 / 新增行）
- app/models/bot.py                             server_default="4096"   （同上）
- app/services/ai_model_config_service.py       ModelConfig.max_tokens = 16000  （代码层）

ai_model_config_service.get_or_create 不显式传 max_tokens，完全依赖
server_default 兜底，因此新租户 / 新 model_type / 全新安装的首次种子会
静默拿到 4096。rmfood 生产库 7 行 ai_model_configs 虽已在 2026-09-21 被
手工订正为 16000，但 18 行 ai_bots 仍是 4096。

本迁移做两件事：
1. 两个表的列 DEFAULT 4096 -> 16000（否则新建行仍拿旧值）；
2. 两表现存低于 16000 的行订正为 16000（幂等：只提升、绝不降低）。

安全说明
--------
- 两条 UPDATE 均为 WHERE max_tokens < 16000，只向上提升、不降低，
  重复执行结果一致（幂等）。
- downgrade 只回滚列 DEFAULT，无法还原哪些行原本就是 4096，故不回写数据。
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '20261026_010000_bump_max_tokens_default'
down_revision: Union[str, None] = '20261019_010000'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. 列默认值：与 Model 层 / ModelConfig 代码层默认值对齐
    op.alter_column(
        "ai_model_configs", "max_tokens",
        server_default=sa.text("16000"),
    )
    op.alter_column(
        "ai_bots", "max_tokens",
        server_default=sa.text("16000"),
    )

    # 2. 现存数据订正（幂等，只提升不降低）
    conn = op.get_bind()
    conn.exec_driver_sql(
        "UPDATE ai_model_configs SET max_tokens = 16000 WHERE max_tokens < 16000"
    )
    conn.exec_driver_sql(
        "UPDATE ai_bots SET max_tokens = 16000 WHERE max_tokens < 16000"
    )


def downgrade() -> None:
    # 只回滚列 DEFAULT。无法区分哪些行原本就是 4096，故不回写数据。
    op.alter_column(
        "ai_bots", "max_tokens",
        server_default=sa.text("4096"),
    )
    op.alter_column(
        "ai_model_configs", "max_tokens",
        server_default=sa.text("4096"),
    )
