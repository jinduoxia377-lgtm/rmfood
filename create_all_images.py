from PIL import Image, ImageDraw
import os

# 图片尺寸
WIDTH, HEIGHT = 400, 300

# 颜色配置
COLORS = {
    'default-formula': ((45, 90, 61), (232, 245, 233)),  # 绿色主题
    'default-article': ((45, 90, 61), (232, 245, 233)),  # 绿色主题
}

def create_placeholder_image(filename, primary_color, bg_color, text):
    img = Image.new('RGB', (WIDTH, HEIGHT), bg_color)
    draw = ImageDraw.Draw(img)
    
    # 绘制边框
    draw.rectangle([10, 10, WIDTH-10, HEIGHT-10], outline=primary_color, width=2)
    
    # 绘制文字
    draw.text((WIDTH//2 - 50, HEIGHT//2 - 10), text, fill=primary_color)
    draw.text((WIDTH//2 - 30, HEIGHT//2 + 15), 'Placeholder', fill=(153, 153, 153))
    
    img.save(filename, 'PNG')
    print(f'Created: {filename} ({os.path.getsize(filename)} bytes)')

# 创建目录
os.makedirs('D:\RMFOODFP\miniprogram\assets\images', exist_ok=True)

# 创建formula图片
if not os.path.exists('D:\RMFOODFP\miniprogram\assets\images/default-formula.png'):
    create_placeholder_image('D:\RMFOODFP\miniprogram\assets\images/default-formula.png', *COLORS['default-formula'], 'Formula Image')

# 创建article图片
if not os.path.exists('D:\RMFOODFP\miniprogram\assets\images/default-article.png'):
    create_placeholder_image('D:\RMFOODFP\miniprogram\assets\images/default-article.png', *COLORS['default-article'], 'Article Image')

print('All images created!')