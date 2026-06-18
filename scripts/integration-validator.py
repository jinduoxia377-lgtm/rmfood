#!/usr/bin/env python3
"""
integration-validator.py
集成验证工具

验证依赖管理、配置管理和安全性的集成
"""

import os
import sys
import json
import subprocess
from pathlib import Path
from typing import Dict, List, Tuple

class IntegrationValidator:
    """集成验证器"""

    def __init__(self):
        self.project_root = Path(__file__).parent.parent.parent
        self.backend_root = self.project_root / "backend"
        self.findings = []
        self.successes = []

    def log_success(self, message: str):
        """记录成功"""
        self.successes.append(message)
        print(f"[OK] {message}")

    def log_finding(self, level: str, message: str):
        """记录发现"""
        self.findings.append({"level": level, "message": message})
        if level == "error":
            print(f"[ERROR] {message}")
        elif level == "warning":
            print(f"[WARN] {message}")
        else:
            print(f"[INFO] {message}")

    def check_dependency_structure(self) -> bool:
        """检查依赖管理结构"""
        print("\n检查依赖管理结构...")

        success = True
        required_files = [
            self.backend_root / "requirements" / "base.in",
            self.backend_root / "requirements" / "base.txt",
            self.backend_root / "requirements" / "api.in",
            self.backend_root / "requirements" / "api.txt",
            self.backend_root / "requirements" / "db.in",
            self.backend_root / "requirements" / "db.txt",
            self.backend_root / "requirements" / "ml.in",
            self.backend_root / "requirements" / "ml.txt",
            self.backend_root / "requirements" / "dev.in",
            self.backend_root / "requirements" / "dev.txt",
            self.backend_root / "requirements" / "prod.in",
            self.backend_root / "requirements" / "prod.txt",
        ]

        for req_file in required_files:
            if req_file.exists():
                self.log_success(f"依赖文件存在: {req_file.relative_to(self.project_root)}")
            else:
                self.log_finding("error", f"依赖文件缺失: {req_file.relative_to(self.project_root)}")
                success = False

        # 检查requirements.txt与prod.txt是否一致
        if Path(self.backend_root / "requirements.txt").exists() and Path(self.backend_root / "requirements" / "prod.txt").exists():
            with open(self.backend_root / "requirements.txt", 'r') as f1, open(self.backend_root / "requirements" / "prod.txt", 'r') as f2:
                content1 = f1.read()
                content2 = f2.read()
                if content1 == content2:
                    self.log_success("requirements.txt与prod.txt一致")
                else:
                    self.log_finding("warning", "requirements.txt与prod.txt不一致")

        return success

    def check_configuration_integrity(self) -> bool:
        """检查配置完整性"""
        print("\n⚙️ 检查配置完整性...")

        success = True

        # 检查.env.example是否包含所有必需配置
        env_example = self.project_root / ".env.example"
        if env_example.exists():
            content = env_example.read_text()

            # 检查关键配置项
            key_configs = [
                "ENV=",
                "SECRET_KEY=",
                "DATABASE_URL=",
                "LOG_LEVEL=",
                "CORS_ORIGINS=",
            ]

            for key in key_configs:
                if key in content:
                    self.log_success(f"配置模板包含: {key.rstrip('=')}")
                else:
                    self.log_finding("warning", f"配置模板缺少: {key.rstrip('=')}")
        else:
            self.log_finding("error", "缺少.env.example文件")
            success = False

        # 检查核心配置模块
        config_file = self.backend_root / "app" / "core" / "config.py"
        if config_file.exists():
            self.log_success(f"配置模块存在: {config_file.relative_to(self.project_root)}")

            # 检查文件大小（确保足够完整）
            if config_file.stat().st_size > 10000:  # 10KB以上
                self.log_success("配置模块具有完整功能")
            else:
                self.log_finding("warning", "配置模块可能不完整")
        else:
            self.log_finding("error", "配置模块缺失")
            success = False

        return success

    def check_security_integration(self) -> bool:
        """检查安全集成"""
        print("\n🔒 检查安全集成...")

        success = True

        # 检查安全模块
        security_module = self.backend_root / "app" / "core" / "security" / "security_config.py"
        if security_module.exists():
            self.log_success(f"安全配置模块存在: {security_module.relative_to(self.project_root)}")
        else:
            self.log_finding("warning", "安全配置模块可能需要增强")
            success = False

        # 检查安全中间件
        security_middleware = self.backend_root / "app" / "core" / "security_middleware.py"
        if security_middleware.exists():
            self.log_success(f"安全中间件存在: {security_middleware.relative_to(self.project_root)}")
        else:
            self.log_finding("warning", "安全中间件可能需要检查")

        # 检查安全审计脚本
        security_audit_script = self.project_root / "scripts" / "security-audit.py"
        if security_audit_script.exists():
            self.log_success(f"安全审计脚本存在: {security_audit_script.relative_to(self.project_root)}")
        else:
            self.log_finding("warning", "安全审计脚本可能需要检查")

        return success

    def check_interoperability(self) -> bool:
        """检查组件互操作性"""
        print("\n🔗 检查组件互操作性...")

        success = True

        # 检查配置模块是否引用安全配置
        config_file = self.backend_root / "app" / "core" / "config.py"
        if config_file.exists():
            content = config_file.read_text()

            # 检查是否引用了安全相关配置
            security_refs = [
                "SecurityConfig",
                "security.secret_key",
                "JWT_EXPIRE_MINUTES",
            ]

            for ref in security_refs:
                if ref in content:
                    self.log_success(f"配置模块引用安全配置: {ref}")
                else:
                    self.log_finding("info", f"配置模块可能未引用: {ref}")

        # 检查文档是否完整
        docs = [
            self.project_root / "docs" / "dependency-management.md",
            self.project_root / "docs" / "configuration-guide.md",
        ]

        for doc in docs:
            if doc.exists():
                self.log_success(f"文档存在: {doc.relative_to(self.project_root)}")
            else:
                self.log_finding("warning", f"文档缺失: {doc.name}")

        return success

    def run_validation_tests(self) -> bool:
        """运行验证测试"""
        print("\n🧪 运行验证测试...")

        success = True

        # 尝试导入关键配置模块
        try:
            import sys
            sys.path.insert(0, str(self.backend_root))

            # 导入配置模块
            from app.core.config import Settings
            settings = Settings()
            self.log_success("配置模块可以正常导入和初始化")

            # 检查配置导出功能
            config_dict = settings.to_dict(include_sensitive=False)
            if config_dict:
                self.log_success("配置可以正常导出为字典")
            else:
                self.log_finding("warning", "配置导出可能有问题")

        except Exception as e:
            self.log_finding("error", f"配置模块导入失败: {str(e)}")
            success = False

        return success

    def generate_report(self) -> Dict:
        """生成集成验证报告"""
        return {
            "project": "RMFOOD配方平台",
            "validation_date": self.get_current_timestamp(),
            "findings": self.findings,
            "successes": self.successes,
            "summary": {
                "total_findings": len(self.findings),
                "total_successes": len(self.successes),
                "errors": len([f for f in self.findings if f["level"] == "error"]),
                "warnings": len([f for f in self.findings if f["level"] == "warning"]),
                "infos": len([f for f in self.findings if f["level"] not in ["error", "warning"]]),
            }
        }

    def get_current_timestamp(self) -> str:
        """获取当前时间戳"""
        from datetime import datetime
        return datetime.now().isoformat()

    def validate(self) -> Tuple[bool, Dict]:
        """执行完整验证"""
        print("RMFOOD集成验证工具")
        print("=" * 50)

        results = []

        # 运行所有检查
        results.append(("依赖管理", self.check_dependency_structure()))
        results.append(("配置完整性", self.check_configuration_integrity()))
        results.append(("安全集成", self.check_security_integration()))
        results.append(("组件互操作", self.check_interoperability()))
        results.append(("验证测试", self.run_validation_tests()))

        print("\n" + "=" * 50)
        print("验证结果")
        print("=" * 50)

        # 显示检查结果
        all_success = True
        for check_name, success in results:
            indicator = "[OK]" if success else "[FAIL]"
            print(f"{indicator} {check_name}: {'通过' if success else '失败'}")
            all_success = all_success and success

        # 生成报告
        report = self.generate_report()

        print("\n摘要:")
        print(f"  成功项: {report['summary']['total_successes']}")
        print(f"  发现项: {report['summary']['total_findings']}")
        print(f"  错误: {report['summary']['errors']}")
        print(f"  警告: {report['summary']['warnings']}")
        print(f"  信息: {report['summary']['infos']}")

        if report['summary']['errors'] > 0:
            print("\n发现错误，请立即修复:")
            for finding in self.findings:
                if finding["level"] == "error":
                    print(f"  * {finding['message']}")
        elif report['summary']['warnings'] > 0:
            print("\n发现警告，建议审查:")
            for finding in self.findings:
                if finding["level"] == "warning":
                    print(f"  * {finding['message']}")

        return all_success, report


def main():
    """主函数"""
    try:
        validator = IntegrationValidator()
        success, report = validator.validate()

        # 保存报告到文件
        report_file = Path("integration-validation-report.json")
        with open(report_file, 'w', encoding='utf-8') as f:
            json.dump(report, f, indent=2, ensure_ascii=False)

        print(f"\n📄 详细报告已保存到: {report_file.absolute()}")

        if success:
            print("\n🎉 集成验证通过！")
            return 0
        else:
            print("\n⚠️  集成验证发现一些问题")
            return 1

    except Exception as e:
        print(f"❌ 验证过程发生错误: {str(e)}")
        return 1


if __name__ == "__main__":
    sys.exit(main())