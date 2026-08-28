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
    // -> $_57 ist die groesste verfuegbare Aufloesung (fuer die Hover-Galerie/"max"),
    //    $_86 ein guter Kompromiss fuer die sofortige, scharfe Listen-Vorschau ("list"),
    //    ohne bei jeder Anzeige gleich das volle 1600px-Bild laden zu muessen.
    //    Alle anderen Regel-Nummern (34+ nicht getestete Werte zwischen 0-100 liefern
    //    404/Fehler) sind kleiner. Falls Kleinanzeigen das CDN-Schema aendert, muss
    //    dieser Test wiederholt werden (Skript siehe Projekt-Notizen "HighResZoom Test").
    const CACHE_RULES = { list: '$_86.AUTO', max: '$_57.AUTO' };

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
    function processThumbnails() {
        document.querySelectorAll('li.ad-listitem').forEach(ad => {
            if (ad.dataset.kaZoomBound) return;
            ad.dataset.kaZoomBound = 'true';

            const img = ad.querySelector('img[src*="kleinanzeigen.de/api/v1/prod-ads/images/"]');
            if (img) {
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
                ad.addEventListener('mouseenter', () => handleHover(ad, maxSrc));
                ad.addEventListener('mouseleave', handleLeave);
            }
        });
    }

    function handleHover(adElement, mainImgSrc) {
        // Clear previous state
        overlay.innerHTML = '';
        overlay.classList.remove('active');
        if (currentAbortController) currentAbortController.abort();
        clearTimeout(hoverTimer);

        // Wait 250ms to prevent flashing on accidental hover
        hoverTimer = setTimeout(() => {
            showGallery(adElement, mainImgSrc);
        }, 250);
    }

    function handleLeave() {
        clearTimeout(hoverTimer);
        overlay.classList.remove('active');
        if (currentAbortController) currentAbortController.abort();
    }

    async function showGallery(adElement, mainImgSrc) {
        overlay.classList.add('active');
        
        // 1. Show main image immediately
        const mainImg = document.createElement('img');
        mainImg.src = mainImgSrc;
        overlay.appendChild(mainImg);

        // 2. Fetch ad detail page to find remaining images
        const adLink = adElement.querySelector('a.aditem-main--middle--price-shipping--price');
        const fallbackLink = adElement.querySelector('a[href^="/s-anzeige/"]');
        const finalLink = fallbackLink ? fallbackLink.href : null;

        if (!finalLink) return;

        currentAbortController = new AbortController();
        try {
            const response = await fetch(finalLink, { signal: currentAbortController.signal });
            const html = await response.text();
            const doc = new DOMParser().parseFromString(html, 'text/html');

            // Find all images in the gallery of the detail page
            const detailImages = Array.from(doc.querySelectorAll('.galleryimage-element img'));
            
            // Extract unique image URLs, limit to next 3 images
            let added = 0;
            const seenUrls = new Set([mainImgSrc]); // don't add main image again

            for (const dImg of detailImages) {
                if (added >= 3) break;
                
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
    
    const observer = new MutationObserver((mutations) => {
        for (const m of mutations) {
            if (m.addedNodes.length > 0) {
                processThumbnails();
                break;
            }
        }
    });
    
    const adListContainer = document.querySelector('#srchrslt-adtable, .itemlist') || document.body;
    observer.observe(adListContainer, { childList: true, subtree: true });
});

