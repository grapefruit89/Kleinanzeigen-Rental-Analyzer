KAFeatureManager.register('HighResZoom', () => {
    // 0. Turbo Start: Preconnect
    if (!document.querySelector('link[href="https://img.kleinanzeigen.de"]')) {
        const link = document.createElement('link');
        link.rel = 'preconnect';
        link.href = 'https://img.kleinanzeigen.de';
        (document.head || document.documentElement).appendChild(link);
    }

    // 1. Create overlay container
    const overlay = document.createElement('div');
    overlay.id = 'ka-hover-overlay';
    document.body.appendChild(overlay);

    let hoverTimer = null;
    let currentAbortController = null;

    // Kleinanzeigen liefert Bilder ueber img.kleinanzeigen.de/api/v1/prod-ads/images/..
    // ?rule=$_XX.AUTO aus, wobei XX eine von einem festen Satz vordefinierter
    // CDN-Groessenregeln ist (kein linearer Zusammenhang zur Nummer!). Empirisch
    // ermittelt (Konsolentest ueber alle Regeln $_0 bis $_100 gegen ein reales
    // Anzeigenbild, 28.08.2026):
    //
    //   Regel   Aufloesung     Regel   Aufloesung     Regel   Aufloesung
    //   $_57    1600 x 694     $_58     640 x 278     $_18     200 x  87
    //   $_45    1200 x 521     $_12     500 x 217     $_37     175 x  76
    //   $_86    1024 x 444     $_21     500 x 217     $_7      150 x  65
    //   $_32    1000 x 434     $_72     500 x 217     $_26     140 x  60
    //   $_59     960 x 416     $_75     430 x 187     $_56     100 x  43
    //   $_3      800 x 347     $_1      400 x 174     $_0       96 x  41
    //   $_20     800 x 347     $_16     400 x 174     $_97      90 x  39
    //   $_85     726 x 315     $_19     400 x 174     $_23      80 x  34
    //   $_27     640 x 278     $_8      300 x 130     $_6       70 x  30
    //                          $_35     300 x 130     $_14      64 x  28
    //                          $_24     298 x 129     $_22      60 x  26
    //                          $_62     225 x  97     $_34      50 x  22
    //                          $_90     220 x  95     $_39      32 x  14
    //                          $_2      200 x  87
    //                          $_9      200 x  87
    //
    // -> $_57 ist die groesste verfuegbare Aufloesung, aber fuer den Hover-Overlay
    //    (per CSS auf max-width: 800px gedeckelt) reine Verschwendung: 224 KB pro Bild,
    //    und showGallery() laedt bis zu 4 Bilder pro Hover (Haupt- + 3 Detailbilder) ->
    //    bis zu ~900 KB fuer einen einzigen Hover. Reale Dateigroessen gemessen
    //    (28.08.2026, selbes Testbild):
    //      $_57  1600x694   224 KB
    //      $_45  1200x521   113 KB  <- gewaehlt fuer "max"
    //      $_86  1024x444    81 KB  <- "list"
    //      $_32  1000x434    78 KB
    //      $_59   960x416    71 KB
    //    $_45 deckt die 800px-Anzeigebreite noch bis 1.5x Pixeldichte scharf ab,
    //    halbiert aber die Dateigroesse ggue. $_57 fast komplett. $_86 bleibt fuer
    //    "list" unveraendert, da via IntersectionObserver im Hintergrund vorgeladen
    //    wird und die 81 KB dort nichts blockieren. Falls Kleinanzeigen das
    //    CDN-Schema aendert, muss der Test wiederholt werden (Skript siehe
    //    Projekt-Notizen "HighResZoom CDN-Aufloesungsregeln (Test-Ergebnis)").
    const CACHE_RULES = { list: 'rule=$_86.AUTO', max: 'rule=$_45.AUTO' };

    // 2. Smart Preloader via IntersectionObserver
    const preloadObserver = new IntersectionObserver((entries, obs) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                const origSrc = img.src;
                if (origSrc) {
                    const maxSrc = origSrc.replace(/rule=\$_\d+\.AUTO/, CACHE_RULES.max);
                    const preloader = new Image();
                    preloader.src = maxSrc; // load into cache
                }
                obs.unobserve(img); // only preload once
            }
        });
    }, { rootMargin: "600px" });

    // 3. Process thumbnails
    //
    // Kleinanzeigen benutzt je nach Kategorie/Layout-Version unterschiedliche
    // Karten-Strukturen fuer dieselben Anzeigenbilder:
    //  - alt:      <li class="ad-listitem"> ... <article class="aditem"> ... <img>
    //  - neu (A):  <li> (OHNE ad-listitem-Klasse) > <article class="flex..."> > <a> > <img>
    //  - neu (B):  <div data-testid="ad-tile-image-wrapper"> > <img>  (Kachel-Grid)
    // Klassennamen und Container-Tags sind also kein verlaesslicher Anker mehr.
    // Robuster Anker ist der Link zur Detailseite (<a href="/s-anzeige/...">), der
    // in allen bisher beobachteten Varianten das Bild umschliesst.
    function findAdContext(img) {
        // Wichtig: das <img> liegt nicht immer INNERHALB des Links zur Anzeige!
        // Im Startseiten-Feed-Grid (data-testid="ad-tile-image-wrapper") z.B. ist
        // das Bild ein Geschwisterelement des <a>, nicht dessen Kind -- die ganze
        // Karte wirkt nur optisch klickbar (per CSS ::after-Overlay-Trick auf dem
        // Link). Deshalb zuerst die Karte (li/article) suchen und DARIN nach dem
        // Anzeigen-Link suchen, statt direkt vom Bild nach oben zum <a> zu laufen.
        const card = img.closest('li, article.aditem');
        if (card) {
            const link = card.querySelector('a[href^="/s-anzeige/"]') ||
                         card.querySelector('a.aditem-main--middle--price-shipping--price');
            if (link) return { hoverTarget: card, link: link.href };
        }
        // Fallback: kein li/article gefunden, aber das Bild liegt direkt in einem Link.
        const anchor = img.closest('a[href^="/s-anzeige/"]');
        if (anchor) return { hoverTarget: anchor, link: anchor.href };
        return null;
    }

    function processThumbnails() {
        document.querySelectorAll('img[src*="kleinanzeigen.de/api/v1/prod-ads/images/"]').forEach(img => {
            const ctx = findAdContext(img);
            if (!ctx || ctx.hoverTarget.dataset.kaZoomBound) return;
            ctx.hoverTarget.dataset.kaZoomBound = 'true';

            // Instantly set list to sharp medium resolution
            const origSrc = img.src;
            if (!origSrc.includes(CACHE_RULES.list)) {
                img.src = origSrc.replace(/rule=\$_\d+\.AUTO/, CACHE_RULES.list);
                if (img.srcset) img.removeAttribute('srcset');
            }

            // Add to smart preloader
            preloadObserver.observe(img);

            const maxSrc = origSrc.replace(/rule=\$_\d+\.AUTO/, CACHE_RULES.max);

            // Bind hover events
            ctx.hoverTarget.addEventListener('mouseenter', () => handleHover(ctx.link, maxSrc));
            ctx.hoverTarget.addEventListener('mouseleave', handleLeave);
        });
    }

    function handleHover(detailLink, mainImgSrc) {
        // Clear previous state
        overlay.innerHTML = '';
        overlay.classList.remove('active');
        if (currentAbortController) currentAbortController.abort();
        clearTimeout(hoverTimer);

        // Wait 250ms to prevent flashing on accidental hover
        hoverTimer = setTimeout(() => {
            showGallery(detailLink, mainImgSrc);
        }, 250);
    }

    function handleLeave() {
        clearTimeout(hoverTimer);
        overlay.classList.remove('active');
        if (currentAbortController) currentAbortController.abort();
    }

    async function showGallery(detailLink, mainImgSrc) {
        overlay.classList.add('active');

        // 1. Sofort das $_45-Zwischenbild zeigen (kein leeres Overlay), danach im
        //    Hintergrund auf die schaerfste Aufloesung ($_57) hochladen und erst nach
        //    onload tauschen -- kein sichtbarer Sprung/Flackern.
        const mainImg = document.createElement('img');
        mainImg.src = mainImgSrc;
        overlay.appendChild(mainImg);

        const sharpSrc = mainImgSrc.replace(/rule=\$_\d+\.AUTO/, 'rule=$_57.AUTO');
        if (sharpSrc !== mainImgSrc) {
            const sharpPreload = new Image();
            sharpPreload.onload = () => { mainImg.src = sharpSrc; };
            sharpPreload.src = sharpSrc;
        }

        // 2. Fetch ad detail page to find remaining images
        if (!detailLink) return;

        currentAbortController = new AbortController();
        try {
            const response = await fetch(detailLink, { signal: currentAbortController.signal });
            const html = await response.text();
            const doc = new DOMParser().parseFromString(html, 'text/html');

            // Find all images in the gallery of the detail page
            const detailImages = Array.from(doc.querySelectorAll('.galleryimage-element img'));
            
            // Extract unique image URLs, limit to next 3 images
            // Insgesamt max. 3 Bilder im Overlay (1 Hauptbild + 2 weitere) --
            // vorher 4, ab 4 wird's eine Kontaktfolie statt brauchbarer Vorschau.
            let added = 0;
            const seenUrls = new Set([mainImgSrc]); // don't add main image again

            for (const dImg of detailImages) {
                if (added >= 2) break;
                
                let src = dImg.getAttribute("src");
                if (!src || !src.includes('prod-ads/images')) continue;
                
                src = src.replace(/rule=\$_\d+\.AUTO/, CACHE_RULES.max);
                
                if (!seenUrls.has(src)) {
                    seenUrls.add(src);
                    added++;
                    
                    const newImg = document.createElement('img');
                    newImg.src = src;
                    overlay.appendChild(newImg);
                }
            }
        } catch (err) {
            if (err.name !== 'AbortError') {
                console.error('[KA] Error fetching ad gallery:', err);
            }
        }
    }

    // Run initially and observe mutations
    processThumbnails();

    // WICHTIG: kein ungebremster Observer! Auf Seiten ohne #srchrslt-adtable/.itemlist
    // (z.B. die Startseite mit dem Feed-Grid) faellt der Container auf document.body
    // zurueck -- dort mutiert staendig irgendwas (Werbung, Tracking-Skripte, nachladende
    // Feed-Elemente), voellig unabhaengig von neuen Anzeigenbildern. Ohne Debounce
    // wuerde processThumbnails() (voller Rescan der Seite + pro Bild eine Card-Suche)
    // bei jeder dieser Mutationen sofort erneut laufen und den Tab lahmlegen. Debounce
    // nach demselben Muster wie der SortSaver-Freeze-Fix.
    let debounceTimer = null;
    const observer = new MutationObserver((mutations) => {
        let hasAddedNodes = false;
        for (const m of mutations) {
            if (m.addedNodes.length > 0) { hasAddedNodes = true; break; }
        }
        if (!hasAddedNodes) return;

        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(processThumbnails, 400);
    });

    const adListContainer = document.querySelector('#srchrslt-adtable, .itemlist') || document.body;
    observer.observe(adListContainer, { childList: true, subtree: true });
});

