/* ==================================================================================
 *  AXIO — СИСТЕМА PUSH-УВЕДОМЛЕНИЙ (v2, безопасная)
 *  Режимы, определяемые через window.isTelegramEnv():
 *    1) Обычный браузер  -> Web Push (Service Worker + VAPID), приходит даже когда
 *       сайт закрыт — доставляет бэкенд (см. backend/notify.js).
 *    2) Telegram Mini App -> сообщение от бота, отправляет тоже бэкенд.
 *
 *  ГЛАВНОЕ ОТЛИЧИЕ ОТ ПЕРВОЙ ВЕРСИИ:
 *  Токен Telegram-бота здесь БОЛЬШЕ НЕ ХРАНИТСЯ и не используется во фронтенде.
 *  Раньше он лежал в открытом JS-файле — это значит, что ЛЮБОЙ человек мог открыть
 *  DevTools/просмотр исходного кода, забрать токен и получить полный доступ к вашему
 *  боту (писать от его имени всем, читать историю и т.д.). Реальную отправку теперь
 *  делает только бэкенд (у него токен хранится в секрете, не виден пользователю).
 *
 *  ЧТО ДЕЛАЕТ ЭТОТ ФАЙЛ:
 *  - В браузере: просит разрешение на уведомления, подписывает пользователя на
 *    Web Push через Service Worker и СОХРАНЯЕТ подписку в Firestore
 *    (users/{uid}.pushSubscription). Дальше бэкенд сам шлёт пуши по расписанию.
 *  - В Telegram: сохраняет telegram chat id пользователя в Firestore
 *    (users/{uid}.telegramChatId). Дальше бэкенд сам шлёт сообщения ботом.
 *  - Пока сайт/апп открыт — дополнительно показывает уведомления локально
 *    (мгновенно, без бэкенда), чтобы не ждать следующего запуска cron-задачи.
 *
 *  КАК ПОДКЛЮЧИТЬ:
 *  1. Файлы push-notifications.js и sw-push.js лежат рядом с index.html.
 *  2. В <head> подключение уже есть (после firebase-config.js) — ничего менять не надо.
 *  3. Впиши сюда PUSH_CONFIG.VAPID_PUBLIC_KEY — публичный VAPID-ключ
 *     (как получить — см. backend/README.md, шаг 2). Это НЕ секрет, его можно
 *     держать во фронтенде.
 *  4. После того как currentUser заполнен, вызови initPushNotifications()
 *     (уже добавлено в index.html сразу после установки currentUser).
 *  5. Дай пользователю кнопку:
 *         <button onclick="requestPushPermission()">Включить уведомления</button>
 *  6. После загрузки/обновления userInventory вызывай checkExpiringProductsPush()
 *     (уже добавлено в index.html сразу после checkDailyNotifications()).
 *
 *  ⚠️ Реальные фоновые уведомления (когда сайт/апп закрыт) начнут приходить только
 *  после того как ты настроишь и запустишь бэкенд из папки backend/ — см. её README.
 * ================================================================================== */

// ---------------------------- НАСТРОЙКИ ----------------------------
const PUSH_CONFIG = {
    // Публичный VAPID-ключ (не секрет). Получить: см. backend/README.md, шаг 2.
    VAPID_PUBLIC_KEY: 'ВСТАВЬ_СЮДА_ПУБЛИЧНЫЙ_VAPID_КЛЮЧ',

    // За сколько дней до истечения срока предупреждать (используется только
    // для мгновенных локальных уведомлений, пока сайт открыт; у бэкенда — своя копия)
    NOTIFY_DAYS_BEFORE: 3,

    ICON_URL: 'icon.png',
    SW_PATH: 'sw-push.js',
};

// ---------------------------- СОСТОЯНИЕ ----------------------------
let _swRegistration = null;

// ==================================================================
//  ИНИЦИАЛИЗАЦИЯ
// ==================================================================

