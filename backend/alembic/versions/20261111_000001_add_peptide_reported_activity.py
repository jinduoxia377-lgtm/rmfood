"""add reported_activity to bioactive_peptides (文献报告活性：装"全部活性+强度"，带 pmid+span 留痕)

Revision ID: 20261111_000001
Revises: 20261109_000003
Create Date: 2026-11-11

背景（肽机理转 reported_activity）:
    线2 肽机理 dry-run 发现机理覆盖仅 ~2%——文献通常只报告「活性」（如 ACE 抑制
    IC50=X µM）而不报告完整「机理」。lead 裁决：不硬抽机理，转存「文献报告活性
    reported_activity」——一个可空 TEXT 列，装某肽在文献中被报告的**全部活性 + 强度**
    （如 IC50/EC50/抑制率），每条带 **pmid + 原文 span** 留痕，绝不伪造（宁少勿滥）。

    与 activity_value（单值，character varying(200)）的区别：reported_activity 装
    「一段自然语言/结构化的全部活性+强度+pmid 留痕」，是 activity_value 的超集补充，
    面向机理/活性溯源展示。

幂等性（ADR-007）:
    - 列：information_schema.columns 判定，已存在则跳过 ADD COLUMN。
      （注：本地库此前已被裸 ALTER 加过该列，迁移会跳过 ADD 但仍登记版本号，
      使本地回到迁移链一致状态；生产无此列，迁移会正常新增。）

可回滚:
    downgrade DROP COLUMN reported_activity（新增列，删除不损原数据）。

锁表风险:
    ADD COLUMN 为事务性 DDL，只加列不改既有列，不影响运行中后端现有查询。
"""
import sqlalchemy as sa

from alembic import op

revision = "20261111_000001"
down_revision = "20261109_000003"
branch_labels = None
depends_on = None


def _has_column(bind, table, column) -> bool:
    insp = sa.inspect(bind)
    return column in [c["name"] for c in insp.get_columns(table)]


def upgrade() -> None:
    bind = op.get_bind()
    comment = (
        "文献报告活性：该肽在文献中被报告的全部活性+强度（IC50/EC50/抑制率等），"
        "每条带 pmid+原文 span 留痕，宁少勿滥绝不伪造"
    )
    if not _has_column(bind, "bioactive_peptides", "reported_activity"):
        op.add_column(
            "bioactive_peptides",
            sa.Column(
                "reported_activity",
                sa.Text(),
                nullable=True,
                comment=comment,
            ),
        )
    else:
        # 本地库此前被裸 ALTER 加过该列（无注释）。补挂注释使其与迁移链定义一致；
        # 生产无此列走 add_column 分支自带注释，不受影响。
        op.execute(
            "COMMENT ON COLUMN bioactive_peptides.reported_activity IS %s"
            % sa.literal(comment).compile(compile_kwargs={"literal_binds": True})
        )


def downgrade() -> None:
    op.drop_column("bioactive_peptides", "reported_activity")
