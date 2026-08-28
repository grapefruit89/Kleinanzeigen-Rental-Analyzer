KAFeatureManager.register('SortSaver', () => {
    const SORT_STORAGE_KEY = 'kleinanzeigen_preferredSortOrder';

    async function applySortingIfNoManualOverride() {
        const savedSortValue = await KAStorage.get(SORT_STORAGE_KEY, null);
        const aktuellesSortierfeldInput = document.querySelector('#sortingField-selector-value');
        
        if (savedSortValue && aktuellesSortierfeldInput && aktuellesSortierfeldInput.value !== savedSortValue) {
            const zielOption = document.querySelector(`.srchresult-sorting li.selectbox-option[data-value="${savedSortValue}"]`);
            if (zielOption) {
                console.log("[KA] Setze Sortierung auf gespeicherten Wert:", savedSortValue);
                zielOption.click();
            }
        }
    }

    function setupSortListeners() {
        const sortOptionsContainer = document.querySelector('.srchresult-sorting ul.selectbox-list');
        if (!sortOptionsContainer || sortOptionsContainer.dataset.listenerAttached) {
            return;
        }
        
        sortOptionsContainer.dataset.listenerAttached = 'true';
        const sortOptions = sortOptionsContainer.querySelectorAll('li.selectbox-option');
        
        sortOptions.forEach(option => {
            option.addEventListener('click', async function() {
                const newSortValue = this.getAttribute('data-value');
                await KAStorage.set(SORT_STORAGE_KEY, newSortValue);
                console.log('[KA] Sortierung manuell geändert und gespeichert:', newSortValue);
            });
        });
    }

    function initSorting() {
        setupSortListeners();
        applySortingIfNoManualOverride();
    }

    // Attempt immediately and via observer
    initSorting();
    
    const sortObserver = new MutationObserver(() => {
        const sortContainer = document.querySelector('.srchresult-sorting');
        if (sortContainer) {
            initSorting();
        }
    });
    sortObserver.observe(document.body, { childList: true, subtree: true });
});
