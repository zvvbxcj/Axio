const AXIO_AI_CHEF_ENDPOINT = 'https://ai-gemini.axioaxio.workers.dev';

let aiChefShownTitles = [];
let aiChefLastInventorySignature = '';

function getInventorySignature() {
    if (typeof userInventory === 'undefined' || !userInventory) return '';
    return userInventory.map(item => item.name).sort().join('|');
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
                count,
                avoidTitles: aiChefShownTitles
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || `Ошибка ${response.status}`);
        }

        let recipes = data.recipes;
        if (!Array.isArray(recipes)) recipes = [recipes];

        recipes.forEach(r => {
            if (r && r.title) aiChefShownTitles.push(r.title);
        });
        if (aiChefShownTitles.length > 25) {
            aiChefShownTitles = aiChefShownTitles.slice(-25);
        }

        if (content) {
            content.innerHTML =
                recipes.map(renderAIRecipeCard).join('') +
                `<button class="btn btn-secondary" onclick="generateAIRecipe()" style="width:100%; margin-top:5px;">
                    <i class="fas fa-redo"></i> Предложить другой вариант
                </button>`;
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

function renderAIRecipeCard(recipe) {
    return `
        <div class="recipe-card" style="cursor: default; border: 2px solid var(--accent); padding: 15px; border-radius: 12px; background: var(--surface-light); margin-bottom: 15px;">
            <h3 style="margin-top:0; color:var(--primary); font-size: 1.4em;">${recipe.title}</h3>
            <div class="recipe-meta" style="margin-bottom: 15px; display: flex; gap: 15px; color: var(--text-secondary); font-size: 0.9em;">
                <span><i class="far fa-clock"></i> ${recipe.time}</span>
                <span><i class="fas fa-signal"></i> ${recipe.difficulty}</span>
            </div>
            <div class="recipe-ingredients" style="margin-bottom: 15px;">
                <strong style="color: var(--text-primary);">Ингредиенты:</strong>
                <ul style="padding-left: 20px; margin-top: 5px; color: var(--text-secondary);">
                    ${recipe.ingredients.map(i => `<li>${i}</li>`).join('')}
                </ul>
            </div>
            <div class="recipe-instructions">
                <strong style="color: var(--text-primary);">Приготовление:</strong>
                <ol style="padding-left: 20px; margin-top: 5px; color: var(--text-secondary);">
                    ${recipe.instructions.map(i => `<li style="margin-bottom: 8px;">${i}</li>`).join('')}
                </ol>
            </div>
        </div>
    `;
}