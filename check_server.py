import paramiko
import sys
import time

print('=== RMFOOD Cloud Server Check ===')
print()

try:
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect('106.12.20.131', username='root', password='RmF0dPr0d2024!sec', timeout=30)
    print('SSH Connected OK')
except Exception as e:
    print(f'SSH Failed: {e}')
    sys.exit(1)

def run(cmd, label):
    print(f'\n{"="*60}')
    print(f'[{label}]')
    print(f'命令: {cmd}')
    print('='*60)
    try:
        stdin, stdout, stderr = client.exec_command(cmd, timeout=60)
        out = stdout.read().decode('utf-8', errors='replace').strip()
        err = stderr.read().decode('utf-8', errors='replace').strip()
        if out:
            print(out)
        if err:
            print(f'[stderr]\n{err}')
        if not out and not err:
            print('(无输出)')
    except Exception as e:
        print(f'执行错误: {e}')

# 1. 主机名和系统负载
run('hostname', '1. 主机名')
run('uptime', '2. 系统负载')

# 2. Docker 容器状态
run('docker ps -a --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"', '3. Docker 容器状态')

# 3. 后端容器日志
run('docker logs rmfood_backend --tail 50 2>&1', '4. 后端容器日志')

# 4. 数据库容器日志
run('docker logs rmfood_postgres --tail 20 2>&1', '5. 数据库容器日志')

# 5. 磁盘和内存
run('df -h', '6. 磁盘使用')
run('free -h', '7. 内存使用')

# 6. Nginx 容器状态和日志
run('docker ps -a --filter name=nginx --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"', '8. Nginx 容器状态')
run('docker logs $(docker ps -aqf name=nginx) --tail 20 2>&1', '9. Nginx 容器日志')

# 检查后端容器状态，如未运行则尝试启动
_, status_out, _ = client.exec_command('docker ps -a --filter name=rmfood_backend --format "{{.Status}}"')
backend_status = status_out.read().decode().strip()
print(f'\n后端容器当前状态: {backend_status}')

if backend_status and ('Exited' in backend_status or 'dead' in backend_status.lower() or not 'Up' in backend_status):
    print('\n后端容器未运行，尝试启动...')
    run('docker compose -f /opt/rmfood/deploy/docker-compose.deploy.yml up -d', '10. 启动后端容器')
    time.sleep(5)
    run('docker ps -a --filter name=rmfood_backend --format "table {{.Names}}\t{{.Status}}"', '11. 启动后容器状态')
    run('docker logs rmfood_backend --tail 30 2>&1', '12. 启动后后端日志')

client.close()
print('\n' + '='*60)
print('所有检查完成！')
print('='*60)
