const AI_SCAN_VALID_CATEGORIES = ['Dairy', 'Meat', 'Vegetables', 'Fruits', 'Bakery', 'Other'];
const AI_SCAN_VALID_UNITS = ['шт', 'г', 'кг', 'мл', 'л'];

let aiScanRecognizedItems = [];

function openAiScanCamera() {
    aiScanRecognizedItems = [];
    openCameraInterface('ai-scan');
}

function closeAiScanReview() {
    document.getElementById('ai-scan-review-modal').style.display = 'none';
}

async function handleAiScanCapture(dataUrl) {
    const modal = document.getElementById('ai-scan-review-modal');
    const loadingEl = document.getElementById('ai-scan-loading');
    const errorEl = document.getElementById('ai-scan-error');
    const listEl = document.getElementById('ai-scan-list');
    const confirmBtn = document.getElementById('ai-scan-confirm-btn');

    modal.style.display = 'flex';
    loadingEl.style.display = 'block';
    errorEl.style.display = 'none';
    listEl.style.display = 'none';
    listEl.innerHTML = '';
    confirmBtn.style.display = 'none';

    try {
        const base64Data = dataUrl.split(',')[1]; // убираем префикс data:image/jpeg;base64,
        const mimeMatch = dataUrl.match(/^data:([^;]+);base64,/);
        const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';

        if (!AXIO_AI_CHEF_ENDPOINT || AXIO_AI_CHEF_ENDPOINT.startsWith('ВСТАВЬ')) {
            throw new Error('Серверная функция AI не настроена (см. AXIO_AI_CHEF_ENDPOINT в ai_chef.js)');
        }
        if (typeof auth === 'undefined' || !auth.currentUser) {
            throw new Error('Нужно войти в аккаунт, чтобы пользоваться сканером');
        }

        // Тот же Firebase ID-токен, что и у AI-шефа — воркер проверяет его одинаково для обоих действий
        const idToken = await auth.currentUser.getIdToken();

        const response = await fetch(AXIO_AI_CHEF_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${idToken}`
            },
            body: JSON.stringify({
                action: 'scan',
                imageBase64: base64Data,
                mimeType
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || `Ошибка ${response.status}`);
        }

        let items = data.items;
        if (!Array.isArray(items)) items = [];

        items = items.map(item => ({
            name: (item.name || 'Продукт').toString().slice(0, 60),
            category: AI_SCAN_VALID_CATEGORIES.includes(item.category) ? item.category : 'Other',
            qty: (typeof item.qty === 'number' && item.qty > 0) ? item.qty : 1,
            unit: AI_SCAN_VALID_UNITS.includes(item.unit) ? item.unit : 'шт',
            shelf_life_days: (Number.isInteger(item.shelf_life_days) && item.shelf_life_days > 0) ? item.shelf_life_days : 5
        }));

        aiScanRecognizedItems = items;
        loadingEl.style.display = 'none';

        if (items.length === 0) {
            errorEl.style.display = 'block';
            errorEl.innerHTML = '<i class="fas fa-search" style="font-size:2em; margin-bottom:10px; display:block;"></i>Не удалось распознать продукты на фото.<br>Попробуйте сделать фото при хорошем освещении, ближе к продуктам.';
            return;
        }

        renderAiScanReview();
        listEl.style.display = 'block';
        confirmBtn.style.display = 'block';

    } catch (error) {
        console.error("AI Scan Error:", error);
        loadingEl.style.display = 'none';
        errorEl.style.display = 'block';
        errorEl.innerHTML = `<i class="fas fa-exclamation-triangle" style="font-size:2em; margin-bottom:10px; display:block;"></i>Не получилось распознать фото.<br><span style="font-size:0.8em; opacity:0.7">${error.message}</span>`;
    }
}

function renderAiScanReview() {
    const listEl = document.getElementById('ai-scan-list');

    const categoryLabels = {
        Dairy: 'Молочные', Meat: 'Мясо и птица', Vegetables: 'Овощи',
        Fruits: 'Фрукты', Bakery: 'Выпечка', Other: 'Прочее'
    };

    listEl.innerHTML = aiScanRecognizedItems.map((item, index) => `
        <div class="ai-scan-item-row" style="display:flex; align-items:center; gap:10px; padding:12px; margin-bottom:8px; background:var(--surface-light); border-radius:12px;">
            <input type="checkbox" id="ai-scan-check-${index}" checked style="width:20px; height:20px; flex-shrink:0;">
            <div style="flex:1; min-width:0;">
                <input type="text" id="ai-scan-name-${index}" value="${item.name.replace(/"/g, '&quot;')}" class="styled-input" style="width:100%; margin-bottom:6px; font-weight:600;">
                <div style="display:flex; gap:6px;">
                    <input type="number" id="ai-scan-qty-${index}" value="${item.qty}" min="0.1" step="0.1" class="styled-input" style="width:70px;">
                    <select id="ai-scan-unit-${index}" class="styled-select" style="flex:0 0 70px;">
                        ${AI_SCAN_VALID_UNITS.map(u => `<option value="${u}" ${u === item.unit ? 'selected' : ''}>${u}</option>`).join('')}
                    </select>
                    <select id="ai-scan-category-${index}" class="styled-select" style="flex:1;">
                        ${AI_SCAN_VALID_CATEGORIES.map(c => `<option value="${c}" ${c === item.category ? 'selected' : ''}>${categoryLabels[c]}</option>`).join('')}
                    </select>
                </div>
            </div>
        </div>
    `).join('');
}

function confirmAiScanAdd() {
    let addedCount = 0;
    const today = new Date();

    aiScanRecognizedItems.forEach((item, index) => {
        const checkbox = document.getElementById(`ai-scan-check-${index}`);
        if (!checkbox || !checkbox.checked) return;

        const name = document.getElementById(`ai-scan-name-${index}`).value.trim();
        const qty = parseFloat(document.getElementById(`ai-scan-qty-${index}`).value);
        const unit = document.getElementById(`ai-scan-unit-${index}`).value;
        const category = document.getElementById(`ai-scan-category-${index}`).value;

        if (!name || !qty || qty <= 0) return;

        const expiry = new Date(today);
        expiry.setDate(expiry.getDate() + item.shelf_life_days);

        const newProduct = {
            id: Date.now() + index, // уникальность внутри одного батча
            name: name,
            category: category,
            qty: qty,
            unit: unit,
            image: '',
            expiryDate: expiry.toISOString().split('T')[0],
            addedDate: new Date().toISOString()
        };

        userInventory.push(newProduct);
        addedCount++;
    });

    if (addedCount === 0) {
        showToast('Выберите хотя бы один продукт', 'warning');
        return;
    }

    saveData();
    updateInventoryList();
    updateHeader();
    if (typeof checkAchievements === 'function') {
        checkAchievements('add');
        checkAchievements('count');
    }

    closeAiScanReview();
    showToast(`Добавлено продуктов: ${addedCount}`, 'success');
}