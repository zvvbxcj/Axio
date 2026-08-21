// ============================================================
// СКАНЕР ШТРИХ-КОДА / QR-КОДА ТОВАРА
// Ищет товар по коду в открытых базах данных — без API-ключей и регистрации:
// Open Food Facts, Open Beauty Facts, Open Products Facts.
// Используется уже подключённая библиотека html5-qrcode (та же, что и у
// сканера QR-приглашения в общий холодильник).
// ============================================================

let barcodeScannerInstance = null;
let barcodeScanBusy = false; // блокируем повторную обработку, пока идёт поиск по предыдущему коду

const BARCODE_LOOKUP_SOURCES = [
    { name: 'Open Food Facts', base: 'https://world.openfoodfacts.org' },
    { name: 'Open Beauty Facts', base: 'https://world.openbeautyfacts.org' },
    { name: 'Open Products Facts', base: 'https://world.openproductsfacts.org' }
];

async function openBarcodeScanner() {
    const modal = document.getElementById('barcode-scanner-modal');
    const statusEl = document.getElementById('barcode-status');
    const errorEl = document.getElementById('barcode-error');
    const manualInput = document.getElementById('barcode-manual-input');

    if (typeof Html5Qrcode === 'undefined') {
        showToast('Сканер недоступен, попробуйте обновить страницу', 'error');
        return;
    }

    barcodeScanBusy = false;
    if (manualInput) manualInput.value = '';
    if (errorEl) errorEl.style.display = 'none';
    if (statusEl) {
        statusEl.style.display = 'block';
        statusEl.textContent = 'Наведите камеру на штрих-код или QR-код товара';
    }

    modal.style.display = 'flex';

    try {
        barcodeScannerInstance = new Html5Qrcode('barcode-reader');

        const config = { fps: 10, qrbox: { width: 260, height: 160 } };
        // Ограничиваем форматы, если библиотека предоставляет перечисление —
        // так сканер быстрее и реже ложно триггерится на посторонней графике.
        if (typeof Html5QrcodeSupportedFormats !== 'undefined') {
            config.formatsToSupport = [
                Html5QrcodeSupportedFormats.EAN_13,
                Html5QrcodeSupportedFormats.EAN_8,
                Html5QrcodeSupportedFormats.UPC_A,
                Html5QrcodeSupportedFormats.UPC_E,
                Html5QrcodeSupportedFormats.CODE_128,
                Html5QrcodeSupportedFormats.CODE_39,
                Html5QrcodeSupportedFormats.ITF,
                Html5QrcodeSupportedFormats.CODABAR,
                Html5QrcodeSupportedFormats.QR_CODE
            ];
        }

        await barcodeScannerInstance.start(
            { facingMode: 'environment' },
            config,
            (decodedText) => onBarcodeDetected(decodedText),
            () => { /* кадр без кода — штатная ситуация, игнорируем */ }
        );
    } catch (err) {
        console.error('Barcode scanner start error', err);
        if (errorEl) {
            errorEl.textContent = 'Не удалось запустить камеру: ' + err.message + '. Убедитесь, что сайт открыт через HTTPS и дан доступ к камере. Код можно ввести вручную ниже.';
            errorEl.style.display = 'block';
        }
    }
}

async function closeBarcodeScanner() {
    const modal = document.getElementById('barcode-scanner-modal');
    if (barcodeScannerInstance) {
        try {
            await barcodeScannerInstance.stop();
            barcodeScannerInstance.clear();
        } catch (e) {
            // сканер уже мог быть остановлен — не критично
        }
        barcodeScannerInstance = null;
    }
    barcodeScanBusy = false;
    if (modal) modal.style.display = 'none';
}

async function onBarcodeDetected(decodedText) {
    if (barcodeScanBusy) return; // уже ищем предыдущий код — игнорируем новые кадры, пока сканер продолжает работать
    const code = (decodedText || '').trim().replace(/\s+/g, '');
    if (!code) return;
    await processScannedBarcode(code);
}

function submitManualBarcode() {
    const input = document.getElementById('barcode-manual-input');
    const code = (input && input.value || '').trim();
    if (!code) {
        showToast('Введите код товара', 'warning');
        return;
    }
    processScannedBarcode(code);
}

async function processScannedBarcode(code) {
    if (barcodeScanBusy) return;
    barcodeScanBusy = true;

    const statusEl = document.getElementById('barcode-status');
    const errorEl = document.getElementById('barcode-error');
    if (errorEl) errorEl.style.display = 'none';
    if (statusEl) {
        statusEl.style.display = 'block';
        statusEl.textContent = `Ищу товар по коду ${code}...`;
    }

    try {
        const found = await lookupBarcodeInOpenDatabases(code);

        if (!found) {
            if (statusEl) statusEl.style.display = 'none';
            if (errorEl) {
                errorEl.innerHTML = `Товар с кодом <b>${code}</b> не найден в открытых базах.<br>Можно навести камеру на другой код, ввести код вручную ещё раз, или заполнить карточку самостоятельно.`;
                errorEl.style.display = 'block';
            }
            barcodeScanBusy = false; // разрешаем сканировать/вводить следующий код, сканер продолжает работать
            return;
        }

        await closeBarcodeScanner();
        applyBarcodeProductToForm(found, code);

    } catch (e) {
        console.error('Barcode lookup error', e);
        if (statusEl) statusEl.style.display = 'none';
        if (errorEl) {
            errorEl.textContent = 'Ошибка при поиске товара: ' + e.message + '. Попробуйте ещё раз или введите код вручную.';
            errorEl.style.display = 'block';
        }
        barcodeScanBusy = false;
    }
}

