// moderation.js
// Единый модуль для всех задач модерации: ссылки, дубликаты, AI-проверка текста и изображений

// ============================================================
// 1. КОНФИГУРАЦИЯ
// ============================================================

const AXIO_MODERATION_ENDPOINT = 'https://proverka.axioaxio.workers.dev';
const MODERATION_TIMEOUT_MS = 8000; // таймаут для AI-запросов

// ============================================================
// 2. ЭВРИСТИКА: СПАМ-ССЫЛКИ, ТЕЛЕФОНЫ, УПОМИНАНИЯ
// ============================================================

const SPAM_LINK_PATTERNS = {
    url: /\b(?:https?:\/\/|www\.)\S+/gi,
    telegram: /\b(?:t\.me|telegram\.me)\/[a-zA-Z0-9_]+/gi,
    mention: /(^|[\s(])@[a-zA-Z0-9_]{3,32}\b/g,
    phoneCandidate: /(?:\+?\d[\d\-\s()]{8,16}\d)/g
};

/**
 * Обнаружение спам-ссылок в тексте
 * @param {string} text
 * @returns {{ hasSpamLinks: boolean, reasons: string[], matches: Object }}
 */
function detectSpamLinks(text) {
    const str = (text || '').toString();
    const urls = str.match(SPAM_LINK_PATTERNS.url) || [];
    const telegram = str.match(SPAM_LINK_PATTERNS.telegram) || [];
    const mentions = (str.match(SPAM_LINK_PATTERNS.mention) || []).map(m => m.trim());
    const rawPhones = str.match(SPAM_LINK_PATTERNS.phoneCandidate) || [];
    const phones = rawPhones.filter(p => p.replace(/\D/g, '').length >= 10);

    const reasons = [];
    if (urls.length) reasons.push(`ссылка в тексте: ${urls.slice(0, 3).join(', ')}`);
    if (telegram.length) reasons.push(`Telegram-ссылка: ${telegram.slice(0, 2).join(', ')}`);
    if (mentions.length) reasons.push(`упоминание: ${mentions.slice(0, 3).join(', ')}`);
    if (phones.length) reasons.push(`похоже на номер телефона: ${phones.slice(0, 2).join(', ')}`);

    return {
        hasSpamLinks: reasons.length > 0,
        reasons,
        matches: { urls, telegram, mentions, phones }
    };
}

/**
 * Проверка текста на спам-ссылки (синоним)
 * @param {string} text
 * @returns {ReturnType<detectSpamLinks>}
 */
function checkTextForSpamLinks(text) {
    return detectSpamLinks(text);
}

// ============================================================
// 3. ДЕДУПЛИКАЦИЯ РЕЦЕПТОВ (ХЭШ)
// ============================================================

/**
 * Нормализация текста для хэша
 */
function normalizeForHash(str) {
    return (str || '')
        .toString()
        .toLowerCase()
        .replace(/ё/g, 'е')
        .replace(/[^a-zа-я0-9]+/gi, ' ')
        .trim()
        .replace(/\s+/g, ' ');
}

/**
 * Простой хэш (djb2)
 */
function djb2Hash(str) {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
        hash = (hash << 5) + hash + str.charCodeAt(i);
        hash |= 0;
    }
    return (hash >>> 0).toString(36);
}

/**
 * Получить текстовое содержимое рецепта для проверки
 */
function getRecipeFullText(recipe) {
    if (!recipe) return '';
    const name = recipe.name?.ru || recipe.name || '';
    const desc = recipe.description?.ru || recipe.description || '';
    const ingredientsText = (recipe.ingredients || []).map(i => i.name || '').join(', ');
    const instructionsText =
        recipe.instructions?.ru || (recipe.steps?.ru || recipe.steps || []).join(' ') || '';
    return `${name}\n${desc}\n${ingredientsText}\n${instructionsText}`;
}

/**
 * Генерация хэша содержимого рецепта (ингредиенты + шаги)
 */
