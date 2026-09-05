const KAFeatureManager = {
    features: [],

    register(featureId, initFn) {
        this.features.push({ id: featureId, initFn });
    },

    async run() {
        const settings = await KAStorage.get('ka_settings', {});

        this.features.forEach(feature => {
            const isEnabled = KAStorage.isFeatureEnabled(settings, feature.id);
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

KAFeatureManager.run();
