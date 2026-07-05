const APP_CACHE = "fewo-app-v1";
const API_CACHE = "fewo-api-v1";

const APP_SHELL = [
    "./",
    "./index.html",
    "./offline.html",
    "./manifest.webmanifest",
    "./assets/styles.css",
    "./assets/icons/icon-192.svg",
    "./assets/icons/icon-512.svg",
    "./js/main.js",
    "./js/api.js",
    "./js/googleAuth.js",
    "./js/config.js",
    "./js/router.js",
    "./js/state.js",
    "./js/views/dashboard.js",
    "./js/views/expenses.js",
    "./js/views/bookings.js",
    "./js/views/reports.js",
    "./js/utils/format.js",
];

self.addEventListener("install", (event) => {
    event.waitUntil(caches.open(APP_CACHE).then((cache) => cache.addAll(APP_SHELL)));
    self.skipWaiting();
});

self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(
                keys
                    .filter((key) => ![APP_CACHE, API_CACHE].includes(key))
                    .map((key) => caches.delete(key)),
            ),
        ),
    );
    self.clients.claim();
});

self.addEventListener("fetch", (event) => {
    const { request } = event;
    const url = new URL(request.url);

    if (request.method === "GET" && url.origin !== self.location.origin) {
        event.respondWith(networkFirstApi(request));
        return;
    }

    if (request.mode === "navigate") {
        event.respondWith(
            fetch(request).catch(() => caches.match("./offline.html")),
        );
        return;
    }

    event.respondWith(
        caches.match(request).then((cached) => cached || fetch(request)),
    );
});

async function networkFirstApi(request) {
    const cache = await caches.open(API_CACHE);
    try {
        const response = await fetch(request);
        if (response.ok) {
            cache.put(request, response.clone());
        }
        return response;
    } catch {
        const cached = await cache.match(request);
        if (cached) return cached;
        return new Response(JSON.stringify({ error: "Offline und keine Cache-Daten vorhanden." }), {
            status: 503,
            headers: { "Content-Type": "application/json" },
        });
    }
}
