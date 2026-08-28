const KAFeatureManager = {
    features: [],
    
    register(featureId, initFn) {
        this.features.push({ id: featureId, initFn });
    },

    async run() {
        const settings = await KAStorage.get('ka_settings', {
            'feature_RentalAnalyzer': true,
            'feature_WasdNavigation': true,
            'feature_UiCleaner': true
        });

        this.features.forEach(feature => {
            const isEnabled = settings[`feature_${feature.id}`] !== false;
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
