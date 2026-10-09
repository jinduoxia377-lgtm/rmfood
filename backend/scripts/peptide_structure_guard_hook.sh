#!/usr/bin/env bash
# pre-commit hook: 自动运行 /peptide-structure 核心修复防还原门禁
# 安装方式：cp backend/scripts/peptide_structure_guard_hook.sh .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit
# 或手动创建 .git/hooks/pre-commit 指向本脚本

set -e
REPO_ROOT="$(git rev-parse --show-toplevel)"

echo "── pre-commit: 运行 /peptide-structure 核心修复门禁 ──"

# 运行门禁（退出码 1 = 发现被还原，阻止提交）
python "$REPO_ROOT/backend/scripts/peptide_structure_guard.py"
GUARD_EXIT=$?

if [ $GUARD_EXIT -ne 0 ]; then
  echo ""
  echo "门禁失败：核心修复被还原。提交已阻止。"
  echo "处理方式：重新应用被还原的修复（参考 git log 中 8b5bb5f / fe8cdb0 / 9e37ce4 / 5bda72e），再提交。"
  exit 1
fi

echo "── 门禁通过 ──"

# 额外保护：若本次提交触及受保护文件，再次 grep 确认关键修复仍在暂存区
PROTECTED_FILES=(
  "backend/app/services/peptide_analyzer/food_peptide_service.py"
  "backend/app/core/security/security_middleware.py"
  "backend/app/api/peptide_structure_routes.py"
  "backend/app/api/advanced_peptide.py"
)
for f in "${PROTECTED_FILES[@]}"; do
  if git diff --cached --name-only | grep -q "^$f\$"; then
    # 文件在本次提交中被修改，检查暂存版本是否仍含关键修复
    STAGED_CONTENT=$(git show ":$f" 2>/dev/null || echo "")
    case "$f" in
      *food_peptide_service.py)
        if ! echo "$STAGED_CONTENT" | grep -q "result.isoelectric_point = props\['isoelectric_point'\]"; then
          echo "警告：暂存的 $f 缺失 pI 修复，提交将被阻止"
          exit 1
        fi
        ;;
      *security_middleware.py)
        if ! echo "$STAGED_CONTENT" | grep -q 'startswith("/api/v1/ai/peptide")'; then
          echo "警告：暂存的 $f 缺失 /ai/peptide CSRF 豁免，提交将被阻止"
          exit 1
        fi
        ;;
      *peptide_structure_routes.py)
        if ! echo "$STAGED_CONTENT" | grep -q "@router.get('/history'"; then
          echo "警告：暂存的 $f 缺失 /history 路由，提交将被阻止"
          exit 1
        fi
        ;;
      *advanced_peptide.py)
        if ! echo "$STAGED_CONTENT" | grep -q '_uid = current_user.id if current_user else "anonymous"'; then
          echo "警告：暂存的 $f 缺失匿名用户修复，提交将被阻止"
          exit 1
        fi
        ;;
    esac
  fi
done

exit 0
