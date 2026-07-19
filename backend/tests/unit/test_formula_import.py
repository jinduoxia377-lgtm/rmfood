"""
测试 FormulaService 导入修复

验证 importlib 反模式已被标准 import 替代
"""
import pytest
import pathlib


def test_formula_service_importable():
    """FormulaService 应可通过标准 import 导入"""
    from app.services.formula import FormulaService
    assert FormulaService is not None


def test_formula_service_has_expected_methods():
    """FormulaService 应具备核心业务方法"""
    from app.services.formula import FormulaService
    # 验证核心方法存在
    assert hasattr(FormulaService, 'create_formula')
    assert hasattr(FormulaService, 'get_formula')
    assert hasattr(FormulaService, 'list_formulas')
    assert hasattr(FormulaService, 'update_formula')
    assert hasattr(FormulaService, 'delete_formula')
    assert hasattr(FormulaService, 'submit_for_review')
    assert hasattr(FormulaService, 'review_formula')


def test_synergy_engine_importable():
    """SynergyEngine 也应正常导入"""
    from app.services.formula import SynergyEngine
    assert SynergyEngine is not None


def test_no_importlib_in_formula_init():
    """services/formula/__init__.py 不应使用 importlib"""
    # 从测试目录向上找到 backend/app/services/formula/__init__.py
    test_dir = pathlib.Path(__file__).resolve().parent
    init_path = test_dir.parent.parent / 'app' / 'services' / 'formula' / '__init__.py'
    source = init_path.read_text(encoding='utf-8')

    # 检查是否有 importlib 调用
    assert 'importlib' not in source, \
        "services/formula/__init__.py 不应使用 importlib"
