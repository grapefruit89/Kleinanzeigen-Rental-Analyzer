KAFeatureManager.register('AutoShowMore', () => {
    // Only run on homepage
    if (window.location.pathname !== '/' && window.location.pathname !== '') {
        return;
    }

    // Kleinanzeigen laedt auf der Startseite in mehreren Batches nach -- ein
    // einzelner Klick auf "Weitere Anzeigen" reicht nicht, der Button taucht
    // danach erneut auf (manuell getestet: nach ca. 4 Klicks ist er weg, also
    // fertig geladen). Bewusst KEIN MutationObserver mehr: der hat bei jeder
    // fremden Mutation auf der Seite (Werbung, Tracking-Skripte) unnoetig
    // mitgefeuert und war schon mehrfach Ursache von Freezes (SortSaver,
    // HighResZoom, InPageMenu). Stattdessen eine einfache, zeitgesteuerte
    // Klick-Warte-Schleife: klicken, kurz warten bis nachgeladen ist, pruefen ob
    // der Button noch da ist, ggf. wiederholen -- mit hartem Limit, damit das
    // niemals endlos laeuft, selbst wenn Kleinanzeigen das Verhalten mal aendert.
    const MAX_LOOPS = 5;               // Sicherheitsnetz -- garantiert kein Unendlich-Klicken
    const QUICK_CLICK_COUNT = 4;       // So oft wird schnell hintereinander geklickt
    const QUICK_CLICK_DELAY_MS = 50;   // Kurze Pause zwischen den schnellen Klicks
    const CHECK_DELAY_MS = 1000;         // Warten nach der 4er-Salve, um zu prüfen ob er noch da ist
    const INITIAL_SEARCH_ATTEMPTS = 10;  // wie oft anfangs auf das Erscheinen des Buttons gewartet wird
    const INITIAL_SEARCH_INTERVAL_MS = 500;

    let loopCount = 0;

    function findButton() {
        try {
            const button = document.querySelector('div.flex.justify-center.p-small button');
            if (!button) return null;
            if (getComputedStyle(button).display === 'none') return null;
            if (button.getAttribute('aria-disabled') === 'true') return null;
            return button;
        } catch (e) {
            console.error('[KA AutoShowMore] Fehler beim Suchen des Buttons:', e);
            return null;
        }
    }

    async function clickRoutine() {
        if (loopCount >= MAX_LOOPS) {
            console.log(`[KA AutoShowMore] Sicherheitslimit erreicht (${MAX_LOOPS} Durchläufe), stoppe.`);
            return;
        }

        const button = findButton();
        if (!button) {
            console.log(`[KA AutoShowMore] Kein Button mehr da (nach ${loopCount} Durchläufen) -- fertig geladen.`);
            return;
        }

        loopCount++;
        console.log(`[KA AutoShowMore] Button gefunden, feuer ${QUICK_CLICK_COUNT}x Klick-Salve ab (Durchlauf ${loopCount}/${MAX_LOOPS})`);

        for (let i = 0; i < QUICK_CLICK_COUNT; i++) {
            const currentBtn = findButton();
            if (currentBtn) {
                currentBtn.click();
                await new Promise(r => setTimeout(r, QUICK_CLICK_DELAY_MS));
            } else {
                break; // Button ist schon vor dem 4. Klick verschwunden
            }
        }

        // Nach der Klick-Salve warten, ob der Button überlebt hat oder neu geladen wurde
        setTimeout(clickRoutine, CHECK_DELAY_MS);
    }

    function waitForFirstAppearance(attempt = 0) {
        let button = null;
        try {
            button = findButton();
        } catch (e) {
            console.error('[KA AutoShowMore] Fehler bei der Erstsuche:', e);
        }

        if (button) {
            clickRoutine();
            return;
        }

        if (attempt >= INITIAL_SEARCH_ATTEMPTS) {
            console.log('[KA AutoShowMore] Button nach mehreren Versuchen nicht gefunden -- gebe auf.');
            return;
        }

        setTimeout(() => waitForFirstAppearance(attempt + 1), INITIAL_SEARCH_INTERVAL_MS);
    }

    waitForFirstAppearance();
});
