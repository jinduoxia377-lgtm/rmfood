from PIL import Image, ImageDraw
import os

SIZE = 81
NORMAL_COLOR = (153, 153, 153)  # #999999
ACTIVE_COLOR = (45, 90, 61)     # #2D5A3D

def create_icon(filename, draw_func):
    img = Image.new('RGBA', (SIZE, SIZE), (255, 255, 255, 0))
    draw = ImageDraw.Draw(img)
    draw_func(draw, NORMAL_COLOR)
    img.save(filename, 'PNG')

def create_active_icon(filename, draw_func):
    img = Image.new('RGBA', (SIZE, SIZE), (255, 255, 255, 0))
    draw = ImageDraw.Draw(img)
    draw_func(draw, ACTIVE_COLOR)
    img.save(filename, 'PNG')

# 首页图标 - 房子形状
def draw_home(draw, color):
    # 屋顶
    draw.polygon([(40, 12), (12, 35), (68, 35)], fill=color)
    # 屋身
    draw.rectangle([(22, 35), (58, 68)], fill=color)
    # 门
    draw.rectangle([(35, 52), (45, 68)], fill=(255, 255, 255, 0))

# AI对话图标 - 气泡形状
def draw_chat(draw, color):
    draw.rounded_rectangle([(12, 18), (68, 58)], radius=6, fill=color)
    draw.polygon([(28, 58), (38, 58), (33, 68)], fill=color)
    # 对话线条
    draw.rectangle([(20, 28), (45, 32)], fill=(255, 255, 255, 0))
    draw.rectangle([(20, 38), (40, 42)], fill=(255, 255, 255, 0))

# 搜索图标 - 放大镜
def draw_search(draw, color):
    draw.ellipse([(20, 20), (50, 50)], outline=color, width=4)
    draw.line([(45, 45), (62, 62)], fill=color, width=4)

# 我的图标 - 人像
def draw_profile(draw, color):
    draw.ellipse([(28, 15), (52, 38)], fill=color)
    draw.arc([(18, 42), (62, 72)], 0, 180, fill=color, width=4)

# 配料分析图标 - 药瓶/药材
def draw_ingredient(draw, color):
    # 药瓶形状
    draw.rounded_rectangle([(25, 15), (55, 65)], radius=4, fill=color)
    # 瓶盖
    draw.rectangle([(30, 10), (50, 18)], fill=color)
    # 标签
    draw.rectangle([(30, 35), (50, 50)], fill=(255, 255, 255, 0))

# 配方库图标 - 书本/清单
def draw_formula(draw, color):
    # 书本形状
    draw.rounded_rectangle([(15, 15), (65, 65)], radius=4, fill=color)
    # 书页线条
    for i in range(3):
        y = 25 + i * 10
        draw.rectangle([(22, y), (58, y+3)], fill=(255, 255, 255, 0))

# 历史记录图标 - 时钟
def draw_history(draw, color):
    draw.ellipse([(18, 18), (62, 62)], outline=color, width=4)
    draw.line([(40, 40), (40, 25)], fill=color, width=3)
    draw.line([(40, 40), (50, 40)], fill=color, width=3)

# 创建目录
normal_dir = 'D:/RMFOODFP/miniprogram/assets/icons/normal'
active_dir = 'D:/RMFOODFP/miniprogram/assets/icons/active'
os.makedirs(normal_dir, exist_ok=True)
os.makedirs(active_dir, exist_ok=True)

# 生成图标
icons = [
    ('home', draw_home),
    ('chat', draw_chat),
    ('search', draw_search),
    ('profile', draw_profile),
    ('ingredient', draw_ingredient),
    ('formula', draw_formula),
    ('history', draw_history)
]

for name, draw_func in icons:
    create_icon(f'{normal_dir}/{name}.png', draw_func)
    create_active_icon(f'{active_dir}/{name}.png', draw_func)
    print(f'Created: {name}')

print('All icons created successfully!')