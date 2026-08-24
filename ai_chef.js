const AXIO_AI_CHEF_ENDPOINT = 'https://ai-gemini.axioaxio.workers.dev';

let aiChefShownTitles = [];
let aiChefLastInventorySignature = '';

// Хранилище "сырых" рецептов из последнего ответа AI (по индексу карточки) —
// используется обработчиками кнопок (Готовить/Купить/Сохранить/Другой вариант),
// чтобы не пихать огромные JSON в inline-onclick атрибуты.
window.__aiChefRecipes = window.__aiChefRecipes || [];
// Снимок продуктов, которые скоро испортятся, на момент последней генерации —
// нужен, чтобы подсветить в карточке, какие ингредиенты "спасает" рецепт.
window.__aiChefPriority = window.__aiChefPriority || [];

const AI_CHEF_KNOWN_CATEGORIES = ['breakfast', 'soup', 'main', 'salad', 'pasta', 'dessert', 'baking', 'snacks', 'vegetarian', 'drinks'];
const AI_CHEF_DIFFICULTY_EN = { 'Легко': 'Easy', 'Средне': 'Medium', 'Сложно': 'Hard' };

// Базовые продукты, которые считаются "всегда под рукой" и не требуют совпадения
// с инвентарём (соль, перец, вода, масло и т.п.) — иначе ни один рецепт не прошёл
// бы проверку "полное соответствие холодильнику".
const AI_CHEF_BASE_PANTRY = [
    'соль', 'перец', 'вода', 'масло', 'сахар', 'специи', 'приправ',
    'уксус', 'сода', 'разрыхлитель', 'ванилин', 'ваниль', 'лавровый лист'
];

function aiIngredientIsBasePantry(name) {
    const n = String(name || '').toLowerCase();
    return AI_CHEF_BASE_PANTRY.some(base => n.includes(base));
}

// Считает, сколько ингредиентов рецепта отсутствуют в холодильнике пользователя
// (не считая базовых продуктов). Используется, чтобы предлагать только рецепты
// с полным соответствием — без "не хватает".
function aiRecipeMissingCount(recipe) {
    const ingredientsNorm = (recipe.ingredients || []).map(normalizeAIIngredient);
    let missing = 0;
    ingredientsNorm.forEach(ing => {
        if (aiIngredientIsBasePantry(ing.name)) return;
        const invItem = (typeof findMatchingInventoryItem === 'function') ? findMatchingInventoryItem(ing.name) : null;
        const has = !!(invItem && (!ing.amount || invItem.qty >= ing.amount));
        if (!has) missing++;
    });
    return missing;
}

function getInventorySignature() {
    if (typeof userInventory === 'undefined' || !userInventory) return '';
    return userInventory.map(item => item.name).sort().join('|');
}

// --- Аллергены: читаем те же настройки, что использует основной список рецептов ---
function getActiveAllergyKeys() {
    try {
        const settings = JSON.parse(localStorage.getItem('userSettings')) || {};
        const allergies = settings.allergies || {};
        return Object.keys(allergies).filter(k => allergies[k] === true);
    } catch (e) {
        return [];
    }
}

function getActiveAllergyLabels() {
    const keys = getActiveAllergyKeys();
    if (typeof ALLERGY_UI === 'undefined') return keys;
    return keys.map(k => (ALLERGY_UI[k] && ALLERGY_UI[k].label) || k);
}

// Доп. защита на клиенте (даже если модель ошиблась и не учла аллергию сама)
function aiRecipeMatchesActiveAllergies(recipe, activeAllergyKeys) {
    if (!activeAllergyKeys || !activeAllergyKeys.length) return false;
    const text = (recipe.ingredients || [])
        .map(i => (typeof i === 'string' ? i : (i && i.name) || ''))
        .join(' ')
        .toLowerCase();
    return activeAllergyKeys.some(key => {
        const words = (typeof allergyKeywords !== 'undefined' && allergyKeywords[key]) || [];
        return words.some(w => text.includes(w));
    });
}