// Ищем код последовательно по трём открытым базам Open ...Facts.
// Все три — бесплатные, без ключей и регистрации, с открытым CORS для чтения.
async function lookupBarcodeInOpenDatabases(code) {
    const fields = 'product_name,product_name_ru,generic_name,brands,quantity,categories_tags,image_front_url,image_url,status';
    for (const source of BARCODE_LOOKUP_SOURCES) {
        try {
            const url = `${source.base}/api/v2/product/${encodeURIComponent(code)}.json?fields=${fields}`;
            const res = await fetch(url);
            if (!res.ok) continue;
            const data = await res.json();
            if (data && data.status === 1 && data.product) {
                return { product: data.product, sourceName: source.name };
            }
        } catch (e) {
            console.warn(`Ошибка запроса к ${source.name}:`, e.message);
            // база недоступна — пробуем следующую
        }
    }
    return null;
}

const BARCODE_CATEGORY_KEYWORDS = [
    { category: 'Dairy', words: ['dairy', 'milk', 'cheese', 'yogurt', 'yoghurt', 'молок', 'сыр', 'йогурт', 'творог', 'сметан', 'кефир'] },
    { category: 'Meat', words: ['meat', 'poultry', 'chicken', 'beef', 'pork', 'sausage', 'fish', 'seafood', 'мяс', 'куриц', 'говяд', 'свинин', 'колбас', 'рыб'] },
    { category: 'Vegetables', words: ['vegetable', 'legume', 'овощ', 'картоф', 'капуст', 'огур', 'помидор', 'морков'] },
    { category: 'Fruits', words: ['fruit', 'berries', 'фрукт', 'ягод', 'яблок', 'банан', 'апельсин'] },
    { category: 'Bakery', words: ['bread', 'bakery', 'pastry', 'biscuit', 'cake', 'хлеб', 'выпечк', 'булк', 'печень', 'торт'] }
];

function guessCategoryFromBarcodeProduct(product) {
    const haystack = [
        ...(Array.isArray(product.categories_tags) ? product.categories_tags : []),
        product.product_name || '',
        product.generic_name || ''
    ].join(' ').toLowerCase();

    for (const entry of BARCODE_CATEGORY_KEYWORDS) {
        if (entry.words.some(w => haystack.includes(w))) return entry.category;
    }
    return 'Other';
}

// Разбирает строки вида "1 л", "500 г", "0.5 kg" — берём первое число + единицу измерения.
function parseQuantityFromBarcodeProduct(product) {
    const raw = (product.quantity || '').toString().toLowerCase().replace(',', '.');
    const match = raw.match(/(\d+(?:\.\d+)?)\s*(кг|kg|г|g|л|l|мл|ml|шт|pcs)?/);
    if (!match) return { qty: 1, unit: 'шт' };

    const qty = parseFloat(match[1]) || 1;
    const unitRaw = match[2] || '';
    const unitMap = { kg: 'кг', g: 'г', l: 'л', ml: 'мл', pcs: 'шт', кг: 'кг', г: 'г', л: 'л', мл: 'мл', шт: 'шт' };
    const unit = unitMap[unitRaw] || 'шт';
    return { qty, unit };
}

function applyBarcodeProductToForm(found, code) {
    const product = found.product;
    const name = (product.product_name_ru || product.product_name || product.generic_name || product.brands || 'Товар').toString().slice(0, 60);
    const category = guessCategoryFromBarcodeProduct(product);
    const { qty, unit } = parseQuantityFromBarcodeProduct(product);
    const image = product.image_front_url || product.image_url || '';

    showModal('add-product-modal');

    const nameInput = document.getElementById('product-name');
    if (nameInput) nameInput.value = name;

    const qtyInput = document.getElementById('product-qty');
    if (qtyInput) qtyInput.value = qty;

    const unitSelect = document.getElementById('product-unit');
    if (unitSelect) unitSelect.value = unit;

    const categorySelect = document.getElementById('product-category');
    if (categorySelect) categorySelect.value = category;

    if (image) {
        currentImageBase64 = image;
        const preview = document.getElementById('preview-image');
        if (preview) {
            preview.src = image;
            preview.style.display = 'block';
        }
        const removeBtn = document.getElementById('remove-image-btn');
        if (removeBtn) removeBtn.style.display = 'block';
    }

    // Срок годности база данных не знает — ставим ориентировочную дату (+7 дней),
    // чтобы не блокировать обязательное поле формы; пользователь может поправить.
    const expiryInput = document.getElementById('product-expiry');
    if (expiryInput && !expiryInput.value) {
        const d = new Date();
        d.setDate(d.getDate() + 7);
        expiryInput.value = d.toISOString().split('T')[0];
    }

    showToast(`Найдено в ${found.sourceName}: ${name}`, 'success');
}
