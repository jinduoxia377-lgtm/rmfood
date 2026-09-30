import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        # 连接到已有 Chrome
        browser = await p.chromium.connect_over_cdp("http://localhost:9333")
        print("已连接到 Chrome")
        
        # 获取上下文
        contexts = browser.contexts
        print(f"上下文数量: {len(contexts)}")
        
        # 找到 Cloudflare 页面
        page = None
        for ctx in contexts:
            for pg in ctx.pages:
                if "cloudflare" in pg.url.lower():
                    page = pg
                    break
            if page:
                break
        
        if not page:
            print("未找到 Cloudflare 页面，创建新页面...")
            context = await browser.new_context()
            page = await context.new_page()
        
        print(f"当前 URL: {page.url}")
        
        # 导航到隧道详情
        url = "https://one.dash.cloudflare.com/52d90e4fd33c3bfd600a44968d00a491/tunnels/8828e1ef-8ae3-40f1-80ac-6602d941735f/hostnames"
        print(f"导航到: {url}")
        await page.goto(url, wait_until="networkidle", timeout=60000)
        
        print(f"当前 URL: {page.url}")
        
        # 截图
        await page.screenshot(path="D:/RMFOODFP/cf_py1.png", timeout=10000)
        print("已保存 cf_py1.png")
        
        # 等待页面加载
        await page.wait_for_timeout(3000)
        
        # 获取页面内容
        content = await page.evaluate("() => document.body.innerText")
        print(f"页面内容 (前 500 字符): {content[:500]}")
        
        await browser.close()

asyncio.run(main())
