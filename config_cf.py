import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.connect_over_cdp("http://localhost:9333")
        print("已连接到 Chrome")
        
        # 获取页面
        page = None
        for ctx in browser.contexts:
            for pg in ctx.pages:
                if "cloudflare" in pg.url.lower():
                    page = pg
                    break
            if page:
                break
        
        if not page:
            context = await browser.new_context()
            page = await context.new_page()
        
        print(f"当前 URL: {page.url}")
        
        # 导航到隧道页面
        await page.goto("https://one.dash.cloudflare.com/52d90e4fd33c3bfd600a44968d00a4491/tunnels", wait_until="domcontentloaded", timeout=60000)
        await page.wait_for_timeout(5000)
        print(f"当前 URL: {page.url}")
        
        # 查找并点击 RMFOODFP 隧道
        try:
            tunnel_row = await page.query_selector('text=RMFOODFP')
            if tunnel_row:
                await tunnel_row.click()
                print("点击了 RMFOODFP 隧道")
                await page.wait_for_timeout(3000)
        except Exception as e:
            print(f"点击隧道失败: {e}")
        
        # 截图
        try:
            await page.screenshot(path="D:\\RMFOODFP\\cf1.png", timeout=10000)
            print("已保存 cf1.png")
        except Exception as e:
            print(f"截图失败: {e}")
        
        # 查找 Hostnames 标签
        try:
            hostname_tab = await page.query_selector('text=Hostnames')
            if hostname_tab:
                await hostname_tab.click()
                print("点击了 Hostnames 标签")
                await page.wait_for_timeout(3000)
        except Exception as e:
            print(f"点击标签失败: {e}")
        
        # 截图
        try:
            await page.screenshot(path="D:\\RMFOODFP\\cf2.png", timeout=10000)
            print("已保存 cf2.png")
        except Exception as e:
            print(f"截图失败: {e}")
        
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
                    
                    # 填写表单
                    try:
                        inputs = await page.query_selector_all("input")
                        for inp in inputs:
                            placeholder = await inp.get_attribute("placeholder")
                            if placeholder and "hostname" in placeholder.lower():
                                await inp.fill("rmfood.agnet.ltd")
                                print("已填写主机名")
                                break
                    except Exception as e:
                        print(f"填写主机名失败: {e}")
                    
                    await page.wait_for_timeout(1000)
                    
                    # 选择服务类型
                    try:
                        selects = await page.query_selector_all("select")
                        for sel in selects:
                            options = await sel.query_selector_all("option")
                            for opt in options:
                                val = await opt.get_attribute("value")
                                text = await opt.text_content()
                                if "Cloudflare Tunnel" in text or "Cloudflare Tunnel" in val:
                                    await sel.select_option(val)
                                    print("已选择 Cloudflare Tunnel")
                                    break
                    except Exception as e:
                        print(f"选择服务类型失败: {e}")
                    
                    await page.wait_for_timeout(1000)
                    
                    # 选择隧道
                    try:
                        selects = await page.query_selector_all("select")
                        for sel in selects:
                            options = await sel.query_selector_all("option")
                            for opt in options:
                                val = await opt.get_attribute("value")
                                text = await opt.text_content()
                                if "RMFOODFP" in text:
                                    await sel.select_option(val)
                                    print("已选择 RMFOODFP")
                                    break
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
        
        # 最终截图
        try:
            await page.screenshot(path="D:\\RMFOODFP\\cf_done.png", timeout=10000)
            print("已保存 cf_done.png")
        except Exception as e:
            print(f"截图失败: {e}")
        
        await browser.close()
        print("完成!")

asyncio.run(main())
