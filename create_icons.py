from PIL import Image, ImageDraw
import os

SIZE = 81
NORMAL_COLOR = (153, 153, 153)
ACTIVE_COLOR = (45, 90, 61)

def create_icon(filename, draw_func):
    img = Image.new('RGBA', (SIZE, SIZE), (255, 255, 255, 0))
    draw = ImageDraw.Draw(img)
    draw_func(draw)
    img.save(filename, 'PNG')
    print(f'Created: {filename}')

# Home icon
def draw_home(draw, color):
    # House shape
    draw.polygon([(40, 12), (12, 35), (68, 35)], fill=color)
    draw.rectangle([(22, 35), (58, 68)], fill=color)
    draw.rectangle([(35, 52), (45, 68)], fill=(255, 255, 255, 0))

# Chat icon
def draw_chat(draw, color):
    draw.rounded_rectangle([(12, 18), (68, 58)], radius=6, fill=color)
    draw.polygon([(28, 58), (38, 58), (33, 68)], fill=color)

# Search icon
def draw_search(draw, color):
    draw.ellipse([(20, 20), (50, 50)], outline=color, width=4)
    draw.line([(45, 45), (62, 62)], fill=color, width=4)

# Profile icon
def draw_profile(draw, color):
    draw.ellipse([(28, 15), (52, 38)], fill=color)
    draw.arc([(18, 42), (62, 72)], 0, 180, fill=color, width=4)

# Create directories
os.makedirs('icons/normal', exist_ok=True)
os.makedirs('icons/active', exist_ok=True)

# Generate icons
draw_funcs = [
    ('home', draw_home),
    ('chat', draw_chat),
    ('search', draw_search),
    ('profile', draw_profile)
]

for name, draw_func in draw_funcs:
    create_icon(f'icons/normal/{name}.png', lambda d, df=draw_func: df(d, NORMAL_COLOR))
    create_icon(f'icons/active/{name}.png', lambda d, df=draw_func: df(d, ACTIVE_COLOR))

print('All icons created successfully!')