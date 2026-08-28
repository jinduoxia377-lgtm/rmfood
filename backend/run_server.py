import sys, asyncio, logging
sys.path.insert(0, r'D:\RMFOODFP\backend')
logging.basicConfig(level=logging.INFO, format='%(asctime)s %(message)s')

async def main():
    import uvicorn
    config = uvicorn.Config("app.main:app", host="0.0.0.0", port=8000, reload=False, log_level="info")
    server = uvicorn.Server(config)
    await server.serve()

asyncio.run(main())
