KAFeatureManager.register('AutoShowMore', () => {
    // Nur auf Homepage-artigen Feed-Seiten laufen lassen: "/" (Startseite ohne
    // gespeicherten Ort) UND "/stadt/<ort>/" (Startseite MIT gespeichertem Ort --
    // exakt dieselbe "Weitere Anzeigen"-Feed-Struktur, live am 29.08.2026 gegen
    // /stadt/muenchen/ verifiziert: div.flex.justify-center.p-small button
    // matcht dort 1:1). Bewusst NICHT auf /s-.../ (echte Suchergebnisseiten) --
    // andere Paginierung/Semantik, nicht getestet.
    const p = window.location.pathname;
    if (p !== '/' && p !== '' && !/^\/stadt\/[^/]+\/?$/.test(p)) {
        return;
    }

    // Kleinanzeigen laedt auf der Startseite in mehreren Batches nach -- ein
    // einzelner Klick auf "Weitere Anzeigen" reicht nicht, der Button taucht
    // danach erneut auf. Wichtige Erkenntnis (bestaetigt durch Konsolen-Fehler
    // und Antigravitys eigene, unabhaengige Debugging-Versuche mit demselben
    // Symptom -- "bricking caused by anti-bot scripts"): Kleinanzeigen setzt
    // Akamai Bot Manager ein (Cookies bm_sz/_abck bestaetigt). Schnelles,
    // mechanisches Nachklicken im Sekundentakt ist genau das Verhaltensmuster,
    // das Bot-Erkennung typischerweise flaggt -- vermutlich der Grund, warum
    // die Ladeanimation manchmal haengen bleibt. Deshalb bewusst SPUERBAR
    // laengere, leicht zufaellige Pausen zwischen Klicks statt maschinentakt.
    //
    // Kein MutationObserver (siehe SortSaver/HighResZoom/InPageMenu-Freezes),
    // stattdessen eine begrenzte, zeitgesteuerte Klick-Warte-Schleife: klicken,
    // auf aria-busy warten bis der Batch fertig geladen ist, dann erst die
    // naechste (randomisierte) Pause, dann pruefen ob der Button noch da ist.
    // Hartes Limit von 15 Klicks als Sicherheitsnetz gegen Endlos-Klicken.
    const MAX_CLICKS = 15;
    const MIN_DELAY_MS = 500;            // Mindestpause zwischen Klicks (menschlich, aber merklich schneller als vorher 1800ms)
    const MAX_DELAY_MS = 900;            // Obergrenze fuer die zufaellige Pause (vorher 3200ms)
    const BUSY_POLL_MS = 150;            // wie oft aria-busy zwischengeprueft wird
    const BUSY_TIMEOUT_MS = 8000;        // Sicherheitsabbruch, falls aria-busy nie weggeht
    const INITIAL_SEARCH_ATTEMPTS = 10;  // wie oft anfangs auf das Erscheinen des Buttons gewartet wird
    const INITIAL_SEARCH_INTERVAL_MS = 500;

    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const randomDelay = () => MIN_DELAY_MS + Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS);

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

    // Wartet, bis ein zuvor geklickter Button seinen Ladezustand (aria-busy)
    // wieder verlassen hat, oder bricht nach BUSY_TIMEOUT_MS sicherheitshalber ab.
    async function waitForBusyToClear(button) {
        const start = performance.now();
        while (performance.now() - start < BUSY_TIMEOUT_MS) {
            try {
                if (!document.body.contains(button)) return; // Button wurde entfernt -> fertig
                if (button.getAttribute('aria-busy') !== 'true') return; // fertig geladen
            } catch (e) {
                console.error('[KA AutoShowMore] Fehler beim Pruefen von aria-busy:', e);
                return;
            }
            await wait(BUSY_POLL_MS);
        }
        console.log('[KA AutoShowMore] aria-busy ist nach dem Timeout nicht verschwunden, mache trotzdem weiter.');
    }

    async function clickLoop() {
        let clickCount = 0;

        while (clickCount < MAX_CLICKS) {
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
                    await waitForBusyToClear(button);
                    continue; // danach neu pruefen, ob der Button noch da/klickbar ist
                }

                clickCount++;
                console.log(`[KA AutoShowMore] 'Weitere Anzeigen' geklickt (${clickCount}/${MAX_CLICKS})`);
                button.click();
            } catch (e) {
                console.error('[KA AutoShowMore] Fehler beim Klicken, stoppe sicherheitshalber:', e);
                return;
            }

            await waitForBusyToClear(button);
            await wait(randomDelay());
        }

        console.log(`[KA AutoShowMore] Sicherheitslimit erreicht (${MAX_CLICKS} Klicks), stoppe.`);
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
