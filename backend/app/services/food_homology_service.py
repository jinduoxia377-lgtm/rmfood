"""
药食同源合规检查服务
从数据库读取官方106种目录，支持实时查询和搜索
"""
import logging
from typing import Dict, List, Optional

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


class FoodHomologyService:
    """药食同源目录服务"""
    
    async def get_materials(self, db: AsyncSession, name: Optional[str] = None) -> Dict:
        """
        获取药食同源目录
        
        Args:
            db: 数据库会话
            name: 按名称搜索（可选）
        
        Returns:
            包含目录信息的字典
        """
        # 构建查询
        query = """
            SELECT name_cn, COALESCE(name_en, name_cn) as name_en, 
                   COALESCE(latin_name, '') as latin_name,
                   COALESCE(category, '') as category,
                   COALESCE(approval_date::text, '') as approval_date,
                   COALESCE(status, '') as status,
                   COALESCE(restrictions::text, '[]') as restrictions,
                   COALESCE(usage_forms::text, '[]') as usage_forms,
                   COALESCE(max_dosage, '') as max_dosage
            FROM herb_food_herbs
        """
        params = {}
        
        if name:
            query += " WHERE name_cn LIKE :name"
            params["name"] = f"%{name}%"
        
        query += " ORDER BY name_cn"
        
        result = await db.execute(text(query), params)
        rows = result.fetchall()
        
        materials = []
        for row in rows:
            name_cn = row[0]
            name_en = row[1]
            latin_name = row[2]
            category = row[3]
            approval_date = row[4]
            status = row[5]
            
            # 解析JSON数组
            try:
                import json
                restrictions = json.loads(row[6]) if row[6] and row[6] != '[]' else []
            except:
                restrictions = []
            
            try:
                usage_forms = json.loads(row[7]) if row[7] and row[7] != '[]' else []
            except:
                usage_forms = []
            
            materials.append({
                "name": name_cn,
                "name_cn": name_cn,
                "name_en": name_en,
                "latin_name": latin_name,
                "category": category,
                "approval_date": approval_date,
                "status": status,
                "restrictions": restrictions,
                "usage_forms": usage_forms,
                "max_dosage": row[8],
            })
        
        return {
            "source": "国家卫健委药食同源目录公告（2025版）",
            "count": len(materials),
            "materials": materials,
        }
    
    async def get_herb_detail(self, db: AsyncSession, name: str) -> Optional[Dict]:
        """
        获取单个药材的详细信息
        
        Args:
            db: 数据库会话
            name: 药材名称
        
        Returns:
            药材详细信息或None
        """
        result = await db.execute(
            text("""
                SELECT name_cn, COALESCE(name_en, name_cn), 
                       COALESCE(latin_name, ''), COALESCE(category, ''),
                       COALESCE(max_dosage, ''), COALESCE(status, '')
                FROM herb_food_herbs 
                WHERE name_cn = :name
            """),
            {"name": name}
        )
        row = result.fetchone()
        
        if not row:
            return None
        
        return {
            "name": row[0],
            "name_cn": row[0],
            "name_en": row[1],
            "latin_name": row[2],
            "category": row[3],
            "max_dosage": row[4],
            "status": row[5],
        }


def get_food_homology_service() -> FoodHomologyService:
    """获取药食同源服务实例"""
    return FoodHomologyService()
