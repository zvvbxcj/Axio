const AXIO_MODERATION_ENDPOINT = 'proverka.axioaxio.workers.dev';

const SPAM_LINK_PATTERNS = {
    url: /\b(?:https?:\/\/|www\.)\S+/gi,
    telegram: /\b(?:t\.me|telegram\.me)\/[a-zA-Z0-9_]+/gi,
    mention: /(^|[\s(])@[a-zA-Z0-9_]{3,32}\b/g,
    // +7 900 123-45-67, 8(900)1234567, 89001234567 и т.п.
    phoneCandidate: /(?:\+?\d[\d\-\s()]{8,16}\d)/g
};


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

function checkTextForSpamLinks(text) {
    return detectSpamLinks(text);
}

function getRecipeFullText(recipe) {
    if (!recipe) return '';
    const name = recipe.name?.ru || recipe.name || '';
    const desc = recipe.description?.ru || recipe.description || '';
    const ingredientsText = (recipe.ingredients || []).map(i => i.name || '').join(', ');
    const instructionsText =
        recipe.instructions?.ru || (recipe.steps?.ru || recipe.steps || []).join(' ') || '';
    return `${name}\n${desc}\n${ingredientsText}\n${instructionsText}`;
}

function normalizeForHash(str) {
    return (str || '')
        .toString()
        .toLowerCase()
        .replace(/ё/g, 'е')
        .replace(/[^a-zа-я0-9]+/gi, ' ')
        .trim()
        .replace(/\s+/g, ' ');
}

function djb2Hash(str) {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
        hash = (hash << 5) + hash + str.charCodeAt(i);
        hash |= 0;
    }
    return (hash >>> 0).toString(36);
}

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

function findDuplicateByHash(newRecipe, existingList) {
    const targetHash = generateRecipeContentHash(newRecipe);
    if (!targetHash) return null;
    const match = (existingList || []).find(
        ({ recipe }) => recipe && generateRecipeContentHash(recipe) === targetHash
    );
    return match ? { id: match.id, hash: targetHash } : null;
}


async function callModerationAI(promptText) {
    if (typeof auth === 'undefined' || !auth.currentUser) {
        // Нет сессии — пусть runSpamPreFilter() откатится на heuristicSpamCheck()
        throw new Error('Moderation AI: нет активной сессии пользователя');
    }

    const idToken = await auth.currentUser.getIdToken();

    const response = await fetch(AXIO_MODERATION_ENDPOINT, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`,
            'X-Axio-Client': 'moderation-pre-filter'
        },
        body: JSON.stringify({ prompt: promptText, response_format: 'json' })
    });

    if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        throw new Error(errBody.error || `Moderation AI: ошибка ${response.status}`);
    }

    const data = await response.json();
    const raw = typeof data.text === 'string' ? data.text : JSON.stringify(data);
    return JSON.parse(raw.replace(/```json|```/g, '').trim());
}