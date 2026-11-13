const CACHE_NAME = 'sara-foto-facil-v2';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './style.css?v=2',
  './app.js?v=2',
  './manifest.json',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',
  'https://cdn.jsdelivr.net/npm/heic2any@0.0.4/dist/heic2any.min.js'
];

// Instalação: ativa imediatamente sem esperar fechar todas as abas
self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Sara Foto Fácil: Atualizando cache para versão 2...');
      return cache.addAll(ASSETS_TO_CACHE).catch(err => {
        console.warn('Cache parcial de arquivos externos:', err);
      });
    })
  );
});

// Ativação: apaga imediatamente caches antigos (v1)
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(
        keyList.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('Sara Foto Fácil: Apagando versão antiga do cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Estratégia inteligente: Network First (Tenta pegar a versão nova da internet primeiro)
// Se estiver sem internet, usa a versão guardada no cache!
self.addEventListener('fetch', (e) => {
  // Para requisições da página (HTML/navegação), sempre busca a versão mais recente da rede
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request)
        .then((networkResponse) => {
          return caches.open(CACHE_NAME).then((cache) => {
            cache.put(e.request, networkResponse.clone());
            return networkResponse;
          });
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // Para outros arquivos: tenta rede primeiro, fallback para cache
  e.respondWith(
    fetch(e.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const resClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, resClone));
        }
        return networkResponse;
      })
      .catch(() => caches.match(e.request))
  );
});
