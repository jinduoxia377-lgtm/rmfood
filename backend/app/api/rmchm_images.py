"""
RMCHM 药材图片服务
提供药材图片URL查询和文件访问API
"""
import os
import json
import re
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from typing import Optional

router = APIRouter(prefix="/rmchm", tags=["RMCHM"])

# 图片目录
IMAGE_DIRS = [
    r'D:\RMFOODFP\data\106FAM',
]

# 映射文件
MAPPING_FILE = r'D:\RMFOODFP\backend\data\rmchm_image_map.json'


def load_mapping() -> dict:
    """加载图片映射"""
    if os.path.exists(MAPPING_FILE):
        with open(MAPPING_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {}


def find_image(herb_name: str) -> Optional[str]:
    """根据药材名查找图片"""
    mapping = load_mapping()

    # 直接匹配
    if herb_name in mapping:
        return mapping[herb_name]

    # 模糊匹配
    for key, url in mapping.items():
        if herb_name in key or key in herb_name:
            return url

    # 遍历目录
    for img_dir in IMAGE_DIRS:
        if not os.path.exists(img_dir):
            continue
        for filename in os.listdir(img_dir):
            if filename.endswith('.jpg') and herb_name in filename:
                return f"/api/v1/rmchm/images/{filename}"

    return None


@router.get("/image-url/{herb_name}", summary="获取RMCHM药材图片URL")
async def get_rmchm_image_url(herb_name: str):
    """根据药材名获取图片URL"""
    url = find_image(herb_name)
    if url:
        return {"herb_name": herb_name, "image_url": url}
    return {"herb_name": herb_name, "image_url": None, "message": "未找到图片"}


@router.get("/images/{filename}", summary="获取RMCHM药材图片文件")
async def get_rmchm_image(filename: str):
    """获取药材图片文件"""
    for img_dir in IMAGE_DIRS:
        image_path = os.path.join(img_dir, filename)
        if os.path.exists(image_path):
            return FileResponse(
                image_path,
                media_type="image/jpeg",
                filename=filename
            )

    raise HTTPException(status_code=404, detail=f"图片不存在: {filename}")


@router.get("/image-map", summary="获取RMCHM药材图片映射")
async def get_rmchm_image_map():
    """获取药材图片映射表"""
    mapping = load_mapping()
    return {
        "total": len(mapping),
        "mapping": mapping
    }


@router.get("/stats", summary="RMCHM药材图片统计")
async def get_rmchm_image_stats():
    """获取药材图片统计信息"""
    total_images = 0
    for img_dir in IMAGE_DIRS:
        if os.path.exists(img_dir):
            total_images += len([f for f in os.listdir(img_dir) if f.endswith('.jpg')])

    mapping = load_mapping()
    return {
        "total_images": total_images,
        "mapping_entries": len(mapping),
        "image_dirs": IMAGE_DIRS,
        "sample_images": list(mapping.keys())[:10]
    }
