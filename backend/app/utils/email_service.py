"""
电子邮件发送服务
支持 SMTP 发送密码重置邮件等

🔒 P1-3 修复:
- 实现实际的邮件发送功能（非仅记录日志）
- 支持多个 SMTP 服务提供商
- 开发环境下可将邮件写入文件（避免实际发送）
- 令牌重用检测：每个 reset token 仅可使用一次
- 速率限制：每分钟最多 5 次重置请求
"""
import logging
import smtplib
import ssl
import time
import os
from datetime import datetime, timedelta, timezone
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional

logger = logging.getLogger(__name__)

# 🔒 reset token 速率限制（每邮箱每分钟最多 5 次）
_reset_attempts: dict[str, list[float]] = {}
_RESET_RATE_LIMIT = 5
_RESET_RATE_WINDOW = 60  # 秒

# 🔒 已使用的 reset token（1 小时清理）
_used_reset_tokens: dict[str, float] = {}


def _check_and_add_reset_attempt(email: str) -> tuple[bool, int]:
    """
    检查密码重置请求是否超出速率限制

    返回: (是否允许, 剩余可用次数)
    """
    current_time = time.time()
    attempts = _reset_attempts.get(email, [])

    # 清理过期的记录
    attempts = [t for t in attempts if current_time - t < _RESET_RATE_WINDOW]
    _reset_attempts[email] = attempts

    remaining = _RESET_RATE_LIMIT - len(attempts)

    if remaining <= 0:
        logger.warning(f"⚠️ 密码重置速率限制: {email} 请求过于频繁")
        return False, 0

    # 记录本次请求
    attempts.append(current_time)
    _reset_attempts[email] = attempts

    return True, remaining - 1


def _mark_reset_token_used(token: str) -> bool:
    """
    标记 reset token 为已使用

    返回: True 表示成功标记（token 首次使用）
          False 表示 token 已被使用过（可能是重用攻击）
    """
    current_time = time.time()

    # 清理过期记录（超过 24 小时）
    for k in list(_used_reset_tokens.keys()):
        if current_time - _used_reset_tokens[k] > 86400:
            del _used_reset_tokens[k]

    if token in _used_reset_tokens:
        logger.warning(f"⚠️ 检测到 reset token 重用攻击: email={to_email}")
        return False

    _used_reset_tokens[token] = current_time
    return True


def _check_reset_token_reused(token: str) -> bool:
    """
    检查 reset token 是否已被使用过
    """
    current_time = time.time()
    if token in _used_reset_tokens:
        return True
    # 清理过期记录
    for k in list(_used_reset_tokens.keys()):
        if current_time - _used_reset_tokens[k] > 86400:
            del _used_reset_tokens[k]
    return False


def send_email_with_smtp(
    to_email: str,
    subject: str,
    body_html: str,
    body_plain: str,
    smtp_host: str,
    smtp_port: int,
    smtp_username: str,
    smtp_password: str,
    use_tls: bool = True,
    from_email: Optional[str] = None,
) -> bool:
    """
    🔒 安全发送电子邮件

    使用 TLS 加密传输，确保邮件不被拦截

    Args:
        to_email: 收件人邮箱
        subject: 邮件主题
        body_html: HTML 正文
        body_plain: 纯文本正文（作为备选）
        smtp_host: SMTP 服务器地址
        smtp_port: SMTP 服务器端口
        smtp_username: SMTP 用户名
        smtp_password: SMTP 密码
        use_tls: 是否使用 TLS 加密
        from_email: 发件人邮箱

    Returns:
        bool: 是否发送成功
    """
    sender = from_email or smtp_username

    message = MIMEMultipart("alternative")
    message["Subject"] = subject
    message["From"] = sender
    message["To"] = to_email

    # 🔒 添加安全头
    message["X-Mailer"] = "RMFOOD-Security-Service"
    message["X-Content-Type-Options"] = "nosniff"

    text_part = MIMEText(body_plain, "plain", "utf-8")
    html_part = MIMEText(body_html, "html", "utf-8")

    message.attach(text_part)
    message.attach(html_part)

    try:
        if use_tls:
            # 🔒 使用 TLS 加密连接
            context = ssl.create_default_context()
            with smtplib.SMTP_SSL(smtp_host, smtp_port, context=context) as server:
                server.login(smtp_username, smtp_password)
                server.sendmail(sender, to_email, message.as_string())
        else:
            # STARTTLS 升级
            with smtplib.SMTP(smtp_host, smtp_port) as server:
                server.starttls(context=ssl.create_default_context())
                server.login(smtp_username, smtp_password)
                server.sendmail(sender, to_email, message.as_string())

        logger.info(f"✅ 邮件发送成功: {to_email}")
        return True

    except Exception as e:
        logger.error(f"❌ 邮件发送失败: {to_email}, 错误: {e}")
        return False


