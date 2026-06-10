"""
OAuth2 增强认证系统 - 完整流程测试脚本

测试场景:
1. ✅ 用户注册（密码强度验证）
2. ✅ 用户登录（获取Token对）
3. ✅ 使用 Access Token 访问受保护资源
4. ✅ 刷新 Token
5. ✅ 用户登出（Token黑名单）
6. ❌ 使用已注销的Token访问（应返回401）
7. ❌ 错误密码登录（应返回401）
8. ❌ 弱密码注册（应返回400）

使用方法:
    cd backend
    python test_oauth2_system.py

依赖: requests, pytest (可选)
"""
import requests
import json
import time
import sys

# ── 配置 ──
BASE_URL = "http://localhost:8000/api/v1"
API_PREFIX = "/auth/oauth2"

def print_separator(title: str):
    """打印分隔线"""
    print(f"\n{'='*60}")
    print(f"  {title}")
    print('='*60)


def print_result(test_name: str, success: bool, detail: str = ""):
    """打印测试结果"""
    status_icon = "✅" if success else "❌"
    print(f"{status_icon} {test_name}")
    if detail:
        print(f"   → {detail}")


class OAuth2TestSuite:
    """OAuth2 认证系统测试套件"""

    def __init__(self):
        self.base_url = BASE_URL
        self.access_token = None
        self.refresh_token = None
        self.test_username = f"test_user_{int(time.time())}"
        self.test_password = "TestPass123"

    def test_1_register_with_strong_password(self):
        """测试1: 注册用户（强密码）"""
        print_separator("测试1: 用户注册（强密码）")

        url = f"{self.base_url}{API_PREFIX}/register"
        data = {
            "username": self.test_username,
            "email": f"{self.test_username}@test.com",
            "password": self.test_password,
            "full_name": "测试用户",
        }

        try:
            response = requests.post(url, json=data)
            result = response.json()

            if response.status_code == 201:
                print_result(
                    "用户注册成功",
                    True,
                    f"用户名: {result.get('message', '')}"
                )
                return True
            else:
                print_result(
                    "用户注册失败",
                    False,
                    f"状态码: {response.status_code}, 错误: {result}"
                )
                return False

        except Exception as e:
            print_result("用户注册异常", False, str(e))
            return False

    def test_2_register_with_weak_password(self):
        """测试2: 注册用户（弱密码，应失败）"""
        print_separator("测试2: 用户注册（弱密码验证）")

        url = f"{self.base_url}{API_PREFIX}/register"
        data = {
            "username": f"weak_{int(time.time())}",
            "email": f"weak_{int(time.time())}@test.com",
            "password": "123",  # 弱密码：太短且缺少大小写字母
            "full_name": "弱密码用户",
        }

        try:
            response = requests.post(url, json=data)
            result = response.json()

            if response.status_code == 400:
                error_detail = result.get('detail', {})
                if isinstance(error_detail, dict) and error_detail.get('error_code') == 'WEAK_PASSWORD':
                    print_result(
                        "弱密码被正确拒绝",
                        True,
                        f"错误信息: {error_detail.get('message', '')}"
                    )
                    return True

            print_result(
                "弱密码验证失败（应拒绝）",
                False,
                f"状态码: {response.status_code}, 响应: {result}"
            )
            return False

        except Exception as e:
            print_result("弱密码测试异常", False, str(e))
            return False

    def test_3_login(self):
        """测试3: 用户登录"""
        print_separator("测试3: 用户登录")

        url = f"{self.base_url}{API_PREFIX}/login"
        data = {
            "username": self.test_username,
            "password": self.test_password,
        }

        try:
            response = requests.post(url, json=data)
            result = response.json()

            if response.status_code == 200:
                self.access_token = result.get('access_token')
                self.refresh_token = result.get('refresh_token')

                print_result("登录成功", True, f"Token类型: {result.get('token_type')}")
                print_result("获取到 Access Token", bool(self.access_token), f"长度: {len(self.access_token) if self.access_token else 0}")
                print_result("获取到 Refresh Token", bool(self.refresh_token), f"长度: {len(self.refresh_token) if self.refresh_token else 0}")
                return True
            else:
                print_result("登录失败", False, f"错误: {result}")
                return False

        except Exception as e:
            print_result("登录异常", False, str(e))
            return False

    def test_4_login_wrong_password(self):
        """测试4: 错误密码登录（应失败）"""
        print_separator("测试4: 错误密码登录")

        url = f"{self.base_url}{API_PREFIX}/login"
        data = {
            "username": self.test_username,
            "password": "WrongPassword999",
        }

        try:
            response = requests.post(url, json=data)

            if response.status_code == 401:
                print_result("错误密码被正确拒绝", True, f"状态码: {response.status_code}")
                return True
            else:
                print_result(
                    "错误密码验证失败（应返回401）",
                    False,
                    f"状态码: {response.status_code}"
                )
                return False

        except Exception as e:
            print_result("错误密码测试异常", False, str(e))
            return False

    def test_5_access_protected_resource(self):
        """测试5: 使用Token访问受保护资源"""
        print_separator("测试5: 访问受保护资源")

        if not self.access_token:
            print_result("跳过（无有效Token）", False, "需要先成功登录")
            return False

        headers = {"Authorization": f"Bearer {self.access_token}"}
        url = f"{self.base_url}/auth/me"

        try:
            response = requests.get(url, headers=headers)

            if response.status_code == 200:
                user_info = response.json()
                print_result(
                    "成功访问受保护资源",
                    True,
                    f"用户: {user_info.get('username')}"
                )
                return True
            else:
                print_result(
                    "访问受保护资源失败",
                    False,
                    f"状态码: {response.status_code}"
                )
                return False

        except Exception as e:
            print_result("访问受保护资源异常", False, str(e))
            return False

    def test_6_refresh_token(self):
        """测试6: 刷新Token"""
        print_separator("测试6: 刷新Token")

        if not self.refresh_token:
            print_result("跳过（无Refresh Token）", False, "需要先成功登录")
            return False

        url = f"{self.base_url}{API_PREFIX}/refresh"
        data = {"refresh_token": self.refresh_token}

        try:
            response = requests.post(url, json=data)
            result = response.json()

            if response.status_code == 200:
                old_access_token = self.access_token
                self.access_token = result.get('access_token')
                self.refresh_token = result.get('refresh_token')

                print_result("Token刷新成功", True)
                print_result("生成新的 Access Token", bool(self.access_token), "新Token已更新")
                print_result("生成新的 Refresh Token", bool(self.refresh_token), "旧Token已失效")
                return True
            else:
                print_result("Token刷新失败", False, f"错误: {result}")
                return False

        except Exception as e:
            print_result("Token刷新异常", False, str(e))
            return False

    def test_7_logout(self):
        """测试7: 用户登出（Token黑名单）"""
        print_separator("测试7: 用户登出")

        if not self.access_token or not self.refresh_token:
            print_result("跳过（无有效Token）", False, "需要先成功登录")
            return False

        headers = {"Authorization": f"Bearer {self.access_token}"}
        url = f"{self.base_url}{API_PREFIX}/logout"
        data = {"refresh_token": self.refresh_token}

        try:
            response = requests.post(url, json=data, headers=headers)
            result = response.json()

            if response.status_code == 200:
                print_result("登出成功", True, result.get('message', ''))
                return True
            else:
                print_result("登出失败", False, f"状态码: {response.status_code}")
                return False

        except Exception as e:
            print_result("登出异常", False, str(e))
            return False

    def test_8_access_after_logout(self):
        """测试8: 登出后使用旧Token访问（应失败）"""
        print_separator("测试8: 登出后使用旧Token访问（应返回401）")

        if not self.access_token:
            print_result("跳过（无Token）", False, "")
            return False

        headers = {"Authorization": f"Bearer {self.access_token}"}
        url = f"{self.base_url}/auth/me"

        try:
            response = requests.get(url, headers=headers)

            if response.status_code == 401:
                print_result(
                    "已注销的Token被正确拒绝",
                    True,
                    f"状态码: {response.status_code} (预期401)"
                )
                return True
            else:
                print_result(
                    "黑名单机制未生效（应返回401）",
                    False,
                    f"状态码: {response.status_code}"
                )
                return False

        except Exception as e:
            print_result("黑名单测试异常", False, str(e))
            return False

    def test_9_invalid_token(self):
        """测试9: 使用无效Token访问（应失败）"""
        print_separator("测试9: 使用无效Token访问")

        invalid_token = "this.is.an.invalid.token"
        headers = {"Authorization": f"Bearer {invalid_token}"}
        url = f"{self.base_url}/auth/me"

        try:
            response = requests.get(url, headers=headers)

            if response.status_code == 401:
                print_result(
                    "无效Token被正确拒绝",
                    True,
                    f"状态码: {response.status_code}"
                )
                return True
            else:
                print_result(
                    "无效Token验证失败",
                    False,
                    f"状态码: {response.status_code}"
                )
                return False

        except Exception as e:
            print_result("无效Token测试异常", False, str(e))
            return False

    def run_all_tests(self):
        """运行所有测试"""
        print("\n" + "="*60)
        print("  🔐 OAuth2 增强认证系统 - 完整流程测试")
        print("="*60)
        print(f"\n测试目标: {BASE_URL}")
        print(f"测试用户: {self.test_username}")

        results = []

        # 执行测试
        results.append(("用户注册（强密码）", self.test_1_register_with_strong_password()))
        results.append(("弱密码验证", self.test_2_register_with_weak_password()))
        results.append(("用户登录", self.test_3_login()))
        results.append(("错误密码登录", self.test_4_login_wrong_password()))
        results.append(("访问受保护资源", self.test_5_access_protected_resource()))
        results.append(("刷新Token", self.test_6_refresh_token()))
        results.append(("用户登出", self.test_7_logout()))
        results.append(("登出后访问（黑名单）", self.test_8_access_after_logout()))
        results.append(("无效Token访问", self.test_9_invalid_token()))

        # 汇总结果
        print("\n" + "="*60)
        print("  📊 测试结果汇总")
        print("="*60)

        passed = sum(1 for _, success in results if success)
        total = len(results)

        for name, success in results:
            icon = "✅" if success else "❌"
            print(f"{icon} {name}")

        print(f"\n总计: {passed}/{total} 通过")
        print("="*60)

        if passed == total:
            print("\n🎉 所有测试通过！OAuth2认证系统工作正常。")
            return 0
        else:
            print(f"\n⚠️  {total - passed} 个测试未通过，请检查日志。")
            return 1


def main():
    """主函数"""
    print("\n🚀 启动 OAuth2 认证系统测试...")
    print("⏳ 请确保后端服务已在 http://localhost:8000 运行\n")

    # 检查服务是否可用
    try:
        health_response = requests.get(f"{BASE_URL.replace('/api/v1', '')}/health", timeout=5)
        if health_response.status_code != 200:
            print("❌ 后端服务不可用，请先启动服务:")
            print("   cd backend && uvicorn app.main:app --reload\n")
            sys.exit(1)
    except requests.exceptions.ConnectionError:
        print("❌ 无法连接到后端服务，请确保服务已启动:")
        print("   cd backend && uvicorn app.main:app --reload\n")
        sys.exit(1)

    suite = OAuth2TestSuite()
    exit_code = suite.run_all_tests()
    sys.exit(exit_code)


if __name__ == "__main__":
    main()
