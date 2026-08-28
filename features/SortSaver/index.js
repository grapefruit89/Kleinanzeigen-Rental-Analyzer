KAFeatureManager.register('SortSaver', () => {
    const SORT_STORAGE_KEY = 'kleinanzeigen_preferredSortOrder';

    let isApplying = false;
    let lastClickTime = 0;
    const CLICK_COOLDOWN_MS = 2000; // Nie öfter als alle 2s klicken -- verhindert Klick-Feedback-Schleifen

    async function applySortingIfNoManualOverride() {
        if (isApplying) return;
        isApplying = true;
        try {
            const savedSortValue = await KAStorage.get(SORT_STORAGE_KEY, null);
            const aktuellesSortierfeldInput = document.querySelector('#sortingField-selector-value');

            if (savedSortValue && aktuellesSortierfeldInput && aktuellesSortierfeldInput.value !== savedSortValue) {
                if (Date.now() - lastClickTime < CLICK_COOLDOWN_MS) return; // Warte, bis die Seite den letzten Klick verarbeitet hat

                const zielOption = document.querySelector(`.srchresult-sorting li.selectbox-option[data-value="${savedSortValue}"]`);
                if (zielOption) {
                    console.log("[KA] Setze Sortierung auf gespeicherten Wert:", savedSortValue);
                    lastClickTime = Date.now();
                    zielOption.click();
                }
            }
        } finally {
            isApplying = false;
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

    // Sofort versuchen
    initSorting();

    // Bei DOM-Änderungen erneut versuchen -- aber gedebounced, sonst feuert das bei
    // jeder einzelnen Mutation (Bilder laden, andere Module räumen auf, etc.) und kann
    // sich mit den Klicks selbst eine Schleife bauen, die den Tab lahmlegt.
    let debounceTimer = null;
    const sortObserver = new MutationObserver(() => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            const sortContainer = document.querySelector('.srchresult-sorting');
            if (sortContainer) {
                initSorting();
            }
        }, 400);
    });
    sortObserver.observe(document.body, { childList: true, subtree: true });
});