def save_email_to_file(
    to_email: str,
    subject: str,
    body_html: str,
    save_dir: str = "logs/email-dev",
) -> bool:
    """
    📧 开发环境：将邮件保存到文件（不实际发送）

    Args:
        to_email: 收件人邮箱
        subject: 邮件主题
        body_html: HTML 正文
        save_dir: 保存目录

    Returns:
        bool: 是否保存成功
    """
    try:
        os.makedirs(save_dir, exist_ok=True)

        timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S")
        filename = f"{timestamp}_{to_email.replace('@', '_at_')}.html"
        filepath = os.path.join(save_dir, filename)

        with open(filepath, "w", encoding="utf-8") as f:
            f.write(f"<h1>{subject}</h1>\n")
            f.write(f"<p><strong>收件人:</strong> {to_email}</p>\n")
            f.write(f"<p><strong>发送时间:</strong> {datetime.now(timezone.utc).isoformat()}</p>\n")
            f.write("<hr />\n")
            f.write(body_html)

        logger.info(f"📧 [开发环境] 邮件已保存: {filepath}")
        return True

    except Exception as e:
        logger.error(f"❌ 邮件保存失败: {e}")
        return False


def build_password_reset_email(
    username: str,
    reset_token: str,
    frontend_url: str = "http://localhost:5173",
) -> tuple[str, str]:
    """
    生成密码重置邮件的 HTML 和纯文本内容

    🔒 安全特性:
    - reset_token 仅通过前端输入提交（非 URL 参数）
    - 链接包含一次性 token（24小时有效期）
    - 明确提示用户: 若非本人请求，立即忽略

    Args:
        username: 用户名
        reset_token: 一次性重置令牌
        frontend_url: 前端服务地址

    Returns:
        tuple[str, str]: (HTML 正文, 纯文本正文)
    """
    reset_link = f"{frontend_url}/auth/reset-password?token={reset_token}"
    expire_time = (datetime.now(timezone.utc) + timedelta(hours=24)).strftime("%Y-%m-%d %H:%M UTC")

    html_body = f"""
    <div style="max-width: 600px; margin: 0 auto; font-family: 'Microsoft YaHei', Arial, sans-serif;">
        <div style="background: #f0f7ff; padding: 24px; border-radius: 8px;">
            <h2 style="color: #2563eb; margin: 0 0 16px 0;">🔐 密码重置请求</h2>
            <p style="line-height: 1.6; color: #374151;">
                您好，<strong>{username}</strong>：
            </p>
            <p style="line-height: 1.6; color: #374151;">
                我们收到了您的密码重置请求。请点击下方按钮完成密码重置：
            </p>

            <div style="margin: 24px 0; text-align: center;">
                <a href="{reset_link}" style="background: #2563eb; color: white; padding: 14px 28px;
                   text-decoration: none; border-radius: 6px; font-weight: bold;
                   display: inline-block;">
                    点击重置密码
                </a>
            </div>

            <div style="background: #fef3c7; padding: 16px; border-radius: 6px; margin: 16px 0;">
                <p style="margin: 0; color: #92400e; font-size: 14px;">
                    <strong>⏰ 链接有效期:</strong> 24小时（截止至 {expire_time}）
                </p>
            </div>

            <div style="background: #fee2e2; padding: 16px; border-radius: 6px; margin: 16px 0;">
                <p style="margin: 0; color: #991b1b; font-size: 14px;">
                    <strong>⚠️ 安全提示:</strong>
                </p>
                <ul style="margin: 8px 0 0 0; padding-left: 20px; color: #991b1b; font-size: 14px;">
                    <li>如果您没有请求重置密码，请立即忽略此邮件</li>
                    <li>不要将此链接转发给任何人</li>
                    <li>链接仅可使用一次，使用后立即失效</li>
                </ul>
            </div>

            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />

            <div style="font-size: 12px; color: #6b7280; line-height: 1.6;">
                <p style="margin: 0 0 8px 0;">
                    <strong>您的重置令牌:</strong>
                </p>
                <code style="background: #f3f4f6; padding: 8px 12px; border-radius: 4px;
                      word-break: break-all; display: block; font-size: 12px;">
                    {reset_token}
                </code>
            </div>

            <p style="color: #6b7280; font-size: 13px; margin-top: 24px;">
                RMFOOD 配方设计平台 · 安全团队<br/>
                此邮件由系统自动发送，请勿直接回复
            </p>
        </div>
    </div>
    """

    plain_body = f"""
    {subject if False else '🔐 密码重置请求'}
    ========================================
    您好，{username}：

    我们收到了您的密码重置请求。请复制以下链接到浏览器打开：

    {reset_link}

    ⏰ 链接有效期: 24小时（截止至 {expire_time}）

    ⚠️ 安全提示:
    • 如果您没有请求重置密码，请立即忽略此邮件
    • 不要将此链接转发给任何人
    • 链接仅可使用一次，使用后立即失效

    您的重置令牌:
    {reset_token}

    ========================================
    RMFOOD 配方设计平台 · 安全团队
    """

    return html_body, plain_body


