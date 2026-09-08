from PIL import Image, ImageDraw

SIZE = 81
ACTIVE_COLOR = (45, 90, 61)  # #2D5A3D

def create_profile_icon(filename, color):
    img = Image.new('RGBA', (SIZE, SIZE), (255, 255, 255, 0))
    draw = ImageDraw.Draw(img)
    
    # 绘制头像（圆形）
    draw.ellipse([(28, 15), (52, 38)], fill=color)
    
    # 绘制身体（半圆）
    draw.arc([(18, 42), (62, 72)], 0, 180, fill=color, width=4)
    
    img.save(filename, 'PNG')
    print(f'Created: {filename}')

create_profile_icon('D:/RMFOODFP/miniprogram/assets/icons/profile-active.png', ACTIVE_COLOR)
print('Profile active icon created!')