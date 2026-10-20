"""测试 check_prompt 对正常子任务文本的误报。"""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services.ai.safety.prompt_guard import check_prompt

CASES = [
    "请检索并汇总常见药食同源原料的法规要求，给出专业建议。",
    "请设计一款辅助降血糖的饮品配方，包含君臣佐使结构与克重。",
    "请审查配方安全性，检查十八反与剂量上限。",
    "请评估毒理学风险，基于文献检索。",
    "请对常见药食同源原料开展毒理学研究文献检索，汇总 LD50、NOAEL/ADI 等慢性毒性参考值。",  # 任务43的子任务
]


async def main() -> None:
    for c in CASES:
        r = check_prompt(c)
        print(f"blocked={r.is_blocked} score={r.security_score} level={r.threat_level} | {c[:40]}")


if __name__ == "__main__":
    asyncio.run(main())