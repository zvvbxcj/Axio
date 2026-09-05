const AXIO_AI_CHEF_ENDPOINT = 'https://ai-gemini.axioaxio.workers.dev';

let aiChefShownTitles = [];
let aiChefLastInventorySignature = '';

window.__aiChefRefineHistory = window.__aiChefRefineHistory || {};

function aiChefGetChipValue(groupId, fallback) {
    const el = document.getElementById(groupId);
    return el ? (el.dataset.value || fallback) : fallback;
}

function initAiChefChipGroups() {
    document.querySelectorAll('#ai-chef-modal .ai-chip-group').forEach(group => {
        if (group.dataset.__bound) return;
        group.dataset.__bound = '1';
        group.addEventListener('click', (e) => {
            const btn = e.target.closest('.ai-chip');
            if (!btn || !group.contains(btn)) return;
            group.querySelectorAll('.ai-chip').forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            group.dataset.value = btn.dataset.value;
        });
    });
}
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAiChefChipGroups);
} else {
    initAiChefChipGroups();
}

const AI_CHEF_KNOWN_CATEGORIES = ['breakfast', 'soup', 'main', 'salad', 'pasta', 'dessert', 'baking', 'snacks', 'vegetarian', 'drinks'];
const AI_CHEF_DIFFICULTY_EN = { 'Легко': 'Easy', 'Средне': 'Medium', 'Сложно': 'Hard' };

const AI_CHEF_BASE_PANTRY = [
    'соль', 'перец', 'вода', 'масло', 'сахар', 'специи', 'приправ',
    'уксус', 'сода', 'разрыхлитель', 'ванилин', 'ваниль', 'лавровый лист'
];

function aiIngredientIsBasePantry(name) {
    const n = String(name || '').toLowerCase();
    return AI_CHEF_BASE_PANTRY.some(base => n.includes(base));
}


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

function getPriorityExpiringIngredients(limit) {
    if (typeof userInventory === 'undefined' || !userInventory) return [];
    return userInventory
        .map(p => ({ name: p.name, days: (typeof getDaysUntilExpiry === 'function') ? getDaysUntilExpiry(p.expiryDate) : null }))
        .filter(p => p.days !== null && p.days <= 6)
        .sort((a, b) => a.days - b.days)
        .slice(0, limit || 8)
        .map(p => p.name);
}

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

    if (typeof count !== 'number') {
        count = parseInt(aiChefGetChipValue('ai-chef-count-group', '1'), 10);
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

    const timeVal = aiChefGetChipValue('ai-chef-time-group', 'any');
    const maxTime = (timeVal !== 'any') ? parseInt(timeVal, 10) : null;

    const diffVal = aiChefGetChipValue('ai-chef-difficulty-group', 'any');
    const difficulty = (diffVal !== 'any') ? diffVal : null;

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
        const maxAttempts = 5;

        while (matched.length < count && attempts < maxAttempts) {
            attempts++;
            const toFetch = Math.min(Math.max(count - matched.length, 3), 5);
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
            if (activeAllergyKeys.length) {
                const before = batch.length;
                batch = batch.filter(r => !aiRecipeMatchesActiveAllergies(r, activeAllergyKeys));
                if (batch.length < before) hadDiscarded = true;
            }
            const before = batch.length;
            const fullMatch = batch.filter(r => aiRecipeMissingCount(r) === 0);
            if (fullMatch.length < before) hadDiscarded = true;

            matched.push(...fullMatch);
        }

        matched = matched.slice(0, count);

        aiChefShownTitles = avoid.slice(-25);

        window.__aiChefRecipes = matched;
        window.__aiChefPriority = priorityIngredients;
        window.__aiChefRefineHistory = {};

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

function aiIngredientMatchesName(ingName, targetName) {
    if (typeof ingredientNamesMatch === 'function') return ingredientNamesMatch(ingName, targetName);
    return String(ingName || '').toLowerCase() === String(targetName || '').toLowerCase();
}

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
    if (typeof recipesDB !== 'undefined' && recipesDB) recipesDB.push(appRecipe);

    return id;
}

