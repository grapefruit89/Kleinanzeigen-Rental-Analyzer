const KANavigation = {
    currentIndex: -1,
    visibleAds: [],

    // Kleinanzeigen hat sein Frontend auf Astro/Tailwind umgestellt (Stand 2026).
    // Die alten Klassen .pagination-next/.pagination-prev existieren nicht mehr,
    // und die Pfeil-Buttons haben keinen sichtbaren Text mehr -- nur ein Icon.
    // Robust: zuerst per aria-label suchen (das ist stabil geblieben),
    // danach die alten Selektoren als Fallback, falls sich das nochmal ändert.
    findPaginationLink(kind) {
        const ariaLabels = kind === 'next'
            ? ['Nächste', 'nächste Seite', 'Next']
            : ['Zurück', 'Vorherige', 'vorherige Seite', 'Previous'];

        for (const label of ariaLabels) {
            const el = document.querySelector(`a[aria-label="${label}"]`);
            if (el) return el;
        }

        // Fallback: alte, evtl. veraltete Selektoren
        const legacySelector = kind === 'next' ? '.pagination-next' : '.pagination-prev';
        const legacyEl = document.querySelector(legacySelector);
        if (legacyEl) return legacyEl;

        const textMatch = kind === 'next' ? 'Nächste' : 'Zurück';
        return Array.from(document.querySelectorAll('a')).find(el => el.innerText?.includes(textMatch)) || null;
    },

    init() {
        document.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            const key = e.key.toLowerCase();

            // --- Pagination (A/D) ---
            if (key === 'd') { // Nächste Seite
                const nextBtn = this.findPaginationLink('next');
                if (nextBtn) nextBtn.click();
            } else if (key === 'a') { // Vorherige Seite
                const prevBtn = this.findPaginationLink('prev');
                if (prevBtn) prevBtn.click();
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
