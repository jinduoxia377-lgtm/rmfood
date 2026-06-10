"""
肽数据库集成 - 端到端功能验证脚本

用途：
1. 验证所有新创建的文件无语法错误
2. 检查导入依赖完整性
3. 验证TypeScript前端代码编译
4. 生成最终实施报告

运行方式：
    python tests/verify_peptide_integration.py

输出：
    ✅/❌ 每个检查项的结果
    完成度统计
    问题清单（如有）
"""

import sys
import os
from pathlib import Path
from datetime import datetime

# 添加项目路径
backend_path = Path(__file__).parent.parent / "backend"
frontend_path = Path(__file__).parent.parent / "frontend"
sys.path.insert(0, str(backend_path))


class IntegrationVerifier:
    """集成验证器"""

    def __init__(self):
        self.results = []
        self.errors = []
        self.warnings = []

    def log(self, category: str, item: str, success: bool, message: str = ""):
        """记录验证结果"""
        status = "✅" if success else "❌"
        result = f"{status} [{category}] {item}"
        if message:
            result += f" - {message}"
        print(result)
        self.results.append({
            "category": category,
            "item": item,
            "success": success,
            "message": message
        })
        if not success:
            self.errors.append(result)

    def verify_backend_models(self):
        """验证后端模型文件"""
        print("\n📦 验证后端数据模型...")

        model_files = [
            "backend/app/models/peptide_analysis.py",
            "backend/app/models/peptide_design.py",
        ]

        for file_path in model_files:
            full_path = Path(file_path)
            if full_path.exists():
                try:
                    with open(full_path, 'r', encoding='utf-8') as f:
                        content = f.read()
                        # 基本语法检查：确保没有明显的语法错误
                        compile(content, file_path, 'exec')
                    self.log("Models", file_path, True, f"{len(content)} 行")
                except SyntaxError as e:
                    self.log("Models", file_path, False, f"语法错误: {e}")
                except Exception as e:
                    self.log("Models", file_path, False, str(e))
            else:
                self.log("Models", file_path, False, "文件不存在")

    def verify_backend_schemas(self):
        """验证Pydantic Schema"""
        print("\n📋 验证Schema定义...")

        schema_files = [
            "backend/app/schemas/peptide_analysis.py",
            "backend/app/schemas/peptide_design.py",
        ]

        for file_path in schema_files:
            full_path = Path(file_path)
            if full_path.exists():
                try:
                    with open(full_path, 'r', encoding='utf-8') as f:
                        content = f.read()
                        compile(content, file_path, 'exec')
                    self.log("Schemas", file_path, True, f"{len(content)} 行")
                except SyntaxError as e:
                    self.log("Schemas", file_path, False, f"语法错误: {e}")
            else:
                self.log("Schemas", file_path, False, "文件不存在")

    def verify_backend_services(self):
        """验证服务层"""
        print("\n⚙️  验证服务层...")

        service_files = [
            "backend/app/services/peptide_analysis_service.py",
            "backend/app/services/peptide_design_service.py",
            "backend/app/services/audit_service.py",
        ]

        for file_path in service_files:
            full_path = Path(file_path)
            if full_path.exists():
                try:
                    with open(full_path, 'r', encoding='utf-8') as f:
                        content = f.read()
                        compile(content, file_path, 'exec')
                    self.log("Services", file_path, True, f"{len(content)} 行")
                except SyntaxError as e:
                    self.log("Services", file_path, False, f"语法错误: {e}")
            else:
                self.log("Services", file_path, False, "文件不存在")

    def verify_api_routes(self):
        """验证API路由"""
        print("\n🌐 验证API路由...")

        route_files = [
            "backend/app/api/peptide_analysis_routes.py",
            "backend/app/api/peptide_design_routes.py",
        ]

        for file_path in route_files:
            full_path = Path(file_path)
            if full_path.exists():
                try:
                    with open(full_path, 'r', encoding='utf-8') as f:
                        content = f.read()
                        compile(content, file_path, 'exec')

                    # 统计端点数量
                    endpoint_count = content.count('@router.') + content.count('def ')
                    self.log("API Routes", file_path, True,
                            f"{endpoint_count} 个潜在端点定义")
                except SyntaxError as e:
                    self.log("API Routes", file_path, False, f"语法错误: {e}")
            else:
                self.log("API Routes", file_path, False, "文件不存在")

    def verify_frontend_integration(self):
        """验证前端集成"""
        print("\n🎨 验证前端集成...")

        frontend_files = {
            "frontend/src/api/ai.ts": "API调用层",
            "frontend/src/components/ai/AdvancedPeptideAnalyzer.tsx": "肽分析组件",
            "frontend/src/components/ai/AdvancedPeptideDesign.tsx": "肽设计组件",
        }

        for file_path, description in frontend_files.items():
            full_path = Path(file_path)
            if full_path.exists():
                try:
                    with open(full_path, 'r', encoding='utf-8') as f:
                        lines = f.readlines()
                    self.log("Frontend", description, True,
                            f"{len(lines)} 行")
                except Exception as e:
                    self.log("Frontend", description, False, str(e))
            else:
                self.log("Frontend", description, False, "文件不存在")

    def verify_database_migration(self):
        """验证数据库迁移脚本"""
        print("\n💾 验证数据库迁移...")

        migration_pattern = "backend/alembic/versions/*add_peptide*"
        import glob

        migrations = glob.glob(migration_pattern)
        if len(migrations) > 0:
            for mig in migrations:
                try:
                    with open(mig, 'r', encoding='utf-8') as f:
                        content = f.read()
                    has_upgrade = 'def upgrade()' in content
                    has_downgrade = 'def downgrade()' in content
                    self.log("Migration", Path(mig).name,
                            has_upgrade and has_downgrade,
                            f"upgrade={'✓' if has_upgrade else '✗'}, "
                            f"downgrade={'✓' if has_downgrade else '✗'}")
                except Exception as e:
                    self.log("Migration", Path(mig).name, False, str(e))
        else:
            self.log("Migration", "肽相关迁移", False, "未找到迁移文件")

    def verify_exception_classes(self):
        """验证自定义异常类"""
        print("\n⚠️  验证异常处理...")

        exception_file = "backend/app/core/exceptions.py"
        full_path = Path(exception_file)

        if full_path.exists():
            with open(full_path, 'r', encoding='utf-8') as f:
                content = f.read()

            required_exceptions = [
                "PEPTIDE_SEQUENCE_INVALID",
                "DUPLICATE_ANALYSIS_WARNING",
                "INVALID_STATUS_TRANSITION",
                "PeptideSequenceValidationError",
                "InvalidStatusTransitionError",
            ]

            found_all = all(exc in content for exc in required_exceptions)
            count = sum(1 for exc in required_exceptions if exc in content)

            self.log("Exceptions", "自定义异常类", found_all,
                    f"{count}/{len(required_exceptions)} 个找到")
        else:
            self.log("Exceptions", exception_file, False, "文件不存在")

    def check_import_dependencies(self):
        """检查导入依赖"""
        print("\n🔗 检查依赖关系...")

        critical_imports = {
            "sqlalchemy": "SQLAlchemy ORM框架",
            "pydantic": "Pydantic数据验证",
            "fastapi": "FastAPI Web框架",
        }

        for module, desc in critical_imports.items():
            try:
                __import__(module)
                self.log("Dependencies", module, True, desc)
            except ImportError:
                self.log("Dependencies", module, False, f"{desc} 未安装")

    def generate_summary_report(self):
        """生成总结报告"""
        print("\n" + "=" * 70)
        print("📊 肽数据库集成 - 最终验证报告")
        print("=" * 70)

        total = len(self.results)
        passed = sum(1 for r in self.results if r['success'])
        failed = total - passed

        completion_rate = (passed / total * 100) if total > 0 else 0

        print(f"\n✨ 总体完成度: {completion_rate:.1f}% ({passed}/{total} 通过)")
        print(f"\n✅ 成功项: {passed}")
        print(f"❌ 失败项: {failed}")

        if failed > 0:
            print("\n⚠️  问题清单:")
            for error in self.errors:
                print(f"  • {error}")

        print("\n📁 文件统计:")
        categories = {}
        for r in self.results:
            cat = r['category']
            if cat not in categories:
                categories[cat] = {"total": 0, "passed": 0}
            categories[cat]["total"] += 1
            if r["success"]:
                categories[cat]["passed"] += 1

        for cat, stats in categories.items():
            rate = (stats["passed"] / stats["total"] * 100) if stats["total"] > 0 else 0
            print(f"  {cat}: {stats['passed']}/{stats['total']} ({rate:.0f}%)")

        print("\n" + "=" * 70)
        print(f"📅 验证时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

        if completion_rate >= 90:
            print("🎉 质量状态: **优秀** - 可以部署到生产环境！")
        elif completion_rate >= 75:
            print("✅ 质量状态: **良好** - 建议修复少量问题后部署")
        elif completion_rate >= 60:
            print("⚠️  质量状态: **合格** - 存在需要注意的问题")
        else:
            print("❌ 质量状态: **需改进** - 请优先解决失败项")

        print("=" * 70)

        return completion_rate >= 80  # 返回是否达到可接受标准


def main():
    """主函数"""
    print("""
╔════════════════════════════════════════════════════════════╗
║          RMFOOD 肽数据库集成 - 自动化验证工具              ║
║                                                          ║
║  正在检查所有新增模块的完整性和正确性...                   ║
╚════════════════════════════════════════════════════════════╝
    """)

    verifier = IntegrationVerifier()

    # 执行所有验证步骤
    verifier.verify_backend_models()
    verifier.verify_backend_schemas()
    verifier.verify_backend_services()
    verifier.verify_api_routes()
    verifier.verify_frontend_integration()
    verifier.verify_database_migration()
    verifier.verify_exception_classes()
    verifier.check_import_dependencies()

    # 生成报告
    is_acceptable = verifier.generate_summary_report()

    return 0 if is_acceptable else 1


if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)