// --- Приоритет по сроку годности: продукты, которые скоро испортятся ---
function getPriorityExpiringIngredients(limit) {
    if (typeof userInventory === 'undefined' || !userInventory) return [];
    return userInventory
        .map(p => ({ name: p.name, days: (typeof getDaysUntilExpiry === 'function') ? getDaysUntilExpiry(p.expiryDate) : null }))
        .filter(p => p.days !== null && p.days <= 6)
        .sort((a, b) => a.days - b.days)
        .slice(0, limit || 8)
        .map(p => p.name);
}

// --- Персонализация: что пользователь реально готовил/лайкал/дизлайкал ---
function getUserPreferenceSignals() {
    let liked = [];
    let cookedTitles = [];
    let disliked = [];
    const cookedCategoryCount = {};

    try {
        if (typeof userFavorites !== 'undefined' && typeof globalRecipes !== 'undefined') {
            userFavorites.slice(-15).forEach(id => {
                const r = globalRecipes.find(x => x.id === id);
                if (r && r.name) liked.push(r.name.ru || r.name);
            });
        }
        if (typeof userHistory !== 'undefined' && userHistory) {
            userHistory.filter(h => h.type === 'cook').slice(-25).forEach(h => {
                if (h.category) cookedCategoryCount[h.category] = (cookedCategoryCount[h.category] || 0) + 1;
                if (h.recipeName) cookedTitles.push(h.recipeName);
            });
        }
        if (typeof userDislikes !== 'undefined' && typeof globalRecipes !== 'undefined') {
            userDislikes.slice(-15).forEach(d => {
                const r = globalRecipes.find(x => x.id === d.id);
                if (r && r.name) disliked.push({ title: r.name.ru || r.name, reason: d.reason });
            });
        }
    } catch (e) {
        console.warn('AI Chef preference signals error', e);
    }

    const favoriteCategories = Object.entries(cookedCategoryCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([c]) => c);

    return {
        likedTitles: [...new Set(liked)].slice(0, 5),
        favoriteCategories,
        recentCookedTitles: [...new Set(cookedTitles)].slice(-5),
        dislikedRecipes: disliked.slice(0, 5)
    };
}

