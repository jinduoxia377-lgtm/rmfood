"""
ScheduledReportService — 定时报表调度服务

使用 asyncio 实现轻量级定时任务调度（替代 APScheduler）。
支持：
- 按 cron 表达式调度报表生成
- 生成后发送至指定邮箱
- 启动时从数据库加载已配置的定时任务

用法:
    from app.core.analytics_reports.scheduled_reports import get_scheduler
    scheduler = get_scheduler()
    await scheduler.start()
"""

from __future__ import annotations

import asyncio
import logging
import smtplib
from datetime import datetime, timedelta, timezone
from email.mime.base import MIMEBase
from email.mime.text import MIMEText
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


# ── Cron 解析（简化版：支持 minute hour day month weekday） ──

class CronParser:
    """简化版 cron 表达式解析器，支持常见场景。"""

    @staticmethod
    def next_run(last_run: datetime, expr: str) -> Optional[datetime]:
        """根据 cron 表达式计算下次运行时间。"""
        parts = expr.strip().split()
        if len(parts) != 5:
            return None

        minute, hour, day, month, weekday = parts

        # 支持 */N 和固定值
        now = last_run if last_run.tzinfo else last_run.replace(tzinfo=timezone.utc)
        candidate = now + timedelta(minutes=1)

        for _ in range(525600):  # 最多遍历一年分钟数
            if (CronParser._match(candidate.minute, minute) and
                CronParser._match(candidate.hour, hour) and
                CronParser._match(candidate.day, day) and
                CronParser._match(candidate.month, month) and
                # Python weekday(): 0=Monday, 6=Sunday
                # cron weekday:   0=Sunday, 6=Saturday → convert via (wd + 1) % 7
                CronParser._match((candidate.weekday() + 1) % 7, weekday)):
                return candidate
            candidate += timedelta(minutes=1)
        return None

    @staticmethod
    def _match(value: int, pattern: str) -> bool:
        """判断值是否匹配 cron 片段。"""
        if pattern == "*":
            return True
        if pattern.startswith("*/"):
            step = int(pattern[2:])
            return value % step == 0
        # 简单支持固定值
        try:
            return value == int(pattern)
        except ValueError:
            return False


# ── 邮件发送 ──

def _send_email(
    smtp_host: str,
    smtp_port: int,
    username: str,
    password: str,
    from_addr: str,
    to_addrs: List[str],
    subject: str,
    body: str,
    attachment: Optional[MIMEBase] = None,
) -> bool:
    """发送 HTML 邮件（可选附件），失败时静默降级。"""
    from email.mime.multipart import MIMEMultipart  # noqa: PLC0415
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = from_addr
        msg["To"] = ", ".join(to_addrs)
        msg.attach(MIMEText(body, "html", "utf-8"))

        if attachment is not None:
            msg.attach(attachment)

        with smtplib.SMTP(smtp_host, smtp_port, timeout=10) as server:
            if username and password:
                server.starttls()
                server.login(username, password)
            server.sendmail(from_addr, to_addrs, msg.as_string())
        logger.info("报表邮件已发送: %s -> %s", from_addr, to_addrs)
        return True
    except Exception as e:
        logger.warning("邮件发送失败（非致命）: %s", e)
        return False


# ── 调度服务 ──

