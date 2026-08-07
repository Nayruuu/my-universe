---
title: Developer guide
description: Install Universe Map, understand the Angular and Three.js boundary, run tests, prepare datasets, and build the public documentation.
---

# Developer guide

Universe Map is a static Angular and Three.js application. The rendering engine is framework
independent; Angular owns the interface and communicates through a typed facade and engine events.

## Install and run

Requirements: Node.js 22 and npm.

```bash
git clone https://github.com/Nayruuu/my-universe.git
cd my-universe/client
npm ci
npm start
```

The Angular development server starts on `http://localhost:4200` by default.

## Architecture

```text
client/src/
├── app/       Angular UI, state, search, settings, and URL synchronisation
├── engine/    Three.js scene, camera, rendering, LOD, tiles, and simulation
└── data/      Strict models and runtime validation

client/public/
├── data/      Versioned static astronomical datasets
└── textures/  Local runtime textures and attribution

docs/guide/    Markdown source for this generated public guide
```

`client/src/engine` must not import Angular. The unit that creates a Three.js resource also disposes
it. Temporal calculations remain separate from the render loop.

## Common commands

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

The coverage gate requires 100% statements, branches, functions, and lines across production code,
with additional individual gates for scientific modules. `verify:ci` is the fast deployment gate;
`verify` additionally runs all desktop and mobile Playwright journeys. GitHub runs those browser
journeys nightly and on demand rather than delaying every production deployment.

## Documentation commands

```bash
# Live documentation server on http://localhost:4204/guide/
npm run docs:dev

# Generate static documentation inside the Angular production output
npm run docs:build

# Preview the generated documentation
npm run docs:preview
```

`npm run build` builds Angular, generates one crawlable application entry point per supported locale,
then builds VitePress and verifies the generated documentation pages, canonical URLs, sitemap, and
assets. The production artefact remains
`client/dist/universe-map/browser/`.

## Localization and application SEO

The application and this guide support French, English, Spanish, German, Italian, Korean, Japanese,
and Simplified Chinese. Application copy lives in typed locale catalogues under
`src/app/core/i18n/locales/`. Every catalogue must retain the same key structure; the data tests reject
missing or extra translations. Application prefixes (`/fr/`, `/en/`, `/es/`, `/de/`, `/it/`, `/ko/`,
`/ja/`, and `/zh/`) preserve the shared navigation query string when the language changes.

The existing English documentation remains at `/guide/`. Equivalent translated page trees live at
`/guide/fr/`, `/guide/es/`, `/guide/de/`, `/guide/it/`, `/guide/ko/`, `/guide/ja/`, and `/guide/zh/`.
The VitePress language menu keeps the current page when switching locale. Each generated page has its
own canonical URL and the complete alternate-language set. Chinese uses the compact `/zh/` route and
the standards-compliant `zh-Hans` document and `hreflang` tag.

`I18nService` owns runtime copy, locale-aware number formatting, and translated names for the main
astronomical reference objects. The Three.js engine remains framework-independent: Angular supplies a
generic label-name resolver instead of importing translation code into the engine.

`SeoService` synchronizes the title, description, Open Graph, Twitter, canonical, `hreflang`, localized
manifest, and JSON-LD data. After the Angular build, `tools/generate-localized-seo.mjs` creates a static
HTML entry point for every language so crawlers and link-preview clients do not need to execute the
application before reading localized metadata. Keep `public/sitemap.xml`, the locale manifests, and
these generated-entry tests aligned whenever a language is added.

## Data pipeline

Large catalogues are prepared outside the browser. Import scripts normalise source rows, construct
stable identifiers, preserve source units and confidence, generate compact binary records or static
spatial tiles, and validate cross-references.

Do not fetch an application API at runtime. New browser data belongs in the versioned static manifest
and must fail with an explicit development error if malformed.

## Pull-request expectations

1. read the affected implementation and tests;
2. keep the Angular–engine boundary intact;
3. add an independent reference test for scientific calculations;
4. preserve desktop and touch navigation;
5. run targeted checks while developing;
6. finish with `npm run verify` for user-visible or cross-cutting changes.

The complete implementation reference remains in the repository at `docs/TECHNICAL_REFERENCE.md`.

Next: [FAQ](/faq/).
