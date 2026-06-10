#!/usr/bin/env python3
"""
WebSocket 压力测试脚本
模拟多个客户端同时连接到后端WebSocket服务
"""
import asyncio
import websockets
import json
import time
import argparse

async def connect_and_keep_alive(url, client_id, duration=30):
    """连接到WebSocket并保持活跃"""
    try:
        # 生成唯一的连接ID
        connection_id = f"test_client_{client_id}_{int(time.time())}"
        token = "mock_access_token_123456"
        
        # 构建WebSocket URL
        ws_url = f"{url}?token={token}&connection_id={connection_id}"
        
        async with websockets.connect(ws_url) as websocket:
            print(f"客户端 {client_id} 已连接")
            
            # 发送ping消息
            ping_message = json.dumps({
                "type": "ping",
                "timestamp": time.time()
            })
            
            start_time = time.time()
            success_count = 0
            
            while time.time() - start_time < duration:
                try:
                    await websocket.send(ping_message)
                    try:
                        response = await asyncio.wait_for(websocket.recv(), timeout=10)  # 增加超时时间
                        success_count += 1
                        # 每10次成功响应打印一次
                        if success_count % 10 == 0:
                            print(f"客户端 {client_id} 已成功响应 {success_count} 次")
                    except asyncio.TimeoutError:
                        print(f"客户端 {client_id} 超时")
                        # 继续测试，不立即中断
                        await asyncio.sleep(1)
                        continue
                    except websockets.exceptions.ConnectionClosed as e:
                        print(f"客户端 {client_id} 连接关闭: {e}")
                        break
                except Exception as e:
                    print(f"客户端 {client_id} 发送消息时出错: {e}")
                    await asyncio.sleep(1)
                    continue
                
                await asyncio.sleep(2)  # 每2秒发送一次ping
            
            print(f"客户端 {client_id} 完成测试，成功响应 {success_count} 次")
        
        print(f"客户端 {client_id} 完成测试")
        # 如果成功响应次数大于0，则认为测试成功
        return success_count > 0
    except Exception as e:
        print(f"客户端 {client_id} 错误: {e}")
        return False

async def main():
    parser = argparse.ArgumentParser(description="WebSocket压力测试")
    parser.add_argument("--url", default="ws://localhost:8000/api/v1/ws", help="WebSocket URL")
    parser.add_argument("--clients", type=int, default=10, help="并发客户端数量")
    parser.add_argument("--duration", type=int, default=30, help="测试持续时间(秒)")
    
    args = parser.parse_args()
    
    print(f"开始WebSocket压力测试")
    print(f"目标URL: {args.url}")
    print(f"并发客户端: {args.clients}")
    print(f"测试持续时间: {args.duration}秒")
    print("=" * 50)
    
    start_time = time.time()
    
    # 创建并运行所有客户端
    tasks = []
    for i in range(args.clients):
        task = connect_and_keep_alive(args.url, i, args.duration)
        tasks.append(task)
    
    results = await asyncio.gather(*tasks)
    
    end_time = time.time()
    
    # 统计结果
    success_count = sum(results)
    fail_count = len(results) - success_count
    
    print("=" * 50)
    print(f"测试完成")
    print(f"总客户端数: {args.clients}")
    print(f"成功连接: {success_count}")
    print(f"失败连接: {fail_count}")
    print(f"测试持续时间: {end_time - start_time:.2f}秒")
    print(f"成功率: {success_count / args.clients * 100:.1f}%")

if __name__ == "__main__":
    asyncio.run(main())
