# Repository instructions

This file is the shared source of truth for coding assistants working on Universe Map. Tool-specific
adapters must reference these instructions without duplicating them.

## Priorities

1. Follow the user request and deliver an executable slice.
2. Preserve the boundary between `client/src/engine` and Angular.
3. Prioritize fluidity, navigation, and scientific readability.
4. Explicitly identify calculated, extrapolated, simulated, procedural, or illustrative data.

## Product constraints

- fully static Angular and Three.js application;
- no backend, account, or application API;
- strict TypeScript with no unjustified `any`;
- local astronomical data validated at load time;
- no individual Three.js object for each entry in a large stellar catalogue;
- temporal calculations isolated from rendering;
- Three.js resources released by the unit that creates them;
- desktop and touch navigation preserved after every change.

## Sources of truth

- coding rules: `docs/CODING_RULES.md`;
- executable rules: `client/eslint.config.mjs`, `client/.prettierrc.json`,
  `client/.stylelintrc.json`, and `client/tsconfig*.json`;
- architecture and commands: `README.md`;
- reusable agent roles: `.agents/roles/`.

When documentation conflicts with executable configuration, fix the documentation and follow the
configuration.

## Working method

1. Read affected files and their tests before changing code.
2. Implement a complete functional slice without multiplying empty files.
3. For scientific calculations, cite the source in data or documentation and add a test based on an
   independent reference value.
4. Keep all four coverage metrics at 100% for the scientific modules listed in
   `client/tools/check-coverage.mjs`.
5. Format and run at least targeted tests, lint, type checks, and the build.
6. Run `npm run verify` for cross-cutting or user-visible changes.
7. Never edit generated directories under `client/`, including `dist/`, `coverage/`, `out-tsc/`,
   `playwright-report/`, or `test-results/`.

## Commands

```bash
cd client
npm start
npm run format
npm run lint
npm run typecheck
npm run test:unit
npm run build
npm run verify
```

## Review

A review must be factual and report issues with `file:line`, their impact, and a concrete fix.
Reviewer and auditor roles remain read-only unless the user explicitly requests corrections.
