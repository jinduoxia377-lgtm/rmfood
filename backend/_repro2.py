import asyncio, traceback, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from app.core.database.session import get_session_factory
from app.api.users import list_users
from app.api.deps import PaginationParams
from app.models import User
from sqlalchemy import select

async def main():
    f = get_session_factory()
    async with f() as db:
        u = (await db.execute(select(User).where(User.username=='admin'))).scalar_one()
        print('admin role repr:', repr(u.role))
        try:
            r = await list_users(pagination=PaginationParams(page=1, page_size=5), role=None, search=None, current_user=u, db=db)
            print('OK', str(r)[:200])
        except Exception:
            traceback.print_exc()
asyncio.run(main())
