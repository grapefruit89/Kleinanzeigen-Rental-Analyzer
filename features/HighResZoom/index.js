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