async function initPushNotifications() {
    if (window.isTelegramEnv && window.isTelegramEnv()) {
        console.log('[push] Telegram Mini App окружение — уведомления шлёт бэкенд через бота');
        return;
    }

    if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
        console.warn('[push] Браузер не поддерживает Web Push');
        return;
    }

    try {
        _swRegistration = await navigator.serviceWorker.register(PUSH_CONFIG.SW_PATH);
        console.log('[push] Service worker зарегистрирован');

        // Если разрешение уже когда-то дали — тихо восстанавливаем/обновляем подписку,
        // чтобы Firestore всегда содержал актуальную. Если ещё не спрашивали — не спрашиваем
        // автоматически (браузеры это не любят). Спроси через requestPushPermission() по клику.
        if (Notification.permission === 'granted') {
            await subscribeWebPush();
        }
    } catch (err) {
        console.error('[push] Не удалось зарегистрировать service worker:', err);
    }
}

/**
 * Повесь на кнопку "Включить уведомления". Должна вызываться по клику пользователя.
 */
async function requestPushPermission() {
    if (window.isTelegramEnv && window.isTelegramEnv()) {
        const ok = await saveTelegramChatId();
        if (typeof showToast === 'function') {
            showToast(ok ? '🔔 Уведомления включены' : 'Не удалось включить уведомления', ok ? 'success' : 'error');
        } else {
            alert(ok ? 'Уведомления включены!' : 'Не удалось включить уведомления.');
        }
        return ok;
    }

    if (!('Notification' in window)) {
        alert('Этот браузер не поддерживает уведомления.');
        return false;
    }

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return false;

    const subscribed = await subscribeWebPush();
    if (subscribed) {
        showBrowserNotification('🔔 Уведомления включены', {
            body: 'Мы будем сообщать, когда продукты начнут портиться.',
        });
    }
    return subscribed;
}

// ==================================================================
//  WEB PUSH: ПОДПИСКА + СОХРАНЕНИЕ В FIRESTORE
// ==================================================================

function _urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i);
    return outputArray;
}

async function subscribeWebPush() {
    if (!_swRegistration || !PUSH_CONFIG.VAPID_PUBLIC_KEY || PUSH_CONFIG.VAPID_PUBLIC_KEY.startsWith('ВСТАВЬ')) {
        console.warn('[push] VAPID_PUBLIC_KEY не задан — сначала сгенерируй ключи (см. backend/README.md)');
        return false;
    }

    try {
        let subscription = await _swRegistration.pushManager.getSubscription();
        if (!subscription) {
            subscription = await _swRegistration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: _urlBase64ToUint8Array(PUSH_CONFIG.VAPID_PUBLIC_KEY),
            });
        }
        await _saveSubscriptionToFirestore(subscription.toJSON());
        return true;
    } catch (err) {
        console.error('[push] Ошибка подписки на Web Push:', err);
        return false;
    }
}

async function _saveSubscriptionToFirestore(subscriptionJson) {
    if (typeof db === 'undefined' || typeof currentUser === 'undefined' || !currentUser) return false;
    try {
        await db.collection(typeof USER_COLLECTION !== 'undefined' ? USER_COLLECTION : 'users')
            .doc(currentUser.uid)
            .set({ pushSubscription: subscriptionJson }, { merge: true });
        return true;
    } catch (err) {
        console.error('[push] Не удалось сохранить подписку в Firestore:', err);
        return false;
    }
}

// ==================================================================
//  TELEGRAM: СОХРАНЕНИЕ CHAT ID (отправку делает бэкенд)
// ==================================================================

function getTelegramChatId() {
    try {
        return window.Telegram?.WebApp?.initDataUnsafe?.user?.id || null;
    } catch {
        return null;
    }
}

async function saveTelegramChatId() {
    const chatId = getTelegramChatId();
    if (!chatId) {
        console.warn('[push] Не удалось получить Telegram chat id пользователя');
        return false;
    }
    if (typeof db === 'undefined' || typeof currentUser === 'undefined' || !currentUser) return false;

    try {
        await db.collection(typeof USER_COLLECTION !== 'undefined' ? USER_COLLECTION : 'users')
            .doc(currentUser.uid)
            .set({ telegramChatId: chatId }, { merge: true });
        return true;
    } catch (err) {
        console.error('[push] Не удалось сохранить telegram chat id:', err);
        return false;
    }
}

// ==================================================================
//  ЛОКАЛЬНЫЙ БРАУЗЕРНЫЙ NOTIFICATION (мгновенно, только пока вкладка открыта)
// ==================================================================

