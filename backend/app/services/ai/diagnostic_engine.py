"""
AI 诊断引擎 - 三级检测流水线

Level 1 ConfigChecker:   静态配置校验 (<10ms)
Level 2 ConnectivityChecker: 运行时连通性探测 (<5s)
Level 3 CapabilityChecker:   能力验证 (<15s)

用法:
    from app.services.ai.diagnostic_engine import DiagnosticEngine
    engine = DiagnosticEngine()
    report = await engine.run_full_diagnosis()
"""
from __future__ import annotations

import asyncio
import logging
import socket
import time
from dataclasses import dataclass, field
from typing import Literal
from urllib.parse import urlparse

import httpx

from app.core.config import settings
from app.services.llm_service import (
    LLMConfig,
    LLMMessage,
    PROVIDER_CUSTOM,
    PROVIDER_DEEPSEEK,
    PROVIDER_OPENAI,
    PROVIDER_QWEN,
    PROVIDER_ZHIPU,
    llm_service,
)

logger = logging.getLogger(__name__)

# ── 合法 Provider 白名单 ──
VALID_PROVIDERS = {PROVIDER_OPENAI, PROVIDER_DEEPSEEK, PROVIDER_ZHIPU, PROVIDER_QWEN, PROVIDER_CUSTOM}


# ══════════════════════════════════════════════
# 数据模型
# ══════════════════════════════════════════════


@dataclass
class CheckResult:
    """单条检测结果"""
    check_id: str  # 如 "C-01", "N-02"
    name: str  # 如 "API Key 配置"
    status: Literal["pass", "warn", "fail", "skip"]
    detail: str  # 详细描述
    suggestion: str  # 修复建议
    fixable: bool = True
    auto_fix_available: bool = False


@dataclass
class DiagnosticReport:
    """诊断报告"""
    overall: Literal["healthy", "degraded", "critical"]
    score: int  # 0-100
    timestamp_iso: str
    checks: list[CheckResult]
    total_pass: int = field(init=False)
    total_warn: int = field(init=False)
    total_fail: int = field(init=False)

    def __post_init__(self):
        self.total_pass = sum(1 for c in self.checks if c.status == "pass")
        self.total_warn = sum(1 for c in self.checks if c.status == "warn")
        self.total_fail = sum(1 for c in self.checks if c.status == "fail")


# ══════════════════════════════════════════════
# Level 1: 静态配置校验
# ══════════════════════════════════════════════


