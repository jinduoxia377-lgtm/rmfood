# TabBar图标生成脚本
# 使用Python生成符合微信小程序规范的图标

from PIL import Image, ImageDraw, ImageFont
import os

# 图标配置
ICON_CONFIG = {
    'home': {
        'normal': '#999999',
        'active': '#2D5A3D',
        'size': (81, 81)
    },
    'chat': {
        'normal': '#999999',
        'active': '#2D5A3D',
        'size': (81, 81)
    },
    'search': {
        'normal': '#999999',
        'active': '#2D5A3D',
        'size': (81, 81)
    },
    'user': {
        'normal': '#999999',
        'active': '#2D5A3D',
        'size': (81, 81)
    }
}

def create_home_icon(size, color):
    """创建首页图标"""
    img = Image.new('RGBA', size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # 绘制房子形状
    cx, cy = size[0] // 2, size[1] // 2 - 5
    w, h = size[0] * 0.6, size[1] * 0.5
    
    # 房子主体
    draw.polygon([
        (cx - w//2, cy),
        (cx, cy - h//2),
        (cx + w//2, cy)
    ], fill=color)
    
    # 房子底座
    draw.rectangle([cx - w//2, cy, cx + w//2, cy + h//2], fill=color)
    
    return img

def create_chat_icon(size, color):
    """创建对话图标"""
    img = Image.new('RGBA', size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    cx, cy = size[0] // 2, size[1] // 2
    w, h = size[0] * 0.7, size[1] * 0.5
    
    # 对话框
    draw.rounded_rectangle([cx - w//2, cy - h//2, cx + w//2, cy + h//2], 
                           radius=10, fill=color)
    
    # 小三角
    draw.polygon([
        (cx - w//4, cy + h//2),
        (cx - w//4 + 10, cy + h//2 + 15),
        (cx - w//4 + 20, cy + h//2)
    ], fill=color)
    
    return img

def create_search_icon(size, color):
    """创建搜索图标"""
    img = Image.new('RGBA', size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    cx, cy = size[0] // 2, size[1] // 2 - 3
    r = size[0] * 0.2
    
    # 圆形
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], outline=color, width=6)
    
    # 手柄
    draw.line([cx + r//2, cy + r//2, cx + r, cy + r], fill=color, width=6)
    
    return img

def create_user_icon(size, color):
    """创建用户图标"""
    img = Image.new('RGBA', size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    cx, cy = size[0] // 2, size[1] // 2 - 8
    r = size[0] * 0.18
    
    # 头部
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=color)
    
    # 身体
    draw.ellipse([cx - r*1.5, cy + r*0.5, cx + r*1.5, cy + r*2.5], fill=color)
    
    return img

def save_icons():
    """保存所有图标"""
    output_dir = "D:\\RMFOODFP\\miniprogram\\assets\\icons"
    os.makedirs(output_dir, exist_ok=True)
    
    icons = {
        'home': create_home_icon,
        'chat': create_chat_icon,
        'search': create_search_icon,
        'user': create_user_icon
    }
    
    for name, create_fn in icons.items():
        # 正常状态
        img_normal = create_fn(ICON_CONFIG[name]['size'], ICON_CONFIG[name]['normal'])
        img_normal.save(os.path.join(output_dir, f'{name}.png'), 'PNG')
        
        # 选中状态
        img_active = create_fn(ICON_CONFIG[name]['size'], ICON_CONFIG[name]['active'])
        img_active.save(os.path.join(output_dir, f'{name}-active.png'), 'PNG')
        
        print(f"✅ 生成 {name} 图标")

if __name__ == '__main__':
    try:
        save_icons()
        print("\n✅ 所有TabBar图标已生成")
    except ImportError:
        print("❌ 需要安装Pillow: pip install Pillow")
