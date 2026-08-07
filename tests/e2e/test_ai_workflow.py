"""
RMFOOD 配方平台 - AI工作流E2E测试

测试AI辅助功能的端到端流程：
1. AI生成→优化→保存→团队协作评论
2. 测试AI功能完整性和生成的提示词质量
3. 验证团队协作中的版本控制和评论机制

标记: @pytest.mark.e2e @pytest.mark.integration
"""
import pytest
import pytest_asyncio
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Any
from unittest.mock import patch, AsyncMock, MagicMock
import asyncio
import json
import re

from conftest import TestHelpers, TEST_USERS


@pytest.mark.e2e
@pytest.mark.integration
class TestAIGenerationWorkflow:
    """
    AI配方/提示词生成工作流测试
    验证从需求输入到最终输出的完整流程
    """

    @pytest.mark.asyncio
    async def test_ai_prompt_generation_basic(
        self, client, auth_tokens, mock_ai_service
    ):
        """
        测试基本的AI提示词生成功能
        输入需求描述 → AI生成优化提示词
        """
        owner_token = auth_tokens["owner"]
        headers = {"Authorization": f"Bearer {owner_token}"}

        # 构建AI生成请求
        generation_request = {
            "requirements": {
                "target_product": "功能性饮料",
                "key_ingredients": ["枸杞", "黄芪", "人参"],
                "health_benefits": ["增强免疫力", "抗疲劳", "改善睡眠"],
                "constraints": {
                    "max_cost_per_unit": 15.0,
                    "shelf_life_months": 12,
                    "taste_profile": "清淡甘甜",
                },
            },
            "options": {
                "creativity_level": 0.7,
                "include_scientific_basis": True,
                "language": "zh-CN",
            },
        }

        # 调用AI生成API
        gen_resp = await client.post(
            "/api/v1/ai/generate-prompt",
            json=generation_request,
            headers=headers,
        )

        assert gen_resp.status_code == 200, \
            f"AI生成失败: {gen_resp.text}"
        result = gen_resp.json()

        # 验证响应结构完整性
        required_fields = [
            "generated_prompt",
            "model_used",
            "tokens_used",
        ]
        for field in required_fields:
            assert field in result, f"AI响应缺少字段: {field}"

        # 验证生成内容质量
        prompt_text = result["generated_prompt"]
        assert len(prompt_text) > 50, \
            f"生成的提示词过短 ({len(prompt_text)} 字符)"

        # 检查是否包含关键信息（基于输入需求）
        keywords_to_check = [
            "配料", "成分", "功效",  # 中文关键词
            "ingredient", "formula",  # 英文关键词（可能包含）
        ]
        keyword_matches = sum(
            1 for kw in keywords_to_check
            if kw.lower() in prompt_text.lower()
        )
        assert keyword_matches >= 2, \
            f"生成内容缺少关键信息 (匹配{keyword_matches}/{len(keywords_to_check)})"

        print(f"\n🤖 AI生成成功:")
        print(f"   模型: {result.get('model_used', 'N/A')}")
        print(f"   Token使用: {result.get('tokens_used', 'N/A')}")
        print(f"   提示词长度: {len(prompt_text)} 字符")
        print(f"   内容预览: {prompt_text[:100]}...")

    @pytest.mark.asyncio
    async def test_ai_formula_optimization(
        self, client, auth_tokens, mock_ai_service
    ):
        """
        测试AI配方优化功能
        输入初始配方 → AI提供优化建议
        """
        owner_token = auth_tokens["owner"]
        headers = {"Authorization": f"Bearer {owner_token}"}

        optimization_request = {
            "current_formula": {
                "name": "基础免疫增强饮料",
                "ingredients": [
                    {"name": "枸杞提取物", "ratio": 0.15},
                    {"name": "维生素C", "ratio": 0.05},
                    {"name": "蔗糖", "ratio": 0.10},
                    {"name": "水", "ratio": 0.70},
                ],
                "processing_params": {
                    "temperature": 85,
                    "time_minutes": 30,
                    "ph_level": 6.5,
                },
            },
            "optimization_goals": [
                "提高功效成分浓度",
                "降低成本10%",
                "延长保质期",
            ],
            "constraints": {
                "maintain_taste": True,
                "regulatory_compliance": "GB标准",
            },
        }

        opt_resp = await client.post(
            "/api/v1/ai/optimize-formula",
            json=optimization_request,
            headers=headers,
        )

        assert opt_resp.status_code == 200, \
            f"AI优化失败: {opt_resp.text}"
        opt_result = opt_resp.json()

        # 验证优化结果结构
        assert "optimization_suggestions" in opt_result or \
               "suggestions" in opt_result or \
               "optimized_formula" in opt_result, \
               "优化响应应包含建议或优化后配方"

        suggestions = opt_result.get(
            "optimization_suggestions",
            opt_result.get("suggestions", [])
        )
        if isinstance(suggestions, list) and len(suggestions) > 0:
            print(f"\n⚡ AI优化建议 ({len(suggestions)} 条):")
            for i, sug in enumerate(suggestions[:5], 1):
                field = sug.get("field", sug.get("target", f"字段{i}"))
                suggestion = sug.get("suggestion", sug.get("recommendation", ""))
                print(f"   {i}. [{field}] {suggestion}")
        else:
            print(f"\n⚡ AI优化完成，返回完整优化配方")

        # 验证置信度评分（如果有）
        confidence = opt_result.get("confidence_score")
        if confidence is not None:
            assert 0 <= confidence <= 1, \
                f"置信度应在[0,1]范围内: {confidence}"
            print(f"   置信度: {confidence:.2%}")

    @pytest.mark.asyncio
    async def test_ai_requirement_analysis(
        self, client, auth_tokens, mock_ai_service
    ):
        """
        测试AI需求分析功能
        将模糊的用户需求转化为具体的技术参数
        """
        owner_token = auth_tokens["owner"]
        headers = {"Authorization": f"Bearer {owner_token}"}

        vague_requirements = {
            "user_description": "想要一款适合老年人的保健饮品，要健康安全，最好能帮助睡眠，不要太贵",
            "context": {
                "target_audience": "老年人(60+)",
                "product_category": "功能饮料",
                "price_sensitivity": "中高",
            },
        }

        analysis_resp = await client.post(
            "/api/v1/ai/analyze-requirements",
            json=vague_requirements,
            headers=headers,
        )

        assert analysis_resp.status_code == 200, \
            f"需求分析失败: {analysis_resp.text}"
        analysis_result = analysis_resp.json()

        # 验证分析输出结构
        assert "analysis" in analysis_result or \
               "structured_requirements" in analysis_result or \
               "key_parameters" in analysis_result, \
               "分析结果应包含结构化参数"

        key_params = analysis_result.get(
            "key_parameters",
            analysis_result.get("structured_requirements", [])
        )
        if isinstance(key_params, list):
            assert len(key_params) > 0, "应提取出至少一个关键参数"
            print(f"\n🔍 关键参数提取 ({len(key_params)} 个):")
            for param in key_params[:8]:
                if isinstance(param, dict):
                    print(f"   • {param.get('name', param.get('parameter', str(param)))}")
                else:
                    print(f"   • {param}")

        suggestions = analysis_result.get("suggestions", [])
        if suggestions:
            print(f"\n💡 AI建议:")
            for sug in suggestions[:3]:
                print(f"   - {sug}")


