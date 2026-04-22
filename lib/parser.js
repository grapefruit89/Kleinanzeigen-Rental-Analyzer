const KARentalParser = {
    extract(ad) {
        try {
            const id = ad.getAttribute('data-adid') || ad.querySelector('a')?.getAttribute('href')?.match(/\d+/)?.[0];
            const isTop = ad.querySelector('.aditem-image--badges--badge-topad') !== null;
            if (!id) return isTop ? { isTop: true } : null;

            let extractedPrice = null;
            let extractedSqm = null;
            let extractedPlz = null;
            let isTausch = false;

            const blacklist = ['mietfrei', 'objekt', 'beschreibung', 'bezug', 'monteur', 'küche', 'ebk'];

            const candidates = ad.querySelectorAll('p, span, div, a, li');
            
            candidates.forEach(el => {
                const text = (el.innerText || "").trim().replace(/\s+/g, ' ');
                const textLower = text.toLowerCase();
                if (text.length === 0) return;

                // 1. Tausch-Check
                if (textLower.includes('tausch')) isTausch = true;

                // 2. Metadaten-Check (Wir suchen in kurzen Schnipseln)
                // Überschriften sind meist > 60, wir bleiben bei max 50 für Metadaten
                if (text.length > 55) return;
                if (blacklist.some(word => textLower.includes(word))) return;

                // 3. m² Check (Muster: Zahl + m2/m²/qm)
                // Wir suchen den Teil-String, z.B. in "61 m² · 2 Zi."
                if (!extractedSqm) {
                    const sqmMatch = text.match(/([\d.,]+)\s*(m²|m2|qm)/i);
                    if (sqmMatch) {
                        extractedSqm = parseFloat(sqmMatch[1].replace(/\./g, '').replace(',', '.'));
                    }
                }

                // 4. Preis Check (Muster: Zahl + €)
                if (!extractedPrice) {
                    const priceMatch = text.match(/([\d.,]+)\s*€/i);
                    if (priceMatch) {
                        extractedPrice = parseFloat(priceMatch[1].replace(/\./g, '').replace(',', '.'));
                    }
                }

                // 5. PLZ Check (5-stellig am Wortanfang oder Teil des Strings)
                if (!extractedPlz) {
                    const plzMatch = text.match(/\b(\d{5})\b/);
                    if (plzMatch) extractedPlz = plzMatch[1];
                }
            });

            if (isTausch) return { isTop: true };

            // Plausibilität
            if (!extractedPrice || extractedPrice < 100 || !extractedSqm || extractedSqm < 5 || extractedSqm > 500) {
                return isTop ? { isTop: true } : null;
            }

            return {
                id, price: extractedPrice, sqm: extractedSqm,
                pricePerSqm: extractedPrice / extractedSqm,
                plzFull: extractedPlz, isTop
            };
        } catch (e) {
            console.error("[KA-PARSER] Heuristik-Fehler:", e);
            return null;
        }
    }
};
