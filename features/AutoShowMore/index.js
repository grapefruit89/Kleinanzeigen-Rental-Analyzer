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

    // Debounce: Auf der Startseite mutiert document.body staendig durch Werbung,
    // Tracking-Skripte und nachladende Feed-Elemente, voellig unabhaengig vom
    // 'Mehr anzeigen'-Button. Ohne Debounce wuerde attemptClickMoreButton() bei
    // jeder dieser Mutationen sofort ausgefuehrt (gleiches Muster, das schon bei
    // SortSaver und HighResZoom zu Freezes gefuehrt hat). Klickt trotzdem nur
    // einmal, danach wird disconnected -- kein Risiko einer Klick-Endlosschleife,
    // aber das ungebremste Scannen selbst war schon das Problem.
    let debounceTimer = null;
    moreButtonObserver = new MutationObserver(() => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            if (attemptClickMoreButton()) {
                moreButtonObserver.disconnect();
            }
        }, 400);
    });

    moreButtonObserver.observe(document.body, {
        childList: true,
        subtree: true
    });

    attemptClickMoreButton();
});
