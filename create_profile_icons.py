from PIL import Image, ImageDraw

SIZE = 81
NORMAL_COLOR = (153, 153, 153)
ACTIVE_COLOR = (45, 90, 61)

def create_profile_icon(filename, color):
    img = Image.new('RGBA', (SIZE, SIZE), (255, 255, 255, 0))
    draw = ImageDraw.Draw(img)
    
    # 绘制头像（圆形）
    draw.ellipse([(28, 15), (52, 38)], fill=color)
    
    # 绘制身体（半圆）
    draw.arc([(18, 42), (62, 72)], 0, 180, fill=color, width=4)
    
    img.save(filename, 'PNG')
    print(f'Created: {filename}')

# 创建normal图标
create_profile_icon('D:/RMFOODFP/miniprogram/assets/icons/normal/profile.png', NORMAL_COLOR)

# 创建active图标
create_profile_icon('D:/RMFOODFP/miniprogram/assets/icons/active/profile.png', ACTIVE_COLOR)

print('Profile icons created successfully!')