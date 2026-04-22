
                    max-width: 94vw;
                    max-height: 94vh;
                    transform: translate(-50%, -50%);
                    z-index: 29999;
                    border-radius: 12px;
                    box-shadow: 0 8px 40px 0 rgba(0,0,0,0.72);
                    background: #222;
                    opacity: 0;
                    pointer-events: none;
                    display: block;
                    object-fit: contain;
                    transition: opacity 0.16s cubic-bezier(0.19, 1, 0.22, 1);
                }
            `;
            document.head.appendChild(style);
        },
 
        injectDashboard(stats) {
            console.log('[KA-SCRIPT] Injiziere Dashboard mit folgenden Daten:', stats);
            document.getElementById('ka-main-dashboard')?.remove();
 
            const anchor = document.querySelector(CONFIG.DASHBOARD_ANCHOR_SELECTOR);
 
            if (!anchor) {
                console.error(`[KA-SCRIPT] Dashboard-Anker "${CONFIG.DASHBOARD_ANCHOR_SELECTOR}" nicht gefunden! Nutze Body als Fallback.`);
                document.body.prepend(this.createDashboardPanel(stats));
                return;
            }
 
            console.log('[KA-SCRIPT] Dashboard-Anker gefunden:', anchor);
            const panel = this.createDashboardPanel(stats);
            anchor.parentNode.insertBefore(panel, anchor.nextSibling);
        },
        
        createDashboardPanel(stats) {
            const panel = document.createElement('div');
            panel.id = 'ka-main-dashboard';
            
            const createCard = (className, title, value, subtext) => {
                const card = document.createElement('div');
                card.className = `ka-dash-card ${className}`;
                card.innerHTML = `
                    <div class="ka-dash-title">${title}</div>
                    <span class="ka-dash-value">${value}</span>
                    <div class="ka-dash-sub">${subtext}</div>
                `;
                return card;
            };
            
            panel.append(
                createCard('ka-low', 'Günstig', stats.low.count, `${stats.low.min}–${stats.low.max} €/m²`),
                createCard('ka-mid', 'Mittel', stats.mid.count, `${stats.mid.min + 1}–${stats.mid.max} €/m²`),
                createCard('ka-high', 'Teuer', stats.high.count, `${stats.high.min + 1}–${stats.high.max} €/m²`)
            );
            
            const metaDiv = document.createElement('div');
            metaDiv.id = 'ka-dash-meta';
            metaDiv.innerHTML = `Analysiert: <b>${stats.adsOnPage}</b> · Ø-Preis: <b>${stats.avg} €/m²</b>`;
            
            const clearBtn = document.createElement('button');
            clearBtn.id = 'ka-dash-clear-btn';
            clearBtn.textContent = 'Preis-Cache löschen';
            clearBtn.onclick = () => this.storage.clear();
            metaDiv.appendChild(clearBtn);
            panel.appendChild(metaDiv);
            
            return panel;
        },
 
        blockScripts() {
            const observer = new MutationObserver(mutations => {
                mutations.forEach(m => m.addedNodes.forEach(node => {
                    if (node.nodeType === 1 && node.tagName === 'SCRIPT' && node.src && 
                        CONFIG.AD_SCRIPT_PATTERNS.some(rx => rx.test(node.src))) {
                        console.warn('[KA-SCRIPT] Blockiere Werbe-Script:', node.src);
                        node.remove();
                    }
                }));
            });
            observer.observe(document.documentElement, { childList: true, subtree: true });
        },
 
        removeAdElements() {
            document.querySelectorAll(CONFIG.AD_ELEMENT_SELECTORS.join(', ')).forEach(el => el.remove());
            document.querySelectorAll(CONFIG.AD_ITEM_SELECTOR).forEach(ad => {
                if (/top anzeige|gesponsert|sponsored/i.test(ad.textContent)) {
                    ad.remove();
                }
            });
        },
 
        async processAdItems() {
            this.state.regionalPrices = await this.storage.load();
            let storageChanged = false;
            const adElements = document.querySelectorAll(CONFIG.AD_ITEM_SELECTOR);
            
            console.log(`[KA-SCRIPT] ${adElements.length} Anzeigenelemente mit Selektor "${CONFIG.AD_ITEM_SELECTOR}" gefunden.`);
            
            if (adElements.length === 0) return;
 
            const adData = Array.from(adElements).map(article => {
                article.classList.remove('ka-price-low', 'ka-price-mid', 'ka-price-high', 'ka-price-uniform');
                article.querySelector('.ka-sqm-wrap')?.remove();
                
                const data = this.parser.parseArticle(article, this.state.plzLength);
                if (!data) return null;
                
                const roundedPrice = Math.round(data.pricePerSqm);
                const plzPrefix = data.plzPrefix;
                
                if (!this.state.regionalPrices[plzPrefix]) {
                    this.state.regionalPrices[plzPrefix] = {};
                }
                
                if (this.state.regionalPrices[plzPrefix][data.adId] !== roundedPrice) {
                    this.state.regionalPrices[plzPrefix][data.adId] = roundedPrice;
                    storageChanged = true;
                }
                
                const pricebox = article.querySelector('.aditem-main--middle--price-shipping');
                if (pricebox) {
                    const wrap = document.createElement('div');
                    wrap.className = 'ka-sqm-wrap';
                    wrap.innerHTML = `<span class="ka-sqm-price-display">${data.pricePerSqm.toFixed(2).replace('.', ',')} €/m²</span>`;
                    pricebox.appendChild(wrap);
                }
                
                return { article, ...data };
            }).filter(Boolean);
 
            console.log(`[KA-SCRIPT] ${adData.length} davon konnten erfolgreich verarbeitet werden.`);
            
            if (storageChanged) {
                await this.storage.save(this.state.regionalPrices);
            }
            
            if (!adData.length) {
                document.getElementById('ka-main-dashboard')?.remove();
                return;
            }
 
            const prices = adData.map(d => d.pricePerSqm);
            const minP = Math.min(...prices);
            const maxP = Math.max(...prices);
            const range = maxP - minP;
            const lower = minP + range / 3;
            const upper = minP + 2 * range / 3;
            
            let low = 0, mid = 0, high = 0;
            
            adData.forEach(({ article, pricePerSqm }) => {
                if (range < 0.01) {
                    article.classList.add('ka-price-uniform');
                    return;
                }
                if (pricePerSqm <= lower) {
                    article.classList.add('ka-price-low');
                    low++;
                } else if (pricePerSqm <= upper) {
                    article.classList.add('ka-price-mid');
                    mid++;
                } else {
                    article.classList.add('ka-price-high');
                    high++;
                }
            });
            
            this.injectDashboard({
                low: { count: low, min: Math.round(minP), max: Math.floor(lower) },
                mid: { count: mid, min: Math.floor(lower), max: Math.floor(upper) },
                high: { count: high, min: Math.floor(upper), max: Math.round(maxP) },
                adsOnPage: adData.length,
                avg: (prices.reduce((s, x) => s + x, 0) / prices.length).toFixed(2),
            });
        },
 
        parser: {
            parseArticle(article, plzLength) {
                const data = {
                    plzPrefix: this.getPLZPrefix(article, plzLength),
                    area: this.getArea(article),
                    price: this.getPrice(article),
                    adId: this.getAdId(article)
                };
                
                if (!data.plzPrefix || !data.area || !data.price || !data.adId) {
                    return null;
                }
                
                data.pricePerSqm = data.price / data.area;
                return data;
            },
            
            getPLZPrefix(article, plzLength) {
                const match = article.textContent.match(/\b(\d{5})\b/);
                return match ? match[1].substring(0, plzLength) : null;
            },
            
            getArea(article) {
                // Versuche zuerst im Tags-Container
                const tagsContainer = article.querySelector('p.aditem-main--middle--tags');
                if (tagsContainer) {
                    const match = tagsContainer.textContent.match(/([0-9.,]+)\s*m²/);
                    if (match) {
                        return parseFloat(match[1].replace(',', '.'));
                    }
                }
                
                // Fallback: Suche im Bottom-Bereich (für neue Struktur)
                const bottomContainer = article.querySelector('.aditem-main--bottom p');
                if (bottomContainer && bottomContainer.innerHTML.includes('m²')) {
                    const match = bottomContainer.innerHTML.match(/([0-9.,]+)\s*m²/);
                    if (match) {
                        return parseFloat(match[1].replace(',', '.'));
                    }
                }
                
                // Letzter Fallback: Gesamter Text
                const match = article.textContent.match(/\b([\d.,]+)\s*m²\b/);
                return match ? parseFloat(match[1].replace(',', '.')) : null;
            },
            
            getPrice(article) {
                const priceEl = article.querySelector('.aditem-main--middle--price-shipping--price');
                if (priceEl) {
                    // FIX: Extrahiere nur den ersten Preis (vor Rabatt)
                    const priceMatch = priceEl.textContent.match(/([\d\.,]+)\s*€/i);
                    if (priceMatch) {
                        const cleaned = priceMatch[1].replace(/\./g, '').replace(',', '.');
                        const value = parseFloat(cleaned);
                        if (!isNaN(value)) {
                            return value;
                        }
                    }
                }
                
                // Fallback auf gesamten Text
                const match = article.textContent.match(/(\d{1,3}(?:\.\d{3})*(?:,\d{2})?|\d+)\s*€/);
                if (match) {
                    return parseFloat(match[1].replace(/\./g, '').replace(',', '.'));
                }
                
                return null;
            },
            
            getAdId(article) {
                return article.dataset.adid || 'ad_' + btoa(article.textContent.substring(0, 32)).replace(/[^a-zA-Z0-9]/g, '').substring(0, 10);
            }
        },
 
        storage: {
            getStorageKey() {
                return `${CONFIG.STORAGE_KEY_PREFIX}_${KleinanzeigenOptimizer.state.plzLength}`;
            },
            
            async load() {
                return await GM.getValue(this.getStorageKey(), {});
            },
            
            async save(data) {
                await GM.setValue(this.getStorageKey(), data);
            },
            
            async clear() {
                if (confirm('Alle regionalen m²-Preis-Daten für die aktuelle PLZ-Länge löschen?')) {
                    await GM.deleteValue(this.getStorageKey());
                    KleinanzeigenOptimizer.state.regionalPrices = {};
                    KleinanzeigenOptimizer.run();
                }
            }
        },
 
        setupImgZoom() {
            const list = document.querySelector('#srchrslt-adtable, #srchrslt-gallery');
            if (!list || list.dataset.kaZoomBound) return;
            
            list.dataset.kaZoomBound = 'y';
            
            let overlayImg = document.querySelector('.ka-overlay-img');
            if (!overlayImg) {
                overlayImg = document.createElement('img');
                overlayImg.className = 'ka-overlay-img';
                document.body.appendChild(overlayImg);
                overlayImg.onclick = () => {
                    overlayImg.style.opacity = '0';
                    overlayImg.style.pointerEvents = 'none';
                };
            }
            
            list.addEventListener('mouseover', e => {
                const img = e.target.closest('.imagebox img, .aditem-image img');
                if (img) {
                    img.style.cursor = 'zoom-in';
                    overlayImg.src = img.src;
                    overlayImg.style.opacity = '1';
                    overlayImg.style.pointerEvents = 'auto';
                }
            });
            
            list.addEventListener('mouseout', e => {
                if (e.target.closest('.imagebox img, .aditem-image img')) {
                    overlayImg.style.opacity = '0';
                }
            });
        },
 
        observeSPA() {
            const debouncedRun = this.utils.debounce(() => this.run(), CONFIG.DEBOUNCE_DELAY);
            const observer = new MutationObserver(() => {
                if (location.href !== this.state.lastUrl) {
                    this.state.lastUrl = location.href;
                    debouncedRun();
                }
            });
            observer.observe(document.body, { childList: true, subtree: true });
        },
 
        utils: {
            debounce(func, delay) {
                let timeout;
                return (...args) => {
                    clearTimeout(timeout);
                    timeout = setTimeout(() => func.apply(this, args), delay);
                };
            }
        }
    };
 
    KleinanzeigenOptimizer.init();
})();