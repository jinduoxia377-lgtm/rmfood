"""
文件生成服务测试脚本
用于验证 file_generator.py 模块功能
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import asyncio
from app.services.file_generator import (
    FileGeneratorService,
    FileFormat,
    TaskStatus
)


def create_test_content():
    return {
        "title": "RMFOOD配方报告 - 测试配方001",
        "sections": [
            {
                "heading": "配方基本信息",
                "content": [
                    "配方名称：测试配方",
                    "配方编号：RMF-20260424-0001",
                    "目标功效：增强免疫力、抗疲劳",
                    "剂型：固体饮料",
                ]
            },
            {
                "heading": "成分组成",
                "table": {
                    "headers": ["成分名称", "用量(g)", "功效", "来源"],
                    "data": [
                        ["人参", "5.0", "大补元气", "人工种植"],
                        ["黄芪", "10.0", "补气固表", "山西"],
                        ["枸杞", "8.0", "滋补肝肾", "宁夏"],
                        ["蜂蜜", "20.0", "矫味", "天然"],
                    ]
                }
            },
            {
                "heading": "加工工艺",
                "content": [
                    "1. 原料预处理：将各成分分别进行清洗、干燥、粉碎处理。",
                    "2. 精确称量：按照配方比例精确称取各成分。",
                    "3. 混合制粒：将粉末混合均匀，加入适量粘合剂制粒。",
                    "4. 干燥包装：在低温下干燥处理后进行密封包装。",
                ]
            },
            {
                "heading": "质量标准",
                "table": {
                    "headers": ["检验项目", "标准要求", "检验方法"],
                    "data": [
                        ["外观", "淡黄色粉末", "目测"],
                        ["水分", "≤5%", "烘干法"],
                        ["重金属", "符合国家标准", "原子吸收"],
                        ["微生物", "符合规定", "培养法"],
                    ]
                }
            },
        ],
        "footer": "报告生成时间：2026-04-24 | RMFOOD配方设计平台"
    }


def test_sync_generation():
    print("=" * 60)
    print("测试同步文件生成...")
    print("=" * 60)

    service = FileGeneratorService()
    content = create_test_content()

    for format_type in [FileFormat.PDF, FileFormat.DOCX, FileFormat.XLSX]:
        file_name = f"测试配方报告.{format_type.value}"
        try:
            print(f"\n生成 {format_type.value.upper()} 文件...")
            file_path, returned_name = service.generate_file(
                content=content,
                format=format_type,
                file_name=file_name
            )
            print(f"  ✓ 生成成功: {returned_name}")
            print(f"  ✓ 文件路径: {file_path}")
            print(f"  ✓ 文件大小: {os.path.getsize(file_path)} bytes")
        except Exception as e:
            print(f"  ✗ 生成失败: {e}")

    print("\n" + "=" * 60)
    print("同步文件生成测试完成!")
    print("=" * 60)


async def test_async_generation():
    print("\n" + "=" * 60)
    print("测试异步文件生成...")
    print("=" * 60)

    service = FileGeneratorService()
    content = create_test_content()

    for format_type in [FileFormat.PDF, FileFormat.DOCX, FileFormat.XLSX]:
        file_name = f"异步测试_{format_type.value}"
        try:
            print(f"\n异步生成 {format_type.value.upper()} 文件...")
            task_id = await service.generate_file_async(
                content=content,
                format=format_type,
                file_name=file_name
            )
            print(f"  ✓ 任务ID: {task_id}")

            for _ in range(20):
                await asyncio.sleep(0.3)
                status = service.get_task_status(task_id)
                if status:
                    print(f"  - 状态: {status.status.value}, 进度: {status.progress}%")
                    if status.status == TaskStatus.COMPLETED:
                        print(f"  ✓ 生成成功! 文件: {status.file_name}")
                        break
                    elif status.status == TaskStatus.FAILED:
                        print(f"  ✗ 生成失败: {status.error_message}")
                        break
        except Exception as e:
            print(f"  ✗ 异步生成失败: {e}")

    print("\n" + "=" * 60)
    print("异步文件生成测试完成!")
    print("=" * 60)


def test_task_status():
    print("\n" + "=" * 60)
    print("测试任务状态查询...")
    print("=" * 60)

    service = FileGeneratorService()
    content = create_test_content()

    task_id = service.generate_file(
        content=content,
        format=FileFormat.PDF,
        file_name="状态测试.pdf"
    )[0]

    status = service.get_task_status(task_id)
    if status:
        print(f"  任务ID: {status.task_id}")
        print(f"  状态: {status.status.value}")
        print(f"  进度: {status.progress}%")
        print(f"  创建时间: {status.created_at}")
        print(f"  文件名: {status.file_name}")

    print("\n" + "=" * 60)
    print("任务状态查询测试完成!")
    print("=" * 60)


def main():
    print("\n" + "=" * 60)
    print("RMFOOD 文件生成服务测试")
    print("=" * 60)

    test_sync_generation()
    test_task_status()
    asyncio.run(test_async_generation())

    print("\n" + "=" * 60)
    print("所有测试完成!")
    print("=" * 60)


if __name__ == "__main__":
    main()
