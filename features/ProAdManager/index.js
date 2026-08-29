// FEATURE: ProAdManager
// INTENT:
//   Werbe-/Filler-Slots (Liberty/GPT-Luecken ohne Inhalt) in der Suchliste
//   per CSS-Klasse ausblenden, PRO-Anzeigen zaehlen/optional ausblenden
//   (Dashboard-Button ueber der Ergebnisliste).
// WORKS WHEN:
//   Auf /s-.../ zeigt das Dashboard "<N> Anzeigen" mit N > 0 direkt ueber
//   der Ergebnisliste, und Liberty/GPT-Luecken (leere Slots) sind weg.
// ANCHOR (2026-08-29 live):
//   Karten: article[data-adid] + closest('li')
//   Filler: li:has(div[id^="srpb-result-list"]|.liberty-hide-unfilled|
//           div[id^="google_ads_iframe"]) -- EIGENER Scan, nicht als Kind
//           einer Ad-Karte gesucht (siehe BUGFIX-Kommentar unten: 7 von 34
//           <li> im Ergebnis-Grid haben gar keine Ad-Karte drin)
//   Dashboard-Anker: #srchrslt-adtable
// BROKEN IF:
//   "<N> Anzeigen"-Text im Dashboard bleibt bei 0 trotz sichtbarer Karten
//   ODER Dashboard erscheint gar nicht auf einer echten /s-.../-Seite
//   ODER graue leere Kacheln bleiben in der Liste trotz Dashboard-Zahl > 0
// DO NOT:
//   PRO/TOP ueber DOM-Klassen erkennen (isProBadge ist bewusst false) --
//   die Sponsoring-Info liegt jetzt in einem JSON-Blob im props-Attribut
//   eines <astro-island> (sponsoredAdPresent/resultAds), noch nicht gegen
//   eine echte TOP-Karte verifiziert. Erst Mapping bestaetigen, dann
//   wieder aktivieren -- nicht raten (siehe Chat 29.08.2026).

