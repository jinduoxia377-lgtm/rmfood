#!/bin/bash
# ==============================================================================
# OFF Data Import Full Execution Script
# Run this in WSL Ubuntu (native environment) after proper setup
# ==============================================================================

set -euo pipefail

PROJECT_DIR="/mnt/d/RMFOOD配方平台/backend"

# Check if we're in a clean environment
if [[ "$OSTRES" == *"cygwin"* || "$OSTRES" == *"msys"* ]]; then
    echo "Warning: Running on Windows Python path. Use native WSH Python instead."
fi

echo "========================================"
echo "OFF Data Import - Full Execution Pipeline"
echo "========================================"
echo ""

# ============================================================
# PHASE A: Sample Validation
# ============================================================
echo "[PHASE A] Sample Validation (100 products)"
echo "----------------------------------------"

cd "$PROJECT_DIR"
source .venv/bin/activate 2>/dev/null || true

python scripts/import_off_direct.py sample

echo ""
echo "Phase A complete!"
echo ""

# Verify results
echo "Verifying Phase A results..."
psql "postgresql+asyncpg://postgres:password@localhost:5432/rmfood" -c \
  "SELECT source, COUNT(*) as total FROM retail_products WHERE source='openfoodfacts' GROUP BY source;"

# ============================================================
# PHASE B: Bulk Import (China Products)
# ============================================================
echo ""
echo "[PHASE B] Bulk Import of China Products"
echo "---------------------------------------"
echo "This may take 1-3 hours depending on API rate limits."
export OFF_CHINA_ONLY=true

python scripts/import_off_direct.py bulk

echo ""
echo "Phase B complete!"
echo ""

# Verify Phase B results
echo "Verifying Phase B results..."
psql "postgresql+asyncpg://postgres:password@localhost:5432/rmfood" -c \
  "SELECT
      COUNT(*) as total_products,
      COUNT(DISTINCT brand) as unique_brands,
      COUNT(DISTINCT category) as unique_categories,
      ROUND(AVG(data_quality), 2) as avg_quality
     FROM retail_products
     WHERE source = 'openfoodfacts';"

# Top 10 categories
echo "Top 10 categories:"
psql "postgresql+asyncpg://postgres:password@localhost:5432/rmfood" -c \
  "SELECT category, COUNT(*) as cnt
   FROM retail_products
   WHERE source='openfoodfacts' AND category IS NOT NULL
   GROUP BY category ORDER BY cnt DESC LIMIT 10;"

# ============================================================
# PHASE C: Incremental Sync Setup
# ============================================================
echo ""
echo "[PHASE C] Incremental Sync Configuration"
echo "----------------------------------------"

# First run sync
python scripts/import_off_direct.py sync

echo ""
echo "Configuring daily cron job at 02:00 AM..."
echo "(Add to your crontab:) "
echo "0 2 * * * cd /mnt/d/RMFOOD配方平台/backend && . .venv/bin/activate && python scripts/import_off_direct.py sync >> /var/log/off_sync.log 2>&1"

# ============================================================
# PHASE D: Embedding Generation (for AI Search)
# ============================================================
echo ""
echo "[PHASE D] Generate Embedding Vectors"
echo "------------------------------------"

# Configure LLM provider first in .env:
# LLM_PROVIDER=openai OR deepseek OR ollama
# OPENAI_API_KEY=your_key
# OPENAI_BASE_URL=https://api.openai.com/v1/chat/completions

python scripts/import_off_direct.py embed 10000

echo ""
echo "========================================"
echo "ALL PHASES COMPLETE!"
echo "========================================"
echo ""
echo "Next steps for production:"
echo "1. Monitor import_errors table regularly"
echo "2. Verify off_sync_state for daily sync status"
echo "3. Enable pgvector indexing on embedding column for search performance"
echo "4. Set up alerts for import failures"
