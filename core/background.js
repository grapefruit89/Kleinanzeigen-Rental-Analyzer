importScripts('Storage.js');

function applyTrackerRuleset(enabled) {
    const action = enabled
        ? chrome.declarativeNetRequest.updateEnabledRulesets({ enableRulesetIds: ['ruleset_1'] })
        : chrome.declarativeNetRequest.updateEnabledRulesets({ disableRulesetIds: ['ruleset_1'] });

    action.then(() => {
        console.log(`[KA Background] Tracker Blocker ${enabled ? 'ENABLED' : 'DISABLED'}`);
    }).catch((e) => {
        console.error('[KA Background] Ruleset update failed:', e);
    });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'updateTrackerBlocker') {
        applyTrackerRuleset(request.enabled === true);
        sendResponse({ ok: true });
        return true;
    }
});

chrome.storage.local.get(['ka_settings'], (result) => {
    const settings = result.ka_settings || {};
    applyTrackerRuleset(KAStorage.isFeatureEnabled(settings, 'TrackerBlocker'));
});
