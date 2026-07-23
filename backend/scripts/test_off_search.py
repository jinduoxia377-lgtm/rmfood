import asyncio, httpx

async def test_parallel():
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

    results = []
    tasks = []
    for mirror in mirrors:
        params_str = "&".join(f"{k}={v}" for k, v in params.items())
        url = f"{mirror}/cgi/search.pl?{params_str}"
        tasks.append(url)
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(url)
                resp.raise_for_status()
                data = resp.json()
                products = data.get("products", [])
                count = data.get("count", len(products))
                print(f"[{url}] count={count}, products={len(products)}")
                if products:
                    results.append({"url": url, "products": products, "count": count})
                    break
        except Exception as e:
            print(f"[{url}] ERROR: {e}")

    print(f"\nTotal results: {sum(r['count'] for r in results)}")
    print(f"First product name: {results[0]['products'][0].get('product_name') if results else 'N/A'}")

asyncio.run(test_parallel())
