"""文件生成服务API接口"""
import logging
from fastapi import APIRouter, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel
from typing import Optional, Dict, Any
import os
import urllib.parse

from ..services.file_generator import file_generator_service, FileFormat
from ..services.template_manager import get_template_manager
from ..core.encoding import sanitize_filename

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/file-generator", tags=["file-generator"])


class FileGenerationRequest(BaseModel):
    content: Dict[str, Any]
    format: FileFormat
    filename: str
    template: Optional[str] = "default"


class MarkdownConversionRequest(BaseModel):
    markdown: str
    template: Optional[str] = "default"


class TemplateGenerationRequest(BaseModel):
    template: str
    data: Dict[str, Any]
    format: FileFormat
    filename: str


@router.post("/generate")
def generate_file(request: FileGenerationRequest):
    """生成文件（同步）"""
    try:
        template_manager = get_template_manager(file_generator_service)
        
        # 根据模板生成内容
        if request.template and request.template != "default":
            file_path, file_name = template_manager.generate_from_template(
                request.template,
                request.content,
                request.format,
                request.filename
            )
        else:
            file_path, file_name = file_generator_service.generate_file(
                request.content,
                request.format,
                request.filename
            )
        
        return {"file_path": file_path, "file_name": file_name}
    except Exception as e:
        logger.error("文件生成失败: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail="文件生成失败，请稍后重试")


@router.post("/generate-async")
async def generate_file_async(request: FileGenerationRequest):
    """生成文件（异步）"""
    try:
        template_manager = get_template_manager(file_generator_service)
        
        # 根据模板生成内容
        if request.template and request.template != "default":
            # 转换内容为适合模板的格式
            content = request.content
            task_id = await file_generator_service.generate_file_async(
                content,
                request.format,
                request.filename
            )
        else:
            task_id = await file_generator_service.generate_file_async(
                request.content,
                request.format,
                request.filename
            )
        
        return {"task_id": task_id}
    except Exception as e:
        logger.error("文件生成失败: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail="文件生成失败，请稍后重试")


@router.get("/task/{task_id}")
def get_task_status(task_id: str):
    """获取任务状态"""
    try:
        task = file_generator_service.get_task_status(task_id)
        if not task:
            raise HTTPException(status_code=404, detail="任务不存在")
        
        return task.__dict__
    except HTTPException:
        raise
    except Exception as e:
        logger.error("文件生成失败: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail="文件生成失败，请稍后重试")


@router.get("/download/{task_id}")
def download_file(task_id: str):
    """下载文件"""
    try:
        file_path = file_generator_service.get_file_path(task_id)
        if not file_path:
            raise HTTPException(status_code=404, detail="文件不存在或任务未完成")
        
        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="文件不存在")
        
        task = file_generator_service.get_task_status(task_id)
        filename = task.file_name if task else os.path.basename(file_path)
        
        # 规范化文件名并使用 RFC 5987 编码
        safe_filename = sanitize_filename(filename)
        encoded_filename = urllib.parse.quote(safe_filename, safe='')
        
        # 构建 Content-Disposition 头
        # 格式: attachment; filename="safe_name"; filename*=UTF-8''encoded_name
        content_disposition = f'attachment; filename="{safe_filename}"; filename*=UTF-8\'\'{encoded_filename}'
        
        return FileResponse(
            path=file_path,
            filename=safe_filename,
            media_type="application/octet-stream",
            headers={"Content-Disposition": content_disposition}
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error("文件生成失败: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail="文件生成失败，请稍后重试")


@router.post("/convert-markdown")
def convert_markdown(request: MarkdownConversionRequest):
    """转换Markdown"""
    try:
        template_manager = get_template_manager(file_generator_service)
        content = template_manager.convert_markdown_to_content(
            request.markdown,
            request.template
        )
        return content
    except Exception as e:
        logger.error("文件生成失败: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail="文件生成失败，请稍后重试")


@router.get("/templates")
def get_templates():
    """获取可用模板列表"""
    try:
        template_manager = get_template_manager(file_generator_service)
        templates = []
        for name, template in template_manager.templates.items():
            templates.append({
                "name": name,
                "description": template.get("name", name)
            })
        return {"templates": templates}
    except Exception as e:
        logger.error("文件生成失败: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail="文件生成失败，请稍后重试")


@router.post("/generate-from-template")
def generate_from_template(request: TemplateGenerationRequest):
    """从模板生成文件"""
    try:
        template_manager = get_template_manager(file_generator_service)
        file_path, file_name = template_manager.generate_from_template(
            request.template,
            request.data,
            request.format,
            request.filename
        )
        return {"file_path": file_path, "file_name": file_name}
    except Exception as e:
        logger.error("文件生成失败: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail="文件生成失败，请稍后重试")
