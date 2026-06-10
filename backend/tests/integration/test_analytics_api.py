"""
Analytics API 真实数据对接测试脚本

测试内容:
1. 仪表盘数据接口 (GET /api/v1/analytics/dashboard)
2. KPI指标接口 (GET /api/v1/analytics/kpi)
3. 趋势数据接口 (GET /api/v1/analytics/trends/{entity})
4. 系统健康状态 (GET /api/v1/analytics/system-health)
5. 数据筛选接口 (GET /api/v1/analytics/filters)
6. 自定义聚合查询 (POST /api/v1/analytics/aggregate)

使用方法:
    python test_analytics_api.py

依赖:
    - requests
    - 后端服务运行在 http://localhost:8000
"""

import requests
import json
import sys
from datetime import datetime


BASE_URL = "http://localhost:8000/api/v1"


def print_section(title):
    """打印测试区块标题"""
    print("\n" + "=" * 70)
    print(f"  {title}")
    print("=" * 70)


def print_result(test_name, success, data=None, error=None):
    """打印测试结果"""
    status = "✅ PASS" if success else "❌ FAIL"
    print(f"\n[{status}] {test_name}")
    
    if data:
        print(f"   响应数据预览: {json.dumps(data, ensure_ascii=False, indent=2)[:500]}...")
    if error:
        print(f"   错误信息: {error}")


def get_auth_token():
    """获取认证Token（使用测试账号）"""
    # 尝试登录获取token
    try:
        login_data = {
            "username": "admin",
            "password": "admin123"
        }
        
        response = requests.post(
            f"{BASE_URL}/auth/login",
            json=login_data,
            timeout=10
        )
        
        if response.status_code == 200:
            result = response.json()
            token = result.get("access_token") or result.get("token")
            if token:
                print(f"\n🔑 认证成功，Token已获取")
                return {"Authorization": f"Bearer {token}"}
        
        print(f"⚠️ 登录失败，尝试无Token访问（可能返回401）")
        return {}
        
    except Exception as e:
        print(f"⚠️ 登录请求异常: {e}")
        return {}


def test_dashboard_api(headers):
    """测试仪表盘数据接口"""
    print_section("测试1: 仪表盘数据接口 (GET /analytics/dashboard)")
    
    try:
        response = requests.get(
            f"{BASE_URL}/analytics/dashboard",
            headers=headers,
            params={"range": "30d"},
            timeout=30
        )
        
        if response.status_code == 200:
            data = response.json()
            
            # 验证必要字段
            required_fields = ["timestamp", "kpi", "charts", "recent_activity", 
                             "top_entities", "system_health", "available_filters"]
            
            missing_fields = [f for f in required_fields if f not in data]
            
            if missing_fields:
                print_result(
                    "仪表盘数据结构验证",
                    False,
                    error=f"缺少字段: {missing_fields}"
                )
                return False
            
            # 检查KPI数据
            kpi_list = data.get("kpi", [])
            if len(kpi_list) >= 4:
                print(f"   ✓ KPI指标数量: {len(kpi_list)}")
                
                for kpi in kpi_list[:3]:
                    kpi_name = kpi.get("name", "未知")
                    kpi_value = kpi.get("value", 0)
                    print(f"     - {kpi_name}: {kpi_value}")
            else:
                print(f"   ⚠️ KPI指标数量不足: {len(kpi_list)}")
            
            # 检查图表数据
            charts = data.get("charts", {})
            if charts:
                print(f"   ✓ 图表类型: {list(charts.keys())}")
            
            # 检查时间戳
            timestamp = data.get("timestamp", "")
            if timestamp:
                print(f"   ✓ 数据生成时间: {timestamp[:19]}")
            
            print_result("仪表盘数据接口", True, {
                "kpi_count": len(kpi_list),
                "chart_types": list(charts.keys()),
                "has_timestamp": bool(timestamp),
                "response_size": len(json.dumps(data))
            })
            
            return True
            
        elif response.status_code == 401:
            print_result("仪表盘数据接口", False, error="未授权(401)，请检查Token")
            return False
        else:
            print_result(
                "仪表盘数据接口",
                False,
                error=f"HTTP {response.status_code}: {response.text[:200]}"
            )
            return False
            
    except requests.exceptions.ConnectionError:
        print_result("仪表盘数据接口", False, error="无法连接到后端服务 (http://localhost:8000)")
        return False
    except Exception as e:
        print_result("仪表盘数据接口", False, error=str(e))
        return False


