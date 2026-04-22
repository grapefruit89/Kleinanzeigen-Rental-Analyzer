# Kleinanzeigen Rental Analyzer - Projekt-Mandate (SSOT)

Dieses Dokument ist die **Source of Truth** für alle zukünftigen Entwicklungen an dieser Chrome-Extension.

## 🎯 Kern-Philosophie
Transformiere Kleinanzeigen in ein professionelles Immobilien-Analyse-Tool mit Echtzeit-Statistiken, regionaler Preis-Historie und einer hocheffizienten Tastatur-Steuerung.

## 🛠️ Architektur-Mandate (Strikte Trennung)
Die Erweiterung ist modular aufgebaut. Jede Datei hat genau eine Aufgabe:
1.  **`lib/stats.js`**: Mathematik-Kern. Berechnet Median, IQR, Q1, Q3 und Ausreißer.
2.  **`lib/parser.js`**: "Aggressiver" Text-Scanner. Sucht per Regex nach m², Preis und PLZ im gesamten Text der Anzeige.
3.  **`lib/storage.js`**: Async-Wrapper für `chrome.storage.local`.
4.  **`content/ui.js`**: Verwaltet das Dashboard, das Einfärben der Anzeigen und die Filter-Sperren.
5.  **`content/navigation.js`**: Tastatur-Steuerung (WASD/AD).
6.  **`content/main.js`**: Der Dirigent. Koordiniert Scans, Updates und MutationObserver.

## 📊 Statistik- & Daten-Regeln
- **IQR-Modell:** Nutze den Interquartile Range (IQR) zur Segmentierung (Grün: <=Q1, Gelb: Q1-Q3, Rot: >Q3) und zur Ausreißer-Erkennung (1.5 * IQR).
- **Regionale Matrix:** Das Dashboard muss für die Top 3 PLZ-Zonen (4-stellig) eine Preis-Tabelle (Günstig/Mittel/Teuer) anzeigen.
- **Rollender Speicher:** Datenbank (`rental_db`) speichert max. 2000 Einträge mit einer Time-To-Live (TTL) von 90 Tagen (FIFO).
- **PLZ-Granularität:** Vergleiche basieren primär auf 4-stelligen PLZ-Präfixen; Fallback auf 3-stellig nur bei <5 Proben.

## 🎮 Navigations-Standard (Gamer-Steuerung)
- **WASD-Layout:**
    - `W`: Vorherige Anzeige (Smooth Scroll).
    - `S`: Nächste Anzeige (Smooth Scroll).
    - `A`: Vorherige Seite (Pagination).
    - `D`: Nächste Seite (Pagination).
- **Visueller Fokus:** Die selektierte Anzeige erhält zwingend einen kräftigen blauen Fokus-Rahmen (`.ka-ad-focused`).

## 🛡️ Daten-Integrität & Filter-Sperren
- **Hard-Redirect:** Erzwinge URL-Parameter `anzeige:angebote` und `wohnung_mieten.swap_s:nein`.
- **UI-Lock:** Buttons zum Entfernen dieser Kern-Filter (`aria-label`) müssen im DOM versteckt oder unklickbar gemacht werden.
- **TOP-Ads:** Anzeigen mit TOP-Badges werden komplett ausgeblendet (`display: none`), um die organische Statistik nicht zu verfälschen.

## 🎨 UI & Dashboard
- **Sandwich-Injektion:** Das Dashboard sitzt immer über den Suchergebnissen (`#srchrslt-results`).
- **Interaktivität:** Die Dashboard-Karten (Günstig/Mittel/Teuer) dienen als Filter und blenden Anzeigen der jeweiligen Kategorie ein/aus.
- **Transparenz:** Die berechneten €/m² Werte werden als Badge direkt an den Preis in der Anzeige geheftet.
