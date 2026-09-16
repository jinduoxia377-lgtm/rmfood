"""Fix cfam stats - use correct function name spelling."""
path = r'D:\RMFOODFP\frontend\src\api\database.ts'

with open(path, 'rb') as f:
    raw = f.read()

# Find the stats function - the name might be spelled differently
# Search for patterns around the stats line
idx = raw.find(b"cfam/stats")
print(f"cfam/stats at: {idx}")

# Look backward for getCfimStats or getCfimStats
for offset in range(200, 0, -1):
    chunk = raw[idx-offset:idx]
    if b"Stats" in chunk or b"stats" in chunk:
        print(f"Found 'stats' keyword at offset {idx-offset}: {repr(chunk[-30:])}")
        break

# Check what function contains this
func_idx = raw.rfind(b"getC", 0, idx)
if func_idx >= 0:
    # Find the full function name
    end = raw.find(b":", func_idx)
    func_name = raw[func_idx:end+1]
    print(f"Function name: {repr(func_name)}")
    # Show the full function block
    start = raw.rfind(b"\r\n", 0, func_idx) + 2
    end_block = raw.find(b",\r\n\r\n", idx)
    print(f"Full block:\n{repr(raw[start:end_block+10])}")
else:
    # Maybe it's after a comment
    prev_newline = raw.rfind(b"\r\n", 0, idx)
    print(f"Prev newline at: {prev_newline}")
    print(f"Context before: {repr(raw[prev_newline:idx+80])}")
