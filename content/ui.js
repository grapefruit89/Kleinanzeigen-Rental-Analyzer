const KAUI = {
    activeCategory: null,
    activeRegion: null,

    injectDashboard() {
        if (document.getElementById('ka-analyzer-dashboard')) return;
        const resultsList = document.querySelector('#srchrslt-results') || document.querySelector('.ad-list');
        if (resultsList) {
            const dash = document.createElement('div');
            dash.id = 'ka-analyzer-dashboard';
            resultsList.parentNode.insertBefore(dash, resultsList);
        }
    },

    setLoading(msg = "Warte auf Anzeigen...") {
        const dash = document.getElementById('ka-analyzer-dashboard');
        if (dash) dash.innerHTML = `<div style="padding: 15px; width: 100%; text-align: center; color: #666;">${msg}</div>`;
    },

    updateDashboard(globalStats, regionalStats, db, currentAdsCount) {
        const dash = document.getElementById('ka-analyzer-dashboard');
        if (!dash) return;

        const totalDbCount = Object.keys(db.ads).length;

        const rowHtml = regionalStats.map(r => `
            <div class="ka-matrix-row">
                <div class="ka-matrix-grid">
                    <div class="ka-matrix-cell ka-low ${this.activeCategory === 'low' && this.activeRegion === r.plz ? 'active' : ''}" data-type="low" data-plz="${r.plz}">
                        <span class="ka-matrix-label">Günstig</span>
                        <span class="ka-matrix-price">${r.q1.toFixed(2)} €</span>
                    </div>
                    <div class="ka-matrix-cell ka-mid ${this.activeCategory === 'mid' && this.activeRegion === r.plz ? 'active' : ''}" data-type="mid" data-plz="${r.plz}">
                        <span class="ka-matrix-label">Mittel</span>
                        <span class="ka-matrix-price">${r.median.toFixed(2)} €</span>
                    </div>
                    <div class="ka-matrix-cell ka-high ${this.activeCategory === 'high' && this.activeRegion === r.plz ? 'active' : ''}" data-type="high" data-plz="${r.plz}">
                        <span class="ka-matrix-label">Teuer</span>
                        <span class="ka-matrix-price">${r.q3.toFixed(2)} €</span>
                    </div>
                </div>
                <div class="ka-matrix-footer">
                    <span>Region <b>${r.plz}</b></span>
                    <span>Basis: <b>${r.onPage}/${r.inHistory}</b> Anzeigen</span>
                </div>
            </div>
        `).join('');

        dash.innerHTML = `
            ${rowHtml || '<div style="padding:15px; text-align:center;">Warte auf regionale Daten...</div>'}
            
            <div id="ka-dash-meta">
                <div>Datenbank (Total): <b>${totalDbCount}</b> Einträge</div>
                <div style="display: flex; gap: 10px;">
                    <button id="ka-dash-export-btn">CSV Export (Alles)</button>
                    <button id="ka-dash-clear-btn">DB leeren</button>
                </div>
            </div>
        `;

        dash.querySelectorAll('.ka-matrix-cell').forEach(cell => {
            cell.onclick = () => this.toggleMatrixFilter(cell.dataset.type, cell.dataset.plz);
        });

        document.getElementById('ka-dash-clear-btn').onclick = async () => {
            if (confirm('Gesamte Datenbank löschen?')) { await KAStorage.set('rental_db', { ads: {} }); location.reload(); }
        };

        document.getElementById('ka-dash-export-btn').onclick = () => this.exportDatabaseToCSV(db.ads);
    },

    exportDatabaseToCSV(ads) {
        const rows = [["ID", "PLZ", "Euro_pro_m2", "Datum"]];
        for (const id in ads) {
            const item = ads[id];
            const date = new Date(item.t).toISOString().split('T')[0];
            rows.push([id, item.plz, item.p.toFixed(2).replace('.', ','), date]);
        }
        
        const csvContent = "\uFEFF" + rows.map(e => e.join(";")).join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `mietanalyse_gesamt_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    },

    toggleMatrixFilter(category, plz) {
        if (this.activeCategory === category && this.activeRegion === plz) {
            this.activeCategory = null; this.activeRegion = null;
        } else {
            this.activeCategory = category; this.activeRegion = plz;
        }
        
        const ads = document.querySelectorAll('article[data-adid], .aditem');
        ads.forEach(ad => {
            const listItem = ad.closest('.ad-listitem') || ad;
            if (ad.style.display === 'none' && !ad.classList.contains('ka-filtered')) return; 

            if (!this.activeCategory) {
                listItem.style.display = '';
                ad.classList.remove('ka-filtered');
            } else {
                const hasPriceClass = ad.classList.contains(`ka-price-${this.activeCategory}`);
                const adPlz = KARentalParser.extract(ad)?.plzFull || "";
                const hasPlzMatch = adPlz.startsWith(plz.replace('X', ''));
                
                const matches = hasPriceClass && hasPlzMatch;
                listItem.style.display = matches ? '' : 'none';
                if (!matches) ad.classList.add('ka-filtered');
                else ad.classList.remove('ka-filtered');
            }
        });
        this.updateDashboardState();
    },

    updateDashboardState() {
        document.querySelectorAll('.ka-matrix-cell').forEach(c => {
            if (c.dataset.type === this.activeCategory && c.dataset.plz === this.activeRegion) c.classList.add('active');
            else c.classList.remove('active');
        });
    },

    markAd(article, pricePerSqm, stats) {
        article.classList.remove('ka-price-low', 'ka-price-mid', 'ka-price-high', 'ka-outlier');
        let badge = article.querySelector('.ka-sqm-badge');
        if (!badge) {
            badge = document.createElement('div'); badge.className = 'ka-sqm-badge';
            const box = article.querySelector('.aditem-main--middle--price-shipping') || article.querySelector('.aditem-main--middle');
            if (box) box.appendChild(badge);
        }
        badge.innerText = `${pricePerSqm.toFixed(2).replace('.', ',')} €/m²`;
        if (pricePerSqm < stats.lowerFence || pricePerSqm > stats.upperFence) article.classList.add('ka-outlier');
        else if (pricePerSqm <= stats.q1) article.classList.add('ka-price-low');
        else if (pricePerSqm <= stats.q3) article.classList.add('ka-price-mid');
        else article.classList.add('ka-price-high');
    },

    hideAd(ad) {
        const listItem = ad.closest('.ad-listitem') || ad;
        listItem.style.display = 'none';
    },

    lockFilters() {
        const filterTexts = ['Alle', 'Gesuche', 'Tauschangebot'];
        document.querySelectorAll('a, label, span').forEach(el => {
            if (filterTexts.some(txt => el.innerText.trim() === txt)) {
                el.style.opacity = '0.3'; el.style.pointerEvents = 'none';
            }
        });
        ['Filter Angebote entfernen', 'Filter Kein Tausch entfernen'].forEach(label => {
            const btn = document.querySelector(`a[aria-label="${label}"]`);
            if (btn) {
                btn.style.display = 'none';
                const p = btn.closest('.tag, .facet-active, .breadcrump-link, li');
                if (p) { p.style.pointerEvents = 'none'; p.style.opacity = '0.7'; }
            }
        });
    }
};