async function generateAIRecipe(count) {
    const btn = document.querySelector('#ai-chef-modal .btn-primary');
    const content = document.getElementById('ai-recipe-content');

    if (typeof userInventory === 'undefined' || !userInventory || userInventory.length === 0) {
        if (content) content.innerHTML = '<div style="color:var(--warning); text-align:center;">Ваш холодильник пуст! Добавьте продукты в инвентарь.</div>';
        return;
    }

    const countSelect = document.getElementById('ai-chef-count');
    if (typeof count !== 'number') {
        count = countSelect ? parseInt(countSelect.value, 10) : 1;
    }
    if (!count || count < 1) count = 1;
    if (count > 5) count = 5;

    const currentSignature = getInventorySignature();
    if (currentSignature !== aiChefLastInventorySignature) {
        aiChefShownTitles = [];
        aiChefLastInventorySignature = currentSignature;
    }

    const ingredients = userInventory.map(item => item.name).join(', ');

    const allergies = getActiveAllergyLabels();

    const expiryToggle = document.getElementById('ai-chef-use-expiring');
    const prioritizeExpiring = expiryToggle ? expiryToggle.checked : true;
    const priorityIngredients = prioritizeExpiring ? getPriorityExpiringIngredients() : [];

    const preferences = getUserPreferenceSignals();

    const timeSelect = document.getElementById('ai-chef-max-time');
    const maxTime = (timeSelect && timeSelect.value !== 'any') ? parseInt(timeSelect.value, 10) : null;

    const diffSelect = document.getElementById('ai-chef-difficulty');
    const difficulty = (diffSelect && diffSelect.value !== 'any') ? diffSelect.value : null;

    if (btn) {
        btn.disabled = true;
        btn.dataset.oldText = btn.dataset.oldText || btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Шеф думает...';
    }

    if (content) {
        content.innerHTML = `<div style="text-align:center; padding:20px; color:var(--text-secondary);">Нейросеть составляет ${count > 1 ? 'рецепты' : 'рецепт'} из ваших продуктов...</div>`;
    }

    try {
        if (typeof auth === 'undefined' || !auth.currentUser) {
            throw new Error('Нужно войти в аккаунт, чтобы пользоваться AI-шефом');
        }

        const activeAllergyKeys = getActiveAllergyKeys();
        const avoid = [...aiChefShownTitles];
        let matched = [];
        let hadDiscarded = false;
        let attempts = 0;
        const maxAttempts = 4; // защита от бесконечного цикла, если модель никак не попадает в холодильник

        while (matched.length < count && attempts < maxAttempts) {
            attempts++;
            const toFetch = Math.min(count - matched.length, 5);

            // Подтверждаем серверу, что запрос идёт от реального залогиненного
            // пользователя приложения — иначе функция отклонит запрос (401).
            const idToken = await auth.currentUser.getIdToken();

            const response = await fetch(AXIO_AI_CHEF_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${idToken}`
                },
                body: JSON.stringify({
                    ingredients,
                    count: toFetch,
                    avoidTitles: avoid,
                    allergies,
                    priorityIngredients,
                    preferences,
                    maxTime,
                    difficulty
                })
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || `Ошибка ${response.status}`);
            }

            let batch = data.recipes;
            if (!Array.isArray(batch)) batch = [batch];

            batch.forEach(r => { if (r && r.title) avoid.push(r.title); });

            // Доп. защита на клиенте: если модель всё же промахнулась мимо аллергии — вырезаем.
            if (activeAllergyKeys.length) {
                const before = batch.length;
                batch = batch.filter(r => !aiRecipeMatchesActiveAllergies(r, activeAllergyKeys));
                if (batch.length < before) hadDiscarded = true;
            }

            // Оставляем только рецепты, которые на 100% собираются из холодильника —
            // без единого недостающего продукта (кроме базовых: соль, масло и т.п.).
            const before = batch.length;
            const fullMatch = batch.filter(r => aiRecipeMissingCount(r) === 0);
            if (fullMatch.length < before) hadDiscarded = true;

            matched.push(...fullMatch);
        }

        matched = matched.slice(0, count);

        aiChefShownTitles = avoid.slice(-25);

        window.__aiChefRecipes = matched;
        window.__aiChefPriority = priorityIngredients;

        if (content) {
            if (matched.length === 0) {
                content.innerHTML = `
                    <div style="text-align:center; color:var(--warning); padding:20px;">
                        Не получилось подобрать рецепт, который полностью собирается из ваших продуктов${activeAllergyKeys.length ? ' и не нарушает пищевые ограничения' : ''}.<br>Попробуйте ещё раз или добавьте продуктов в холодильник.
                    </div>
                    <button class="btn btn-secondary" onclick="generateAIRecipe()" style="width:100%; margin-top:5px;">
                        <i class="fas fa-redo"></i> Попробовать снова
                    </button>`;
            } else {
                content.innerHTML =
                    matched.map((r, i) => renderAIRecipeCard(r, i)).join('') +
                    (hadDiscarded ? `<div style="text-align:center; color:var(--text-secondary); font-size:0.8em; margin-top:2px;">Часть вариантов от AI была скрыта — не хватало продуктов или были нарушены ограничения.</div>` : '') +
                    `<button class="btn btn-secondary" onclick="generateAIRecipe()" style="width:100%; margin-top:10px;">
                        <i class="fas fa-redo"></i> Предложить другие варианты
                    </button>`;
            }
        }

    } catch (error) {
        console.error("AI Chef Error:", error);
        if (content) {
            content.innerHTML = `
                <div style="text-align:center; color:var(--error); padding:20px;">
                    <i class="fas fa-exclamation-triangle" style="font-size:2em; margin-bottom:10px;"></i><br>
                    Упс, Шеф уронил кастрюлю!<br>
                    <span style="font-size:0.8em; opacity:0.7">Попробуйте еще раз. (${error.message})</span>
                </div>
            `;
        }
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = btn.dataset.oldText || 'Придумать рецепт';
        }
    }
}

// Приводит ингредиент из ответа AI к формату приложения {name, amount, unit}.
// Поддерживает и новый структурированный формат, и старый (строка вида "3 яйца") —
// на случай, если воркер на Cloudflare ещё не обновлён.
function normalizeAIIngredient(ing) {
    if (ing && typeof ing === 'object' && ing.name) {
        return {
            name: String(ing.name).trim(),
            amount: parseFloat(ing.amount) || 1,
            unit: ing.unit ? String(ing.unit).trim() : 'шт'
        };
    }
    const str = String(ing || '').trim();
    const match = str.match(/^(\d+(?:[.,]\d+)?)\s*(г|кг|мл|л|шт|уп)?\s+(.+)$/i);
    if (match) {
        return {
            name: match[3].trim(),
            amount: parseFloat(match[1].replace(',', '.')) || 1,
            unit: (match[2] || 'шт').toLowerCase()
        };
    }
    return { name: str, amount: 1, unit: 'шт' };
}

function normalizeAIDifficulty(d) {
    const s = String(d || '').trim();
    if (['Легко', 'Средне', 'Сложно'].includes(s)) return s;
    const low = s.toLowerCase();
    if (low.includes('easy') || low.includes('легк')) return 'Легко';
    if (low.includes('hard') || low.includes('слож')) return 'Сложно';
    return 'Средне';
}

function normalizeAICategory(c) {
    return AI_CHEF_KNOWN_CATEGORIES.includes(c) ? c : 'main';
}

// Проверяет ингредиент AI-рецепта на совпадение с чем-то из списка (используется
// для подсветки "спасает скоропортящееся" в карточке).
function aiIngredientMatchesName(ingName, targetName) {
    if (typeof ingredientNamesMatch === 'function') return ingredientNamesMatch(ingName, targetName);
    return String(ingName || '').toLowerCase() === String(targetName || '').toLowerCase();
}

// Превращает "сырой" рецепт от AI в объект в формате приложения (как у обычных
// рецептов из recipesDB) и добавляет его и в globalRecipes (чтобы работали карточки,
// фильтры, "Могу приготовить"), и в recipesDB (чтобы работал интерактивный режим
// готовки startCookingMode/finishCooking — он ищет рецепт именно в recipesDB).
// Повторный вызов для того же объекта recipe возвращает уже созданный id.
function materializeAIRecipe(recipe) {
    if (recipe.__appId && typeof globalRecipes !== 'undefined' && globalRecipes.some(r => r.id === recipe.__appId)) {
        return recipe.__appId;
    }

    const id = Date.now() + Math.floor(Math.random() * 1000);
    const difficultyRu = normalizeAIDifficulty(recipe.difficulty);
    const ingredientsNorm = (recipe.ingredients || []).map(normalizeAIIngredient);
    const stepsArr = recipe.steps || recipe.instructions || [];

    const appRecipe = {
        id,
        authorId: (typeof currentUser !== 'undefined' && currentUser) ? currentUser.uid : null,
        authorName: (typeof currentUser !== 'undefined' && currentUser) ? currentUser.name : 'AI Chef',
        name: { ru: recipe.title, en: recipe.title },
        time: recipe.time || '30 мин',
        difficulty: { ru: difficultyRu, en: AI_CHEF_DIFFICULTY_EN[difficultyRu] || 'Medium' },
        category: normalizeAICategory(recipe.category),
        images: ['https://via.placeholder.com/400x300/8B5CF6/FFFFFF?text=AI+Chef'],
        ingredients: ingredientsNorm,
        steps: { ru: stepsArr, en: stepsArr },
        popularity: 0,
        isCustom: true,
        aiGenerated: true,
        submittedAt: new Date().toISOString()
    };

    recipe.__appId = id;

    if (typeof globalRecipes !== 'undefined') globalRecipes.push(appRecipe);
    // recipesDB нужен отдельно: интерактивный режим готовки (таймеры, списание
    // ингредиентов, XP, ачивки) ищет рецепт именно там, а не в globalRecipes.
    if (typeof recipesDB !== 'undefined' && recipesDB) recipesDB.push(appRecipe);

    return id;
}

function renderAIRecipeCard(recipe, index) {
    const ingredientsNorm = (recipe.ingredients || []).map(normalizeAIIngredient);
    const priority = window.__aiChefPriority || [];

    let usesExpiringCount = 0;

    // На этом этапе рецепт уже гарантированно на 100% собирается из холодильника
    // (см. фильтрацию в generateAIRecipe/aiChefRegenerateOne) — здесь только рисуем.
    const ingredientRows = ingredientsNorm.map(ing => {
        const isBase = aiIngredientIsBasePantry(ing.name);
        const isExpiringUse = !isBase && priority.some(p => aiIngredientMatchesName(p, ing.name));
        if (isExpiringUse) usesExpiringCount++;

        return `<li class="ai-ing-row">
            <span class="ai-ing-check"><i class="fas fa-check"></i></span>
            <span class="ai-ing-name">${escapeHtml(ing.name)}</span>
            <span class="ai-ing-amount">${escapeHtml(String(ing.amount))} ${escapeHtml(ing.unit)}</span>
            ${isBase ? ' <span class="ai-ing-tag" title="Базовый продукт — всегда под рукой"><i class="fas fa-mortar-pestle"></i></span>' : ''}
            ${isExpiringUse ? ' <span class="ai-ing-tag ai-ing-expiring" title="Скоро испортится — этот рецепт его спасает">⏳</span>' : ''}
        </li>`;
    }).join('');

    const steps = recipe.steps || recipe.instructions || [];
    const difficultyIcons = { 'Легко': '●○○', 'Средне': '●●○', 'Сложно': '●●●' };
    const difficultyDots = difficultyIcons[normalizeAIDifficulty(recipe.difficulty)] || '●●○';

    return `
        <div class="recipe-card ai-recipe-card" id="ai-recipe-card-${index}" style="cursor: default;">
            <div class="ai-recipe-card-badge"><i class="fas fa-check-circle"></i> Всё есть в холодильнике</div>
            <h3>${escapeHtml(recipe.title || '')}</h3>
            <div class="recipe-meta ai-recipe-meta">
                <span><i class="far fa-clock"></i> ${escapeHtml(String(recipe.time || ''))}</span>
                <span><i class="fas fa-signal"></i> ${escapeHtml(String(recipe.difficulty || ''))} <small style="opacity:0.7;">${difficultyDots}</small></span>
                ${usesExpiringCount > 0 ? `<span class="ai-expiring-pill"><i class="fas fa-hourglass-half"></i> Спасает ${usesExpiringCount} скоропорт.</span>` : ''}
            </div>
            <div class="ai-recipe-section">
                <div class="ai-recipe-section-title"><i class="fas fa-carrot"></i> Ингредиенты</div>
                <ul class="ai-ing-list">
                    ${ingredientRows}
                </ul>
            </div>
            <div class="ai-recipe-section">
                <div class="ai-recipe-section-title"><i class="fas fa-list-ol"></i> Приготовление</div>
                <ol class="ai-steps-list">
                    ${steps.map(i => `<li>${escapeHtml(i)}</li>`).join('')}
                </ol>
            </div>
            <div class="ai-recipe-actions">
                <button class="btn btn-primary" style="flex:1; min-width:120px; margin-bottom:0;" onclick="aiChefCook(${index})">
                    <i class="fas fa-play"></i> Готовить
                </button>
                <button class="btn btn-secondary" id="ai-save-btn-${index}" style="flex:1; min-width:120px; margin-bottom:0;" onclick="aiChefSaveRecipe(${index})">
                    <i class="far fa-bookmark"></i> Сохранить
                </button>
                <button class="btn btn-secondary" style="flex:0 0 auto; margin-bottom:0; padding:0 14px;" title="Предложить другой вариант этого блюда" onclick="aiChefRegenerateOne(${index})">
                    <i class="fas fa-shuffle"></i>
                </button>
            </div>
        </div>
    `;
}

// --- Обработчики кнопок карточки ---

function aiChefCook(index) {
    const recipe = (window.__aiChefRecipes || [])[index];
    if (!recipe) return;
    const id = materializeAIRecipe(recipe);
    hideModal('ai-chef-modal');
    showRecipeDetail(id);
}

function aiChefBuyMissing(index) {
    const recipe = (window.__aiChefRecipes || [])[index];
    if (!recipe) return;
    const id = materializeAIRecipe(recipe);
    const appRecipe = (typeof globalRecipes !== 'undefined') ? globalRecipes.find(r => r.id === id) : null;
    if (appRecipe && typeof addMissingToShopping === 'function') addMissingToShopping(appRecipe);
}

function aiChefSaveRecipe(index) {
    const recipe = (window.__aiChefRecipes || [])[index];
    if (!recipe) return;
    const id = materializeAIRecipe(recipe);
    const appRecipe = (typeof globalRecipes !== 'undefined') ? globalRecipes.find(r => r.id === id) : null;
    if (!appRecipe) return;

    if (typeof userEditedRecipes === 'undefined' || !userEditedRecipes) window.userEditedRecipes = {};
    userEditedRecipes[id] = appRecipe;
    if (typeof saveData === 'function') saveData(false);

    const btn = document.getElementById(`ai-save-btn-${index}`);
    if (btn) {
        btn.innerHTML = '<i class="fas fa-check"></i> Сохранено';
        btn.disabled = true;
        btn.style.opacity = '0.7';
    }

    if (typeof showToast === 'function') showToast('Рецепт сохранён — ищите его в «Рецепты» → «Авторские»', 'success');
    if (typeof updateRecipesList === 'function') updateRecipesList();
}

async function aiChefRegenerateOne(index) {
    const card = document.getElementById(`ai-recipe-card-${index}`);
    if (card) {
        card.innerHTML = `<div style="text-align:center; padding:20px; color:var(--text-secondary);"><i class="fas fa-spinner fa-spin"></i> Подбираю другой вариант...</div>`;
    }

    try {
        if (typeof auth === 'undefined' || !auth.currentUser) throw new Error('Нужно войти в аккаунт');

        const ingredients = (typeof userInventory !== 'undefined' && userInventory) ? userInventory.map(i => i.name).join(', ') : '';
        const allergies = getActiveAllergyLabels();
        const priorityIngredients = window.__aiChefPriority || [];
        const preferences = getUserPreferenceSignals();

        const timeSelect = document.getElementById('ai-chef-max-time');
        const maxTime = (timeSelect && timeSelect.value !== 'any') ? parseInt(timeSelect.value, 10) : null;
        const diffSelect = document.getElementById('ai-chef-difficulty');
        const difficulty = (diffSelect && diffSelect.value !== 'any') ? diffSelect.value : null;

        const activeAllergyKeys = getActiveAllergyKeys();
        const avoid = [...aiChefShownTitles];
        let newRecipe = null;
        let attempts = 0;
        const maxAttempts = 4;

        while (!newRecipe && attempts < maxAttempts) {
            attempts++;
            const idToken = await auth.currentUser.getIdToken();

            const response = await fetch(AXIO_AI_CHEF_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
                body: JSON.stringify({
                    ingredients,
                    count: 1,
                    avoidTitles: avoid,
                    allergies,
                    priorityIngredients,
                    preferences,
                    maxTime,
                    difficulty
                })
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error || `Ошибка ${response.status}`);

            let recipes = data.recipes;
            if (!Array.isArray(recipes)) recipes = [recipes];
            const candidate = recipes[0];
            if (!candidate) continue;

            if (candidate.title) avoid.push(candidate.title);

            if (activeAllergyKeys.length && aiRecipeMatchesActiveAllergies(candidate, activeAllergyKeys)) {
                continue;
            }
            if (aiRecipeMissingCount(candidate) > 0) {
                continue;
            }

            newRecipe = candidate;
        }

        if (!newRecipe) {
            throw new Error('Не получилось подобрать вариант, полностью собирающийся из холодильника, попробуйте ещё раз');
        }

        aiChefShownTitles = avoid.slice(-25);

        window.__aiChefRecipes[index] = newRecipe;
        if (card) card.outerHTML = renderAIRecipeCard(newRecipe, index);

    } catch (error) {
        console.error('AI Chef regenerate error:', error);
        const el = document.getElementById(`ai-recipe-card-${index}`);
        if (el) {
            el.innerHTML = `
                <div style="text-align:center; color:var(--error); padding:15px;">
                    Не получилось подобрать другой вариант.<br>
                    <span style="font-size:0.85em; opacity:0.8;">${escapeHtml(error.message)}</span>
                    <br><button class="btn btn-secondary" style="margin-top:10px;" onclick="aiChefRegenerateOne(${index})"><i class="fas fa-redo"></i> Ещё раз</button>
                </div>`;
        }
    }
}