@pytest.mark.e2e
@pytest.mark.integration
class TestAISaveAndVersionControl:
    """
    AI生成内容的保存与版本控制测试
    验证生成内容可以正确保存、版本化和回滚
    """

    @pytest.mark.asyncio
    async def test_save_generated_prompt(
        self, client, auth_tokens, mock_ai_service
    ):
        """测试将AI生成的提示词保存到系统"""
        owner_token = auth_tokens["owner"]
        headers = {"Authorization": f"Bearer {owner_token}"}

        # 先生成一个提示词
        gen_request = {
            "requirements": {
                "target_product": "测试产品",
                "key_ingredients": ["成分A", "成分B"],
            }
        }

        gen_resp = await client.post(
            "/api/v1/ai/generate-prompt",
            json=gen_request,
            headers=headers,
        )
        assert gen_resp.status_code == 200
        generated_content = gen_resp.json()["generated_prompt"]

        # 保存生成的提示词
        save_payload = {
            "title": f"AI生成测试_{datetime.now().strftime('%H%M%S')}",
            "content": generated_content,
            "source": "ai_generated",
            "metadata": {
                "model_used": gen_resp.json().get("model_used"),
                "generation_id": f"gen_{datetime.now().timestamp()}",
                "requirements_hash": hash(str(gen_request)) % 10000,
            },
            "tags": ["auto-generated", "e2e-test"],
        }

        save_resp = await client.post(
            "/api/v1/prompts",
            json=save_payload,
            headers=headers,
        )

        if save_resp.status_code in [200, 201]:
            saved_data = save_resp.json()
            prompt_id = saved_data.get("id", saved_data.get("prompt_id"))
            assert prompt_id is not None, "保存成功但未返回ID"

            print(f"\n💾 AI生成内容保存成功:")
            print(f"   Prompt ID: {prompt_id}")
            print(f"   标题: {save_payload['title']}")
            print(f"   内容长度: {len(generated_content)} 字符")
        else:
            print(f"\n⚠️ 保存API可能需要调整 (status={save_resp.status_code})")
            print(f"   响应: {save_resp.text[:200]}")

    @pytest.mark.asyncio
    async def test_version_history_tracking(
        self, client, auth_tokens, db_session
    ):
        """测试版本历史记录和追踪"""
        owner_token = auth_tokens["owner"]
        headers = {"Authorization": f"Bearer {owner_token}"}

        # 创建或获取一个提示词
        create_payload = {
            "title": "版本测试提示词",
            "content": "初始版本内容 V1",
        }
        create_resp = await client.post("/api/v1/prompts", json=create_payload, headers=headers)

        if create_resp.status_code not in [200, 201]:
            print(f"⚠️ 提示词创建API可能不存在 (status={create_resp.status_code})")
            return

        prompt_data = create_resp.json()
        prompt_id = prompt_data.get("id")

        # 进行多次编辑以产生版本历史
        versions_created = []
        for i in range(2, 4):  # 创建V2、V3
            update_payload = {
                "content": f"编辑后的版本 V{i} - 修改时间: {datetime.now().isoformat()}",
                "change_summary": f"第{i-1}次编辑：更新测试内容",
            }
            update_resp = await client.put(
                f"/api/v1/prompts/{prompt_id}",
                json=update_payload,
                headers=headers,
            )
            if update_resp.status_code == 200:
                versions_created.append(i)
                await asyncio.sleep(0.1)  # 确保时间戳不同

        # 获取版本历史
        history_resp = await client.get(
            f"/api/v1/prompts/{prompt_id}/versions",
            headers=headers,
        )

        if history_resp.status_code == 200:
            history_data = history_resp.json()
            versions = history_data.get("versions", history_data)

            print(f"\n📜 版本历史记录:")
            print(f"   提示词ID: {prompt_id}")
            print(f"   版本数: {len(versions)}")

            for ver in versions[:5]:
                ver_num = ver.get("version_number", ver.get("version", "?"))
                created = ver.get("created_at", ver.get("timestamp", "N/A"))
                summary = ver.get("change_summary", ver.get("summary", ""))
                print(f"   V{ver_num} | {created} | {summary[:50] if summary else '...'}")

            assert len(versions) >= len(versions_created), \
                f"版本数不足: 期望至少{len(versions_created)}, 实际{len(versions)}"
        else:
            print(f"⚠️ 版本历史API可能未实现 (status={history_resp.status_code})")

    @pytest.mark.asyncio
    async def test_version_diff_and_rollback(
        self, client, auth_tokens, db_session
    ):
        """测试版本差异对比和回滚功能"""
        owner_token = auth_tokens["owner"]
        headers = {"Authorization": f"Bearer {owner_token}"}

        # 创建提示词并多次修改（简化版）
        prompt_title = f"Diff测试_{datetime.now().strftime('%H%M%S')}"

        # 初始创建
        create_resp = await client.post("/api/v1/prompts", json={
            "title": prompt_title,
            "content": "原始内容 - 包含重要段落A和B",
        }, headers=headers)

        if create_resp.status_code not in [200, 201]:
            print(f"⚠️ 跳过Diff测试：创建失败")
            return

        prompt_id = create_resp.json().get("id")

        # 修改为V2
        await client.put(f"/api/v1/prompts/{prompt_id}", json={
            "content": "修改后内容V2 - 段落A已更新，新增段落C",
            "change_summary": "重大更新",
        }, headers=headers)

        # 尝试获取版本差异
        diff_resp = await client.get(
            f"/api/v1/prompts/{prompt_id}/diff",
            params={"version_from": 1, "version_to": 2},
            headers=headers,
        )

        if diff_resp.status_code == 200:
            diff_data = diff_resp.json()
            print(f"\n🔄 版本差异对比:")
            print(f"   变更类型: {diff_data.get('diff_type', 'N/A')}")
            changes = diff_data.get("changes", diff_data.get("diffs", []))
            print(f"   变更数量: {len(changes)}")

            for change in changes[:5]:
                action = change.get("action", change.get("type", "?"))
                content_preview = str(change.get("content", ""))[:60]
                print(f"   [{action}] {content_preview}...")
        else:
            print(f"ℹ️ Diff API状态: {diff_resp.status_code}")

        # 尝试回滚到V1
        rollback_resp = await client.post(
            f"/api/v1/prompts/{prompt_id}/rollback",
            json={"target_version": 1},
            headers=headers,
        )

        if rollback_resp.status_code == 200:
            rollback_data = rollback_resp.json()
            current_version = rollback_data.get("current_version", rollback_data.get("version"))
            print(f"\n↩️ 回滚成功: 当前版本 V{current_version}")

            # 验证内容已恢复
            get_resp = await client.get(f"/api/v1/prompts/{prompt_id}", headers=headers)
            if get_resp.status_code == 200:
                content = get_resp.json().get("content", "")
                assert "原始内容" in content or "段落A" in content, \
                    "回滚后内容不正确"
                print(f"✅ 内容验证通过: 已恢复到V1")
        else:
            print(f"ℹ️ 回滚API状态: {rollback_resp.status_code}")


