/**
 * Whitelist-Bewerbungsseite — Deutsche Übersetzung
 */
export default {
  whitelist: {
    loginEntry: 'Zugang beantragen',
    loginEntrySub: 'Whitelist · Vorabzugang',
    pageTitle: 'Whitelist-Bewerbung',
    pageSubtitle: 'Bewerbungsfrist endet am {{date}}',
    windowCountdownLabel: 'Verbleibende Zeit dieser Runde',
    windowAnnounced: 'Voraussichtlich {{minutes}} Minuten verbleibend',
    windowClosed: 'Diese Bewerbungsrunde ist beendet. Bleiben Sie auf dem Laufenden.',
    backToLogin: 'Zurück zur Anmeldung',

    form: {
      email: 'E-Mail',
      emailPlaceholder: 'you@company.com',
      emailRequired: 'Bitte geben Sie eine gültige E-Mail-Adresse ein',
      fullName: 'Vollständiger Name (optional)',
      fullNamePlaceholder: 'Ihr Name',
      organization: 'Organisation (optional)',
      organizationPlaceholder: 'Unternehmen / Abteilung',
      reason: 'Begründung (optional)',
      reasonPlaceholder: 'Beschreiben Sie kurz Ihren Verwendungszweck',
      consent: 'Ich habe die Datenschutzerklärung gelesen und stimme der Verwendung meiner Daten zur Kontofreischaltung zu',
      consentRequired: 'Bitte lesen und akzeptieren Sie zuerst die Datenschutzerklärung',
      captcha: 'Menschliche Verifizierung',
      captchaPlaceholder: 'Zeichen aus dem Bild eingeben',
      captchaRefresh: 'Aktualisieren',
      captchaRequired: 'Bitte geben Sie das Captcha ein',
      captchaLoading: 'Captcha wird geladen…',
      submit: 'Bewerbung einreichen',
      submitting: 'Wird gesendet…',
    },

    verify: {
      title: 'E-Mail-Verifizierung',
      desc: 'Ein Code wurde an {{email}} gesendet, 10 Minuten gültig',
      placeholder: '6-stelliger Code',
      resend: 'Erneut senden ({{seconds}}s)',
      resendNow: 'Erneut senden',
      verify: 'Bestätigen',
      verifying: 'Wird verifiziert…',
      expired: 'Der Code ist abgelaufen. Bitte fordern Sie einen neuen an.',
      devCodeHint: 'Verifizierungscode (Entwicklungsmodus)',
    },

    success: {
      title: 'Bewerbung eingereicht',
      desc: 'Sie werden innerhalb von 1–2 Werktagen per E-Mail benachrichtigt',
      requestId: 'Bewerbungs-ID',
      reviewing: 'In Prüfung',
      reviewDeadline: 'Prüfungsfrist',
      cooldown: 'Bitte nicht erneut einreichen. Sie können sich in {{days}} Tagen erneut bewerben.',
    },

    status: {
      reviewing: 'In Prüfung',
      approved: 'Glückwunsch, Sie haben Whitelist-Zugang erhalten',
      rejected: 'Leider wurde Ihre Bewerbung nicht genehmigt',
      rejectedReason: 'Grund',
      expired: 'Diese Bewerbung ist abgelaufen. Sie können eine neue einreichen.',
      cooldownHint: 'Sie können sich in {{days}} Tagen erneut bewerben.',
    },

    lookup: {
      title: 'Bewerbungsstatus prüfen',
      tokenPlaceholder: 'Bewerbungs-ID oder Status-Token eingeben',
      query: 'Prüfen',
      error: 'Keine Bewerbung gefunden. Bitte überprüfen Sie Ihr Token.',
    },

    quota: {
      label: 'Verbleibende Plätze',
      value: '{{remaining}} / {{total}}',
      loading: 'Verbleibende Plätze werden geladen…',
    },

    errors: {
      alreadyRegistered: 'Diese E-Mail ist bereits registriert. Bitte melden Sie sich an.',
      alreadyApplied: 'Diese E-Mail hat sich bereits beworben. Bitte warten Sie auf die Prüfung.',
      rateLimited: 'Zu viele Anfragen. Bitte versuchen Sie es in {{seconds}} Sekunden erneut.',
      network: 'Netzwerkfehler. Bitte versuchen Sie es später erneut.',
      unknown: 'Etwas ist schiefgelaufen. Bitte versuchen Sie es später erneut.',
    },
  },
}