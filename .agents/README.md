# Agent roles

This directory contains generic Universe Map roles. They do not depend on a model provider or the
syntax of a particular tool.

- `roles/developer.md`: implementation and architecture;
- `roles/reviewer.md`: read-only code review;
- `roles/auditor.md`: consistency across code, data, documentation, and tooling.

`AGENTS.md` contains the shared repository rules. `.claude/agents/` contains only small Claude Code
adapters for these roles. Other tools can reuse the role files directly without duplicating
conventions.
