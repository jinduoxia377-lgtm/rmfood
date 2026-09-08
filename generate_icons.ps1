Add-Type -AssemblyName System.Drawing

# 定义颜色
$greenDark = [System.Drawing.Color]::FromArgb(45, 90, 61)    # #2D5A3D
$greenLight = [System.Drawing.Color]::FromArgb(74, 124, 92)  # #4A7C5C
$blue = [System.Drawing.Color]::FromArgb(33, 150, 243)       # #2196F3
$orange = [System.Drawing.Color]::FromArgb(255, 152, 0)      # #FF9800
$purple = [System.Drawing.Color]::FromArgb(156, 39, 176)     # #9C27B0
$white = [System.Drawing.Color]::White
$gray = [System.Drawing.Color]::FromArgb(158, 158, 158)      # #9E9E9E

# 图标尺寸
$size = 128
$outputPath = "D:\RMFOODFP\miniprogram\assets\icons"

# 1. 配料分析图标 - 显微镜/检测风格
function DrawIngredientIcon {
    $bitmap = New-Object System.Drawing.Bitmap($size, $size)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    
    # 纯白色背景
    $graphics.Clear($white)
    
    # 绘制显微镜图标（简约线条风格）
    $pen = New-Object System.Drawing.Pen($greenDark, 4)
    
    # 底座
    $graphics.DrawRectangle($pen, 35, 95, 58, 10)
    
    # 镜臂
    $graphics.DrawLine($pen, 85, 35, 85, 95)
    
    # 镜筒
    $graphics.DrawRectangle($pen, 45, 35, 30, 40)
    
    # 载物台
    $graphics.DrawLine($pen, 30, 70, 75, 70)
    
    # 镜头
    $pen.Width = 3
    $graphics.DrawLine($pen, 50, 75, 65, 75)
    
    # 细节点
    $brush = New-Object System.Drawing.SolidBrush($greenDark)
    $graphics.FillEllipse($brush, 80, 28, 10, 10)
    
    $graphics.Dispose()
    $bitmap.Save("$outputPath\ingredient.png", [System.Drawing.Imaging.ImageFormat]::Png)
    $bitmap.Dispose()
}

# 2. AI顾问图标 - 机器人/AI风格
function DrawChatIcon {
    $bitmap = New-Object System.Drawing.Bitmap($size, $size)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.Clear($white)
    
    $pen = New-Object System.Drawing.Pen($blue, 4)
    
    # 对话气泡
    $graphics.DrawCurve($pen, @(
        New-Object System.Drawing.Point(25, 35),
        New-Object System.Drawing.Point(25, 75),
        New-Object System.Drawing.Point(25, 95),
        New-Object System.Drawing.Point(40, 105),
        New-Object System.Drawing.Point(75, 105),
        New-Object System.Drawing.Point(100, 95),
        New-Object System.Drawing.Point(100, 75),
        New-Object System.Drawing.Point(100, 35),
        New-Object System.Drawing.Point(75, 25),
        New-Object System.Drawing.Point(40, 25)
    ))
    
    # AI波纹
    $pen.Width = 3
    $graphics.DrawLine($pen, 40, 50, 85, 50)
    $graphics.DrawLine($pen, 45, 65, 80, 65)
    
    # 机器人眼睛
    $brush = New-Object System.Drawing.SolidBrush($blue)
    $graphics.FillEllipse($brush, 50, 42, 8, 8)
    $graphics.FillEllipse($brush, 70, 42, 8, 8)
    
    $graphics.Dispose()
    $bitmap.Save("$outputPath\chat.png", [System.Drawing.Imaging.ImageFormat]::Png)
    $bitmap.Dispose()
}

# 3. 配方库图标 - 书籍/文档风格
function DrawFormulaIcon {
    $bitmap = New-Object System.Drawing.Bitmap($size, $size)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.Clear($white)
    
    $pen = New-Object System.Drawing.Pen($orange, 4)
    
    # 书本轮廓
    $graphics.DrawRectangle($pen, 25, 25, 75, 80)
    
    # 书脊
    $graphics.DrawLine($pen, 55, 25, 55, 105)
    
    # 书页线条
    $pen.Width = 2
    $graphics.DrawLine($pen, 65, 40, 90, 40)
    $graphics.DrawLine($pen, 65, 55, 90, 55)
    $graphics.DrawLine($pen, 65, 70, 80, 70)
    
    # 左侧书页
    $pen.Width = 4
    $graphics.DrawLine($pen, 35, 40, 50, 40)
    $graphics.DrawLine($pen, 35, 55, 50, 55)
    $graphics.DrawLine($pen, 35, 70, 45, 70)
    
    # 徽章
    $brush = New-Object System.Drawing.SolidBrush($orange)
    $graphics.FillEllipse($brush, 85, 85, 18, 18)
    $graphics.Dispose()
    $bitmap.Save("$outputPath\formula.png", [System.Drawing.Imaging.ImageFormat]::Png)
    $bitmap.Dispose()
}

# 4. 历史记录图标 - 时钟/历史风格
function DrawHistoryIcon {
    $bitmap = New-Object System.Drawing.Bitmap($size, $size)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.Clear($white)
    
    $pen = New-Object System.Drawing.Pen($purple, 4)
    
    # 时钟外圆
    $graphics.DrawEllipse($pen, 25, 25, 78, 78)
    
    # 时钟中心点
    $brush = New-Object System.Drawing.SolidBrush($purple)
    $graphics.FillEllipse($brush, 60, 60, 8, 8)
    
    # 时针
    $pen.Width = 4
    $graphics.DrawLine($pen, 64, 64, 64, 45)
    
    # 分针
    $pen.Width = 3
    $graphics.DrawLine($pen, 64, 64, 80, 64)
    
    # 刻度
    $pen.Width = 2
    $graphics.DrawLine($pen, 64, 28, 64, 35)
    $graphics.DrawLine($pen, 64, 93, 64, 100)
    $graphics.DrawLine($pen, 28, 64, 35, 64)
    $graphics.DrawLine($pen, 93, 64, 100, 64)
    
    $graphics.Dispose()
    $bitmap.Save("$outputPath\history.png", [System.Drawing.Imaging.ImageFormat]::Png)
    $bitmap.Dispose()
}

# 生成所有图标
DrawIngredientIcon
DrawChatIcon
DrawFormulaIcon
DrawHistoryIcon

Write-Host "✓ 已生成4个图标" -ForegroundColor Green
