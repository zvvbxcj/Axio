function base64UrlToUint8Array(base64Url) {
    const padding = '='.repeat((4 - (base64Url.length % 4)) % 4);
    const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(base64);
    const array = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) array[i] = raw.charCodeAt(i);
    return array;
}

function base64UrlDecodeToString(base64Url) {
    return new TextDecoder().decode(base64UrlToUint8Array(base64Url));
}

let cachedKeys = null;
let cachedKeysExpiry = 0;

async function getGoogleJWKS() {
    const now = Date.now();
    if (cachedKeys && now < cachedKeysExpiry) return cachedKeys;

    const res = await fetch('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com');
    if (!res.ok) throw new Error('Не удалось загрузить публичные ключи Google');
    const data = await res.json();
    cachedKeys = data.keys;
    cachedKeysExpiry = now + 60 * 60 * 1000;
    return cachedKeys;
}

async function verifyFirebaseIdToken(idToken, projectId) {
    const parts = idToken.split('.');
    if (parts.length !== 3) throw new Error('Некорректный формат токена');
    const [headerB64, payloadB64, signatureB64] = parts;

    const header = JSON.parse(base64UrlDecodeToString(headerB64));
    const payload = JSON.parse(base64UrlDecodeToString(payloadB64));

    if (header.alg !== 'RS256') throw new Error('Неверный алгоритм токена');

    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) throw new Error('Токен истёк');
    if (payload.iat > now + 60) throw new Error('Токен из будущего');
    if (payload.aud !== projectId) throw new Error('Неверный audience (проверь FIREBASE_PROJECT_ID)');
    if (payload.iss !== `https://securetoken.google.com/${projectId}`) throw new Error('Неверный issuer');
    if (!payload.sub) throw new Error('Токен без sub');

    const keys = await getGoogleJWKS();
    const jwk = keys.find(k => k.kid === header.kid);
    if (!jwk) throw new Error('Ключ подписи не найден (kid не совпал, ключи Google могли обновиться)');

    const cryptoKey = await crypto.subtle.importKey(
        'jwk',
        jwk,
        { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
        false,
        ['verify']
    );

    const signedData = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
    const signature = base64UrlToUint8Array(signatureB64);

    const isValid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', cryptoKey, signature, signedData);
    if (!isValid) throw new Error('Неверная подпись токена');

    return payload;
}

function jsonResponse(obj, status, extraHeaders) {
    return new Response(JSON.stringify(obj), {
        status,
        headers: { 'Content-Type': 'application/json', ...extraHeaders },
    });
}

