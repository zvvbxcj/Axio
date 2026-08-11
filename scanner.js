/**
 * scanner.js
 * -----------------------------------------------------------------------
 * Штрих-код сканер для Axio.
 *
 * Что делает:
 *  1. Открывает камеру (через библиотеку html5-qrcode, уже подключена в
 *     index.html) и распознаёт EAN-13 / EAN-8 / UPC-A / UPC-E коды.
 *  2. По найденному коду опрашивает несколько баз данных товаров подряд
 *     (Fallback Chain) — если в одной товар не нашёлся, автоматически
 *     идёт запрос в следующую:
 *
 *       1) Open Food Facts   — бесплатно, без ключа, без лимитов
 *       2) UPCitemdb (trial) — бесплатно, без ключа, лимит ~100 запросов/день
 *       3) Barcode Spider    — нужен свой API-ключ (см. SCANNER_CONFIG ниже)
 *       4) EAN-Search        — нужен свой API-ключ (см. SCANNER_CONFIG ниже)
 *
 *  3. Найденные название/фото/категорию подставляет в форму
 *     #add-product-modal и открывает её пользователю на проверку.
 *  4. Если товар не найден нигде — открывает ту же форму пустой, чтобы
 *     пользователь заполнил её вручную, а поле штрих-кода видно в подсказке.
 *
 * Зависимости: html5-qrcode (unpkg), функции showModal/hideModal/showToast,
 * поля формы #product-name/#product-category/#preview-image и т.д. —
 * все уже есть в index.html.
 * -----------------------------------------------------------------------
 */

