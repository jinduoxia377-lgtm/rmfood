import asyncio, traceback, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from app.core.database.session import get_session_factory
from app.services.user import UserService

async def main():
    f = get_session_factory()
    async with f() as db:
        svc = UserService(db)
        try:
            users, total = await svc.list_users(page=1, page_size=5, role=None, search=None)
            print('OK total=', total, 'n=', len(users))
        except Exception:
            traceback.print_exc()
asyncio.run(main())
