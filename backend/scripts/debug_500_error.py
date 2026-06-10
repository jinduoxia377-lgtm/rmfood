"""
实时调试 500 错误 - 捕获完整的错误堆栈和请求信息
"""

import asyncio
import sys
import os
import json
import traceback

# 添加项目路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


async def debug_chat_request():
    """模拟完整的聊天请求流程，捕获所有错误"""
    print("\n" + "="*70)
    print("  🔬 RMFOOD 500 错误实时调试器")
    print("="*70)

    # 1. 检查配置来源
    print("\n[步骤 1] 检查 LLM 配置加载过程")
    print("-" * 70)

    try:
        from app.services.llm_service import llm_service, LLMConfig

        print(f"✅ LLMService 实例: {llm_service}")
        print(f"   配置对象 ID: {id(llm_service.config)}")
        print(f"\n📋 当前配置详情:")
        print(f"   Provider: {llm_service.config.provider}")
        print(f"   Model: {llm_service.config.model}")
        print(f"   Base URL: {llm_service.config.base_url}")
        print(f"   API Key 长度: {len(llm_service.config.api_key)}")
        print(f"   API Key 值 (前10字符): {llm_service.config.api_key[:10]}...")
        print(f"   API Key 值 (后10字符): ...{llm_service.config.api_key[-10:]}")
        print(f"   Max Tokens: {llm_service.config.max_tokens}")
        print(f"   Temperature: {llm_service.config.temperature}")

    except Exception as e:
        print(f"❌ 加载 LLM 服务失败: {e}")
        traceback.print_exc()
        return

    # 2. 尝试调用并捕获详细错误
    print("\n\n[步骤 2] 模拟 chat_with_rmfood() 调用")
    print("-" * 70)

    try:
        from app.services.llm_service import chat_with_rmfood

        print("🔄 正在调用 DeepSeek API...")
        print("   请求参数:")
        print("     question: '你好'")
        print("     history: None")

        result = await chat_with_rmfood(question="你好", history=None)

        print(f"\n✅ 调用成功!")
        print(f"   回复长度: {len(result)} 字符")
        print(f"   回复内容:\n{result}")

    except Exception as e:
        print(f"\n❌ 调用失败!")
        print(f"\n🔴 错误类型: {type(e).__name__}")
        print(f"🔴 错误消息: {str(e)}")
        print(f"\n📋 完整错误堆栈:")
        traceback.print_exc()

        # 分析错误原因
        error_str = str(e).lower()
        if "401" in error_str or "unauthorized" in error_str:
            print("\n\n💡 诊断结论: API Key 认证失败 (401)")
            print("   可能原因:")
            print("   1. API Key 无效或已过期")
            print("   2. API Key 格式不正确")
            print("   3. API Key 权限不足")
            print("   4. 使用了占位符而非真实 Key")

        elif "403" in error_str or "forbidden" in error_str:
            print("\n\n💡 诊断结论: 权限被拒绝 (403)")
            print("   可能原因:")
            print("   1. 账户余额不足")
            print("   2. IP 地址被限制")
            print("   3. API 调用配额已用完")

        elif "429" in error_str or "rate" in error_str:
            print("\n\n💡 诊断结论: 请求频率限制 (429)")
            print("   可能原因:")
            print("   1. API 调用过快")
            print("   2. 免费套餐限制")

        elif "timeout" in error_str or "timed out" in error_str:
            print("\n\n💡 诊断结论: 请求超时")
            print("   可能原因:")
            print("   1. 网络连接问题")
            print("   2. DeepSeek 服务响应慢")

        else:
            print("\n\n💡 诊断结论: 其他未知错误")
            print("   建议检查网络连接和 DeepSeek 服务状态")

    # 3. 测试 HTTP 客户端
    print("\n\n[步骤 3] 测试 HTTP 客户端配置")
    print("-" * 70)

    try:
        import httpx

        # 构建请求头
        headers = {
            "Content-Type": "application/json",
        }
        if llm_service.config.api_key:
            headers["Authorization"] = f"Bearer {llm_service.config.api_key}"

        print(f"📡 HTTP 请求配置:")
        print(f"   URL: {llm_service.config.base_url}/chat/completions")
        print(f"   Headers: {json.dumps(headers, indent=4, ensure_ascii=False)}")

        payload = {
            "model": llm_service.config.model,
            "messages": [{"role": "user", "content": "hi"}],
            "max_tokens": 10,
            "temperature": 0.7,
        }
        print(f"   Payload: {json.dumps(payload, indent=4, ensure_ascii=False)}")

    except Exception as e:
        print(f"❌ HTTP 客户端测试失败: {e}")

    # 4. 检查环境变量和配置文件
    print("\n\n[步骤 4] 检查配置文件和环境变量")
    print("-" * 70)

    env_checks = [
        ("LLM_PROVIDER", os.environ.get("LLM_PROVIDER")),
        ("OPENAI_API_KEY", os.environ.get("OPENAI_API_KEY")),
        ("DEEPSEEK_API_KEY", os.environ.get("DEEPSEEK_API_KEY")),
        ("LLM_MODEL", os.environ.get("LLM_MODEL")),
    ]

    for name, value in env_checks:
        if value:
            masked = value[:8] + "..." + value[-4:] if len(value) > 12 and "KEY" in name else value
            print(f"✅ {name}: {masked} (长度={len(value)})")
        else:
            print(f"⚠️  {name}: 未设置")

    # 检查 .env 文件
    env_file = os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env')
    if os.path.exists(env_file):
        print(f"\n✅ .env 文件存在: {env_file}")
        with open(env_file, 'r', encoding='utf-8') as f:
            content = f.read()
            if 'OPENAI_API_KEY=' in content:
                for line in content.split('\n'):
                    if line.startswith('OPENAI_API_KEY='):
                        key_value = line.split('=', 1)[1].strip()
                        print(f"   .env 中的 OPENAI_API_KEY: {key_value[:10]}...{key_value[-10:] if len(key_value) > 20 else key_value} (长度={len(key_value)})")
                        break
    else:
        print(f"\n⚠️  .env 文件不存在: {env_file}")
        print("   系统将使用 config.py 中的默认值或环境变量")


if __name__ == "__main__":
    asyncio.run(debug_chat_request())