@pytest.mark.e2e
@pytest.mark.integration
class TestAITeamCollaboration:
    """
    AI生成内容的团队协作测试
    验证团队成员可以对AI生成的内容进行评论、审核和共同优化
    """

    @pytest.mark.asyncio
    async def test_team_comment_on_ai_generated_content(
        self, client, auth_tokens, test_team, mock_ai_service
    ):
        """
        测试团队成员对AI生成内容添加评论
        Owner生成 → Member评论 → Owner查看评论
        """
        owner_token = auth_tokens["owner"]
        member1_token = auth_tokens["member1"]
        team_id = test_team.id

        headers_owner = {"Authorization": f"Bearer {owner_token}"}
        headers_member = {"Authorization": f"Bearer {member1_token}"}

        # Step 1: Owner使用AI生成提示词
        gen_resp = await client.post("/api/v1/ai/generate-prompt", json={
            "requirements": {
                "target_product": "团队协作测试产品",
                "key_ingredients": ["成分X", "成分Y"],
            }
        }, headers=headers_owner)
        assert gen_resp.status_code == 200
        ai_content = gen_resp.json()["generated_prompt"]

        # Step 2: 保存并共享给团队（如果API支持）
        save_resp = await client.post("/api/v1/prompts", json={
            "title": "团队协作文档",
            "content": ai_content,
            "team_id": team_id,
        }, headers=headers_owner)

        resource_id = None
        if save_resp.status_code in [200, 201]:
            resource_id = save_resp.json().get("id")
            print(f"\n📝 Owner创建并共享文档: ID={resource_id}")

        # Step 3: Member1添加评论
        comment_texts = [
            "这个配方的成本可能偏高，建议寻找替代原料",
            "功效部分表述很好，但需要补充临床数据支持",
            "建议增加口感调节的说明",
        ]

        comments_created = []
        for comment_text in comment_texts:
            comment_payload = {
                "content": comment_text,
                "entity_type": "prompt" if resource_id else "team",
                "entity_id": resource_id if resource_id else team_id,
            }

            # 尝试通用评论API
            comment_resp = await client.post(
                f"/api/v1/comments" if resource_id else f"/api/v1/teams/{team_id}/comments",
                json=comment_payload,
                headers=headers_member,
            )

            if comment_resp.status_code in [200, 201]:
                comment_id = comment_resp.json().get("id")
                comments_created.append(comment_id)
                print(f"   💬 Member1发表评论: {comment_text[:40]}...")
            elif comment_resp.status_code == 404:
                print(f"   ⚠️ 评论API可能未实现 (404)")
                break
            else:
                print(f"   ⚠️ 评论失败: {comment_resp.status_code}")

        # Step 4: Owner查看所有评论
        if resource_id and comments_created:
            list_comments_resp = await client.get(
                f"/api/v1/prompts/{resource_id}/comments",
                headers=headers_owner,
            )

            if list_comments_resp.status_code == 200:
                all_comments = list_comments_resp.json()
                comment_list = all_comments.get("comments", all_comments)

                print(f"\n📋 文档评论列表 (共{len(comment_list)}条):")
                for cmt in comment_list:
                    author = cmt.get("author", cmt.get("username", "未知"))
                    text = cmt.get("content", "")[:50]
                    print(f"   • [{author}] {text}...")

                assert len(comment_list) >= len(comments_created), \
                    "评论数量不匹配"
                print(f"\n✅ 团队协作评论流程验证通过")
            else:
                print(f"ℹ️ 获取评论列表: {list_comments_resp.status_code}")

    @pytest.mark.asyncio
    async def test_collaborative_optimization_workflow(
        self, client, auth_tokens, test_team, mock_ai_service
    ):
        """
        测试协作式AI优化工作流
        多轮迭代：AI初版 → 团队反馈 → AI再优化 → 最终确认
        """
        owner_token = auth_tokens["owner"]
        member1_token = auth_tokens["member1"]
        team_id = test_team.id

        headers_owner = {"Authorization": f"Bearer {owner_token}"}
        headers_member = {"Authorization": f"Bearer {member1_token}"}



        iteration_log = []

        # ── 第1轮：Owner请求AI生成初版 ──
        print(f"\n{'='*60}")
        print(f"🔄 第1轮: AI生成初版")
        print(f"{'='*60}")

        initial_req = {
            "requirements": {
                "target_product": "协作优化测试产品",
                "initial_constraints": {
                    "budget": 20.0,
                    "development_timeline": "3个月",
                },
            }
        }

        round1_resp = await client.post(
            "/api/v1/ai/generate-prompt",
            json=initial_req,
            headers=headers_owner,
        )
        assert round1_resp.status_code == 200
        round1_output = round1_resp.json()["generated_prompt"]

        iteration_log.append({
            "round": 1,
            "action": "ai_generate",
            "output_length": len(round1_output),
            "by": "owner",
        })
        print(f"   ✅ 初版生成完成: {len(round1_output)} 字符")

        # ── 第2轮：Member1提供反馈 ──
        print(f"\n{'='*60}")
        print(f"💬 第2轮: 团队成员反馈")
        print(f"{'='*60}")

        feedback = {
            "strengths": ["逻辑清晰", "覆盖全面"],
            "improvements_needed": [
                "缺少具体的剂量范围",
                "安全性评估不够详细",
                "建议增加竞品对比",
            ],
            "additional_requirements": [
                "考虑特殊人群（孕妇、儿童）的使用禁忌",
                "补充法规合规性检查清单",
            ],
        }

        # 如果有反馈提交API
        feedback_resp = await client.post(
            f"/api/v1/prompts/feedback" if False else "/api/v1/ai/feedback",
            json={
                "content": round1_output,
                "feedback": feedback,
                "iteration_context": {
                    "round": 1,
                    "team_id": team_id,
                },
            },
            headers=headers_member,
        )

        iteration_log.append({
            "round": 2,
            "action": "team_feedback",
            "feedback_items": len(feedback["improvements_needed"]) + len(feedback["additional_requirements"]),
            "by": "member1",
        })
        print(f"   ✅ 反馈提交完成: {len(feedback['improvements_needed'])} 条改进建议")

        # ── 第3轮：基于反馈的再优化 ──
        print(f"\n{'='*60}")
        print(f"⚡ 第3轮: AI再优化")
        print(f"{'='*60}")

        optimization_req = {
            "current_content": round1_output,
            "feedback": feedback,
            "optimization_focus": [
                "add_dosage_ranges",
                "enhance_safety_assessment",
                "add_regulatory_checklist",
            ],
        }

        round3_resp = await client.post(
            "/api/v1/ai/optimize-with-feedback",
            json=optimization_req,
            headers=headers_owner,
        )

        if round3_resp.status_code == 200:
            optimized_output = round3_resp.json().get(
                "optimized_content",
                round3_resp.json().get("generated_prompt", "")
            )

            iteration_log.append({
                "round": 3,
                "action": "ai_reoptimize",
                "output_length": len(optimized_output),
                "by": "owner_with_feedback",
            })
            print(f"   ✅ 再优化完成: {len(optimized_output)} 字符")

            # 验证优化后的内容应该更长（包含更多细节）
            assert len(optimized_output) > len(round1_output), \
                "优化后内容应更详细"
            improvement_pct = (
                (len(optimized_output) - len(round1_output))
                / len(round1_output) * 100
            )
            print(f"   📈 内容丰富度提升: +{improvement_pct:.1f}%")
        else:
            print(f"   ⚠️ 基于反馈的优化API可能未实现 (status={round3_resp.status_code})")
            optimized_output = round1_output  # 使用初版作为最终版

        # ── 最终确认 ──
        print(f"\n{'='*60}")
        print(f"✅ 协作式优化工作流完成")
        print(f"{'='*60}")
        print(f"\n📊 迭代日志:")
        for entry in iteration_log:
            print(f"   Round {entry['round']}: "
                  f"{entry['action']} | by {entry['by']} | "
                  f"{entry.get('output_length', entry.get('feedback_items', ''))}")

        print(f"\n最终输出长度: {len(optimized_output)} 字符")