function generateRecipeContentHash(recipe) {
    if (!recipe) return '';
    const ingredientsNorm = (recipe.ingredients || [])
        .map(i => normalizeForHash(i.name))
        .filter(Boolean)
        .sort()
        .join('|');
    const instructionsNorm = normalizeForHash(
        recipe.instructions?.ru || (recipe.steps?.ru || recipe.steps || []).join(' ') || ''
    );
    return djb2Hash(`${ingredientsNorm}::${instructionsNorm}`);
}

/**
 * Поиск дубликата по хэшу среди списка рецептов
 * @param {Object} newRecipe - новый рецепт
 * @param {Array<{id: string, recipe: Object}>} existingList - массив с полями id и recipe
 * @returns {{ id: string, hash: string } | null}
 */
function findDuplicateByHash(newRecipe, existingList) {
    const targetHash = generateRecipeContentHash(newRecipe);
    if (!targetHash) return null;
    const match = (existingList || []).find(
        ({ recipe }) => recipe && generateRecipeContentHash(recipe) === targetHash
    );
    return match ? { id: match.id, hash: targetHash } : null;
}

// ============================================================
// 4. ВЫЗОВ CLOUDFLARE WORKER (AI-модерация)
// ============================================================

/**
 * Базовый вызов Worker с таймаутом
 */
async function callWorker(payload) {
    if (typeof auth === 'undefined' || !auth.currentUser) {
        throw new Error('Нет активной сессии пользователя');
    }
    const idToken = await auth.currentUser.getIdToken();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), MODERATION_TIMEOUT_MS);

    try {
        const response = await fetch(AXIO_MODERATION_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${idToken}`,
                'X-Axio-Client': 'moderation'
            },
            body: JSON.stringify(payload),
            signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.error || `Ошибка ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
            throw new Error('AI-сервер не отвечает (таймаут)');
        }
        throw error;
    }
}

/**
 * AI-проверка текста
 * @param {string} text - текст для проверки
 * @param {string} type - 'recipe' | 'fridge' | 'username' | 'comment'
 * @returns {Promise<{suspicious: boolean, reason: string|null}>}
 */
async function moderateTextWithAI(text, type = 'recipe') {
    if (!text || text.length < 3) {
        return { suspicious: false, reason: null };
    }
    try {
        return await callWorker({ prompt: text, type });
    } catch (error) {
        console.warn('AI text moderation failed, fallback to heuristic', error);
        return fallbackModeration(text);
    }
}

/**
 * AI-проверка изображения (base64 без префикса)
 * @param {string} imageBase64 - base64-данные изображения (без data:image/...;base64,)
 * @param {string} type - контекст (например, 'recipe')
 * @returns {Promise<{suspicious: boolean, reason: string|null}>}
 */
async function moderateImageWithAI(imageBase64, type = 'recipe') {
    if (!imageBase64 || imageBase64.length < 100) {
        return { suspicious: false, reason: null };
    }
    try {
        return await callWorker({ imageBase64, type });
    } catch (error) {
        console.warn('AI image moderation failed', error);
        // Нет fallback для изображений – возвращаем безопасный ответ
        return { suspicious: false, reason: null };
    }
}

// ============================================================
// 5. КОМБИНИРОВАННЫЕ ПРОВЕРКИ
// ============================================================

/**
 * Эвристическая проверка (без AI) – быстрый фильтр
 */
function fallbackModeration(text) {
    const spam = detectSpamLinks(text);
    if (spam.hasSpamLinks) {
        return { suspicious: true, reason: `Обнаружены: ${spam.reasons.join(', ')}` };
    }
    // Простой список запрещённых слов (можно расширить)
    const badWords = ['мат', 'оскорбление', 'spam', 'фигня', 'редиска']; // пример
    const lower = text.toLowerCase();
    for (const word of badWords) {
        if (lower.includes(word)) {
            return { suspicious: true, reason: `Содержит запрещённое слово: ${word}` };
        }
    }
    return { suspicious: false, reason: null };
}

/**
 * Умная проверка: сначала эвристика, потом AI при необходимости
 */
async function moderateTextSmart(text, type = 'recipe') {
    const heuristic = fallbackModeration(text);
    if (heuristic.suspicious) {
        // Уточняем через AI
        try {
            const aiResult = await moderateTextWithAI(text, type);
            return aiResult;
        } catch {
            return heuristic; // если AI недоступен, возвращаем эвристику
        }
    }
    return { suspicious: false, reason: null };
}

