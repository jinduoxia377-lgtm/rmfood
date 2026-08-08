import asyncio
from app.services.data_sources.openfoodfacts_client import off_service

async def test_probe():
    mirrors = [
        "https://world.openfoodfacts.org",
        "https://world-en.openfoodfacts.org",
    ]
    params = {
        "search_terms_s": "vitamin",
        "search_simple": "1",
        "action": "process",
        "json": "1",
        "page_size": 50,
        "page": 1,
    }

    products, total_count, last_error = await off_service._parallel_probe_mirrors(mirrors, params)
    print(f"products count: {len(products)}")
    print(f"total_count: {total_count}")
    print(f"last_error: {last_error}")
    if products:
        print(f"first product name: {products[0].get('product_name')}")

asyncio.run(test_probe())
