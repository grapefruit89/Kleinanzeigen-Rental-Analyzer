const KAStorage = {
    _cache: {},

    async get(key, defaultValue = null) {
        if (this._cache[key]) return this._cache[key];
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
