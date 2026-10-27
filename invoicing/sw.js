const CACHE_NAME = 'betadeck-invoice-v2';
const urlsToCache = [
    '/invoicing/',
    '/invoicing/index.php',
    '/invoicing/login.php',
    '/invoicing/create.php',
    '/invoicing/view.php',
    '/invoicing/send.php',
    '/invoicing/manage.php',
    '/invoicing/services.json',
    '/invoicing/clients.json',
    '/invoicing/exchange_rates.json',
    '/invoicing/manifest.json',
    'https://codemathphp.co.za/assets/logo.png'
];

// Install event - cache resources
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Opened cache');
                return cache.addAll(urlsToCache);
            })
    );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
    // Skip non-GET requests
    if (event.request.method !== 'GET') {
        return;
    }

    // Skip external requests except logo
    const url = new URL(event.request.url);
    if (url.origin !== location.origin && !url.href.includes('betadeck.co.za/logo.png')) {
        return;
    }

    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                // Return cached version or fetch from network
                return response || fetch(event.request).then((response) => {
                    // Don't cache if not a valid response
                    if (!response || response.status !== 200 || response.type !== 'basic') {
                        return response;
                    }

                    // Clone the response
                    const responseToCache = response.clone();

                    caches.open(CACHE_NAME)
                        .then((cache) => {
                            cache.put(event.request, responseToCache);
                        });

                    return response;
                });
            })
                .catch(() => {
                // If both cache and network fail, return offline page if available
                if (event.request.destination === 'document') {
                    return caches.match('/invoicing/index.php');
                }
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    const cacheWhitelist = [CACHE_NAME];
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheWhitelist.indexOf(cacheName) === -1) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});

