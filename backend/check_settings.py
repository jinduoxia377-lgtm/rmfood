import sys, os
os.chdir(r"D:\RMFOODFP\backend")
sys.path.insert(0, r"D:\RMFOODFP\backend")
try:
    from app.core.config import get_settings
    s = get_settings()
    print("settings loaded OK")
except Exception as e:
    print("SETTINGS ERROR:", type(e).__name__, str(e)[:800])
