document.addEventListener('DOMContentLoaded', () => {
    const checkboxes = {
        'feature_RentalAnalyzer': document.getElementById('feature_RentalAnalyzer'),
        'feature_WasdNavigation': document.getElementById('feature_WasdNavigation'),
        'feature_UiCleaner': document.getElementById('feature_UiCleaner'),
        'feature_HighResZoom': document.getElementById('feature_HighResZoom'),
        'feature_SortSaver': document.getElementById('feature_SortSaver'),
        'feature_WidescreenLayout': document.getElementById('feature_WidescreenLayout'),
        'feature_AutoShowMore': document.getElementById('feature_AutoShowMore'),
        'feature_TrackerBlocker': document.getElementById('feature_TrackerBlocker'),
        'feature_CleanHomepage': document.getElementById('feature_CleanHomepage'),
        'feature_ProAdManager': document.getElementById('feature_ProAdManager'),
        'feature_DataExport': document.getElementById('feature_DataExport')
    };

    chrome.storage.local.get(['ka_settings'], (result) => {
        const settings = result.ka_settings || {};
        
        for (const [key, checkbox] of Object.entries(checkboxes)) {
            checkbox.checked = settings[key] !== false;
            
            checkbox.addEventListener('change', () => {
                settings[key] = checkbox.checked;
                chrome.storage.local.set({ ka_settings: settings });

                if (key === 'feature_TrackerBlocker') {
                    chrome.runtime.sendMessage({
                        action: "updateTrackerBlocker",
                        enabled: checkbox.checked
                    });
                }
                
                // Auto reload
                chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                    if (tabs[0]) {
                        chrome.tabs.reload(tabs[0].id);
                    }
                });
            });
        }
    });
});