class ScheduledReportService:
    def __init__(self):
        self._jobs: Dict[str, Dict[str, Any]] = {}
        self._running = False
        self._task: Optional[asyncio.Task] = None

    async def start(self):
        """启动调度循环，并尝试从数据库加载已持久化的任务。"""
        if self._running:
            return
        self._running = True
        # 从 DB 加载已有任务
        try:
            await self.load_jobs_from_db()
            logger.info("[ScheduledReports] 已从数据库加载调度任务")
        except Exception as e:
            logger.warning("[ScheduledReports] 加载 DB 任务失败（将使用空列表）: %s", e)
        self._task = asyncio.create_task(self._tick_loop())
        logger.info("[ScheduledReports] 调度服务已启动")

    async def stop(self):
        """停止调度循环。"""
        self._running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        logger.info("[ScheduledReports] 调度服务已停止")

    def register(
        self,
        job_id: str,
        template_id: str,
        cron_expr: str,
        recipients: List[str],
        settings: Dict[str, Any],
    ):
        """注册定时任务。"""
        self._jobs[job_id] = {
            "id": job_id,
            "template_id": template_id,
            "cron": cron_expr,
            "recipients": recipients,
            "settings": settings,
            "last_run": None,
            "next_run": None,
        }
        self._jobs[job_id]["next_run"] = CronParser.next_run(datetime.now(timezone.utc), cron_expr)
        logger.info("[ScheduledReports] 注册任务: %s cron=%s", job_id, cron_expr)

    def unregister(self, job_id: str):
        self._jobs.pop(job_id, None)

    def list_jobs(self) -> List[Dict[str, Any]]:
        return list(self._jobs.values())

    async def _tick_loop(self):
        """每分钟 tick，检查并执行到期任务。"""
        while self._running:
            try:
                now = datetime.now(timezone.utc)
                for job in list(self._jobs.values()):
                    if job.get("next_run") and job["next_run"] <= now:
                        await self._run_job(job)
                        job["last_run"] = now
                        job["next_run"] = CronParser.next_run(now, job["cron"])
            except Exception as e:
                logger.warning("[ScheduledReports] tick 异常: %s", e)
            await asyncio.sleep(30)  # 每30秒检查一次

    async def sync_job_to_db(self, job: Dict[str, Any]) -> None:
        """将内存任务同步到数据库，供管理页面读取。"""
        from app.core.database.session import AsyncSessionLocal  # noqa: PLC0415
        from app.models.analytics_scheduler import upsert_job  # noqa: PLC0415

        async with AsyncSessionLocal() as db:
            await upsert_job(
                db=db,
                job_id=job["id"],
                template_id=job["template_id"],
                cron_expr=job["cron"],
                recipients=job.get("recipients", []),
                settings=job.get("settings", {}),
            )

    async def sync_job_remove_to_db(self, template_id: str) -> None:
        """从数据库删除对应任务。"""
        from app.core.database.session import AsyncSessionLocal  # noqa: PLC0415
        from app.models.analytics_scheduler import remove_job  # noqa: PLC0415

        async with AsyncSessionLocal() as db:
            await remove_job(db, template_id)

    async def load_jobs_from_db(self) -> List[Dict[str, Any]]:
        """从数据库加载所有任务，重新注册到内存。"""
        from app.core.database.session import AsyncSessionLocal  # noqa: PLC0415
        from app.models.analytics_scheduler import load_all_jobs  # noqa: PLC0415

        async with AsyncSessionLocal() as db:
            db_jobs = await load_all_jobs(db)

        loaded = []
        for db_job in db_jobs:
            if not db_job.enabled:
                continue
            job = {
                "id": f"job_{db_job.template_id}",
                "template_id": db_job.template_id,
                "cron": db_job.cron_expr,
                "recipients": db_job.recipient_list,
                "settings": db_job.settings_dict,
                "last_run": db_job.last_run,
                "next_run": db_job.next_run,
            }
            self._jobs[job["id"]] = job
            loaded.append(job)
        return loaded

    async def _run_job(self, job: Dict[str, Any]):
        """执行单个定时任务。"""
        job_id = job["id"]
        logger.info("[ScheduledReports] 执行任务: %s", job_id)
        try:
            now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
            subject = f"RMFOOD 分析报告 - {job['template_id']} ({datetime.now().strftime('%Y-%m-%d')})"
            body = f"""
            <html><body>
            <h2>RMFOOD 自动分析报告</h2>
            <p>报表模板：<code>{job['template_id']}</code></p>
            <p>生成时间：<code>{now_str}</code></p>
            <p>详见附件中的报表数据，如有疑问请联系管理员。</p>
            <p style="color:#888;font-size:12px">此邮件由系统自动生成，请勿回复。</p>
            </body></html>
            """
            cfg = job.get("settings", {})
            smtp_host = cfg.get("smtp_host", "smtp.example.com")
            smtp_port = int(cfg.get("smtp_port", 587))
            smtp_user = cfg.get("smtp_user", "")
            smtp_pass = cfg.get("smtp_pass", "")
            from_addr = cfg.get("from_email", smtp_user)

            # 尝试生成 Excel 附件
            attachment: Optional[MIMEBase] = None
            try:
                from app.core.analytics_reports.export_engine import (
                    export_to_excel,  # noqa: PLC0415
                )
                sample_data: List[Dict[str, Any]] = [
                    {"指标": "配方总数", "数值": cfg.get("formula_count", "—")},
                    {"指标": "实验总数", "数值": cfg.get("experiment_count", "—")},
                    {"指标": "用户数", "数值": cfg.get("user_count", "—")},
                    {"指标": "生成时间", "数值": now_str},
                ]
                # export_to_excel 返回 bytes，非 BytesIO
                excel_bytes = export_to_excel(
                    data=sample_data,
                    filename=f"report_{job['template_id']}_{datetime.now(timezone.utc).strftime('%Y%m%d')}.xlsx",
                    sheet_name=job["template_id"],
                )
                attachment = MIMEBase(
                    "application",
                    "vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                )
                attachment.set_payload(excel_bytes)
                attachment.add_header(
                    "Content-Disposition",
                    "attachment",
                    filename=(f"report_{job['template_id']}_"
                              f"{datetime.now(timezone.utc).strftime('%Y%m%d')}.xlsx"),
                )
                logger.info("[ScheduledReports] 报表附件已生成: %s", attachment.get_filename())
            except Exception as e:
                logger.warning("[ScheduledReports] 生成附件失败（非致命）: %s", e)

            success = _send_email(
                smtp_host, smtp_port, smtp_user, smtp_pass,
                from_addr, job["recipients"],
                subject, body,
                attachment=attachment,
            )
            if not success:
                logger.error("[ScheduledReports] 邮件发送失败: job=%s", job_id)
        except Exception as e:
            logger.error("[ScheduledReports] 执行任务失败 %s: %s", job_id, e)


# ── 模块级单例 ──
_scheduler = ScheduledReportService()


def get_scheduler() -> ScheduledReportService:
    return _scheduler
