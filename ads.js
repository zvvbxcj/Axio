const ADSGRAM_IDS = {
    INTERSTITIAL: "int-42641",
    REWARDED: "42640",
    BANNER: "task-20298",
    NATIVE_TASK: "task-42642"
};

const AdController = {
    // 1. Показ межстраничной рекламы (Interstitial)
    async showInterstitial() {
        const ad = window.Adsgram.init({ blockId: ADSGRAM_IDS.INTERSTITIAL });
        try {
            await ad.show();
            console.log("Adsgram: Interstitial показан");
        } catch (e) {
            console.error("Adsgram Interstitial error:", e);
        }
    },

    // 2. Показ рекламы за вознаграждение (Rewarded)
    async showRewarded() {
        return new Promise((resolve) => {
            const ad = window.Adsgram.init({ blockId: ADSGRAM_IDS.REWARDED });
            ad.show().then(() => {
                console.log("Adsgram: Rewarded просмотрен полностью");
                resolve(true);
            }).catch((e) => {
                console.error("Adsgram Rewarded error:", e);
                resolve(false);
            });
        });
    },

    // 3. Баннер
    getBannerHTML() {
        return `
            <div class="adsgram-banner-container" style="width: 100%; margin: 15px 0; min-height: 100px; display: flex; justify-content: center;">
                <div id="adsgram-banner-target"></div>
            </div>`;
    },

    initBanner() {
        const target = document.getElementById('adsgram-banner-target');
        if (target) {
            const ad = window.Adsgram.init({ blockId: ADSGRAM_IDS.BANNER });
            ad.show().catch(e => console.error("Banner error:", e));
        }
    }
};

function shouldInsertAdsgram(index) {
    const pos = index + 1;
    return (pos === 4 || (pos > 4 && (pos - 4) % 16 === 0));
}