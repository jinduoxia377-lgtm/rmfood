#!/usr/bin/env python3
"""
RMFOOD 安全扫描工具

功能:
- ✅ 依赖漏洞扫描 (pip-audit)
- ✅ 代码安全分析 (bandit)
- ✅ 安全配置检查
- ✅ 生成安全报告

使用方法:
    # 执行完整安全扫描
    python security_scan.py
    
    # 仅扫描依赖漏洞
    python security_scan.py --dependencies
    
    # 仅进行代码安全分析
    python security_scan.py --code
    
    # 指定输出格式 (text/json/html)
    python security_scan.py --format json
    
    # 输出到文件
    python security_scan.py -o security_report.html

作者: RMFOOD Team
日期: 2026-05-02

安全级别定义:
    🔴 CRITICAL: 严重漏洞，必须立即修复
    🟠 HIGH: 高危漏洞，建议尽快修复
    🟡 MEDIUM: 中危漏洞，应在下个版本修复
    🟢 LOW: 低危漏洞，可计划性修复
    ℹ️ INFO: 信息提示，建议关注
"""

import os
import sys
import subprocess
import json
from datetime import datetime
from pathlib import Path
from typing import Optional, List, Dict, Any


class SecurityScanner:
    """
    安全扫描管理器
    
    整合多种安全扫描工具，提供统一的安全检查接口。
    """
    
    def __init__(self, project_root: str = None):
        """
        初始化安全扫描器
        
        Args:
            project_root: 项目根目录（默认为当前目录）
        """
        self.project_root = Path(project_root) if project_root else Path(__file__).parent
        self.backend_dir = self.project_root / "backend"
        self.results = {
            "scan_time": datetime.now().isoformat(),
            "project_name": "RMFOOD配方设计平台",
            "findings": [],
            "summary": {
                "critical": 0,
                "high": 0,
                "medium": 0,
                "low": 0,
                "info": 0,
            }
        }
    
    def run_command(self, cmd: List[str], cwd: str = None) -> tuple:
        """
        执行命令并返回结果
        
        Args:
            cmd: 命令列表
            cwd: 工作目录
            
        Returns:
            tuple: (success: bool, output: str, error: str)
        """
        try:
            result = subprocess.run(
                cmd,
                cwd=cwd or str(self.backend_dir),
                capture_output=True,
                text=True,
                timeout=300  # 5分钟超时
            )
            success = result.returncode == 0
            return success, result.stdout, result.stderr
        except subprocess.TimeoutExpired:
            return False, "", "命令执行超时"
        except Exception as e:
            return False, "", str(e)
    
    def scan_dependencies(self) -> Dict[str, Any]:
        """
        使用 pip-audit 扫描依赖漏洞
        
        Returns:
            Dict: 扫描结果
        """
        print("\n" + "="*60)
        print("🔍 正在扫描依赖漏洞 (pip-audit)...")
        print("="*60 + "\n")
        
        finding = {
            "type": "dependency_vulnerability",
            "tool": "pip-audit",
            "timestamp": datetime.now().isoformat(),
            "vulnerabilities": [],
            "status": "passed"
        }
        
        # 检查 pip-audit 是否安装
        check_cmd = [sys.executable, "-m", "pip", "show", "pip-audit"]
        success, _, _ = self.run_command(check_cmd)
        
        if not success:
            print("⚠️  pip-audit 未安装，跳过依赖扫描")
            print("   安装命令: pip install pip-audit")
            finding["status"] = "skipped"
            finding["message"] = "pip-audit 未安装"
            return finding
        
        # 执行扫描
        scan_cmd = [sys.executable, "-m", "pip", "audit", "-r", "requirements.txt", "--format", "json"]
        success, output, error = self.run_command(scan_cmd)
        
        if success and output:
            try:
                data = json.loads(output)
                vulns = data.get("deps", [])
                
                for vuln in vulns:
                    if vuln.get("vulns"):
                        for v in vuln["vulns"]:
                            finding["vulnerabilities"].append({
                                "package": vuln.get("name"),
                                "version": vuln.get("version"),
                                "vuln_id": v.get("id"),
                                "description": v.get("description"),
                                "severity": v.get("fix_versions") ? "HIGH" : "MEDIUM",
                                "recommended_fix": v.get("fix_versions", ["升级到最新版本"]),
                            })
                            
                            # 更新统计
                            severity = v.get("fix_versions") ? "high" : "medium" if v.get("fix_versions") else "low"
                            self.results["summary"][severity] += 1
                
                if finding["vulnerabilities"]:
                    finding["status"] = "failed"
                    print(f"🚨 发现 {len(finding['vulnerabilities'])} 个依赖漏洞！")
                    
                    for i, vuln in enumerate(finding["vulnerabilities"], 1):
                        severity_icon = {"CRITICAL": "🔴", "HIGH": "🟠", "MEDIUM": "🟡", "LOW": "🟢"}
                        icon = severity_icon.get(vuln["severity"], "ℹ️")
                        print(f"\n  {i}. {icon} [{vuln['severity']}] {vuln['package']}=={vuln['version']}")
                        print(f"     漏洞ID: {vuln['vuln_id']}")
                        print(f"     描述: {vuln['description'][:100]}...")
                        print(f"     建议: 升级到 {', '.join(vuln['recommended_fix'][:2])}")
                else:
                    print("✅ 未发现依赖漏洞")
                    
            except json.JSONDecodeError:
                print("⚠️  解析扫描结果失败")
                finding["status"] = "error"
                finding["message"] = "无法解析JSON输出"
        else:
            print(f"⚠️  扫描失败: {error[:200] if error else '未知错误'}")
            finding["status"] = "error"
            finding["message"] = error[:500] if error else "未知错误"
        
        self.results["findings"].append(finding)
        return finding
    
    def scan_code(self) -> Dict[str, Any]:
        """
        使用 bandit 进行代码安全分析
        
        Returns:
            Dict: 扫描结果
        """
        print("\n" + "="*60)
        print("🔍 正在进行代码安全分析 (bandit)...")
        print("="*60 + "\n")
        
        finding = {
            "type": "code_security",
            "tool": "bandit",
            "timestamp": datetime.now().isoformat(),
            "issues": [],
            "status": "passed"
        }
        
        # 检查 bandit 是否安装
        check_cmd = [sys.executable, "-m", "pip", "show", "bandit"]
        success, _, _ = self.run_command(check_cmd)
        
        if not success:
            print("⚠️  bandit 未安装，跳过代码扫描")
            print("   安装命令: pip install bandit")
            finding["status"] = "skipped"
            finding["message"] = "bandit 未安装"
            return finding
        
        # 执行扫描（排除测试和迁移目录）
        scan_cmd = [
            sys.executable, "-m", "bandit",
            "-r", "app",
            "-f", "json",
            "-x", "tests,migrations,alembic",
            "-ll",  # 只显示低级及以上问题
        ]
        success, output, error = self.run_command(scan_cmd)
        
        if output:
            try:
                data = json.loads(output)
                results = data.get("results", [])
                
                for issue in results:
                    # 转换严重级别
                    severity_map = {
                        "HIGH": "high",
                        "MEDIUM": "medium",
                        "LOW": "low",
                    }
                    severity = severity_map.get(issue.get("issue_severity", "LOW"), "low")
                    
                    finding["issues"].append({
                        "test_id": issue.get("test_id"),
                        "severity": severity.upper(),
                        "confidence": issue.get("issue_confidence", "UNKNOWN"),
                        "file": issue.get("filename").replace(str(self.backend_dir), ""),
                        "line": issue.get("line_number"),
                        "issue_text": issue.get("issue_text"),
                        "details": issue.get("more_info", ""),
                    })
                    
                    # 更新统计
                    self.results["summary"][severity] += 1
                
                if finding["issues"]:
                    finding["status"] = "failed"
                    print(f"🚨 发现 {len(finding['issues'])} 个代码安全问题！")
                    
                    for i, issue in enumerate(finding["issues"], 1):
                        severity_icon = {"HIGH": "🔴", "MEDIUM": "🟠", "LOW": "🟡"}
                        icon = severity_icon.get(issue["severity"], "ℹ️")
                        print(f"\n  {i}. {icon} [{issue['severity']}] {issue['file']}:{issue['line']}")
                        print(f"     问题: {issue['issue_text']}")
                        print(f"     测试ID: {issue['test_id']}")
                        print(f"     置信度: {issue['confidence']}")
                else:
                    print("✅ 未发现代码安全问题")
                    
            except json.JSONDecodeError:
                print("⚠️  解析扫描结果失败")
                finding["status"] = "error"
        else:
            # bandit 可能以非零退出码返回但仍有输出
            if error:
                print(f"⚠️  扫描警告: {error[:200]}")
        
        self.results["findings"].append(finding)
        return finding
    
    def check_security_config(self) -> Dict[str, Any]:
        """
        检查安全相关配置
        
        Returns:
            Dict: 配置检查结果
        """
        print("\n" + "="*60)
        print("🔍 正在检查安全配置...")
        print("="*60 + "\n")
        
        finding = {
            "type": "security_config",
            "checks": [],
            "status": "passed"
        }
        
        checks = [
            {
                "name": ".env 文件权限检查",
                "check": lambda: not (self.project_root / ".env").exists() or 
                                  oct(os.stat(self.project_root / ".env").st_mode)[-3:] in ["600", "640"],
                "pass_msg": ".env 文件权限正确",
                "fail_msg": ".env 文件权限过于宽松（应为600或640）",
                "severity": "MEDIUM",
            },
            {
                "name": "DEBUG模式检查",
                "check": lambda: os.getenv("DEBUG", "true").lower() != "true",
                "pass_msg": "生产环境已关闭DEBUG模式",
                "fail_msg": "⚠️ DEBUG模式已开启（生产环境应关闭）",
                "severity": "HIGH",
            },
            {
                "name": "SECRET_KEY检查",
                "check": lambda: len(os.getenv("SECRET_KEY", "")) >= 32,
                "pass_msg": "SECRET_KEY长度足够",
                "fail_msg": "🚨 SECRET_KEY过短或未设置（应≥32字符）",
                "severity": "CRITICAL",
            },
            {
                "name": "CORS配置检查",
                "check": lambda: "*" not in os.getenv("CORS_ORIGINS", ""),
                "pass_msg": "CORS配置合理",
                "fail_msg": "⚠️ CORS设置为通配符*（不安全）",
                "severity": "HIGH",
            },
            {
                "name": "HTTPS强制检查",
                "check": lambda: os.getenv("FORCE_HTTPS", "false").lower() == "true",
                "pass_msg": "已启用HTTPS强制跳转",
                "fail_msg": "ℹ️ 建议在生产环境启用HTTPS强制跳转",
                "severity": "INFO",
            },
        ]
        
        for check in checks:
            try:
                passed = check["check"]()
                status_icon = "✅" if passed else "❌"
                
                print(f"{status_icon} {check['name']}: {check['pass_msg'] if passed else check['fail_msg']}")
                
                finding["checks"].append({
                    "name": check["name"],
                    "passed": passed,
                    "message": check["pass_msg"] if passed else check["fail_msg"],
                    "severity": check["severity"],
                })
                
                if not passed:
                    finding["status"] = "failed"
                    sev = check["severity"].lower()
                    if sev in self.results["summary"]:
                        self.results["summary"][sev] += 1
                        
            except Exception as e:
                print(f"❌ {check['name']}: 检查失败 - {e}")
                finding["checks"].append({
                    "name": check["name"],
                    "passed": False,
                    "message": f"检查异常: {e}",
                    "severity": "ERROR",
                })
        
        self.results["findings"].append(finding)
        return finding
    
    def generate_report(self, format_type: str = "text") -> str:
        """
        生成安全报告
        
        Args:
            format_type: 输出格式 (text/json/html)
            
        Returns:
            str: 报告内容
        """
        if format_type == "json":
            return json.dumps(self.results, indent=2, ensure_ascii=False)
        
        elif format_type == "html":
            return self._generate_html_report()
        
        else:  # text
            return self._generate_text_report()
    
    def _generate_text_report(self) -> str:
        """生成文本格式报告"""
        lines = []
        lines.append("\n" + "="*60)
        lines.append("📋 RMFOOD 安全扫描报告")
        lines.append("="*60)
        lines.append(f"扫描时间: {self.results['scan_time']}")
        lines.append(f"项目名称: {self.results['project_name']}")
        lines.append("")
        
        # 统计摘要
        summary = self.results["summary"]
        total_issues = sum(summary.values())
        lines.append("📊 问题统计:")
        lines.append(f"  🔴 严重 (CRITICAL): {summary['critical']}")
        lines.append(f"  🟠高危 (HIGH):      {summary['high']}")
        lines.append(f"  🟡中危 (MEDIUM):     {summary['medium']}")
        lines.append(f"  🟢低危 (LOW):        {summary['low']}")
        lines.append(f"  ℹ️信息 (INFO):       {summary['info']}")
        lines.append(f"  ─────────────────────")
        lines.append(f"  📋 合计:             {total_issues}")
        lines.append("")
        
        # 详细发现
        if self.results["findings"]:
            lines.append("📝 详细发现:")
            for finding in self.results["findings"]:
                ftype = finding.get("type", "unknown")
                fstatus = finding.get("status", "unknown")
                status_icon = "✅" if fstatus in ["passed", "skipped"] else "🚨" if fstatus == "failed" else "⚠️"
                
                lines.append(f"\n{status_icon} {ftype.upper()} ({fstatus})")
                
                if ftype == "dependency_vulnerability":
                    for vuln in finding.get("vulnerabilities", []):
                        lines.append(f"  • [{vuln['severity']}] {vuln['package']}=={vuln['version']}")
                        lines.append(f"    ID: {vuln['vuln_id']}")
                        
                elif ftype == "code_security":
                    for issue in finding.get("issues", []):
                        lines.append(f"  • [{issue['severity']}] {issue['file']}:{issue['line']}")
                        lines.append(f"    {issue['issue_text']}")
                        
                elif ftype == "security_config":
                    for check in finding.get("checks", []):
                        icon = "✅" if check["passed"] else "❌"
                        lines.append(f"  {icon} {check['name']}: {check['message']}")
        
        lines.append("\n" + "="*60)
        lines.append("📞 如有问题请联系安全团队")
        lines.append("="*60 + "\n")
        
        return "\n".join(lines)
    
    def _generate_html_report(self) -> str:
        """生成HTML格式报告"""
        html_template = """
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>RMFOOD 安全扫描报告</title>
    <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 20px; background: #f5f5f5; }}
        .container {{ max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }}
        h1 {{ color: #333; border-bottom: 3px solid #007bff; padding-bottom: 10px; }}
        .stats {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin: 20px 0; }}
        .stat-card {{ padding: 15px; border-radius: 8px; text-align: center; font-weight: bold; }}
        .critical {{ background: #dc3545; color: white; }}
        .high {{ background: #fd7e14; color: white; }}
        .medium {{ background: #ffc107; color: black; }}
        .low {{ background: #28a745; color: white; }}
        .info {{ background: #17a2b8; color: white; }}
        table {{ width: 100%; border-collapse: collapse; margin: 15px 0; }}
        th, td {{ padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }}
        th {{ background: #f8f9fa; font-weight: bold; }}
        tr:hover {{ background: #f5f5f5; }}
        .badge {{ padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; }}
    </style>
</head>
<body>
    <div class="container">
        <h1>🔒 RMFOOD 安全扫描报告</h1>
        <p><strong>扫描时间:</strong> {scan_time}</p>
        <p><strong>项目名称:</strong> {project_name}</p>
        
        <div class="stats">
            <div class="stat-card critical">🔴 严重: {critical}</div>
            <div class="stat-card high">🟠 高危: {high}</div>
            <div class="stat-card medium">🟡 中危: {medium}</div>
            <div class="stat-card low">🟢 低危: {low}</div>
            <div class="stat-card info">ℹ️ 信息: {info}</div>
        </div>
        
        {findings_html}
    </div>
</body>
</html>"""
        
        # 生成发现详情HTML
        findings_html = ""
        for finding in self.results.get("findings", []):
            findings_html += f"<h2>{finding.get('type', 'Unknown')}</h2>"
            
            if finding.get("type") == "dependency_vulnerability":
                findings_html += "<table><tr><th>包名</th><th>版本</th><th>漏洞ID</th><th>严重程度</th></tr>"
                for vuln in finding.get("vulnerabilities", []):
                    findings_html += f"<tr><td>{vuln['package']}</td><td>{vuln['version']}</td><td>{vuln['vuln_id']}</td><td><span class='badge'>{vuln['severity']}</span></td></tr>"
                findings_html += "</table>"
            
            elif finding.get("type") == "code_security":
                findings_html += "<table><tr><th>文件</th><th>行号</th><th>问题</th><th>严重程度</th></tr>"
                for issue in finding.get("issues", []):
                    findings_html += f"<tr><td>{issue['file']}</td><td>{issue['line']}</td><td>{issue['issue_text']}</td><td><span class='badge'>{issue['severity']}</span></td></tr>"
                findings_html += "</table>"
            
            elif finding.get("type") == "security_config":
                findings_html += "<table><tr><th>检查项</th><th>状态</th><th>消息</th></tr>"
                for check in finding.get("checks", []):
                    status = "✅ 通过" if check["passed"] else "❌ 失败"
                    findings_html += f"<tr><td>{check['name']}</td><td>{status}</td><td>{check['message']}</td></tr>"
                findings_html += "</table>"
        
        return html_template.format(
            scan_time=self.results["scan_time"],
            project_name=self.results["project_name"],
            **self.results["summary"],
            findings_html=findings_html,
        )


