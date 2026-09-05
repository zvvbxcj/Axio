const ADSGRAM_IDS = {
    INTERSTITIAL: ["int-44793", "int-44794"],
    REWARDED: ["44795", "44796"], 
    BANNER: "task-44797",
    NATIVE_TASK: "task-44792"
};

const AdRotation = {
    counters: {},
    getNextId(type) {
        const ids = ADSGRAM_IDS[type];
        if (!Array.isArray(ids)) return ids;
        if (!(type in this.counters)) this.counters[type] = 0;
        const id = ids[this.counters[type] % ids.length];
        this.counters[type]++;
        return id;
    }
};

const AdController = {
    // 1. Показ межстраничной рекламы (Interstitial)
    async showInterstitial() {
        const blockId = AdRotation.getNextId('INTERSTITIAL');
        const ad = window.Adsgram.init({ blockId });
        try {
            await ad.show();
            console.log(`Adsgram: Interstitial показан (blockId: ${blockId})`);
        } catch (e) {
            console.error("Adsgram Interstitial error:", e);
        }
    },

    // 2. Показ рекламы за вознаграждение (Rewarded)
    async showRewarded() {
        return new Promise((resolve) => {
            const blockId = AdRotation.getNextId('REWARDED');
            const ad = window.Adsgram.init({ blockId });
            ad.show().then(() => {
                console.log(`Adsgram: Rewarded просмотрен полностью (blockId: ${blockId})`);
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