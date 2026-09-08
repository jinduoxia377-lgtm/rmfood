import os
from PIL import Image, ImageDraw

output_dir = r"D:\RMFOODFP\miniprogram\assets\icons"
size = 128

def create_icon(name, draw_func):
    img = Image.new('RGBA', (size, size), (255, 255, 255, 0))
    draw = ImageDraw.Draw(img)
    draw_func(draw, size)
    path = os.path.join(output_dir, name)
    img.save(path, 'PNG')
    print(f"  OK {name} ({os.path.getsize(path)} bytes)")

# 1. 配料分析 - 显微镜
def draw_ingredient(draw, s):
    c = (45, 90, 61)
    draw.rectangle([30, 95, 98, 105], fill=c)
    draw.rectangle([88, 30, 96, 95], fill=c)
    draw.rectangle([40, 30, 65, 70], outline=c, width=5)
    draw.rectangle([30, 65, 75, 70], fill=c)
    draw.rectangle([50, 70, 60, 80], fill=c)
    draw.ellipse([75, 75, 90, 90], fill=c)
    draw.ellipse([55, 38, 63, 46], fill=c)

create_icon('ingredient.png', draw_ingredient)

# 2. AI顾问 - 对话气泡
def draw_chat(draw, s):
    c = (33, 150, 243)
    points = [(20, 35), (20, 85), (35, 100), (90, 100), (108, 85), (108, 35), (90, 20), (35, 20)]
    draw.polygon(points, outline=c, width=5)
    draw.line([(35, 45), (90, 45)], fill=c, width=4)
    draw.line([(40, 60), (85, 60)], fill=c, width=4)
    draw.line([(45, 75), (70, 75)], fill=c, width=4)
    draw.ellipse([45, 38, 55, 48], fill=c)
    draw.ellipse([70, 38, 80, 48], fill=c)

create_icon('chat.png', draw_chat)

# 3. 配方库 - 书本
def draw_formula(draw, s):
    c = (255, 152, 0)
    draw.rectangle([25, 25, 100, 100], outline=c, width=5)
    draw.line([(60, 25), (60, 100)], fill=c, width=5)
    draw.line([(70, 40), (92, 40)], fill=c, width=3)
    draw.line([(70, 55), (92, 55)], fill=c, width=3)
    draw.line([(70, 70), (85, 70)], fill=c, width=3)
    draw.line([(32, 40), (52, 40)], fill=c, width=3)
    draw.line([(32, 55), (52, 55)], fill=c, width=3)
    draw.ellipse([85, 80, 105, 100], fill=c)

create_icon('formula.png', draw_formula)

# 4. 历史记录 - 时钟
def draw_history(draw, s):
    c = (156, 39, 176)
    draw.ellipse([20, 20, 108, 108], outline=c, width=5)
    draw.ellipse([60, 60, 68, 68], fill=c)
    draw.line([(64, 64), (50, 45)], fill=c, width=5)
    draw.line([(64, 64), (85, 55)], fill=c, width=4)
    import math
    for angle in [0, 90, 180, 270]:
        rad = math.radians(angle - 90)
        x1 = 64 + 38 * math.cos(rad)
        y1 = 64 + 38 * math.sin(rad)
        x2 = 64 + 32 * math.cos(rad)
        y2 = 64 + 32 * math.sin(rad)
        draw.line([(x1, y1), (x2, y2)], fill=c, width=3)

create_icon('history.png', draw_history)

print("\nIcons generated successfully!")
