self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
});

/*
 * ГЛАВНОЕ ДОБАВЛЕНИЕ: обработчик 'push'.
 * Без него Service Worker умеет показывать уведомления только по команде
 * из уже открытой вкладки (showNotification), но не может получить и показать
 * push, присланный сервером, пока сайт закрыт. Именно этот обработчик и есть
 * "настоящий фоновый пуш".
 */
self.addEventListener('push', (event) => {
    let payload = { title: 'Axio', body: '' };
    try {
        if (event.data) payload = event.data.json();
    } catch {
        if (event.data) payload.body = event.data.text();
    }

    const title = payload.title || 'Axio';
    const options = {
        body: payload.body || '',
        icon: payload.icon || 'icon.png',
        badge: payload.badge || 'icon.png',
        data: { url: payload.url || '/' },
    };

    event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const targetUrl = (event.notification.data && event.notification.data.url) || '/';
    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientsArr) => {
            const existing = clientsArr.find((c) => 'focus' in c);
            if (existing) return existing.focus();
            return self.clients.openWindow(targetUrl);
        })
    );
});
