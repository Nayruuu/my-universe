# Universe Map repository commands.
# The Angular application lives in client/; project documentation and governance stay at the root.

SHELL := /bin/bash
APP := client

.PHONY: help install dev build docs docs-preview typecheck test test-coverage e2e lint lint-fix format format-check verify

help: ## List the available commands
	@grep -E '^[a-zA-Z0-9_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'

install: ## Install deterministic client dependencies
	cd $(APP) && npm ci

dev: ## Start the Angular development server
	cd $(APP) && npm start

build: ## Build the production application
	cd $(APP) && npm run build

docs: ## Start the public documentation on http://localhost:4204/guide/
	cd $(APP) && npm run docs:dev

docs-preview: ## Preview the generated public documentation
	cd $(APP) && npm run docs:preview

typecheck: ## Run strict application and end-to-end type checks
	cd $(APP) && npm run typecheck

test: ## Run unit and integration tests
	cd $(APP) && npm run test:unit

test-coverage: ## Run tests with the global and scientific coverage gates
	cd $(APP) && npm run test:coverage

e2e: ## Run Playwright browser journeys
	cd $(APP) && npm run test:e2e

lint: ## Run ESLint and Stylelint
	cd $(APP) && npm run lint

lint-fix: ## Apply safe ESLint and Stylelint fixes
	cd $(APP) && npm run lint:fix

format: ## Format source code and repository documentation
	cd $(APP) && npm run format

format-check: ## Check formatting without changing files
	cd $(APP) && npm run format:check

verify: ## Run the complete local and browser quality gate
	cd $(APP) && npm run verify
