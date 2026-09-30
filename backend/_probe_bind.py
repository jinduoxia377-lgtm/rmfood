import socket
s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
try:
    s.bind(("0.0.0.0", 8000))
    print("bind 0.0.0.0:8000 OK")
    s.close()
except OSError as e:
    print("bind FAIL:", e)
s2 = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
try:
    s2.bind(("127.0.0.1", 8000))
    print("bind 127.0.0.1:8000 OK")
    s2.close()
except OSError as e:
    print("bind 127.0.0.1:8000 FAIL:", e)
