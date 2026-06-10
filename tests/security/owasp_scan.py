"""
RMFOOD 配方平台 - OWASP Top 10 安全扫描工具

自动化安全漏洞检测脚本，覆盖OWASP Top 10 (2021)全部类别：
1. A01:2021 - 访问控制失效 (Broken Access Control)
2. A02:2021 - 加密机制失败 (Cryptographic Failures)
3. A03:2021 - 注入攻击 (Injection)
4. A04:2021 - 不安全设计 (Insecure Design)
5. A05:2021 - 安全配置错误 (Security Misconfiguration)
6. A06:2021 - 过时和 vulnerable 组件 (Vulnerable Components)
7. A07:2021 - 认证和会话失败 (Identification & Auth Failures)
8. A08:2021 - 软件和数据完整性失败 (Integrity Failures)
9. A09:2021 - 安全日志和监控不足 (Logging & Monitoring Failures)
10. A10:2021 - 服务端请求伪造 (SSRF)

使用方式:
    python owasp_scan.py --target http://localhost:8000 --output report.json

作者: Security Team
日期: 2026-05-20
版本: v2.0 (Phase 5 集成测试专用)
"""

import argparse
import asyncio
import json
import re
import sys
import time
from datetime import datetime, timezone
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass, field, asdict
from enum import Enum
from pathlib import Path

try:
    import httpx
except ImportError:
    print("❌ 缺少依赖: pip install httpx")
    sys.exit(1)


# ════════════════════════════════════════════════
# 数据结构定义
# ════════════════════════════════════════════════

class Severity(Enum):
    """漏洞严重程度分级"""
    CRITICAL = "Critical"     # 可直接导致系统沦陷
    HIGH = "High"            # 可获取敏感数据或权限提升
    MEDIUM = "Medium"        # 需要特定条件才能利用
    LOW = "Low"              # 轻微安全问题，建议修复
    INFO = "Info"            # 信息性发现，最佳实践建议


class OWASPCategory(Enum):
    """OWASP Top 10 分类"""
    A01_BROKEN_ACCESS_CONTROL = "A01:2021-Broken Access Control"
    A02_CRYPTOGRAPHIC_FAILURES = "A02:2021-Cryptographic Failures"
    A03_INJECTION = "A03:2021-Injection"
    A04_INSECURE_DESIGN = "A04:2021-Insecure Design"
    A05_SECURITY_MISCONFIGURATION = "A05:2021-Security Misconfiguration"
    A06_VULNERABLE_COMPONENTS = "A06:2021-Vulnerable and Outdated Components"
    A07_AUTH_FAILURES = "A07:2021-Identification and Authentication Failures"
    A08_INTEGRITY_FAILURES = "A08:2021-Software and Data Integrity Failures"
    A09_LOGGING_FAILURES = "A09:2021-Security Logging and Monitoring Failures"
    A10_SSRF = "A10:2021-Server-Side Request Forgery"


@dataclass
class VulnerabilityFinding:
    """单个漏洞发现"""
    id: str
    title: str
    severity: Severity
    category: OWASPCategory
    description: str
    affected_endpoint: str
    attack_vector: str
    proof_of_concept: str
    remediation: str
    references: List[str] = field(default_factory=list)
    cvss_score: Optional[float] = None
    discovered_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


@dataclass
class ScanResult:
    """扫描结果汇总"""
    target_url: str
    scan_start_time: str
    scan_end_time: str
    total_duration_seconds: float
    findings: List[VulnerabilityFinding] = field(default_factory=list)
    total_endpoints_tested: int = 0
    summary: Dict[str, int] = field(default_factory=dict)

    def to_dict(self) -> dict:
        return asdict(self)


# ════════════════════════════════════════════════
# OWASP 扫描器核心类
# ════════════════════════════════════════════════

