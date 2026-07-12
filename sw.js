const CACHE_NAME = "galimplant-cache-v42";
const ASSETS = [
  "./index.html",
  "./recovery.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-192-maskable.png",
  "./icon-512-maskable.png",
  "./jspdf.umd.min.js",
  "./jspdf.plugin.autotable.min.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.allSettled(
        ASSETS.map((url) =>
          cache.add(url).catch((err) => {
            console.warn("[SW] Falha ao pré-cachear:", url, err);
            return null;
          })
        )
      )
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  if (!event.request.url.startsWith("http")) return;

  if (event.request.mode === "navigate") {
    // O fallback offline deve corresponder à página pedida: se for recovery.html
    // que falha, cair para recovery.html (não para index.html, que era o bug anterior).
    const fallbackUrl = event.request.url.includes("recovery.html")
      ? "./recovery.html"
      : "./index.html";
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return response;
        })
        .catch(() =>
          caches.match(event.request).then((c) => c || caches.match(fallbackUrl))
        )
    );
    return;
  }

  // Restantes pedidos GET (assets, scripts, etc.): cache-first com atualização em segundo plano.
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetchPromise = fetch(event.request)
        .then((response) => {
          if (response && response.status === 200 && response.type === "basic") {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