(function () {
    'use strict';

    // =====================================================================
    // НАСТРОЙКИ. Ключи для платных/условно-бесплатных API вписываешь сюда.
    // Если ключа нет — просто оставь enabled: false, скрипт спокойно
    // пропустит этот источник и пойдёт дальше по цепочке.
    // =====================================================================
    const SCANNER_CONFIG = {
        openFoodFacts: {
            enabled: true // всегда бесплатно, ключ не нужен
        },
        upcitemdb: {
            enabled: true // бесплатный trial-эндпоинт, ключ не нужен, лимит ~100/день
        },
        barcodeSpider: {
            enabled: false,     // поставь true, когда получишь ключ на barcodespider.com
            apiKey: ''
        },
        eanSearch: {
            enabled: false,     // поставь true, когда получишь токен на ean-search.org
            apiKey: ''
        }
    };

    // Категории формы add-product-modal (см. index.html)
    const CATEGORIES = ['Dairy', 'Meat', 'Vegetables', 'Fruits', 'Bakery', 'Other'];

    let html5QrCode = null;
    let scanActive = false;
    let lastHandledCode = null;

    // ---------------------------------------------------------------
    // Мелкие хелперы, максимально безопасно переиспользующие функции
    // самого приложения (если их вдруг нет — не падаем).
    // ---------------------------------------------------------------
    function toast(message, type) {
        if (typeof window.showToast === 'function') {
            window.showToast(message, type);
        } else {
            console.log('[scanner:' + (type || 'info') + ']', message);
        }
    }

    function tr(key, fallback) {
        try {
            if (typeof window.translations !== 'undefined' &&
                typeof window.currentLang !== 'undefined' &&
                window.translations[window.currentLang] &&
                window.translations[window.currentLang][key]) {
                return window.translations[window.currentLang][key];
            }
        } catch (e) { /* игнор */ }
        return fallback;
    }

    function setStatus(text) {
        const el = document.getElementById('barcode-status');
        if (el) el.textContent = text;
    }

    function setError(text) {
        const el = document.getElementById('barcode-error');
        if (!el) return;
        if (text) {
            el.textContent = text;
            el.style.display = 'block';
        } else {
            el.textContent = '';
            el.style.display = 'none';
        }
    }

    // =====================================================================
    // Открытие / закрытие модалки со сканером
    // =====================================================================
    window.openBarcodeScanner = function () {
        if (typeof window.hideModal === 'function') window.hideModal('add-choice-modal');

        const modal = document.getElementById('barcode-scanner-modal');
        if (!modal) {
            toast('Окно сканера не найдено в разметке', 'error');
            return;
        }

        modal.style.display = 'flex';
        setStatus(tr('BarcodeStatusReady', 'Наведите камеру на штрих-код'));
        setError('');
        const manualInput = document.getElementById('barcode-manual-input');
        if (manualInput) manualInput.value = '';

        lastHandledCode = null;
        startCamera();
    };

    window.closeBarcodeScanner = function () {
        stopCamera();
        const modal = document.getElementById('barcode-scanner-modal');
        if (modal) modal.style.display = 'none';
    };

    // Ручной ввод штрих-кода — на случай, если камера недоступна
    // (нет разрешения, старое устройство, повреждённая упаковка и т.п.)
    window.submitManualBarcode = function () {
        const input = document.getElementById('barcode-manual-input');
        const code = input ? input.value.trim() : '';
        if (!code) {
            toast(tr('BarcodeEmptyManual', 'Введите штрих-код цифрами'), 'warning');
            return;
        }
        if (!/^\d{6,14}$/.test(code)) {
            toast(tr('BarcodeInvalidManual', 'Похоже, это не похоже на штрих-код'), 'warning');
            return;
        }
        handleScannedCode(code);
    };

    // =====================================================================
    // Работа с камерой (html5-qrcode)
    // =====================================================================
    function startCamera() {
        if (typeof Html5Qrcode === 'undefined') {
            setError(tr('BarcodeLibMissing', 'Библиотека сканера не загрузилась. Проверьте интернет-соединение и обновите страницу.'));
            return;
        }

        const readerEl = document.getElementById('barcode-reader');
        if (!readerEl) return;
        readerEl.innerHTML = '';

        html5QrCode = new Html5Qrcode('barcode-reader');

        const formats = (typeof Html5QrcodeSupportedFormats !== 'undefined')
            ? [
                Html5QrcodeSupportedFormats.EAN_13,
                Html5QrcodeSupportedFormats.EAN_8,
                Html5QrcodeSupportedFormats.UPC_A,
                Html5QrcodeSupportedFormats.UPC_E,
                Html5QrcodeSupportedFormats.CODE_128,
                Html5QrcodeSupportedFormats.CODE_39
              ]
            : undefined;

        const config = {
            fps: 10,
            qrbox: { width: 270, height: 150 },
            aspectRatio: 1.4,
            disableFlip: false
        };
        if (formats) config.formatsToSupport = formats;

        scanActive = true;

        html5QrCode
            .start({ facingMode: 'environment' }, config, onScanFrame, function () {
                // ошибки распознавания отдельного кадра — это нормально, игнорируем
            })
            .catch(function (err) {
                scanActive = false;
                console.error('[scanner] camera start failed', err);
                setError(tr('BarcodeCameraDenied', 'Не удалось включить камеру. Проверьте, что доступ к камере разрешён в браузере/Telegram, либо введите штрих-код вручную.'));
            });
    }

    function stopCamera() {
        scanActive = false;
        if (html5QrCode) {
            const instance = html5QrCode;
            html5QrCode = null;
            instance.stop()
                .then(function () { instance.clear(); })
                .catch(function () { /* уже остановлена — игнор */ });
        }
    }

    function onScanFrame(decodedText) {
        if (!scanActive) return;
        if (decodedText === lastHandledCode) return; // защита от повторного срабатывания на том же кадре
        scanActive = false; // не даём сработать второй раз, пока идёт поиск
        lastHandledCode = decodedText;
        stopCamera();
        handleScannedCode(decodedText.trim());
    }

    // =====================================================================
    // Обработка распознанного/введённого кода
    // =====================================================================
    function handleScannedCode(code) {
        setStatus(tr('BarcodeFound', 'Штрих-код: ') + code + '. ' + tr('BarcodeSearching', 'Ищем товар в базах...'));
        setError('');
        lookupBarcodeChain(code);
    }

    // Цепочка источников — идём по порядку, первый успешный ответ побеждает
    async function lookupBarcodeChain(code) {
        const sources = [
            { name: 'Open Food Facts', fn: lookupOpenFoodFacts, cfg: SCANNER_CONFIG.openFoodFacts },
            { name: 'UPCitemdb', fn: lookupUpcItemDb, cfg: SCANNER_CONFIG.upcitemdb },
            { name: 'Barcode Spider', fn: lookupBarcodeSpider, cfg: SCANNER_CONFIG.barcodeSpider },
            { name: 'EAN-Search', fn: lookupEanSearch, cfg: SCANNER_CONFIG.eanSearch }
        ];

        for (const source of sources) {
            if (!source.cfg || !source.cfg.enabled) continue;
            try {
                setStatus(tr('BarcodeChecking', 'Проверяем: ') + source.name + '...');
                const result = await source.fn(code);
                if (result && result.name) {
                    handleProductFound(result, code);
                    return;
                }
            } catch (e) {
                console.warn('[scanner] источник "' + source.name + '" не ответил:', e);
                // просто идём дальше по цепочке
            }
        }

        handleProductNotFound(code);
    }

    // --- 1) Open Food Facts ------------------------------------------------
    async function lookupOpenFoodFacts(code) {
        const url = 'https://world.openfoodfacts.org/api/v2/product/' + encodeURIComponent(code) +
            '.json?fields=product_name,product_name_ru,generic_name,brands,image_front_small_url,image_url,categories_tags';
        const res = await fetch(url);
        if (!res.ok) return null;
        const data = await res.json();
        if (data.status !== 1 || !data.product) return null;

        const p = data.product;
        const name = p.product_name_ru || p.product_name || p.generic_name;
        if (!name) return null;

        return {
            name: name,
            brand: p.brands || '',
            image: p.image_front_small_url || p.image_url || '',
            category: mapOpenFoodFactsCategory(p.categories_tags),
            source: 'Open Food Facts'
        };
    }

    // --- 2) UPCitemdb (бесплатный trial, без ключа, лимит ~100/день) -------
    async function lookupUpcItemDb(code) {
        const url = 'https://api.upcitemdb.com/prod/trial/lookup?upc=' + encodeURIComponent(code);
        const res = await fetch(url);
        if (!res.ok) return null;
        const data = await res.json();
        if (!data.items || !data.items.length) return null;

        const item = data.items[0];
        if (!item.title) return null;

        return {
            name: item.title,
            brand: item.brand || '',
            image: (item.images && item.images.length) ? item.images[0] : '',
            category: guessCategoryFromText(item.category || item.title),
            source: 'UPCitemdb'
        };
    }

    // --- 3) Barcode Spider (нужен свой ключ) --------------------------------
    async function lookupBarcodeSpider(code) {
        const key = SCANNER_CONFIG.barcodeSpider.apiKey;
        if (!key) return null;
        const url = 'https://api.barcodespider.com/v1/lookup?token=' + encodeURIComponent(key) +
            '&upc=' + encodeURIComponent(code);
        const res = await fetch(url);
        if (!res.ok) return null;
        const data = await res.json();
        if (!data.item_response || data.item_response.code !== 200 || !data.item_attributes) return null;

        const item = data.item_attributes;
        if (!item.title) return null;

        return {
            name: item.title,
            brand: item.brand || '',
            image: item.image || '',
            category: guessCategoryFromText(item.category || item.title),
            source: 'Barcode Spider'
        };
    }

    // --- 4) EAN-Search (нужен свой токен) -----------------------------------
    async function lookupEanSearch(code) {
        const key = SCANNER_CONFIG.eanSearch.apiKey;
        if (!key) return null;
        const url = 'https://api.ean-search.org/api?token=' + encodeURIComponent(key) +
            '&op=barcode-lookup&ean=' + encodeURIComponent(code) + '&format=json';
        const res = await fetch(url);
        if (!res.ok) return null;
        const data = await res.json();
        if (!Array.isArray(data) || !data.length || !data[0].name) return null;

        return {
            name: data[0].name,
            brand: '',
            image: '',
            category: guessCategoryFromText(data[0].categoryName || data[0].name),
            source: 'EAN-Search'
        };
    }

    // ---------------------------------------------------------------
    // Определение категории товара по тегам/тексту (грубая эвристика,
    // пользователь всегда может поправить категорию вручную в форме)
    // ---------------------------------------------------------------
    function mapOpenFoodFactsCategory(tags) {
        if (!Array.isArray(tags) || !tags.length) return 'Other';
        return guessCategoryFromText(tags.join(' '));
    }

    function guessCategoryFromText(text) {
        if (!text) return 'Other';
        const s = text.toLowerCase();
        if (/dairy|milk|молок|сыр|йогурт|творог|cheese|yogurt/.test(s)) return 'Dairy';
        if (/meat|poultry|мясо|курин|говядин|свинин|колбас|sausage|chicken|beef|pork/.test(s)) return 'Meat';
        if (/vegetable|овощ|картоф|морков|капуст/.test(s)) return 'Vegetables';
        if (/fruit|фрукт|ягод|яблок|банан|апельсин/.test(s)) return 'Fruits';
        if (/bread|bakery|pastr|хлеб|выпечк|булк/.test(s)) return 'Bakery';
        return 'Other';
    }

    // =====================================================================
    // Товар найден — подставляем данные в форму add-product-modal
    // =====================================================================
    function handleProductFound(product, code) {
        window.closeBarcodeScanner();

        const nameInput = document.getElementById('product-name');
        if (nameInput) nameInput.value = product.brand
            ? (product.brand + ' ' + product.name).trim()
            : product.name;

        const categorySelect = document.getElementById('product-category');
        if (categorySelect && CATEGORIES.includes(product.category)) {
            categorySelect.value = product.category;
        }

        if (product.image) {
            applyScannedImage(product.image);
        }

        if (typeof window.showModal === 'function') {
            window.showModal('add-product-modal');
        }

        toast(tr('BarcodeProductFound', 'Товар найден: ') + product.source, 'success');
    }

    // Подтягиваем картинку товара в предпросмотр формы (переиспользуем
    // те же элементы, что и обычная загрузка фото из галереи/камеры).
    function applyScannedImage(imageUrl) {
        fetch(imageUrl)
            .then(function (r) { return r.blob(); })
            .then(function (blob) {
                const reader = new FileReader();
                reader.onload = function () {
                    const base64 = reader.result;

                    // Приложение хранит текущее фото в глобальной переменной
                    // currentImageBase64 (см. addProduct() в index.html)
                    try { window.currentImageBase64 = base64; } catch (e) { /* игнор */ }

                    const hiddenInput = document.getElementById('product-image');
                    if (hiddenInput) hiddenInput.value = base64;

                    const preview = document.getElementById('preview-image');
                    if (preview) {
                        preview.src = base64;
                        preview.style.display = 'block';
                    }

                    const removeBtn = document.getElementById('remove-image-btn');
                    if (removeBtn) removeBtn.style.display = 'block';
                };
                reader.readAsDataURL(blob);
            })
            .catch(function () {
                // Некоторые источники блокируют кросс-доменную загрузку картинки (CORS) —
                // это не критично, товар всё равно добавится, просто без фото.
                console.warn('[scanner] не удалось загрузить изображение товара (возможно, CORS)');
            });
    }

    // =====================================================================
    // Товар не найден ни в одном источнике — открываем форму пустой
    // =====================================================================
    function handleProductNotFound(code) {
        window.closeBarcodeScanner();

        toast(tr('BarcodeNotFound', 'Товар со штрих-кодом ' + code + ' не найден. Заполните карточку вручную.'), 'warning');

        const nameInput = document.getElementById('product-name');
        if (nameInput) {
            nameInput.value = '';
            nameInput.placeholder = tr('BarcodeManualPlaceholder', 'Штрих-код: ') + code;
        }

        if (typeof window.showModal === 'function') {
            window.showModal('add-product-modal');
        }
    }

})();