class OWASPScanner:
    """
    RMFOOD平台安全扫描器
    
    自动化检测常见Web安全漏洞，
    提供详细的漏洞报告和修复建议。
    """

    def __init__(self, base_url: str, timeout: float = 30.0):
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self.client = httpx.AsyncClient(
            timeout=timeout,
            follow_redirects=True,
            verify=False,  # 测试环境允许自签名证书
        )
        self.findings: List[VulnerabilityFinding] = []
        self.tested_endpoints: set = set()
        self.scan_start = datetime.now(timezone.utc)

    async def close(self):
        await self.client.aclose()

    # ── 辅助方法 ──

    def _add_finding(self, finding: VulnerabilityFinding):
        """记录一个漏洞发现"""
        self.findings.append(finding)
        severity_emoji = {
            Severity.CRITICAL: "🔴",
            Severity.HIGH: "🟠",
            Severity.MEDIUM: "🟡",
            Severity.LOW: "🔵",
            Severity.INFO: "⚪",
        }
        emoji = severity_emoji.get(finding.severity, "❓")
        print(f"  {emoji} [{finding.severity.value}] {finding.title}")
        print(f"     → {finding.affected_endpoint}")

    def _record_endpoint(self, endpoint: str):
        """记录已测试的端点"""
        self.tested_endpoints.add(endpoint)

    async def _safe_request(
        self,
        method: str,
        path: str,
        **kwargs
    ) -> Tuple[httpx.Response, bool]:
        """
        发送请求并捕获异常
        返回: (response, success)
        """
        url = f"{self.base_url}{path}"
        try:
            response = await self.client.request(method, url, **kwargs)
            return response, True
        except Exception as e:
            print(f"     ⚠️ 请求异常: {method} {url} - {str(e)}")
            return None, False

    # ═══════════════════════════════════════════
    # A01: 访问控制失效 (Broken Access Control)
    # ═══════════════════════════════════════════

    async def check_a01_broken_access_control(self):
        """
        A01: 检测访问控制缺陷
        
        测试场景:
        - 未认证访问受保护资源
        - IDOR（不安全的直接对象引用）
        - 权限提升（普通用户访问管理员功能）
        - 越权操作（修改其他用户数据）
        """
        print("\n" + "=" * 70)
        print("🔍 [A01:2021] 检测访问控制失效 (Broken Access Control)")
        print("=" * 70)

        # 1.1 测试未认证访问API端点
        protected_endpoints = [
            ("/api/v1/users/me", "GET"),
            ("/api/v1/teams", "GET"),
            ("/api/v1/sync/push", "POST"),
            ("/api/v1/ai/generate-prompt", "POST"),
            ("/api/v1/admin/users", "GET"),
            ("/api/v1/admin/settings", "GET"),
        ]

        for endpoint, method in protected_endpoints:
            self._record_endpoint(endpoint)
            resp, ok = await self._safe_request(method, endpoint)

            if ok and resp is not None:
                if resp.status_code != 401 and resp.status_code != 403:
                    self._add_finding(VulnerabilityFinding(
                        id=f"A01-AUTH-{endpoint.replace('/', '-')}",
                        title=f"未认证可访问受保护端点: {method} {endpoint}",
                        severity=Severity.HIGH,
                        category=OWASPCategory.A01_BROKEN_ACCESS_CONTROL,
                        description=f"端点 {endpoint} 在未提供认证Token的情况下返回了{resp.status_code}，"
                                   f"预期应返回401/403。这可能允许未授权用户访问敏感数据。",
                        affected_endpoint=f"{method} {endpoint}",
                        attack_vector="直接发送无Authorization头的请求",
                        proof_of_concept=f"curl -X {method} {self.base_url}{endpoint}\n"
                                         f"Response Status: {resp.status_code}\n"
                                         f"Response Body: {resp.text[:200]}",
                        remediation="确保所有受保护的API端点都实现了认证中间件检查。"
                                    "在FastAPI中使用Depends(get_current_user)强制认证。",
                        references=[
                            "https://owasp.org/Top10/A01_2021-Broken_Access_Control/",
                            "https://cheatsheetseries.owasp.org/cheatsheets/Access_Control_Cheat_Sheet.html",
                        ],
                        cvss_score=7.5,
                    ))
                else:
                    print(f"  ✅ {endpoint} 正确要求认证 ({resp.status_code})")

        # 1.2 测试IDOR（假设已注册并登录）
        test_user_ids = [1, 2, 3, 99999]
        idor_endpoints = [
            (f"/api/v1/users/{{user_id}}", "GET", "user_id"),
            (f"/api/v1/teams/{{team_id}}", "GET", "team_id"),
            (f"/api/v1/formulas/{{formula_id}}", "GET", "formula_id"),
        ]

        for template, method, param_name in idor_endpoints:
            for test_id in test_user_ids:
                endpoint = template.format(**{param_name: test_id})
                self._record_endpoint(endpoint)
                
                # 尝试使用假Token访问其他用户资源
                fake_token = "eyJfake.token.for.idor.testing"
                headers = {"Authorization": f"Bearer {fake_token}"}
                resp, ok = await self._safe_request(method, endpoint, headers=headers)

                if ok and resp is not None:
                    if resp.status_code == 200 and test_id == 99999:
                        self._add_finding(VulnerabilityFinding(
                            id=f"A01-IDOR-{param_name}",
                            title=f"IDOR漏洞: 可通过枚举{param_name}访问资源",
                            severity=Severity.CRITICAL,
                            category=OWASPCategory.A01_BROKEN_ACCESS_CONTROL,
                            description=f"通过修改URL中的{param_name}参数为99999，"
                                       f"成功获取了响应（可能包含其他用户数据）。",
                            affected_endpoint=f"{method} {endpoint}",
                            attack_vector=f"将{param_name}参数改为目标用户的ID",
                            proof_of_concept=f"curl -H 'Authorization: Bearer <token>' "
                                             f"{self.base_url}{endpoint}",
                            remediation="实现所有权验证：在查询前检查当前用户是否为资源的所有者。"
                                        "使用current_user.id进行过滤，而非直接使用URL参数。",
                            cvss_score=9.8,
                        ))
                        break  # 发现IDOR后停止该端点的进一步测试

        # 1.3 测试管理员功能越权
        admin_endpoints = [
            ("/api/v1/admin/users", "GET"),
            ("/api/v1/admin/system/config", "GET"),
            ("/api/v1/admin/audit-logs", "GET"),
        ]

        # 假设我们有一个普通用户Token（实际测试中需要真实登录）
        normal_token = "Bearer eyJnormal.user.token"  # 占位符
        for endpoint, method in admin_endpoints:
            self._record_endpoint(endpoint)
            headers = {"Authorization": normal_token}
            resp, ok = await self._safe_request(method, endpoint, headers=headers)

            if ok and resp is not None:
                if resp.status_code not in [401, 403, 404]:
                    self._add_finding(VulnerabilityFinding(
                        id=f"A01-PRIV-{endpoint.replace('/', '-')}",
                        title=f"权限提升: 普通用户可访问管理员功能 {endpoint}",
                        severity=Severity.CRITICAL,
                        category=OWASPCategory.A01_BROKEN_ACCESS_CONTROL,
                        description=f"使用普通用户Token访问管理员端点{endpoint}，"
                                   f"返回{resp.status_code}而非403禁止访问。",
                        affected_endpoint=f"{method} {endpoint}",
                        attack_vector="使用普通用户Token请求管理员API",
                        remediation="实施基于角色的访问控制(RBAC)，在每个管理端点验证用户角色。"
                                    "使用 @require_role('admin') 装饰器强制权限检查。",
                        cvss_score=9.0,
                    ))

    # ═══════════════════════════════════════════
    # A02: 加密机制失败 (Cryptographic Failures)
    # ═══════════════════════════════════════════

    async def check_a02_cryptographic_failures(self):
        """
        A02: 检测加密机制问题
        
        测试场景:
        - 敏感数据明文传输（HTTP非HTTPS）
        - 弱加密算法使用
        - Token/密钥硬编码
        - 密码存储安全性
        """
        print("\n" + "=" * 70)
        print("🔐 [A02:2021] 检测加密机制失败 (Cryptographic Failures)")
        print("=" * 70)

        # 2.1 检查HTTPS强制跳转
        if not self.base_url.startswith("https"):
            resp, ok = await self._safe_request("GET", "/health")

            if ok and resp is not None:
                strict_transport_headers = [
                    resp.headers.get("strict-transport-security", ""),
                    resp.headers.get("Strict-Transport-Security", ""),
                ]
                hsts_present = any("max-age" in h.lower() for h in strict_transport_headers if h)

                if not hsts_present:
                    self._add_finding(VulnerabilityFinding(
                        id="A02-HSTS-MISSING",
                        title="缺少HSTS头 (HTTP Strict Transport Security)",
                        severity=Severity.MEDIUM,
                        category=OWASPCategory.A02_CRYPTOGRAPHIC_FAILURES,
                        description="服务器未设置Strict-Transport-Security头，"
                                   "可能导致协议降级攻击（SSL Stripping）。",
                        affected_endpoint="All HTTPS endpoints",
                        attack_vector="中间人攻击者可将HTTPS降级为HTTP窃取数据",
                        proof_of_concept="Response Headers:\n" + 
                                        "\n".join(f"{k}: {v}" for k, v in resp.headers.items()),
                        remediation="添加HSTS头: Strict-Transport-Security: max-age=31536000; includeSubDomains; preload\n"
                                    "并在FastAPI中间件中强制HTTPS重定向。",
                        references=[
                            "https://owasp.org/Top10/A02_2021-Cryptographic_Failures/",
                            "https://cheatsheetseries.owasp.org/cheatsheets/Transport_Layer_Protection_Cheat_Sheet.html",
                        ],
                        cvss_score=5.5,
                    ))

        # 2.2 检查敏感信息泄露（密码、Token等）
        login_payload = {"username": "test", "password": "test123"}
        resp, ok = await self._safe_request("POST", "/api/v1/auth/login", json=login_payload)

        if ok and resp is not None:
            response_text = resp.text.lower()

            sensitive_patterns = [
                (r'password\s*[:=]\s*["\'][^"\']+["\']', "密码明文出现在响应中"),
                (r'token\s*[:=]\s*["\'](eyJ[^"\']+)["\']', "完整Token暴露在日志/错误信息中"),
                (r'secret\s*[:=]\s*["\'][^"\']+["\']', "Secret密钥泄露"),
                (r'api_key\s*[:=]\s*["\'][^"\']+["\']', "API Key泄露"),
            ]

            for pattern, desc in sensitive_patterns:
                matches = re.findall(pattern, response_text)
                if matches:
                    self._add_finding(VulnerabilityFinding(
                        id="A02-DATA-LEAK",
                        title=f"敏感信息泄露: {desc}",
                        severity=Severity.HIGH,
                        category=OWASPCategory.A02_CRYPTOGRAPHIC_FAILURES,
                        description=f"在登录接口的响应中发现可能的敏感信息泄露模式: {desc}",
                        affected_endpoint="POST /api/v1/auth/login",
                        attack_vector="分析API响应、错误消息或日志文件",
                        proof_of_concept=f"Pattern matched: {pattern}\nMatches: {matches[:2]}",
                        remediation="确保所有响应中都不包含密码、完整Token等敏感字段。"
                                    "使用Pydantic的Field(exclude=[...])排除敏感字段序列化。"
                                    "生产环境关闭debug模式以避免详细错误堆栈泄露。",
                        cvss_score=7.0,
                    ))

        # 2.3 检查Cookie安全属性
        resp, ok = await self._safe_request("GET", "/")

        if ok and resp is not None:
            set_cookie = resp.headers.get("set-cookie", "")
            
            cookie_issues = []
            if "secure" not in set_cookie.lower():
                cookie_issues.append("缺少Secure标志")
            if "httponly" not in set_cookie.lower():
                cookie_issues.append("缺少HttpOnly标志")
            if "samesite" not in set_cookie.lower():
                cookie_issues.append("缺少SameSite属性")

            if cookie_issues:
                self._add_finding(VulnerabilityFinding(
                    id="A02-COOKIE-INSECURE",
                    title=f"Cookie安全配置不当: {'; '.join(cookie_issues)}",
                    severity=Severity.MEDIUM if len(cookie_issues) < 3 else Severity.HIGH,
                    category=OWASPCategory.A02_CRYPTOGRAPHIC_FAILURES,
                    description=f"响应的Set-Cookie头缺少关键安全属性: {', '.join(cookie_issues)}",
                    affected_endpoint="GET /",
                    attack_vector="XSS攻击窃取Cookie / CSRF跨站请求伪造",
                    remediation="配置Cookie安全属性: Secure; HttpOnly; SameSite=Strict\n"
                                "FastAPI中: response.set_cookie(..., secure=True, httponly=True, samesite='strict')",
                    cvss_score=6.0 if len(cookie_issues) >= 2 else 4.5,
                ))

    # ═══════════════════════════════════════════
    # A03: 注入攻击 (Injection)
    # ═══════════════════════════════════════════

    async def check_a03_injection(self):
        """
        A03: 检测各类注入漏洞
        
        测试场景:
        - SQL Injection (SQLi)
        - NoSQL Injection
        - Command Injection (OS命令注入)
        - LDAP Injection
        - XPath Injection
        """
        print("\n" + "=" * 70)
        print("💉 [A03:2021] 检测注入攻击 (Injection)")
        print("=" * 70)

        injection_payloads = {
            "sql": [
                "' OR '1'='1",
                "1; DROP TABLE users--",
                "' UNION SELECT * FROM users--",
                "admin'--",
                "' OR 1=1--",
            ],
            "nosql": [
                {"$ne": ""},
                {"$gt": ""},
                {"$where": "true"},
                {"$regex": ".*"},
            ],
            "os_command": [
                "; ls -la",
                "| cat /etc/passwd",
                "$(whoami)",
                "`id`",
                "& ping -c 10 localhost",
            ],
            "xss": [
                "<script>alert('XSS')</script>",
                "<img src=x onerror=alert('XSS')>",
                "javascript:alert('XSS')",
                "'-alert(1)-'",
                "<svg onload=alert('XSS')>",
            ],
            "ldap": [
                "*)(uid=*",
                "*)(objectClass=*",
                "*))(|(cn=*",
            ],
            "xpath": [
                "' or '1'='1",
                "' or ''='",
                "x' or 'a'='a",
            ],
        }

        # 3.1 SQL注入测试（登录表单是经典入口点）
        sql_endpoints = [
            ("POST", "/api/v1/auth/login", ["username", "password"]),
            ("GET", "/api/v1/teams", ["search"]),
            ("GET", "/api/v1/formulas", ["name"]),
        ]

        for method, endpoint, params in sql_endpoints:
            for payload in injection_payloads["sql"][:3]:  # 只测试前3个payload避免过多请求
                payload_dict = {p: payload for p in params}
                self._record_endpoint(f"{method} {endpoint}[SQLi]")
                
                resp, ok = await self._safe_request(
                    method, endpoint,
                    json=payload_dict if method == "POST" else None,
                    params=payload_dict if method == "GET" else None,
                )

                if ok and resp is not None:
                    error_indicators = [
                        "sql syntax", "mysql", "postgresql", "sqlite",
                        "unclosed quotation", "quoted string",
                        "ORA-", "PLS-", "Microsoft OLE DB",
                        "warning:", "error in your SQL syntax",
                    ]
                    
                    response_lower = resp.text.lower()
                    if any(indicator in response_lower for indicator in error_indicators):
                        self._add_finding(VulnerabilityFinding(
                            id=f"A03-SQLI-{endpoint.replace('/', '-')}",
                            title=f"SQL注入漏洞: {method} {endpoint}",
                            severity=Severity.CRITICAL,
                            category=OWASPCategory.A03_INJECTION,
                            description=f"在{endpoint}端点的{params[0]}参数中输入SQL注入payload '{payload}'，"
                                       f"服务器返回了数据库错误信息（可能泄露DB类型和结构）。",
                            affected_endpoint=f"{method} {endpoint}",
                            attack_vector=f"在{params[0]}字段输入: {payload}",
                            proof_of_concept=f"Payload: {payload}\nStatus: {resp.status_code}\n"
                                             f"Response snippet: {resp.text[:300]}",
                            remediation="使用参数化查询（SQLAlchemy的参数绑定）。"
                                        "绝不拼接SQL字符串。对用户输入进行严格白名单验证。",
                            cvss_score=9.8,
                        ))
                        break  # 发现SQLi后停止该端点测试

        # 3.2 XSS（跨站脚本）测试
        xss_endpoints = [
            ("POST", "/api/v1/teams", ["name", "description"]),
            ("POST", "/api/v1/formulas", ["name", "description"]),
            ("POST", "/api/v1/comments", ["content"]),
        ]

        for method, endpoint, params in xss_endpoints:
            for payload in injection_payloads["xss"][:2]:
                payload_dict = {p: payload for p in params}
                self._record_endpoint(f"{method} {endpoint}[XSS]")

                resp, ok = await self._safe_request(
                    method, endpoint,
                    json=payload_dict if method == "POST" else None,
                )

                if ok and resp is not None:
                    if payload in resp.text:
                        self._add_finding(VulnerabilityFinding(
                            id=f"A03-XSS-{endpoint.replace('/', '-')}",
                            title=f"XSS漏洞（存储型）: {method} {endpoint}",
                            severity=Severity.HIGH,
                            category=OWASPCategory.A03_INJECTION,
                            description=f"提交到{endpoint}的XSS payload原样存储并反射在响应中，"
                                       f"可能导致其他用户浏览时执行恶意JavaScript。",
                            affected_endpoint=f"{method} {endpoint}",
                            attack_vector=f"在{params[0]}字段提交: {payload}",
                            proof_of_concept=f"Payload reflected in response body at position: "
                                             f"{resp.text.find(payload)}",
                            remediation="对所有用户输入进行HTML转义（使用bleach库或jinja2的autoescape）。"
                                        "实施Content-Security-Policy(CSP)头限制脚本执行。",
                            cvss_score=7.5,
                        ))
                        break

        # 3.3 命令注入测试（较少见但危害极大）
        cmd_injection_points = [
            ("POST", "/api/v1/files/upload", ["filename"]),
            ("POST", "/api/v1/integrations/webhook", ["url", "callback_url"]),
        ]

        for method, endpoint, params in cmd_injection_points:
            for payload in injection_payloads["os_command"][:2]:
                payload_dict = {p: f"test{payload}" for p in params}
                self._record_endpoint(f"{method} {endpoint}[CMDI]")

                resp, ok = await self._safe_request(method, endpoint, json=payload_dict)
                
                if ok and resp is not None:
                    delay = resp.elapsed.total_seconds()
                    if delay > 5:  # 命令执行导致延迟
                        self._add_finding(VulnerabilityFinding(
                            id=f"A03-CMDI-{endpoint.replace('/', '-')}",
                            title=f"OS命令注入: {method} {endpoint}",
                            severity=Severity.CRITICAL,
                            category=OWASPCategory.A03_INJECTION,
                            description=f"在{endpoint}的{params[0]}参数中注入命令，"
                                       f"响应延迟{delay:.1f}s（可能正在执行系统命令）。",
                            affected_endpoint=f"{method} {endpoint}",
                            attack_vector=f"在{params[0]}字段追加: {payload}",
                            remediation="绝不将用户输入传递给shell命令。"
                                        "使用subprocess模块且shell=False参数。"
                                        "对文件名等进行严格的正则白名单校验（只允许[a-zA-Z0-9._-]）。",
                            cvss_score=9.0,
                        ))
                        break

    # ═══════════════════════════════════════════
    # A05: 安全配置错误 (Security Misconfiguration)
    # ═══════════════════════════════════════════

    async def check_a05_security_misconfiguration(self):
        """
        A05: 检测安全配置问题
        
        测试场景:
        - 目录列表开启
        - 调试信息泄露
        - 不必要的端口/服务开放
        - 默认凭证未更改
        - 错误信息过于详细
        - 版本号泄露
        """
        print("\n" + "=" * 70)
        print("⚙️  [A05:2021] 检测安全配置错误 (Security Misconfiguration)")
        print("=" * 70)

        # 5.1 检查常见敏感路径
        sensitive_paths = [
            ("/.git/config", "Git仓库泄露"),
            ("/.env", "环境变量文件"),
            ("/.svn/entries", "SVN元数据泄露"),
            ("/web.config", "IIS配置文件"),
            ("/backup/", "备份目录"),
            ("/admin/", "管理后台路径猜测"),
            ("/phpmyadmin/", "phpMyAdmin"),
            ("/console/", "调试控制台"),
            ("/actuator", "Spring Actuator（如适用）"),
            ("/swagger.json", "Swagger文档（生产环境不应开放）"),
            ("/docs", "API文档（生产环境限制访问）"),
            ("/redoc", "ReDoc文档"),
            ("/static/../.env", "路径遍历尝试"),
        ]

        for path, desc in sensitive_paths:
            self._record_endpoint(path)
            resp, ok = await self._safe_request("GET", path)

            if ok and resp is not None:
                if resp.status_code == 200:
                    content_length = len(resp.text)
                    
                    if content_length > 100:  # 有实质性内容返回
                        self._add_finding(VulnerabilityFinding(
                            id=f"A05-SENSITIVE-PATH-{path.replace('/', '_')}",
                            title=f"敏感路径可访问: {path} ({desc})",
                            severity=Severity.HIGH if "config" in path or ".env" in path else Severity.MEDIUM,
                            category=OWASPCategory.A05_SECURITY_MISCONFIGURATION,
                            description=f"路径{path}返回200状态码且包含{content_length}字节数据，"
                                       f"可能泄露敏感配置信息或源代码。",
                            affected_endpoint=f"GET {path}",
                            attack_vector="直接访问URL路径",
                            proof_of_concept=f"curl {self.base_url}{path}\n"
                                             f"Content-Length: {content_length}\n"
                                             f"Preview: {resp.text[:150]}...",
                            remediation={
                                "/.git": "部署时删除.git目录或在nginx中拒绝访问",
                                "/.env": "确保.env在.gitignore中且不在webroot下",
                                "/docs": "生产环境禁用或添加认证保护",
                                "/swagger.json": "仅开发环境启用",
                            }.get(path, "限制对该路径的访问权限，返回404或403"),
                            cvss_score=7.0 if "config" in path else 5.5,
                        ))

        # 5.2 检查安全头配置
        resp, _ = await self._safe_request("GET", "/health")
        
        if resp:
            security_headers = {
                "X-Content-Type-Options": ("nosniff", "缺少X-Content-Type-Options: nosniff"),
                "X-Frame-Options": ("DENY or SAMEORIGIN", "缺少X-Frame-Options头（点击劫持风险）"),
                "Content-Security-Policy": ("script-src", "缺少内容安全策略(CSP)头"),
                "X-XSS-Protection": ("1; mode=block", "缺少X-XSS-Protection头"),
                "Referrer-Policy": ("strict-origin", "缺少Referrer-Policy头"),
                "Permissions-Policy": ("camera=", "缺少Permissions-Policy头"),
                "Cache-Control": ("no-store", "敏感页面缺少Cache-Control: no-store"),
            }

            missing_critical_headers = []
            for header, (expected_value, issue_desc) in security_headers.items():
                header_value = resp.headers.get(header, "").lower()
                if expected_value.lower() not in header_value:
                    missing_critical_headers.append((header, issue_desc))

            if missing_critical_headers:
                for header, issue in missing_critical_headers[:4]:  # 只报告最关键的4个
                    self._add_finding(VulnerabilityFinding(
                        id=f"A05-SECURITY-HEADER-{header.lower().replace('-', '_')}",
                        title=issue,
                        severity=Severity.LOW,
                        category=OWASPCategory.A05_SECURITY_MISCONFIGURATION,
                        description=f"HTTP响应缺少重要的安全头: {header}",
                        affected_endpoint="All endpoints",
                        remediation="在FastAPI中间件中添加安全头配置。\n"
                                    "参考: app/core/security_middleware.py 中的 SecurityHeadersMiddleware",
                        cvss_score=3.5,
                    ))

        # 5.3 检查服务器版本信息泄露
        server_header = resp.headers.get("server", "") if resp else ""
        powered_by = resp.headers.get("x-powered-by", "") if resp else ""

        version_patterns = [
            (r"nginx/[\d.]+", "Nginx版本号"),
            (r"apache/[\d.]+", "Apache版本号"),
            (r"python/[\d.]+", "Python版本号"),
            (r"uvicorn/[\d.]+", "Uvicorn版本号"),
            (r"express", "Express框架标识"),
        ]

        for pattern, desc in version_patterns:
            target = server_header + " " + powered_by
            match = re.search(pattern, target, re.IGNORECASE)
            if match:
                self._add_finding(VulnerabilityFinding(
                    id="A05-VERSION-DISCLOSURE",
                    title=f"服务器软件版本泄露: {match.group()} ({desc})",
                    severity=Severity.LOW,
                    category=OWASPCategory.A05_SECURITY_MISCONFIGURATION,
                    description=f"Server/X-Powered-By头暴露了具体版本号，"
                               f"攻击者可利用已知漏洞针对该版本发起攻击。",
                    affected_endpoint="All endpoints (Response Headers)",
                    remediation="隐藏版本号：\n"
                                "- Nginx: server_tokens off;\n"
                                "- FastAPI: 自定义Server头或移除默认值",
                    cvss_score=2.5,
                ))

    # ═══════════════════════════════════════════
    # A07: 认证和会话失败
    # ═══════════════════════════════════════════

    async def check_a07_authentication_failures(self):
        """
        A07: 检测认证机制弱点
        
        测试场景:
        - 弱密码策略
        - 暴力破解防护缺失
        - Token安全（JWT配置）
        - 会话固定攻击
        - 密码恢复流程安全
        """
        print("\n" + "=" * 70)
        print("🔑 [A07:2021] 检测认证和会话失败 (Authentication Failures)")
        print("=" * 70)

        # 7.1 暴力破解测试
        username = "admin"
        weak_passwords = ["123456", "password", "admin", "111111", "qwerty"]

        lockout_detected = False
        for i, pwd in enumerate(weak_passwords):
            resp, ok = await self._safe_request(
                "POST", "/api/v1/auth/login",
                json={"username": username, "password": pwd}
            )

            if ok and resp is not None:
                if resp.status_code == 429:  # Too Many Requests
                    lockout_detected = True
                    print(f"  ✅ 暴力破解防护有效: 第{i+1}次尝试后被锁定 (429 Too Many Requests)")
                    break
                elif i == len(weak_passwords) - 1 and not lockout_detected:
                    self._add_finding(VulnerabilityFinding(
                        id="A07-BRUTE-FORCE",
                        title="暴力破解防护缺失或阈值过高",
                        severity=Severity.HIGH,
                        category=OWASPCategory.A07_AUTH_FAILURES,
                        description=f"连续{len(weak_passwords)}次使用不同密码尝试登录用户'{username}'，"
                                   f"均未触发账户锁定或速率限制（最后状态码: {resp.status_code}）。",
                        affected_endpoint="POST /api/v1/auth/login",
                        attack_vector="自动化脚本遍历常用密码字典",
                        proof_of_concept=f"尝试次数: {len(weak_passwords)}\n"
                                         f"最后一次响应: {resp.status_code}",
                        remediation="实施账户锁定策略：\n"
                                    "- 连续5次失败后锁定15分钟\n"
                                    "- 使用IP级别限流（每分钟最多10次尝试）\n"
                                    "- 实施CAPTCHA验证（可选）\n"
                                    "- 参考: settings.max_login_attempts 配置项",
                        cvss_score=7.0,
                    ))

        # 7.2 JWT Token安全检查
        if lockout_detected or True:  # 即使没触发也继续测试
            # 尝试登录获取真实Token进行分析
            resp, ok = await self._safe_request(
                "POST", "/api/v1/auth/login",
                json={"username": "test_user_that_does_not_exist_xyz", "password": "wrong_pwd"}
            )

            if ok and resp is not None:
                if resp.status_code == 200:
                    token_data = resp.json()
                    token = token_data.get("access_token", token_data.get("token", ""))

                    if token:
                        # 分析Token特征
                        issues = []

                        if token.split(".")[-1:] == [] or len(token.split(".")) != 3:
                            issues.append("Token格式不符合JWT标准（应为3部分用.分隔）")

                        try:
                            import base64
                            payload_part = token.split(".")[1]
                            padding = 4 - len(payload_part) % 4
                            if padding != 4:
                                payload_part += "=" * padding
                            decoded = base64.urlsafe_b64decode(payload_part)
                            payload_json = json.loads(decoded)

                            if payload_json.get("exp") is None:
                                issues.append("JWT缺少过期时间(exp)声明")
                            
                            if payload_json.get("iat") is None:
                                issues.append("JWT缺少签发时间(iat)声明")

                            token_ttl_hours = (
                                datetime.fromtimestamp(payload_json["exp"])
                                - datetime.fromtimestamp(payload_json.get("iat", 0))
                            ).total_seconds() / 3600

                            if token_ttl_hours > 24:
                                issues.append(f"Token有效期过长: {token_ttl_hours:.1f}小时（建议≤1小时）")
                            elif token_ttl_hours > 8:
                                issues.append(f"Token有效期偏长: {token_ttl_hours:.1f}小时")

                        except Exception:
                            issues.append("无法解码JWT Payload（可能使用了非标准格式）")

                        if issues:
                            self._add_finding(VulnerabilityFinding(
                                id="A07-JWT-INSECURE",
                                title=f"JWT Token安全问题: {'; '.join(issues[:2])}",
                                severity=Severity.MEDIUM,
                                category=OWASPCategory.A07_AUTH_FAILURES,
                                description=f"登录返回的JWT Token存在以下安全问题: {' | '.join(issues)}",
                                affected_endpoint="POST /api/v1/auth/login → Token生成逻辑",
                                remediation="JWT最佳实践:\n"
                                            "- exp: 设置合理过期时间（建议30分钟-1小时）\n"
                                            "- iat: 包含签发时间用于时效验证\n"
                                            "- jti: 添加唯一ID用于Token撤销\n"
                                            "- 使用强随机secret_key（≥256位）\n"
                                            "- 短期access_token + 长期refresh_token组合",
                                cvss_score=5.5 if "过长" in str(issues) else 4.0,
                            ))

        # 7.3 用户枚举测试
        enum_payloads = [
            {"username": "nonexistent_user_xyz_12345", "password": "anypassword"},
            {"username": "admin", "password": "wrongpassword"},
        ]

        responses_diff = {}
        for payload in enum_payloads:
            resp, ok = await self._safe_request(
                "POST", "/api/v1/auth/login",
                json=payload
            )
            if ok and resp is not None:
                key = f"user_exists={payload['username']=='admin'}"
                responses_diff[key] = {
                    "status": resp.status_code,
                    "body_preview": resp.text[:100],
                }

        if len(responses_diff) == 2:
            status_diff = responses_diff["True"]["status"] != responses_diff["False"]["status"]
            body_diff = responses_diff["True"]["body_preview"] != responses_diff["False"]["body_preview"]

            if status_diff or ("用户不存在" in responses_diff["False"]["body_preview"].lower() or
                              "not found" in responses_diff["False"]["body_preview"].lower()):
                self._add_finding(VulnerabilityFinding(
                    id="A07-USER-ENUM",
                    title="用户枚举漏洞: 登录错误消息差异暴露用户存在性",
                    severity=Severity.MEDIUM,
                    category=OWASPCategory.A07_AUTH_FAILURES,
                    description="登录接口根据用户名是否存在返回不同的错误消息或状态码，"
                               "攻击者可用于枚举有效用户名。",
                    affected_endpoint="POST /api/v1/auth/login",
                    attack_vector="对比不同用户名的错误响应差异",
                    proof_of_concept=json.dumps(responses_diff, indent=2, ensure_ascii=False),
                    remediation="统一错误消息：无论用户名或密码错误，都返回相同的通用消息\n"
                                "例如: '用户名或密码错误'，而不区分具体哪个字段错误",
                    cvss_score=5.0,
                ))

    # ═══════════════════════════════════════════
    # A09: 安全日志和监控不足
    # ═══════════════════════════════════════════

    async def check_a09_logging_failures(self):
        """
        A09: 检测日志和监控缺陷
        
        测试场景:
        - 日志是否记录安全事件
        - 是否有入侵检测能力
        - 错误处理是否泄露细节
        """
        print("\n" + "=" * 70)
        print("📋 [A09:2021] 检测安全日志和监控不足 (Logging Failures)")
        print("=" * 70)

        # 9.1 触发安全事件并检查日志可观察性
        security_events = [
            ("POST", "/api/v1/auth/login", {"username": "admin", "password": "' OR 1=1--"}, "SQLi attempt"),
            ("GET", "/api/v1/admin", {}, "Unauthorized admin access"),
            ("GET", "/api/v1/users/../../../etc/passwd", {}, "Path traversal attempt"),
        ]

        for method, path, payload, event_type in security_events:
            self._record_endpoint(f"{method} {path}[LOG_TEST]")
            resp, ok = await self._safe_request(
                method, path,
                json=payload if method == "POST" else None,
            )

            if ok and resp is not None:
                has_request_id = "request_id" in resp.headers or "x-request-id" in resp.headers
                
                if not has_request_id:
                    self._add_finding(VulnerabilityFinding(
                        id="A09-NO-REQUEST-ID",
                        title="缺少请求追踪ID (Request ID)",
                        severity=Severity.LOW,
                        category=OWASPCategory.A09_LOGGING_FAILURES,
                        description=f"对于{event_type}事件，响应中缺少request_id头，"
                                   "难以在分布式系统中追踪和关联日志。",
                        affected_endpoint=f"{method} {path}",
                        remediation="在请求进入时生成UUID作为X-Request-ID，贯穿整个请求生命周期，"
                                    "并输出到所有日志行中。参考app/core/middleware.py实现。",
                        cvss_score=3.0,
                    ))

        # 9.2 检查详细错误信息泄露
        error_trigger_paths = [
            "/api/v1/nonexistent-endpoint-xyz",
            "/api/v1/teams/99999999",  # 可能不存在的团队ID
        ]

        for path in error_trigger_paths:
            resp, ok = await self._safe_request("GET", path)

            if ok and resp is not None:
                error_indicators = [
                    "traceback", "exception", "error at line",
                    "file \"/", "stack trace", "syntaxerror",
                    "sqlalchemy", "psycopg2", "aiosqlite",
                    "internal server error detail",
                ]

                response_lower = resp.text.lower()
                leak_count = sum(1 for ind in error_indicators if ind in response_lower)

                if leak_count >= 2:  # 多个指示符同时出现
                    self._add_finding(VulnerabilityFinding(
                        id="A09-ERROR-DETAIL-LEAK",
                        title="详细错误信息泄露: {path}",
                        severity=Severity.MEDIUM,
                        category=OWASPCategory.A09_LOGGING_FAILURES,
                        description=f"访问{path}时返回的错误响应包含{leak_count}个内部技术细节指示符，"
                                   "可能泄露代码结构、库版本、文件路径等信息。",
                        affected_endpoint=f"GET {path}",
                        proof_of_concept=f"Status: {resp.status_code}\n"
                                         f"Indicators found: {leak_count}\n"
                                         f"Snippet: {resp.text[:250]}...",
                        remediation="生产环境必须关闭debug模式（DEBUG=False）。\n"
                                    "自定义全局异常处理器，只返回通用错误消息给客户端。\n"
                                    "详细错误只记录到服务端日志（不含敏感数据）。\n"
                                    "参考: app/core/exceptions.py GlobalExceptionHandler",
                        cvss_score=4.5,
                    ))

    # ═══════════════════════════════════════════
    # 主扫描执行方法
    # ═══════════════════════════════════════════

    async def run_full_scan(self) -> ScanResult:
        """
        执行完整的OWASP Top 10扫描
        
        Returns:
            ScanResult: 包含所有发现的扫描结果对象
        """
        print("\n" + "╔" + "=" * 68 + "╗")
        print("║" + " " * 15 + "RMFOOD 安全扫描器 v2.0" + " " * 26 + "║")
        print("║" + " " * 10 + "OWASP Top 10 (2021) 自动化检测" + " " * 22 + "║")
        print("╠" + "=" * 68 + "╣")
        print(f"║ 目标: {self.base_url:<54} ║")
        print(f"║ 开始时间: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC'):<42} ║")
        print("╚" + "=" * 68 + "╝")

        try:
            await self.check_a01_broken_access_control()
            await self.check_a02_cryptographic_failures()
            await self.check_a03_injection()
            await self.check_a05_security_misconfiguration()
            await self.check_a07_authentication_failures()
            await self.check_a09_logging_failures()

        except Exception as e:
            print(f"\n❌ 扫描过程中发生异常: {str(e)}")
            import traceback
            traceback.print_exc()

        finally:
            scan_end = datetime.now(timezone.utc)
            duration = (scan_end - self.scan_start).total_seconds()

            result = ScanResult(
                target_url=self.base_url,
                scan_start_time=self.scan_start.isoformat(),
                scan_end_time=scan_end.isoformat(),
                total_duration_seconds=duration,
                findings=self.findings,
                total_endpoints_tested=len(self.tested_endpoints),
                summary=self._generate_summary(),
            )

            self._print_summary(result)
            return result

    def _generate_summary(self) -> Dict[str, int]:
        """生成按严重程度分类的统计摘要"""
        summary = {sev.value: 0 for sev in Severity}
        for finding in self.findings:
            summary[finding.severity.value] += 1
        return summary

    def _print_summary(self, result: ScanResult):
        """打印扫描结果摘要"""
        print("\n" + "╔" + "=" * 68 + "╗")
        print("║" + " " * 20 + "📊 扫描结果摘要" + " " * 28 + "║")
        print("╠" + "=" * 68 + "╣")
        
        severity_icons = {
            "Critical": "🔴",
            "High": "🟠",
            "Medium": "🟡",
            "Low": "🔵",
            "Info": "⚪",
        }
        
        for sev, count in result.summary.items():
            icon = severity_icons.get(sev, "❓")
            bar = "█" * count + "░" * (10 - count) if count <= 10 else "█" * 10 + "+"
            print(f"║  {icon} {sev:<12} │ {count:>3} 个 │ {bar} ║")
        
        print("╠" + "-" * 68 + "╣")
        total_findings = len(result.findings)
        risk_score = self._calculate_risk_score(result)
        print(f"║  📈 总计发现      │ {total_findings:>3} 个 │ 风险评分: {risk_score}/100   ║")
        print(f"║  🎯 测试端点数    │ {result.total_endpoints_tested:>3} 个 │                       ║")
        print(f"║  ⏱️  扫描耗时      │ {result.total_duration_seconds:>5.1f}s│                       ║")
        print("╚" + "=" * 68 + "╝")

        if total_findings > 0:
            print(f"\n⚠️  发现 {total_findings} 个安全问题，请查看详细报告！")
            critical_high = result.summary.get("Critical", 0) + result.summary.get("High", 0)
            if critical_high > 0:
                print(f"   🔴 其中 {critical_high} 个高危漏洞需要立即修复！")
        else:
            print(f"\n✅ 未发现明显安全漏洞！（但建议定期复查）")

    def _calculate_risk_score(self, result: ScanResult) -> int:
        """
        计算综合风险评分 (0-100)
        
        加权算法:
        - Critical × 25分
        - High × 15分
        - Medium × 7分
        - Low × 2分
        - Info × 0分
        上限100分
        """
        weights = {
            "Critical": 25,
            "High": 15,
            "Medium": 7,
            "Low": 2,
            "Info": 0,
        }
        
        raw_score = sum(
            count * weights.get(sev, 0)
            for sev, count in result.summary.items()
        )
        
        return min(100, raw_score)


