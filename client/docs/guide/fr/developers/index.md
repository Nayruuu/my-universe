---
title: Guide développeur
description: Installez Universe Map, comprenez la séparation Angular–Three.js, exécutez les tests, préparez les données et construisez la documentation.
---

# Guide développeur

Universe Map est une application statique Angular et Three.js. Le moteur de rendu reste indépendant
du framework ; Angular gère l’interface et communique par une façade typée et des événements moteur.

## Installer et lancer

Prérequis : Node.js 22 et npm.

```bash
git clone https://github.com/Nayruuu/my-universe.git
cd my-universe/client
npm ci
npm start
```

Le serveur Angular démarre par défaut sur `http://localhost:4200`.

## Architecture

```text
client/src/
├── app/       interface Angular, état, recherche, réglages et URL
├── engine/    scène Three.js, caméra, rendu, LOD, tuiles et simulation
└── data/      modèles stricts et validation à l’exécution

client/public/
├── data/      jeux astronomiques statiques versionnés
└── textures/  textures locales et attributions

docs/guide/    sources Markdown de ce guide public
```

`client/src/engine` ne doit pas importer Angular. Le code qui crée une ressource Three.js la détruit
également. Les calculs temporels restent séparés de la boucle de rendu.

## Commandes courantes

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

La couverture impose 100 % des instructions, branches, fonctions et lignes. `verify:ci` est la porte
rapide de déploiement ; `verify` ajoute tous les parcours Playwright desktop et mobile.

## Documentation et localisation

```bash
npm run docs:dev
npm run docs:build
npm run docs:preview
```

Le guide et l’application prennent en charge français, anglais, espagnol, allemand, italien, coréen,
japonais et chinois simplifié. L’application utilise `/fr/` à `/zh/`; le guide conserve l’anglais à
`/guide/` et place les traductions sous `/guide/fr/`, `/guide/it/`, etc. Le chinois utilise `zh-Hans`
dans les balises standards.

`I18nService` gère le texte, les formats numériques et les noms traduits sans coupler le moteur à
Angular. `SeoService` synchronise title, description, Open Graph, Twitter, canonical, `hreflang`,
manifestes et JSON-LD. Le build produit des pages HTML directement indexables.

## Pipeline de données et contributions

Les imports normalisent les catalogues hors navigateur, construisent des identifiants stables,
conservent unités et confiance, puis créent des binaires ou tuiles statiques. Aucune API métier ne
doit être ajoutée au runtime.

Avant une pull request, lisez le code et les tests concernés, respectez la séparation UI–moteur,
ajoutez une référence indépendante aux calculs scientifiques, préservez desktop et tactile, puis
terminez par `npm run verify` pour les changements visibles ou transverses.

La référence complète se trouve dans `docs/TECHNICAL_REFERENCE.md`.

Suite : [FAQ](/fr/faq/).