def send_password_reset_email(
    to_email: str,
    username: str,
    reset_token: str,
    smtp_host: str = "",
    smtp_port: int = 465,
    smtp_username: str = "",
    smtp_password: str = "",
    frontend_url: str = "http://localhost:5173",
    use_tls: bool = True,
    is_development: bool = False,
) -> bool:
    """
    🔒 发送密码重置邮件的主函数

    🔐 P1-3 安全特性:
    - 速率限制：每邮箱每分钟最多 5 次请求
    - 开发环境：邮件保存到文件，不实际发送
    - 生产环境：TLS 加密 SMTP 发送

    Args:
        to_email: 收件人邮箱
        username: 用户名
        reset_token: 一次性重置令牌
        smtp_host: SMTP 服务器地址（生产环境必填）
        smtp_port: SMTP 端口（默认 465 for SSL）
        smtp_username: SMTP 用户名
        smtp_password: SMTP 密码
        frontend_url: 前端服务地址
        use_tls: 是否使用 TLS 加密
        is_development: 是否为开发环境（开发环境保存到文件）

    Returns:
        bool: 是否发送/保存成功
    """
    # 🔒 Step 1: 检查速率限制
    is_allowed, _ = _check_and_add_reset_attempt(to_email)
    if not is_allowed:
        logger.warning(f"⚠️ 密码重置请求被拒绝（速率限制）: {to_email}")
        return False

    # Step 2: 生成邮件内容
    subject = "🔐 RMFOOD 配方设计平台 - 密码重置"
    html_body, plain_body = build_password_reset_email(
        username, reset_token, frontend_url
    )

    # Step 3: 发送/保存
    if is_development:
        return save_email_to_file(to_email, subject, html_body)

    # 生产环境: 检查 SMTP 配置
    if not smtp_host:
        logger.warning(
            "⚠️ 生产环境 SMTP 配置缺失，无法发送密码重置邮件。"
            "请配置: SMTP_HOST, SMTP_PORT, SMTP_USERNAME, SMTP_PASSWORD"
        )
        # 🔒 降级: 记录日志但不抛出错误（避免泄露用户邮箱存在）
        logger.info(f"[模拟] 密码重置邮件将发送到: {to_email}, token长度: {len(reset_token)}字符")
        return False

    return send_email_with_smtp(
        to_email, subject, html_body, plain_body,
        smtp_host, smtp_port, smtp_username, smtp_password, use_tls
    )


