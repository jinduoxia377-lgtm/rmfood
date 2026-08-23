"""Kill backend and frontend processes"""
import subprocess
import time

pids = [7052, 9544, 9944, 11724, 11792, 12216, 10000]
for pid in pids:
    try:
        subprocess.run(['taskkill', '/PID', str(pid), '/F'], capture_output=True)
        print(f'killed {pid}')
    except:
        pass

time.sleep(2)
print('done')
