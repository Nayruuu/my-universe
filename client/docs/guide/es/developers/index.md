---
title: Guía de desarrollo
description: Instala Universe Map, comprende la frontera Angular–Three.js, ejecuta pruebas, prepara datos y genera la documentación pública.
---

# Guía de desarrollo

Universe Map es una aplicación estática Angular y Three.js. El motor de renderizado es independiente
del framework; Angular controla la interfaz mediante una fachada tipada y eventos del motor.

## Instalación y ejecución

Requisitos: Node.js 22 y npm.

```bash
git clone https://github.com/Nayruuu/my-universe.git
cd my-universe/client
npm ci
npm start
```

El servidor Angular se inicia en `http://localhost:4200` de forma predeterminada.

## Arquitectura

```text
client/src/
├── app/       interfaz Angular, estado, búsqueda, ajustes y URL
├── engine/    escena Three.js, cámara, renderizado, LOD, teselas y simulación
└── data/      modelos estrictos y validación en ejecución

client/public/
├── data/      conjuntos astronómicos estáticos versionados
└── textures/  texturas locales y atribuciones

docs/guide/    fuentes Markdown de esta guía pública
```

`client/src/engine` no debe importar Angular. Quien crea un recurso Three.js también lo libera. Los
cálculos temporales permanecen separados del bucle de renderizado.

## Comandos habituales

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

La cobertura exige 100% de instrucciones, ramas, funciones y líneas. `verify:ci` es la puerta rápida
de despliegue y `verify` añade todos los recorridos Playwright.

Aplicación y guía admiten francés, inglés, español, alemán, italiano, coreano, japonés y chino
simplificado. La aplicación usa `/fr/` a `/zh/`; la guía conserva el inglés en `/guide/` y sitúa las
traducciones bajo `/guide/es/`, `/guide/fr/`, etc. El chino emplea `zh-Hans` en etiquetas estándar.

`I18nService` gestiona textos, números y nombres traducidos sin acoplar el motor a Angular.
`SeoService` sincroniza metadatos, canonical, `hreflang`, manifiestos y JSON-LD. El build genera HTML
indexable. Los importadores normalizan catálogos fuera del navegador y producen archivos estáticos;
no añadas una API de aplicación al runtime.

Antes de una pull request, respeta la frontera UI–motor, añade referencias independientes para
cálculos científicos y termina con `npm run verify` en cambios visibles o transversales. La referencia
completa está en `docs/TECHNICAL_REFERENCE.md`.

Continúa con [Preguntas frecuentes](/es/faq/).
