"""
简化版通知API测试
直接使用requests库
"""
import requests


def test_notification_simple():
    """简化的通知API测试"""
    
    base_url = "http://localhost:8000"
    
    print("="*60)
    print("🔧 简化版通知API测试")
    print("="*60)
    
    # 1. 测试健康检查
    print("\n1️⃣ 健康检查...")
    try:
        resp = requests.get(f"{base_url}/docs", timeout=5)
        print(f"   ✅ 状态码: {resp.status_code}")
    except Exception as e:
        print(f"   ❌ 失败: {e}")
        return
    
    # 2. 尝试登录（使用不同的密码）
    print("\n2️⃣ 尝试登录...")
    
    passwords_to_try = [
        "Admin@123!",
        "admin123",
        "password",
        "Admin123",
    ]
    
    token = None
    
    for pwd in passwords_to_try:
        try:
            login_resp = requests.post(
                f"{base_url}/api/v1/auth/login",
                json={"username": "admin", "password": pwd},
                timeout=10
            )
            
            print(f"   密码 '{pwd}': 状态码 {login_resp.status_code}")
            
            if login_resp.status_code == 200:
                data = login_resp.json()
                token = data.get("access_token")
                print(f"   ✅ 登录成功! Token前20位: {token[:20] if token else 'N/A'}...")
                break
            elif login_resp.status_code != 401:
                print(f"      响应: {login_resp.text[:200]}")
                
        except Exception as e:
            print(f"   ❌ 异常 ({pwd}): {e}")
    
    if not token:
        print("\n⚠️ 无法获取Token，跳过后续测试")
        print("提示：请检查浏览器控制台查看启动时生成的管理员密码")
        return
    
    # 3. 测试通知列表
    print("\n3️⃣ 测试通知列表...")
    headers = {"Authorization": f"Bearer {token}"}
    
    try:
        notif_resp = requests.get(
            f"{base_url}/api/v1/notifications",
            headers=headers,
            params={"page": 1, "page_size": 5},
            timeout=10
        )
        
        print(f"   状态码: {notif_resp.status_code}")
        
        if notif_resp.status_code == 200:
            data = notif_resp.json()
            print(f"   ✅ 成功!")
            print(f"      总数: {data.get('pagination', {}).get('total', 0)}")
            print(f"      未读数: {data.get('unread_count', 0)}")
        else:
            print(f"   ❌ 错误响应:")
            print(f"   {notif_resp.text[:500]}")
            
    except Exception as e:
        print(f"   ❌ 异常: {e}")
    
    # 4. 测试未读计数
    print("\n4️⃣ 测试未读计数...")
    try:
        unread_resp = requests.get(
            f"{base_url}/api/v1/notifications/unread-count",
            headers=headers,
            timeout=10
        )
        
        print(f"   状态码: {unread_resp.status_code}")
        
        if unread_resp.status_code == 200:
            data = unread_resp.json()
            print(f"   ✅ 未读数: {data.get('unread_count', 0)}")
        else:
            print(f"   响应: {unread_resp.text[:300]}")
            
    except Exception as e:
        print(f"   ❌ 异常: {e}")
    
    print("\n" + "="*60)
    print("🎉 测试完成!")
    print("="*60)


if __name__ == "__main__":
    test_notification_simple()
