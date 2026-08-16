const GEMINI_API_KEY = "AIzaSyCTvAM3RX_P2TiIEtXQmi0GGNWbXStHwXc";

let aiChefShownTitles = [];
let aiChefLastInventorySignature = '';

function getInventorySignature() {
    if (typeof userInventory === 'undefined' || !userInventory) return '';
    return userInventory.map(item => item.name).sort().join('|');
}

async function generateAIRecipe(count) {
    const btn = document.querySelector('#ai-chef-modal .btn-primary') || document.getElementById('btn-ai-chef');
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
        const avoidBlock = aiChefShownTitles.length > 0
            ? `Пользователь уже видел эти блюда, НЕ предлагай их снова и придумай другие: ${aiChefShownTitles.join(', ')}.`
            : '';

        const promptText = `
            Ты — профессиональный шеф-повар. Придумай ${count} ${count === 1 ? 'вкусный рецепт' : 'разных вкусных рецепта'}, используя эти ингредиенты: ${ingredients}.
            Базовые вещи (соль, перец, вода, масло) можно использовать по умолчанию.
            Если ингредиентов мало, придумай что-то простое.
            ${count > 1 ? 'Рецепты должны существенно отличаться друг от друга — разные блюда, а не вариации одного и того же.' : ''}
            ${avoidBlock}
            Твой ответ должен быть СТРОГО в формате JSON-МАССИВА без markdown-разметки (даже если рецепт один — всё равно верни массив из одного элемента), по структуре:
            [
              {
                "title": "Название блюда",
                "time": "Время (например: 30 мин)",
                "difficulty": "Сложность (Легко, Средне или Сложно)",
                "ingredients": ["ингредиент 1", "ингредиент 2"],
                "instructions": ["шаг 1", "шаг 2"]
              }
            ]
        `;

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [{ parts: [{ text: promptText }] }],
                generationConfig: {
                    temperature: 0.9,
                    responseMimeType: "application/json"
                }
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error("Детали ошибки от API:", errorData);
            throw new Error(`Ошибка ${response.status}: ${errorData.error?.message || 'Неизвестная ошибка'}`);
        }

        const data = await response.json();
        let jsonString = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!jsonString) {
            throw new Error('Пустой ответ от модели (возможно, сработал фильтр безопасности)');
        }

        jsonString = jsonString.trim().replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/```\s*$/, '');
        let recipes = JSON.parse(jsonString);
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