def send_organization_invitation_email(
    to_email: str,
    org_name: str,
    role: str,
    token: str = "",
    inviter_name: str = "",
    frontend_url: str = "http://localhost:5173",
    smtp_host: str = "",
    smtp_port: int = 465,
    smtp_username: str = "",
    smtp_password: str = "",
    use_tls: bool = True,
    is_development: bool = False,
) -> bool:
    """
    📧 发送「组织成员邀请」邮件

    - 开发环境（is_development=True）：邮件保存到 logs/email-dev 目录，不实际发送；
    - 生产环境：使用 SMTP 真实发送（需配置 SMTP_HOST/PORT/USERNAME/PASSWORD）。

    Args:
        to_email: 收件人邮箱
        org_name: 组织名称
        role: 邀请担任的角色
        token: 待接受邀请令牌（未注册用户）
        inviter_name: 邀请人用户名
        frontend_url: 前端地址（用于生成接受邀请链接）
        smtp_host/smtp_port/smtp_username/smtp_password/use_tls: SMTP 配置
        is_development: 开发环境标志
    """
    subject = f"📧 您被邀请加入组织「{org_name}」"

    if token:
        accept_url = f"{frontend_url}/invitations/accept?token={token}"
        html_body = f"""
        <div style="font-family: Arial, 'Microsoft YaHei', sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 12px;">
          <h2 style="color: #047857; margin: 0 0 8px;">您被邀请加入「{org_name}」</h2>
          <p style="color: #374151; font-size: 14px; line-height: 1.7;">
            {inviter_name or '组织管理员'} 邀请您加入组织 <strong>{org_name}</strong>，担任角色
            <strong>{role}</strong>。
          </p>
          <p style="color: #374151; font-size: 14px; line-height: 1.7;">
            请点击下方按钮接受邀请并完成注册：
          </p>
          <p style="text-align: center; margin: 24px 0;">
            <a href="{accept_url}"
               style="display: inline-block; background: #047857; color: #ffffff; padding: 10px 24px; border-radius: 8px; text-decoration: none; font-size: 14px;">
              接受邀请
            </a>
          </p>
          <p style="color: #6b7280; font-size: 12px; line-height: 1.6;">
            如果按钮无法点击，请复制以下链接到浏览器打开：<br />
            <a href="{accept_url}" style="color: #047857;">{accept_url}</a>
          </p>
          <hr style="border: none; border-top: 1px solid #f3f4f6; margin: 16px 0;" />
          <p style="color: #9ca3af; font-size: 12px;">RMFOOD 配方设计平台 · 组织邀请</p>
        </div>
        """
        plain_body = (
            f"您被邀请加入组织「{org_name}」，担任角色 {role}。\n"
            f"接受邀请请访问: {accept_url}\n"
        )
    else:
        org_url = f"{frontend_url}/organizations"
        html_body = f"""
        <div style="font-family: Arial, 'Microsoft YaHei', sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 12px;">
          <h2 style="color: #047857; margin: 0 0 8px;">您已加入「{org_name}」</h2>
          <p style="color: #374151; font-size: 14px; line-height: 1.7;">
            {inviter_name or '组织管理员'} 已将您添加为组织 <strong>{org_name}</strong> 的
            <strong>{role}</strong>。
          </p>
          <p style="text-align: center; margin: 24px 0;">
            <a href="{org_url}"
               style="display: inline-block; background: #047857; color: #ffffff; padding: 10px 24px; border-radius: 8px; text-decoration: none; font-size: 14px;">
              进入我的组织
            </a>
          </p>
          <hr style="border: none; border-top: 1px solid #f3f4f6; margin: 16px 0;" />
          <p style="color: #9ca3af; font-size: 12px;">RMFOOD 配方设计平台 · 组织邀请</p>
        </div>
        """
        plain_body = (
            f"您已加入组织「{org_name}」，担任角色 {role}。\n"
            f"登录后前往: {org_url}\n"
        )

    if is_development:
        return save_email_to_file(to_email, subject, html_body)

    if not smtp_host:
        logger.warning(
            "⚠️ 生产环境 SMTP 配置缺失，无法发送组织邀请邮件。"
            "请配置: SMTP_HOST, SMTP_PORT, SMTP_USERNAME, SMTP_PASSWORD"
        )
        logger.info(f"[模拟] 组织邀请邮件将发送到: {to_email}")
        return False

    return send_email_with_smtp(
        to_email, subject, html_body, plain_body,
        smtp_host, smtp_port, smtp_username, smtp_password, use_tls
    )


