"""
肽链结构分析路由
基于 PepLink 的肽序列↔SMILES 双向转换
集成活性预测和安全性评估
"""

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any, Literal
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/peptide-structure", tags=["肽链结构分析"])


# Schema 定义
class SequenceToSmilesRequest(BaseModel):
    sequence: str = Field(..., min_length=2, max_length=100)
    n_terminal: Optional[str] = None
    c_terminal: Optional[str] = None
    unusual_aaminos: Optional[List[Dict]] = None
    intrachain_bonds: Optional[List[Dict]] = None
    output_format: Literal["smiles", "selfies"] = "smiles"


class SmilesToSequenceRequest(BaseModel):
    smiles: str = Field(...)
    format_type: Literal["smiles", "selfies"] = "smiles"


class RegisterAARequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=50)
    smiles: str = Field(...)


class PeptideAnalysisRequest(BaseModel):
    sequence: str = Field(..., min_length=2, max_length=100)
    n_terminal: Optional[str] = None
    c_terminal: Optional[str] = None
    unusual_aaminos: Optional[List[Dict]] = None


class BatchAnalysisRequest(BaseModel):
    sequences: List[str] = Field(..., min_items=1, max_items=50)
    max_concurrent: int = Field(10, ge=1, le=20)


# 全局单例
_converter_instance = None
_analyzer_instance = None


def get_converter():
    global _converter_instance
    if _converter_instance is None:
        try:
            from app.services.peptide_analyzer.converter import PeptideConverter
            _converter_instance = PeptideConverter()
        except ImportError as e:
            logger.error(f"PepLink导入失败: {e}")
            raise HTTPException(status_code=503, detail="PepLink未安装")
    return _converter_instance


def get_analyzer():
    global _analyzer_instance
    if _analyzer_instance is None:
        from app.services.peptide_analyzer.food_peptide_service import FoodPeptideAnalyzer
        _analyzer_instance = FoodPeptideAnalyzer()
    return _analyzer_instance


# 健康检查
@router.get("/health")
async def health_check():
    deps_status = {"peplink": False, "rdkit": False}
    try:
        import PepLink
        deps_status["peplink"] = True
    except ImportError:
        pass
    try:
        import rdkit
        deps_status["rdkit"] = True
    except ImportError:
        pass
    status = "healthy" if all(deps_status.values()) else "degraded"
    return {"status": status, "service": "rmfoodfp-peptide-analyzer", "version": "1.0.0", "dependencies": deps_status}


# 序列转换API
@router.post("/sequence-to-smiles", summary="序列转SMILES")
async def sequence_to_smiles(req: SequenceToSmilesRequest):
    try:
        converter = get_converter()
        result = converter.sequence_to_smiles(
            sequence=req.sequence,
            n_terminal=req.n_terminal,
            c_terminal=req.c_terminal,
            unusual_aaminos=req.unusual_aaminos,
            intrachain_bonds=req.intrachain_bonds,
            output_format=req.output_format,
        )
        if not result.success:
            raise HTTPException(status_code=400, detail=result.error_message)
        return {"success": True, "sequence": result.sequence, "smiles": result.smiles, "selfies": result.selfies}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"序列转换失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/smiles-to-sequence", summary="SMILES转序列")
async def smiles_to_sequence(req: SmilesToSequenceRequest):
    try:
        converter = get_converter()
        result = converter.smiles_to_sequence(req.smiles, req.format_type)
        if not result.success:
            raise HTTPException(status_code=400, detail=result.unsupported_reason or "解析失败")
        return {"success": True, "sequence": result.sequence, "is_cyclic": result.is_cyclic, "cyclization": result.cyclization}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"SMILES解析失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/register-custom-aa", summary="注册自定义氨基酸")
async def register_custom_aa(req: RegisterAARequest):
    try:
        converter = get_converter()
        success = converter.register_custom_aa(req.name, req.smiles)
        if not success:
            raise HTTPException(status_code=400, detail="注册失败")
        return {"success": True, "message": f"已注册 {req.name}"}
    except Exception as e:
        logger.error(f"注册失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/supported-aas", summary="获取支持的非天然氨基酸")
