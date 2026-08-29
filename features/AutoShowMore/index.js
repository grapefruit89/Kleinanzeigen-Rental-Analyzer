// KAFeatureManager.register('AutoShowMore', () => {
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
        console.log("[KA AutoShowMore] Starte intelligenten Mess-Klicker...");
        let clickCount = 0;

        while (true) {
            if (clickCount >= 15) {
                console.log("[KA AutoShowMore] Sicherheitslimit von 15 Klicks erreicht. Stoppe.");
                break;
            }

            const button = findButton();
            
            if (!button) {
                // Button ist nicht da. Wir warten bis zu 3 Sekunden, ob er neu auftaucht.
                let foundAgain = false;
                for (let i = 0; i < 60; i++) {
                    await new Promise(r => setTimeout(r, 50));
                    if (findButton()) {
                        foundAgain = true;
                        break;
                    }
                }
                if (!foundAgain) {
                    console.log(`[KA AutoShowMore] Button ist komplett verschwunden. (Insgesamt ${clickCount}x geklickt). Fertig!`);
                    break;
                }
                continue; // Button ist wieder da, nächster Loop
            }

            // Button existiert. Läd er gerade aus einer vorherigen Aktion?
            if (button.getAttribute('aria-busy') === 'true') {
                await new Promise(r => setTimeout(r, 50));
                continue;
            }

            // Button ist da und NICHT beschäftigt -> SOFORT KLICKEN
            clickCount++;
            const t0 = performance.now();
            button.click();
            
            // 1. Warte, bis React den Ladezustand (aria-busy) setzt oder den Button löscht
            let startedLoading = false;
            while (performance.now() - t0 < 500) {
                await new Promise(r => setTimeout(r, 50));
                if (!document.body.contains(button)) break; // Button wurde aus dem DOM entfernt
                if (button.getAttribute('aria-busy') === 'true') {
                    startedLoading = true;
                    break;
                }
            }
            
            const reactDelay = performance.now() - t0;

            // 2. Wenn er lädt, messen wir, wie lange der Netzwerk-Request dauert
            if (startedLoading) {
                const loadStart = performance.now();
                while (document.body.contains(button) && button.getAttribute('aria-busy') === 'true') {
                    await new Promise(r => setTimeout(r, 50));
                }
                const loadTime = performance.now() - loadStart;
                console.log(`[KA AutoShowMore] Klick ${clickCount} ✅ | React-Startverzögerung: ${reactDelay.toFixed(1)}ms | Nachlade-Dauer: ${loadTime.toFixed(1)}ms`);
            } else {
                console.log(`[KA AutoShowMore] Klick ${clickCount} ⚠️ | Kein Ladezustand erkannt (Wartezeit: ${reactDelay.toFixed(1)}ms)`);
                // Kleiner Puffer, falls React den DOM komplett umgebaut hat
                await new Promise(r => setTimeout(r, 100));
            }
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

    // waitForFirstAppearance();
// });
