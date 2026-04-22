const KleinanzeigenAnalyzer = {
    _debounceTimer: null,

    async init() {
        console.log("[KA-ANALYZER] Initialisiere Header & Dashboard...");
        
        // Button immer injizieren (falls möglich)
        KAUI.injectHeaderButton();
        
        if (this.ensureFilters()) return; 
        KAUI.injectDashboard();
        KAUI.lockFilters();
        setTimeout(() => this.run(), 500);
        this.observe();
    },

    ensureFilters() {
        const url = window.location.href;
        if (!url.includes('/s-wohnung-mieten/')) return false;
        let newUrl = url;
        let changed = false;
        if (!url.includes('anzeige:angebote')) {
            newUrl = newUrl.replace('/s-wohnung-mieten/', '/s-wohnung-mieten/anzeige:angebote/');
            changed = true;
        }
        if (!url.includes('wohnung_mieten.swap_s:nein')) {
            if (newUrl.includes('c203')) {
                newUrl = newUrl.replace('c203', 'c203+wohnung_mieten.swap_s:nein');
                changed = true;
            }
        }
        if (changed) { window.location.replace(newUrl); return true; }
        return false;
    },

    async run() {
        KAUI.setLoading();
        KAUI.lockFilters();

        const ads = document.querySelectorAll('article[data-adid], .aditem');
        if (ads.length === 0) { KAUI.setLoading("Warte auf Anzeigen..."); return; }

        const db = await KAStorage.get('rental_db', { ads: {} });
        const now = Date.now();
        let dbChanged = false;

        const currentAdsData = Array.from(ads).map(ad => {
            const data = KARentalParser.extract(ad);
            if (!data) return null;
            if (data.isTop) { KAUI.hideAd(ad); return null; }

            if (!db.ads[data.id] && data.pricePerSqm) {
                db.ads[data.id] = { p: data.pricePerSqm, plz: data.plzFull || "", t: now };
                dbChanged = true;
            }
            return { ad, p: data.pricePerSqm, plz: data.plzFull };
        }).filter(d => d && d.p);

        if (dbChanged) { this.cleanDatabase(db, now); await KAStorage.set('rental_db', db); }

        const allPrices = Object.values(db.ads).map(a => a.p);
        if (allPrices.length === 0) { KAUI.setLoading("Keine Daten vorhanden."); return; }
        
        const globalStats = KAStats.calculate(allPrices);

        currentAdsData.forEach(item => {
            KAUI.markAd(item.ad, item.p, globalStats);
        });

        const regionalMatrix = this.getHistoricalRegionalMatrix(currentAdsData, db);
        
        KAUI.updateDashboard(globalStats, regionalMatrix, db, currentAdsData.length);
        KANavigation.updateVisibleAds(currentAdsData.map(d => d.ad));
    },

    getHistoricalRegionalMatrix(currentData, db) {
        const pagePlzs = [...new Set(currentData.map(d => d.plz && d.plz.substring(0, 4)).filter(Boolean))];
        
        const pageCounts = {};
        currentData.forEach(d => {
            if (d.plz && d.plz.length >= 4) {
                const prefix = d.plz.substring(0, 4);
                pageCounts[prefix] = (pageCounts[prefix] || 0) + 1;
            }
        });

        if (pagePlzs.length === 0) return [];

        return pagePlzs.map(prefix => {
            const allPricesInRegion = Object.values(db.ads)
                .filter(ad => ad.plz && ad.plz.startsWith(prefix))
                .map(ad => ad.p);
            
            if (allPricesInRegion.length === 0) return null;
            
            const stats = KAStats.calculate(allPricesInRegion);
            return {
                plz: prefix + 'X',
                onPage: pageCounts[prefix] || 0,
                inHistory: allPricesInRegion.length,
                q1: stats.q1,
                median: stats.median,
                q3: stats.q3
            };
        }).filter(Boolean).sort((a, b) => b.onPage - a.onPage).slice(0, 3);
    },

    cleanDatabase(db, now) {
        const MAX_ENTRIES = 2000;
        const MAX_AGE = 90 * 24 * 60 * 60 * 1000; 
        for (const id in db.ads) if (now - db.ads[id].t > MAX_AGE) delete db.ads[id];
        const ids = Object.keys(db.ads);
        if (ids.length > MAX_ENTRIES) {
            const sortedIds = ids.sort((a, b) => db.ads[a].t - db.ads[b].t);
            for (let i = 0; i < ids.length - MAX_ENTRIES; i++) delete db.ads[sortedIds[i]];
        }
    },

    observe() {
        let lastUrl = location.href;
        const observer = new MutationObserver(() => {
            KAUI.injectHeaderButton(); // Auch bei URL-Wechsel sicherstellen
            clearTimeout(this._debounceTimer);
            this._debounceTimer = setTimeout(() => {
                KAUI.lockFilters();
                if (location.href !== lastUrl) {
                    lastUrl = location.href;
                    if (this.ensureFilters()) return;
                    KAUI.injectDashboard();
                    this.run();
                } else {
                    const ads = document.querySelectorAll('article[data-adid], .aditem');
                    if (ads.length > 0 && !document.querySelector('.ka-sqm-badge')) {
                        this.run();
                    }
                }
            }, 300);
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }
};
KleinanzeigenAnalyzer.init();
