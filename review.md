# Review: grapefruit89/kleinanzeigen-optimal

**Stand:** 2026-09-05, Commit `5026d39` auf `main` (vor diesem Docs-Commit)  
**Produkt:** Chrome-Erweiterung Manifest V3, Version 2.0.0

## Kurzurteil

Feature-Zerlegung und Opt-in im FeatureManager sind richtig. Drei Ebenen steuern dieselben Schalter und widersprechen sich. Dazu eine Dev-Bridge, die das komplette Seiten-HTML an localhost schicken kann — mit falschem Storage-Key.

Deepseek hat Root-Muell, leere Docs, fehlende Tests und fehlendes `.gitignore` richtig benannt. Das sind Hygiene-Themen. Sie stehen hinter den Logik-Bugs.

---

## 1. Kritische Schwaechen

### 1.1 Drei Default-Politiken — Severity: high

| Stelle | Regel | Leeres `ka_settings` |
| :--- | :--- | :--- |
| `core/FeatureManager.js` | `settings['feature_' + id] === true` | Feature aus |
| `features/InPageMenu/index.js` | `settings[mod.id] === true` | Checkbox aus |
| `popup/popup.js` | `settings[key] !== false` | Checkbox an |
| `core/background.js` Tracker | `!== false` | Ruleset an |
| `manifest.json` DNR | `enabled: true` | Ruleset an vor Storage |

Das Popup zeigt elf Haekchen. Content-Scripts bleiben tot, bis jemand eine Box umlegt und `true` speichert. Tracker laufen trotzdem.

### 1.2 McpBridge: falscher Key, kein Auth — Severity: high

FeatureManager liest `feature_McpBridge`. InPageMenu speichert `McpBridge`. Der Schalter trifft nie.

Wenn der Key irgendwann stimmt: `ws://localhost:8765`, auf `get_html` geht `document.documentElement.outerHTML` raus, kein Token. `.mcp.json` ist Playwright, nicht diese Bridge.

### 1.3 README beschrieb ein anderes Produkt — Severity: medium-high

Nur Rental Analyzer. Kein Opt-in, kein Tracker-Default, kein Context-Reload, kein Matrix-vs-Ampel. `GEMINI.md` beschreibt `lib/`, Code liegt in `features/`.

### 1.4 Parser und Statistik — Severity: medium

Erster kurzer EUR- bzw. m2-Treffer in `p, span, div, a, li`. Tausch wird als `isTop` versteckt. Ampel = globale Historie, Matrix = 4-stellige PLZ. GEMINI-Fallback auf 3-steller fehlt. `ensureFilters()` macht `location.replace`.

### 1.5 Observer — Severity: medium

InPageMenu beobachtet `document.documentElement` auf jeder KA-Seite dauerhaft. AutoShowMore plus Akamai: steht im Tracker-Audit, nicht in der alten README.

### 1.6 Storage-Cache — Severity: low-medium

`if (this._cache[key])` ueberspringt falsy. Kein `storage.onChanged`.

### 1.7 Hygiene (Deepseek, bestaetigt)

`altes userscript.js`, `_metadata/`, leere icon16/48, leere `docs/README.md`, ~500 kB HTML-Dumps, kein `.gitignore`, keine Tests. `activeTab` und `declarativeNetRequestFeedback` wirken ungenutzt. Host-Permission bleibt korrekt eng.

### 1.8 Recht

DataExport heisst im Popup TO LLM. Keine Privacy-Policy. Sideload ok, Store nicht.

---

## 2. Was bleibt stehen

Feature-Ordner, Context-invalidated-Hinweis im InPageMenu, Tracker-Audit vom 29.08.2026, kleine `stats.js`, keine `<all_urls>`-Permission.

Deepseek-Schluss "groesste Schwaeche = Root" wird nicht uebernommen.

---

## 3. Roadmap nach ROI

1. **Sehr hoch / wenig Aufwand** — `isFeatureEnabled(settings, id)` in Manager, Popup, Menue, Background. Tracker bewusst Opt-in (Manifest `enabled: false`) oder dokumentiertes Opt-out.
2. **Sehr hoch / wenig Aufwand** — McpBridge-Key `feature_McpBridge`, Token oder Feature loeschen.
3. **Hoch / wenig Aufwand** — README + GEMINI an den Code (dieser Commit).
4. **Hoch / wenig Aufwand** — `.gitignore`, `archive/` fuer Userscript und old_versions, tote Icons. **Kein** `src/`-Schnitt ohne Bundler: Sideload braucht `manifest.json` am Ladeort.
5. **Hoch / mittel** — Vitest fuer `stats.js` und Parser-Fixtures aus bereinigten HTML-Samples.
6. **Mittel-hoch / mittel** — Ampel regional oder Dashboard sagt "Vergleich: gesamte Historie". Tausch nicht als `isTop`.
7. **Mittel** — `rules.json` IDs 1-21 auf dieselben `resourceTypes` wie 22-39, dann Login/Chat manuell pruefen.
8. **Mittel** — DataExport: sichtbares Rate-Limit, Stop, ToS-Hinweis.
9. **Spaeter** — Bundler, ESLint-Action, Docs-Architekturseite.

```text
Tag 1   [1] Defaults  [2] Bridge  [3] Docs
Tag 2   [4] gitignore/archive  [5] Tests stats+parser
Spaeter [6] regionale Ampel  [7] rules  [8] Export-Bremse  [9] Bundler
```

---

## Deepseek

Uebernommen: Root, Docs, Tests, gitignore, CI als spaete Stufe, Lob fuer Modularitaet.

Nicht uebernommen: Root als Hauptproblem, Vite vor den Default-Bugs, `src/` ohne Build, rules.json splitten vor resourceType-Fix.