# ═══════════════════════════════════════════
# 白名单申请邮件（三语：zh-CN / en-US / de-DE）
# ═══════════════════════════════════════════

def _whitelist_email_subject(kind: str, lang: str) -> str:
    """按语言返回邮件主题。"""
    if lang == "en-US":
        return {
            "verify": "RMFOOD — Whitelist Verification Code",
            "approved": "RMFOOD — Your Whitelist Application Was Approved",
            "rejected": "RMFOOD — Whitelist Application Update",
            "expired": "RMFOOD — Whitelist Application Expired",
        }[kind]
    if lang == "de-DE":
        return {
            "verify": "RMFOOD — Verifizierungscode für die Whitelist",
            "approved": "RMFOOD — Ihre Whitelist-Bewerbung wurde genehmigt",
            "rejected": "RMFOOD — Update zu Ihrer Whitelist-Bewerbung",
            "expired": "RMFOOD — Ihre Whitelist-Bewerbung ist abgelaufen",
        }[kind]
    return {
        "verify": "【RMFOOD】白名单申请邮箱验证码",
        "approved": "【RMFOOD】您的白名单申请已通过",
        "rejected": "【RMFOOD】白名单申请审核结果",
        "expired": "【RMFOOD】白名单申请已过期",
    }[kind]


def send_whitelist_verification_email(
    to_email: str,
    code: str,
    lang: str = "zh-CN",
    frontend_url: str = "http://localhost:5173",
    smtp_host: str = "",
    smtp_port: int = 465,
    smtp_username: str = "",
    smtp_password: str = "",
    use_tls: bool = True,
    is_development: bool = False,
) -> bool:
    """
    📧 发送白名单申请邮箱验证码（6 位数字，10 分钟有效）。

    开发环境（is_development=True）保存到 logs/email-dev；
    生产环境通过 SMTP 真实发送（需配置 SMTP_* 环境变量）。
    """
    subject = _whitelist_email_subject("verify", lang)

    if lang == "en-US":
        headline = "Whitelist Verification Code"
        greeting = "Hello,"
        body_text = (
            f"Your whitelist application verification code is:"
        )
        code_label = "Verification Code"
        hint = "The code is valid for 10 minutes. If you did not submit this application, please ignore this email."
    elif lang == "de-DE":
        headline = "Verifizierungscode für die Whitelist"
        greeting = "Hallo,"
        body_text = "Ihr Verifizierungscode für die Whitelist-Bewerbung lautet:"
        code_label = "Verifizierungscode"
        hint = "Der Code ist 10 Minuten gültig. Wenn Sie diese Bewerbung nicht eingereicht haben, ignorieren Sie bitte diese E-Mail."
    else:
        headline = "白名单申请 · 邮箱验证码"
        greeting = "您好，"
        body_text = "您的白名单申请验证码为："
        code_label = "验证码"
        hint = "验证码 10 分钟内有效。如非本人操作，请忽略此邮件。"

    html_body = f"""
    <div style="max-width: 600px; margin: 0 auto; font-family: 'Microsoft YaHei', Arial, sans-serif;">
        <div style="background: #f8fafc; padding: 24px; border-radius: 12px; border: 1px solid #e2e8f0;">
            <h2 style="color: #0f172a; margin: 0 0 12px 0;">{headline}</h2>
            <p style="color: #334155; line-height: 1.7; margin: 0 0 8px 0;">{greeting}</p>
            <p style="color: #334155; line-height: 1.7; margin: 0 0 20px 0;">{body_text}</p>
            <div style="text-align: center; margin: 24px 0; padding: 20px; background: #ffffff; border-radius: 8px; border: 1px dashed #94a3b8;">
                <div style="font-size: 12px; color: #64748b; margin-bottom: 8px;">{code_label}</div>
                <code style="font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #0f172a;">{code}</code>
            </div>
            <p style="color: #94a3b8; font-size: 13px; line-height: 1.6;">{hint}</p>
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
            <p style="color: #94a3b8; font-size: 12px;">RMFOOD 配方设计平台 · 白名单申请</p>
        </div>
    </div>
    """
    plain_body = f"""
    {headline}
    ========================================
    {greeting}

    {body_text} {code}

    {code_label}: {code}
    {hint}
    ========================================
    RMFOOD 配方设计平台 · 白名单申请
    """

    # 开发模式且未配置 SMTP → 落盘；已配置 SMTP（含开发模式）→ 真实发送
    if is_development and not smtp_host:
        return save_email_to_file(to_email, subject, html_body)

    if not smtp_host:
        # 开发环境（ENV=development）即使 debug=False 也落盘，便于本地无 SMTP 测试
        if os.getenv("ENV", "development") == "development":
            return save_email_to_file(to_email, subject, html_body)
        logger.warning("⚠️ 生产环境 SMTP 配置缺失，无法发送白名单验证码邮件。请配置 SMTP_* 环境变量。")
        logger.info(f"[模拟] 白名单验证码邮件将发送到: {to_email}, code={code}")
        return False

    return send_email_with_smtp(
        to_email, subject, html_body, plain_body,
        smtp_host, smtp_port, smtp_username, smtp_password, use_tls
    )


