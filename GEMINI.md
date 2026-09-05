# Kleinanzeigen Optimal — Projekt-Mandate

SSOT fuer `features/`, `core/`, `popup/`. Pfade `lib/` und `content/` gibt es nicht mehr.

## Philosophie

Opt-in. Kein Feature ohne `ka_settings.feature_<Id> === true`. Tracker-Ruleset im Manifest default aus.

Pruefung: `KAStorage.isFeatureEnabled(settings, id)` in FeatureManager, Popup, InPageMenu, Background.

## Architektur

| Pfad | Aufgabe |
| :--- | :--- |
| `core/Storage.js` | storage plus `featureKey` / `isFeatureEnabled` |
| `core/FeatureManager.js` | Register + Opt-in-Start |
| `core/background.js` | Service Worker, Tracker-Ruleset |
| `features/<Name>/index.js` | Ein Feature |
| `features/RentalAnalyzer/parser.js` | Preis / m2 / PLZ |
| `features/RentalAnalyzer/stats.js` | Q1 / Median / Q3 / IQR |
| `popup/` | dieselben `feature_*`-Keys |
| `rules.json` | DNR `ruleset_1` |

McpBridge: Key `feature_McpBridge`, WS `127.0.0.1:8765`, Token `ka_settings.mcp_bridge_token`.

Ampel noch global, Matrix regional — nicht still vermischen.
