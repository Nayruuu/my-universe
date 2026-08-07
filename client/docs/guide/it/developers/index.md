---
title: Guida per sviluppatori
description: Installa Universe Map, comprendi il confine Angular–Three.js, esegui i test, prepara i dati e genera la documentazione pubblica.
---

# Guida per sviluppatori

Universe Map è un’applicazione statica Angular e Three.js. Il motore di rendering è indipendente dal
framework; Angular gestisce l’interfaccia e comunica tramite una facade tipizzata ed eventi del motore.

## Installazione e avvio

Requisiti: Node.js 22 e npm.

```bash
git clone https://github.com/Nayruuu/my-universe.git
cd my-universe/client
npm ci
npm start
```

Il server di sviluppo Angular parte su `http://localhost:4200` per impostazione predefinita.

## Architettura

```text
client/src/
├── app/       interfaccia Angular, stato, ricerca, impostazioni e URL
├── engine/    scena Three.js, camera, rendering, LOD, tessere e simulazione
└── data/      modelli rigorosi e validazione a runtime

client/public/
├── data/      dataset astronomici statici versionati
└── textures/  texture locali e attribuzioni

docs/guide/    sorgenti Markdown di questa guida pubblica
```

`client/src/engine` non deve importare Angular. Chi crea una risorsa Three.js deve anche smaltirla. I
calcoli temporali restano separati dal ciclo di rendering.

## Comandi comuni

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

La soglia di copertura richiede il 100% di istruzioni, rami, funzioni e righe. `verify:ci` è il gate
rapido di distribuzione; `verify` aggiunge tutti i percorsi Playwright desktop e mobile.

## Documentazione e localizzazione

```bash
npm run docs:dev
npm run docs:build
npm run docs:preview
```

Applicazione e guida supportano francese, inglese, spagnolo, tedesco, italiano, coreano, giapponese e
cinese semplificato. L’app usa `/fr/` fino a `/zh/`; la guida mantiene l’inglese in `/guide/` e mette
le traduzioni sotto `/guide/it/`, `/guide/fr/` e così via. Il cinese usa `zh-Hans` nei tag standard.

`I18nService` gestisce testo, numeri e nomi tradotti senza accoppiare il motore ad Angular.
`SeoService` sincronizza title, description, Open Graph, Twitter, canonical, `hreflang`, manifesti e
JSON-LD. Il build produce pagine HTML direttamente indicizzabili.

I processi dati normalizzano i cataloghi fuori dal browser, preservano unità e affidabilità e creano
binari o tessere statiche. Non aggiungere un’API applicativa al runtime. Prima di una pull request,
rispetta il confine UI–motore, aggiungi riferimenti indipendenti ai calcoli scientifici e termina con
`npm run verify` per modifiche visibili o trasversali.

Il riferimento completo è in `docs/TECHNICAL_REFERENCE.md`.

Continua con [Domande frequenti](/it/faq/).
