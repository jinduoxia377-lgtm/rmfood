import asyncio, sys, json, httpx
sys.path.insert(0, 'D:/RMFOODFP/backend')

async def test():
    from app.services.ai.prompt_service import get_prompt_service
    from app.services.llm_service import llm_service, LLMMessage

    # Get exact prompt
    prompt = get_prompt_service().get_scenario_prompt('formula_design')
    print(f'Prompt length: {len(prompt)}')
    print(f'Has blocks keyword: {"blocks" in prompt}')

    messages = [
        LLMMessage(role='system', content=prompt),
        LLMMessage(role='user', content='帮我设计一款针对高血糖人群的饮品配方'),
    ]

    # Build payload exactly as chat_stream does
    payload = llm_service._build_payload(messages, stream=True)
    print(f'Model: {payload["model"]}')
    print(f'Temperature: {payload["temperature"]}')
    print(f'Max tokens: {payload["max_tokens"]}')
    print(f'System prompt length in payload: {len(payload["messages"][0]["content"])}')

    # Call API
    url = f'{llm_service.config.base_url}/chat/completions'
    headers = llm_service._build_headers()
    print(f'URL: {url}')
    print(f'Headers: {headers}')

    async with httpx.AsyncClient(timeout=90.0) as client:
        resp = await client.post(url, headers=headers, json=payload)
        content = resp.text
        has_blocks = 'blocks' in content
        print(f'Response status: {resp.status_code}')
        print(f'Has blocks in response: {has_blocks}')
        print(f'Response length: {len(content)}')
        # Show first content chunk
        for line in content.split('\n')[:20]:
            if line.startswith('data:'):
                try:
                    obj = json.loads(line[5:])
                    delta = obj.get('choices', [{}])[0].get('delta', {})
                    c = delta.get('content', '')
                    if c:
                        print(f'First content: {c[:100]}')
                        break
                except:
                    pass

asyncio.run(test())
