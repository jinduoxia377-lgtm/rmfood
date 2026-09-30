import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.connect_over_cdp("http://localhost:9333")
        print("Connected to Chrome")
        
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
        
        print(f"URL: {page.url}")
        
        # Go to tunnels page
        await page.goto("https://one.dash.cloudflare.com/52d90e4fd33c3bfd600a44968d00a491/tunnels", wait_until="domcontentloaded")
        await page.wait_for_timeout(3000)
        print(f"URL: {page.url}")
        
        # Click on RMFOODFP tunnel
        elements = await page.query_selector_all("[class*='tunnel'], [class*='Tunnel']")
        for el in elements:
            text = await el.text_content()
            if "RMFOODFP" in text:
                await el.click()
                print("Clicked RMFOODFP")
                await page.wait_for_timeout(2000)
                break
        
        # Take screenshot
        await page.screenshot(path="D:/RMFOODFP/cf_s1.png")
        print("Saved cf_s1.png")
        
        # Click Hostnames tab
        tabs = await page.query_selector_all("[role='tab'], button")
        for tab in tabs:
            text = await tab.text_content()
            if "Hostnames" in text or "主机名" in text:
                await tab.click()
                print("Clicked Hostnames")
                await page.wait_for_timeout(2000)
                break
        
        await page.screenshot(path="D:/RMFOODFP/cf_s2.png")
        print("Saved cf_s2.png")
        
        # Check if hostname exists
        content = await page.content()
        if "rmfood.agnet.ltd" in content:
            print("Hostname already exists!")
        else:
            print("Adding hostname...")
            # Find and click Add button
            buttons = await page.query_selector_all("button")
            for btn in buttons:
                text = await btn.text_content()
                if "Add" in text or "添加" in text:
                    await btn.click()
                    print("Clicked Add")
                    await page.wait_for_timeout(2000)
                    break
            
            # Fill hostname
            inputs = await page.query_selector_all("input")
            for inp in inputs:
                placeholder = await inp.get_attribute("placeholder") or ""
                if "hostname" in placeholder.lower():
                    await inp.fill("rmfood.agnet.ltd")
                    print("Filled hostname")
                    break
            
            await page.wait_for_timeout(1000)
            
            # Select Cloudflare Tunnel
            selects = await page.query_selector_all("select")
            for sel in selects:
                options = await sel.query_selector_all("option")
                for opt in options:
                    val = await opt.get_attribute("value") or ""
                    txt = await opt.text_content() or ""
                    if "Cloudflare" in txt or "Tunnel" in txt:
                        await sel.select_option(val)
                        print("Selected Cloudflare Tunnel")
                        break
            
            await page.wait_for_timeout(1000)
            
            # Select RMFOODFP tunnel
            for sel in selects:
                options = await sel.query_selector_all("option")
                for opt in options:
                    txt = await opt.text_content() or ""
                    if "RMFOODFP" in txt:
                        val = await opt.get_attribute("value") or txt
                        await sel.select_option(val)
                        print("Selected RMFOODFP")
                        break
            
            await page.wait_for_timeout(1000)
            
            # Click Save
            for btn in buttons:
                text = await btn.text_content()
                if "Save" in text or "保存" in text:
                    await btn.click()
                    print("Clicked Save")
                    await page.wait_for_timeout(3000)
                    break
        
        await page.screenshot(path="D:/RMFOODFP/cf_done.png")
        print("Saved cf_done.png")
        await browser.close()

asyncio.run(main())
