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
    const INITIAL_SEARCH_ATTEMPTS = 10;  // wie oft anfangs auf das Erscheinen des Buttons gewartet wird
    const INITIAL_SEARCH_INTERVAL_MS = 500;

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

    async function autoClicker() {
        console.log("[KA AutoShowMore] Starte schnellen Auto-Klicker...");
        let emptyChecks = 0;
        let clickCount = 0;

        while (true) {
            if (clickCount >= 15) {
                console.log("[KA AutoShowMore] Sicherheitslimit von 15 Klicks erreicht. Stoppe.");
                break;
            }

            const button = findButton();
            
            if (!button) {
                // Button ist nicht da. Wir warten 50ms und zählen mit.
                emptyChecks++;
                // Wenn der Button für 20 Checks (ca. 1 Sekunde) komplett weg bleibt, sind wir fertig.
                if (emptyChecks >= 20) {
                    console.log(`[KA AutoShowMore] Button ist verschwunden. (Insgesamt ${clickCount}x geklickt). Fertig!`);
                    break;
                }
                await new Promise(r => setTimeout(r, 50));
                continue;
            }

            // Button existiert. Läd er gerade?
            if (button.getAttribute('aria-busy') === 'true') {
                emptyChecks = 0; // Er ist da, nur beschäftigt
                await new Promise(r => setTimeout(r, 50));
                continue;
            }

            // Button ist da und NICHT beschäftigt -> SOFORT KLICKEN
            emptyChecks = 0;
            clickCount++;
            console.log(`[KA AutoShowMore] Klick ${clickCount} ausgeführt! Warte auf Freigabe...`);
            
            // Setzen wir manuell aria-disabled, damit wir im nächsten Loop (in 50ms) 
            // nicht nochmal klicken, falls React zu langsam ist, um aria-busy zu setzen.
            button.setAttribute('aria-disabled', 'true');
            button.click();
            
            // Etwas länger warten, damit die Website sicher reagieren kann
            await new Promise(r => setTimeout(r, 300));
        }
    }

    function waitForFirstAppearance(attempt = 0) {
        let button = null;
        try {
            button = findButton();
        } catch (e) {
            console.error('[KA AutoShowMore] Fehler bei der Erstsuche:', e);
        }

        if (button) {
            autoClicker();
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
