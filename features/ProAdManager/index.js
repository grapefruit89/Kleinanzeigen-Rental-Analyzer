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

        const listItems = document.querySelectorAll('li.ad-listitem');
        
        let currentValid = 0;
        let currentPro = 0;
        const proRows = [];

        listItems.forEach(li => {
            // Filler / Werbung filtern
            if (li.querySelector('div[id^="srpb-result-list"]') ||
                li.querySelector('.liberty-hide-unfilled') ||
                li.querySelector('div[id^="google_ads_iframe"]')) {
                li.classList.add('ka-pad-filler-hidden'); // CSS-hide statt remove() -- React besitzt diesen Knoten
                return;
            }

            const ad = li.querySelector('article.aditem');
            if (!ad) return;

            // TopAds entfernen
            const isTopBadge = ad.querySelector('.aditem-image--badges--badge-topad') !== null;
            const isTopClass = ad.classList.contains('is-topad');

            // Datum prüfen (um seltsame Platzhalter zu ignorieren)
            const dateBox = ad.querySelector('.aditem-main--top--right');
            const hasDate = dateBox && dateBox.innerText.trim().length > 0;

            if (!hasDate || isTopBadge || isTopClass) {
                // Nur entfernen, wenn es nicht die neue Feedback-Insel ist
                if (!li.querySelector('astro-island')) {
                    li.classList.add('ka-pad-filler-hidden'); // CSS-hide statt remove() -- React besitzt diesen Knoten
                }
                return;
            }

            // PRO Erkennung
            const isProBadge = ad.querySelector('.badge-hint-pro-small-srp') !== null;
            const isProLink = ad.querySelector('a[href^="/pro/"]') !== null;

            if (isProBadge || isProLink) {
                li.classList.add('ka-pro-hidden');
                currentPro++;
                proRows.push(li);
            } else {
                li.classList.remove('ka-pro-hidden');
            }

            currentValid++;
        });

        // v1: PRO-Ads werden NICHT mehr per prepend() im DOM umsortiert -- auch ohne
        // remove() bleibt das eine Knoten-Umhaengung, die React unter sich weiterlaufen
        // sieht und dagegenarbeiten kann. Fuer jetzt reicht Ein-/Ausblenden per Klasse
        // (ka-pro-hidden, siehe oben); visuelles Nach-oben-Sortieren waere ein separater
        // CSS-only-Ansatz (z.B. order, wenn der Container tatsaechlich flex/grid ist --
        // noch nicht verifiziert), kein DOM-Move. proRows wird nur noch fuer die
        // Zaehlung oben gebraucht.

        if (currentValid !== validAdsCount || currentPro !== proAdsCount) {
            validAdsCount = currentValid;
            proAdsCount = currentPro;
            updateDashboard();
        }

        setTimeout(() => { isProcessing = false; }, 50);
    }

    function initDashboard() {
        const targetHeader = document.querySelector('.srp-header');
        if (!targetHeader) return;

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
            targetHeader.parentNode.insertBefore(dashboard, targetHeader.nextSibling);

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
