/**
 * WeatherGPT — Service Worker
 * Provides offline caching, network-first API caching, and PWA capabilities.
 */

const CACHE_NAME = 'weathergpt-shell-v11';
const API_CACHE_NAME = 'weathergpt-api-v11';

const STATIC_ASSETS = [
    '/',
    '/manifest.json',
    '/css/style.css',
    '/js/app.js',
    '/js/chat.js',
    '/assets/icon-192.png',
    '/assets/icon-512.png',
    '/assets/icon-maskable-512.png',
    '/assets/apple-touch-icon.png',
    '/assets/favicon.png',
    'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap'
];

// ── Install: Pre-cache App Shell ────────────────────────────────
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(async (cache) => {
            // Cache local shell assets; handle failures gracefully
            for (const asset of STATIC_ASSETS) {
                try {
                    await cache.add(asset);
                } catch (err) {
                    console.warn(`[SW] Pre-cache skipped for ${asset}:`, err);
                }
            }
        }).then(() => self.skipWaiting())
    );
});

// ── Activate: Clean up Outdated Caches ─────────────────────────
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.map((key) => {
                    if (key !== CACHE_NAME && key !== API_CACHE_NAME) {
                        console.log('[SW] Removing old cache:', key);
                        return caches.delete(key);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// ── Fetch: Cache Strategy ──────────────────────────────────────
self.addEventListener('fetch', (event) => {
    const request = event.request;
    const url = new URL(request.url);

    // Only handle GET requests
    if (request.method !== 'GET') return;

    // 1. Navigation requests (HTML document)
    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request)
                .catch(async () => {
                    const cache = await caches.open(CACHE_NAME);
                    return await cache.match('/') || await cache.match('/index.html');
                })
        );
        return;
    }

    // 2. Weather & Forecast API requests -> Network First with Cache Fallback
    if (url.pathname.startsWith('/api/weather') || url.pathname.startsWith('/api/nwp') || url.pathname.startsWith('/api/alerts')) {
        event.respondWith(
            fetch(request)
                .then(async (response) => {
                    if (response && response.status === 200) {
                        const cache = await caches.open(API_CACHE_NAME);
                        cache.put(request, response.clone());
                    }
                    return response;
                })
                .catch(async () => {
                    const cache = await caches.open(API_CACHE_NAME);
                    const cachedResponse = await cache.match(request);
                    if (cachedResponse) {
                        return cachedResponse;
                    }
                    return new Response(JSON.stringify({
                        offline: true,
                        message: "Device is currently offline. Showing latest cached forecast if available."
                    }), {
                        headers: { 'Content-Type': 'application/json' }
                    });
                })
        );
        return;
    }

    // 3. Static Shell Assets (JS, CSS, Images, Fonts) -> Stale While Revalidate
    event.respondWith(
        caches.match(request).then(async (cachedResponse) => {
            const fetchPromise = fetch(request).then(async (networkResponse) => {
                if (networkResponse && networkResponse.status === 200) {
                    const cache = await caches.open(CACHE_NAME);
                    cache.put(request, networkResponse.clone());
                }
                return networkResponse;
            }).catch(() => null);

            return cachedResponse || await fetchPromise;
        })
    );
});
