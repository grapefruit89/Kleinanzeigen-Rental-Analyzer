KAFeatureManager.register('DataExport', async () => {
    // Only run on search pages
    if (!window.location.pathname.startsWith('/s-')) return;

    let state = {
        isScraping: false,
        abortController: null,
        allAds: [],
        pagesScanned: 0,
        scriptErrors: [],
        maxPages: 5
    };

    function sanitizeFilename(name) {
        return (name || 'kleinanzeigen_export').replace(/[<>:"/\\|?*]/g, '_').replace(/\s+/g, '_').trim();
    }

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
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

    function parsePrice(priceString) {
        try {
            if (!priceString) return { betrag: null, zusatz: null };
            const cleanString = priceString.replace(/\s+/g, ' ').trim();
            const betragMatch = cleanString.match(/(\d[\d\.]*)/);
            let betrag = null;
            if (betragMatch) {
                betrag = parseFloat(betragMatch[1].replace(/\./g, '').replace(/,/g, '.'));
            }
            const zusatzMatch = cleanString.match(/VB/i);
            return { betrag: betrag, zusatz: zusatzMatch ? 'VB' : null };
        } catch (e) {
            return { betrag: null, zusatz: null };
        }
    }

    function extractAdsFromDocument(doc) {
        const extracted = [];
        doc.querySelectorAll('article.aditem, li.ad-listitem > article.aditem').forEach(item => {
            try {
                const data = {};
                const adid = item.getAttribute('data-adid');
                if (adid) data.id_of_ad = adid;

                const titleElement = item.querySelector('h2.text-module-begin a.ellipsis, h2.text-module-begin span.ellipsis');
                if (titleElement) data.title = titleElement.textContent.trim();
                
                const descElement = item.querySelector('.aditem-main--middle--description');
                if (descElement) data.description = descElement.textContent.trim().replace(/\s+/g, ' ');
                
                const priceElement = item.querySelector('.aditem-main--middle--price-shipping--price');
                if (priceElement) data.price = parsePrice(priceElement.textContent);
                
                const locationElement = item.querySelector('.aditem-main--top--left');
                if (locationElement) data.location = parseLocation(locationElement.textContent);
                
                const dateElement = item.querySelector('.aditem-main--top--right');
                if (dateElement) data.date = dateElement.textContent.trim();
                
                const linkElement = item.querySelector('a[href^="/s-anzeige/"]');
                if(linkElement) data.link = `https://www.kleinanzeigen.de${linkElement.getAttribute('href')}`;

                if (data.id_of_ad) extracted.push(data);
            } catch (e) {}
        });
        return extracted;
    }

    async function scrapeLoop() {
        let currentUrl = window.location.href;
        let doc = document;
        
        while (currentUrl && state.isScraping && !state.abortController.signal.aborted) {
            state.pagesScanned++;
            
            // Extract ads
            const ads = extractAdsFromDocument(doc);
            state.allAds.push(...ads);
            
            updateProgress(`Scraping Page ${state.pagesScanned}...`, state.pagesScanned, state.allAds.length);

            // Limit check
            if (state.pagesScanned >= state.maxPages) {
                break;
            }

            // Find next page
            const nextLink = doc.querySelector('a.pagination-next');
            if (!nextLink || !nextLink.href) {
                break; // No more pages
            }

            currentUrl = nextLink.href;

            // Wait 1500-2500ms to avoid Datadome blocks
            const waitTime = Math.floor(Math.random() * 1000) + 1500;
            await sleep(waitTime);

            if (state.abortController.signal.aborted) break;

            // Fetch next page
            try {
                const response = await fetch(currentUrl, { signal: state.abortController.signal });
                const html = await response.text();
                doc = new DOMParser().parseFromString(html, 'text/html');
            } catch (e) {
                if (e.name !== 'AbortError') logScriptError(e, 'fetchPage');
                break;
            }
        }
    }

    async function toggleScraping() {
        const btn = document.getElementById('md-scraper-btn');
        const limitInput = document.getElementById('md-scraper-limit');

        if (state.isScraping) {
            // STOP
            if (state.abortController) state.abortController.abort();
            state.isScraping = false;
            btn.textContent = 'Stopping...';
            return;
        }

        // READ LIMIT
        state.maxPages = parseInt(limitInput.value) || 5;

        // START
        state.isScraping = true;
        state.abortController = new AbortController();
        state.allAds = [];
        state.pagesScanned = 0;
        state.scriptErrors = [];

        btn.textContent = 'Stop Scraping';
        btn.classList.add('stop-btn');
        limitInput.disabled = true;
        
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
        if (btn) {
            btn.textContent = 'Start Auto-Scraper';
            btn.classList.remove('stop-btn');
        }
        if (limitInput) {
            limitInput.disabled = false;
        }
    }

    function exportJsonl() {
        const queryTerm = document.querySelector('#site-search-query')?.value || 'suche';
        const filename = sanitizeFilename(`KA_Export_${queryTerm}`);

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