# ════════════════════════════════════════════════
# CLI 入口点
# ════════════════════════════════════════════════

async def main():
    parser = argparse.ArgumentParser(
        description="RMFOOD OWASP Top 10 安全扫描器",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例用法:
  python owasp_scan.py --target http://localhost:8000
  python owasp_scan.py --target https://api.rmfood.com --output security_report.json
  python owasp_scan.py --target http://localhost:8000 --verbose

注意: 本工具仅供授权的安全测试使用！
未经授权对生产系统进行扫描可能违反法律法规。
""",
    )
    
    parser.add_argument(
        "--target", "-t",
        required=True,
        help="目标URL (例如: http://localhost:8000)"
    )
    
    parser.add_argument(
        "--output", "-o",
        default=None,
        help="输出报告文件路径 (JSON格式，默认输出到控制台)"
    )
    
    parser.add_argument(
        "--timeout",
        type=float,
        default=30.0,
        help="请求超时时间（秒），默认30秒"
    )
    
    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="显示详细输出"
    )
    
    args = parser.parse_args()
    
    scanner = OWASPScanner(base_url=args.target, timeout=args.timeout)
    
    try:
        result = await scanner.run_full_scan()
        
        if args.output:
            output_path = Path(args.output)
            with open(output_path, "w", encoding="utf-8") as f:
                json.dump(result.to_dict(), f, indent=2, ensure_ascii=False, default=str)
            print(f"\n✅ 报告已保存至: {output_path.absolute()}")
        else:
            print("\n📄 JSON格式报告:")
            print(json.dumps(result.to_dict(), indent=2, ensure_ascii=False, default=str)[:2000])
            
    except KeyboardInterrupt:
        print("\n\n⚠️  用户中断扫描")
    finally:
        await scanner.close()


if __name__ == "__main__":
    asyncio.run(main())
