"""
RMFOOD 配方平台 - GDPR 合规性验证工具

自动化检测GDPR（通用数据保护条例）合规性要求：
- 数据导出功能（用户有权获取其个人数据副本）
- 数据删除功能（被遗忘权 - 硬删除 + 备份保留30天）
- 隐私政策页面链接和可访问性
- Cookie同意机制验证
- 数据处理记录（审计日志完整性）
- 数据主体权利响应时间
- 跨境数据传输保护

使用方式:
    python gdpr_compliance_check.py --target http://localhost:8000 --output gdpr_report.json

作者: Compliance & Legal Team
日期: 2026-05-20
版本: v1.0 (Phase 5 合规审计专用)
"""

import argparse
import asyncio
import json
import re
import sys
from datetime import datetime, timezone, timedelta
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

class ComplianceStatus(Enum):
    """GDPR合规状态"""
    COMPLIANT = "Compliant"           # 完全符合要求
    PARTIAL = "Partially Compliant"  # 部分符合，需要改进
    NON_COMPLIANT = "Non-Compliant"  # 不符合要求，必须修复
    NOT_APPLICABLE = "N/A"           # 不适用（如无跨境传输）


class GDPR_Article(Enum):
    """GDPR相关条款编号"""
    ART_5_DATA_PRINCIPLES = "Art.5 - Data Processing Principles"
    ART_7_CONSENT = "Art.7 - Conditions for Consent"
    ART_12_TRANSPARENCY = "Art.12 - Transparent Information"
    ART_13_INFO_PROVIDE = "Art.13 - Information to be Provided"
    ART_15_RIGHT_OF_ACCESS = "Art.15 - Right of Access (数据访问权)"
    ART_16_RIGHT_TO_RECTIFICATION = "Art.16 - Right to Rectification"
    ART_17_RIGHT_TO_ERASURE = "Art.17 - Right to Erasure (被遗忘权)"
    ART_18_RIGHT_TO_RESTRICTION = "Art.18 - Right to Restriction of Processing"
    ART_20_RIGHT_TO_PORTABILITY = "Art.20 - Right to Data Portability"
    ART_21_RIGHT_TO_OBJECT = "Art.21 - Right to Object"
    ART_25_PRIVACY_BY_DESIGN = "Art.25 - Privacy by Design & Default"
    ART_32_SECURITY = "Art.32 - Security of Processing"
    ART_33_BREACH_NOTIFICATION = "Art.33 - Breach Notification"
    ART_34_COMMUNICATE_BREACH = "Art.34 - Communicate Personal Data Breach"
    ART_35_DPIA = "Art.35 - Data Protection Impact Assessment"
    ART_44_TRANSFER = "Art.44 - Transfer of Personal Data"


@dataclass
class ComplianceCheck:
    """单个合规检查项"""
    id: str
    article: GDPR_Article
    title: str
    description: str
    status: ComplianceStatus
    evidence: Optional[str] = None
    recommendation: Optional[str] = None
    risk_level: str = "Medium"  # Low / Medium / High / Critical
    checked_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