async function callGemini(env, promptParts, temperature) {
    const geminiRes = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent',
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': env.GEMINI_API_KEY,
            },
            body: JSON.stringify({
                contents: [{ parts: promptParts }],
                generationConfig: {
                    temperature,
                    responseMimeType: 'application/json',
                },
            }),
        }
    );

    if (!geminiRes.ok) {
        const errorData = await geminiRes.json().catch(() => ({}));
        console.error('Gemini error:', errorData);
        const err = new Error(errorData.error?.message || 'Ошибка обращения к Gemini');
        err.status = geminiRes.status;
        throw err;
    }

    const data = await geminiRes.json();
    let jsonString = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!jsonString) {
        const err = new Error('Пустой ответ от модели (возможно, сработал фильтр безопасности)');
        err.status = 502;
        throw err;
    }

    jsonString = jsonString.trim().replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/```\s*$/, '');
    try {
        return JSON.parse(jsonString);
    } catch (e) {
        console.error('JSON parse error:', jsonString);
        const err = new Error('Модель вернула не-JSON ответ');
        err.status = 502;
        throw err;
    }
}

async function handleChef(body, env) {
    const { ingredients, count, avoidTitles, allergies, priorityIngredients, preferences, maxTime, difficulty } = body || {};
    if (!ingredients || typeof ingredients !== 'string') {
        const err = new Error('ingredients обязателен');
        err.status = 400;
        throw err;
    }

    let safeCount = parseInt(count, 10);
    if (!safeCount || safeCount < 1) safeCount = 1;
    if (safeCount > 5) safeCount = 5;

    const avoidBlock = Array.isArray(avoidTitles) && avoidTitles.length > 0
        ? `Пользователь уже видел эти блюда, НЕ предлагай их снова и придумай другие: ${avoidTitles.slice(0, 25).join(', ')}.`
        : '';

    // Аллергены — самый строгий блок промпта, ставим с явным маркером важности.
    const allergyBlock = Array.isArray(allergies) && allergies.length > 0
        ? `КРИТИЧЕСКИ ВАЖНО (пищевая безопасность): у пользователя аллергия/непереносимость на: ${allergies.join(', ')}. Ни один ингредиент рецепта не должен содержать эти вещества или продукты на их основе, даже в небольшом количестве или как часть составного продукта (соус, приправа и т.п.). Если совместить это с доступными продуктами невозможно, выбери рецепт, который эти продукты вообще не использует.`
        : '';

    // Приоритет по сроку годности — используем "уходящие" продукты в первую очередь,
    // если это не противоречит вкусу и логике блюда.
    const priorityBlock = Array.isArray(priorityIngredients) && priorityIngredients.length > 0
        ? `У пользователя скоро испортятся эти продукты, постарайся использовать их в рецепте, чтобы уменьшить пищевые отходы (но не в ущерб вкусу и логике блюда): ${priorityIngredients.join(', ')}.`
        : '';

    // Персонализация по истории (что реально готовили/лайкали/дизлайкали) — мягкая подсказка.
    let preferenceBlock = '';
    if (preferences && typeof preferences === 'object') {
        const parts = [];
        if (Array.isArray(preferences.likedTitles) && preferences.likedTitles.length) {
            parts.push(`пользователю нравятся блюда вроде: ${preferences.likedTitles.join(', ')}`);
        }
        if (Array.isArray(preferences.favoriteCategories) && preferences.favoriteCategories.length) {
            parts.push(`чаще всего готовит категории: ${preferences.favoriteCategories.join(', ')}`);
        }
        if (Array.isArray(preferences.recentCookedTitles) && preferences.recentCookedTitles.length) {
            parts.push(`недавно уже готовил: ${preferences.recentCookedTitles.join(', ')} — по возможности предложи что-то другое для разнообразия`);
        }
        const dislikedTitles = (preferences.dislikedRecipes || []).map(d => d && d.title).filter(Boolean);
        if (dislikedTitles.length) {
            parts.push(`НЕ предлагай блюда, похожие по стилю на (не понравилось ранее): ${dislikedTitles.join(', ')}`);
        }
        if (parts.length) {
            preferenceBlock = `Учти вкусы и историю пользователя как мягкую подсказку (не жёсткое правило): ${parts.join('; ')}.`;
        }
    }

    const constraintParts = [];
    const safeMaxTime = parseInt(maxTime, 10);
    if (safeMaxTime && safeMaxTime > 0) {
        constraintParts.push(`Время готовки каждого рецепта не должно превышать ${safeMaxTime} минут.`);
    }
    if (typeof difficulty === 'string' && ['Легко', 'Средне', 'Сложно'].includes(difficulty)) {
        constraintParts.push(`Сложность рецепта должна быть строго: ${difficulty}.`);
    }
    const constraintsBlock = constraintParts.join(' ');

    const promptText = `
    Ты — профессиональный шеф-повар и специалист по борьбе с пищевыми отходами. Придумай ${safeCount} ${safeCount === 1 ? 'вкусный рецепт' : 'разных вкусных рецепта'}, используя эти ингредиенты: ${ingredients}.
    Базовые вещи (соль, перец, вода, масло) можно использовать по умолчанию.
    Если ингредиентов мало, придумай что-то простое.
    ${safeCount > 1 ? 'Рецепты должны существенно отличаться друг от друга — разные блюда, а не вариации одного и того же.' : ''}
    ${allergyBlock}
    ${priorityBlock}
    ${preferenceBlock}
    ${constraintsBlock}
    ${avoidBlock}
    Твой ответ должен быть СТРОГО в формате JSON-МАССИВА без markdown-разметки (даже если рецепт один — всё равно верни массив из одного элемента), по структуре:
    [
      {
        "title": "Название блюда",
        "category": "строго одно из: breakfast, soup, main, salad, pasta, dessert, baking, snacks, vegetarian, drinks",
        "time": "Время текстом (например: 30 мин)",
        "timeMinutes": 30,
        "difficulty": "строго одно из: Легко, Средне, Сложно",
        "ingredients": [ { "name": "название ингредиента", "amount": число, "unit": "строго одно из: шт, г, кг, мл, л, уп" } ],
        "steps": ["шаг 1", "шаг 2"]
      }
    ]