def test_kpi_metrics(headers):
    """测试KPI指标接口"""
    print_section("测试2: KPI指标接口 (GET /analytics/kpi)")
    
    try:
        response = requests.get(
            f"{BASE_URL}/analytics/kpi",
            headers=headers,
            timeout=15
        )
        
        if response.status_code == 200:
            data = response.json()
            metrics = data.get("metrics", [])
            
            if metrics:
                print(f"   ✓ 获取到 {len(metrics)} 个KPI指标:")
                
                for metric in metrics[:5]:
                    name = metric.get("name", "未知")
                    value = metric.get("value", 0)
                    unit = metric.get("unit", "")
                    change = metric.get("change_percent")
                    
                    change_str = f" ({change:+.1f}%)" if change is not None else ""
                    print(f"     - {name}: {value} {unit}{change_str}")
                
                print_result("KPI指标接口", True, {
                    "total_metrics": len(metrics),
                    "sample": metrics[0] if metrics else None
                })
                return True
            else:
                print_result("KPI指标接口", False, error="未返回任何KPI指标")
                return False
                
        else:
            print_result("KPI指标接口", False, error=f"HTTP {response.status_code}")
            return False
            
    except Exception as e:
        print_result("KPI指标接口", False, error=str(e))
        return False


def test_trend_data(headers):
    """测试趋势数据接口"""
    print_section("测试3: 趋势数据接口 (GET /analytics/trends/{entity})")
    
    entities_to_test = ["formulas", "experiments"]
    all_passed = True
    
    for entity in entities_to_test:
        try:
            response = requests.get(
                f"{BASE_URL}/analytics/trends/{entity}",
                headers=headers,
                params={"days": 30, "granularity": "daily"},
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                trend_points = data.get("data", [])
                
                print(f"   ✓ {entity}: 获取到 {len(trend_points)} 个数据点")
                
                if trend_points:
                    first_point = trend_points[0]
                    last_point = trend_points[-1]
                    print(f"      时间范围: {first_point.get('period', 'N/A')} ~ {last_point.get('period', 'N/A')}")
                    print(f"      值范围: {first_point.get('value', 0)} ~ {last_point.get('value', 0)}")
                
                print_result(f"趋势数据({entity})", True, {
                    "data_points": len(trend_points),
                    "granularity": data.get("granularity"),
                    "days": data.get("days")
                })
            else:
                print_result(f"趋势数据({entity})", False, error=f"HTTP {response.status_code}")
                all_passed = False
                
        except Exception as e:
            print_result(f"趋势数据({entity})", False, error=str(e))
            all_passed = False
    
    return all_passed


def test_system_health(headers):
    """测试系统健康状态接口"""
    print_section("测试4: 系统健康状态 (GET /analytics/system-health)")
    
    try:
        response = requests.get(
            f"{BASE_URL}/analytics/system-health",
            headers=headers,
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            
            db_status = data.get("database_status", "unknown")
            ws_connections = data.get("websocket_connections", {})
            api_status = data.get("api_status", "unknown")
            
            print(f"   ✓ 数据库状态: {db_status}")
            print(f"   ✓ API状态: {api_status}")
            print(f"   ✓ WebSocket连接数: {ws_connections.get('total', 0)}")
            
            print_result("系统健康状态", True, data)
            return True
        else:
            print_result("系统健康状态", False, error=f"HTTP {response.status_code}")
            return False
            
    except Exception as e:
        print_result("系统健康状态", False, error=str(e))
        return False


def test_filters_api(headers):
    """测试数据筛选接口"""
    print_section("测试5: 可用筛选条件 (GET /analytics/filters)")
    
    try:
        response = requests.get(
            f"{BASE_URL}/analytics/filters",
            headers=headers,
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            
            categories = data.get("categories", [])
            users = data.get("users", [])
            time_ranges = data.get("time_ranges", [])
            formula_status = data.get("formula_status", [])
            
            print(f"   ✓ 分类选项: {len(categories)} 个")
            print(f"   ✓ 用户列表: {len(users)} 个")
            print(f"   ✓ 时间范围: {len(time_ranges)} 个选项")
            print(f"   ✓ 配方状态: {formula_status}")
            
            print_result("可用筛选条件", True, {
                "categories_count": len(categories),
                "users_count": len(users),
                "time_ranges": [tr.get("label") for tr in time_ranges],
                "status_options": formula_status
            })
            return True
        else:
            print_result("可用筛选条件", False, error=f"HTTP {response.status_code}")
            return False
            
    except Exception as e:
        print_result("可用筛选条件", False, error=str(e))
        return False


def test_custom_aggregation(headers):
    """测试自定义聚合查询"""
    print_section("测试6: 自定义聚合查询 (POST /analytics/aggregate)")
    
    try:
        aggregation_request = {
            "entity": "formulas",
            "operations": [
                {"operation": "count", "alias": "total"},
                {"field": "version", "operation": "avg", "alias": "avg_version"}
            ],
            "group_by": "status"
        }
        
        response = requests.post(
            f"{BASE_URL}/analytics/aggregate",
            headers={**headers, "Content-Type": "application/json"},
            json=aggregation_request,
            timeout=15
        )
        
        if response.status_code == 200:
            data = response.json()
            result_rows = data.get("data", [])
            
            print(f"   ✓ 聚合查询成功，返回 {len(result_rows)} 行结果")
            
            for row in result_rows[:5]:
                status = row.get("status", "N/A")
                total = row.get("total", 0)
                avg_ver = row.get("avg_version", 0)
                print(f"     - 状态[{status}]: 总数={total}, 平均版本={avg_ver:.2f}" if avg_ver else f"     - 状态[{status}]: 总数={total}")
            
            print_result("自定义聚合查询", True, {
                "result_count": len(result_rows),
                "query": data.get("query", "")[:100]
            })
            return True
        else:
            print_result("自定义聚合查询", False, error=f"HTTP {response.status_code}: {response.text[:200]}")
            return False
            
    except Exception as e:
        print_result("自定义聚合查询", False, error=str(e))
        return False


def main():
    """主测试函数"""
    print("\n" + "🔬" * 35)
    print("\n       RMFOOD Analytics API 真实数据对接测试")
    print(f"\n       测试时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("🔬" * 35)
    
    # 获取认证Token
    headers = get_auth_token()
    
    results = []
    
    # 执行所有测试
    results.append(("仪表盘数据", test_dashboard_api(headers)))
    results.append(("KPI指标", test_kpi_metrics(headers)))
    results.append(("趋势数据", test_trend_data(headers)))
    results.append(("系统健康", test_system_health(headers)))
    results.append(("筛选条件", test_filters_api(headers)))
    results.append(("自定义聚合", test_custom_aggregation(headers)))
    
    # 输出总结
    print("\n\n" + "=" * 70)
    print("  📊 测试结果总结")
    print("=" * 70)
    
    passed = sum(1 for _, r in results if r)
    total = len(results)
    
    for test_name, result in results:
        status = "✅ 通过" if result else "❌ 失败"
        print(f"  {status}  {test_name}")
    
    print("-" * 70)
    print(f"  总计: {passed}/{total} 测试通过 ({passed/total*100:.1f}%)")
    print("=" * 70 + "\n")
    
    if passed == total:
        print("🎉 所有测试通过！真实数据对接成功！\n")
        return 0
    else:
        print(f"⚠️  有 {total - passed} 个测试失败，请检查后端服务和数据库配置。\n")
        return 1


if __name__ == "__main__":
    sys.exit(main())
