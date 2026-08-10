const CACHE = "brujula-shell-v3";
const SHELL = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/icons/brujula.svg",
];

async function cachearAplicacionCompleta() {
  const cache = await caches.open(CACHE);
  const index = await fetch("/index.html", { cache: "no-store" });
  if (!index.ok) throw new Error("No se pudo preparar la aplicación offline.");

  const html = await index.clone().text();
  const recursos = [...html.matchAll(/(?:src|href)=["']([^"']+)["']/g)]
    .map((coincidencia) => new URL(coincidencia[1], self.location.origin))
    .filter(
      (url) =>
        url.origin === self.location.origin && !url.pathname.startsWith("/api/"),
    )
    .map((url) => `${url.pathname}${url.search}`);

  await Promise.all([
    cache.put("/", index.clone()),
    cache.put("/index.html", index.clone()),
    cache.addAll([...new Set([...SHELL.slice(2), ...recursos])]),
  ]);
}

self.addEventListener("install", (event) => {
  event.waitUntil(cachearAplicacionCompleta());
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)),
        ),
      ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET" || event.request.url.includes("/api/"))
    return;
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put("/index.html", copy));
          return response;
        })
        .catch(() => caches.match("/index.html")),
    );
    return;
  }
  event.respondWith(
    caches.match(event.request).then(
      (cached) =>
        cached ||
        fetch(event.request).then((response) => {
          if (
            response.ok &&
            new URL(event.request.url).origin === self.location.origin
          ) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(event.request, copy));
          }
          return response;
        }),
    ),
  );
});
