"""
RMFOOD API Key 诊断工具
用于快速检测和解决 API Key 配置问题
"""

import asyncio
import sys
import os

# 添加项目路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def print_header(title: str):
    """打印标题"""
    print(f"\n{'='*60}")
    print(f"  {title}")
    print('='*60)


def print_status(label: str, status: str, detail: str = ""):
    """打印状态信息"""
    icon = "✅" if status == "OK" else "❌" if status == "FAIL" else "⚠️"
    print(f"{icon} {label}: {status}" + (f" - {detail}" if detail else ""))


async def check_backend_config():
    """检查后端配置"""
    print_header("1️⃣ 检查后端 LLM 配置")

    try:
        from app.services.llm_service import llm_service, LLMConfig, PROVIDER_DEEPSEEK
        from app.core.config import settings

        config = llm_service.config

        # 检查 Provider
        provider_ok = config.provider in ['deepseek', 'openai', 'zhipu', 'qwen']
        print_status("LLM Provider", "OK" if provider_ok else "WARN", config.provider)

        # 检查 Model
        model_ok = bool(config.model)
        print_status("LLM Model", "OK" if model_ok else "FAIL", config.model or "(未设置)")

        # 检查 API Key（关键！）
        api_key = config.api_key or ""
        api_key_ok = len(api_key) >= 40

        if api_key:
            # 显示部分 Key（隐藏中间部分）
            masked_key = api_key[:8] + "..." + api_key[-4:] if len(api_key) > 12 else "***"
            print_status(
                "API Key",
                "OK" if api_key_ok else "FAIL",
                f"长度={len(api_key)}字符, 值={masked_key}"
            )
            if not api_key_ok:
                print(f"\n   ⚠️  API Key 长度不足！当前 {len(api_key)} 字符，需要 40+ 字符")
                print(f"   💡 正常的 DeepSeek API Key 格式: sk-xxxx...(50-60字符)")
        else:
            print_status("API Key", "FAIL", "未配置")
            print(f"\n   ⚠️  未检测到 API Key！")

        # 检查 Base URL
        import os
        base_url = config.base_url or \
                   getattr(settings, "openai_base_url", "") or \
                   os.environ.get("OPENAI_BASE_URL", "") or \
                   getattr(settings.ai_service, "base_url", "") or \
                   ""
        base_url_ok = bool(base_url)
        print_status("Base URL", "OK" if base_url_ok else "WARN", base_url or "(使用默认值)")

        return api_key_ok

    except Exception as e:
        print_status("配置加载", "FAIL", str(e))
        import traceback
        traceback.print_exc()
        return False


async def check_env_variables():
    """检查环境变量"""
    print_header("2️⃣ 检查环境变量")

    env_vars = {
        "LLM_PROVIDER": os.environ.get("LLM_PROVIDER"),
        "OPENAI_API_KEY": os.environ.get("OPENAI_API_KEY"),
        "DEEPSEEK_API_KEY": os.environ.get("DEEPSEEK_API_KEY"),
        "LLM_MODEL": os.environ.get("LLM_MODEL"),
        "OPENAI_BASE_URL": os.environ.get("OPENAI_BASE_URL"),
    }

    for name, value in env_vars.items():
        if value:
            if "KEY" in name:
                masked = value[:8] + "..." + value[-4:] if len(value) > 12 else "***"
                print_status(name, "OK", f"长度={len(value)}, 值={masked}")
            else:
                print_status(name, "OK", value)
        else:
            print_status(name, "INFO", "(未设置)")

    # 检查 .env 文件
    env_file = os.path.join(os.path.dirname(__file__), '.env')
    if os.path.exists(env_file):
        print_status(".env 文件", "OK", f"存在 ({env_file})")
    else:
        print_status(".env 文件", "WARN", "不存在")


