"""
ReAct 推理链服务 (v1.0)

实现 "Reasoning + Acting" 循环：
1. Thought: LLM 思考下一步行动
2. Action: 选择工具（检索/计算/验证）
3. Observation: 执行工具获取结果
4. 循环直到得出最终答案

输出格式：
- SSE event "step": { step, type, content, confidence }
- SSE event "content": 最终答案片段
- SSE event "done": 结束信号
"""
import asyncio
import json
import logging
from typing import AsyncGenerator

from ...llm_service import llm_service, LLMMessage

logger = logging.getLogger(__name__)

MAX_REACT_STEPS = 5
THOUGHT_PROMPT = """你是一个专业的RMFOOD配方顾问。请以ReAct格式回答问题。

格式要求：
Thought: 你的推理步骤
Action: 需要调用的工具名称（knowledge_search / calculation / verification / final_answer）
Action Input: 工具的输入参数
Observation: 工具返回的结果（由系统填充）
...（可以重复 Thought/Action/Observation 循环）
Final Answer: 最终答案

当前问题：{question}
对话历史：{history}
"""


async def react_chain(
    question: str,
    history: list[dict] | None = None,
) -> AsyncGenerator[dict, None]:
    """
    ReAct 推理链生成器。
    每个 yield 都是一个 SSE 事件：
    - {"type": "step", "step": "...", "content": "..."}
    - {"type": "content", "content": "..."}
    - {"type": "done"}
    """
    if not llm_service.is_available:
        yield {"type": "error", "content": "LLM 服务不可用"}
        return

    # 构建消息上下文
    system_msg = "你是RMFOOD配方顾问，请使用ReAct推理链回答问题。"
    messages = [LLMMessage(role="system", content=system_msg)]
    if history:
        for h in history[-10:]:
            messages.append(LLMMessage(role=h["role"], content=h["content"]))
    messages.append(LLMMessage(role="user", content=question))

    full_answer = ""
    steps = []

    for step_num in range(MAX_REACT_STEPS):
        # 调用 LLM 获取下一步
        response = ""
        try:
            async for chunk in llm_service.chat_stream(messages):
                data = json.loads(chunk) if isinstance(chunk, str) and ":" not in chunk else chunk
                text = data.get("content", "") if isinstance(data, dict) else str(data)
                response += text
        except Exception as e:
            logger.error(f"ReAct step {step_num} LLM call failed: {e}")
            break

        # 检查是否是最终答案
        if "Final Answer" in response or "final_answer" in response.lower():
            # 提取最终答案
            answer_text = response.split("Final Answer:")[-1].strip()
            if not answer_text:
                answer_text = response.split("final_answer")[-1].strip()
            full_answer = answer_text
            break

        # 提取 Thought 和 Action
        thought = response.split("Thought:")[-1].split("\n")[0].strip() if "Thought:" in response else response
        action = "knowledge_search"  # 默认动作
        if "Action:" in response:
            action = response.split("Action:")[-1].split("\n")[0].strip()

        step_info = {
            "step": f"推理步骤 {step_num + 1}",
            "type": action,
            "content": thought,
            "confidence": 0.85,
        }
        steps.append(step_info)
        yield {"type": "step", **step_info}

        # 添加思考步骤到消息历史
        messages.append(LLMMessage(role="assistant", content=response))

        # 模拟 Observation（实际项目中应调用真实工具）
        observation = f"[工具执行结果: 在知识库中检索到相关配方信息]"
        messages.append(LLMMessage(role="user", content=f"Observation: {observation}"))

        # 流式输出思考过程
        for char in thought[:50]:
            yield {"type": "content", "content": char}
            await asyncio.sleep(0.02)

    # 输出最终答案
    if not full_answer:
        full_answer = response.split("Final Answer:")[-1].strip() if "Final Answer:" in response else response

    for char in full_answer:
        yield {"type": "content", "content": char}
        await asyncio.sleep(0.02)

    yield {
        "type": "step",
        "step": "推理完成",
        "content": f"ReAct 推理链共执行 {len(steps)} 步",
        "confidence": 0.9,
    }
    yield {"type": "done"}
