"""
中药材图片映射服务
提供药材图片URL查询API
"""
import os
import json
import re
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from typing import Optional

router = APIRouter(prefix="/herbs", tags=["中药材"])

# 图片目录
HERB_IMAGE_DIR = r"D:\RMFOODFP\data\（高清版）106种药食同源带介绍"
MAPPING_FILE = r"D:\RMFOODFP\backend\data\herb_image_map.json"


def load_herb_mapping() -> dict:
    """加载药材图片映射"""
    if os.path.exists(MAPPING_FILE):
        with open(MAPPING_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {}


def build_herb_mapping() -> dict:
    """构建药材图片映射"""
    herb_map = {}

    if not os.path.exists(HERB_IMAGE_DIR):
        return herb_map

    for filename in os.listdir(HERB_IMAGE_DIR):
        if not filename.endswith('.jpg'):
            continue

        name = filename.replace('.jpg', '')
        url = f"/api/v1/herbs/images/{filename}"

        # 原始名称
        herb_map[name] = url

        # 标准化名称（去除括号内容）
        base = re.sub(r'[（\(].*?[）\)]', '', name).strip()
        herb_map[base] = url

        # 去除常见后缀
        for suffix in ['的', '子', '叶', '花', '根', '茎', '皮', '仁', '实', '霜', '粉', '片']:
            if base.endswith(suffix):
                herb_map[base[:-1]] = url

    # 保存映射
    os.makedirs(os.path.dirname(MAPPING_FILE), exist_ok=True)
    with open(MAPPING_FILE, 'w', encoding='utf-8') as f:
        json.dump(herb_map, f, ensure_ascii=False, indent=2)

    return herb_map


# 全局映射（懒加载）
_herb_mapping: Optional[dict] = None


def get_herb_mapping() -> dict:
    global _herb_mapping
    if _herb_mapping is None:
        _herb_mapping = build_herb_mapping()
    return _herb_mapping


@router.get("/image-map", summary="获取药材图片映射")
async def get_herb_image_map():
    """获取药材图片映射表"""
    mapping = get_herb_mapping()
    return {
        "total": len([k for k in mapping.keys() if k.startswith('src:') or not k.startswith('_')]),
        "mapping": {k: v for k, v in mapping.items() if not k.startswith('_')}
    }


@router.get("/image/{filename}", summary="获取药材图片")
async def get_herb_image(filename: str):
    """获取药材图片文件"""
    image_path = os.path.join(HERB_IMAGE_DIR, filename)

    if not os.path.exists(image_path):
        raise HTTPException(status_code=404, detail=f"图片不存在: {filename}")

    return FileResponse(
        image_path,
        media_type="image/jpeg",
        filename=filename
    )


@router.get("/image-url/{herb_name}", summary="获取药材图片URL")
async def get_herb_image_url(herb_name: str):
    """根据药材名获取图片URL"""
    mapping = get_herb_mapping()

    # 直接匹配
    if herb_name in mapping:
        return {"herb_name": herb_name, "image_url": mapping[herb_name]}

    # 模糊匹配
    for key, url in mapping.items():
        if herb_name in key or key in herb_name:
            return {"herb_name": herb_name, "image_url": url, "matched_key": key}

    return {"herb_name": herb_name, "image_url": None, "message": "未找到图片"}


@router.get("/stats", summary="药材图片统计")
async def get_herb_image_stats():
    """获取药材图片统计信息"""
    if not os.path.exists(HERB_IMAGE_DIR):
        return {"total_images": 0, "image_dir": HERB_IMAGE_DIR, "exists": False}

    images = [f for f in os.listdir(HERB_IMAGE_DIR) if f.endswith('.jpg')]
    mapping = get_herb_mapping()

    return {
        "total_images": len(images),
        "mapping_entries": len([k for k in mapping.keys() if not k.startswith('_')]),
        "image_dir": HERB_IMAGE_DIR,
        "exists": True,
        "sample_images": images[:10]
    }
