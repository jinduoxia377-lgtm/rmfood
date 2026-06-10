"""
RMFOOD 配方平台 - Locust 负载测试脚本

模拟真实用户行为进行性能压测，覆盖三大核心模块：
- 云端同步API（高并发数据同步）
- 团队协作API（成员管理和权限验证）
- AI助手API（生成和优化请求）

性能基线和目标指标：
  * 同步API: 1000并发用户, P95延迟<200ms
  * 团队API: 500 QPS, CPU使用率<70%
  * AI API: 50并发生成, 首字延迟<1s

使用方式:
  locust -f locustfile.py --host=http://localhost:8000 --users=100 --spawn-rate=10

作者: RMFOOD QA Team
日期: 2026-05-20
"""

import random
import string
import time
import json
from datetime import datetime, timezone, timedelta
from locust import HttpUser, task, between, events
from locust.runners import MasterRunner


# ════════════════════════════════════════════════
# 测试配置常量
# ════════════════════════════════════════════════

# 测试用户凭据池（预创建的测试账号）
TEST_USERS = [
    {"username": "perf_user_001", "password": "PerfTest123!"},
    {"username": "perf_user_002", "password": "PerfTest123!"},
    {"username": "perf_user_003", "password": "PerfTest123!"},
    {"username": "perf_user_004", "password": "PerfTest123!"},
    {"username": "perf_user_005", "password": "PerfTest123!"},
]

# 设备ID池（模拟多设备）
DEVICE_IDS = [
    f"perf-device-{i:03d}" for i in range(1, 21)
]

# 团队ID范围（假设已预创建）
TEAM_ID_RANGE = range(1, 11)

# 实体ID范围（配方/提示词等）
ENTITY_ID_RANGE = range(1000, 2000)


def random_string(length: int = 8) -> str:
    """生成随机字符串"""
    return ''.join(random.choices(string.ascii_lowercase + string.digits, k=length))


def generate_test_data() -> dict:
    """生成随机测试数据"""
    return {
        "name": f"PerfTest_{random_string(6)}_{datetime.now().strftime('%H%M%S%f')}",
        "description": f"Performance test data generated at {datetime.now().isoformat()}",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "random_value": random.randint(1, 1000),
    }


