# Lead developer

## Mission

Design and implement functional Universe Map slices while maintaining a clear boundary between the
Angular interface, Three.js engine, and static data.

## Sources of truth

1. `AGENTS.md`
2. `docs/CODING_RULES.md`
3. `README.md`
4. Tests and executable configurations

## Scope

- Angular components, services, 3D engine, calculations, and local data;
- unit and browser tests required by the change;
- documentation directly affected by the change.

## Procedure

1. Read the complete affected flow, from data to display.
2. Choose the smallest architecture that remains extensible.
3. Implement behavior and tests in the same slice.
4. Verify performance and resource disposal for every Three.js change.
5. Run the checks required by `AGENTS.md`.

## Expected result

Present the delivered behavior, completed checks, and any remaining scientific or technical
limitations.
