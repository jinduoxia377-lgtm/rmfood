import os, signal, sys

pids = [11276, 8204, 4444]
for pid in pids:
    try:
        os.kill(pid, signal.SIGKILL)
        print(f'Killed PID {pid}')
    except ProcessLookupError:
        print(f'PID {pid} not found')
    except PermissionError:
        print(f'Permission denied for PID {pid}')
    except Exception as e:
        print(f'Error killing PID {pid}: {e}')

print('Done')
