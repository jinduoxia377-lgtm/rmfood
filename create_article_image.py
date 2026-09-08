from PIL import Image, ImageDraw, ImageFont

# 创建一张简单的占位图片
width, height = 400, 300
img = Image.new('RGB', (width, height), color=(232, 245, 233))  # 浅绿色背景
draw = ImageDraw.Draw(img)

# 绘制文字
try:
    # 尝试使用系统字体
    font = ImageFont.truetype("arial.ttf", 24)
except:
    font = ImageFont.load_default()

# 绘制标题
draw.text((width//2 - 80, height//2 - 20), "Article Image", fill=(45, 90, 61), font=font)
draw.text((width//2 - 60, height//2 + 10), "Placeholder", fill=(153, 153, 153), font=font)

# 保存图片
img.save('D:/RMFOODFP/miniprogram/assets/images/default-article.png', 'PNG')
print('Created: default-article.png')