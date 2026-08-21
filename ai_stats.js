const AXIO_AI_STATS_ENDPOINT = 'stats-ai.axioaxio.workers.dev';

let aiStatsBusy = false;

async function generateAiStatsAnalysis() {
    if (aiStatsBusy) return;

    const btn = document.getElementById('ai-stats-btn');
    const content = document.getElementById('ai-stats-content');
    if (!content) return;

    if (typeof userHistory === 'undefined' || !userHistory || userHistory.length === 0) {
        content.innerHTML = '<div style="color:var(--text-secondary); text-align:center; padding:10px;">Пока недостаточно данных для анализа — приготовьте что-нибудь!</div>';
        return;
    }

    aiStatsBusy = true;
    if (btn) {
        btn.disabled = true;
        btn.dataset.oldText = btn.dataset.oldText || btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Анализирую...';
    }
    content.innerHTML = '<div style="text-align:center; padding:16px; color:var(--text-secondary);"><div class="dots-loader" style="margin:0 auto 10px;"></div>Нейросеть изучает вашу статистику...</div>';

    try {
        if (typeof auth === 'undefined' || !auth.currentUser) {
            throw new Error('Нужно войти в аккаунт, чтобы пользоваться AI-анализом');
        }

        // Тот же принцип авторизации, что у AI Chef / AI Scan — Firebase ID-токен,
        // но воркер здесь другой, со своим Gemini-ключом.
        const idToken = await auth.currentUser.getIdToken();

        const period = (typeof currentStatsPeriod !== 'undefined' && currentStatsPeriod) ? currentStatsPeriod : 'week';
        const stats = buildAiStatsPayload(period);
        const lang = (typeof currentLang !== 'undefined' && currentLang) ? currentLang : 'ru';

        const response = await fetch(AXIO_AI_STATS_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${idToken}`
            },
            body: JSON.stringify({ stats, lang })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || `Ошибка ${response.status}`);
        }

        renderAiStatsResult(data);

    } catch (error) {
        console.error('AI Stats Error:', error);
        content.innerHTML = `
            <div style="text-align:center; color:var(--error); padding:16px;">
                <i class="fas fa-exclamation-triangle" style="font-size:1.6em; margin-bottom:8px;"></i><br>
                Не удалось получить анализ.<br>
                <span style="font-size:0.8em; opacity:0.7">${error.message}</span>
            </div>`;
    } finally {
        aiStatsBusy = false;
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = btn.dataset.oldText || '<i class="fas fa-wand-magic-sparkles"></i> Проанализировать';
        }
    }
}

// Собираем компактную сводку статистики за период — те же расчёты, что и в
// calculateAndRenderStats(), но в виде JSON-объекта для отправки нейросети,
// а не записи в DOM.
function buildAiStatsPayload(period) {
    if (typeof userHistory === 'undefined' || !userHistory) userHistory = [];
    const now = new Date();

    const filteredHistory = userHistory.filter(item => {
        if (!item.date) return false;
        const itemDate = new Date(item.date);
        if (period === 'all') return true;
        if (period === 'month') {
            const d = new Date();
            d.setMonth(now.getMonth() - 1);
            return itemDate >= d;
        }
        if (period === 'week') {
            const d = new Date();
            d.setDate(now.getDate() - 7);
            return itemDate >= d;
        }
        return true;
    });

    const cookedItems = filteredHistory.filter(i => i.type === 'cook');
    const wastedItems = filteredHistory.filter(i => i.type === 'waste');

    const favCategory = getMostFrequent(cookedItems.map(i => i.category));

    let allIngredients = [];
    cookedItems.forEach(i => { if (i.ingredients) allIngredients.push(...i.ingredients); });
    const topIngredient = getMostFrequent(allIngredients);

    const totalTime = cookedItems.reduce((acc, cur) => acc + (cur.time || 30), 0);
    const avgTime = cookedItems.length ? Math.round(totalTime / cookedItems.length) : 0;

    const dayNames = cookedItems.map(i => new Date(i.date).toLocaleDateString('ru-RU', { weekday: 'long' }));
    const busyDay = getMostFrequent(dayNames);

    const uniqueRecipes = new Set(cookedItems.map(i => i.recipeId || i.recipeName)).size;
    const variety = cookedItems.length ? Math.round((uniqueRecipes / cookedItems.length) * 100) : 0;

    const co2Saved = (typeof estimateCO2Saved === 'function') ? estimateCO2Saved(cookedItems) : 0;

    const total = cookedItems.length + wastedItems.length;
    let ecoScore = '-';
    if (total > 0) {
        const wasteRatio = wastedItems.length / total;
        if (wasteRatio > 0.5) ecoScore = 'D';
        else if (wasteRatio > 0.3) ecoScore = 'C';
        else if (wasteRatio > 0.1) ecoScore = 'B';
        else ecoScore = 'A+';
    }

    const inventory = (typeof userInventory !== 'undefined' && userInventory) ? userInventory : [];
    const inventoryByCategory = {};
    inventory.forEach(p => {
        const cat = p.category || 'Other';
        inventoryByCategory[cat] = (inventoryByCategory[cat] || 0) + 1;
    });
    const expiredCount = (typeof isExpired === 'function') ? inventory.filter(p => isExpired(p.expiryDate)).length : 0;
    const expiringSoonCount = (typeof isExpiringSoon === 'function' && typeof isExpired === 'function')
        ? inventory.filter(p => isExpiringSoon(p.expiryDate) && !isExpired(p.expiryDate)).length
        : 0;

    return {
        period,
        cookedCount: cookedItems.length,
        wastedCount: wastedItems.length,
        favCategory: favCategory || null,
        topIngredient: topIngredient || null,
        avgCookTimeMin: avgTime,
        totalCookTimeHours: Math.round((totalTime / 60) * 10) / 10,
        busyDay: busyDay || null,
        varietyPercent: variety,
        co2SavedKg: co2Saved,
        ecoScore,
        inventoryTotal: inventory.length,
        inventoryByCategory,
        inventoryExpiredCount: expiredCount,
        inventoryExpiringSoonCount: expiringSoonCount,
        level: (typeof userLevel !== 'undefined') ? userLevel : null,
        xp: (typeof userXp !== 'undefined') ? userXp : null
    };
}

function renderAiStatsResult(data) {
    const content = document.getElementById('ai-stats-content');
    if (!content) return;

    const headline = data && data.headline
        ? `<div style="font-weight:800; font-size:1.05em; margin-bottom:6px; color:var(--primary);">${data.headline}</div>`
        : '';

    const summary = data && data.summary
        ? `<div style="color:var(--text-secondary); margin-bottom:12px; line-height:1.4;">${data.summary}</div>`
        : '';

    const strengths = data && Array.isArray(data.strengths) && data.strengths.length
        ? `<div style="margin-bottom:10px;">
               <div style="font-weight:700; font-size:0.85em; margin-bottom:4px;">💪 Что хорошо получается</div>
               <ul style="padding-left:18px; margin:0; color:var(--text-secondary);">${data.strengths.map(s => `<li>${s}</li>`).join('')}</ul>
           </div>`
        : '';

    const suggestions = data && Array.isArray(data.suggestions) && data.suggestions.length
        ? `<div>
               <div style="font-weight:700; font-size:0.85em; margin-bottom:4px;">💡 Что можно улучшить</div>
               <ul style="padding-left:18px; margin:0; color:var(--text-secondary);">${data.suggestions.map(s => `<li>${s}</li>`).join('')}</ul>
           </div>`
        : '';

    if (!headline && !summary && !strengths && !suggestions) {
        content.innerHTML = '<div style="color:var(--text-secondary); text-align:center; padding:10px;">Не удалось разобрать ответ нейросети. Попробуйте ещё раз.</div>';
        return;
    }

    content.innerHTML = headline + summary + strengths + suggestions;
}