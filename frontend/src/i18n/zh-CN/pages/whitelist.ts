/**
 * 中文「白名单申请」模块翻译
 */
export default {
  whitelist: {
    loginEntry: '申请准入',
    loginEntrySub: '白名单 · 优先体验',
    pageTitle: '申请白名单',
    pageSubtitle: '本轮申请通道将于 {{date}} 截止',
    windowCountdownLabel: '本轮申请通道剩余',
    windowAnnounced: '预计剩余 {{minutes}} 分钟',
    windowClosed: '本轮申请已结束，请关注后续开放',
    backToLogin: '返回登录',

    // ── 表单 ──
    form: {
      email: '邮箱',
      emailPlaceholder: 'you@company.com',
      emailRequired: '请输入有效的邮箱地址',
      fullName: '姓名',
      fullNamePlaceholder: '您的姓名',
      fullNameRequired: '请输入姓名',
      organization: '单位',
      organizationPlaceholder: '所在单位/部门',
      organizationRequired: '请输入单位/部门',
      reason: '申请理由（选填）',
      reasonPlaceholder: '简要说明您的使用场景',
      consent: '我已阅读并同意《隐私政策》，授权将上述信息用于账号开通审核',
      consentRequired: '请先阅读并同意隐私政策',
      captcha: '人机验证',
      captchaPlaceholder: '输入图中字符',
      captchaRefresh: '换一张',
      captchaRequired: '请输入验证码',
      captchaLoading: '验证码加载中…',
      submit: '提交申请',
      submitting: '提交中…',
    },

    // ── 邮箱验证 ──
    verify: {
      title: '邮箱验证',
      desc: '验证码已发送至 {{email}}，10 分钟内有效',
      placeholder: '6 位验证码',
      resend: '重新发送（{{seconds}}s）',
      resendNow: '重新发送',
      verify: '确认验证',
      verifying: '验证中…',
      expired: '验证码已过期，请重新发送',
      devCodeHint: '开发模式验证码',
      emailSendFailed: '验证码邮件发送失败，请稍后重试或联系管理员。',
      resendSuccess: '新验证码已发送至 {{email}}。',
      checkSpam: '未收到邮件？请检查垃圾邮件文件夹。',
    },

    // ── 提交成功 / 审核中 ──
    success: {
      title: '申请已提交',
      desc: '审核结果将在 1-2 个工作日内邮件通知您',
      requestId: '申请编号',
      reviewing: '审核中',
      reviewDeadline: '预计审核截止',
      cooldown: '请勿重复提交，如需修改可于 {{days}} 天后重新申请',
    },

    // ── 审核结果 ──
    status: {
      reviewing: '审核中',
      approved: '恭喜，您已获得白名单准入',
      rejected: '很抱歉，本次申请未通过',
      rejectedReason: '原因',
      expired: '该申请已过期，可重新提交申请',
      cooldownHint: '您可在 {{days}} 天后重新申请',
    },

    // ── 状态查询 ──
    lookup: {
      title: '查询申请进度',
      tokenPlaceholder: '输入申请编号或状态 token',
      query: '查询',
      error: '未找到对应申请，请核对申请编号或状态查询 token',
    },

    // ── 剩余名额 ──
    quota: {
      label: '剩余名额',
      value: '{{remaining}} / {{total}}',
      loading: '剩余名额加载中…',
      full: '本轮名额已满，请关注下一轮开放',
    },

    // ── 错误 ──
    errors: {
      alreadyRegistered: '该邮箱已注册，请直接登录',
      alreadyApplied: '该邮箱已提交申请，请等待审核',
      rateLimited: '操作过于频繁，请 {{seconds}} 秒后再试',
      network: '网络异常，请稍后重试',
      unknown: '操作失败，请稍后重试',
      invalidCaptcha: '人机验证码错误或已过期，请重新输入',
      invalidCode: '验证码错误，请重新输入',
      codeExpired: '验证码已过期，请重新发送',
      tooManyAttempts: '验证失败次数过多，请重新发送验证码',
      alreadyVerified: '该申请已完成邮箱验证',
    },
  },
}