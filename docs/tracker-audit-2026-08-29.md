# Fremd-Ressourcen-Audit kleinanzeigen.de (Startseite)

Gemessen am 29.08.2026 via `performance.getEntriesByType('resource')` auf
`https://www.kleinanzeigen.de/` (eingeloggter Zustand kann abweichen).

**Ergebnis: 250 Requests an 81 verschiedene Fremd-Domains** bei einem einzigen
Seitenaufruf.

## Bot-Erkennung (nicht blockierbar, nicht relevant fuer Performance)

Kleinanzeigen setzt **Akamai Bot Manager** ein, bestaetigt ueber die Cookies
`bm_sz` und `_abck`. Nicht DataDome, nicht PerimeterX, nicht Cloudflare. Das
zufaellig benannte Skript (z.B. `R2EmAB`), das in der Konsole
`[Violation] Permissions policy violation: accelerometer` meldet, gehoert zu
diesem System -- es versucht auf Bewegungssensoren zuzugreifen, um Mensch vs.
Bot zu unterscheiden, wird von Chromes Permissions-Policy blockiert (harmlos,
nur eine Konsolen-Warnung).

**Wichtig fuer alle Extension-Features, die klicken/interagieren:**
schnelles, mechanisches Klicken im Sekundentakt ist genau das Muster, das
Bot-Erkennung typischerweise flaggt und zu haengenden/"gebrickten" Ladezustaenden
fuehren kann (siehe `AutoShowMore`-Fix vom 29.08.2026 -- deutlich laengere,
randomisierte Pausen zwischen automatisierten Klicks).

## In rules.json blockiert (Stand 29.08.2026, 39 Regeln)

### Bereits vorher vorhanden (21 Regeln, IDs 1-21)
criteo.net, theadex.com, clarity.ms, teads.tv, taboola.com, bing.com,
facebook.net, creativecdn.com, doubleclick.net, google.com/adsense,
amazon-adsystem.com, fastclick.net, id5-sync.com, advertisingWebRenderer,
prebid.js, liberty.min.js, GATrackingDispatcher, GoogleAnalyticsTags,
gtag/js, gtm.js, privacymanager.io

### Neu hinzugefuegt (18 Regeln, IDs 22-39) -- reines Ad-Tech/Header-Bidding
| Domain | Anbieter |
|---|---|
| adsrvr.org | The Trade Desk |
| adnxs.com | Xandr / AppNexus |
| rubiconproject.com | Magnite |
| pubmatic.com | PubMatic |
| casalemedia.com | Index Exchange |
| 3lift.com | TripleLift |
| connectad.io | ConnectAd |
| yieldlab.net | Yieldlab |
| outbrain.com | Outbrain |
| brandmetrics.com | Brandmetrics |
| bmtrcs.com | Brandmetrics (Tracking-Domain) |
| confiant-integrations.net | Confiant (Ad-Quality-Scanner) |
| adtrafficquality.google | Google Ad Traffic Quality |
| googlesyndication.com | Google Ad SafeFrame |
| xplosion.de | Tracking/Profiling |
| criteo.com | Criteo (zusaetzlich zu criteo.net) |
| facebook.com | Facebook Pixel (zusaetzlich zu facebook.net) |
| orbidder.otto.de | Otto Group Header-Bidding |

Begruendung: alles reine Real-Time-Bidding-/Ad-Exchange-Infrastruktur. Blockieren
hat keinen Einfluss auf Kernfunktionen (Anzeigen durchsuchen, inserieren,
kontaktieren) -- im schlimmsten Fall werden weniger/keine Display-Ads geladen,
was ausdruecklich gewuenscht war.

## Bewusst NICHT blockiert -- Risiko, die Seite zu brechen

| Domain | Grund |
|---|---|
| gateway.kleinanzeigen.de | Kleinanzeigens eigene Cookie-Consent-API. Blockieren kann dazu fuehren, dass die Consent-Verhandlung nie abschliesst und Inhalte gar nicht erst laden. |
| www.google.com / www.google.de | Remarketing-Pixel gemischt mit potenziell legitimen Google-Diensten (z.B. reCAPTCHA bei Login/Formularen). Zu riskant als ganze Domain zu blockieren. |
| server.sgtm-legacy.kleinanzeigen.de | Kleinanzeigens eigener Server-Side-GTM-Proxy (laeuft ueber die eigene Domain). Koennte an Feature-Flags/A-B-Tests haengen, nicht risikofrei genug fuer automatisches Blockieren. |
| static.kleinanzeigen.de, img.kleinanzeigen.de, www.kleinanzeigen.de | First-Party, offensichtlich nicht blockieren. |
| privacymanager.io | War schon vorher blockiert (Consent-Management-Plattform selbst). Nicht neu hinzugefuegt, aber als Risiko notiert: falls die Seite je auf eine Antwort von hier wartet, bevor sie Inhalte zeigt, koennte das genau dieser Grund fuer haengende Ladezustaende sein. Nicht angetastet, da bereits laenger produktiv im Einsatz. |

## Unklar / nicht automatisch geblockt

Anbieter konnte nicht sicher identifiziert werden, deshalb bewusst NICHT
blockiert, um nichts Falsches zu treffen:

- `api.assertcom.de` -- unbekannter Dienst, sendet `pageview`-Beacons
- `mpc-prod-25-s6uit34pua-wl.a.run.app` -- generische Google-Cloud-Run-URL, Anbieter unklar
- `pe5gcbmdizh9q7xnj.ay.delivery` -- randomisierter Hostname, vermutlich ein Ad-Tech-Anbieter mit Evasion-Technik, aber nicht sicher zuordenbar

Falls gewuenscht, koennen diese bei Bedarf spaeter genauer untersucht (z.B.
Response-Header/Payload pruefen) und dann gezielt geblockt werden.

## Bekannte Luecke in den bestehenden (alten) Regeln

Einige der 21 urspruenglichen Regeln blocken nur `resourceTypes: ["script"]`,
obwohl der jeweilige Anbieter auch per `image` (Tracking-Pixel) oder `ping`
(sendBeacon) nachladet -- z.B. `bing.com` (Regel 6) blockt nur Skripte, aber
`bat.bing.com` feuert in der Praxis auch als Bild/Beacon. Die neuen 18 Regeln
blocken bewusst breiter (`script, xmlhttprequest, sub_frame, image, ping`).
Die alten 21 Regeln wurden nicht angefasst, um nichts Funktionierendes zu
riskieren -- koennte man bei Bedarf spaeter nachziehen.
