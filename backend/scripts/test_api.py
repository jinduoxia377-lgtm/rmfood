"""Test the OFF search endpoint via the actual API"""
import asyncio, httpx

async def test_search():
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            "http://127.0.0.1:8000/databases/openfoodfacts/search",
            json={
                "query": "vitamin",
                "page": 1,
                "page_size": 5,
                "realtime": False,
            },
        )
        print(f"Status: {resp.status_code}")
        data = resp.json()
        print(f"Response keys: {list(data.keys()) if isinstance(data, dict) else type(data)}")
        if isinstance(data, dict):
            print(f"items count: {len(data.get('items', []))}")
            print(f"total: {data.get('total')}")
            print(f"data_source: {data.get('data_source')}")
            if data.get('error'):
                print(f"error: {data['error']}")
            if data.get('items'):
                print(f"First item: {data['items'][0].get('product_name')}")

asyncio.run(test_search())
