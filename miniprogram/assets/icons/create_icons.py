# -*- coding: utf-8 -*-
"""将SVG图标转换为PNG格式（用于微信小程序TabBar）"""

import os
from PIL import Image, ImageDraw, ImageFont

def create_home_icon(size=54, color=(153, 153, 153)):
    """创建首页图标"""
    img = Image.new('RGBA', (size, size), (255, 255, 255, 0))
    draw = ImageDraw.Draw(img)
    
    # 绘制房屋形状
    # 屋顶
    draw.polygon([
        (size//2, 4),
        (4, size//2 + 4),
        (size - 4, size//2 + 4)
    ], fill=color)
    
    # 屋身
    draw.rectangle([8, size//2, size - 8, size - 6], fill=color)
    
    return img

def create_chat_icon(size=54, color=(153, 153, 153)):
    """创建AI对话图标"""
    img = Image.new('RGBA', (size, size), (255, 255, 255, 0))
    draw = ImageDraw.Draw(img)
    
    cx, cy = size // 2, size // 2 - 4
    
    # 头部圆形
    draw.ellipse([cx - 10, cy - 10, cx + 10, cy + 10], fill=color)
    
    # 身体
    draw.ellipse([cx - 14, cy + 8, cx + 14, cy + 24], fill=color)
    
    # 眼睛
    draw.ellipse([cx - 6, cy - 4, cx - 3, cy - 1], fill=(255, 255, 255, 255))
    draw.ellipse([cx + 3, cy - 4, cx + 6, cy - 1], fill=(255, 255, 255, 255))
    
    return img

def create_search_icon(size=54, color=(153, 153, 153)):
    """创建搜索图标"""
    img = Image.new('RGBA', (size, size), (255, 255, 255, 0))
    draw = ImageDraw.Draw(img)
    
    cx, cy = 22, 22
    r = 12
    
    # 圆圈
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], outline=color, width=3)
    
    # 手柄
    draw.line([(cx + r - 2, cy + r - 2), (cx + r + 8, cy + r + 8)], fill=color, width=3)
    
    return img

def create_user_icon(size=54, color=(153, 153, 153)):
    """创建我的图标"""
    img = Image.new('RGBA', (size, size), (255, 255, 255, 0))
    draw = ImageDraw.Draw(img)
    
    cx, cy = size // 2, 16
    
    # 头部圆形
    draw.ellipse([cx - 9, cy - 9, cx + 9, cy + 9], fill=color)
    
    # 身体
    draw.ellipse([cx - 14, cy + 10, cx + 14, size - 4], fill=color)
    
    return img

def main():
    icon_dir = r'D:\RMFOODFP\miniprogram\assets\icons'
    
    # 定义图标配置
    icons = [
        ('home', create_home_icon, '#999999'),
        ('home-active', create_home_icon, '#2D5A3D'),
        ('chat', create_chat_icon, '#999999'),
        ('chat-active', create_chat_icon, '#1565C0'),
        ('search', create_search_icon, '#999999'),
        ('search-active', create_search_icon, '#F57C00'),
        ('user', create_user_icon, '#999999'),
        ('user-active', create_user_icon, '#2D5A3D'),
    ]
    
    os.makedirs(icon_dir, exist_ok=True)
    
    for name, creator, color_hex in icons:
        # 解析颜色
        color = tuple(int(color_hex.lstrip('#')[i:i+2], 16) for i in (0, 2, 4))
        
        # 创建图标
        img = creator(54, color)
        
        # 保存为PNG
        output_path = os.path.join(icon_dir, f'{name}.png')
        img.save(output_path, 'PNG', optimize=True)
        print(f'Created: {output_path}')
    
    print('\nAll icons created successfully!')

if __name__ == '__main__':
    main()
