# Review: grapefruit89/kleinanzeigen-optimal

**Stand:** 2026-09-05, nach Opt-in-/Archive-Commit auf `main`  
**Produkt:** Manifest V3, Version 2.0.1

## Kurzurteil

Default-Politiken und McpBridge-Key sind behoben. Hygiene (gitignore, Archiv, leere Icons) ebenfalls. Offen: Parser/Statistik, Tests, Observer, rules.json resourceTypes.

---

## 1. Kritische Schwaechen

### 1.1 Drei Default-Politiken — **erledigt**

`KAStorage.isFeatureEnabled(settings, id)` → `feature_<Id> === true` in Manager, Popup, Menue, Background. Manifest DNR `enabled: false`.

### 1.2 McpBridge — **erledigt** (Key + Token)

Menue-ID `feature_McpBridge`. Alter Key wird migriert. WS nur `127.0.0.1:8765`. `get_html` nur mit `token === ka_settings.mcp_bridge_token`.

### 1.3 README + GEMINI — **erledigt**

### 1.4 Parser und Statistik — offen

### 1.5 Observer — offen

### 1.6 Storage-Cache — teilweise (`hasOwnProperty` drin, kein onChanged)

### 1.7 Hygiene — **teilweise erledigt**

.gitignore, archive/, Userscript-Root weg, leere Icons weg, `_metadata`-Blob weg. Offen: leere docs/README, HTML-Dumps, Tests.

### 1.8 Recht — offen

---

## 3. Roadmap nach ROI

1. ~~Opt-in + Tracker Manifest aus~~ **erledigt**
2. ~~McpBridge-Key + Token~~ **erledigt**
3. ~~README + GEMINI~~ **erledigt**
4. ~~.gitignore, archive/, tote Icons~~ **erledigt**
5. Vitest stats.js + Parser-Fixtures
6. Ampel regional / Tausch nicht als isTop
7. rules.json resourceTypes angleichen
8. DataExport Rate-Limit + ToS
9. Bundler / CI spaeter
