const CACHE_NAME = 'youtube-radio-v2';
const urlsToCache = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
  );
  self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => response || fetch(event.request))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Background Sync - مزامنة في الخلفية
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-queue') {
    event.waitUntil(syncQueue());
  }
});

async function syncQueue() {
  console.log('مزامنة القائمة في الخلفية');
  // يمكن إضافة منطق المزامنة هنا
}

// Push Notifications - إشعارات الدفع
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'راديو يوتيوب';
  const options = {
    body: data.body || 'أغنية جديدة في القائمة',
    icon: '/manifest.json',
    badge: '/manifest.json',
    vibrate: [200, 100, 200],
    data: data,
    actions: [
      { action: 'open', title: 'فتح' },
      { action: 'close', title: 'إغلاق' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'open') {
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

// Periodic Background Sync - مزامنة دورية
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'update-queue') {
    event.waitUntil(updateQueue());
  }
});

async function updateQueue() {
  console.log('تحديث القائمة دورياً');
  // يمكن إضافة منطق التحديث هنا
}

console.log('Service Worker جاهز مع دعم التشغيل في الخلفية');