class ConfigChecker:
    """静态配置校验 — 纯内存操作，<10ms"""

    @staticmethod
    def _get_runtime_config():
        """优先读取 llm_service 运行时配置，fallback 到 settings 环境变量"""
        try:
            from app.services.llm_service import llm_service
            if llm_service and hasattr(llm_service, 'config') and llm_service.config:
                return {
                    'api_key': getattr(llm_service.config, 'api_key', None) or '',
                    'provider': getattr(llm_service.config, 'provider', None) or '',
                    'base_url': getattr(llm_service.config, 'base_url', None) or '',
                    'model': getattr(llm_service.config, 'model', None) or '',
                }
        except Exception:
            pass
        return {}

    @staticmethod
    def check_all() -> list[CheckResult]:
        results: list[CheckResult] = []
        results.append(ConfigChecker._check_api_key())
        results.append(ConfigChecker._check_provider())
        results.append(ConfigChecker._check_base_url())
        results.append(ConfigChecker._check_model_name())
        return results

    # ── C-01 ──
    @staticmethod
    def _check_api_key() -> CheckResult:
        # 优先读取运行时配置，fallback 到环境变量
        runtime = ConfigChecker._get_runtime_config()
        api_key = runtime.get('api_key', '') or (settings.openai_api_key or "")
        if not api_key:
            return CheckResult(
                check_id="C-01",
                name="API Key 配置",
                status="fail",
                detail="未检测到 API Key（OPENAI_API_KEY 为空）",
                suggestion="请在 .env 文件中设置 OPENAI_API_KEY，或通过前端配置面板填入有效密钥",
            )
        if len(api_key) < 20:
            return CheckResult(
                check_id="C-01",
                name="API Key 配置",
                status="warn",
                detail=f"API Key 长度过短（{len(api_key)} 字符），可能无效",
                suggestion="正常 API Key 通常为 40~60 字符，请检查是否完整复制",
            )
        # 基本格式检查：常见前缀
        if api_key.startswith("sk-") or api_key.startswith("eyJ") or len(api_key) >= 32:
            return CheckResult(
                check_id="C-01",
                name="API Key 配置",
                status="pass",
                detail=f"API Key 已配置（长度 {len(api_key)} 字符）",
                suggestion="无需操作",
                fixable=False,
            )
        return CheckResult(
            check_id="C-01",
            name="API Key 配置",
            status="warn",
            detail=f"API Key 格式异常（长度 {len(api_key)}，非标准前缀）",
            suggestion="请确认 API Key 来源正确，建议重新生成",
        )

    # ── C-02 ──
    @staticmethod
    def _check_provider() -> CheckResult:
        runtime = ConfigChecker._get_runtime_config()
        provider = runtime.get('provider', '') or (settings.llm_provider or "")
        if not provider:
            return CheckResult(
                check_id="C-02",
                name="Provider 合法性",
                status="fail",
                detail="未设置 LLM Provider",
                suggestion='请在 .env 中设置 LLM_PROVIDER，可选值: openai / deepseek / zhipu / qwen / custom',
            )
        if provider.lower() not in VALID_PROVIDERS:
            return CheckResult(
                check_id="C-02",
                name="Provider 合法性",
                status="fail",
                detail=f"非法 Provider 值: '{provider}'",
                suggestion=f"合法值: {', '.join(sorted(VALID_PROVIDERS))}",
            )
        return CheckResult(
            check_id="C-02",
            name="Provider 合法性",
            status="pass",
            detail=f"Provider 已设置为: {provider}",
            suggestion="无需操作",
            fixable=False,
        )

    # ── C-03 ──
    @staticmethod
    def _check_base_url() -> CheckResult:
        runtime = ConfigChecker._get_runtime_config()
        base_url = runtime.get('base_url', '') or (settings.openai_base_url or "")
        if not base_url:
            return CheckResult(
                check_id="C-03",
                name="Base URL 格式",
                status="pass",
                detail="使用 Provider 默认 Base URL（未自定义）",
                suggestion="如需代理/私有部署，可设置 OPENAI_BASE_URL",
                fixable=False,
            )
        try:
            parsed = urlparse(base_url)
            if parsed.scheme not in ("http", "https"):
                return CheckResult(
                    check_id="C-03",
                    name="Base URL 格式",
                    status="fail",
                    detail=f"URL 协议非法: '{parsed.scheme}'",
                    suggestion="Base URL 必须以 http:// 或 https:// 开头",
                )
            if not parsed.hostname:
                return CheckResult(
                    check_id="C-03",
                    name="Base URL 格式",
                    status="fail",
                    detail=f"无法解析主机名: '{base_url}'",
                    suggestion="请填写完整的 URL，例如 https://api.deepseek.com/v1",
                )
            return CheckResult(
                check_id="C-03",
                name="Base URL 格式",
                status="pass",
                detail=f"自定义 Base URL: {base_url}",
                suggestion="无需操作",
                fixable=False,
            )
        except Exception as e:
            return CheckResult(
                check_id="C-03",
                name="Base URL 格式",
                status="fail",
                detail=f"URL 解析异常: {e}",
                suggestion="请检查 OPENAI_BASE_URL 格式是否正确",
            )

    # ── C-04 ──
    @staticmethod
    def _check_model_name() -> CheckResult:
        runtime = ConfigChecker._get_runtime_config()
        model = runtime.get('model', '') or (settings.llm_model or "")
        if not model:
            return CheckResult(
                check_id="C-04",
                name="模型名称",
                status="warn",
                detail="未显式指定模型名称，将使用 Provider 默认值",
                suggestion="建议在 .env 中设置 LLM_MODEL 以明确指定模型版本",
            )
        return CheckResult(
            check_id="C-04",
            name="模型名称",
            status="pass",
            detail=f"已指定模型: {model}",
            suggestion="无需操作",
            fixable=False,
        )


# ══════════════════════════════════════════════
# Level 2: 运行时连通性探测
# ══════════════════════════════════════════════


