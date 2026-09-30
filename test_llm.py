import asyncio, sys
sys.path.insert(0, 'D:/RMFOODFP/backend')

async def test():
    from app.services.ai.prompt_service import get_prompt_service
    from app.services.llm_service import llm_service, LLMMessage

    prompt = get_prompt_service().get_scenario_prompt('formula_design')
    print(f'Prompt length: {len(prompt)}')
    print(f'Has structured protocol: {"结构化" in prompt}')
    print(f'First 150: {prompt[:150]}')

    messages = [
        LLMMessage(role='system', content=prompt),
        LLMMessage(role='user', content='帮我设计一款针对高血糖人群的饮品配方'),
    ]

    print(f'Temperature: {llm_service.config.temperature}')
    print(f'Model: {llm_service.config.model}')
    print(f'Is available: {llm_service.is_available}')

    result = await llm_service.chat(messages)
    content = result.content
    print(f'Response length: {len(content)}')
    print(f'Has blocks: {"blocks" in content}')
    print(f'First 400: {content[:400]}')

asyncio.run(test())
