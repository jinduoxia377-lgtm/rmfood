import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.connect_over_cdp("http://localhost:9333")
        print("已连接到 Chrome")
        
        # 获取页面
        page = None
        for ctx in browser.contexts:
            for p in ctx.pages:
                if "cloudflare" in p.url.lower():
                    page = p
                    break
            if page:
                break
        
        if not page:
            context = await browser.new_context()
            page = await context.new_page()
        
        # 确保在 Dashboard 页面
        current_url = page.url
        print(f"当前 URL: {current_url}")
        
        if "tunnels" not in current_url:
            await page.goto("https://one.dash.cloudflare.com/52d90e4fd33c3bfd600a44968d00a491/tunnels", wait_until="domcontentloaded", timeout=30000)
            await page.wait_for_timeout(3000)
        
        # 查找 RMFOODFP 隧道
        print("查找 RMFOODFP 隧道...")
        try:
            tunnel_row = await page.query_selector('text=RMFOODFP')
            if tunnel_row:
                await tunnel_row.click()
                print("点击了 RMFOODFP 隧道")
                await page.wait_for_timeout(3000)
        except Exception as e:
            print(f"查找隧道失败: {e}")
        
        # 查找 Hostnames 标签
        print("查找 Hostnames 标签...")
        try:
            hostname_tab = await page.query_selector('text=Hostnames')
            if hostname_tab:
                await hostname_tab.click()
                print("点击了 Hostnames 标签")
                await page.wait_for_timeout(3000)
            else:
                hostname_tab = await page.query_selector('[role="tab"]:has-text("Hostnames")')
                if hostname_tab:
                    await hostname_tab.click()
                    print("点击了 Hostnames 标签 (role=tab)")
                    await page.wait_for_timeout(3000)
        except Exception as e:
            print(f"查找标签失败: {e}")
        
        # 截图
        await page.screenshot(path="D:\\RMFOODFP\\cloudflare_step1.png")
        print("已保存截图")
        
        # 检查是否已有主机名
        content = await page.content()
        if "rmfood.agnet.ltd" in content:
            print("主机名已存在!")
        else:
            print("主机名不存在，尝试添加...")
            
            try:
                add_btn = await page.query_selector('button:has-text("Add"), text=Add a hostname')
                if add_btn:
                    await add_btn.click()
                    print("点击了添加按钮")
                    await page.wait_for_timeout(2000)
                    
                    # 填写主机名
                    try:
                        hostname_input = await page.query_selector('input[placeholder*="Hostname"], input[type="text"]')
                        if hostname_input:
                            await hostname_input.fill("rmfood.agnet.ltd")
                            print("已填写主机名")
                    except Exception as e:
                        print(f"填写主机名失败: {e}")
                    
                    await page.wait_for_timeout(1000)
                    
                    # 选择服务类型
                    try:
                        service_select = await page.query_selector("select")
                        if service_select:
                            await service_select.select_option("Cloudflare Tunnel")
                            print("已选择服务类型")
                    except Exception as e:
                        print(f"选择服务类型失败: {e}")
                    
                    await page.wait_for_timeout(1000)
                    
                    # 选择隧道
                    try:
                        tunnel_select = await page.query_selector("select")
                        if tunnel_select:
                            await tunnel_select.select_option("RMFOODFP")
                            print("已选择隧道")
                    except Exception as e:
                        print(f"选择隧道失败: {e}")
                    
                    await page.wait_for_timeout(1000)
                    
                    # 点击保存
                    try:
                        save_btn = await page.query_selector('button:has-text("Save"), button:has-text("Save changes")')
                        if save_btn:
                            await save_btn.click()
                            print("已点击保存")
                            await page.wait_for_timeout(3000)
                    except Exception as e:
                        print(f"点击保存失败: {e}")
            except Exception as e:
                print(f"添加主机名失败: {e}")
        
        await page.screenshot(path="D:\\RMFOODFP\\cloudflare_config_done.png")
        print("已保存最终截图")
        
        await browser.close()

asyncio.run(main())
