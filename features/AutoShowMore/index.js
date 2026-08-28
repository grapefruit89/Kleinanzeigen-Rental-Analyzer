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
    const MAX_CLICKS = 15;               // Sicherheitsnetz -- garantiert kein Unendlich-Klicken
    const CLICK_WAIT_MS = 900;           // Zeit zum Nachladen nach einem Klick
    const BUSY_RECHECK_MS = 300;         // kurze Nachpruefung, falls der Button gerade laedt
    const INITIAL_SEARCH_ATTEMPTS = 10;  // wie oft anfangs auf das Erscheinen des Buttons gewartet wird
    const INITIAL_SEARCH_INTERVAL_MS = 500;

    let clickCount = 0;

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

    function clickLoop() {
        if (clickCount >= MAX_CLICKS) {
            console.log(`[KA AutoShowMore] Sicherheitslimit erreicht (${MAX_CLICKS} Klicks), stoppe.`);
            return;
        }

        let button;
        try {
            button = findButton();
        } catch (e) {
            console.error('[KA AutoShowMore] Fehler bei der Button-Suche, stoppe sicherheitshalber:', e);
            return;
        }

        if (!button) {
            console.log(`[KA AutoShowMore] Kein Button mehr da (nach ${clickCount} Klicks) -- fertig geladen.`);
            return;
        }

        try {
            if (button.getAttribute('aria-busy') === 'true') {
                // Der aktuelle Batch laedt noch -- kurz erneut pruefen statt zu klicken
                setTimeout(clickLoop, BUSY_RECHECK_MS);
                return;
            }

            clickCount++;
            console.log(`[KA AutoShowMore] 'Weitere Anzeigen' geklickt (${clickCount}/${MAX_CLICKS})`);
            button.click();
        } catch (e) {
            console.error('[KA AutoShowMore] Fehler beim Klicken, stoppe sicherheitshalber:', e);
            return; // im Zweifel lieber aufhoeren als moeglicherweise falsch weitermachen
        }

        setTimeout(clickLoop, CLICK_WAIT_MS);
    }

    function waitForFirstAppearance(attempt = 0) {
        let button = null;
        try {
            button = findButton();
        } catch (e) {
            console.error('[KA AutoShowMore] Fehler bei der Erstsuche:', e);
        }

        if (button) {
            clickLoop();
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
