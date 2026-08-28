import aiohttp, asyncio, json, sys
sys.stdout.reconfigure(encoding='utf-8')

async def test():
    async with aiohttp.ClientSession() as session:
        # Login
        async with session.post('http://localhost:8000/api/v1/auth/login',
            json={'username': 'admin', 'password': 'admin123'}) as r:
            data = await r.json()
            token = data.get('access_token', '')
            print(f'Login: {r.status}')

        headers = {'Authorization': f'Bearer {token}'}

        # Test organizations list
        async with session.get('http://localhost:8000/api/v1/organizations',
            headers=headers) as r:
            text = await r.text()
            print(f'Orgs status: {r.status}')
            try:
                j = json.loads(text)
                orgs = j.get('organizations', [])
                print(f'Organizations found: {len(orgs)}')
                for o in orgs[:3]:
                    print(f'  id={o["id"]} name={o["name"]} plan={o.get("plan")} '
                          f'members={o.get("memberCount")} teams={o.get("teamCount")}')
            except Exception as e:
                print(f'Parse error: {e}')
                print(f'Response: {text[:500]}')

        # Test trash
        async with session.get('http://localhost:8000/api/v1/organizations/trash',
            headers=headers) as r:
            text = await r.text()
            print(f'\nTrash status: {r.status}')
            try:
                j = json.loads(text)
                print(f'Trash response: {str(j)[:300]}')
            except:
                print(f'Trash response: {text[:300]}')

asyncio.run(test())