class ConnectivityChecker:
    """运行时连通性探测 — 网络 I/O，<5s"""

    TIMEOUT_DNS = 3.0  # DNS 解析超时
    TIMEOUT_TCP = 5.0  # TCP 连接超时
    TIMEOUT_HTTP = 10.0  # HTTP 探测超时

    @staticmethod
    async def check_all(base_url: str | None = None) -> list[CheckResult]:
        results: list[CheckResult] = []

        # 优先使用传入参数，其次运行时配置，最后环境变量
        if not base_url:
            runtime = ConfigChecker._get_runtime_config()
            base_url = runtime.get('base_url', '') or (settings.openai_base_url or "")

        target_url = base_url or ""
        if not target_url:
            # 使用 provider 默认 URL
            runtime = ConfigChecker._get_runtime_config()
            provider = (runtime.get('provider', '') or settings.llm_provider or "").lower()
            from app.services.llm_service import PROVIDER_DEFAULTS

            target_url = PROVIDER_DEFAULTS.get(provider, {}).get("base_url", "")

        if not target_url:
            results.append(CheckResult(
                check_id="N-01", name="DNS 解析", status="skip",
                detail="无可用 Base URL，跳过网络检测", suggestion="请先完成 Level 1 配置校验",
                fixable=False,
            ))
            results.append(CheckResult(
                check_id="N-02", name="TCP 连通", status="skip",
                detail="无可用 Base URL，跳过网络检测", suggestion="请先完成 Level 1 配置校验",
                fixable=False,
            ))
            results.append(CheckResult(
                check_id="N-03", name="HTTP 探测", status="skip",
                detail="无可用 Base URL，跳过网络检测", suggestion="请先完成 Level 1 配置校验",
                fixable=False,
            ))
            return results

        parsed = urlparse(target_url)
        hostname = parsed.hostname or ""
        port = parsed.port or (443 if parsed.scheme == "https" else 80)

        # 并行执行 N-01 + N-02 + N-03
        dns_task = asyncio.create_task(
            ConnectivityChecker._check_dns(hostname), name="dns-check"
        )
        tcp_task = asyncio.create_task(
            ConnectivityChecker._check_tcp(hostname, port), name="tcp-check"
        )
        http_task = asyncio.create_task(
            ConnectivityChecker._check_http(target_url), name="http-check"
        )

        results.append(await dns_task)
        results.append(await tcp_task)
        results.append(await http_task)

        return results

    # ── N-01: DNS 解析 ──
    @staticmethod
    async def _check_dns(hostname: str) -> CheckResult:
        try:
            loop = asyncio.get_event_loop()
            ip = await asyncio.wait_for(
                loop.run_in_executor(None, socket.gethostbyname, hostname),
                timeout=ConnectivityChecker.TIMEOUT_DNS,
            )
            return CheckResult(
                check_id="N-01",
                name="DNS 解析",
                status="pass",
                detail=f"DNS 解析成功: {hostname} -> {ip}",
                suggestion="无需操作",
                fixable=False,
            )
        except asyncio.TimeoutError:
            return CheckResult(
                check_id="N-01",
                name="DNS 解析",
                status="fail",
                detail=f"DNS 解析超时 ({ConnectivityChecker.TIMEOUT_DNS}s): {hostname}",
                suggestion="请检查网络连接、DNS 设置或主机名是否正确",
            )
        except socket.gaierror as e:
            return CheckResult(
                check_id="N-01",
                name="DNS 解析",
                status="fail",
                detail=f"DNS 解析失败: {hostname} -> {e}",
                suggestion="请确认主机名正确，或检查本地 DNS / hosts 文件配置",
            )
        except Exception as e:
            return CheckResult(
                check_id="N-01",
                name="DNS 解析",
                status="fail",
                detail=f"DNS 解析异常: {e}",
                suggestion="请检查网络环境和防火墙设置",
            )

    # ── N-02: TCP 连通 ──
    @staticmethod
    async def _check_tcp(hostname: str, port: int) -> CheckResult:
        try:
            _, writer = await asyncio.wait_for(
                asyncio.open_connection(hostname, port),
                timeout=ConnectivityChecker.TIMEOUT_TCP,
            )
            writer.close()
            await writer.wait_closed()
            return CheckResult(
                check_id="N-02",
                name="TCP 连通",
                status="pass",
                detail=f"TCP 连接成功: {hostname}:{port}",
                suggestion="无需操作",
                fixable=False,
            )
        except asyncio.TimeoutError:
            return CheckResult(
                check_id="N-02",
                name="TCP 连通",
                status="fail",
                detail=f"TCP 连接超时 ({ConnectivityChecker.TIMEOUT_TCP}s): {hostname}:{port}",
                suggestion="目标服务器可能不可达，请检查网络/防火墙/代理设置",
            )
        except OSError as e:
            err_msg = str(e)
            if "Connection refused" in err_msg or "10061" in err_msg:
                detail = f"连接被拒绝: {hostname}:{port}"
                suggestion = f"端口 {port} 未开放，请确认服务是否正常运行"
            elif "Name or service not known" in err_msg or "11001" in err_msg:
                detail = f"主机名无法解析: {hostname}"
                suggestion = "请检查 DNS 或主机名拼写"
            else:
                detail = f"TCP 连接失败: {e}"
                suggestion = "请检查网络连通性和防火墙规则"
            return CheckResult(
                check_id="N-02",
                name="TCP 连通",
                status="fail",
                detail=detail,
                suggestion=suggestion,
            )
        except Exception as e:
            return CheckResult(
                check_id="N-02",
                name="TCP 连通",
                status="fail",
                detail=f"TCP 连接异常: {e}",
                suggestion="请检查网络环境",
            )

    # ── N-03: HTTP 探测 ──
    @staticmethod
    async def _check_http(base_url: str) -> CheckResult:
        models_url = base_url.rstrip("/") + "/models"
        try:
            async with httpx.AsyncClient(timeout=ConnectivityChecker.TIMEOUT_HTTP) as client:
                resp = await client.get(models_url)
                status_code = resp.status_code

                if status_code == 200:
                    return CheckResult(
                        check_id="N-03",
                        name="HTTP 探测",
                        status="pass",
                        detail=f"GET /models 返回 200 OK（服务可达且认证通过）",
                        suggestion="无需操作",
                        fixable=False,
                    )
                elif status_code == 401:
                    return CheckResult(
                        check_id="N-03",
                        name="HTTP 探测",
                        status="warn",
                        detail=f"GET /models 返回 401 Unauthorized（端点可达但认证失败）",
                        suggestion="API Key 可能无效或已过期，请检查密钥配置",
                    )
                elif status_code == 429:
                    return CheckResult(
                        check_id="N-03",
                        name="HTTP 探测",
                        status="warn",
                        detail=f"GET /models 返回 429 Too Many Requests（请求频率受限）",
                        suggestion="请求过于频繁，请稍后重试或升级套餐",
                    )
                elif status_code == 404:
                    return CheckResult(
                        check_id="N-03",
                        name="HTTP 探测",
                        status="warn",
                        detail=f"GET /models 返回 404 Not Found（端点不支持 /models）",
                        suggestion="部分提供商不暴露 /models 端点，这不影响正常使用",
                        fixable=False,
                    )
                elif 400 <= status_code < 500:
                    return CheckResult(
                        check_id="N-03",
                        name="HTTP 探测",
                        status="warn",
                        detail=f"GET /models 返回客户端错误 HTTP {status_code}",
                        suggestion=f"请检查 API 地址和认证信息，状态码: {status_code}",
                    )
                else:
                    return CheckResult(
                        check_id="N-03",
                        name="HTTP 探测",
                        status="fail",
                        detail=f"GET /models 返回服务器错误 HTTP {status_code}",
                        suggestion=f"远程服务异常，状态码: {status_code}，请联系服务商",
                    )

        except httpx.TimeoutException:
            return CheckResult(
                check_id="N-03",
                name="HTTP 探测",
                status="fail",
                detail=f"HTTP 请求超时 ({ConnectivityChecker.TIMEOUT_HTTP}s)",
                suggestion="服务器响应过慢，请检查网络延迟或尝试更换端点",
            )
        except httpx.ConnectError as e:
            return CheckResult(
                check_id="N-03",
                name="HTTP 探测",
                status="fail",
                detail=f"HTTP 连接失败: {e}",
                suggestion="无法建立到 API 服务器的连接，请检查 Base URL 和网络",
            )
        except Exception as e:
            return CheckResult(
                check_id="N-03",
                name="HTTP 探测",
                status="fail",
                detail=f"HTTP 探测异常: {type(e).__name__}: {e}",
                suggestion="请检查网络和 API 端点配置",
            )


