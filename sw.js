/* Amor Koala: guarda la app en el celu para que abra rápido y sin internet. */
const VERSION = 'ak-v1';
const BASICOS = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png'];
const LIBRERIAS = [
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',
  'https://cdn.jsdelivr.net/npm/@zxing/library@0.21.3/umd/index.min.js'
];
const EXTERNOS = /^(cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net|fonts\.googleapis\.com|fonts\.gstatic\.com)$/;

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(VERSION);
    await c.addAll(BASICOS);
    await Promise.allSettled(LIBRERIAS.map(async u => { const r = await fetch(u, {mode: 'no-cors'}); await c.put(u, r); }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('ak-') && k !== VERSION) await caches.delete(k);
    await self.clients.claim();
  })());
});

function conTiempo(promesa, ms) {
  return new Promise((ok, mal) => { const t = setTimeout(() => mal(new Error('tiempo')), ms); promesa.then(r => { clearTimeout(t); ok(r); }, e => { clearTimeout(t); mal(e); }); });
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) {
    /* La app: primero internet (para tener siempre la última versión); si no hay, la guardada. */
    e.respondWith((async () => {
      const c = await caches.open(VERSION);
      try {
        const r = await conTiempo(fetch(req), 4000);
        if (r && r.ok) c.put(req, r.clone());
        return r;
      } catch (err) {
        return (await c.match(req, {ignoreSearch: true})) || (req.mode === 'navigate' ? await c.match('./index.html') : Response.error());
      }
    })());
    return;
  }
  if (EXTERNOS.test(url.hostname)) {
    /* Librerías y letras: las guardadas primero (no cambian). */
    e.respondWith((async () => {
      const c = await caches.open(VERSION);
      const g = await c.match(req);
      if (g) return g;
      const r = await fetch(req);
      if (r && (r.ok || r.type === 'opaque')) c.put(req, r.clone());
      return r;
    })());
  }
});