KAFeatureManager.register('ProAdManager', async () => {
    // Startseite ignorieren
    if (window.location.pathname === '/' || window.location.pathname === '') {
        return;
    }

    const storageKey = 'ka_show_pros_state';
    let savedState = await KAStorage.get(storageKey, true);

    if (savedState) {
        document.body.classList.add('ka-show-pro');
    }

    let validAdsCount = 0;
    let proAdsCount = 0;
    let isProcessing = false;

    function cleanUp() {
        if (isProcessing) return;
        isProcessing = true;

        // 29.08.2026 live gefunden: li.ad-listitem existiert nicht mehr (0 Treffer) --
        // die GESAMTE cleanUp()-Logik lief seitdem ins Leere, jeden einzigen Aufruf,
        // ohne dass das sichtbar war (kein Fehler, einfach eine leere NodeList). Neuer
        // Anker: article[data-adid] (gleiche Basis wie DataExport/WasdNavigation/
        // RentalAnalyzer), Wrapper-<li> via closest('li').
        //
        // BUGFIX 29.08.2026: Filler-Slots separat scannen, nicht als Kind einer
        // Ad-Karte suchen. Live bestaetigt: von 34 <li> in #srchrslt-adtable haben 7
        // GAR KEIN article[data-adid] -- reine Liberty-Filler-Slots
        // (data-liberty-position-name="srpb-result-list-N") in eigenen <li>-Elementen.
        // Wer nur article[data-adid] als Startpunkt nimmt (wie zuerst hier gemacht),
        // sieht diese 7 Loecher nie -- der Zaehler im Dashboard stimmt trotzdem
        // (WORKS WHEN war nur halb erfuellt), die grauen Luecken bleiben aber sichtbar.
        const fillerSelector = 'li:has(div[id^="srpb-result-list"]), li:has(.liberty-hide-unfilled), li:has(div[id^="google_ads_iframe"])';
        document.querySelectorAll(fillerSelector).forEach(li => {
            li.classList.add('ka-pad-filler-hidden'); // CSS-hide statt remove() -- React besitzt diesen Knoten
        });

        const listItems = Array.from(document.querySelectorAll('article[data-adid]'))
            .map(ad => ad.closest('li'))
            .filter(Boolean);

        let currentValid = 0;
        let currentPro = 0;

        listItems.forEach(li => {
            // Filler-<li> wurden oben schon separat behandelt -- ein <li> mit
            // article[data-adid] UND einem Filler-Slot drin kommt zwar praktisch
            // nicht vor, aber sicherheitshalber trotzdem ueberspringen statt doppelt
            // zu zaehlen.
            if (li.classList.contains('ka-pad-filler-hidden')) return;

            const ad = li.querySelector('article[data-adid]');
            if (!ad) return;

            // PRO/TOP-Erkennung -- 29.08.2026 DEAKTIVIERT, nicht nur repariert:
            // .aditem-image--badges--badge-topad, .aditem-main--top--right und
            // .badge-hint-pro-small-srp existieren alle nicht mehr (0 Treffer live).
            // Die Sponsoring-Info liegt jetzt nicht mehr im sichtbaren DOM, sondern als
            // JSON im props-Attribut eines <astro-island> (gefunden: Attribut "props"
            // enthaelt "sponsoredAdPresent"/"resultAds"-Array). Das ist keine einfache
            // Selektor-Korrektur mehr, sondern erfordert eigenes Parsen dieses JSON-Props
            // und ein Zuordnen der Eintraege zu den data-adid-Werten -- dafuer fehlt live
            // noch ein bestaetigtes Beispiel (in dieser Session keine TOP-Anzeige mit
            // sichtbarem Badge gefunden, um das Mapping zu verifizieren). Bis das separat
            // untersucht ist, bleibt PRO-Erkennung bewusst aus (kein Verstecken/Markieren)
            // statt mit einer geratenen, unverifizierten Regel falsch positiv zu hidden.
            const isProBadge = false;
            const isProLink = ad.querySelector('a[href^="/pro/"]') !== null;

            if (isProBadge || isProLink) {
                li.classList.add('ka-pro-hidden');
                currentPro++;
            } else {
                li.classList.remove('ka-pro-hidden');
            }

            currentValid++;
        });

        if (currentValid !== validAdsCount || currentPro !== proAdsCount) {
            validAdsCount = currentValid;
            proAdsCount = currentPro;
            updateDashboard();
        }

        setTimeout(() => { isProcessing = false; }, 50);
    }

    function initDashboard() {
        // 29.08.2026 live gefunden: .srp-header existiert nicht mehr (0 Treffer) --
        // Dashboard wurde deshalb NIE injiziert. Neuer Anker: #srchrslt-adtable
        // (live bestaetigt vorhanden), Dashboard wird direkt davor eingefuegt.
        const resultsContainer = document.getElementById('srchrslt-adtable');
        if (!resultsContainer) return;

        if (!document.getElementById('ka-dashboard-container')) {
            const dashboard = document.createElement('div');
            dashboard.id = 'ka-dashboard-container';
            dashboard.innerHTML = `
                <span id="ka-dashboard-text">Lade Daten...</span>
                <button id="ka-dashboard-btn">
                    <span class="ka-dashboard-badge">PRO</span>
                    <span class="ka-btn-label">initialisieren</span>
                </button>
            `;
            resultsContainer.parentNode.insertBefore(dashboard, resultsContainer);

            document.getElementById('ka-dashboard-btn').addEventListener('click', async () => {
                const isActive = document.body.classList.toggle('ka-show-pro');
                await KAStorage.set(storageKey, isActive);
                updateDashboard();
            });
        }
        updateDashboard();
    }

    function updateDashboard() {
        const textSpan = document.getElementById('ka-dashboard-text');
        const btn = document.getElementById('ka-dashboard-btn');
        if (!textSpan || !btn) return;

        const isShowingPro = document.body.classList.contains('ka-show-pro');
        const badgeHtml = `<span class="ka-dashboard-badge">PRO</span>`;

        if (isShowingPro) {
            textSpan.innerHTML = `${validAdsCount} Anzeigen davon ${proAdsCount} ${badgeHtml}`;
            btn.innerHTML = `${badgeHtml} <span class="ka-btn-label">ausblenden</span>`;
        } else {
            if (proAdsCount > 0) {
                textSpan.innerHTML = `${validAdsCount} Anzeigen davon ${proAdsCount} ${badgeHtml} ausgeblendet`;
                btn.innerHTML = `${badgeHtml} <span class="ka-btn-label">anzeigen</span>`;
            } else {
                textSpan.innerHTML = `${validAdsCount} Anzeigen (Keine ${badgeHtml} gefunden)`;
                btn.innerHTML = `${badgeHtml} <span class="ka-btn-label">anzeigen</span>`;
            }
        }
    }

    // Init -- gedebounced (400ms, wie die anderen Module): cleanUp() veraendert selbst
    // das DOM (Klassen setzen), was den eigenen
    // Observer sonst bei jedem Durchlauf erneut triggert. Ohne Debounce war das der
    // sechste gefundene Freeze-Kandidat dieser Session.
    let debounceTimer = null;
    const observer = new MutationObserver(() => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            cleanUp();
            initDashboard();
        }, 400);
    });

    observer.observe(document.body, { childList: true, subtree: true });

    cleanUp();
    initDashboard();
});
