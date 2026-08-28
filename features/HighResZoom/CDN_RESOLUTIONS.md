# Kleinanzeigen CDN Bild-Auflösungen

Dieses Dokument speichert die empirisch ermittelten Bild-Auflösungs-Regeln des Kleinanzeigen-CDNs (Stand: August 2026).
Kleinanzeigen liefert Bilder über `img.kleinanzeigen.de/.../?rule=$_XX.AUTO` aus. Die Zahl `XX` bestimmt dabei die Auflösung, folgt aber keinem linearen Muster.

## Ermittelte Größen (Absteigend)

| Regel | Pixel-Auflösung |
| :--- | :--- |
| `$_57.AUTO` | 1600 x 694 |
| `$_45.AUTO` | 1200 x 521 |
| `$_86.AUTO` | 1024 x 444 |
| `$_32.AUTO` | 1000 x 434 |
| `$_59.AUTO` | 960 x 416 |
| `$_3.AUTO`  | 800 x 347 |
| `$_20.AUTO` | 800 x 347 |
| `$_85.AUTO` | 726 x 315 |
| `$_27.AUTO` | 640 x 278 |
| `$_58.AUTO` | 640 x 278 |
| `$_12.AUTO` | 500 x 217 |
| `$_21.AUTO` | 500 x 217 |
| `$_72.AUTO` | 500 x 217 |
| `$_75.AUTO` | 430 x 187 |
| `$_1.AUTO`  | 400 x 174 |
| `$_16.AUTO` | 400 x 174 |
| `$_19.AUTO` | 400 x 174 |
| `$_8.AUTO`  | 300 x 130 |
| `$_35.AUTO` | 300 x 130 |
| `$_24.AUTO` | 298 x 129 |
| `$_62.AUTO` | 225 x 97 |
| `$_90.AUTO` | 220 x 95 |
| `$_2.AUTO`  | 200 x 87 |
| `$_9.AUTO`  | 200 x 87 |
| `$_18.AUTO` | 200 x 87 |
| `$_37.AUTO` | 175 x 76 |
| `$_7.AUTO`  | 150 x 65 |
| `$_26.AUTO` | 140 x 60 |
| `$_56.AUTO` | 100 x 43 |
| `$_0.AUTO`  | 96 x 41 |
| `$_97.AUTO` | 90 x 39 |
| `$_23.AUTO` | 80 x 34 |
| `$_6.AUTO`  | 70 x 30 |
| `$_14.AUTO` | 64 x 28 |
| `$_22.AUTO` | 60 x 26 |
| `$_34.AUTO` | 50 x 22 |
| `$_39.AUTO` | 32 x 14 |

---

## Test-Skript (Für F12 DevTools Konsole)
Mit diesem Skript kann jederzeit live auf einer Kleinanzeigen-Seite überprüft werden, ob die CDN-Regeln noch gültig sind. Das Skript sucht automatisch nach einem Bild und probiert die Regeln `$_0` bis `$_100` durch.

```javascript
(async function() {
    console.log("🔍 Suche nach einem Basis-Bild auf der Seite...");
    const imgElement = Array.from(document.querySelectorAll('img')).find(img => img.src && img.src.includes('$_'));
    
    if (!imgElement) {
        console.error("❌ Kein passendes Bild gefunden. Bitte öffne die Detailseite einer Anzeige!");
        return;
    }

    const baseUrl = imgElement.src;
    console.log("✅ Basis-Bild gefunden:", baseUrl);
    console.log("⏳ Teste CDN-Regeln von $_0 bis $_100. Das dauert ein paar Sekunden...\n");

    const checkImageSize = (url, ruleNumber) => {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => resolve({ Regel: '$_' + ruleNumber, Breite: img.naturalWidth, Höhe: img.naturalHeight, Auflösung: img.naturalWidth + ' x ' + img.naturalHeight });
            img.onerror = () => resolve(null);
            img.src = url;
        });
    };

    const promises = [];
    for (let i = 0; i <= 100; i++) {
        promises.push(checkImageSize(baseUrl.replace(/\$_\d+/, '$_' + i), i));
    }

    const loadedImages = await Promise.all(promises);
    const validResults = loadedImages.filter(res => res !== null).sort((a, b) => (b.Breite * b.Höhe) - (a.Breite * a.Höhe));

    console.log("🎉 Test abgeschlossen! Hier sind alle verfügbaren Größen (absteigend sortiert):");
    console.table(validResults.map(({Regel, Auflösung}) => ({Regel, Auflösung})));
})();
```
