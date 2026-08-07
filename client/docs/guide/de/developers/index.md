---
title: Entwicklerleitfaden
description: Installieren Sie Universe Map, verstehen Sie die Angular–Three.js-Grenze, führen Sie Tests aus und bauen Sie Daten und Dokumentation.
---

# Entwicklerleitfaden

Universe Map ist eine statische Angular- und Three.js-Anwendung. Die Rendering-Engine bleibt
frameworkunabhängig; Angular besitzt die Oberfläche und kommuniziert über eine typisierte Fassade und
Engine-Ereignisse.

## Installation und Start

Voraussetzungen: Node.js 22 und npm.

```bash
git clone https://github.com/Nayruuu/my-universe.git
cd my-universe/client
npm ci
npm start
```

Der Angular-Entwicklungsserver startet standardmäßig auf `http://localhost:4200`.

## Architektur

```text
client/src/
├── app/       Angular-UI, Zustand, Suche, Einstellungen und URL
├── engine/    Three.js-Szene, Kamera, Rendering, LOD, Kacheln und Simulation
└── data/      strikte Modelle und Laufzeitvalidierung

client/public/
├── data/      versionierte statische Astronomiedaten
└── textures/  lokale Texturen und Quellenangaben

docs/guide/    Markdown-Quellen dieses öffentlichen Leitfadens
```

`client/src/engine` darf Angular nicht importieren. Wer eine Three.js-Ressource erzeugt, entsorgt sie
auch. Zeitberechnungen bleiben von der Render-Schleife getrennt.

## Häufige Befehle

```bash
cd client
npm run typecheck
npm run lint
npm run test:data
npm run test:coverage
npm run build
npm run test:e2e
npm run verify:ci
npm run verify
```

Die Abdeckung verlangt 100% für Anweisungen, Verzweigungen, Funktionen und Zeilen. `verify:ci` ist das
schnelle Deployment-Gate; `verify` ergänzt sämtliche Playwright-Abläufe.

Anwendung und Leitfaden unterstützen Französisch, Englisch, Spanisch, Deutsch, Italienisch,
Koreanisch, Japanisch und vereinfachtes Chinesisch. Die App nutzt `/fr/` bis `/zh/`; der Leitfaden
behält Englisch unter `/guide/` und Übersetzungen unter `/guide/de/`, `/guide/fr/` usw. Chinesisch
verwendet `zh-Hans` in Standard-Tags.

`I18nService` verwaltet Texte, Zahlen und übersetzte Namen, ohne die Engine an Angular zu koppeln.
`SeoService` synchronisiert Metadaten, Canonical, `hreflang`, Manifeste und JSON-LD. Der Build erzeugt
direkt indexierbares HTML. Datenimporte normalisieren Kataloge außerhalb des Browsers und erzeugen
statische Binärdateien oder Kacheln; fügen Sie keine Anwendungs-API zur Laufzeit hinzu.

Beachten Sie vor Pull Requests die UI-Engine-Grenze, ergänzen Sie unabhängige Referenztests für
wissenschaftliche Berechnungen und schließen Sie sichtbare oder übergreifende Änderungen mit
`npm run verify` ab. Die vollständige Referenz steht in `docs/TECHNICAL_REFERENCE.md`.

Weiter: [Häufige Fragen](/de/faq/).