def main():
    """主函数"""
    import argparse
    
    parser = argparse.ArgumentParser(
        description="RMFOOD 安全扫描工具",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  %(prog)s                     # 完整安全扫描
  %(prog)s --dependencies       # 仅扫描依赖
  %(prog)s --code               # 仅扫描代码
  %(prog)s -o report.html       # 输出HTML报告
  %(prog)s --format json        # JSON格式输出
        """
    )
    
    parser.add_argument(
        "--dependencies", "-d",
        action="store_true",
        help="仅扫描依赖漏洞"
    )
    parser.add_argument(
        "--code", "-c",
        action="store_true",
        help="仅进行代码安全分析"
    )
    parser.add_argument(
        "--config",
        action="store_true",
        help="仅检查安全配置"
    )
    parser.add_argument(
        "--format", "-f",
        choices=["text", "json", "html"],
        default="text",
        help="输出格式 (默认: text)"
    )
    parser.add_argument(
        "--output", "-o",
        type=str,
        default=None,
        help="输出文件路径"
    )
    
    args = parser.parse_args()
    
    # 初始化扫描器
    scanner = SecurityScanner()
    
    # 根据参数选择扫描类型
    if args.dependencies or (not args.code and not args.config):
        scanner.scan_dependencies()
    
    if args.code or (not args.dependencies and not args.config):
        scanner.scan_code()
    
    if args.config or (not args.dependencies and not args.code):
        scanner.check_security_config()
    
    # 生成报告
    report = scanner.generate_report(args.format)
    
    # 输出报告
    if args.output:
        with open(args.output, 'w', encoding='utf-8') as f:
            f.write(report)
        print(f"\n✅ 报告已保存至: {args.output}")
    else:
        print(report)
    
    # 返回退出码（有问题时返回非零）
    total_issues = sum(scanner.results["summary"].values())
    return 1 if total_issues > 0 else 0


if __name__ == "__main__":
    sys.exit(main() or 0)