const KANavigation = {
    currentIndex: -1,
    visibleAds: [],

    // Kleinanzeigen rendert den Nächste/Zurück-Button je nach Zustand unterschiedlich:
    // - meistens als <a aria-label="Nächste"|"Zurück" href="..."> -- normal klickbar.
    // - manchmal (z.B. am Rand der "..."-Pagination) als <span title="Nächste"|"Zurück"
    //   data-url="..." aria-hidden="true"> -- KEIN echter Link, .click() tut nichts,
    //   man muss selbst zur data-url navigieren.
    // Primär: aria-label / title. Fallback: alte Klassen/Text-Suche als Sicherheitsnetz,
    // falls Kleinanzeigen die Struktur nochmal ändert.
    findPaginationElement(kind) {
        const label = kind === 'next' ? 'Nächste' : 'Zurück';

        const byAria = document.querySelector(`a[aria-label="${label}"]`);
        if (byAria) return byAria;

        const byTitleDataUrl = document.querySelector(`[title="${label}"][data-url]`);
        if (byTitleDataUrl) return byTitleDataUrl;

        // Legacy-Fallback (alte Kleinanzeigen-Struktur)
        const legacySelector = kind === 'next' ? '.pagination-next' : '.pagination-prev';
        const legacyEl = document.querySelector(legacySelector);
        if (legacyEl) return legacyEl;

        return Array.from(document.querySelectorAll('a')).find(el => el.innerText?.includes(label)) || null;
    },

    navigateTo(el) {
        if (!el) return;
        const href = el.getAttribute && el.getAttribute('href');
        if (href) {
            el.click();
            return;
        }
        const dataUrl = el.getAttribute && el.getAttribute('data-url');
        if (dataUrl) {
            window.location.href = dataUrl;
            return;
        }
        // Letzter Versuch: normaler Klick, falls die Seite einen eigenen Handler hat
        el.click?.();
    },

    init() {
        document.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            const key = e.key.toLowerCase();

            // --- Pagination (A/D) ---
            if (key === 'd') { // Nächste Seite
                this.navigateTo(this.findPaginationElement('next'));
            } else if (key === 'a') { // Vorherige Seite
                this.navigateTo(this.findPaginationElement('prev'));
            }

            // --- Ad-Navigation (W/S) ---
            this.updateVisibleAds();
            if (this.visibleAds.length === 0) return;
            if (key === 's') { // Runter
                this.navigateAds(1);
            } else if (key === 'w') { // Hoch
                this.navigateAds(-1);
            }
        });
    },

    updateVisibleAds() {
        // Collect all currently visible ads in the DOM independently of RentalAnalyzer
        const ads = Array.from(document.querySelectorAll('article.aditem')).filter(ad => {
            const style = window.getComputedStyle(ad);
            return style.display !== 'none' && style.visibility !== 'hidden';
        });
        this.visibleAds = ads;
        this.currentIndex = -1;
    },

    navigateAds(direction) {
        if (this.currentIndex >= 0 && this.visibleAds[this.currentIndex]) {
            this.visibleAds[this.currentIndex].classList.remove('ka-ad-focused');
        }

        this.currentIndex += direction;
        if (this.currentIndex < 0) this.currentIndex = 0;
        if (this.currentIndex >= this.visibleAds.length) this.currentIndex = this.visibleAds.length - 1;

        const targetAd = this.visibleAds[this.currentIndex];
        if (targetAd) {
            targetAd.classList.add('ka-ad-focused');
            targetAd.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }
};
KAFeatureManager.register('WasdNavigation', () => KANavigation.init());
