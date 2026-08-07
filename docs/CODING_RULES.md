# Coding rules

These conventions adapt the Portfolio project's quality baseline to Universe Map. Executable
configuration remains the source of truth: `client/eslint.config.mjs`,
`client/.prettierrc.json`, `client/.stylelintrc.json`, and `client/tsconfig.json`.

## Angular

- standalone components with `ChangeDetectionStrategy.OnPush`;
- zoneless execution through `provideZonelessChangeDetection()`;
- dependency injection through `inject()`, not constructor parameters;
- templates and styles in separate files;
- signal APIs for state, inputs, outputs, and view queries;
- native template control flow with a `track` expression for every `@for`;
- project prefixes: `app-*` components and `app*` attribute directives.

## TypeScript

- strict mode and strict templates;
- no `any` without local justification;
- explicit `public`, `protected`, or `private` modifier on every class member;
- member order: public, protected, and private fields, constructor, then methods in the same
  accessibility order;
- braces on every control-flow block;
- a blank line after declarations and before a non-initial `return`;
- literal unions for finite domains instead of TypeScript `enum`;
- explicit names, with short names reserved for conventional mathematical notation;
- comments limited to non-obvious rationale, scientific constraints, and maintenance traps.

Public primitive fields in Angular code must be signals. The local `prefer-signal-primitives` rule
enforces this convention in `client/src/app`, excluding tests.

## Architecture

- `client/src/engine` remains independent from Angular;
- components are thin interface adapters; calculations, temporal rules, and navigation rules remain
  in the engine or services;
- each class or file owns one coherent responsibility;
- a function longer than approximately 50 lines must be reviewed for extraction;
- the unit that creates a Three.js resource must also release it.

## Scientific data

- every new datum declares its source, unit, and confidence level;
- keep scientific coordinates separate from visual exaggeration;
- never validate a position by eye alone: add a test based on an independent astronomical reference;
- document the epoch, reference frame, and validity domain of each model;
- keep calculations in `client/src/engine/simulation`, without Angular dependencies or network
  calls;
- maintain 100% global statements, branches, functions, and lines coverage; scientific modules
  listed in `client/tools/check-coverage.mjs` also retain individual gates;
- treat coverage as a regression barrier, not proof of correctness: test relevant reference values,
  invariants, boundaries, and degenerate cases.

## Agents

- `AGENTS.md` contains shared repository instructions;
- `.agents/roles/` contains generic, model-independent, tool-independent roles;
- adapters such as `.claude/agents/` remain concise and do not duplicate conventions;
- no role may require a specific model without a measured, documented reason.

## Formatting and styles

Prettier is the only formatter:

- 100-character line width;
- two spaces for TypeScript and HTML;
- tabs for SCSS;
- single quotes, semicolons, and trailing commas.

Stylelint enforces standard SCSS, modern color and media-query syntax, and blank lines between
blocks. Class patterns, custom properties, and keyframe names remain unrestricted to preserve the
application's visual vocabulary.

## Verification

```bash
cd client
npm run format
npm run format:check
npm run lint
npm run lint:fix
npm run verify:ci
npm run verify
```

`npm run verify` is the complete quality gate: TypeScript, formatting, ESLint, Stylelint, coverage,
production build, and browser tests. `npm run verify:ci` omits only the GPU-heavy Playwright suite and
is the required deployment gate; browser journeys run independently every night and on demand.
