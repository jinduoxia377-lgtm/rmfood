"""PostgreSQL 连接诊断 v3 — 使用 psycopg2 同步驱动测试"""
import socket
import sys

def test_raw_socket():
    """原始 TCP 测试：验证端口真的可达"""
    print("=" * 50)
    print("Step 1: 原始 TCP 连接测试")
    print("=" * 50)
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(5)
        sock.connect(("localhost", 5432))
        # 尝试读取 PostgreSQL 启动消息
        data = sock.recv(1024)
        print(f"  ✅ TCP 连接成功!")
        print(f"  收到数据 ({len(data)} bytes): {data[:100]}")
        sock.close()
        return True
    except socket.timeout:
        print(f"  ❌ TCP 连接超时")
        return False
    except ConnectionRefusedError as e:
        print(f"  ❌ 连接被拒绝: {e}")
        return False
    except Exception as e:
        print(f"  ❌ 错误: {type(e).__name__}: {e}")
        return False

def test_psycopg2():
    """使用 psycopg2 同步驱动测试"""
    print("\n" + "=" * 50)
    print("Step 2: psycopg2 同步连接测试")
    print("=" * 50)

    try:
        import psycopg2
        print(f"  psycopg2 版本: {psycopg2.__version__}")
    except ImportError:
        print(f"  ⚠️ psycopg2 未安装，跳过")
        return None

    for dsn in [
        "host=localhost port=5432 dbname=postgres user=postgres",
        "host=localhost port=5432 dbname=postgres user=postgres password=postgres",
        "host=localhost port=5432 dbname=postgres user=postgres connect_timeout=5",
    ]:
        print(f"\n  尝试: {dsn}")
        try:
            conn = psycopg2.connect(dsn)
            cur = conn.cursor()
            cur.execute("SELECT version()")
            version = cur.fetchone()[0]
            print(f"  ✅ 成功! 版本: {str(version)[:80]}")
            conn.close()
            return True
        except psycopg2.OperationalError as e:
            print(f"  ❌ OperationalError: {e}")
        except Exception as e:
            print(f"  ❌ {type(e).__name__}: {e}")

    return False

if __name__ == "__main__":
    raw_ok = test_raw_socket()
    psy_ok = test_psycopg2()

    print("\n" + "=" * 50)
    print("诊断总结")
    print("=" * 50)
    print(f"  TCP 原始连接: {'✅ 通过' if raw_ok else '❌ 失败'}")
    print(f"  psycopg2: {'✅ 通过' if psy_ok else '❌ 失败' if psy_ok is False else '⏭️ 跳过'}")

    if raw_ok and not psy_ok:
        print("\n  💡 推断: PostgreSQL 服务运行中但认证配置有问题")
        print("     请检查 pg_hba.conf 中的认证方式")
    elif not raw_ok:
        print("\n  💡 推断: 端口 5432 虽然监听但非 PostgreSQL")
        print("     可能是其他服务占用了该端口")