`;

    let recipes = await callGemini(env, [{ text: promptText }], 0.9);
    if (!Array.isArray(recipes)) recipes = [recipes];
    return { recipes };
}

async function handleScan(body, env) {
    const { imageBase64, mimeType } = body || {};
    if (!imageBase64 || typeof imageBase64 !== 'string') {
        const err = new Error('imageBase64 обязателен');
        err.status = 400;
        throw err;
    }
    const safeMimeType = typeof mimeType === 'string' && mimeType.startsWith('image/') ? mimeType : 'image/jpeg';

    const promptText = `
    Ты — ассистент по распознаванию продуктов питания на фото для приложения-органайзера холодильника.
    На фото может быть: один продукт крупным планом, несколько продуктов на столе/в пакете, или чек из магазина.
    Определи ВСЕ продукты питания, которые видишь (или строки покупок, если это чек).
    Для каждого продукта укажи:
    - name: короткое понятное название на русском (например "Молоко 3.2%", "Яблоки")
    - category: строго одно из значений ["Dairy","Meat","Vegetables","Fruits","Bakery","Other"]
    - qty: примерное количество (число)
    - unit: строго одно из значений ["шт","г","кг","мл","л"]
    - shelf_life_days: сколько дней этот продукт обычно хранится в холодильнике/дома (целое число, разумная оценка)

    Ответь СТРОГО в формате JSON-массива без markdown-разметки, например:
    [{"name":"Молоко 3.2%","category":"Dairy","qty":1,"unit":"л","shelf_life_days":7}]

    Если на фото нет ни одного продукта питания, верни пустой массив: []
`;

    let items = await callGemini(env, [
        { text: promptText },
        { inline_data: { mime_type: safeMimeType, data: imageBase64 } }
    ], 0.4);
    if (!Array.isArray(items)) items = [];
    return { items };
}

export default {
    async fetch(request, env, ctx) {
        const corsHeaders = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        };

        if (request.method === 'OPTIONS') {
            return new Response(null, { headers: corsHeaders });
        }

        if (request.method !== 'POST') {
            return jsonResponse({ error: 'Method not allowed' }, 405, corsHeaders);
        }

        try {
            const authHeader = request.headers.get('Authorization') || '';
            const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
            if (!idToken) {
                return jsonResponse({ error: 'Требуется авторизация' }, 401, corsHeaders);
            }

            try {
                await verifyFirebaseIdToken(idToken, env.FIREBASE_PROJECT_ID);
            } catch (authErr) {
                console.error('Token verify error:', authErr.message);
                return jsonResponse({ error: 'Недействительный токен' }, 401, corsHeaders);
            }

            const body = await request.json().catch(() => ({}));
            const action = body?.action === 'scan' ? 'scan' : 'chef'; // по умолчанию 'chef' — совместимо со старым фронтендом

            let result;
            if (action === 'scan') {
                result = await handleScan(body, env);
            } else {
                result = await handleChef(body, env);
            }

            return jsonResponse(result, 200, corsHeaders);
        } catch (err) {
            console.error(`${err.status ? '' : 'Unhandled '}error:`, err.message);
            return jsonResponse({ error: err.message || 'Внутренняя ошибка сервера' }, err.status || 500, corsHeaders);
        }
    },
};