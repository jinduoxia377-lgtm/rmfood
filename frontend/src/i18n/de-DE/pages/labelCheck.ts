/**
 * Deutsche "Zutatenliste-Prüfung"-Modulübersetzungen — v2
 *
 * Schlüsselstruktur spiegelt zh-CN/pages/labelCheck.ts 1:1 wider (einzige
 * maßgebliche Quelle). Konformitätsrichtlinien: keine absoluten
 * Konformitätsurteile (kein "konform"/"bedenkenlos verzehrbar"), keine
 * Sicherheitsbewertung, keine Wirkungs- oder Heilungsversprechen. risk_score
 * wird nur als neutraler "Katalog-Übereinstimmungswert" bezeichnet, nie als
 * Sicherheitsbewertung; risk_level wurde laut Fachreview entfernt.
 */
export default {
  labelCheck: {
    // Basis / Eingabe
    title: 'Zutatenliste-Prüfung',
    subtitle: 'Zutatenliste einfügen oder scannen und mit öffentlichen Standards wie Lebensmittel-Homologie-Katalog, GB 2760 und GB 14880 abgleichen',
    inputTitle: 'Zutatenliste eingeben',
    placeholder: 'Beispiel:\nZutaten: Wasser, Zucker, Kaffeeweißer (Glukosesirup, gehärtetes Pflanzenöl), Kaliumsorbat, Weizenmehl',
    startCheck: 'Prüfung starten',
    uploadImage: 'Bild hochladen & erkennen',
    uploadAria: 'Zutatenlisten-Bild hochladen',
    clear: 'Leeren',
    ocrText: 'OCR-erkannten Text:',

    // Ergebnis / Zusammenfassung
    resultTitle: 'Prüfergebnis',
    reportId: 'Berichts-ID: {{id}}',

    // Kategorien
    categoryFoodHomology: 'Lebensmittel-Homologie',
    categoryNewFood: 'Neue Lebensmittelressource',
    categoryAdditive: 'Zusatzstoff',
    categoryOrdinary: 'Gewöhnlicher Inhaltsstoff',
    categoryEnricher: 'Nährstoffanreicherung',
    categoryProhibited: 'Verboten / Risiko',
    categoryUnknown: 'Nicht gelistet',

    // Inhaltsstoffdetails
    ingredientDetails: 'Inhaltsstoffdetails',
    allergen: 'Allergen: {{group}}',
    compound: 'Zusammengesetzte Zutat',
    levelInfo: 'Info',
    levelNote: 'Hinweis',
    levelWarning: 'Warnung',
    detailRawName: 'Originalfragment',
    detailMatchMethod: 'Trefferart',
    detailConfidence: 'Konfidenz',
    detailAliases: 'Alias-Kette',
    detailCaution: 'Personenbezogener Warnhinweis',
    detailMaxDosage: 'Tageshöchstmenge',
    detailFunction: 'Funktion',
    detailMaxUsage: 'Höchstmenge bei Verwendung',
    detailSource: 'Rechtsgrundlage',
    detailRiskContribution: 'Beitrag zum Hinweiswert',
    detailSubIngredients: 'Unterbestandteile',

    // M3 Katalogvergleich (neutrale Formulierung — KEINE Sicherheitsbewertung)
    riskBoardTitle: 'Katalogvergleich',
    riskScore: 'Katalog-Übereinstimmungswert',
    riskScoreLabel: 'Katalog-Übereinstimmungswert',
    riskNote: 'Interne Referenz, keine Sicherheitsbewertung; Ergebnisse stellen keine Konformitätsfeststellung dar',
    riskUnavailable: 'Hinweiswert zurzeit nicht verfügbar',
    needsReviewCount: 'Manuell zu prüfende Einträge: {{count}}',
    needsReviewNote: 'Nicht gelistete oder kritische Inhaltsstoffe; manuelle Prüfung empfohlen',
    categoryDistTitle: 'Kategorieverteilung',
    allergenGroupTitle: 'Allergengruppen',
    allergenNone: 'Keine Allergene erkannt',
    allergenNote: 'Kennzeichnung empfohlen (GB 7718 Anhang B, freiwillig), nicht verpflichtend',
    noData: 'Keine Daten',
    statsTotal: 'Erkannte Inhaltsstoffe',
    statsMatched: 'Im Katalog zugeordnet',
    statsUnmatched: 'Nicht gelistet',
    statsCompound: 'Zusammengesetzte Zutaten aufgeschlüsselt',

    // M1 Analysehinweise
    parseWarnings: 'Analysehinweise',

    // M5 Verlauf (nur lokal)
    historyTitle: 'Verlauf',
    historyToggle: 'Verlauf',
    historyEmpty: 'Noch kein lokaler Verlauf vorhanden',
    historyRecheck: 'Erneut prüfen',
    historyDelete: 'Löschen',
    historyClear: 'Leeren',
    historyTypeText: 'Text',
    historyTypeOcr: 'OCR',
    historyPrivacy: 'Wird nur lokal im Browser gespeichert, nie an einen Server übertragen',

    // M6 Export
    exportTitle: 'Bericht exportieren',
    exportMarkdown: 'Markdown',
    exportJson: 'JSON',

    // M7 Beispielvorlagen
    templatesTitle: 'Beispielvorlagen',
    templatesEmpty: 'Keine Beispielvorlagen vorhanden',
    templatesError: 'Vorlagen konnten nicht geladen werden',
    toastTemplatePicked: 'Beispielvorlage eingefügt',

    // M8 Filter / Suche
    filterCategory: 'Kategorie',
    filterLevel: 'Stufe',
    filterAllergen: 'Allergen',
    filterAll: 'Alle',
    filterAllergenYes: 'Mit Allergenen',
    filterAllergenNo: 'Ohne Allergene',
    filterReset: 'Zurücksetzen',
    filterShowing: '{{shown}} / {{total}} Einträge werden angezeigt',
    searchPlaceholder: 'Inhaltsstoffname / Alias / Beschreibung suchen',
    filterEmpty: 'Keine Inhaltsstoffe entsprechen den aktuellen Filtern',

    // Konformitätshinweis (immer sichtbar)
    disclaimerFallback: 'Dieses Ergebnis ist ausschließlich ein informativer Abgleich auf Grundlage öffentlicher Kataloge. Es stellt keine Konformitätsfeststellung zur Lebensmittelsicherheit, keinen Prüfbericht und keine Rechtsmeinung dar. Maßgeblich sind stets die aktuellsten nationalen Standards und deren amtliche Auslegung.',

    // Toasts
    toastInputRequired: 'Bitte Zutatenlisten-Inhalt eingeben',
    toastRecognized: '{{count}} Inhaltsstoffe erkannt',
    toastFailed: 'Prüfung fehlgeschlagen. Bitte später erneut versuchen.',
    toastOcrSuccess: 'OCR erfolgreich, insgesamt {{count}} Inhaltsstoffe',
    toastOcrUnavailable: 'OCR nicht verfügbar, bitte Text einfügen',
  },
}
