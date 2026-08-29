// FEATURE: DataExport
// INTENT:
//   Suchergebnisse (mehrere Seiten) als JSONL exportieren, optional mit
//   nachgeladener Anzeigen-Detailseite (Volltext, Datum, Versand) --
//   Rohstoff fuer LLM/Marktuebersicht, keine perfekt normalisierte DB.
// WORKS WHEN:
//   Auf /s-.../ liefert Start-Klick "Ads Found" > 0 und nach Abschluss eine
//   .jsonl-Datei mit id_of_ad + title + price bei jeder Zeile.
// ANCHOR (2026-08-29 live):
//   Liste:  article[data-adid]  (data-href = Detaillink, kein <a> mehr noetig)
//   Seite2+: /seite:N/-Pfadsegment selbst bauen (kein Next-Link mehr)
//   Detail: #viewad-description, #viewad-extra-info (Datum),
//           .boxedarticle--details--shipping (Versand -- NICHT body-weit
//           scannen: die "Aehnliche Anzeigen"-Sidebar auf der Detailseite
//           laeuft noch auf altem article.aditem-Markup und liefert sonst
//           falsche Treffer aus fremden Anzeigen)
// BROKEN IF:
//   0 Treffer bei article[data-adid] auf einer echten /s-.../-Seite
//   ODER "Pages Scanned" bleibt bei 1 trotz Max. Seiten > 1 und mehreren
//        vorhandenen Ergebnisseiten
//   ODER exportierte Zeilen haben durchgehend versand_moeglich=true
// DO NOT:
//   Versand ueber querySelectorAll('body *') raten -- fasst Sidebar-Karten
//   fremder Anzeigen mit ein. Alte Klassen (li.ad-listitem, article.aditem,
//   #site-search-query, a.pagination-next) fuer die HAUPT-Suchliste nicht
//   wiederverwenden -- die gelten nur noch fuer die Detailseiten-Sidebar.

