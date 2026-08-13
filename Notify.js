/* ==================================================================================
 *  AXIO — БЭКЕНД РАССЫЛКИ (v2, привязан к колокольчику уведомлений)
 *
 *  Что делает:
 *   1. Подключается к Firestore через Firebase Admin SDK (сервисный аккаунт).
 *   2. Проходит по коллекции `axioUsers`. У каждого пользователя смотрит поле
 *      `notifications` — это тот же массив, что рисуется в колокольчике в приложении.
 *   3. Сравнивает его с `pushSentIds` (список id, которые уже отправляли раньше —
 *      этот скрипт сам его создаёт и обновляет в документе пользователя).
 *   4. Всё, что новое — шлёт как Telegram-сообщение (если есть telegramChatId)
 *      и/или Web Push (если есть pushSubscription).
 *
 *  Запускается по расписанию через .github/workflows/notify.yml — раз в 5 минут.
 *  Это НЕ мгновенно (мгновенно = Cloud Functions, но там нужна карта на Firebase),
 *  но задержка максимум ~5 минут, и это полностью бесплатно и без привязки карты.
 *
 *  ⚠️ Названия полей (`axioUsers`, `notifications`, `id/type/message`,
 *  `telegramChatId`, `pushSubscription`) взяты из реального кода фронтенда.
 *  Если что-то в твоей базе называется иначе — поправь ниже.
 * ================================================================================== */

const admin = require('firebase-admin');
const webpush = require('web-push');
const fetch = require('node-fetch');

// ---------------------------- НАСТРОЙКИ ----------------------------
const USER_COLLECTION = 'axioUsers';
const MAX_SENT_IDS_KEPT = 300; // сколько последних id хранить в pushSentIds, чтобы поле не росло бесконечно

const TYPE_TITLES = {
    error: '⚠️ Axio',
    warning: '🔔 Axio',
    success: '✅ Axio',
};

// ---------------------------- ИНИЦИАЛИЗАЦИЯ ----------------------------
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

webpush.setVapidDetails(
    'mailto:' + (process.env.VAPID_CONTACT_EMAIL || 'admin@example.com'),
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
);

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

// ---------------------------- ХЕЛПЕРЫ ----------------------------
async function sendTelegram(chatId, title, body) {
    if (!BOT_TOKEN || !chatId) return;
    try {
        const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, text: `<b>${title}</b>\n${body}`, parse_mode: 'HTML' }),
        });
        const data = await res.json();
        if (!data.ok) console.warn(`[telegram] ${chatId}: ${data.description}`);
    } catch (err) {
        console.error(`[telegram] Ошибка отправки ${chatId}:`, err.message);
    }
}

async function sendWebPush(uid, subscription, title, body) {
    try {
        await webpush.sendNotification(subscription, JSON.stringify({ title, body }));
    } catch (err) {
        console.error(`[webpush] Ошибка отправки ${uid}:`, err.statusCode || err.message);
        // 404/410 = подписка больше не действительна — чистим её, чтобы не пытаться зря каждые 5 минут
        if (err.statusCode === 404 || err.statusCode === 410) {
            await db.collection(USER_COLLECTION).doc(uid)
                .update({ pushSubscription: admin.firestore.FieldValue.delete() })
                .catch(() => {});
        }
    }
}

// ---------------------------- ОСНОВНАЯ ЛОГИКА ----------------------------
async function run() {
    const usersSnap = await db.collection(USER_COLLECTION).get();
    console.log(`[notify] Пользователей в базе: ${usersSnap.size}`);

    let notificationsSent = 0;
    let usersNotified = 0;

    for (const doc of usersSnap.docs) {
        const uid = doc.id;
        const user = doc.data();

        const notifications = Array.isArray(user.notifications) ? user.notifications : [];
        if (!notifications.length) continue;
        if (!user.telegramChatId && !user.pushSubscription) continue; // некому слать — пропускаем

        const alreadySent = new Set(user.pushSentIds || []);
        const fresh = notifications.filter(n => !alreadySent.has(n.id));
        if (!fresh.length) continue;

        for (const n of fresh) {
            const title = TYPE_TITLES[n.type] || '🔔 Axio';
            if (user.telegramChatId) await sendTelegram(user.telegramChatId, title, n.message);
            if (user.pushSubscription) await sendWebPush(uid, user.pushSubscription, title, n.message);
            notificationsSent++;
        }

        const updatedSentIds = Array.from(new Set([...alreadySent, ...fresh.map(n => n.id)]))
            .slice(-MAX_SENT_IDS_KEPT);

        await doc.ref.update({ pushSentIds: updatedSentIds }).catch(e => {
            console.error(`[notify] Не удалось обновить pushSentIds для ${uid}:`, e.message);
        });

        usersNotified++;
    }

    console.log(`[notify] Готово. Уведомлений отправлено: ${notificationsSent}, пользователей затронуто: ${usersNotified}`);
}

run()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error('[notify] Ошибка выполнения:', err);
        process.exit(1);
    });