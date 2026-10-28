"""
工作流服务
管理AI配方生成、数据同步等工作流流程
"""
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import TaskStatus, Workflow, WorkflowStatus, WorkflowTask


class WorkflowService:
    """工作流管理服务"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_workflow(
        self,
        name: str,
        workflow_type: str,
        created_by: int,
        description: str = None,
        config: dict = None,
    ) -> Workflow:
        """创建工作流"""
        workflow = Workflow(
            name=name,
            workflow_type=workflow_type,
            description=description,
            config=config or {},
            created_by=created_by,
        )
        self.db.add(workflow)
        await self.db.flush()
        return workflow

    async def get_workflow(self, workflow_id: int) -> Workflow:
        """获取工作流详情"""
        result = await self.db.execute(
            select(Workflow).where(Workflow.id == workflow_id)
        )
        workflow = result.scalar_one_or_none()
        if not workflow:
            from fastapi import HTTPException
            raise HTTPException(status_code=404, detail="工作流不存在")
        return workflow

    async def add_task(
        self,
        workflow_id: int,
        step_order: int,
        name: str,
        task_type: str,
        input_data: dict = None,
    ) -> WorkflowTask:
        """添加工作流任务"""
        task = WorkflowTask(
            workflow_id=workflow_id,
            step_order=step_order,
            name=name,
            task_type=task_type,
            input_data=input_data or {},
        )
        self.db.add(task)
        await self.db.flush()
        return task

    async def update_task_status(
        self,
        task_id: int,
        status: TaskStatus,
        output_data: dict = None,
        error_message: str = None,
    ) -> WorkflowTask:
        """更新任务状态"""
        result = await self.db.execute(
            select(WorkflowTask).where(WorkflowTask.id == task_id)
        )
        task = result.scalar_one_or_none()
        if not task:
            from fastapi import HTTPException
            raise HTTPException(status_code=404, detail="任务不存在")

        task.status = status
        if output_data:
            task.output_data = output_data
        if error_message:
            task.error_message = error_message

        await self.db.flush()
        return task

    async def list_workflows(
        self,
        workflow_type: str = None,
        status: WorkflowStatus = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[Workflow], int]:
        """获取工作流列表"""
        query = select(Workflow)

        if workflow_type:
            query = query.where(Workflow.workflow_type == workflow_type)
        if status:
            query = query.where(Workflow.status == status)

        # 计算总数
        from sqlalchemy import func
        count_query = select(func.count()).select_from(query.subquery())
        total = (await self.db.execute(count_query)).scalar() or 0

        # 分页
        query = query.order_by(Workflow.created_at.desc())
        query = query.offset((page - 1) * page_size).limit(page_size)

        result = await self.db.execute(query)
        workflows = list(result.scalars().all())

        return workflows, total
