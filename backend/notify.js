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
        if (err.statusCode === 404 || err.statusCode === 410) {
            await db.collection(USER_COLLECTION).doc(uid)
                .update({ pushSubscription: admin.firestore.FieldValue.delete() })
                .catch(() => {});
        }
    }
}

// data-only сообщение (без поля "notification"): приходит в sw-push.js как
// обычное 'push'-событие с тем же JSON-форматом {title, body}, что и у
// собственного Web Push выше — один и тот же service worker обрабатывает оба канала.
async function sendFcm(uid, token, title, body) {
    try {
        await admin.messaging().send({
            token,
            data: { title, body },
            webpush: { headers: { Urgency: 'high' } },
        });
    } catch (err) {
        console.error(`[fcm] Ошибка отправки ${uid}:`, err.code || err.message);
        if (err.code === 'messaging/registration-token-not-registered') {
            await db.collection(USER_COLLECTION).doc(uid)
                .update({ fcmToken: admin.firestore.FieldValue.delete() })
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
        if (!user.telegramChatId && !user.pushSubscription && !user.fcmToken) continue;

        const alreadySent = new Set(user.pushSentIds || []);
        const fresh = notifications.filter(n => !alreadySent.has(n.id));
        if (!fresh.length) continue;

        for (const n of fresh) {
            const title = TYPE_TITLES[n.type] || '🔔 Axio';
            if (user.telegramChatId) await sendTelegram(user.telegramChatId, title, n.message);
            if (user.pushSubscription) await sendWebPush(uid, user.pushSubscription, title, n.message);
            if (user.fcmToken) await sendFcm(uid, user.fcmToken, title, n.message);
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