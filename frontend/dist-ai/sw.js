const CACHE_VERSION = 'v1';
const STATIC_CACHE = `rmfood-static-${CACHE_VERSION}`;
const API_CACHE = `rmfood-api-${CACHE_VERSION}`;
const ASSETS_CACHE = `rmfood-assets-${CACHE_VERSION}`;
const IMAGE_CACHE = `rmfood-images-${CACHE_VERSION}`;

const CACHE_STRATEGIES = {
  static: 'CacheFirst',
  api: 'NetworkFirst',
  assets: 'StaleWhileRevalidate',
  images: 'CacheFirstWithRefresh',
};

const TTL_CONFIG = {
  static: 30 * 24 * 60 * 60 * 1000,
  api: {
    default: 5 * 60 * 1000,
    '/api/formulas': 10 * 60 * 1000,
    '/api/ai/chat': 0,
    '/api/ai/generate': 0,
    '/api/dashboard': 2 * 60 * 1000,
    '/api/database': 30 * 60 * 1000,
  },
  assets: 7 * 24 * 60 * 60 * 1000,
  images: 7 * 24 * 60 * 60 * 1000,
};

const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(PRECACHE_URLS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name.startsWith('rmfood-') && !name.includes(CACHE_VERSION))
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;

  if (isAPIRequest(url)) {
    event.respondWith(handleAPIRequest(request));
    return;
  }

  if (isImageRequest(url)) {
    event.respondWith(handleImageRequest(request));
    return;
  }

  if (isStaticAsset(url)) {
    event.respondWith(handleAssetRequest(request));
    return;
  }

  if (isNavigationRequest(request)) {
    event.respondWith(handleNavigationRequest(request));
    return;
  }
});

function isAPIRequest(url: URL): boolean {
  return url.pathname.startsWith('/api/');
}

function isImageRequest(url: URL): boolean {
  return /\.(jpg|jpeg|png|gif|webp|svg|avif)(\?|$)/i.test(url.pathname);
}

function isStaticAsset(url: URL): boolean {
  return /\.(js|css|woff2?|ttf|eot)(\?|$)/i.test(url.pathname);
}

function isNavigationRequest(request: Request): boolean {
  return request.mode === 'navigate';
}

async function handleAPIRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const ttl = getAPITTL(url.pathname);

  if (ttl === 0) {
    return fetchAndCache(request, API_CACHE, false);
  }

  const cachedResponse = await getCachedResponse(API_CACHE, request, ttl);
  if (cachedResponse) {
    fetchAndCache(request, API_CACHE, true).catch(() => {});
    return cachedResponse;
  }

  try {
    return await fetchAndCache(request, API_CACHE, true);
  } catch (error) {
    const fallbackResponse = await getOfflineFallback('/api');
    if (fallbackResponse) return fallbackResponse;
    throw error;
  }
}

async function handleImageRequest(request: Request): Promise<Response> {
  try {
    const cachedResponse = await matchCache(IMAGE_CACHE, request);
    if (cachedResponse) {
      refreshCacheInBackground(request, IMAGE_CACHE);
      return cachedResponse;
    }

    const response = await fetchAndCache(request, IMAGE_CACHE, true);
    return addBlurHashPlaceholder(response);
  } catch (error) {
    const cachedResponse = await matchCache(IMAGE_CACHE, request);
    if (cachedResponse) return cachedResponse;

    const fallbackResponse = await getOfflineFallback('/images');
    return fallbackResponse || createFallbackImageResponse();
  }
}

async function handleAssetRequest(request: Response | Request): Promise<Response> {
  const cache = await caches.open(ASSETS_CACHE);
  const cachedResponse = await cache.match(request as Request);

  if (cachedResponse) {
    const networkPromise = fetch(request as Request)
      .then((response) => {
        if (response.ok) {
          cache.put(request as Request, response.clone());
        }
        return response;
      })
      .catch(() => cachedResponse);

    return networkPromise;
  }

  try {
    const response = await fetch(request as Request);
    if (response.ok) {
      cache.put(request as Request, response.clone());
    }
    return response;
  } catch (error) {
    if (cachedResponse) return cachedResponse;
    throw error;
  }
}

