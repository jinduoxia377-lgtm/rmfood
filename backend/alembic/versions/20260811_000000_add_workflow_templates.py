"""add workflow_templates table for database-driven workflow templates

Revision ID: 20260811_000000_add_workflow_templates
Revises: 20260726_000000_add_import_tables
Create Date: 2026-08-11 00:00:00.000000

工作流模板表——替代前端硬编码模板，驱动可视化编辑器。
同时插入默认 AI 配方生成相关模板。
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import json as _json


# revision identifiers, used by Alembic.
revision: str = '20260811_000000_add_workflow_templates'
down_revision: Union[str, None] = '20260726_000000_add_import_tables'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# 预置模板数据（Python dict，迁移时序列化为 JSON）
_DEFAULT_TEMPLATES: list[dict] = [
    {
        "template_id": "ai-formula-gen",
        "name": "AI 配方生成流水线",
        "description": "从需求分析到配方生成的完整 AI 驱动流程",
        "category": "ai_generation",
        "icon": "🤖",
        "node_count": 10,
        "estimated_duration": "5-15 分钟",
        "node_definitions": [
            {"id": "start", "type": "start", "position": {"x": 400, "y": 0}, "data": {"label": "开始"}},
            {"id": "input", "type": "task", "position": {"x": 350, "y": 100}, "data": {"label": "需求输入", "taskType": "user_input"}},
            {"id": "analyze", "type": "task", "position": {"x": 350, "y": 200}, "data": {"label": "需求分析", "taskType": "agent_smart"}},
            {"id": "generate", "type": "task", "position": {"x": 350, "y": 300}, "data": {"label": "AI 生成候选", "taskType": "formula_gpt"}},
            {"id": "optimize", "type": "task", "position": {"x": 350, "y": 400}, "data": {"label": "多目标优化", "taskType": "llm"}},
            {"id": "safety", "type": "task", "position": {"x": 350, "y": 500}, "data": {"label": "安全性检查", "taskType": "safety_check"}},
            {"id": "condition", "type": "condition", "position": {"x": 350, "y": 600}, "data": {"label": "通过?"}},
            {"id": "output", "type": "task", "position": {"x": 200, "y": 720}, "data": {"label": "输出结果", "taskType": "llm"}},
            {"id": "regenerate", "type": "task", "position": {"x": 500, "y": 720}, "data": {"label": "重新生成", "taskType": "agent_smart"}},
            {"id": "end", "type": "end", "position": {"x": 400, "y": 840}, "data": {"label": "结束"}},
        ],
        "edge_definitions": [
            {"id": "e1", "source": "start", "target": "input"},
            {"id": "e2", "source": "input", "target": "analyze"},
            {"id": "e3", "source": "analyze", "target": "generate"},
            {"id": "e4", "source": "generate", "target": "optimize"},
            {"id": "e5", "source": "optimize", "target": "safety"},
            {"id": "e6", "source": "safety", "target": "condition"},
            {"id": "e7", "source": "condition", "target": "output", "label": "是"},
            {"id": "e8", "source": "condition", "target": "regenerate", "label": "否"},
            {"id": "e9", "source": "output", "target": "end"},
            {"id": "e10", "source": "regenerate", "target": "generate"},
        ],
        "preset_config": {"max_steps": 8, "temperature": 0.3},
    },
    {
        "template_id": "review-process",
        "name": "配方审核流程",
        "description": "标准化的配方审核与批准流程",
        "category": "review",
        "icon": "✅",
        "node_count": 8,
        "estimated_duration": "1-3 天",
        "node_definitions": [
            {"id": "start", "type": "start", "position": {"x": 400, "y": 0}, "data": {"label": "提交"}},
            {"id": "pre-check", "type": "task", "position": {"x": 350, "y": 120}, "data": {"label": "格式预检", "taskType": "agent_fast"}},
            {"id": "expert-review", "type": "task", "position": {"x": 350, "y": 240}, "data": {"label": "专家审核", "taskType": "llm"}},
            {"id": "decision", "type": "condition", "position": {"x": 350, "y": 360}, "data": {"label": "审核结果"}},
            {"id": "approve", "type": "task", "position": {"x": 200, "y": 480}, "data": {"label": "批准发布", "taskType": "llm"}},
            {"id": "revise", "type": "task", "position": {"x": 500, "y": 480}, "data": {"label": "退回修改", "taskType": "llm"}},
            {"id": "notify", "type": "task", "position": {"x": 350, "y": 600}, "data": {"label": "通知相关人员", "taskType": "llm"}},
            {"id": "end", "type": "end", "position": {"x": 400, "y": 720}, "data": {"label": "完成"}},
        ],
        "edge_definitions": [
            {"id": "r1", "source": "start", "target": "pre-check"},
            {"id": "r2", "source": "pre-check", "target": "expert-review"},
            {"id": "r3", "source": "expert-review", "target": "decision"},
            {"id": "r4", "source": "decision", "target": "approve", "label": "通过"},
            {"id": "r5", "source": "decision", "target": "revise", "label": "退回"},
            {"id": "r6", "source": "approve", "target": "notify"},
            {"id": "r7", "source": "revise", "target": "notify"},
            {"id": "r8", "source": "notify", "target": "end"},
        ],
        "preset_config": {"notify_roles": ["admin", "researcher"]},
    },
    {
        "template_id": "data-sync",
        "name": "数据同步流水线",
        "description": "外部数据库同步与知识图谱更新",
        "category": "data_sync",
        "icon": "🔄",
        "node_count": 7,
        "estimated_duration": "30-60 分钟",
        "node_definitions": [
            {"id": "start", "type": "start", "position": {"x": 400, "y": 0}, "data": {"label": "触发"}},
            {"id": "fetch-tcmsp", "type": "task", "position": {"x": 250, "y": 120}, "data": {"label": "TCMSP同步", "taskType": "agent_fast"}},
            {"id": "fetch-dfbp", "type": "task", "position": {"x": 550, "y": 120}, "data": {"label": "DFBP同步", "taskType": "agent_fast"}},
            {"id": "merge", "type": "task", "position": {"x": 400, "y": 240}, "data": {"label": "数据合并去重", "taskType": "llm"}},
            {"id": "validate", "type": "task", "position": {"x": 400, "y": 360}, "data": {"label": "质量验证", "taskType": "safety_check"}},
            {"id": "update-graph", "type": "task", "position": {"x": 400, "y": 480}, "data": {"label": "更新知识图谱", "taskType": "llm"}},
            {"id": "end", "type": "end", "position": {"x": 400, "y": 600}, "data": {"label": "完成"}},
        ],
        "edge_definitions": [
            {"id": "d1", "source": "start", "target": "fetch-tcmsp"},
            {"id": "d2", "source": "start", "target": "fetch-dfbp"},
            {"id": "d3", "source": "fetch-tcmsp", "target": "merge"},
            {"id": "d4", "source": "fetch-dfbp", "target": "merge"},
            {"id": "d5", "source": "merge", "target": "validate"},
            {"id": "d6", "source": "validate", "target": "update-graph"},
            {"id": "d7", "source": "update-graph", "target": "end"},
        ],
        "preset_config": {"sources": ["TCMSP", "DFBP"], "max_retries": 3},
    },
    {
        "template_id": "batch-analysis",
        "name": "批量分析流程",
        "description": "批量配方的安全性、稳定性、协同效应分析流水线",
        "category": "analysis",
        "icon": "📊",
        "node_count": 9,
        "estimated_duration": "10-30 分钟",
        "node_definitions": [
            {"id": "start", "type": "start", "position": {"x": 400, "y": 0}, "data": {"label": "开始"}},
            {"id": "input", "type": "task", "position": {"x": 400, "y": 100}, "data": {"label": "批量输入", "taskType": "user_input"}},
            {"id": "safety", "type": "task", "position": {"x": 250, "y": 220}, "data": {"label": "安全性检查", "taskType": "safety_check"}},
            {"id": "stability", "type": "task", "position": {"x": 550, "y": 220}, "data": {"label": "稳定性预测", "taskType": "llm"}},
            {"id": "synergy", "type": "task", "position": {"x": 400, "y": 340}, "data": {"label": "协同效应分析", "taskType": "synergy_analysis"}},
            {"id": "aggregate", "type": "task", "position": {"x": 400, "y": 460}, "data": {"label": "结果聚合", "taskType": "llm"}},
            {"id": "report", "type": "task", "position": {"x": 400, "y": 580}, "data": {"label": "生成报告", "taskType": "llm"}},
            {"id": "output", "type": "task", "position": {"x": 400, "y": 700}, "data": {"label": "输出结果", "taskType": "llm"}},
            {"id": "end", "type": "end", "position": {"x": 400, "y": 820}, "data": {"label": "结束"}},
        ],
        "edge_definitions": [
            {"id": "b1", "source": "start", "target": "input"},
            {"id": "b2", "source": "input", "target": "safety"},
            {"id": "b3", "source": "input", "target": "stability"},
            {"id": "b4", "source": "safety", "target": "synergy"},
            {"id": "b5", "source": "stability", "target": "synergy"},
            {"id": "b6", "source": "synergy", "target": "aggregate"},
            {"id": "b7", "source": "aggregate", "target": "report"},
            {"id": "b8", "source": "report", "target": "output"},
            {"id": "b9", "source": "output", "target": "end"},
        ],
        "preset_config": {"parallel_stages": ["safety", "stability"]},
    },
]


def upgrade() -> None:
    """创建工作流模板表并插入默认模板"""
    op.create_table(
        'workflow_templates',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('template_id', sa.String(100), nullable=False,
                  comment='模板ID，如 ai-formula-gen'),
        sa.Column('name', sa.String(200), nullable=False,
                  comment='模板名称'),
        sa.Column('description', sa.Text(), nullable=True,
                  comment='模板描述'),
        sa.Column('category', sa.String(50), nullable=False,
                  comment='分类: ai_generation|review|data_sync|analysis|custom'),
        sa.Column('icon', sa.String(20), nullable=True,
                  comment='图标 Emoji'),
        sa.Column('node_definitions', sa.JSON(), nullable=True,
                  comment='节点定义列表'),
        sa.Column('edge_definitions', sa.JSON(), nullable=True,
                  comment='边定义列表'),
        sa.Column('preset_config', sa.JSON(), nullable=True,
                  comment='预设配置参数'),
        sa.Column('is_active', sa.Integer(), nullable=False, server_default='1',
                  comment='是否启用'),
        sa.Column('node_count', sa.Integer(), nullable=True,
                  comment='节点总数'),
        sa.Column('estimated_duration', sa.String(100), nullable=True,
                  comment='预估执行时长'),
        sa.Column('created_at', sa.DateTime(timezone=True),
                  server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True),
                  server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('template_id'),
    )

    # 索引
    op.create_index('ix_workflow_templates_template_id', 'workflow_templates', ['template_id'])
    op.create_index('ix_workflow_templates_category', 'workflow_templates', ['category'])
    op.create_index('ix_workflow_templates_is_active', 'workflow_templates', ['is_active'])

    # 插入默认模板（使用 Python json 模块确保序列化正确）
    conn = op.get_bind()
    for tpl in _DEFAULT_TEMPLATES:
        conn.execute(
            sa.text("""
                INSERT INTO workflow_templates
                    (template_id, name, description, category, icon,
                     node_definitions, edge_definitions, preset_config,
                     is_active, node_count, estimated_duration)
                VALUES
                    (:template_id, :name, :description, :category, :icon,
                     :node_definitions, :edge_definitions, :preset_config,
                     :is_active, :node_count, :estimated_duration)
            """),
            {
                "template_id": tpl["template_id"],
                "name": tpl["name"],
                "description": tpl["description"],
                "category": tpl["category"],
                "icon": tpl["icon"],
                "node_definitions": _json.dumps(tpl["node_definitions"], ensure_ascii=False),
                "edge_definitions": _json.dumps(tpl["edge_definitions"], ensure_ascii=False),
                "preset_config": _json.dumps(tpl["preset_config"], ensure_ascii=False),
                "is_active": 1,
                "node_count": tpl["node_count"],
                "estimated_duration": tpl["estimated_duration"],
            }
        )


def downgrade() -> None:
    """删除工作流模板表"""
    op.drop_index('ix_workflow_templates_is_active', table_name='workflow_templates')
    op.drop_index('ix_workflow_templates_category', table_name='workflow_templates')
    op.drop_index('ix_workflow_templates_template_id', table_name='workflow_templates')
    op.drop_table('workflow_templates')
