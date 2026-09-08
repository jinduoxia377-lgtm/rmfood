from PIL import Image, ImageDraw

width, height = 400, 300
img = Image.new('RGB', (width, height), color=(232, 245, 233))
draw = ImageDraw.Draw(img)
draw.text((150, 130), 'Formula Image', fill=(45, 90, 61))
draw.text((170, 170), 'Placeholder', fill=(153, 153, 153))
img.save('D:/RMFOODFP/miniprogram/assets/images/default-formula.png', 'PNG')
print('Created: default-formula.png')