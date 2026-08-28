const KANavigation = {
    currentIndex: -1,
    visibleAds: [],

    findPaginationLink(kind) {
        const label = kind === 'next' ? 'Nächste' : 'Zurück';
        return document.querySelector(`a[aria-label="${label}"]`);
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
