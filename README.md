# 🏠 Kleinanzeigen Rental Analyzer

Eine leistungsstarke Chrome-Erweiterung (Manifest V3), die Kleinanzeigen in ein professionelles Immobilien-Analyse-Tool verwandelt. Sie hilft dir, Mietpreise in Echtzeit zu bewerten, regionale Marktwerte zu verstehen und hocheffizient durch Angebote zu navigieren.

![Himmelblaues Icon](icons/icon.svg)

## 🚀 Kern-Features

- **📊 Interaktive Preis-Matrix (3x3):** Errechnet automatisch die Schwellenwerte für "Günstig", "Mittel" und "Teuer" auf Basis deiner gesamten lokalen Datenbank für die Top-Regionen (4-stellige PLZ).
- **🧠 Deep Knowledge:** Die Analyse basiert nicht nur auf der aktuellen Seite, sondern auf allen jemals gescannten Anzeigen (Historie).
- **🎮 WASD-Navigation:** Navigiere wie ein Profi:
  - `W` / `S`: Zwischen Anzeigen springen (mit automatischem Scrollen & Fokus-Rahmen).
  - `A` / `D`: Seite vor- oder zurückblättern.
- **🛡️ Robustes Heuristik-Parsing:** Findet m², Preise und PLZs anhand von Struktur-Mustern. Unempfindlich gegenüber Layout-Änderungen von Kleinanzeigen.
- **🧹 Daten-Reinigung:** Filtert automatisch Tauschangebote, Gesuche und Fake-Preise (VB, 1€) aus der Statistik.
- **📥 CSV-Export:** Lade deine gesamte gesammelte Wissensdatenbank mit einem Klick als Excel-kompatible Datei herunter.

## 🛠 Installation (Entwicklermodus)

Da dies eine spezialisierte Erweiterung ist, wird sie direkt über den Chrome-Entwicklermodus geladen:

1. **Repository herunterladen:** Klicke oben auf den grünen Button `<> Code` und wähle `Download ZIP` (oder nutze `git clone`).
2. **Entpacken:** Entpacke die ZIP-Datei in einen Ordner deiner Wahl.
3. **Chrome Erweiterungen öffnen:** Gib `chrome://extensions` in deine Adresszeile ein.
4. **Entwicklermodus aktivieren:** Schalte oben rechts den Schalter "Entwicklermodus" ein.
5. **Erweiterung laden:** Klicke auf "Entpackte Erweiterung laden" und wähle den Ordner aus, in dem sich die `manifest.json` befindet.
6. **Fertig!** Besuche [kleinanzeigen.de](https://www.kleinanzeigen.de/s-wohnung-mieten/c203) und starte deine Analyse.

## 📖 Bedienung

- **Farbliche Markierung:** Anzeigen werden automatisch markiert:
  - 🟢 **Grün:** Günstig (Q1-Perzentil oder niedriger)
  - 🟡 **Gelb:** Marktdurchschnitt (IQR)
  - 🔴 **Rot:** Teuer (Q3-Perzentil oder höher)
  - 🌫️ **Transparent:** Statistischer Ausreißer.
- **Dashboard:** Nutze die Buttons in der Matrix, um die Ergebnisliste sofort nach Region und Preisklasse zu filtern.
- **Datenbasis:** Die Anzeige `Basis: 10/100` zeigt dir, wie viele Anzeigen der aktuellen Seite (10) im Vergleich zu deinem gesamten Wissen (100) stehen.

## 📜 Lizenz

Dieses Projekt steht unter der **MIT-Lizenz**. Du kannst es frei verwenden, modifizieren und teilen. Siehe [LICENSE](LICENSE) für Details.

---
*Viel Erfolg bei der Wohnungssuche!*