async function handleNavigationRequest(request: Request): Promise<Response> {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) return cachedResponse;

    const fallbackHtml = `
      <!DOCTYPE html>
      <html lang="zh-CN">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>RMFOOD - 离线模式</title>
        <style>
          body { font-family: system-ui; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #0f172a; color: #e2e8f0; }
          .container { text-align: center; padding: 40px; max-width: 500px; }
          h1 { color: #38bdf8; margin-bottom: 16px; }
          p { line-height: 1.6; margin-bottom: 24px; opacity: 0.8; }
          button { background: #3b82f6; color: white; border: none; padding: 12px 32px; border-radius: 8px; cursor: pointer; font-size: 16px; }
          button:hover { background: #2563eb; }
          .icon { font-size: 64px; margin-bottom: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="icon">📡</div>
          <h1>您当前处于离线状态</h1>
          <p>RMFOOD 配方平台需要网络连接才能正常使用。请检查您的网络连接后重试。</p>
          <button onclick="window.location.reload()">重新连接</button>
        </div>
        <script>
          window.addEventListener('online', () => window.location.reload());
        </script>
      </body>
      </html>
    `;
    return new Response(fallbackHtml, {
      status: 503,
      headers: { 'Content-Type': 'text/html' },
    });
  }
}

function getAPITTL(pathname: string): number {
  for (const [pattern, ttl] of Object.entries(TTL_CONFIG.api)) {
    if (pattern !== 'default' && pathname.startsWith(pattern)) {
      return ttl;
    }
  }
  return TTL_CONFIG.api.default;
}

async function fetchAndCache(
  request: Request,
  cacheName: string,
  shouldCache: boolean
): Promise<Response> {
  const response = await fetch(request);

  if (shouldCache && response.ok) {
    const cache = await caches.open(cacheName);
    const clonedResponse = response.clone();

    const responseToCache = new Response(clonedResponse.body, {
      headers: {
        ...Object.fromEntries(clonedResponse.headers),
        'X-Cache-Timestamp': Date.now().toString(),
        'X-Cache-Strategy': CACHE_STRATEGIES[cacheName.split('-')[1] as keyof typeof CACHE_STRATEGIES] || 'default',
      },
    });

    cache.put(request, responseToCache);
  }

  return response;
}

async function getCachedResponse(
  cacheName: string,
  request: Request,
  ttl: number
): Promise<Response | null> {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);

  if (!cachedResponse) return null;

  const timestamp = parseInt(cachedResponse.headers.get('X-Cache-Timestamp') || '0');
  const age = Date.now() - timestamp;

  if (age > ttl) {
    return null;
  }

  return cachedResponse;
}

async function matchCache(cacheName: string, request: Request): Promise<Response | null> {
  const cache = await caches.open(cacheName);
  return cache.match(request);
}

async function refreshCacheInBackground(request: Request, cacheName: string): Promise<void> {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response);
    }
  } catch (error) {
    console.warn('[SW] Background refresh failed:', error);
  }
}

async function getOfflineFallback(type: string): Promise<Response | null> {
  const cache = await caches.open(STATIC_CACHE);
  const fallbackUrls: Record<string, string> = {
    '/api': '/offline-api.json',
    '/images': '/offline-image.svg',
  };

  return cache.match(fallbackUrls[type] || '/offline.html');
}

async function addBlurHashPlaceholder(response: Response): Promise<Response> {
  const contentType = response.headers.get('Content-Type');

  if (!contentType?.startsWith('image/')) {
    return response;
  }

  const blob = await response.blob();
  const placeholderUrl = generateBlurHashPlaceholder(blob);

  const modifiedResponse = new Response(blob, {
    status: response.status,
    statusText: response.statusText,
    headers: {
      ...Object.fromEntries(response.headers),
      'X-BlurHash-URL': placeholderUrl,
    },
  });

  return modifiedResponse;
}

function generateBlurHashPlaceholder(blob: Blob): string {
  const canvas = new OffscreenCanvas(4, 4);
  const ctx = canvas.getContext('2d');

  if (!ctx) return '';

  const img = new Image();
  const url = URL.createObjectURL(blob);

  return new Promise<string>((resolve) => {
    img.onload = () => {
      ctx.drawImage(img, 0, 0, 4, 4);
      const imageData = ctx.getImageData(0, 0, 4, 4);
      const blurHash = encodeSimpleBlurHash(imageData.data);
      URL.revokeObjectURL(url);
      resolve(blurHash);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve('');
    };
    img.src = url;
  }) as unknown as string;
}

function encodeSimpleBlurHash(pixels: Uint8ClampedArray): string {
  const dc = pixels.slice(0, 4).reduce((sum, val) => sum + val, 0) / 4;
  const hash = Math.round(dc).toString(16).padStart(2, '0').repeat(2);
  return hash;
}

function createFallbackImageResponse(): Response {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
    <rect fill="#334155" width="200" height="200"/>
    <text fill="#94a3b8" font-family="system-ui" font-size="14" x="100" y="100" text-anchor="middle" dominant-baseline="middle">
      Image unavailable
    </text>
  </svg>`;

  return new Response(svg, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'X-Offline-Fallback': 'true',
    },
  });
}

declare global {
  interface Window {
    __SERVICE_WORKER_INSTALLED__?: boolean;
  }
}