KAFeatureManager.register('DataExport', async () => {
    // Only run on search pages
    if (!window.location.pathname.startsWith('/s-')) return;

    let state = {
        isScraping: false,
        abortController: null,
        allAds: [],
        pagesScanned: 0,
        scriptErrors: [],
        maxPages: 5,
        fetchFullDetails: true
    };

    function sanitizeFilename(name) {
        return (name || 'kleinanzeigen_export').replace(/[<>:"/\\|?*]/g, '_').replace(/\s+/g, '_').trim();
    }

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    function randomWait(minMs, maxMs) {
        return sleep(minMs + Math.random() * (maxMs - minMs));
    }

    function logScriptError(error, context) {
        state.scriptErrors.push({
            timestamp: new Date().toISOString(),
            context: context,
            message: error.message
        });
        console.error(`[DataExport] Fehler [${context}]:`, error);
    }

    function parseLocation(locationString) {
        try {
            if (!locationString) return { plz: null, stadt: null, entfernung_km: null };
            const cleanString = locationString.replace(/\s+/g, ' ').trim();
            const plzMatch = cleanString.match(/^(\d{5})/);
            let stadt = cleanString.replace(/^\d{5}\s*/, '').replace(/\(\d+\s*km\)/, '').trim();
            if (plzMatch && stadt.startsWith(plzMatch[1])) {
                stadt = stadt.substring(plzMatch[1].length).trim();
            }
            const distanceMatch = cleanString.match(/\((\d+)\s*km\)/);
            return {
                plz: plzMatch ? plzMatch[1] : null,
                stadt: stadt || null,
                entfernung_km: distanceMatch ? parseInt(distanceMatch[1], 10) : null
            };
        } catch (e) {
            return { plz: null, stadt: null, entfernung_km: null };
        }
    }

    // typ: "fest" | "vb" | "verschenken" | "anfrage" -- getrennt von betrag, damit
    // "auf Anfrage"/"VB ohne Zahl" nicht mit einem echten Festpreis verwechselt wird.
    function parsePrice(priceString) {
        try {
            if (!priceString) return { betrag: null, zusatz: null, typ: 'anfrage' };
            const cleanString = priceString.replace(/\s+/g, ' ').trim();

            if (/zu verschenken/i.test(cleanString)) {
                return { betrag: null, zusatz: null, typ: 'verschenken' };
            }

            const betragMatch = cleanString.match(/(\d[\d\.]*)/);
            const isVb = /VB\b/i.test(cleanString);
            let betrag = null;
            if (betragMatch) {
                betrag = parseFloat(betragMatch[1].replace(/\./g, '').replace(/,/g, '.'));
            }

            let typ;
            if (betrag === null) {
                typ = 'anfrage'; // z.B. "VB" ganz ohne Zahl auf der Karte
            } else if (isVb) {
                typ = 'vb';
            } else {
                typ = 'fest';
            }

            return { betrag, zusatz: isVb ? 'VB' : null, typ };
        } catch (e) {
            return { betrag: null, zusatz: null, typ: 'anfrage' };
        }
    }

    function extractAdsFromDocument(doc) {
        const extracted = [];
        doc.querySelectorAll('article[data-adid]').forEach(article => {
            try {
                const data = {};
                const adid = article.getAttribute('data-adid');
                if (adid) data.id_of_ad = adid;

                const href = article.getAttribute('data-href');
                if (href) data.link = href.startsWith('http') ? href : `https://www.kleinanzeigen.de${href}`;

                const heading = article.querySelector('h2, h3');
                if (heading) data.title = heading.textContent.trim().replace(/\s+/g, ' ');

                const paragraphs = Array.from(article.querySelectorAll('p'))
                    .map(p => p.textContent.trim().replace(/\s+/g, ' '))
                    .filter(Boolean);

                const priceText = paragraphs.find(t => /€|VB\b|Zu verschenken/i.test(t));
                if (priceText) data.price = parsePrice(priceText);

                const sizeText = paragraphs.find(t => /m²/.test(t));
                if (sizeText) data.groesse_zimmer = sizeText;

                const teaser = paragraphs
                    .filter(t => t !== priceText && t !== sizeText)
                    .sort((a, b) => b.length - a.length)[0];
                if (teaser) data.description_short = teaser;

                const plzSpan = Array.from(article.querySelectorAll('span'))
                    .map(s => s.textContent.trim())
                    .find(t => /^\d{5}\s/.test(t));
                if (plzSpan) data.location = parseLocation(plzSpan);

                // Eine Bild-URL fuers Kartenbild -- kostet nichts (steckt schon im
                // Karten-<img>), hilft aber jedem LLM/jeder Uebersicht enorm.
                const img = article.querySelector('img[src*="kleinanzeigen.de/api/v1/prod-ads/images/"]');
                if (img && img.src) data.bild = img.src;

                if (data.id_of_ad) extracted.push(data);
            } catch (e) {}
        });
        return extracted;
    }

    // Detailseiten-Parsing: Vollbeschreibung, Einstelldatum, Versandoption.
    // 29.08.2026 live verifiziert -- #viewad-description und #viewad-extra-info
    // existieren auf der Detailseite. Versand: .boxedarticle--details--shipping ist
    // der EINZIGE korrekte Anker (Text "Versand möglich"/"Nur Abholung") --
    // #viewad-shipping-options existiert nicht (mehr), und ein body-weiter Scan nach
    // dem Text "Versand möglich" fasst faelschlich die "Aehnliche Anzeigen"-Sidebar
    // mit ein (die laeuft noch auf altem article.aditem-Markup und zeigt DEREN
    // Versand-Badges, nicht das der aktuellen Anzeige). Ohne .boxedarticle--details--
    // shipping bleibt das Feld bewusst null statt geraten.
    function extractDetailsFromDocument(doc) {
        const result = { description_full: null, eingestellt_am: null, versand_moeglich: null };
        try {
            const descEl = doc.getElementById('viewad-description');
            if (descEl) {
                let text = descEl.textContent.replace(/\s+/g, ' ').trim();
                text = text.replace(/^Beschreibung\s*/, '').trim();
                result.description_full = text;
            }
        } catch (e) {}

        try {
            const extraInfo = doc.getElementById('viewad-extra-info');
            if (extraInfo) {
                const text = extraInfo.textContent.replace(/\s+/g, ' ').trim();
                const dateMatch = text.match(/\d{2}\.\d{2}\.\d{4}/);
                if (dateMatch) result.eingestellt_am = dateMatch[0];
            }
        } catch (e) {}

        try {
            const shippingEl = doc.querySelector('.boxedarticle--details--shipping');
            if (shippingEl) {
                const text = shippingEl.textContent.trim();
                if (/versand/i.test(text)) result.versand_moeglich = true;
                else if (/abholung/i.test(text)) result.versand_moeglich = false;
            }
        } catch (e) {}

        return result;
    }

    async function fetchAdDetails(url, signal) {
        try {
            const response = await fetch(url, { signal });
            const html = await response.text();
            const doc = new DOMParser().parseFromString(html, 'text/html');
            return extractDetailsFromDocument(doc);
        } catch (e) {
            if (e.name !== 'AbortError') logScriptError(e, 'fetchAdDetails');
            return { description_full: null, eingestellt_am: null, versand_moeglich: null };
        }
    }

    // 29.08.2026 live verifiziert: a.pagination-next existiert nicht mehr (deshalb
    // blieb "Pages Scanned" bisher immer bei 1, egal was in "Max. Seiten" stand --
    // derselbe Klassen-Drift wie ueberall sonst diese Session). Kleinanzeigen
    // verlinkt Folgeseiten jetzt nur noch als nummerierte /seite:N/-Segmente
    // (z.B. /s-kueche-esszimmer/muenchen/seite:2/c86l6411), kein "naechste Seite"-
    // Link mit erkennbarem Zweck. Deshalb wie bei SortSaver: Segment selbst bauen
    // statt einen Link zu suchen. Abbruchkriterium ist jetzt "0 Anzeigen auf der
    // frisch geladenen Seite" statt "kein Next-Link gefunden".
    function withPageSegment(url, pageNum) {
        try {
            const u = new URL(url);
            const parts = u.pathname.split('/').filter(Boolean).filter(p => !p.startsWith('seite:'));
            if (pageNum > 1) {
                parts.splice(Math.max(parts.length - 1, 0), 0, `seite:${pageNum}`);
            }
            u.pathname = '/' + parts.join('/');
            return u.toString();
        } catch (e) {
            return url;
        }
    }

    async function scrapeLoop() {
        let currentPage = 1;
        let doc = document;
        const baseUrl = window.location.href;

        while (state.isScraping && !state.abortController.signal.aborted) {
            const ads = extractAdsFromDocument(doc);

            if (ads.length === 0 && currentPage > 1) {
                break; // ueber die letzte Seite hinaus -- hier nichts mehr gefunden
            }

            state.pagesScanned = currentPage;

            // Herkunft pro Zeile mitschreiben -- sonst weiss man in drei Wochen
            // nicht mehr, aus welcher Suche/Seite eine Zeile stammt.
            const exportedAt = new Date().toISOString();
            ads.forEach(ad => {
                ad.quelle = {
                    such_url: baseUrl,
                    seite: currentPage,
                    exportiert_am: exportedAt
                };
            });
            state.allAds.push(...ads);

            updateProgress(`Scraping Page ${state.pagesScanned}...`, state.pagesScanned, state.allAds.length);

            // Limit check
            if (state.pagesScanned >= state.maxPages) {
                break;
            }

            currentPage++;
            const nextUrl = withPageSegment(baseUrl, currentPage);

            // Wait 1500-2500ms to avoid Datadome blocks
            await randomWait(1500, 2500);

            if (state.abortController.signal.aborted) break;

            // Fetch next page
            try {
                const response = await fetch(nextUrl, { signal: state.abortController.signal });
                const html = await response.text();
                doc = new DOMParser().parseFromString(html, 'text/html');
            } catch (e) {
                if (e.name !== 'AbortError') logScriptError(e, 'fetchPage');
                break;
            }
        }

        // Zweite Phase: pro gefundener Anzeige die Detailseite laden und
        // Vollbeschreibung/Datum/Versand nachladen -- deshalb bewusst NICHT
        // parallel (Promise.all), sondern sequentiell mit randomisierter Pause,
        // gleiches Datadome-Schutzmuster wie bei der Seiten-Paginierung oben.
        if (state.fetchFullDetails) {
            for (let i = 0; i < state.allAds.length; i++) {
                if (!state.isScraping || state.abortController.signal.aborted) break;
                const ad = state.allAds[i];
                if (!ad.link) continue;

                updateProgress(`Lade Details ${i + 1}/${state.allAds.length}...`, state.pagesScanned, state.allAds.length);

                const details = await fetchAdDetails(ad.link, state.abortController.signal);
                ad.description_full = details.description_full;
                ad.eingestellt_am = details.eingestellt_am;
                ad.versand_moeglich = details.versand_moeglich;

                if (i < state.allAds.length - 1) {
                    await randomWait(900, 1700);
                }
            }
        }
    }

    async function toggleScraping() {
        const btn = document.getElementById('md-scraper-btn');
        const limitInput = document.getElementById('md-scraper-limit');
        const fulltextInput = document.getElementById('md-scraper-fulltext');

        if (state.isScraping) {
            // STOP
            if (state.abortController) state.abortController.abort();
            state.isScraping = false;
            btn.textContent = 'Stopping...';
            return;
        }

        // READ LIMIT
        state.maxPages = parseInt(limitInput.value) || 5;
        state.fetchFullDetails = !!(fulltextInput && fulltextInput.checked);

        // START
        state.isScraping = true;
        state.abortController = new AbortController();
        state.allAds = [];
        state.pagesScanned = 0;
        state.scriptErrors = [];

        btn.textContent = 'Stop Scraping';
        btn.classList.add('stop-btn');
        limitInput.disabled = true;
        if (fulltextInput) fulltextInput.disabled = true;

        updateProgress('Starting...', 0, 0);

        try {
            await scrapeLoop();

            if (state.allAds.length > 0) {
                updateProgress(state.abortController.signal.aborted ? 'Stopped! Downloading...' : 'Complete! Downloading...', state.pagesScanned, state.allAds.length);
                await sleep(1000);
                exportJsonl();
            } else {
                updateProgress('No ads found.', 0, 0);
            }
        } catch (err) {
            console.error(err);
        } finally {
            resetUI();
        }
    }

    function resetUI() {
        state.isScraping = false;
        state.abortController = null;
        const btn = document.getElementById('md-scraper-btn');
        const limitInput = document.getElementById('md-scraper-limit');
        const fulltextInput = document.getElementById('md-scraper-fulltext');
        if (btn) {
            btn.textContent = 'Start Auto-Scraper';
            btn.classList.remove('stop-btn');
        }
        if (limitInput) {
            limitInput.disabled = false;
        }
        if (fulltextInput) {
            fulltextInput.disabled = false;
        }
    }

    // 29.08.2026: #site-search-query existiert nicht mehr -- Dateiname fiel deshalb
    // IMMER auf "suche" zurueck. Neuer Fallback dreistufig: Suchbegriff
    // (input[name="keywords"]) -> Kategorie-Slug aus der URL (z.B.
    // "kueche-esszimmer" aus /s-kueche-esszimmer/...) -> zuletzt "suche". Bei einer
    // reinen Kategorie-Suche ohne Freitext (Suchfeld leer) ist das jetzt trotzdem
    // aussagekraeftig statt immer gleich "suche".
    function guessExportName() {
        const keywords = document.querySelector('input[name="keywords"]')?.value?.trim();
        if (keywords) return keywords;

        const catMatch = window.location.pathname.match(/^\/s-([a-z0-9-]+)\//i);
        if (catMatch) return catMatch[1];

        return 'suche';
    }

    function exportJsonl() {
        const filename = sanitizeFilename(`KA_Export_${guessExportName()}`);

        const jsonlOutput = state.allAds.map(obj => JSON.stringify(obj)).join('\n');

        const blob = new Blob([jsonlOutput], { type: 'application/jsonl;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${filename}.jsonl`;
        a.click();
        URL.revokeObjectURL(url);
    }

    function createFloatingUI() {
        if (document.getElementById('md-scraper-ui')) return;

        const container = document.createElement('div');
        container.id = 'md-scraper-ui';

        const title = document.createElement('div');
        title.className = 'scraper-title';
        title.textContent = 'TO LLM | Auto-Scraper';

        const sortWarning = document.createElement('div');
        sortWarning.textContent = '⚠️ Tipp: Vorher Sortierung einstellen!';
        sortWarning.style.cssText = 'font-size: 11px; color: #d9534f; text-align: center; font-weight: bold; margin-bottom: 5px;';

        const limitContainer = document.createElement('div');
        limitContainer.style.cssText = 'display: flex; justify-content: space-between; align-items: center; font-size: 13px;';

        const limitLabel = document.createElement('label');
        limitLabel.textContent = 'Max. Seiten:';
        limitLabel.htmlFor = 'md-scraper-limit';

        const limitInput = document.createElement('input');
        limitInput.type = 'number';
        limitInput.id = 'md-scraper-limit';
        limitInput.value = '5';
        limitInput.min = '1';
        limitInput.max = '100';
        limitInput.style.cssText = 'width: 60px; padding: 2px 5px; border: 1px solid #ccc; border-radius: 4px; text-align: center;';

        limitContainer.appendChild(limitLabel);
        limitContainer.appendChild(limitInput);

        const fulltextContainer = document.createElement('div');
        fulltextContainer.style.cssText = 'display: flex; justify-content: space-between; align-items: center; font-size: 13px; margin-top: 4px;';

        const fulltextLabel = document.createElement('label');
        fulltextLabel.textContent = 'Volltext + Details laden (langsamer):';
        fulltextLabel.htmlFor = 'md-scraper-fulltext';
        fulltextLabel.style.cssText = 'flex: 1; margin-right: 6px;';

        const fulltextInput = document.createElement('input');
        fulltextInput.type = 'checkbox';
        fulltextInput.id = 'md-scraper-fulltext';
        fulltextInput.checked = true;

        fulltextContainer.appendChild(fulltextLabel);
        fulltextContainer.appendChild(fulltextInput);

        const statusMsg = document.createElement('div');
        statusMsg.id = 'md-scraper-msg';
        statusMsg.textContent = 'Ready';

        const progressTable = document.createElement('table');
        progressTable.id = 'md-scraper-progress';
        progressTable.innerHTML = `
            <tr style="height: 18px;">
                <td style="width: 80px;">Pages Scanned:</td>
                <td style="text-align: right;" id="prog-pages">0</td>
            </tr>
            <tr style="height: 18px;">
                <td>Ads Found:</td>
                <td style="text-align: right; font-weight: bold; color: #8bb13e;" id="prog-ads">0</td>
            </tr>
        `;

        const btn = document.createElement('button');
        btn.id = 'md-scraper-btn';
        btn.textContent = 'Start Auto-Scraper';
        btn.onclick = toggleScraping;

        const closeBtn = document.createElement('span');
        closeBtn.id = 'md-scraper-close';
        closeBtn.textContent = '×';
        closeBtn.onclick = () => container.style.display = 'none';

        container.appendChild(closeBtn);
        container.appendChild(title);
        container.appendChild(sortWarning);
        container.appendChild(limitContainer);
        container.appendChild(fulltextContainer);
        container.appendChild(statusMsg);
        container.appendChild(progressTable);
        container.appendChild(btn);
        document.body.appendChild(container);
    }

    function updateProgress(msg, pages, ads) {
        const msgEl = document.getElementById('md-scraper-msg');
        const tableEl = document.getElementById('md-scraper-progress');

        if (msgEl) msgEl.textContent = msg;

        if (tableEl && (pages > 0 || ads > 0)) {
            tableEl.style.display = 'table';
            document.getElementById('prog-pages').textContent = pages;
            document.getElementById('prog-ads').textContent = ads;
        }
    }

    createFloatingUI();
});