function renderAIRecipeCard(recipe, index) {
    const ingredientsNorm = (recipe.ingredients || []).map(normalizeAIIngredient);
    const priority = window.__aiChefPriority || [];

    let usesExpiringCount = 0;

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

    const refineHistory = (window.__aiChefRefineHistory && window.__aiChefRefineHistory[index]) || [];
    const refineMessagesHtml = refineHistory.map(m => `<div class="ai-refine-msg ai-refine-msg-${m.role === 'user' ? 'user' : 'ai'}">${escapeHtml(m.text)}</div>`).join('');
    const refineOpen = refineHistory.length > 0;

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
            <div class="ai-refine-block" id="ai-refine-block-${index}">
                <button type="button" class="ai-refine-toggle" onclick="aiChefToggleRefine(${index})">
                    <i class="fas fa-comment-dots"></i> Доработать рецепт
                </button>
                <div class="ai-refine-panel" id="ai-refine-panel-${index}" style="display:${refineOpen ? 'block' : 'none'};">
                    <div class="ai-refine-messages" id="ai-refine-messages-${index}">${refineMessagesHtml}</div>
                    <div class="ai-refine-input-row">
                        <input type="text" class="ai-refine-input" id="ai-refine-input-${index}"
                               placeholder="Например: замени кефир на молоко"
                               onkeydown="if(event.key==='Enter'){event.preventDefault(); aiChefRefineRecipe(${index});}">
                        <button type="button" class="ai-refine-send" onclick="aiChefRefineRecipe(${index})" title="Отправить">
                            <i class="fas fa-paper-plane"></i>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function aiChefCook(index) {
    const recipe = (window.__aiChefRecipes || [])[index];
    if (!recipe) return;
    const id = materializeAIRecipe(recipe);
    hideModal('ai-chef-modal');
    showRecipeDetail(id);
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

        const timeVal = aiChefGetChipValue('ai-chef-time-group', 'any');
        const maxTime = (timeVal !== 'any') ? parseInt(timeVal, 10) : null;
        const diffVal = aiChefGetChipValue('ai-chef-difficulty-group', 'any');
        const difficulty = (diffVal !== 'any') ? diffVal : null;

        const activeAllergyKeys = getActiveAllergyKeys();
        const avoid = [...aiChefShownTitles];
        let newRecipe = null;
        let attempts = 0;
        const maxAttempts = 5;

        while (!newRecipe && attempts < maxAttempts) {
            attempts++;
            const idToken = await auth.currentUser.getIdToken();

            const response = await fetch(AXIO_AI_CHEF_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
                body: JSON.stringify({
                    ingredients,
                    count: 3,
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

            for (const candidate of recipes) {
                if (!candidate) continue;
                if (candidate.title) avoid.push(candidate.title);

                if (activeAllergyKeys.length && aiRecipeMatchesActiveAllergies(candidate, activeAllergyKeys)) {
                    continue;
                }
                if (aiRecipeMissingCount(candidate) > 0) {
                    continue;
                }

                newRecipe = candidate;
                break;
            }
        }

        if (!newRecipe) {
            throw new Error('Не получилось подобрать вариант, полностью собирающийся из холодильника, попробуйте ещё раз');
        }

        aiChefShownTitles = avoid.slice(-25);

        window.__aiChefRecipes[index] = newRecipe;
        if (window.__aiChefRefineHistory) window.__aiChefRefineHistory[index] = [];
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

function aiChefToggleRefine(index) {
    const panel = document.getElementById(`ai-refine-panel-${index}`);
    if (!panel) return;
    const isHidden = !panel.style.display || panel.style.display === 'none';
    panel.style.display = isHidden ? 'block' : 'none';
    if (isHidden) {
        const box = document.getElementById(`ai-refine-messages-${index}`);
        if (box) box.scrollTop = box.scrollHeight;
        const input = document.getElementById(`ai-refine-input-${index}`);
        if (input) input.focus();
    }
}

async function aiChefRefineRecipe(index) {
    const input = document.getElementById(`ai-refine-input-${index}`);
    const sendBtn = document.querySelector(`#ai-refine-block-${index} .ai-refine-send`);
    const box = document.getElementById(`ai-refine-messages-${index}`);
    const recipe = (window.__aiChefRecipes || [])[index];
    if (!input || !recipe) return;

    const message = input.value.trim();
    if (!message) return;

    if (!window.__aiChefRefineHistory) window.__aiChefRefineHistory = {};
    if (!window.__aiChefRefineHistory[index]) window.__aiChefRefineHistory[index] = [];
    const history = window.__aiChefRefineHistory[index];

    history.push({ role: 'user', text: message });
    if (box) {
        box.insertAdjacentHTML('beforeend', `<div class="ai-refine-msg ai-refine-msg-user">${escapeHtml(message)}</div>`);
        box.scrollTop = box.scrollHeight;
    }
    input.value = '';
    input.disabled = true;
    if (sendBtn) sendBtn.disabled = true;

    const typingId = `ai-refine-typing-${index}`;
    if (box) {
        box.insertAdjacentHTML('beforeend', `<div class="ai-refine-msg ai-refine-msg-ai" id="${typingId}"><i class="fas fa-spinner fa-spin"></i> Шеф дорабатывает рецепт...</div>`);
        box.scrollTop = box.scrollHeight;
    }

    try {
        if (typeof auth === 'undefined' || !auth.currentUser) throw new Error('Нужно войти в аккаунт');

        const ingredientsStr = (typeof userInventory !== 'undefined' && userInventory) ? userInventory.map(i => i.name).join(', ') : '';
        const allergies = getActiveAllergyLabels();
        const activeAllergyKeys = getActiveAllergyKeys();
        const idToken = await auth.currentUser.getIdToken();

        const response = await fetch(AXIO_AI_CHEF_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
            body: JSON.stringify({
                action: 'refine',
                recipe: {
                    title: recipe.title,
                    category: recipe.category,
                    time: recipe.time,
                    difficulty: recipe.difficulty,
                    ingredients: recipe.ingredients,
                    steps: recipe.steps || recipe.instructions
                },
                message,
                history: history.slice(0, -1),
                ingredients: ingredientsStr,
                allergies
            })
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || `Ошибка ${response.status}`);

        const updated = data.recipe;
        if (!updated || !updated.title) throw new Error('Не удалось обновить рецепт');

        if (activeAllergyKeys.length && aiRecipeMatchesActiveAllergies(updated, activeAllergyKeys)) {
            throw new Error('Обновлённый вариант нарушает ваши пищевые ограничения — попробуйте сформулировать иначе');
        }

        history.push({ role: 'ai', text: (data.summary && String(data.summary).trim()) || `Готово: «${updated.title}»` });

        window.__aiChefRecipes[index] = updated;

        const card = document.getElementById(`ai-recipe-card-${index}`);
        if (card) card.outerHTML = renderAIRecipeCard(updated, index);

    } catch (error) {
        console.error('AI Chef refine error:', error);
        const typingEl = document.getElementById(typingId);
        if (typingEl) typingEl.remove();
        if (box) {
            box.insertAdjacentHTML('beforeend', `<div class="ai-refine-msg ai-refine-msg-error">Не получилось: ${escapeHtml(error.message)}</div>`);
            box.scrollTop = box.scrollHeight;
        }
        const input2 = document.getElementById(`ai-refine-input-${index}`);
        if (input2) input2.disabled = false;
        const sendBtn2 = document.querySelector(`#ai-refine-block-${index} .ai-refine-send`);
        if (sendBtn2) sendBtn2.disabled = false;
    }
}