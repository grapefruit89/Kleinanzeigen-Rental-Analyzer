(function() {
    'use strict';

    const MODULES = [
        { id: 'feature_RentalAnalyzer', name: 'Rental Analyzer', desc: 'Preis/m² und Historie für Mietwohnungen berechnen.' },
        { id: 'feature_WasdNavigation', name: 'WASD Navigation', desc: 'Mit A und D durch die Seiten blättern.' },
        { id: 'feature_UiCleaner', name: 'UI Cleaner', desc: 'Entfernt aggressive Werbebanner und Popups (Tier 1).' },
        { id: 'feature_HighResZoom', name: 'High-Res Zoom (Hover)', desc: 'Lädt knackscharfe Bilder und öffnet Galerie bei Hover.' },
        { id: 'feature_SortSaver', name: 'Sortierung speichern', desc: 'Speichert deine bevorzugte Sortierung (z.B. Neueste).' },
        { id: 'feature_WidescreenLayout', name: 'Widescreen Layout', desc: 'Nutzt den Platz auf großen Monitoren besser aus.' },
        { id: 'feature_AutoShowMore', name: 'Auto "Mehr anzeigen"', desc: 'Klickt automatisch auf "Mehr anzeigen" auf der Startseite.' },
        { id: 'feature_TrackerBlocker', name: 'Tracker-Blocker', desc: 'Blockiert Tracking-Skripte auf Netzwerk-Ebene.' },
        { id: 'feature_CleanHomepage', name: 'Startseite aufräumen', desc: 'Versteckt Kategorien und irrelevante Blöcke (Tier 2).' },
        { id: 'feature_ProAdManager', name: 'Pro-Anzeigen Manager', desc: 'Sortiert gewerbliche Ads ganz nach oben und markiert sie.' },
        { id: 'feature_DataExport', name: 'Datenexport (Auto-Scraper)', desc: 'Vollautomatischer Such-Scraper für LLM-Daten (JSONL).' },
        { id: 'McpBridge', name: 'MCP Bridge (DevTools)', desc: 'Verbindet einen lokalen KI-Agenten (WebSockets) mit diesem Tab.' }
    ];

    

    function injectHamburger() {
        if (document.getElementById('ka-inpage-menu-btn')) return;

        // Container, den der Nutzer im HTML gefunden hat
        const targetContainer = document.querySelector('span.flex.grow.flex-row.flex-nowrap.items-center.justify-end');
        if (!targetContainer) {
            // Fallback: versuche es im Header generell zu finden
            setTimeout(injectHamburger, 500);
            return;
        }

        const btn = document.createElement('button');
        btn.id = 'ka-inpage-menu-btn';
        btn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/></svg>`;
        btn.title = "Kleinanzeigen Rental Analyzer Settings";
        
        btn.addEventListener('click', openSidebar);
        targetContainer.appendChild(btn);
    }

    function createSidebar() {
        if (document.getElementById('ka-inpage-sidebar')) return;

        const overlay = document.createElement('div');
        overlay.id = 'ka-inpage-sidebar-overlay';
        overlay.addEventListener('click', closeSidebar);

        const sidebar = document.createElement('div');
        sidebar.id = 'ka-inpage-sidebar';

        const header = document.createElement('div');
        header.className = 'ka-sidebar-header';
        header.innerHTML = `
            <h2>KA Settings</h2>
            <button class="ka-close-btn">&times;</button>
        `;
        header.querySelector('.ka-close-btn').addEventListener('click', closeSidebar);

        const content = document.createElement('div');
        content.className = 'ka-sidebar-content';

        const reloadNotice = document.createElement('div');
        reloadNotice.className = 'ka-reload-notice';
        reloadNotice.id = 'ka-reload-notice';
        reloadNotice.innerHTML = `
            Änderungen wurden gespeichert!<br>
            <button class="ka-reload-btn" id="ka-reload-page-btn">Seite neu laden</button>
        `;

        chrome.storage.local.get(['ka_settings'], (result) => {
            const settings = result.ka_settings || {};
            
            MODULES.forEach(mod => {
                const isEnabled = settings[mod.id] !== false; // Default true

                const item = document.createElement('div');
                item.className = 'ka-module-item';
                
                item.innerHTML = `
                    <div class="ka-module-info">
                        <h3>${mod.name}</h3>
                        <p>${mod.desc}</p>
                        
                    </div>
                    <label class="ka-switch">
                        <input type="checkbox" id="ka-ui-${mod.id}" ${isEnabled ? 'checked' : ''}>
                        <span class="ka-slider"></span>
                    </label>
                `;

                const checkbox = item.querySelector(`#ka-ui-${mod.id}`);
                checkbox.addEventListener('change', () => {
                    settings[mod.id] = checkbox.checked;
                    chrome.storage.local.set({ ka_settings: settings });

                    if (mod.id === 'feature_TrackerBlocker') {
                        chrome.runtime.sendMessage({
                            action: "updateTrackerBlocker",
                            enabled: checkbox.checked
                        });
                    }
                    
                    
                    window.location.reload();
                });

                content.appendChild(item);
            });
            
        });

        sidebar.appendChild(header);
        sidebar.appendChild(content);

        document.body.appendChild(overlay);
        document.body.appendChild(sidebar);

        document.getElementById('ka-reload-page-btn')?.addEventListener('click', () => {
            window.location.reload();
        });
    }

    function openSidebar() {
        createSidebar(); // Erstellt sie, falls sie nicht existiert
        setTimeout(() => {
            document.getElementById('ka-inpage-sidebar-overlay').classList.add('active');
            document.getElementById('ka-inpage-sidebar').classList.add('active');
        }, 10);
    }

    function closeSidebar() {
        document.getElementById('ka-inpage-sidebar-overlay').classList.remove('active');
        document.getElementById('ka-inpage-sidebar').classList.remove('active');
        
        
    }

    // Direkt beim Start versuchen zu injizieren
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', injectHamburger);
    } else {
        injectHamburger();
    }

    // Observer für den Fall, dass React/Astro den Header neu rendert.
    // Debounce: dieser Observer laeuft auf JEDER Seite dauerhaft (nie disconnected)
    // und beobachtet document.documentElement (noch groesser als document.body,
    // schliesst also auch <head>-Mutationen ein). Ohne Debounce feuert er bei
    // jeder Mutation irgendwo auf der Seite, egal wie klein oder irrelevant fuer
    // den Header -- gleiches Risiko-Muster wie bei SortSaver/HighResZoom/
    // AutoShowMore. injectHamburger() selbst ist zwar dank fruehem Return billig,
    // sobald der Button existiert, aber das Debounce reduziert trotzdem die
    // Anzahl der Aufrufe drastisch, besonders auf Seiten mit vielen Mutationen
    // pro Sekunde (z.B. die Startseite).
    function initObserver() {
        if (!document.documentElement) {
            setTimeout(initObserver, 50);
            return;
        }
        let debounceTimer = null;
        const observer = new MutationObserver(() => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(injectHamburger, 400);
        });
        observer.observe(document.documentElement, { childList: true, subtree: true });
    }
    initObserver();

})();





