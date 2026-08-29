const KAFeatureManager = {
    features: [],
    
    register(featureId, initFn) {
        this.features.push({ id: featureId, initFn });
    },

    // 29.08.2026 (Grok-Review, live bestaetigt): Default war bisher "an, ausser
    // explizit auf false gesetzt" (!== false). Kombiniert mit 5 Features, die einen
    // MutationObserver auf document.body/documentElement haengen (ProAdManager,
    // RentalAnalyzer x2, HighResZoom-Fallback, InPageMenu), lief bei jeder Neuinstallation
    // sofort alles gleichzeitig -- das war der Haupttreiber fuer die sporadischen
    // Tab-Freezes, nicht ein einzelner Bug. Umgedreht auf Opt-in (=== true): ohne
    // gespeicherte Einstellung ist ein Feature jetzt AUS, der Nutzer schaltet ueber das
    // In-Page-Menu gezielt an, was er braucht. Siehe features/InPageMenu/index.js fuer
    // das Gegenstueck (Checkbox-Default dort MUSS dieselbe Logik nutzen, sonst zeigt das
    // Menu "an" fuer Features, die tatsaechlich nicht laufen).
    async run() {
        const settings = await KAStorage.get('ka_settings', {});

        this.features.forEach(feature => {
            const isEnabled = settings[`feature_${feature.id}`] === true;
            if (isEnabled) {
                document.body.classList.add(`ka-feature-${feature.id.toLowerCase()}`);
                console.log(`[KA] Feature enabled: ${feature.id}`);
                try {
                    feature.initFn();
                } catch (e) {
                    console.error(`[KA] Error initializing feature ${feature.id}:`, e);
                }
            }
        });
    }
};

// Start everything when scripts are loaded. The document is idle in run_at: document_idle.
KAFeatureManager.run();
