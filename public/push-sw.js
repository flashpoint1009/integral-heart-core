// Dedicated messaging service worker — push notifications only.
// Per PWA guidance: this is a messaging worker (not app-shell), so it is exempt
// from preview/iframe registration guards.

self.addEventListener('install', (e) => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let payload = { title: 'إشعار جديد', body: '', link: '/' };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch (_) {
    if (event.data) payload.body = event.data.text();
  }

  const options = {
    body: payload.body,
    icon: '/icon-512.png',
    badge: '/icon-512.png',
    dir: 'auto',
    lang: 'ar',
    vibrate: [200, 100, 200],
    requireInteraction: false,
    tag: payload.type || 'notif',
    renotify: true,
    data: { link: payload.link || '/' },
  };

  event.waitUntil(self.registration.showNotification(payload.title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const link = (event.notification.data && event.notification.data.link) || '/';
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const existing = all.find((c) => 'focus' in c);
      if (existing) {
        await existing.focus();
        existing.navigate(link).catch(() => {});
      } else if (self.clients.openWindow) {
        await self.clients.openWindow(link);
      }
    })(),
  );
});