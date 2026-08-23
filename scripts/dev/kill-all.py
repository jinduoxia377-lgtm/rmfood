import ctypes, time, os
kernel32 = ctypes.windll.kernel32
handles = []
pids = [7052, 9544, 9944, 11724, 11792, 12216, 10000]
for pid in pids:
    try:
        h = kernel32.OpenProcess(0x00020000, False, pid)
        if h:
            kernel32.TerminateProcess(h, 1)
            kernel32.CloseHandle(h)
            print(f'Terminated {pid}')
    except Exception as e:
        print(f'Failed {pid}: {e}')
time.sleep(2)
# Verify
for pid in pids:
    try:
        os.kill(pid, 0)
    except ProcessLookupError:
        print(f'{pid} is gone')
