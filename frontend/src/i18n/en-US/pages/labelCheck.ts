/**
 * English "Label Check" module translations — v2
 *
 * Key structure mirrors zh-CN/pages/labelCheck.ts 1:1 (single source of truth).
 * Compliance red-lines: no absolute compliance verdicts (no "compliant" /
 * "safe to eat"), no safety grading, no efficacy/therapeutic claims.
 * risk_score is worded only as a neutral "directory match score", never a
 * safety rating; risk_level was removed per domain review.
 */
export default {
  labelCheck: {
    // Base / input
    title: 'Label Check',
    subtitle: 'Paste or scan ingredient label text and compare against public standards such as the food-homology catalog, GB 2760, and GB 14880',
    inputTitle: 'Enter Ingredient Label',
    placeholder: 'Example:\nIngredients: water, sugar, non-dairy creamer (glucose syrup, hydrogenated vegetable oil), potassium sorbate, wheat flour',
    startCheck: 'Start Check',
    uploadImage: 'Upload Image to Recognize',
    uploadAria: 'Upload ingredient label image',
    clear: 'Clear',
    ocrText: 'OCR recognized text:',

    // Result / summary
    resultTitle: 'Check Result',
    reportId: 'Report ID: {{id}}',

    // Categories
    categoryFoodHomology: 'Food Homology',
    categoryNewFood: 'New Food Resource',
    categoryAdditive: 'Additive',
    categoryOrdinary: 'Ordinary Ingredient',
    categoryEnricher: 'Nutrition Enricher',
    categoryProhibited: 'Prohibited / Risk',
    categoryUnknown: 'Unlisted',

    // Ingredient details
    ingredientDetails: 'Ingredient Details',
    allergen: 'Allergen: {{group}}',
    compound: 'Compound Ingredient',
    levelInfo: 'Info',
    levelNote: 'Note',
    levelWarning: 'Warning',
    detailRawName: 'Raw fragment',
    detailMatchMethod: 'Match method',
    detailConfidence: 'Confidence',
    detailAliases: 'Alias chain',
    detailCaution: 'Population Caution',
    detailMaxDosage: 'Daily limit',
    detailFunction: 'Function',
    detailMaxUsage: 'Maximum usage',
    detailSource: 'Source regulation',
    detailRiskContribution: 'Score contribution',
    detailSubIngredients: 'Sub-ingredients',

    // M3 directory-comparison board (neutral wording — NOT a safety grading)
    riskBoardTitle: 'Directory Comparison Board',
    riskScore: 'Directory match score',
    riskScoreLabel: 'Directory match score',
    riskNote: 'Internal reference, not a safety rating; results do not constitute a compliance conclusion',
    riskUnavailable: 'Match score unavailable',
    needsReviewCount: 'Items needing manual review: {{count}}',
    needsReviewNote: 'Unlisted or cautionary ingredients; manual review recommended',
    categoryDistTitle: 'Category Distribution',
    allergenGroupTitle: 'Allergen Groups',
    allergenNone: 'No allergens identified',
    allergenNote: 'Labeling recommended (GB 7718 Annex B, voluntary), not mandatory',
    noData: 'No data',
    statsTotal: 'Ingredients identified',
    statsMatched: 'Catalog matched',
    statsUnmatched: 'Unlisted',
    statsCompound: 'Compound ingredients expanded',

    // M1 parse warnings
    parseWarnings: 'Parse Warnings',

    // M5 history (local only)
    historyTitle: 'History',
    historyToggle: 'History',
    historyEmpty: 'No local history yet',
    historyRecheck: 'Recheck',
    historyDelete: 'Delete',
    historyClear: 'Clear',
    historyTypeText: 'Text',
    historyTypeOcr: 'OCR',
    historyPrivacy: 'Stored only in this browser, never uploaded to a server',

    // M6 export
    exportTitle: 'Export Report',
    exportMarkdown: 'Markdown',
    exportJson: 'JSON',

    // M7 sample templates
    templatesTitle: 'Sample Templates',
    templatesEmpty: 'No sample templates',
    templatesError: 'Failed to load templates',
    toastTemplatePicked: 'Sample template filled in',

    // M8 filter / search
    filterCategory: 'Category',
    filterLevel: 'Level',
    filterAllergen: 'Allergen',
    filterAll: 'All',
    filterAllergenYes: 'With allergens',
    filterAllergenNo: 'Without allergens',
    filterReset: 'Reset',
    filterShowing: 'Showing {{shown}} / {{total}} items',
    searchPlaceholder: 'Search ingredient name / alias / description',
    filterEmpty: 'No ingredients match the current filters',

    // Compliance disclaimer (always shown)
    disclaimerFallback: 'This result is an informational comparison based on public catalogs only. It does not constitute a food-safety compliance conclusion, an inspection report, or a legal opinion. Always refer to the latest national standards and official interpretations.',

    // Toasts
    toastInputRequired: 'Please enter the ingredient label content',
    toastRecognized: 'Recognized {{count}} ingredients',
    toastFailed: 'Check failed. Please try again later.',
    toastOcrSuccess: 'OCR succeeded, {{count}} ingredients in total',
    toastOcrUnavailable: 'OCR unavailable, please paste the text',
  },
}