async function showBrowserNotification(title, options = {}) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return false;

    const finalOptions = { icon: PUSH_CONFIG.ICON_URL, badge: PUSH_CONFIG.ICON_URL, ...options };

    try {
        if (_swRegistration) {
            await _swRegistration.showNotification(title, finalOptions);
        } else {
            new Notification(title, finalOptions);
        }
        return true;
    } catch (err) {
        console.error('[push] Ошибка показа браузерного уведомления:', err);
        return false;
    }
}

/**
 * Единая точка входа для МГНОВЕННЫХ уведомлений, пока сайт/апп открыт.
 * В Telegram — просто тост внутри приложения (реальное сообщение в чат с ботом
 * присылает бэкенд по расписанию, см. backend/notify.js).
 */
async function sendPush(title, body) {
    if (window.isTelegramEnv && window.isTelegramEnv()) {
        if (typeof showToast === 'function') showToast(`${title}: ${body}`, 'info');
        return true;
    }
    return showBrowserNotification(title, { body });
}

// ==================================================================
//  ЛОГИКА: "ПРОДУКТ СКОРО ИСПОРТИТСЯ" (мгновенная проверка, пока апп открыт)
// ==================================================================

function _pushNotifiedStorageKey() {
    const uid = (typeof currentUser !== 'undefined' && currentUser && currentUser.uid) ? currentUser.uid : 'anon';
    const day = (typeof getLocalDateString === 'function') ? getLocalDateString() : new Date().toISOString().split('T')[0];
    return `axio_push_notified_${uid}_${day}`;
}

function _getAlreadyNotifiedIds() {
    try {
        return JSON.parse(localStorage.getItem(_pushNotifiedStorageKey())) || [];
    } catch {
        return [];
    }
}

function _markAsNotified(ids) {
    const current = _getAlreadyNotifiedIds();
    const merged = Array.from(new Set([...current, ...ids]));
    localStorage.setItem(_pushNotifiedStorageKey(), JSON.stringify(merged));
}

async function checkExpiringProductsPush() {
    if (typeof userInventory === 'undefined' || !Array.isArray(userInventory)) return;

    const already = _getAlreadyNotifiedIds();

    const daysUntil = (dateStr) => {
        if (typeof getDaysUntilExpiry === 'function') return getDaysUntilExpiry(dateStr);
        const today = new Date(); const expiry = new Date(dateStr);
        today.setHours(0, 0, 0, 0); expiry.setHours(0, 0, 0, 0);
        return Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
    };

    const toNotify = userInventory.filter(p => {
        if (already.includes(p.id)) return false;
        const d = daysUntil(p.expiryDate);
        return d <= PUSH_CONFIG.NOTIFY_DAYS_BEFORE;
    });

    if (!toNotify.length) return;

    const expired = toNotify.filter(p => daysUntil(p.expiryDate) < 0);
    const today = toNotify.filter(p => daysUntil(p.expiryDate) === 0);
    const soon = toNotify.filter(p => {
        const d = daysUntil(p.expiryDate);
        return d > 0 && d <= PUSH_CONFIG.NOTIFY_DAYS_BEFORE;
    });

    if (expired.length) {
        const names = expired.map(p => p.name).slice(0, 5).join(', ');
        await sendPush('☠️ Продукты испортились', `${names}${expired.length > 5 ? ` и ещё ${expired.length - 5}` : ''}`);
    }
    if (today.length) {
        const names = today.map(p => p.name).slice(0, 5).join(', ');
        await sendPush('⚠️ Портятся сегодня', `${names}${today.length > 5 ? ` и ещё ${today.length - 5}` : ''}`);
    }
    if (soon.length) {
        const names = soon.map(p => p.name).slice(0, 5).join(', ');
        await sendPush('⏰ Скоро испортятся', `${names}${soon.length > 5 ? ` и ещё ${soon.length - 5}` : ''}`);
    }

    _markAsNotified(toNotify.map(p => p.id));
}

// Периодическая проверка, пока сайт/апп открыты (раз в час).
setInterval(() => {
    if (typeof checkExpiringProductsPush === 'function') checkExpiringProductsPush();
}, 60 * 60 * 1000);
