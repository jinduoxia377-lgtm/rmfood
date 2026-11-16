/**
 * Whitelist application page — English translation
 */
export default {
  whitelist: {
    loginEntry: 'Request Access',
    loginEntrySub: 'Whitelist · Priority Access',
    pageTitle: 'Whitelist Application',
    pageSubtitle: 'Applications close {{date}} (CST)',
    windowCountdownLabel: 'This round closes in',
    windowAnnounced: 'Approximately {{minutes}} minutes remaining',
    windowClosed: 'This round has closed. Stay tuned for future openings.',
    backToLogin: 'Back to Login',

    form: {
      email: 'Email',
      emailPlaceholder: 'you@company.com',
      emailRequired: 'Please enter a valid email address',
      fullName: 'Full Name',
      fullNamePlaceholder: 'Your name',
      fullNameRequired: 'Please enter your full name',
      organization: 'Organization',
      organizationPlaceholder: 'Company / department',
      organizationRequired: 'Please enter your organization',
      reason: 'Reason for Applying (optional)',
      reasonPlaceholder: 'Briefly describe your use case',
      consent: 'I have read and agree to the Privacy Policy and consent to the use of my information for account activation review',
      consentRequired: 'Please read and agree to the Privacy Policy first',
      captcha: 'Human Verification',
      captchaPlaceholder: 'Enter the characters shown',
      captchaRefresh: 'Refresh',
      captchaRequired: 'Please enter the captcha',
      captchaLoading: 'Loading captcha…',
      submit: 'Submit Application',
      submitting: 'Submitting…',
    },

    verify: {
      title: 'Email Verification',
      desc: 'A code has been sent to {{email}}, valid for 10 minutes',
      placeholder: '6-digit code',
      resend: 'Resend ({{seconds}}s)',
      resendNow: 'Resend',
      verify: 'Verify',
      verifying: 'Verifying…',
      expired: 'The code has expired. Please request a new one.',
      devCodeHint: 'Dev-mode verification code',
      emailSendFailed: 'Failed to send the verification email. Please retry or contact the administrator.',
      resendSuccess: 'A new verification code was sent to {{email}}.',
      checkSpam: "Didn't receive it? Please check your spam/junk folder.",
    },

    success: {
      title: 'Application Submitted',
      desc: 'You will be notified by email within 1-2 business days',
      requestId: 'Application ID',
      reviewing: 'Under Review',
      reviewDeadline: 'Review deadline',
      cooldown: 'Please do not submit again. You may re-apply in {{days}} days.',
    },

    status: {
      reviewing: 'Under Review',
      approved: 'Congratulations, you have been granted whitelist access',
      rejected: 'Sorry, your application was not approved',
      rejectedReason: 'Reason',
      expired: 'This application has expired. You may submit a new one.',
      cooldownHint: 'You may re-apply in {{days}} days.',
    },

    lookup: {
      title: 'Check Application Status',
      tokenPlaceholder: 'Enter application ID or status token',
      query: 'Check',
      error: 'Application not found. Check your application ID or status token.',
    },

    quota: {
      label: 'Remaining Slots',
      value: '{{remaining}} / {{total}}',
      loading: 'Loading remaining slots…',
      full: 'This round is full. Please check for the next round.',
    },

    errors: {
      alreadyRegistered: 'This email is already registered. Please log in.',
      alreadyApplied: 'This email has already applied. Please wait for review.',
      rateLimited: 'Too many requests. Please try again in {{seconds}} seconds.',
      network: 'Network error. Please try again later.',
      unknown: 'Something went wrong. Please try again later.',
      invalidCaptcha: 'The verification code is incorrect or has expired. Please try again.',
      invalidCode: 'Incorrect verification code. Please try again.',
      codeExpired: 'The verification code has expired. Please request a new one.',
      tooManyAttempts: 'Too many failed attempts. Please request a new code.',
      alreadyVerified: 'This application has already been verified.',
    },
  },
}