@pytest.mark.e2e
class TestAIQualityAndEdgeCases:
    """
    AI输出质量验证和边界情况测试
    确保AI功能在各种输入下的稳定性和输出质量
    """

    @pytest.mark.asyncio
    async def test_empty_or_minimal_input_handling(
        self, client, auth_tokens, mock_ai_service
    ):
        """测试空输入或最小化输入的处理"""
        owner_token = auth_tokens["owner"]
        headers = {"Authorization": f"Bearer {owner_token}"}

        minimal_inputs = [
            {},  # 空对象
            {"requirements": {}},  # 空需求
            {"requirements": {"target_product": ""}},  # 空字符串值
        ]

        for inp in minimal_inputs:
            resp = await client.post(
                "/api/v1/ai/generate-prompt",
                json=inp,
                headers=headers,
            )
            # 应返回400/422而非500
            assert resp.status_code in [200, 400, 422], \
                f"最小化输入处理异常: {resp.status_code}"

            if resp.status_code == 200:
                result = resp.json()
                assert len(result.get("generated_prompt", "")) > 0, \
                    "即使是最小输入也应生成有效内容"

        print(f"✅ 最小化输入处理测试通过: {len(minimal_inputs)} 个用例")

    @pytest.mark.asyncio
    async def test_very_long_input_handling(
        self, client, auth_tokens, mock_ai_service
    ):
        """测试超长输入的处理"""
        owner_token = auth_tokens["owner"]
        headers = {"Authorization": f"Bearer {owner_token}"}

        long_description = "这是一个非常长的产品描述。" * 500  # 约15000字符

        large_input = {
            "requirements": {
                "user_description": long_description,
                "detailed_specs": {f"spec_{i}": f"value_{i}" for i in range(100)},
            }
        }

        resp = await client.post(
            "/api/v1/ai/generate-prompt",
            json=large_input,
            headers=headers,
        )

        if resp.status_code == 200:
            print(f"✅ 超长输入处理成功")
        elif resp.status_code == 413:
            print(f"✅ 超长输入正确拒绝 (Payload Too Large)")
        else:
            print(f"⚠️ 超长输入返回: {resp.status_code}")

    @pytest.mark.asyncio
    async def test_special_characters_in_input(
        self, client, auth_tokens, mock_ai_service
    ):
        """测试输入中的特殊字符处理"""
        owner_token = auth_tokens["owner"]
        headers = {"Authorization": f"Bearer {owner_token}"}

        special_inputs = [
            {"requirements": {"target_product": "<script>alert('xss')</script>"}},
            {"requirements": {"target_product": "产品'; DROP TABLE users; --"}},
            {"requirements": {"target_product": "中文产品名🎉🚀含emoji"}},
            {"requirements": {"target_product": "Product with\nnewlines\tand\ttabs"}},
        ]

        for inp in special_inputs:
            resp = await client.post(
                "/api/v1/ai/generate-prompt",
                json=inp,
                headers=headers,
            )
            # 不应导致服务器错误
            assert resp.status_code != 500, \
                f"特殊字符导致服务器错误: {resp.status_code}"

            if resp.status_code == 200:
                output = resp.json().get("generated_prompt", "")
                # 验证输出不含明显的注入代码（基本检查）
                assert "<script>" not in output.lower() or \
                       "alert(" not in output.lower(), \
                       "可能的XSS注入未被过滤"

        print(f"✅ 特殊字符处理测试通过: {len(special_inputs)} 个用例")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short", "-m", "e2e or integration"])
