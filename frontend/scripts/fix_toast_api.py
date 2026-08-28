"""Fix toast destructuring in all COA components."""

def fix_file(path):
    with open(path, 'r', encoding='utf-8') as f:
        s = f.read()

    # Fix destructuring
    s = s.replace(
        "const { toast } = useToast();",
        "const { success: toastSuccess, error: toastError, warning: toastWarning } = useToast();"
    )
    # If no match, also try without semicolon variations
    if "const { success: toastSuccess" not in s:
        s = s.replace(
            "const { toast } = useToast()",
            "const { success: toastSuccess, error: toastError, warning: toastWarning } = useToast()"
        )

    # Fix calls: toast.success → toastSuccess, toast.error → toastError
    s = s.replace("toast.success(", "toastSuccess(")
    s = s.replace("toast.error(", "toastError(")
    s = s.replace("toast.warning(", "toastWarning(")

    with open(path, 'w', encoding='utf-8') as f:
        f.write(s)
    print(f"Fixed {path}")


fix_file(r'src\components\coa\COAView.tsx')
fix_file(r'src\components\coa\COATable.tsx')
fix_file(r'src\components\coa\COACreateForm.tsx')
print("All toast fixes applied!")
