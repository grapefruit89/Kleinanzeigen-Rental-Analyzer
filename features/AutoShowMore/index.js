KAFeatureManager.register('AutoShowMore', () => {
    // Only run on homepage
    if (window.location.pathname !== '/' && window.location.pathname !== '') {
        return;
    }

    let moreButtonObserver = null;
    
    function attemptClickMoreButton() {
        // Find the specific 'Show More' button
        const button = document.querySelector('div.flex.justify-center.p-small button');
        
        if (button && getComputedStyle(button).display !== 'none') {
            console.log("[KA] 'Mehr anzeigen' Button gefunden und geklickt.");
            button.click();
            
            if (moreButtonObserver) {
                moreButtonObserver.disconnect();
            }
            return true;
        }
        return false;
    }

    moreButtonObserver = new MutationObserver(() => {
        if (attemptClickMoreButton()) {
            moreButtonObserver.disconnect();
        }
    });

    moreButtonObserver.observe(document.body, {
        childList: true,
        subtree: true
    });

    attemptClickMoreButton();
});