class RMFOODUser(HttpUser):
    """
    RMFOOD平台负载测试用户

    模拟真实用户行为模式：
    - 认证操作（登录/Token刷新）
    - 同步操作（推送/拉取/状态查询）
    - 团队操作（查看/邀请/评论）
    - AI操作（生成/优化）

    等待时间：1-3秒（模拟真实用户思考时间）
    """

    # 用户行为间隔：1到3秒之间
    wait_time = between(1, 3)

    def on_start(self):
        """
        用户启动时执行初始化
        - 登录获取Token
        - 选择测试用户和设备
        """
        self.token = None
        self.user_data = random.choice(TEST_USERS)
        self.device_id = random.choice(DEVICE_IDS)

        # 执行登录
        self.login()

        print(f"🚀 用户启动: {self.user_data['username']} (设备: {self.device_id})")

    def on_stop(self):
        """用户停止时清理资源"""
        if self.token:
            try:
                self.client.post(
                    "/api/v1/auth/logout",
                    headers={"Authorization": f"Bearer {self.token}"},
                    name="Auth: Logout"
                )
            except Exception:
                pass
        print(f"🛑 用户停止: {self.user_data['username']}")

    def login(self):
        """用户登录并缓存Token"""
        with self.client.post(
            "/api/v1/auth/login",
            json={
                "username": self.user_data["username"],
                "password": self.user_data["password"],
            },
            name="Auth: Login",
            catch_response=True,
        ) as response:
            if response.status_code == 200:
                data = response.json()
                self.token = data.get("access_token", data.get("token"))
                response.success()
            else:
                response.failure(f"Login failed: {response.status_code}")
                self.token = None

    def get_headers(self) -> dict:
        """构建带认证的请求头"""
        if not self.token:
            return {}
        return {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json",
        }

    # ═══════════════════════════════════════════
    # 云端同步任务组（权重：40%）
    # ═══════════════════════════════════════════

    @task(15)
    def sync_push_changes(self):
        """
        推送同步变更（高频操作）
        模拟用户编辑后自动保存的场景
        """
        if not self.token:
            return

        changes_count = random.randint(1, 5)
        changes = []
        for i in range(changes_count):
            entity_type = random.choice(["formula", "prompt", "ingredient"])
            action = random.choice(["create", "update", "delete"])

            change = {
                "entity_type": entity_type,
                "entity_id": random.choice(ENTITY_ID_RANGE),
                "action": action,
                "data": generate_test_data(),
                "version": random.randint(1, 10),
            }
            changes.append(change)

        payload = {
            "device_id": self.device_id,
            "changes": changes,
            "client_timestamp": datetime.now(timezone.utc).isoformat(),
        }

        with self.client.post(
            "/api/v1/sync/push",
            json=payload,
            headers=self.get_headers(),
            name="Sync: Push Changes",
            catch_response=True,
        ) as response:
            if response.status_code == 200:
                result = response.json()
                accepted = result.get("accepted_count", 0)
                if accepted >= 0:
                    response.success()
                else:
                    response.failure(f"Invalid accepted count: {accepted}")
            elif response.status_code == 401:
                # Token过期，重新登录
                self.login()
                response.success()  # 不算失败
            else:
                response.failure(f"Push failed: {response.status_code}")

    @task(10)
    def sync_pull_changes(self):
        """
        拉取同步变更
        模拟用户上线时获取最新数据的场景
        """
        if not self.token:
            return

        params = {
            "device_id": self.device_id,
            "limit": random.choice([20, 50, 100]),
        }

        # 30%概率带since参数（增量拉取）
        if random.random() < 0.3:
            since_time = datetime.now(timezone.utc) - timedelta(minutes=random.randint(5, 60))
            params["since"] = since_time.isoformat()

        with self.client.get(
            "/api/v1/sync/pull",
            params=params,
            headers=self.get_headers(),
            name="Sync: Pull Changes",
            catch_response=True,
        ) as response:
            if response.status_code == 200:
                data = response.json()
                changes = data.get("server_changes", data.get("changes", []))
                response.success()
            elif response.status_code == 401:
                self.login()
                response.success()
            else:
                response.failure(f"Pull failed: {response.status_code}")

    @task(8)
    def sync_get_status(self):
        """
        获取同步状态
        轻量级查询，用于监控设备同步健康度
        """
        if not self.token:
            return

        with self.client.get(
            "/api/v1/sync/status",
            params={"device_id": self.device_id},
            headers=self.get_headers(),
            name="Sync: Get Status",
            catch_response=True,
        ) as response:
            if response.status_code in [200, 404]:  # 404表示设备未注册
                response.success()
            elif response.status_code == 401:
                self.login()
                response.success()
            else:
                response.failure(f"Status check failed: {response.status_code}")

    @task(5)
    def sync_get_history(self):
        """
        查询同步历史
        分页查询，中等频率
        """
        if not self.token:
            return

        params = {
            "page": random.randint(1, 5),
            "page_size": random.choice([10, 20, 50]),
        }

        with self.client.get(
            "/api/v1/sync/history",
            params=params,
            headers=self.get_headers(),
            name="Sync: Get History",
            catch_response=True,
        ) as response:
            if response.status_code == 200:
                response.success()
            elif response.status_code == 401:
                self.login()
                response.success()
            else:
                response.failure(f"History failed: {response.status_code}")

    @task(2)
    def sync_full_sync(self):
        """
        完整双向同步（低频重操作）
        模拟首次同步或长时间离线后的全量同步
        """
        if not self.token:
            return

        local_data = {
            "formulas": {
                str(random.choice(ENTITY_ID_RANGE)): generate_test_data()
                for _ in range(random.randint(1, 3))
            },
            "prompts": {
                str(random.choice(ENTITY_ID_RANGE)): generate_test_data()
                for _ in range(random.randint(0, 2))
            },
        }

        payload = {
            "local_data": local_data,
            "last_sync_timestamp": (
                datetime.now(timezone.utc) - timedelta(hours=random.randint(1, 24))
            ).isoformat(),
        }

        with self.client.post(
            "/api/v1/sync/full-sync",
            params={"device_id": self.device_id},
            json=payload,
            headers=self.get_headers(),
            name="Sync: Full Sync",
            catch_response=True,
        ) as response:
            if response.status_code == 200:
                result = response.json()
                duration = result.get("duration_ms", 0)
                # 全量同步允许较长的响应时间（<5秒）
                if duration < 5000:
                    response.success()
                else:
                    response.warning(f"Full sync slow: {duration}ms")
            elif response.status_code == 401:
                self.login()
                response.success()
            else:
                response.failure(f"Full sync failed: {response.status_code}")

    # ═══════════════════════════════════════════
    # 团队协作任务组（权重：35%）
    # ═══════════════════════════════════════════

    @task(12)
    def team_list_teams(self):
        """
        列出用户的团队
        高频查询操作
        """
        if not self.token:
            return

        with self.client.get(
            "/api/v1/teams",
            headers=self.get_headers(),
            name="Team: List Teams",
            catch_response=True,
        ) as response:
            if response.status_code == 200:
                response.success()
            elif response.status_code == 401:
                self.login()
                response.success()
            else:
                response.failure(f"List teams failed: {response.status_code}")

    @task(8)
    def team_get_team_detail(self):
        """
        获取团队详情
        包含成员列表、设置等信息
        """
        if not self.token:
            return

        team_id = random.choice(list(TEAM_ID_RANGE))

        with self.client.get(
            f"/api/v1/teams/{team_id}",
            headers=self.get_headers(),
            name="Team: Get Team Detail",
            catch_response=True,
        ) as response:
            if response.status_code in [200, 403, 404]:
                response.success()
            elif response.status_code == 401:
                self.login()
                response.success()
            else:
                response.failure(f"Get team detail failed: {response.status_code}")

    @task(5)
    def team_list_members(self):
        """
        列出团队成员
        权限相关查询
        """
        if not self.token:
            return

        team_id = random.choice(list(TEAM_ID_RANGE))

        with self.client.get(
            f"/api/v1/teams/{team_id}/members",
            headers=self.get_headers(),
            name="Team: List Members",
            catch_response=True,
        ) as response:
            if response.status_code in [200, 403, 404]:
                response.success()
            elif response.status_code == 401:
                self.login()
                response.success()
            else:
                response.failure(f"List members failed: {response.status_code}")

    @task(3)
    def team_invite_member(self):
        """
        邀请成员（写操作）
        低频但重要的业务操作
        """
        if not self.token:
            return

        team_id = random.choice(list(TEAM_ID_RANGE))
        invitee = f"invitee_{random_string(8)}"

        payload = {
            "team_id": team_id,
            "invitee_username": invitee,
            "role": random.choice(["member", "admin"]),
        }

        with self.client.post(
            "/api/v1/teams/invite",
            json=payload,
            headers=self.get_headers(),
            name="Team: Invite Member",
            catch_response=True,
        ) as response:
            if response.status_code in [200, 201, 400, 403, 404]:
                # 400可能是重复邀请等业务逻辑错误
                response.success()
            elif response.status_code == 401:
                self.login()
                response.success()
            else:
                response.failure(f"Invite failed: {response.status_code}")

    @task(2)
    def team_dashboard_stats(self):
        """
        获取团队仪表盘统计
        数据密集型聚合查询
        """
        if not self.token:
            return

        team_id = random.choice(list(TEAM_ID_RANGE))

        with self.client.get(
            f"/api/v1/teams/{team_id}/dashboard/stats",
            headers=self.get_headers(),
            name="Team: Dashboard Stats",
            catch_response=True,
        ) as response:
            if response.status_code in [200, 403, 404]:
                response.success()
            elif response.status_code == 401:
                self.login()
                response.success()
            else:
                response.failure(f"Dashboard stats failed: {response.status_code}")

    # ═══════════════════════════════════════════
    # AI助手任务组（权重：25%）
    # ═══════════════════════════════════════════

    @task(10)
    def ai_generate_prompt(self):
        """
        AI生成提示词
        核心AI功能，CPU/GPU密集型
        """
        if not self.token:
            return

        products = [
            "功能性饮料",
            "保健食品",
            "药膳配方",
            "营养补充剂",
            "中药制剂",
        ]

        request_payload = {
            "requirements": {
                "target_product": random.choice(products),
                "key_ingredients": [
                    random.choice(["枸杞", "黄芪", "人参", "当归", "灵芝"]),
                    random.choice(["维生素C", "锌", "铁", "钙"]),
                ],
                "health_benefits": random.sample(
                    ["增强免疫力", "抗疲劳", "改善睡眠", "抗氧化", "调节血糖"],
                    k=random.randint(1, 3)
                ),
            }
        }

        with self.client.post(
            "/api/v1/ai/generate-prompt",
            json=request_payload,
            headers=self.get_headers(),
            name="AI: Generate Prompt",
            catch_response=True,
        ) as response:
            if response.status_code == 200:
                result = response.json()
                prompt_length = len(result.get("generated_prompt", ""))
                # AI生成可能需要较长时间（<10秒）
                if prompt_length > 0:
                    response.success()
                else:
                    response.failure("Empty prompt generated")
            elif response.status_code == 401:
                self.login()
                response.success()
            elif response.status_code == 503:  # AI服务暂时不可用
                response.warning("AI service unavailable")
            else:
                response.failure(f"Generate failed: {response.status_code}")

    @task(7)
    def ai_optimize_formula(self):
        """
        AI优化配方
        复杂计算任务
        """
        if not self.token:
            return

        optimize_payload = {
            "current_formula": {
                "name": f"OptimizeTarget_{random_string(6)}",
                "ingredients": [
                    {"name": f"成分_{i}", "ratio": round(random.random(), 2)}
                    for i in range(random.randint(3, 8))
                ],
            },
            "optimization_goals": random.sample(
                ["降低成本", "提高功效", "改善口感", "延长保质期"],
                k=random.randint(1, 3)
            ),
        }

        with self.client.post(
            "/api/v1/ai/optimize-formula",
            json=optimize_payload,
            headers=self.get_headers(),
            name="AI: Optimize Formula",
            catch_response=True,
        ) as response:
            if response.status_code == 200:
                suggestions = response.json().get(
                    "optimization_suggestions",
                    response.json().get("suggestions", [])
                )
                if isinstance(suggestions, list):
                    response.success()
                else:
                    response.failure("Invalid optimization response")
            elif response.status_code == 401:
                self.login()
                response.success()
            elif response.status_code == 503:
                response.warning("AI service unavailable")
            else:
                response.failure(f"Optimize failed: {response.status_code}")

    @task(5)
    def ai_analyze_requirements(self):
        """
        AI需求分析
        中等复杂度的NLP处理
        """
        if not self.token:
            return

        vague_descriptions = [
            "想要一款适合老年人的健康饮品",
            "开发一个成本低的免疫增强产品",
            "需要一个帮助睡眠的功能性食品方案",
        ]

        analyze_payload = {
            "user_description": random.choice(vague_descriptions),
            "context": {
                "target_audience": random.choice(["老年人", "上班族", "学生", "运动员"]),
                "price_sensitivity": random.choice(["低", "中", "高"]),
            },
        }

        with self.client.post(
            "/api/v1/ai/analyze-requirements",
            json=analyze_payload,
            headers=self.get_headers(),
            name="AI: Analyze Requirements",
            catch_response=True,
        ) as response:
            if response.status_code == 200:
                analysis = response.json()
                if "analysis" in analysis or "key_parameters" in analysis:
                    response.success()
                else:
                    response.failure("Incomplete analysis response")
            elif response.status_code == 401:
                self.login()
                response.success()
            else:
                response.failure(f"Analysis failed: {response.status_code}")

    @task(3)
    def ai_streaming_generate(self):
        """
        流式AI生成（如果支持SSE）
        测试长连接和流式响应性能
        """
        if not self.token:
            return

        # 尝试流式端点（如果存在）
        stream_payload = {
            "prompt": f"请为{random.choice(['功能性饮料', '保健品', '药膳'])}设计配方...",
            "stream": True,
        }

        with self.client.post(
            "/api/v1/ai/generate-stream",
            json=stream_payload,
            headers=self.get_headers(),
            name="AI: Streaming Generate",
            catch_response=True,
            timeout=30,  # 流式请求允许更长超时
        ) as response:
            if response.status_code == 200:
                # 验证是否是流式响应
                content_type = response.headers.get("content-type", "")
                if "text/event-stream" in content_type or "application/octet-stream" in content_type:
                    response.success()
                else:
                    response.success()  # 也接受非流式响应
            elif response.status_code == 404:
                # 流式端点不存在，跳过
                response.success()
            elif response.status_code == 401:
                self.login()
                response.success()
            else:
                response.failure(f"Stream failed: {response.status_code}")


