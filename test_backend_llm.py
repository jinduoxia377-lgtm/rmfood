import asyncio, sys
sys.path.insert(0, 'D:/RMFOODFP/backend')

async def test():
    from app.services.ai.prompt_service import get_prompt_service
    from app.services.llm_service import llm_service, LLMMessage

    prompt = get_prompt_service().get_scenario_prompt('formula_design')
    print(f'Prompt length: {len(prompt)}')
    print(f'Has blocks in prompt: {"blocks" in prompt}')

    messages = [
        LLMMessage(role='system', content=prompt),
        LLMMessage(role='user', content='帮我设计一款针对高血糖人群的饮品配方'),
    ]

    # Collect all chunks
    result = ''
    async for chunk in llm_service.chat_stream(messages):
        if chunk:
            result += chunk

    has_blocks = 'blocks' in result
    print(f'Response length: {len(result)}')
    print(f'Has blocks: {has_blocks}')
    print(f'First 400: {result[:400]}')

asyncio.run(test())