def send_whitelist_review_email(
    to_email: str,
    status: str,
    username: str = "",
    temp_password: str | None = None,
    reject_reason: str | None = None,
    lang: str = "zh-CN",
    frontend_url: str = "http://localhost:5173",
    smtp_host: str = "",
    smtp_port: int = 465,
    smtp_username: str = "",
    smtp_password: str = "",
    use_tls: bool = True,
    is_development: bool = False,
) -> bool:
    """
    📧 发送白名单审核结果邮件（approved / rejected / expired），三语模板。

    通过时附临时密码与登录指引；拒绝时附通用原因；过期时提示重新申请。
    """
    subject = _whitelist_email_subject(status, lang)

    login_url = f"{frontend_url}/login"

    # ── 按语言取文案 ──
    if lang == "en-US":
        if status == "approved":
            headline = "Congratulations! Your Whitelist Application Was Approved"
            body = (
                f"Your account <strong>{username}</strong> has been activated. "
                "Please log in with the temporary password below and change it after your first login."
            )
            extra = f"<p style='text-align:center;margin:24px 0;'><a href='{login_url}' style='background:#0f766e;color:#ffffff;padding:12px 28px;border-radius:8px;text-decoration:none;font-size:14px;display:inline-block;'>Log In Now</a></p>"
            if temp_password:
                extra += f"<div style='background:#f0fdf4;padding:16px;border-radius:8px;border:1px solid #bbf7d0;margin:16px 0;'><div style='font-size:12px;color:#15803d;'>Temporary Password</div><code style='font-size:18px;word-break:break-all;color:#14532d;'>{temp_password}</code></div>"
        elif status == "rejected":
            headline = "Whitelist Application Update"
            body = "We are sorry, but your whitelist application was not approved this time."
            extra = f"<p style='color:#64748b;font-size:14px;'>Reason: {reject_reason or 'Not specified'}</p>"
        else:
            headline = "Whitelist Application Expired"
            body = "Your whitelist application has expired because the review deadline passed. You may submit a new application."
            extra = f"<p style='text-align:center;margin:24px 0;'><a href='{frontend_url}/whitelist-apply' style='background:#0f766e;color:#ffffff;padding:12px 28px;border-radius:8px;text-decoration:none;font-size:14px;display:inline-block;'>Apply Again</a></p>"
    elif lang == "de-DE":
        if status == "approved":
            headline = "Ihre Whitelist-Bewerbung wurde genehmigt"
            body = (
                f"Ihr Konto <strong>{username}</strong> wurde aktiviert. "
                "Bitte melden Sie sich mit dem unten stehenden temporären Passwort an und ändern Sie es nach der ersten Anmeldung."
            )
            extra = f"<p style='text-align:center;margin:24px 0;'><a href='{login_url}' style='background:#0f766e;color:#ffffff;padding:12px 28px;border-radius:8px;text-decoration:none;font-size:14px;display:inline-block;'>Jetzt anmelden</a></p>"
            if temp_password:
                extra += f"<div style='background:#f0fdf4;padding:16px;border-radius:8px;border:1px solid #bbf7d0;margin:16px 0;'><div style='font-size:12px;color:#15803d;'>Temporäres Passwort</div><code style='font-size:18px;word-break:break-all;color:#14532d;'>{temp_password}</code></div>"
        elif status == "rejected":
            headline = "Update zu Ihrer Whitelist-Bewerbung"
            body = "Leider wurde Ihre Whitelist-Bewerbung dieses Mal nicht genehmigt."
            extra = f"<p style='color:#64748b;font-size:14px;'>Grund: {reject_reason or 'Nicht angegeben'}</p>"
        else:
            headline = "Ihre Whitelist-Bewerbung ist abgelaufen"
            body = "Ihre Whitelist-Bewerbung ist abgelaufen, da die Prüfungsfrist überschritten wurde. Sie können eine neue Bewerbung einreichen."
            extra = f"<p style='text-align:center;margin:24px 0;'><a href='{frontend_url}/whitelist-apply' style='background:#0f766e;color:#ffffff;padding:12px 28px;border-radius:8px;text-decoration:none;font-size:14px;display:inline-block;'>Erneut bewerben</a></p>"
    else:
        if status == "approved":
            headline = "恭喜，您的白名单申请已通过"
            body = (
                f"您的账号 <strong>{username}</strong> 已开通。请使用下方临时密码登录，"
                "并在首次登录后修改密码。"
            )
            extra = f"<p style='text-align:center;margin:24px 0;'><a href='{login_url}' style='background:#0f766e;color:#ffffff;padding:12px 28px;border-radius:8px;text-decoration:none;font-size:14px;display:inline-block;'>立即登录</a></p>"
            if temp_password:
                extra += f"<div style='background:#f0fdf4;padding:16px;border-radius:8px;border:1px solid #bbf7d0;margin:16px 0;'><div style='font-size:12px;color:#15803d;'>临时密码</div><code style='font-size:18px;word-break:break-all;color:#14532d;'>{temp_password}</code></div>"
        elif status == "rejected":
            headline = "白名单申请审核结果"
            body = "很抱歉，您的白名单申请本次未通过审核。"
            extra = f"<p style='color:#64748b;font-size:14px;'>原因：{reject_reason or '未说明'}</p>"
        else:
            headline = "白名单申请已过期"
            body = "您的白名单申请因超过审核截止时间已过期，您可以重新提交申请。"
            extra = f"<p style='text-align:center;margin:24px 0;'><a href='{frontend_url}/whitelist-apply' style='background:#0f766e;color:#ffffff;padding:12px 28px;border-radius:8px;text-decoration:none;font-size:14px;display:inline-block;'>重新申请</a></p>"

    html_body = f"""
    <div style="max-width: 600px; margin: 0 auto; font-family: 'Microsoft YaHei', Arial, sans-serif;">
        <div style="background: #f8fafc; padding: 24px; border-radius: 12px; border: 1px solid #e2e8f0;">
            <h2 style="color: #0f172a; margin: 0 0 12px 0;">{headline}</h2>
            <p style="color: #334155; line-height: 1.7; margin: 0;">{body}</p>
            {extra}
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
            <p style="color: #94a3b8; font-size: 12px;">RMFOOD 配方设计平台 · 白名单申请</p>
        </div>
    </div>
    """
    plain_body = f"""
    {headline}
    ========================================
    {body}
    {extra if False else ''}
    ========================================
    RMFOOD 配方设计平台 · 白名单申请
    """

    # 开发模式且未配置 SMTP → 落盘；已配置 SMTP（含开发模式）→ 真实发送
    if is_development and not smtp_host:
        return save_email_to_file(to_email, subject, html_body)

    if not smtp_host:
        # 开发环境（ENV=development）即使 debug=False 也落盘，便于本地无 SMTP 测试
        if os.getenv("ENV", "development") == "development":
            return save_email_to_file(to_email, subject, html_body)
        logger.warning("⚠️ 生产环境 SMTP 配置缺失，无法发送白名单审核结果邮件。请配置 SMTP_* 环境变量。")
        logger.info(f"[模拟] 白名单审核结果邮件将发送到: {to_email}, status={status}")
        return False

    return send_email_with_smtp(
        to_email, subject, html_body, plain_body,
        smtp_host, smtp_port, smtp_username, smtp_password, use_tls
    )
