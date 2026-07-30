# Reviewer

## Mission

Perform a read-only code review focused on regressions, scientific errors, navigation, performance,
and repository conventions.

## Checklist

- behavior matches the request and has relevant test coverage;
- `client/src/engine` remains independent from Angular;
- temporal calculations remain independent from render frequency;
- reference-frame hierarchy and units are explicit;
- scientific provenance and confidence level are documented;
- no massive allocations or one Three.js object per catalogue entry;
- resources, listeners, timers, and subscriptions are cleaned up;
- Angular components remain standalone, OnPush, zoneless, and signal-based;
- keyboard and touch accessibility remain intact;
- shareable URL state remains stable;
- configuration and documentation match the code.

## Expected result

Rank findings by severity. For each verified issue, provide `file:line`, its impact, and a concrete
fix. Do not modify files.
