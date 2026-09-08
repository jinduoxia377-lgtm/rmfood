from PIL import Image, ImageDraw
import os

SIZE = 81
NORMAL_COLOR = (153, 153, 153)
ACTIVE_COLOR = (45, 90, 61)

def create_icon(filename, draw_func, color):
    img = Image.new('RGBA', (SIZE, SIZE), (255, 255, 255, 0))
    draw = ImageDraw.Draw(img)
    draw_func(draw, color)
    img.save(filename, 'PNG')
    print(f'Created: {os.path.basename(filename)} ({os.path.getsize(filename)} bytes)')

# 图标绘制函数
def draw_ingredient(draw, color):
    # 药瓶形状
    draw.rounded_rectangle([(25, 15), (55, 65)], radius=4, fill=color)
    draw.rectangle([(30, 10), (50, 18)], fill=color)

def draw_chat(draw, color):
    # 聊天气泡
    draw.rounded_rectangle([(12, 18), (68, 58)], radius=6, fill=color)
    draw.polygon([(28, 58), (38, 58), (33, 68)], fill=color)

def draw_formula(draw, color):
    # 书本形状
    draw.rounded_rectangle([(15, 15), (65, 65)], radius=4, fill=color)
    for i in range(3):
        y = 25 + i * 10
        draw.rectangle([(22, y), (58, y+3)], fill=(255, 255, 255, 0))

def draw_history(draw, color):
    # 时钟形状
    draw.ellipse([(18, 18), (62, 62)], outline=color, width=4)
    draw.line([(40, 40), (40, 25)], fill=color, width=3)
    draw.line([(40, 40), (50, 40)], fill=color, width=3)

def draw_home(draw, color):
    # 房子形状
    draw.polygon([(40, 12), (12, 35), (68, 35)], fill=color)
    draw.rectangle([(22, 35), (58, 68)], fill=color)

def draw_search(draw, color):
    # 放大镜
    draw.ellipse([(20, 20), (50, 50)], outline=color, width=4)
    draw.line([(45, 45), (62, 62)], fill=color, width=4)

def draw_profile(draw, color):
    # 人像
    draw.ellipse([(28, 15), (52, 38)], fill=color)
    draw.arc([(18, 42), (62, 72)], 0, 180, fill=color, width=4)

# 图标定义
icons = [
    ('ingredient', draw_ingredient),
    ('chat', draw_chat),
    ('formula', draw_formula),
    ('history', draw_history),
    ('home', draw_home),
    ('search', draw_search),
    ('profile', draw_profile)
]

base_path = 'D:/RMFOODFP/miniprogram/assets/icons'

# 生成所有图标
for name, draw_func in icons:
    create_icon(f'{base_path}/{name}.png', draw_func, NORMAL_COLOR)
    create_icon(f'{base_path}/{name}-active.png', draw_func, ACTIVE_COLOR)

print('\\nAll icons generated successfully!')