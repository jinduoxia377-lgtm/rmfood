#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
RMFOOD 数据库编码健康检查工具

功能:
1. 验证数据库连接是否使用UTF-8编码
2. 测试中文字符的存储和读取
3. 检查数据库字符集配置
4. 生成编码健康报告

使用方法:
    python check_database_encoding.py
"""

import sys
import os
import json
import time
import asyncio
from datetime import datetime
from typing import Dict, List, Optional, Tuple

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from sqlalchemy import text, inspect
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.session import engine, async_session_factory
from app.core.config import settings


class DatabaseEncodingChecker:
    """数据库编码健康检查器"""

    def __init__(self):
        self.results: List[Dict] = []
        self.warnings: List[str] = []
        self.errors: List[str] = []

    def add_result(self, check_name: str, passed: bool, message: str, details: str = ""):
        """添加检查结果"""
        self.results.append({
            "check": check_name,
            "passed": passed,
            "message": message,
            "details": details,
            "timestamp": datetime.now().isoformat()
        })

        if passed:
            print(f"✅ {check_name}: {message}")
        else:
            print(f"❌ {check_name}: {message}")
            self.errors.append(f"{check_name}: {message}")

    def add_warning(self, message: str):
        """添加警告"""
        self.warnings.append(message)
        print(f"⚠️  警告: {message}")

    async def check_database_connection(self) -> bool:
        """检查数据库连接"""
        try:
            async with engine.connect() as conn:
                result = await conn.execute(text("SELECT 1"))
                result.scalar()
                self.add_result(
                    "数据库连接",
                    True,
                    "数据库连接正常",
                    f"URL: {settings.database_url.split('@')[-1] if '@' in settings.database_url else settings.database_url}"
                )
                return True
        except Exception as e:
            self.add_result(
                "数据库连接",
                False,
                f"连接失败: {str(e)}",
                f"错误类型: {type(e).__name__}"
            )
            return False

    async def check_database_encoding(self) -> bool:
        """检查数据库字符集配置"""
        db_url = settings.database_url.lower()

        if 'sqlite' in db_url:
            return await self._check_sqlite_encoding()
        elif 'postgresql' in db_url or 'postgres' in db_url:
            return await self._check_postgresql_encoding()
        elif 'mysql' in db_url:
            return await self._check_mysql_encoding()
        else:
            self.add_warning(f"未知数据库类型: {db_url}")
            return True

    async def _check_sqlite_encoding(self) -> bool:
        """检查SQLite编码"""
        try:
            async with engine.connect() as conn:
                result = await conn.execute(
                    text("PRAGMA encoding")
                )
                encoding = result.scalar()

                if encoding in ['UTF-8', 'UTF-8', 'utf8']:
                    self.add_result(
                        "SQLite字符集",
                        True,
                        f"数据库使用 {encoding} 编码",
                        "中文字符将正确存储"
                    )
                    return True
                else:
                    self.add_result(
                        "SQLite字符集",
                        False,
                        f"数据库使用 {encoding} 编码",
                        "建议使用UTF-8编码"
                    )
                    return False
        except Exception as e:
            self.add_result(
                "SQLite字符集",
                False,
                f"无法检查编码: {str(e)}",
                ""
            )
            return False

    async def _check_postgresql_encoding(self) -> bool:
        """检查PostgreSQL编码"""
        try:
            async with engine.connect() as conn:
                result = await conn.execute(
                    text("SHOW client_encoding")
                )
                client_encoding = result.scalar()

                result = await conn.execute(
                    text("SHOW server_encoding")
                )
                server_encoding = result.scalar()

                if client_encoding == 'UTF8' and server_encoding == 'UTF8':
                    self.add_result(
                        "PostgreSQL字符集",
                        True,
                        f"客户端: {client_encoding}, 服务端: {server_encoding}",
                        "字符集配置正确"
                    )
                    return True
                else:
                    self.add_result(
                        "PostgreSQL字符集",
                        False,
                        f"客户端: {client_encoding}, 服务端: {server_encoding}",
                        "建议将客户端和服务端都设置为UTF8"
                    )
                    return False
        except Exception as e:
            self.add_result(
                "PostgreSQL字符集",
                False,
                f"无法检查编码: {str(e)}",
                ""
            )
            return False

    async def _check_mysql_encoding(self) -> bool:
        """检查MySQL编码"""
        try:
            async with engine.connect() as conn:
                result = await conn.execute(
                    text("SHOW VARIABLES LIKE 'character_set%'")
                )
                variables = {row[0]: row[1] for row in result}

                charset = variables.get('character_set_connection', '')
                collation = variables.get('collation_connection', '')

                if 'utf8' in charset.lower() or 'utf8mb4' in charset.lower():
                    self.add_result(
                        "MySQL字符集",
                        True,
                        f"连接字符集: {charset}, 排序规则: {collation}",
                        "字符集配置正确"
                    )
                    return True
                else:
                    self.add_result(
                        "MySQL字符集",
                        False,
                        f"连接字符集: {charset}",
                        "建议使用utf8mb4字符集"
                    )
                    return False
        except Exception as e:
            self.add_result(
                "MySQL字符集",
                False,
                f"无法检查编码: {str(e)}",
                ""
            )
            return False

    async def test_chinese_storage(self) -> bool:
        """测试中文字符存储和读取"""
        test_data = [
            ("简体中文测试", "简单中文"),
            ("繁体中文測試", "繁體中文"),
            ("emoji表情", "🍜🔥💪"),
            ("混合内容", "配方名称: 养生粥\n功效: 补气养血"),
            ("特殊字符", "★☆●○◆◇□■"),
            ("超长文本", "中" * 1000),
        ]

        all_passed = True

        for test_name, test_content in test_data:
            try:
                async with async_session_factory() as session:
                    test_key = f"__encoding_test_{int(time.time() * 1000)}__"

                    await session.execute(
                        text(f"CREATE TABLE IF NOT EXISTS __encoding_test__ (key TEXT PRIMARY KEY, value TEXT)")
                    )

                    await session.execute(
                        text("INSERT OR REPLACE INTO __encoding_test__ (key, value) VALUES (:key, :value)"),
                        {"key": test_key, "value": test_content}
                    )
                    await session.commit()

                    result = await session.execute(
                        text("SELECT value FROM __encoding_test__ WHERE key = :key"),
                        {"key": test_key}
                    )
                    retrieved_value = result.scalar()

                    await session.execute(
                        text("DELETE FROM __encoding_test__ WHERE key = :key"),
                        {"key": test_key}
                    )
                    await session.commit()

                    if retrieved_value == test_content:
                        self.add_result(
                            f"存储测试 - {test_name}",
                            True,
                            f"成功存储和读取: {test_content[:20]}...",
                            f"长度: {len(test_content)}"
                        )
                    else:
                        self.add_result(
                            f"存储测试 - {test_name}",
                            False,
                            f"数据不匹配",
                            f"原始: {test_content[:50]}...\n检索: {retrieved_value[:50] if retrieved_value else 'None'}..."
                        )
                        all_passed = False

            except Exception as e:
                self.add_result(
                    f"存储测试 - {test_name}",
                    False,
                    f"测试失败: {str(e)}",
                    f"测试内容: {test_content[:50]}..."
                )
                all_passed = False

        return all_passed

    async def check_sqlalchemy_configuration(self) -> bool:
        """检查SQLAlchemy配置"""
        try:
            engine_url = str(engine.url)

            has_encoding = 'charset=' in engine_url.lower() or 'encoding=' in engine_url.lower()
            has_utf8 = 'utf8' in engine_url.lower() or 'utf-8' in engine_url.lower() or 'utf_8' in engine_url.lower()

            if has_encoding and has_utf8:
                self.add_result(
                    "SQLAlchemy配置",
                    True,
                    "数据库URL包含UTF-8编码参数",
                    f"URL: {engine_url}"
                )
                return True
            else:
                self.add_result(
                    "SQLAlchemy配置",
                    False,
                    "数据库URL缺少UTF-8编码参数",
                    f"URL: {engine_url}"
                )
                return False
        except Exception as e:
            self.add_result(
                "SQLAlchemy配置",
                False,
                f"检查失败: {str(e)}",
                ""
            )
            return False

    def generate_report(self) -> Dict:
        """生成健康报告"""
        total_checks = len(self.results)
        passed_checks = sum(1 for r in self.results if r["passed"])
        failed_checks = total_checks - passed_checks

        health_score = (passed_checks / total_checks * 100) if total_checks > 0 else 0

        return {
            "summary": {
                "total_checks": total_checks,
                "passed": passed_checks,
                "failed": failed_checks,
                "warnings": len(self.warnings),
                "health_score": round(health_score, 2),
                "status": "healthy" if health_score >= 80 else "warning" if health_score >= 60 else "unhealthy"
            },
            "database_url": settings.database_url.split('@')[-1] if '@' in settings.database_url else settings.database_url,
            "checks": self.results,
            "warnings": self.warnings,
            "errors": self.errors,
            "timestamp": datetime.now().isoformat()
        }

    def print_summary(self, report: Dict):
        """打印报告摘要"""
        print("\n" + "=" * 60)
        print("📊 数据库编码健康检查报告")
        print("=" * 60)

        summary = report["summary"]
        print(f"\n总体健康度: {summary['health_score']}%")
        print(f"状态: {'✅ 健康' if summary['status'] == 'healthy' else '⚠️ 警告' if summary['status'] == 'warning' else '❌ 不健康'}")

        print(f"\n检查结果:")
        print(f"  - 总检查项: {summary['total_checks']}")
        print(f"  - 通过: {summary['passed']} ✅")
        print(f"  - 失败: {summary['failed']} ❌")
        print(f"  - 警告: {summary['warnings']} ⚠️")

        if self.errors:
            print(f"\n❌ 错误详情:")
            for error in self.errors:
                print(f"   - {error}")

        if self.warnings:
            print(f"\n⚠️ 警告详情:")
            for warning in self.warnings:
                print(f"   - {warning}")

        print("\n" + "=" * 60)

        if summary['status'] == 'healthy':
            print("🎉 数据库编码配置正常，中文字符将正确存储和读取！")
        elif summary['status'] == 'warning':
            print("⚠️ 数据库编码配置有改进空间，建议检查上述失败项。")
        else:
            print("❌ 数据库编码配置存在问题，请立即修复！")
        print("=" * 60 + "\n")


async def main():
    """主函数"""
    print("\n" + "=" * 60)
    print("🔍 RMFOOD 数据库编码健康检查")
    print("=" * 60 + "\n")

    checker = DatabaseEncodingChecker()

    print("📡 检查数据库连接...")
    connection_ok = await checker.check_database_connection()
    if not connection_ok:
        print("\n❌ 无法连接到数据库，检查终止。")
        return 1

    print("\n🔤 检查字符集配置...")
    await checker.check_database_encoding()

    print("\n⚙️ 检查SQLAlchemy配置...")
    await checker.check_sqlalchemy_configuration()

    print("\n📝 测试中文字符存储...")
    await checker.test_chinese_storage()

    report = checker.generate_report()

    checker.print_summary(report)

    report_file = f"database_encoding_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    with open(report_file, 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    print(f"📄 详细报告已保存到: {report_file}\n")

    return 0 if report["summary"]["status"] == "healthy" else 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