# ══════════════════════════════════════════════
# Level 3: 能力验证
# ══════════════════════════════════════════════


class CapabilityChecker:
    """能力验证 — 实际发送推理请求，<15s"""

    PROBE_TIMEOUT = 15.0  # 总超时

    @staticmethod
    async def check_all(config_results: list[CheckResult], conn_results: list[CheckResult]) -> list[CheckResult]:
        """
        仅在前两级无 fail 时执行能力验证。
        如果 L1 或 L2 有 fail，返回 skip。
        """
        has_l1_fail = any(r.status == "fail" and r.check_id.startswith("C-") for r in config_results)
        has_l2_fail = any(r.status == "fail" and r.check_id.startswith("N-") for r in conn_results)

        if has_l1_fail or has_l2_fail:
            reason = "L1 配置校验有失败项" if has_l1_fail else ""
            if has_l2_fail:
                reason += (" 和 " if reason else "") + "L2 连通性检测有失败项"
            return [CheckResult(
                check_id="P-01",
                name="最小推理测试",
                status="skip",
                detail=f"跳过能力验证（{reason}）",
                suggestion="请先修复上述配置/连通性问题后再进行能力验证",
                fixable=False,
            )]

        return [await CapabilityChecker._probe_inference()]

    # ── P-01: 最小推理测试 ──
    @staticmethod
    async def _probe_inference() -> CheckResult:
        start = time.monotonic()
        try:
            # 使用 llm_service 发送最简推理请求
            messages = [LLMMessage(role="user", content="Hi")]
            probe_config = LLMConfig(
                provider=llm_service.config.provider,
                api_key=llm_service.config.api_key,
                base_url=llm_service.config.base_url,
                model=llm_service.config.model,
                max_tokens=5,
                temperature=0,
                timeout=CapabilityChecker.PROBE_TIMEOUT,
            )

            # 临时替换 config 发送探测请求
            original_config = llm_service.config
            llm_service.config = probe_config
            try:
                result = await llm_service.chat(messages)
            finally:
                llm_service.config = original_config

            latency_ms = round((time.monotonic() - start) * 1000)
            content_preview = result.content[:50].replace("\n", " ")

            return CheckResult(
                check_id="P-01",
                name="最小推理测试",
                status="pass",
                detail=f"推理成功（延迟 {latency_ms}ms，回复: \"{content_preview}\"）",
                suggestion="LLM 服务完全可用",
                fixable=False,
            )

        except RuntimeError as e:
            latency_ms = round((time.monotonic() - start) * 1000)
            err_msg = str(e)
            if "401" in err_msg or "Unauthorized" in err_msg or "认证" in err_msg:
                return CheckResult(
                    check_id="P-01",
                    name="最小推理测试",
                    status="fail",
                    detail=f"推理认证失败（{latency_ms}ms）: {err_msg[:120]}",
                    suggestion="API Key 无效或权限不足，请重新获取有效的 API Key",
                )
            elif "429" in err_msg or "频率" in err_msg or "Too Many" in err_msg:
                return CheckResult(
                    check_id="P-01",
                    name="最小推理测试",
                    status="warn",
                    detail=f"推理频率限制（{latency_ms}ms）: {err_msg[:120]}",
                    suggestion="API 调用频率超限，请等待冷却后重试或升级套餐",
                )
            elif "timeout" in err_msg.lower() or "超时" in err_msg:
                return CheckResult(
                    check_id="P-01",
                    name="最小推理测试",
                    status="fail",
                    detail=f"推理超时（>{CapabilityChecker.PROBE_TIMEOUT}s）: {err_msg[:120]}",
                    suggestion="服务响应过慢，请检查网络或更换更快的模型/端点",
                )
            else:
                return CheckResult(
                    check_id="P-01",
                    name="最小推理测试",
                    status="fail",
                    detail=f"推理失败（{latency_ms}ms）: {err_msg[:150]}",
                    suggestion="请查看详细日志排查问题",
                )
        except httpx.TimeoutException:
            latency_ms = round((time.monotonic() - start) * 1000)
            return CheckResult(
                check_id="P-01",
                name="最小推理测试",
                status="fail",
                detail=f"推理请求超时（{latency_ms}ms > {CapabilityChecker.PROBE_TIMEOUT}s）",
                suggestion="LLM 服务响应超时，请检查网络或降低超时阈值",
            )
        except httpx.ConnectError as e:
            latency_ms = round((time.monotonic() - start) * 1000)
            return CheckResult(
                check_id="P-01",
                name="最小推理测试",
                status="fail",
                detail=f"推理连接失败（{latency_ms}ms）: {e}",
                suggestion="无法连接到 LLM 服务端点，请检查 Base URL 和网络",
            )
        except Exception as e:
            latency_ms = round((time.monotonic() - start) * 1000)
            return CheckResult(
                check_id="P-01",
                name="最小推理测试",
                status="fail",
                detail=f"推理异常（{latency_ms}ms）: {type(e).__name__}: {e}",
                suggestion="未知错误，请检查日志获取详细信息",
            )