async def test_api_connection():
    """测试 API 连接"""
    print_header("3️⃣ 测试 DeepSeek API 连接")

    try:
        from app.services.llm_service import chat_with_rmfood, llm_service

        if not llm_service.is_available:
            print_status("服务可用性", "FAIL", "LLM 服务未配置")
            return False

        print("\n   🔄 正在调用 DeepSeek API (测试消息: '你好')...")
        result = await chat_with_rmfood(question="你好", history=None)

        if "失败" in result or "error" in result.lower():
            print_status("API 调用", "FAIL", result[:100])
            return False
        else:
            print_status("API 调用", "OK", f"成功获得回复 (长度: {len(result)})")
            print(f"\n   📝 AI 回复预览:\n      {result[:150]}{'...' if len(result) > 150 else ''}")
            return True

    except Exception as e:
        error_msg = str(e)
        print_status("API 调用", "FAIL", error_msg[:100])

        if "401" in error_msg or "Unauthorized" in error_msg:
            print(f"\n   🔴 认证失败 (401 Unauthorized)")
            print(f"   原因: API Key 无效或已过期")
            print(f"   解决: 请重新获取有效的 API Key")

        elif "403" in error_msg or "Forbidden" in error_msg:
            print(f"\n   🔴 权限被拒绝 (403 Forbidden)")
            print(f"   原因: 账户余额不足或权限问题")
            print(f"   解决: 请检查 DeepSeek 账户余额和 API 权限")

        elif "429" in error_msg or "rate" in error_msg.lower():
            print(f"\n   🟡 请求频率限制 (429 Too Many Requests)")
            print(f"   原因: API 调用频率过高")
            print(f"   解决: 稍后重试或升级账户套餐")

        return False


async def show_fix_instructions():
    """显示修复指南"""
    print_header("📋 修复指南")

    guide = """
┌─────────────────────────────────────────────────────────────┐
│                    🔧 API Key 配置步骤                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  步骤 1: 获取 API Key                                       │
│  ─────────────────────                                     │
│  ① 打开浏览器访问: https://platform.deepseek.com/          │
│  ② 登录你的 DeepSeek 账号                                   │
│  ③ 进入 "API Keys" 管理页面                                 │
│  ④ 点击 "Create API Key" 创建新密钥                         │
│  ⑤ 复制完整的 API Key (以 sk- 开头，约50-60字符)             │
│                                                             │
│  步骤 2: 配置到系统                                         │
│  ─────────────────────                                     │
│  方法 A - 通过前端界面 (推荐):                               │
│  ① 访问 http://localhost:3000/settings                      │
│  ② 找到 "模型配置" → "LLM" 标签页                           │
│  ③ 粘贴完整 API Key                                        │
│  ④ 点击 "保存配置"                                          │
│                                                             │
│  方法 B - 通过环境变量 (更稳定):                             │
│  编辑 backend/.env 文件，添加:                               │
│  ┌──────────────────────────────────┐                       │
│  │ LLM_PROVIDER=deepseek           │                       │
│  │ OPENAI_API_KEY=sk-你的完整Key   │                       │
│  │ LLM_MODEL=deepseek-chat         │                       │
│  │ OPENAI_BASE_URL=https://api.deepseek.com/v1 │           │
│  └──────────────────────────────────┘                       │
│                                                             │
│  步骤 3: 验证配置                                           │
│  ─────────────────────                                     │
│  ① 重启后端服务                                             │
│  ② 运行本诊断工具: python scripts/diagnose_api_key.py       │
│  ③ 或在 AI 页面发送 "你好" 测试                             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
"""
    print(guide)


async def main():
    """主函数"""
    print("\n" + "🔬"*30)
    print("\n       RMFOOD API Key 诊断工具 v1.0")
    print("       用于快速检测和解决 AI 服务配置问题\n")
    print("🔬"*30)

    # 执行各项检查
    config_ok = await check_backend_config()
    await check_env_variables()
    api_ok = await test_api_connection()

    # 总结
    print_header("📊 诊断总结")

    all_ok = config_ok and api_ok

    if all_ok:
        print("\n✅ 所有检查通过！API 配置正常。")
        print("   你现在可以正常使用 AI 对话功能了。\n")
    else:
        print("\n⚠️ 发现问题需要修复:")
        if not config_ok:
            print("   ❌ 后端配置异常 (API Key 无效或缺失)")
        if not api_ok:
            print("   ❌ API 连接失败 (无法调用 DeepSeek)")
        print()
        await show_fix_instructions()


if __name__ == "__main__":
    asyncio.run(main())