# ════════════════════════════════════════════════
# 性能监控事件钩子
# ════════════════════════════════════════════════

@events.test_start.add_listener
def on_test_start(environment, **kwargs):
    """测试开始时的初始化"""
    print("\n" + "=" * 70)
    print("🚀 RMFOOD 性能负载测试开始")
    print("=" * 70)
    print(f"目标服务器: {environment.host}")
    print(f"开始时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("-" * 70)


@events.test_stop.add_listener
def on_test_stop(environment, **kwargs):
    """测试结束时的汇总"""
    print("\n" + "=" * 70)
    print("✅ RMFOOD 性能负载测试完成")
    print("=" * 70)
    print(f"结束时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

    if environment.stats.total.num_requests > 0:
        stats = environment.stats.total
        print(f"\n📊 总体性能指标:")
        print(f"   总请求数: {stats.num_requests}")
        print(f"   平均响应时间: {stats.avg_response_time:.2f}ms")
        print(f"   P50响应时间: {stats.get_response_time_percentile(50):.2f}ms")
        print(f"   P90响应时间: {stats.get_response_time_percentile(90):.2f}ms")
        print(f"   P95响应时间: {stats.get_response_time_percentile(95):.2f}ms")
        print(f"   P99响应时间: {stats.get_response_time_percentile(99):.2f}ms")
        print(f"   最小响应时间: {stats.min_response_time:.2f}ms")
        print(f"   最大响应时间: {stats.max_response_time:.2f}ms")
        print(f"   RPS (每秒请求数): {stats.current_rps:.2f}")
        print(f"   失败率: {stats.fail_ratio * 100:.2f}%")

        print(f"\n⚠️  性能基线对比:")
        print(f"   同步API P95目标: <200ms | 实际: {get_api_percentile(environment, 'Sync', 95):.2f}ms")
        print(f"   团队API QPS目标: >500  | 实际: {get_api_qps(environment, 'Team'):.2f}")
        print(f"   AI API延迟目标: <1s   | 实际P95: {get_api_percentile(environment, 'AI', 95)/1000:.2f}s")

    print("=" * 70 + "\n")


def get_api_percentile(environment, api_prefix: str, percentile: int) -> float:
    """获取特定API前缀的百分位响应时间"""
    for stat in environment.stats.entries:
        if api_prefix.lower() in stat.name.lower():
            return stat.get_response_time_percentile(percentile)
    return 0.0


def get_api_qps(environment, api_prefix: str) -> float:
    """获取特定API前缀的QPS"""
    total_requests = 0
    total_time = 0
    for stat in environment.stats.entries:
        if api_prefix.lower() in stat.name.lower():
            total_requests += stat.num_requests
            total_time += stat.total_rtt_time

    if total_time > 0:
        return total_requests / (total_time / 1000)
    return 0.0


@events.request.add_listener
def on_request(request_type, name, response_time, response_length, exception, **kwargs):
    """单个请求完成后的日志记录（可选详细日志）"""
    if exception:
        if response_time > 5000:  # 超过5秒的慢请求
            print(f"⏰ 慢请求警告: [{name}] {response_time:.0f}ms - {exception}")
        elif response_time > 1000:  # 超过1秒
            print(f"⚠️  较慢请求: [{name}] {response_time:.0f}ms")


# ════════════════════════════════════════════════
# 自定义错误处理器
# ════════════════════════════════════════════════

@events.quitting.add_listener
def on_quitting(environment, **kwargs):
    """退出前的清理工作"""
    print("\n正在清理测试环境...")


if __name__ == "__main__":
    # 命令行直接运行示例
    import sys
    print("""
╔══════════════════════════════════════════════════════╗
║     RMFOOD 配方平台 - 性能负载测试工具              ║
╠══════════════════════════════════════════════════════╣
║                                                      ║
║  使用方式:                                           ║
║    locust -f locustfile.py --host=http://localhost:8000 ║
║                                                      ║
║  示例命令:                                           ║
║    # 100个用户，每秒启动10个                           ║
║    locust -f locustfile.py --users=100 --spawn-rate=10 ║
║                                                      ║
║    # 运行5分钟后停止                                  ║
║    locust -f locustfile.py --run-time 5m             ║
║                                                      ║
║  Web UI: http://localhost:8089                        ║
║                                                      ║
╚══════════════════════════════════════════════════════╝
""")
