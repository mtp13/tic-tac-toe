const CACHE_NAME = "tictactoe-cache-v1";
const PRECACHE_URLS = [
  "./",
  "index.html",
  "app.js",
  "style.css",
  "reset.css",
  "manifest.webmanifest",
  "favicon.png",
  "icon-180.png",
  "icon-192.png",
  "icon-512.png",
];

if (
  typeof self !== "undefined" &&
  typeof self.addEventListener === "function"
) {
  self.addEventListener("install", (event) => {
    event.waitUntil(
      caches
        .open(CACHE_NAME)
        .then((cache) => cache.addAll(PRECACHE_URLS))
        .then(() => self.skipWaiting()),
    );
  });

  self.addEventListener("activate", (event) => {
    event.waitUntil(
      caches
        .keys()
        .then((keys) =>
          Promise.all(
            keys
              .filter((key) => key !== CACHE_NAME)
              .map((key) => caches.delete(key)),
          ),
        )
        .then(() => self.clients.claim()),
    );
  });

  self.addEventListener("fetch", (event) => {
    const { request } = event;
    if (request.method !== "GET") return;

    const url = new URL(request.url);
    if (url.origin !== self.location.origin) return;

    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.ok && response.type === "basic") {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, copy);
            });
          }
          return response;
        })
        .catch(() =>
          caches.match(request).then((cached) => {
            if (cached) return cached;
            if (request.mode === "navigate") {
              return caches.match("./") || caches.match("index.html");
            }
            return Response.error();
          }),
        ),
    );
  });
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    CACHE_NAME,
    PRECACHE_URLS,
  };
}
