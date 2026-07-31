# 🚀 RMFOOD OFF Data Import - One-Click Deployment Guide
# ====================================================
# This guide takes you from zero to data in the database in <5 minutes.
# Follow these steps EXACTLY as written.

## Prerequisites Check ✅

Before starting, verify these are installed:

[ ] **PostgreSQL 12+** running on localhost:5432
     - Test: `psql -h localhost -p 5432 -U postgres -c "SELECT 1;"` should return 1
[ ] **Python 3.9+** with pip
[ ] **Git** (optional, for cloning)

---

## Step 1: Create Clean Working Directory (NO Chinese Characters!) ⚠️

CRITICAL: Do NOT use paths with Chinese characters or spaces.

```cmd
:: Open Command Prompt as Administrator (if needed for permissions)
mkdir C:\rmfood_backend
cd C:\rmfood_backend
```

Or if using PowerShell:
```powershell
New-Item -ItemType Directory -Path "C:\rmfood_backend" -Force
Set-Location C:\rmfood_backend
```

---

## Step 2: Clone/Import Project Files

If you have the repository locally:

```cmd
xcopy /E /I /Y "D:\RMFOOD配方平台\backend\*" .
```

Or if you need to set up fresh:

```cmd
git clone https://github.com/your-org/rmfood-backend.git backend
cd backend
```

---

## Step 3: Create Python Virtual Environment

```cmd
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
```

Wait for all packages to install successfully. You should see no errors.

---

## Step 4: Configure Database (.env File)

Create a `.env` file in `C:\rmfood_backend\.env` with these contents:

```ini
# RMFOOD Configuration
APP_NAME=RMFOOD配方制作平台
APP_VERSION=1.0.0
DEBUG=False

# DATABASE CONNECTION
DATABASE_URL=postgresql+asyncpg://postgres:password@localhost:5432/rmfood

# Security
SECRET_KEY=your-32-char-minimum-secret-key-here
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# Logging
LOG_LEVEL=INFO

# Database schema migration
ALEMBIC_CONFIG_PATH=alembic.ini
```

Then create `alembic.ini` (minimal):

```ini
[alembic]
script_location = alembic
compare_type = True
sqlalchemy.url = %(DATABASE_URL)s
```

---

## Step 5: Initialize Database Schema

```cmd
python -c "
from app.core.database.session import init_database
import asyncio
asyncio.run(init_database())
print('Database tables created successfully!')
"
```

Verify tables exist:

```cmd
psql -d rmfood -U postgres -c "\dt"
```

Should show: `import_errors | import_products | retail_products | off_sync_state` (table names may vary)

---

## Step 6: Run Sample Import (Phase A - Verification)

```cmd
python scripts/import_off_direct.py sample
```

Expected output:
```
============================================================
Phase A: OFF 样本数据验证 (100条)
============================================================
[1/5] 搜索样本产品...   ✓
[2/5] 映射字段...       ✓ (97/100成功, 3条非中国产品跳过)
[3/5] 入库...           ✓ (connected via retry logic)
[4/5] 验证数据...       ✓ (source=openfoodfacts, cnt=97)
[5/5] 样本验证完成!
```

If any error occurs, check:
- PostgreSQL service is running
- User 'postgres' with password 'password' has access to 'rmfood' database
- Network connection on port 5432 is not blocked

---

## Step 7: Bulk Import China Products (Phase B)

```cmd
set OFF_CHINA_ONLY=true
python scripts/import_off_direct.py bulk
```

This may take 1-3 hours depending on API rate limits. Progress will be logged periodically.

---

## Step 8: Verify Results After Completion

```cmd
psql -d rmfood -U postgres -c "
SELECT 
    COUNT(*) as total_products,
    COUNT(DISTINCT brand) as unique_brands,
    ROUND(AVG(data_quality), 2) as avg_quality
FROM retail_products WHERE source = 'openfoodfacts';
"
```

Example expected output:
```
 total_products | unique_brands | avg_quality
----------------+---------------+-------------
        97      |       45      |      0.87
```

---

## Step 9: Set Up Daily Sync Cron (Windows Task Scheduler Alternative)

For Windows, create a scheduled task:

```cmd
schtasks /Create /TN "OFF_Daily_Sync" /TR "cmd.exe /c cd C:\rmfood_backend && .\\.venv\\Scripts\\activate && python scripts\\import_off_direct.py sync" /SC DAILY /ST 02:00 /RU "" /RL HIGHEST
```

---

## Troubleshooting Connection Errors

If you see "connection was closed in the middle of operation":

1. **Add to `.env`:**
   ```ini
   DATABASE_POOL_SIZE=5
   DATABASE_MAX_OVERFLOW=5
   DATABASE_RECYCLE=300
   ```

   Smaller pool reduces connection contention.

2. **Run with reduced batch size:**
   ```cmd
   python -c "import os; os.environ['BATCH_SIZE']='50'; python scripts/import_off_direct.py sample"
   ```

3. **Upgrade asyncpg:**
   ```cmd
   pip install --upgrade asyncpg
   ```

4. **Verify PostgreSQL timeout settings:**
   ```sql
   SHOW statement_timeout;  -- Should be >= 30000ms
   SHOW idle_in_transaction_session_timeout;  -- Should be off or high
   ```

---

## Final Verification Checklist

- [ ] ✅ PostgreSQL running on localhost:5432
- [ ] ✅ Database `rmfood` exists
- [ ] ✅ User `postgres` can connect with password
- [ ] ✅ `.env` file with correct `DATABASE_URL`
- [ ] ✅ Virtual environment activated
- [ ] ✅ All dependencies installed
- [ ] ✅ Schema initialized (`init_database` ran)
- [ ] ✅ Phase A sample import completed successfully
- [ ] ✅ Phase B bulk import started/completed
- [ ] ✅ Phase C sync configured
- [ ] ✅ Phase D embeddings generated (optional)

## Contact Support

If you encounter issues beyond these steps, provide:
1. Full error traceback
2. PostgreSQL version: `SELECT version();`
3. Python version: `python --version`
4. Output of: `pip freeze | grep -i "sqlalchemy\|asyncpg\|psycopg2"`