# ══════════════════════════════════════════════
# 诊断引擎主类
# ══════════════════════════════════════════════


class DiagnosticEngine:
    """
    AI 服务三级诊断引擎

    异步并行执行 L1+L2，L3 仅在前两级通过后执行。
    """

    async def run_full_diagnosis(self) -> DiagnosticReport:
        """执行完整的三级诊断"""
        from datetime import datetime, timezone

        logger.info("[DiagnosticEngine] 开始全量诊断...")

        t0 = time.monotonic()

        # L1: 静态配置校验（同步，极快）
        config_results = ConfigChecker.check_all()

        # L2: 连通性探测（异步）
        conn_results = await ConnectivityChecker.check_all()

        # L1 + L2 并行已在上面顺序完成（L1 是同步的，L2 内部并行）
        # L3: 能力验证（仅在 L1/L2 无 fail 时）
        capa_results = await CapabilityChecker.check_all(config_results, conn_results)

        elapsed_ms = round((time.monotonic() - t0) * 1000)
        report = self.assemble_report(config_results, conn_results, capa_results)

        logger.info(
            "[DiagnosticEngine] 诊断完成 — overall=%s score=%d "
            "pass=%d warn=%d fail=%d耗时=%.0fms",
            report.overall,
            report.score,
            report.total_pass,
            report.total_warn,
            report.total_fail,
            elapsed_ms,
        )

        return report

    def assemble_report(
        self,
        config_results: list[CheckResult],
        conn_results: list[CheckResult],
        capa_results: list[CheckResult],
    ) -> DiagnosticReport:
        """
        合并三级结果，计算 overall 和 score。

        score 公式: (pass*100 + warn*50 + fail*0) / total * 100
        overall 规则:
          - 全部 pass => healthy
          - 有 fail 且无 pass => critical
          - 其他 => degraded
        """
        from datetime import datetime, timezone

        all_checks = config_results + conn_results + capa_results

        total = len(all_checks)
        if total == 0:
            return DiagnosticReport(
                overall="critical",
                score=0,
                timestamp_iso=datetime.now(timezone.utc).isoformat(),
                checks=[],
            )

        total_pass = sum(1 for c in all_checks if c.status == "pass")
        total_warn = sum(1 for c in all_checks if c.status == "warn")
        total_fail = sum(1 for c in all_checks if c.status == "fail")

        # 计算分数
        score = int((total_pass * 100 + total_warn * 50) / total)

        # 判定整体状态
        if total_fail == 0 and total_warn == 0:
            overall: Literal["healthy", "degraded", "critical"] = "healthy"
        elif total_fail > 0 and total_pass == 0:
            overall = "critical"
        else:
            overall = "degraded"

        return DiagnosticReport(
            overall=overall,
            score=score,
            timestamp_iso=datetime.now(timezone.utc).isoformat(),
            checks=all_checks,
        )
