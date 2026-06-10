"""
测试通知系统API
验证修复后的通知功能是否正常工作
"""
import asyncio
import httpx
import json


async def test_notification_api():
    """测试通知API的完整流程"""
    
    base_url = "http://localhost:8000"
    
    print("="*70)
    print("🧪 开始测试通知系统API")
    print("="*70)
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        
        # ============================================================
        # 1. 用户登录获取Token
        # ============================================================
        print("\n📝 步骤1: 用户登录...")
        
        try:
            login_response = await client.post(
                f"{base_url}/api/v1/auth/login",
                json={
                    "username": "admin",
                    "password": "admin123"  # 使用默认密码或环境变量中的密码
                }
            )
            
            if login_response.status_code == 200:
                token_data = login_response.json()
                access_token = token_data.get("access_token")
                
                if not access_token:
                    print(f"❌ 登录响应中无token: {token_data}")
                    return
                
                print(f"✅ 登录成功! Token: {access_token[:20]}...")
                
                headers = {
                    "Authorization": f"Bearer {access_token}",
                    "Content-Type": "application/json"
                }
                
            else:
                print(f"❌ 登录失败 (状态码: {login_response.status_code})")
                print(f"   响应: {login_response.text}")
                return
                
        except Exception as e:
            print(f"❌ 登录请求异常: {e}")
            return
        
        # ============================================================
        # 2. 测试获取通知列表
        # ============================================================
        print("\n📬 步骤2: 获取通知列表...")
        
        try:
            notifications_response = await client.get(
                f"{base_url}/api/v1/notifications",
                headers=headers,
                params={
                    "page": 1,
                    "page_size": 10
                }
            )
            
            print(f"   状态码: {notifications_response.status_code}")
            
            if notifications_response.status_code == 200:
                data = notifications_response.json()
                print(f"✅ 获取通知成功!")
                print(f"   - 总数: {data.get('pagination', {}).get('total', 0)}")
                print(f"   - 未读数: {data.get('unread_count', 0)}")
                print(f"   - 当前页通知数: {len(data.get('items', []))}")
                
                if data.get('items'):
                    print("\n   📋 通知列表:")
                    for i, notification in enumerate(data['items'][:3], 1):
                        print(f"   {i}. [{notification.get('subject', 'N/A')}]")
                        print(f"      渠道: {notification.get('channel', 'N/A')}")
                        print(f"      状态: {'已读' if notification.get('is_read') else '未读'}")
                        
            elif notifications_response.status_code == 500:
                print(f"❌ 服务器错误! 响应: {notifications_response.text[:500]}")
            else:
                print(f"⚠️ 意外状态码: {notifications_response.status_code}")
                print(f"   响应: {notifications_response.text[:300]}")
                
        except Exception as e:
            print(f"❌ 获取通知异常: {e}")
            import traceback
            traceback.print_exc()
        
        # ============================================================
        # 3. 测试获取未读数量
        # ============================================================
        print("\n🔢 步骤3: 获取未读数量...")
        
        try:
            unread_response = await client.get(
                f"{base_url}/api/v1/notifications/unread-count",
                headers=headers
            )
            
            print(f"   状态码: {unread_response.status_code}")
            
            if unread_response.status_code == 200:
                unread_data = unread_response.json()
                print(f"✅ 获取未读数成功!")
                print(f"   - 未读通知数: {unread_data.get('unread_count', 0)}")
                
            else:
                print(f"❌ 获取未读数失败: {unread_response.text[:300]}")
                
        except Exception as e:
            print(f"❌ 获取未读数异常: {e}")
        
        # ============================================================
        # 4. 发送测试通知
        # ============================================================
        print("\n✉️ 步骤4: 发送测试通知...")
        
        try:
            test_response = await client.post(
                f"{base_url}/api/v1/notifications/test-send",
                headers=headers,
                json={
                    "template_id": "system.maintenance"
                }
            )
            
            print(f"   状态码: {test_response.status_code}")
            
            if test_response.status_code == 200:
                test_data = test_response.json()
                print(f"✅ 测试通知发送成功!")
                print(f"   结果: {json.dumps(test_data, indent=2, ensure_ascii=False)[:400]}")
                
            else:
                print(f"⚠️ 测试通知响应: {test_response.status_code}")
                print(f"   响应: {test_response.text[:300]}")
                
        except Exception as e:
            print(f"❌ 发送测试通知异常: {e}")
        
        # ============================================================
        # 5. 再次获取通知列表（验证新通知）
        # ============================================================
        print("\n🔄 步骤5: 验证新通知...")
        
        try:
            verify_response = await client.get(
                f"{base_url}/api/v1/notifications",
                headers=headers,
                params={
                    "page": 1,
                    "page_size": 5
                }
            )
            
            if verify_response.status_code == 200:
                verify_data = verify_response.json()
                total_after = verify_data.get('pagination', {}).get('total', 0)
                print(f"✅ 验证完成!")
                print(f"   - 当前总通知数: {total_after}")
                print(f"   - 未读数: {verify_data.get('unread_count', 0)}")
                
            else:
                print(f"❌ 验证失败: {verify_response.status_code}")
                
        except Exception as e:
            print(f"❌ 验证异常: {e}")
        
        # ============================================================
        # 6. 测试获取通知偏好设置
        # ============================================================
        print("\n⚙️ 步骤6: 获取通知偏好设置...")
        
        try:
            pref_response = await client.get(
                f"{base_url}/api/v1/notifications/preferences",
                headers=headers
            )
            
            print(f"   状态码: {pref_response.status_code}")
            
            if pref_response.status_code == 200:
                pref_data = pref_response.json()
                print(f"✅ 获取偏好设置成功!")
                print(f"   启用状态: {pref_data.get('enabled', 'N/A')}")
                
            else:
                print(f"   响应: {pref_response.text[:300]}")
                
        except Exception as e:
            print(f"❌ 获取偏好设置异常: {e}")
        
        # ============================================================
        # 7. 列出可用模板
        # ============================================================
        print("\n📋 步骤7: 列出通知模板...")
        
        try:
            templates_response = await client.get(
                f"{base_url}/api/v1/notifications/templates",
                headers=headers
            )
            
            if templates_response.status_code == 200:
                templates_data = templates_response.json()
                print(f"✅ 获取模板列表成功!")
                print(f"   可用模板数: {templates_data.get('total', 0)}")
                
                if templates_data.get('templates'):
                    print("\n   📝 可用模板:")
                    for t in templates_data['templates'][:5]:
                        print(f"   - {t['id']}: {t['name']}")
                        
            else:
                print(f"   状态码: {templates_response.status_code}")
                
        except Exception as e:
            print(f"❌ 获取模板列表异常: {e}")
    
    print("\n" + "="*70)
    print("🎉 通知系统API测试完成!")
    print("="*70)


if __name__ == "__main__":
    asyncio.run(test_notification_api())
