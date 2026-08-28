chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "updateTrackerBlocker") {
        const isEnabled = request.enabled;
        
        if (isEnabled) {
            chrome.declarativeNetRequest.updateEnabledRulesets({
                enableRulesetIds: ["ruleset_1"]
            }).then(() => console.log("[KA Background] Tracker Blocker ENABLED"));
        } else {
            chrome.declarativeNetRequest.updateEnabledRulesets({
                disableRulesetIds: ["ruleset_1"]
            }).then(() => console.log("[KA Background] Tracker Blocker DISABLED"));
        }
    }
});

// Initialize on startup based on storage
chrome.storage.local.get(['ka_settings'], (result) => {
    const settings = result.ka_settings || {};
    const isEnabled = settings['feature_TrackerBlocker'] !== false; // Default true
    
    if (isEnabled) {
        chrome.declarativeNetRequest.updateEnabledRulesets({
            enableRulesetIds: ["ruleset_1"]
        });
    } else {
        chrome.declarativeNetRequest.updateEnabledRulesets({
            disableRulesetIds: ["ruleset_1"]
        });
    }
});
