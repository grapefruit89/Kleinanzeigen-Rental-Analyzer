const KAStorage = {
    _cache: {},

    featureKey(id) {
        if (!id) return 'feature_unknown';
        return String(id).startsWith('feature_') ? String(id) : `feature_${id}`;
    },

    isFeatureEnabled(settings, id) {
        return (settings || {})[this.featureKey(id)] === true;
    },

    async get(key, defaultValue = null) {
        if (Object.prototype.hasOwnProperty.call(this._cache, key)) {
            return this._cache[key];
        }
        return new Promise((resolve) => {
            chrome.storage.local.get([key], (result) => {
                const val = result[key] !== undefined ? result[key] : defaultValue;
                this._cache[key] = val;
                resolve(val);
            });
        });
    },

    async set(key, value) {
        this._cache[key] = value;
        return new Promise((resolve) => {
            chrome.storage.local.set({ [key]: value }, () => resolve());
        });
    },

    clearCache() {
        this._cache = {};
    }
};