/**
 * Комплексная проверка рецепта (текст + изображение + дубликат)
 * @param {Object} recipe - объект рецепта
 * @param {Array} existingRecipes - массив существующих рецептов для дедупликации
 * @param {string} imageBase64 - опционально, base64 изображения (без префикса)
 * @returns {Promise<{
 *   suspicious: boolean,
 *   reasons: string[],
 *   duplicate: { id: string, hash: string } | null,
 *   aiResult: Object | null,
 *   imageResult: Object | null
 * }>}
 */
async function moderateRecipe(recipe, existingRecipes = [], imageBase64 = null) {
    const result = {
        suspicious: false,
        reasons: [],
        duplicate: null,
        aiResult: null,
        imageResult: null
    };

    // 1. Проверка на дубликат (синхронно)
    if (existingRecipes && existingRecipes.length) {
        const dup = findDuplicateByHash(recipe, existingRecipes);
        if (dup) {
            result.suspicious = true;
            result.reasons.push(`дубликат #${dup.id}`);
            result.duplicate = dup;
        }
    }

    // 2. Проверка текста через AI
    const fullText = getRecipeFullText(recipe);
    if (fullText.length > 10) {
        try {
            const ai = await moderateTextWithAI(fullText, 'recipe');
            result.aiResult = ai;
            if (ai.suspicious) {
                result.suspicious = true;
                result.reasons.push(`AI: ${ai.reason}`);
            }
        } catch (e) {
            // Если AI упал, пробуем эвристику
            const heuristic = fallbackModeration(fullText);
            if (heuristic.suspicious) {
                result.suspicious = true;
                result.reasons.push(`эвристика: ${heuristic.reason}`);
            }
        }
    }

    // 3. Проверка изображения (если передано)
    if (imageBase64) {
        try {
            const img = await moderateImageWithAI(imageBase64, 'recipe');
            result.imageResult = img;
            if (img.suspicious) {
                result.suspicious = true;
                result.reasons.push(`изображение: ${img.reason}`);
            }
        } catch (e) {
            // Игнорируем ошибки проверки изображения
        }
    }

    return result;
}

// ============================================================
// 6. УТИЛИТЫ ДЛЯ УДОБСТВА
// ============================================================

/**
 * Проверка названия холодильника (быстрая)
 */
async function moderateFridgeName(name) {
    if (!name) return { suspicious: false, reason: null };
    // сначала эвристика
    const heuristic = fallbackModeration(name);
    if (heuristic.suspicious) {
        // уточняем через AI
        try {
            return await moderateTextWithAI(name, 'fridge');
        } catch {
            return heuristic;
        }
    }
    return { suspicious: false, reason: null };
}

/**
 * Проверка имени пользователя
 */
async function moderateUsername(name) {
    if (!name) return { suspicious: false, reason: null };
    const heuristic = fallbackModeration(name);
    if (heuristic.suspicious) {
        try {
            return await moderateTextWithAI(name, 'username');
        } catch {
            return heuristic;
        }
    }
    return { suspicious: false, reason: null };
}

/**
 * Проверка комментария
 */
async function moderateComment(text) {
    if (!text) return { suspicious: false, reason: null };
    const heuristic = fallbackModeration(text);
    if (heuristic.suspicious) {
        try {
            return await moderateTextWithAI(text, 'comment');
        } catch {
            return heuristic;
        }
    }
    return { suspicious: false, reason: null };
}

// ============================================================
// 7. ЭКСПОРТ ВСЕХ ФУНКЦИЙ (для удобства)
// ============================================================

const ModerationAI = {
    detectSpamLinks,
    checkTextForSpamLinks,
    getRecipeFullText,
    generateRecipeContentHash,
    findDuplicateByHash,
    moderateTextWithAI,
    moderateImageWithAI,
    moderateTextSmart,
    moderateRecipe,
    moderateFridgeName,
    moderateUsername,
    moderateComment,
    fallbackModeration,
};