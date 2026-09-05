/**
 *  Сканер штрих-кода товара — единая точка входа.
 *  Источники поиска по коду (по порядку, первый успешный ответ побеждает):
 *       1) Open Food Facts
 *       2) Open Products Facts
 *       3) UPCitemdb
 *       4) Barcodes-catalog
 *       5) Olegon
 */

(function () {
    'use strict';

    const SCANNER_CONFIG = {
        openFoodFacts: {
            enabled: true
        },

        openProductsFacts: {
            enabled: true
        },

        upcitemdb: {
            enabled: true
        },

        barcodesCatalog: {
            enabled: true
        },

        olegon: {
            enabled: true
        }
    };

    const CATEGORIES = ['Dairy', 'Meat', 'Vegetables', 'Fruits', 'Bakery', 'Other'];
    const UNITS = ['шт', 'г', 'кг', 'мл', 'л'];

    let html5QrCode = null;
    let scanActive = false;
    let lastHandledCode = null;

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
        if (manualInput) {
            manualInput.value = '';
            setupManualInputKeyboardHandling(manualInput);
        }

        lastHandledCode = null;
        startCamera();
    };

    let manualInputKeyboardHandlerAttached = false;
    function setupManualInputKeyboardHandling(inputEl) {
        if (manualInputKeyboardHandlerAttached) return;
        manualInputKeyboardHandlerAttached = true;

        const scrollToInput = function () {
            setTimeout(function () {
                inputEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 300);
        };

        inputEl.addEventListener('focus', scrollToInput);

        if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', function () {
                if (document.activeElement === inputEl) {
                    inputEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            });
        }
    }

    window.closeBarcodeScanner = function () {
        stopCamera();
        const modal = document.getElementById('barcode-scanner-modal');
        if (modal) modal.style.display = 'none';
    };

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
        flashScanSuccess(); // сразу даём понять человеку, что код считался — до всякого поиска по базам
        stopCamera();
        handleScannedCode(decodedText.trim());
    }

    function flashScanSuccess() {
        const el = document.getElementById('barcode-reader');
        if (el) {
            el.classList.add('barcode-scan-flash');
            setTimeout(function () { el.classList.remove('barcode-scan-flash'); }, 450);
        }
        try {
            if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.HapticFeedback) {
                window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
            } else if (navigator.vibrate) {
                navigator.vibrate(60);
            }
        } catch (e) { /* вибрация недоступна - не критично */ }
    }

    function handleScannedCode(code) {
        setStatus(tr('BarcodeFound', 'Штрих-код: ') + code + '. ' + tr('BarcodeSearching', 'Ищем товар в базах...'));
        setError('');
        lookupBarcodeChain(code);
    }

    async function lookupBarcodeChain(code) {
        const sources = [
            { name: 'Open Food Facts', fn: lookupOpenFoodFacts, cfg: SCANNER_CONFIG.openFoodFacts },
            { name: 'Open Products Facts', fn: lookupOpenProductsFacts, cfg: SCANNER_CONFIG.openProductsFacts },
            { name: 'UPCitemdb', fn: lookupUpcItemDb, cfg: SCANNER_CONFIG.upcitemdb },
            { name: 'Barcodes-catalog', fn: lookupBarcodesCatalog, cfg: SCANNER_CONFIG.barcodesCatalog },
            { name: 'Olegon', fn: lookupOlegon, cfg: SCANNER_CONFIG.olegon }
        ];

        let anyEnabled = false;
        let anySucceeded = false;

        for (const source of sources) {
            if (!source.cfg || !source.cfg.enabled) continue;
            anyEnabled = true;
            try {
                setStatus(tr('BarcodeChecking', 'Проверяем: ') + source.name + '...');
                const result = await source.fn(code);
                anySucceeded = true;
                if (result && result.name) {
                    handleProductFound(result, code);
                    return;
                }
            } catch (e) {
                console.warn('[scanner] источник "' + source.name + '" не ответил:', e);
            }
        }

        if (anyEnabled && !anySucceeded) {
            handleLookupNetworkError(code);
        } else {
            handleProductNotFound(code);
        }
    }

    // --- 1) Open Food Facts-----
    async function lookupOpenFoodFacts(code) {
        const url = 'https://world.openfoodfacts.org/api/v2/product/' + encodeURIComponent(code) +
            '.json?fields=product_name,product_name_ru,generic_name,brands,quantity,image_front_small_url,image_url,categories_tags';
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
            rawQuantity: p.quantity || '',
            source: 'Open Food Facts'
        };
    }

    // --- 2) Open Products Facts--
    async function lookupOpenProductsFacts(code) {
        const url = 'https://world.openproductsfacts.org/api/v2/product/' + encodeURIComponent(code) +
            '.json?fields=product_name,product_name_ru,generic_name,brands,quantity,image_front_small_url,image_url,categories_tags';
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
            rawQuantity: p.quantity || '',
            source: 'Open Products Facts'
        };
    }

    // --- 3) UPCitemdb--
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
            rawQuantity: item.size || '',
            source: 'UPCitemdb'
        };
    }

    // --- 4) Barcodes-catalog.ru----
    async function lookupBarcodesCatalog(code) {
        const url = 'https://api.barcodes-catalog.ru/barcode/free_search?barcode=' +
            encodeURIComponent(code) + '&limit=1';
        const res = await fetch(url);
        if (!res.ok) return null;
        const data = await res.json();
        if (!data.barcodes || !data.barcodes.length || !data.barcodes[0].product_name) return null;

        const name = data.barcodes[0].product_name;
        return {
            name: name,
            brand: '',
            image: '',
            category: guessCategoryFromText(name),
            rawQuantity: name,
            source: 'Barcodes-catalog'
        };
    }

    // --- 5) Olegon---
    async function lookupOlegon(code) {
        const url = 'https://barcodes.olegon.ru/api/card/name/' + encodeURIComponent(code);
        const res = await fetch(url);
        if (!res.ok) return null;
        const data = await res.json();
        const names = Array.isArray(data) ? data : (data && data.names);
        if (!names || !names.length) return null;

        const name = typeof names[0] === 'string' ? names[0] : (names[0] && names[0].name);
        if (!name) return null;

        return {
            name: name,
            brand: '',
            image: '',
            category: guessCategoryFromText(name),
            rawQuantity: name,
            source: 'Olegon'
        };
    }

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

    function parseQuantityString(raw) {
        const str = (raw || '').toString().trim().toLowerCase().replace(',', '.');
        if (!str) return null;

        const match = str.match(/(\d+(?:\.\d+)?)\s*(кг|kg|г|g|л|l|мл|ml|шт|pcs)?/);
        if (!match || !match[1]) return null;

        const qty = parseFloat(match[1]);
        if (!qty || qty <= 0) return null;

        const unitMap = {
            kg: 'кг', g: 'г', l: 'л', ml: 'мл', pcs: 'шт',
            кг: 'кг', г: 'г', л: 'л', мл: 'мл', шт: 'шт'
        };
        const unit = unitMap[match[2] || ''] || 'шт';

        return { qty: qty, unit: unit };
    }

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

        const parsedQty = parseQuantityString(product.rawQuantity);
        if (parsedQty) {
            const qtyInput = document.getElementById('product-qty');
            if (qtyInput) qtyInput.value = parsedQty.qty;

            const unitSelect = document.getElementById('product-unit');
            if (unitSelect && UNITS.includes(parsedQty.unit)) {
                unitSelect.value = parsedQty.unit;
            }
        }

        if (product.image) {
            applyScannedImage(product.image);
        }

        if (typeof window.showModal === 'function') {
            window.showModal('add-product-modal');
        }

        toast(tr('BarcodeProductFound', 'Товар найден: ') + product.source, 'success');
    }

    function applyScannedImage(imageUrl) {
        fetch(imageUrl)
            .then(function (r) { return r.blob(); })
            .then(function (blob) {
                const reader = new FileReader();
                reader.onload = function () {
                    const base64 = reader.result;

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
                console.warn('[scanner] не удалось загрузить изображение товара (возможно, CORS)');
            });
    }

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

    function handleLookupNetworkError(code) {
        window.closeBarcodeScanner();

        toast(tr('BarcodeLookupError', 'Код ' + code + ' считан, но проверить базы товаров не удалось (нет соединения). Заполните карточку вручную.'), 'error');

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