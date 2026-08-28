"""Fix remaining TerminologyPage.tsx TS errors."""
from pathlib import Path

p = Path(r'src/pages/terminology/TerminologyPage.tsx')
s = p.read_text(encoding='utf-8')

# 1. Category form (outer scope): term_en -> name_en
s = s.replace(
    "value={formData.term_en}\n\t\t\t\t\t\tonChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, term_en: e.target.value })}\n\t\t\t\t\t\tplaceholder=\"English name\"",
    "value={formData.name_en}\n\t\t\t\t\t\tonChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, name_en: e.target.value })}\n\t\t\t\t\t\tplaceholder=\"English name\""
)

# 2. Search Input: HTMLSelectElement -> HTMLInputElement
s = s.replace(
    "onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {\n\t\t\t\t\t\t\t\tsetSearchQuery(e.target.value)\n\t\t\t\t\t\t\t\tsetPage(1)\n\t\t\t\t\t\t}}",
    "onChange={(e: React.ChangeEvent<HTMLInputElement>) => {\n\t\t\t\t\t\t\t\tsetSearchQuery(e.target.value)\n\t\t\t\t\t\t\t\tsetPage(1)\n\t\t\t\t\t\t}}"
)

# 3. Select component (category_id): HTMLInputElement -> HTMLSelectElement
s = s.replace(
    "onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, category_id: Number(e.target.value) })}",
    "onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFormData({ ...formData, category_id: Number(e.target.value) })}"
)

# 4. Validation Input: HTMLSelectElement -> HTMLInputElement
s = s.replace(
    "onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setValidationInput(e.target.value)}",
    "onChange={(e: React.ChangeEvent<HTMLInputElement>) => setValidationInput(e.target.value)}"
)

# 5. Batch textarea: HTMLSelectElement -> HTMLTextAreaElement
s = s.replace(
    "onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setBatchInput(e.target.value)}",
    "onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setBatchInput(e.target.value)}"
)

# 6. Rules form pattern Input: HTMLSelectElement -> HTMLInputElement
s = s.replace(
    "onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFormData({ ...formData, pattern: e.target.value })}",
    "onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, pattern: e.target.value })}"
)

# 7. Rules form replacement Input: HTMLSelectElement -> HTMLInputElement
s = s.replace(
    "onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFormData({ ...formData, replacement: e.target.value })}",
    "onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, replacement: e.target.value })}"
)

# 8. Validation result display: r.term -> r.corrected_term, r.term_en -> r.suggestions[0] or remove
s = s.replace(
    "{r.term || r.term_en || `条目 ${i + 1}`}",
    "{r.corrected_term || r.suggestions?.[0] || `条目 ${i + 1}`}"
)

# 9. termsData.total_pages possibly undefined
s = s.replace(
    "termsData.total_pages",
    "termsData.total_pages ?? 1"
)

p.write_text(s, encoding='utf-8')
print("TerminologyPage.tsx fixes applied")
