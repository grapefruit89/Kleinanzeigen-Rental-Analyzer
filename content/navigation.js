const KANavigation = {
    currentIndex: -1,
    visibleAds: [],

    init() {
        document.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            const key = e.key.toLowerCase();

            // --- Pagination (A/D) ---
            if (key === 'd') { // Nächste Seite
                const nextBtn = document.querySelector('.pagination-next') || 
                                Array.from(document.querySelectorAll('a')).find(el => el.innerText.includes('Nächste'));
                if (nextBtn) nextBtn.click();
            } else if (key === 'a') { // Vorherige Seite
                const prevBtn = document.querySelector('.pagination-prev') || 
                                Array.from(document.querySelectorAll('a')).find(el => el.innerText.includes('Zurück'));
                if (prevBtn) prevBtn.click();
            }

            // --- Ad-Navigation (W/S) ---
            if (this.visibleAds.length === 0) return;
            if (key === 's') { // Runter
                this.navigateAds(1);
            } else if (key === 'w') { // Hoch
                this.navigateAds(-1);
            }
        });
    },

    updateVisibleAds(ads) {
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
KANavigation.init();