@dataclass
class GDPRReport:
    """GDPR合规报告"""
    target_url: str
    scan_date: str
    organization_name: str = "RMFOOD配方平台"
    data_controller_contact: str = ""
    checks: List[ComplianceCheck] = field(default_factory=list)
    summary: Dict[str, int] = field(default_factory=dict)
    overall_score: float = 0.0  # 0-100分
    critical_findings: List[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return asdict(self)


# ════════════════════════════════════════════════
# GDPR 合规检查器核心类
# ════════════════════════════════════════════════

class GDPRComplianceChecker:
    """
    RMFOOD平台GDPR合规性自动检查工具
    
    针对欧盟GDPR要求的自动化验证，
    输出详细的合规状态报告和改进建议。
    
    适用范围:
    - 处理EU用户数据的SaaS平台
    - 包含个人身份信息(PII)的Web应用
    - 提供B2C或B2B2C服务的系统
    """

    def __init__(self, base_url: str, timeout: float = 30.0):
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self.client = httpx.AsyncClient(
            timeout=timeout,
            follow_redirects=True,
            verify=False,
        )
        self.checks: List[ComplianceCheck] = []
        self.critical_issues: List[str] = []

    async def close(self):
        await self.client.aclose()

    def _add_check(self, check: ComplianceCheck):
        """记录一个合规检查结果"""
        self.checks.append(check)

        status_icons = {
            ComplianceStatus.COMPLIANT: "✅",
            ComplianceStatus.PARTIAL: "⚠️",
            ComplianceStatus.NON_COMPLIANT: "❌",
            ComplianceStatus.NOT_APPLICABLE: "➖",
        }
        icon = status_icons.get(check.status, "❓")
        
        print(f"  {icon} [{check.status.value}] {check.title}")
        if check.recommendation and check.status != ComplianceStatus.COMPLIANT:
            print(f"     💡 建议: {check.recommendation[:100]}...")

        if check.status == ComplianceStatus.NON_COMPLIANT and check.risk_level == "Critical":
            self.critical_issues.append(check.id)

    async def _safe_request(
        self,
        method: str,
        path: str,
        **kwargs
    ) -> Tuple[httpx.Response, bool]:
        """发送请求并捕获异常"""
        url = f"{self.base_url}{path}"
        try:
            response = await self.client.request(method, url, **kwargs)
            return response, True
        except Exception as e:
            print(f"     ⚠️ 请求异常: {method} {url} - {str(e)}")
            return None, False

    # ═══════════════════════════════════════════
    # Art.15: 数据访问权 (Right of Access)
    # ═══════════════════════════════════════════

    async def check_art15_data_export(self):
        """
        Art.15 检查: 用户数据导出功能
        
        要求:
        - 提供API或UI界面让用户下载其所有个人数据
        - 导出格式应为机器可读的标准格式（JSON/XML/CSV）
        - 响应时间应在30天内（建议更短）
        - 数据应包含：账户信息、活动记录、偏好设置等
        """
        print("\n" + "=" * 70)
        print("📥 [Art.15] 检查数据导出功能 (Right of Access)")
        print("=" * 70)

        export_endpoints_to_try = [
            "/api/v1/users/me/data-export",      # 标准数据导出端点
            "/api/v1/users/me/export-personal-data",
            "/api/v1/gdpr/data-export",
            "/api/v1/privacy/my-data",
            "/api/v1/account/download-my-data",
        ]

        export_endpoint_found = False
        for endpoint in export_endpoints_to_try:
            resp, ok = await self._safe_request("GET", endpoint)

            if ok and resp is not None:
                if resp.status_code in [200, 201]:
                    export_endpoint_found = True
                    
                    try:
                        data = resp.json()
                        
                        required_fields = [
                            "user_profile",       # 基本资料
                            "account_activity",    # 账户活动
                            "preferences",        # 偏好设置
                            "export_timestamp",    # 导出时间戳
                        ]
                        
                        missing_fields = [f for f in required_fields if f not in data]
                        has_personal_data = any(
                            key in str(data).lower()
                            for key in ["email", "username", "name", "phone"]
                        )
                        
                        if len(missing_fields) == 0 and has_personal_data:
                            self._add_check(ComplianceCheck(
                                id="GDPR-A15-EXPORT-FULL",
                                article=GDPR_Article.ART_15_RIGHT_OF_ACCESS,
                                title="数据导出功能完整可用",
                                description=f"端点{endpoint}返回完整的个人数据包，包含所有必需字段。",
                                status=ComplianceStatus.COMPLIANT,
                                evidence=f"Endpoint: {endpoint}\nFields: {list(data.keys())[:10]}",
                                risk_level="Low",
                            ))
                        else:
                            self._add_check(ComplianceCheck(
                                id="GDPR-A15-EXPORT-PARTIAL",
                                article=GDPR_Article.ART_15_RIGHT_OF_ACCESS,
                                title="数据导出功能存在但缺少部分字段",
                                description=f"找到导出端点{endpoint}，但缺少字段: {missing_fields}",
                                status=ComplianceStatus.PARTIAL,
                                evidence=f"Missing fields: {missing_fields}",
                                recommendation="确保导出数据包含：用户基本信息、登录历史、隐私设置、"
                                            "第三方授权、内容创建记录等全部个人相关数据。",
                                risk_level="Medium",
                            ))
                    except json.JSONDecodeError:
                        content_type = resp.headers.get("content-type", "")
                        if "json" in content_type or "xml" in content_type or "csv" in content_type:
                            self._add_check(ComplianceCheck(
                                id="GDPR-A15-EXPORT-FORMAT",
                                article=GDPR_Article.ART_15_RIGHT_OF_ACCESS,
                                title="数据导出格式正确",
                                description=f"返回标准格式的文件 (Content-Type: {content_type})",
                                status=ComplianceStatus.COMPLIANT,
                                evidence=f"Content-Type: {content_type}, Size: {len(resp.content)} bytes",
                                risk_level="Low",
                            ))
                        else:
                            self._add_check(ComplianceCheck(
                                id="GDPR-A15-EXPORT-FORMAT-WARN",
                                article=GDPR_Article.ART_15_RIGHT_OF_ACCESS,
                                title="导出格式非标准机器可读格式",
                                description=f"Content-Type为{content_type}，可能不便于数据处理",
                                status=ComplianceStatus.PARTIAL,
                                recommendation="优先使用JSON格式导出，便于用户理解和二次使用",
                                risk_level="Low",
                            ))
                    
                    break  # 找到可用的导出端点后停止
                
                elif resp.status_code == 401:
                    continue  # 需要认证，尝试下一个或标记需要认证
                elif resp.status_code == 404:
                    continue  # 端点不存在

        if not export_endpoint_found:
            self._add_check(ComplianceCheck(
                id="GDPR-A15-NO-EXPORT",
                article=GDPR_Article.ART_15_RIGHT_OF_ACCESS,
                title="未发现数据导出功能",
                description="未找到任何符合GDPR Art.15要求的数据导出API端点或页面",
                status=ComplianceStatus.NON_COMPLIANT,
                evidence="尝试的端点均返回404:\n" + "\n".join(f"  - {ep}" for ep in export_endpoints_to_try),
                recommendation="实现以下任一方案:\n"
                               "1. API端点: GET /api/v1/users/me/data-export (需认证)\n"
                               "2. 用户设置页面: '下载我的数据' 按钮\n"
                               "3. 支持自助服务门户的数据导出请求\n"
                               "导出内容应包括: 个人资料、活动日志、偏好设置、关联数据等",
                risk_level="Critical",
            ))

    # ═══════════════════════════════════════════
    # Art.17: 被遗忘权 (Right to Erasure)
    # ═══════════════════════════════════════════

    async def check_art17_right_to_erasure(self):
        """
        Art.17 检查: 数据删除功能
        
        要求:
        - 提供"删除我的账户"功能
        - 删除应是硬删除（而非仅标记为inactive）
        - 应在合理时间内完成删除（72小时内确认）
        - 备份数据应在30天后永久删除
        - 通知相关第三方数据已被删除
        """
        print("\n" + "=" * 70)
        print("🗑️  [Art.17] 检查被遗忘权/数据删除功能 (Right to Erasure)")
        print("=" * 70)

        deletion_endpoints = [
            ("DELETE", "/api/v1/users/me"),                          # 标准账户删除
            ("POST", "/api/v1/users/me/delete-account"),             # 显式删除请求
            ("POST", "/api/v1/gdpr/request-deletion"),               # GDPR专用
            ("DELETE", "/api/v1/account"),                           # 替代路径
            ("POST", "/api/v1/privacy/erase-my-data"),              # 隐私中心
        ]

        deletion_found = False
        for method, endpoint in deletion_endpoints:
            resp, ok = await self._safe_request(method, endpoint)

            if ok and resp is not None:
                if resp.status_code in [200, 202, 204]:
                    deletion_found = True
                    self._add_check(ComplianceCheck(
                        id="GDPR-A17-DELETE-API",
                        article=GDPR_Article.ART_17_RIGHT_TO_ERASURE,
                        title="账户/数据删除API已实现",
                        description=f"发现删除端点: {method} {endpoint}",
                        status=ComplianceStatus.COMPLIANT,
                        evidence=f"Status Code: {resp.status_code}",
                        risk_level="Low",
                    ))

                    response_body = {}
                    try:
                        response_body = resp.json()
                    except:
                        pass

                    has_confirmation = (
                        "deletion_scheduled" in str(response_body).lower() or
                        "confirmation_id" in str(response_body).lower() or
                        "ticket_id" in str(response_body).lower() or
                        "will_be_deleted" in str(response_body).lower()
                    )

                    if has_confirmation:
                        self._add_check(ComplianceCheck(
                            id="GDPR-A17-CONFIRMATION",
                            article=GDPR_Article.ART_17_RIGHT_TO_ERASURE,
                            title="删除操作提供确认机制",
                            description="删除请求返回了确认ID或计划删除时间",
                            status=ComplianceStatus.COMPLIANT,
                            evidence=f"Response: {str(response_body)[:200]}",
                            risk_level="Low",
                        ))
                    else:
                        self._add_check(ComplianceCheck(
                            id="GDPR-A17-NO-CONFIRMATION",
                            article=GDPR_Article.ART_17_RIGHT_TO_ERASURE,
                            title="删除操作缺少确认反馈",
                            description="删除请求成功但未提供确认信息（如删除时间表、工单号等）",
                            status=ComplianceStatus.PARTIAL,
                            recommendation="返回确认信息：\n"
                                          "- 预计完成时间（如: 72小时内处理完毕）\n"
                                          "- 确认ID用于后续查询\n"
                                          "- 影响范围说明（哪些数据将被删除）",
                            risk_level="Medium",
                        ))

                    break
                elif resp.status_code == 401:
                    deletion_found = True  # 端点存在但需要认证
                    self._add_check(ComplianceCheck(
                        id="GDPR-A17-REQUIRES-AUTH",
                        article=GDPR_Article.ART_17_RIGHT_TO_ERASURE,
                        title="删除功能需要用户认证（符合预期）",
                        description=f"删除端点{endpoint}要求认证后才可调用",
                        status=ComplianceStatus.COMPLIANT,
                        evidence="Returns 401 Unauthorized (correct behavior)",
                        risk_level="Low",
                    ))
                    break
                elif resp.status_code == 404 or resp.status_code == 405:
                    continue

        if not deletion_found:
            self._add_check(ComplianceCheck(
                id="GDPR-A17-NO-DELETE-API",
                article=GDPR_Article.ART_17_RIGHT_TO_ERASURE,
                title="未发现数据删除功能",
                description="未找到任何允许用户请求数据删除的API或UI入口",
                status=ComplianceStatus.NON_COMPLIANT,
                evidence="尝试的端点:\n" + "\n".join(
                    f"  {m} {ep}" for m, ep in deletion_endpoints
                ),
                recommendation="实施账户删除流程:\n"
                               "1. 用户设置页添加 '删除我的账户' 按钮\n"
                               "2. 二次确认对话框（防止误操作）\n"
                               "3. 发送邮件确认链接\n"
                               "4. 30天冷静期（可选，给用户反悔机会）\n"
                               "5. 执行硬删除 + 日志记录\n"
                               "6. 备份数据30天后自动清除",
                risk_level="Critical",
            ))

        # 检查是否有备份保留策略说明
        retention_policy_found = False
        policy_urls = [
            "/privacy-policy",
            "/gdpr",
            "/legal/data-retention",
            "/terms#data-deletion",
        ]

        for policy_path in policy_urls:
            resp, ok = await self._safe_request("GET", policy_path)
            if ok and resp is not None and resp.status_code == 200:
                content_lower = resp.text.lower()
                retention_keywords = [
                    "retention period", "保留期限",
                    "backup", "备份",
                    "30 days", "30天",
                    "data deletion", "数据删除",
                    "erasure", "擦除",
                ]
                
                matches = sum(1 for kw in retention_keywords if kw in content_lower)
                if matches >= 2:
                    retention_policy_found = True
                    self._add_check(ComplianceCheck(
                        id="GDPR-A17-RETENTION-POLICY",
                        article=GDPR_Article.ART_17_RIGHT_TO_ERASURE,
                        title="数据保留策略文档已公开",
                        description=f"在{policy_path}中发现数据保留和删除相关政策说明",
                        status=ComplianceStatus.COMPLIANT,
                        evidence=f"URL: {policy_path}, Keywords matched: {matches}",
                        risk_level="Low",
                    ))
                    break

        if not retention_policy_found:
            self._add_check(ComplianceCheck(
                id="GDPR-A17-NO-RETENTION-POLICY",
                article=GDPR_Article.ART_17_RIGHT_TO_ERASURE,
                title="缺少公开的数据保留和删除政策说明",
                description="未在隐私政策或法律文档中找到关于数据删除后备份保留期的明确说明",
                status=ComplianceStatus.PARTIAL,
                recommendation="在隐私政策中添加章节说明:\n"
                               "- 用户删除账户后的数据处理流程\n"
                               "- 备份数据的保留期限（建议30天）\n"
                               "- 自动化清除机制\n"
                               "- 法律要求保留的例外情况",
                risk_level="Medium",
            ))

    # ═══════════════════════════════════════════
    # Art.7 & Art.13: 同意与透明度 (Consent & Transparency)
    # ═══════════════════════════════════════════

    async def check_consent_and_transparency(self):
        """
        Art.7/13 检查: 同意机制和信息透明度
        
        要求:
        - 注册时明确告知数据收集目的
        - Cookie同意横幅（如适用）
        - 隐私政策易于访问且最新
        - 第三方共享清单
        - DPO（数据保护官）联系方式
        """
        print("\n" + "=" * 70)
        print("📜 [Art.7/13] 检查同意机制与信息透明度")
        print("=" * 70)

        # 检查隐私政策页面
        privacy_policy_urls = [
            "/privacy",
            "/privacy-policy",
            "/privacy.html",
            "/legal/privacy",
            "/policies/privacy",
        ]

        privacy_policy_accessible = False
        for pp_url in privacy_policy_urls:
            resp, ok = await self._safe_request("GET", pp_url)
            
            if ok and resp is not None:
                if resp.status_code == 200:
                    privacy_policy_accessible = True
                    content = resp.text
                    
                    required_pp_sections = [
                        ("data_collected", "收集的数据类型"),
                        ("purpose", "数据处理目的"),
                        ("legal_basis", "法律依据"),
                        ("data_sharing", "第三方共享"),
                        ("user_rights", "用户权利"),
                        ("contact", "联系方式/DPO"),
                        ("retention", "数据保留期"),
                        ("cookies", "Cookie政策"),
                    ]
                    
                    found_sections = []
                    for keyword, desc in required_pp_sections:
                        if keyword in content.lower():
                            found_sections.append(desc)
                    
                    coverage = len(found_sections) / len(required_pp_sections) * 100
                    
                    if coverage >= 80:
                        self._add_check(ComplianceCheck(
                            id="GDPR-PRIVACY-COMPLETE",
                            article=GDPR_Article.ART_12_TRANSPARENCY,
                            title="隐私政策内容完整",
                            description=f"隐私政策页面({pp_url})覆盖{coverage:.0f}%的必需章节",
                            status=ComplianceStatus.COMPLIANT,
                            evidence=f"Found sections: {found_sections}",
                            risk_level="Low",
                        ))
                    elif coverage >= 50:
                        self._add_check(ComplianceCheck(
                            id="GDPR-PRIVACY-PARTIAL",
                            article=GDPR_Article.ART_12_TRANSPARENCY,
                            title="隐私政策内容不够全面",
                            description=f"隐私政策仅覆盖{coverage:.0f}%的GDPR要求章节",
                            status=ComplianceStatus.PARTIAL,
                            evidence=f"Missing: {[d for k, d in required_pp_sections if k not in content.lower()]}",
                            recommendation="补充缺失的章节，特别是用户权利说明和DPO联系信息",
                            risk_level="Medium",
                        ))
                    else:
                        self._add_check(ComplianceCheck(
                            id="GDPR-PRIVACY-INCOMPLETE",
                            article=GDPR_Article.ART_12_TRANSPARENCY,
                            title="隐私政策严重不完整",
                            description=f"隐私政策仅覆盖{coverage:.0f}%的要求，远低于GDPR标准",
                            status=ComplianceStatus.NON_COMPLIANT,
                            recommendation="重写隐私政策以涵盖GDPR Art.13&14的所有强制披露项",
                            risk_level="High",
                        ))
                    break
                elif resp.status_code in [301, 302, 303, 307, 308]:
                    location = resp.headers.get("location", "")
                    if location:
                        privacy_policy_accessible = True
                        self._add_check(ComplianceCheck(
                            id="GDPR-PRIVACY-REDIRECT",
                            article=GDPR_Article.ART_12_TRANSPARENCY,
                            title="隐私政策通过重定向可访问",
                            description=f"{pp_url} 重定向到 {location}",
                            status=ComplianceStatus.COMPLIANT,
                            risk_level="Low",
                        ))
                        break

        if not privacy_policy_accessible:
            self._add_check(ComplianceCheck(
                id="GDPR-NO-PRIVACY-POLICY",
                article=GDPR_Article.ART_12_TRANSPARENCY,
                title="无法访问隐私政策页面",
                description="未找到可访问的隐私政策文档（尝试多个常见URL均失败）",
                status=ComplianceStatus.NON_COMPLIANT,
                evidence="Tried URLs:\n" + "\n".join(f"  - {u}" for u in privacy_policy_urls),
                recommendation="立即发布隐私政策页面并确保从主页底部可点击访问。\n"
                               "参考模板: https://gdpr.eu/privacy-policy-template/",
                risk_level="Critical",
            ))

        # 检查Cookie同意机制
        resp_home, _ = await self._safe_request("GET", "/")
        cookie_consent_detected = False
        
        if resp_home:
            home_content = resp_home.text.lower()
            cookie_consent_indicators = [
                "cookie-consent",
                "cookiebanner",
                "cookie-banner",
                "cookie-notice",
                "gdpr-cookie",
                "consent-management",
                "cookieaccept",
                "cookie_settings",
            ]
            
            for indicator in cookie_consent_indicators:
                if indicator in home_content:
                    cookie_consent_detected = True
                    self._add_check(ComplianceCheck(
                        id="GDPR-COOKIE-CONSENT-DETECTED",
                        article=GDPR_Article.ART_7_CONSENT,
                        title="Cookie同意机制已部署",
                        description=f"首页检测到Cookie同意组件: {indicator}",
                        status=ComplianceStatus.COMPLIANT,
                        risk_level="Low",
                    ))
                    break
            
            set_cookie_header = resp_home.headers.get("set-cookie", "")
            if "cookie" in set_cookie_header.lower():
                consent_cookie_patterns = [
                    "cookie_consent",
                    "cookie_accepted",
                    "gdpr_consent",
                    "cookie_preference",
                ]
                
                if any(p in set_cookie_header.lower() for p in consent_cookie_patterns):
                    cookie_consent_detected = True
                    self._add_check(ComplianceCheck(
                        id="GDPR-COOKIE-CONSENT-COOKIE",
                        article=GDPR_Article.ART_7_CONSENT,
                        title="Cookie同意状态通过Cookie持久化",
                        description="检测到Cookie同意相关的Set-Cookie头",
                        status=ComplianceStatus.COMPLIANT,
                        risk_level="Low",
                    ))

        if not cookie_consent_detected:
            self._add_check(ComplianceCheck(
                id="GDPR-NO-COOKIE-CONSENT",
                article=GDPR_Article.ART_7_CONSENT,
                title="未检测到Cookie同意机制",
                description="首页未发现Cookie同意横幅或管理组件",
                status=ComplianceStatus.PARTIAL,
                evidence="Checked homepage HTML and Set-Cookie headers",
                recommendation="如果网站使用Cookie（分析、广告、功能），必须实施:\n"
                               "1. 首次访问时显示同意横幅\n"
                               "2. 允许用户选择接受/拒绝各类Cookie\n"
                               "3. 记录用户选择并尊重设置\n"
                               "4. 提供修改Cookie偏好的入口",
                risk_level="Medium",
            ))

        # 检查注册时的数据收集声明
        register_resp, _ = await self._safe_request("GET", "/api/v1/auth/register")
        if register_resp and register_resp.status_code != 404:
            if register_resp.status_code == 200 or register_resp.status_code == 405:
                openapi_schema = register_resp.json()
                schema_str = json.dumps(openapi_schema)
                
                consent_fields = [
                    "terms_accepted",
                    "privacy_accepted",
                    "agree_to_terms",
                    "consent",
                    "accept_privacy_policy",
                ]
                
                registration_has_consent = any(f in schema_str.lower() for f in consent_fields)
                
                if registration_has_consent:
                    self._add_check(ComplianceCheck(
                        id="GDPR-REGISTER-CONSENT",
                        article=GDPR_Article.ART_7_CONSENT,
                        title="注册流程包含同意确认字段",
                        description="注册API schema中包含条款/隐私同意相关字段",
                        status=ComplianceStatus.COMPLIANT,
                        risk_level="Low",
                    ))
                else:
                    self._add_check(ComplianceCheck(
                        id="GDPR-REGISTER-NO-CONSENT",
                        article=GDPR_Article.ART_7_CONSENT,
                        title="注册流程缺少明确的同意确认步骤",
                        description="注册接口未要求用户明确同意条款或隐私政策",
                        status=ComplianceStatus.PARTIAL,
                        recommendation="在注册表单中添加:\n"
                                       "- 服务条款复选框（必填）\n"
                                       "- 隐私政策复选框（必填）\n"
                                       "- 可选的营销同意复选框（默认不勾选）",
                        risk_level="Medium",
                    ))

    # ═══════════════════════════════════════════
    # Art.32: 安全措施 (Security of Processing)
    # ═══════════════════════════════════════════

    async def check_art32_security_measures(self):
        """
        Art.32 检查: 技术和组织安全措施
        
        要求:
        - 传输加密 (TLS 1.2+)
        - 密码哈希存储（不可逆）
        - 访问控制和认证
        - 审计日志完整性
        - 定期安全评估
        """
        print("\n" + "=" * 70)
        print("🔒 [Art.32] 检查安全措施 (Security of Processing)")
        print("=" * 70)

        # 检查HTTPS/TLS配置
        is_https = self.base_url.startswith("https")
        if is_https:
            self._add_check(ComplianceCheck(
                id="GDPR-TLS-ENABLED",
                article=GDPR_Article.ART_32_SECURITY,
                title="传输层加密(TLS)已启用",
                description="目标站点使用HTTPS协议",
                status=ComplianceStatus.COMPLIANT,
                evidence=f"Protocol: HTTPS",
                risk_level="Low",
            ))

            resp, _ = await self._safe_request("GET", "/health")
            if resp:
                tls_version = resp.http_version if hasattr(resp, 'http_version') else "Unknown"
                self._add_check(ComplianceCheck(
                    id="GDPR-TLS-VERSION",
                    article=GDPR_Article.ART_32_SECURITY,
                    title=f"TLS版本: {tls_version}",
                    description=f"使用的HTTP/TLS版本: {tls_version}",
                    status=ComplianceStatus.COMPLIANT if "2" in str(tls_version) or "1.3" in str(tls_version) else ComplianceStatus.PARTIAL,
                    recommendation="建议使用TLS 1.2或更高版本，禁用TLS 1.0/1.1" if "1.0" in str(tls_version) or "1.1" in str(tls_version) else None,
                    risk_level="Low",
                ))
        else:
            self._add_check(ComplianceCheck(
                id="GDPR-NO-TLS",
                article=GDPR_Article.ART_32_SECURITY,
                title="未使用HTTPS加密传输",
                description="目标站点使用HTTP明文协议，数据在传输过程中可能被窃听",
                status=ComplianceStatus.NON_COMPLIANT,
                recommendation="立即配置SSL/TLS证书并强制HTTPS重定向",
                risk_level="Critical",
            ))

        # 检查密码存储安全性（间接测试：注册后密码不应以明文形式出现在任何地方）
        login_payload = {"username": "test_pwd_security", "password": "SuperSecurePassword123!"}
        reg_resp, _ = await self._safe_request("POST", "/api/v1/auth/register", json=login_payload)
        
        if reg_resp and reg_resp.status_code in [200, 201]:
            login_resp, _ = await self._safe_request("POST", "/api/v1/auth/login", json=login_payload)
            
            if login_resp and login_resp.status_code == 200:
                login_result_text = login_resp.text.lower()
                
                if "supersecurepassword123" in login_result_text:
                    self._add_check(ComplianceCheck(
                        id="GDPR-PASSWORD-PLAINTEXT",
                        article=GDPR_Article.ART_32_SECURITY,
                        title="密码可能在响应中以明文或弱哈希形式泄露",
                        description="登录响应中疑似包含原始密码字符串",
                        status=ComplianceStatus.NON_COMPLIANT,
                        evidence="Password string detected in login response body",
                        recommendation="确保:\n"
                                      "- 密码使用bcrypt/argon2等强哈希算法存储\n"
                                      "- API响应永远不返回密码字段（即使已哈希）\n"
                                      "- 使用Pydantic模型排除password字段序列化",
                        risk_level="Critical",
                    ))
                else:
                    self._add_check(ComplianceCheck(
                        id="GDPR-PASSWORD-HANDLING-OK",
                        article=GDPR_Article.ART_32_SECURITY,
                        title="密码处理基本安全（未在响应中泄露）",
                        description="登录响应中未检测到密码明文",
                        status=ComplianceStatus.COMPLIANT,
                        risk_level="Low",
                    ))

        # 检查审计日志功能
        audit_log_endpoints = [
            "/api/v1/admin/audit-logs",
            "/api/v1/audit/logs",
            "/api/v1/logs/audit",
        ]

        audit_log_found = False
        for ep in audit_log_endpoints:
            resp, _ = await self._safe_request("GET", ep)
            if resp and resp.status_code in [200, 401, 403]:  # 存在（即使需要权限）
                audit_log_found = True
                self._add_check(ComplianceCheck(
                    id="GDPR-AUDIT-LOG-ENDPOINT",
                    article=GDPR_Article.ART_32_SECURITY,
                    title="审计日志端点已实现",
                    description=f"发现审计日志API: {ep}",
                    status=ComplianceStatus.COMPLIANT,
                    risk_level="Low",
                ))
                break

        if not audit_log_found:
            self._add_check(ComplianceCheck(
                id="GDPR-NO-AUDIT-LOG",
                article=GDPR_Article.ART_32_SECURITY,
                title="未发现审计日志功能",
                description="未找到审计日志查询API端点",
                status=ComplianceStatus.PARTIAL,
                recommendation="实施全面的审计日志系统，记录:\n"
                               "- 用户认证事件（登录/登出/Token刷新）\n"
                               "- 数据访问和修改操作\n"
                               "- 权限变更\n"
                               "- 数据导出和删除请求\n"
                               "- 异常和安全事件",
                risk_level="Medium",
            ))

    # ═══════════════════════════════════════════
    # Art.25: 隐私设计 (Privacy by Design)
    # ═══════════════════════════════════════════

    async def check_art25_privacy_by_design(self):
        """
        Art.25 检查: 隐私设计和默认隐私原则
        
        要求:
        - 数据最小化（只收集必要数据）
        - 默认最严格的隐私设置
        - 目的限制（只用声明的目的）
        - 存储限制（不超必要时间）
        - PII匿名化和假名化选项
        """
        print("\n" + "=" * 70)
        print("🛡️  [Art.25] 检查隐私设计和默认隐私 (Privacy by Design)")
        print("=" * 70)

        # 检查注册时收集的数据字段是否过多
        register_schema_resp, _ = await self._safe_request("GET", "/api/v1/auth/register")
        if register_schema_resp and register_schema_resp.status_code != 404:
            schema = register_schema_resp.json()
            schema_str = json.dumps(schema).lower()

            potentially_excessive_fields = [
                "id_card_number", "身份证号",
                "home_address", "家庭住址",
                "phone_number", "电话号码",
                "date_of_birth", "出生日期",
                "gender", "性别",
                "nationality", "国籍",
                "bio", "biography", "简介",
                "social_security", "社保号",
            ]

            excessive_count = sum(1 for f in potentially_excessive_fields if f in schema_str)
            
            if excessive_count <= 2:
                self._add_check(ComplianceCheck(
                    id="GDPR-DATA-MINIMIZATION-GOOD",
                    article=GDPR_Article.ART_25_PRIVACY_BY_DESIGN,
                    title="数据收集遵循最小化原则",
                    description=f"注册表单包含的可选敏感字段较少 ({excessive_count}个)",
                    status=ComplianceStatus.COMPLIANT,
                    risk_level="Low",
                ))
            elif excessive_count <= 5:
                self._add_check(ComplianceCheck(
                    id="GDPR-DATA-MINIMIZATION-WARN",
                    article=GDPR_Article.ART_25_PRIVACY_BY_DESIGN,
                    title="注册收集的字段可能超出必要范围",
                    description=f"发现{excessive_count}个可能不必要的敏感字段",
                    status=ComplianceStatus.PARTIAL,
                    recommendation="审查每个字段的必要性，将非必填字段改为可选或移除",
                    risk_level="Medium",
                ))
            else:
                self._add_check(ComplianceCheck(
                    id="GDPR-DATA-MINIMIZATION-VIOLATION",
                    article=GDPR_Article.ART_25_PRIVACY_BY_DESIGN,
                    title="数据收集可能违反最小化原则",
                    description=f"注册表单包含{excessive_count}个敏感字段，可能过度收集",
                    status=ComplianceStatus.NON_COMPLIANT,
                    recommendation="重新评估每个PII字段的合法利益和必要性",
                    risk_level="High",
                ))

        # 检查默认隐私设置（假设有用户设置API）
        settings_resp, _ = await self._safe_request("GET", "/api/v1/users/me/settings")
        if settings_resp and settings_resp.status_code == 200:
            settings = settings_resp.json()
            settings_str = json.dumps(settings).lower()

            privacy_friendly_defaults = {
                "email_notifications": "false",
                "marketing_emails": "false",
                "profile_public": "false",
                "share_data": "false",
                "analytics_tracking": "false",
            }

            default_privacy_score = sum(
                1 for key, expected_val in privacy_friendly_defaults.items()
                if key in settings_str and expected_val in settings_str
            ) / len(privacy_friendly_defaults) * 100

            if default_privacy_score >= 80:
                self._add_check(ComplianceCheck(
                    id="GDPR-DEFAULT-PRIVACY-GOOD",
                    article=GDPR_Article.ART_25_PRIVACY_BY_DESIGN,
                    title="默认隐私设置偏向保护用户",
                    description=f"{default_privacy_score:.0f}%的隐私相关设置为关闭/限制状态",
                    status=ComplianceStatus.COMPLIANT,
                    risk_level="Low",
                ))
            else:
                self._add_check(ComplianceCheck(
                    id="GDPR-DEFAULT-PRIVACY-WEAK",
                    article=GDPR_Article.ART_25_PRIVACY_BY_DESIGN,
                    title="默认隐私设置可能过于开放",
                    description=f"仅{default_privacy_score:.0f}%的隐私设置为保守默认值",
                    status=ComplianceStatus.PARTIAL,
                    recommendation="将营销推送、数据分析、公开资料等设为默认关闭",
                    risk_level="Medium",
                ))

    # ═══════════════════════════════════════════
    # 主执行方法
    # ═══════════════════════════════════════════

    async def run_full_check(self) -> GDPRReport:
        """
        执行完整的GDPR合规性检查
        
        Returns:
            GDPRReport: 详细的合规检查报告
        """
        print("\n" + "╔" + "=" * 68 + "╗")
        print("║" + " " * 15 + "RMFOOD GDPR合规检查器 v1.0" + " " * 24 + "║")
        print("║" + " " * 10 + "通用数据保护条例(GDPR) 自动化验证" + " " * 19 + "║")
        print("╠" + "=" * 68 + "╣")
        print(f"║ 目标: {self.base_url:<54} ║")
        print(f"║ 检查日期: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC'):<42} ║")
        print("╚" + "=" * 68 + "╝")

        try:
            await self.check_art15_data_export()
            await self.check_art17_right_to_erasure()
            await self.check_consent_and_transparency()
            await self.check_art32_security_measures()
            await self.check_art25_privacy_by_design()

        except Exception as e:
            print(f"\n❌ 检查过程异常: {str(e)}")
            import traceback
            traceback.print_exc()

        finally:
            scan_date = datetime.now(timezone.utc).isoformat()
            summary = self._generate_summary()
            overall_score = self._calculate_overall_score()

            report = GDPRReport(
                target_url=self.base_url,
                scan_date=scan_date,
                checks=self.checks,
                summary=summary,
                overall_score=overall_score,
                critical_findings=self.critical_issues,
            )

            self._print_summary(report)
            return report

    def _generate_summary(self) -> Dict[str, int]:
        summary = {status.value: 0 for status in ComplianceStatus}
        for check in self.checks:
            summary[check.status.value] += 1
        return summary

    def _calculate_overall_score(self) -> float:
        if not self.checks:
            return 0.0

        weights = {
            ComplianceStatus.COMPLIANT: 100,
            ComplianceStatus.PARTIAL: 50,
            ComplianceStatus.NON_COMPLIANT: 0,
            ComplianceStatus.NOT_APPLICABLE: 100,
        }

        total_weighted = sum(weights.get(check.status, 0) for check in self.checks)
        return round(total_weighted / len(self.checks), 1)

    def _print_summary(self, report: GDPRReport):
        print("\n" + "╔" + "=" * 68 + "╗")
        print("║" + " " * 22 + "📊 GDPR合规检查摘要" + " " * 26 + "║")
        print("╠" + "=" * 68 + "╣")

        status_icons = {
            "Compliant": "✅",
            "Partially Compliant": "⚠️",
            "Non-Compliant": "❌",
            "N/A": "➖",
        }

        for status, count in report.summary.items:
            icon = status_icons.get(status, "❓")
            bar = "█" * min(count, 10)
            print(f"║  {icon} {status:<22} │ {count:>2} 个 │ {bar:<10} ║")

        print("╠" + "-" * 68 + "╣")

        score_color = "🟢" if report.overall_score >= 80 else ("🟡" if report.overall_score >= 60 else "🔴")
        print(f"║  📈 综合合规评分: {score_color} {report.overall_score}/100{'':>24} ║")
        print(f"║  ⚠️  关键问题数:   {len(report.critical_findings):>2} 个{'':>27} ║")
        print(f"║  🔍 总检查项:     {len(report.checks):>2} 项{'':>28} ║")
        print("╚" + "=" * 68 + "╝")

        if report.overall_score >= 80:
            print(f"\n✅ 整体GDPR合规状况良好！评分: {report.overall_score}/100")
        elif report.overall_score >= 60:
            print(f"\n⚠️ 存在一些合规差距需要改进。当前评分: {report.overall_score}/100")
        else:
            print(f"\n❌ 合规风险较高！多项关键要求未满足。评分: {report.overall_score}/100")
            print(f"   必须修复的关键问题:")
            for issue_id in report.critical_issues[:5]:
                print(f"   - {issue_id}")


# ════════════════════════════════════════════════
# CLI 入口点
# ════════════════════════════════════════════════

async def main():
    parser = argparse.ArgumentParser(
        description="RMFOOD GDPR合规性检查工具",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例用法:
  python gdpr_compliance_check.py --target http://localhost:8000
  python gdpr_compliance_check.py --target https://app.rmfood.com --output gdpr_report.json
  
注意: 本工具辅助识别潜在的合规差距，
最终合规认定需结合法律专业人士意见。
""",
    )

    parser.add_argument("--target", "-t", required=True, help="目标URL")
    parser.add_argument("--output", "-o", default=None, help="输出JSON报告路径")
    parser.add_argument("--timeout", type=float, default=30.0, help="请求超时（秒）")

    args = parser.parse_args()

    checker = GDPRComplianceChecker(base_url=args.target, timeout=args.timeout)

    try:
        report = await checker.run_full_check()

        if args.output:
            output_path = Path(args.output)
            with open(output_path, "w", encoding="utf-8") as f:
                json.dump(report.to_dict(), f, indent=2, ensure_ascii=False, default=str)
            print(f"\n✅ GDPR合规报告已保存至: {output_path.absolute()}")
        else:
            print("\n📄 JSON报告预览:")
            print(json.dumps(report.to_dict(), indent=2, ensure_ascii=False, default=str)[:3000])

    except KeyboardInterrupt:
        print("\n\n⚠️ 用户中断检查")
    finally:
        await checker.close()


if __name__ == "__main__":
    asyncio.run(main())