async def list_supported_aas():
    try:
        converter = get_converter()
        supported = converter.list_supported_aas()
        return {"count": len(supported), "amino_acids": supported}
    except Exception as e:
        logger.error(f"获取列表失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# 分析API
@router.post("/analyze", summary="食品肽完整分析")
async def analyze_peptide(req: PeptideAnalysisRequest):
    try:
        analyzer = get_analyzer()
        result = await analyzer.analyze(
            sequence=req.sequence,
            n_terminal=req.n_terminal,
            c_terminal=req.c_terminal,
            unusual_aaminos=req.unusual_aaminos,
        )
        return result.to_dict()
    except Exception as e:
        logger.error(f"分析失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/batch-analyze", summary="批量肽分析")
async def batch_analyze(req: BatchAnalysisRequest):
    try:
        analyzer = get_analyzer()
        results = await analyzer.batch_analyze(sequences=req.sequences, max_concurrent=req.max_concurrent)
        return {"success": True, "count": len(results), "results": [r.to_dict() for r in results]}
    except Exception as e:
        logger.error(f"批量分析失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# 高级功能API
@router.post("/hydrolysis/simulate", summary="水解模拟")
async def simulate_hydrolysis(sequence: str, enzymes: str = "Pepsin,Trypsin"):
    try:
        enzyme_list = [e.strip() for e in enzymes.split(",")]
        from app.services.peptide_analyzer.advanced_analysis import HydrolysisSimulator
        simulator = HydrolysisSimulator()
        return simulator.simulate(sequence, enzyme_list)
    except Exception as e:
        logger.error(f"水解模拟失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/evolution/align", summary="序列比对")
async def align_sequences(sequences: str, matrix: str = "BLOSUM62"):
    try:
        seq_list = [s.strip() for s in sequences.split(",")]
        from app.services.peptide_analyzer.advanced_analysis import EvolutionAnalyzer
        analyzer = EvolutionAnalyzer()
        return analyzer.align(seq_list, matrix)
    except Exception as e:
        logger.error(f"序列比对失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/quantitative/predict", summary="定量预测")
async def quantitative_predict(sequence: str, model: str = "QSAR"):
    try:
        from app.services.peptide_analyzer.advanced_analysis import QuantitativePredictor
        predictor = QuantitativePredictor()
        return await predictor.predict(sequence, model)
    except Exception as e:
        logger.error(f"定量预测失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# 数据库API
@router.get("/database/search", summary="搜索食品肽数据库")
async def search_database(
    sequence: str = Query("", description="搜索序列"),
    activity_type: str = Query(None, description="活性类型"),
    min_value: float = Query(None, description="最小活性值"),
    max_value: float = Query(None, description="最大活性值"),
    food_source: str = Query(None, description="食物来源"),
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量"),
):
    try:
        from app.services.peptide_analyzer.food_database import get_food_peptide_database
        db = get_food_peptide_database()
        # 记录接收到的参数
        logger.info(f"数据库搜索请求: sequence={sequence!r}, activity_type={activity_type!r}")
        results = await db.search(
            sequence=sequence or None,
            activity_type=activity_type,
            min_value=min_value,
            max_value=max_value,
            food_source=food_source,
        )
        logger.info(f"搜索结果: {len(results)} 条")
        # 分页
        total = len(results)
        start = (page - 1) * page_size
        end = start + page_size
        paginated = results[start:end]
        return {
            "success": True,
            "total": total,
            "page": page,
            "page_size": page_size,
            "peptides": [p.to_dict() for p in paginated],
        }
    except Exception as e:
        logger.error(f"数据库搜索失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/database/statistics", summary="数据库统计")
async def get_database_statistics():
    try:
        from app.services.peptide_analyzer.food_database import get_food_peptide_database
        db = get_food_peptide_database()
        stats = db.get_statistics()
        return {"success": True, "statistics": stats}
    except Exception as e:
        logger.error(f"获取统计失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/model-status", summary="模型状态")
async def get_model_status():
    try:
        from app.services.peptide_analyzer.activity_predictor import get_activity_predictor
        from app.services.peptide_analyzer.safety_predictor import get_safety_predictor
        get_activity_predictor()
        get_safety_predictor()
        return {"success": True, "models": {"activity": "loaded", "safety": "loaded"}}
    except Exception as e:
        logger.error(f"获取模型状态失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# 分子结构图生成API
@router.get("/smiles-to-image", summary="SMILES转分子结构图")
async def smiles_to_image(smiles: str):
    """
    根据 SMILES 字符串生成 2D 分子结构图（PNG）
    使用 RDKit 绘制分子结构，适合在 <img> 标签中直接展示
    """
    try:
        from rdkit import Chem
        from rdkit.Chem import Draw
        from io import BytesIO

        mol = Chem.MolFromSmiles(smiles)
        if mol is None:
            raise HTTPException(status_code=400, detail=f"无法解析 SMILES: {smiles}")

        img = Draw.MolToImage(mol, size=(400, 300), kekulize=True)
        buf = BytesIO()
        img.save(buf, format='PNG')
        buf.seek(0)

        from fastapi.responses import Response
        return Response(content=buf.read(), media_type="image/png")
    except ImportError:
        raise HTTPException(status_code=503, detail="RDKit 未安装，无法生成分子结构图")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"SMILES 转图片失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# 分子3D坐标生成API
@router.get("/smiles-to-3d", summary="SMILES转3D分子坐标")
async def smiles_to_3d(smiles: str):
    """
    根据 SMILES 字符串生成 3D 分子坐标（原子 + 键信息）
    使用 RDKit 进行 3D 构象优化（MMFF94/UFF），返回供 Three.js 渲染的原子和键数据
    """
    try:
        from rdkit import Chem
        from rdkit.Chem import rdDistGeom

        mol = Chem.MolFromSmiles(smiles)
        if mol is None:
            raise HTTPException(status_code=400, detail=f"无法解析 SMILES: {smiles}")

        # 生成 3D 构象
        mol_with_h = Chem.AddHs(mol)
        success = rdDistGeom.EmbedMolecule(mol_with_h, randomSeed=42)
        if success < 0:
            # 回退到无氢版本
            success = rdDistGeom.EmbedMolecule(mol, randomSeed=42)
            if success < 0:
                raise HTTPException(status_code=400, detail="无法生成 3D 构象，分子可能过大或环系过于刚性")

        conf = mol_with_h.GetConformer()
        atom_count = mol_with_h.GetNumAtoms()
        bond_count = mol_with_h.GetNumBonds()

        # 提取原子坐标
        atoms = []
        for i in range(atom_count):
            pos = conf.GetAtomPosition(i)
            atom = mol_with_h.GetAtomWithIdx(i)
            atoms.append({
                "element": atom.GetSymbol(),
                "x": round(pos.x, 4),
                "y": round(pos.y, 4),
                "z": round(pos.z, 4),
                "atomic_num": atom.GetAtomicNum(),
            })

        # 提取键信息
        bonds = []
        for bond in mol_with_h.GetBonds():
            bonds.append({
                "start": bond.GetBeginAtomIdx(),
                "end": bond.GetEndAtomIdx(),
                "type": {1: "single", 2: "double", 3: "triple"}.get(bond.GetBondType().real, "single"),
            })

        # 计算分子量
        from rdkit.Chem import Descriptors
        mw = Descriptors.MolWt(mol_with_h)

        return {
            "success": True,
            "smiles": smiles,
            "atom_count": atom_count,
            "bond_count": bond_count,
            "molecular_weight": round(mw, 2),
            "atoms": atoms,
            "bonds": bonds,
        }
    except ImportError:
        raise HTTPException(status_code=503, detail="RDKit 未安装，无法生成 3D 分子结构")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"SMILES 转 3D 失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


__all__ = ["router"]
