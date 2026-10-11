.PHONY: help build up down logs test lint seed inject deploy rollback experiment loadtest drift certs clean

SHELL := /bin/bash
COMPOSE := docker compose
PYTHON := python

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

# === Build & Run ===
certs: ## Generate self-signed TLS certificates
	bash scripts/gen_certs.sh

build: ## Build Docker images
	$(COMPOSE) build

up: ## Start all services
	$(COMPOSE) up -d --build

down: ## Stop all services
	$(COMPOSE) down

logs: ## Tail logs for api and worker
	$(COMPOSE) logs -f api-blue worker

restart: ## Restart API and worker
	$(COMPOSE) restart api-blue worker

ps: ## Show running containers
	$(COMPOSE) ps

# === Testing ===
test: ## Run unit tests
	$(PYTHON) -m pytest tests/ -v --tb=short

test-cov: ## Run tests with coverage
	$(PYTHON) -m pytest tests/ -v --cov=app --cov-report=term-missing

lint: ## Run linting
	$(PYTHON) -m flake8 app/ tests/ --max-line-length=120 --ignore=E501,W503

# === Data ===
seed: ## Seed 14 days of history
	$(PYTHON) scripts/simulate.py seed --days 14

seed-7: ## Seed 7 days of history (faster)
	$(PYTHON) scripts/simulate.py seed --days 7

inject: ## Inject a spike anomaly (use KIND=spike|drift|new_resource RESOURCE=ec2-ml-gpu-01 MULT=12)
	$(PYTHON) scripts/simulate.py inject --kind $(or $(KIND),spike) --resource $(or $(RESOURCE),ec2-ml-gpu-01) --multiplier $(or $(MULT),12)

# === Deployment ===
deploy: ## Deploy new version (use VERSION=x.y.z)
	bash scripts/deploy.sh $(or $(VERSION),1.1.0)

deploy-faulty: ## Deploy a faulty release to test rollback
	bash scripts/deploy.sh $(or $(VERSION),1.2.0-bad) --faulty

rollback: ## Instant rollback to previous color
	bash scripts/rollback.sh

# === Experiments ===
experiment-worker: ## Failure experiment: kill worker
	bash scripts/failure_experiment.sh worker 45

experiment-redis: ## Failure experiment: kill redis
	bash scripts/failure_experiment.sh redis 45

evaluate: ## Evaluate detection quality (precision/recall)
	$(PYTHON) scripts/evaluate_detection.py

loadtest: ## Run Locust load tests (low/medium/high)
	bash scripts/run_loadtests.sh

drift: ## Run config drift check
	$(PYTHON) scripts/drift_check.py

# === Utilities ===
openapi: ## Export OpenAPI spec to docs/openapi.json
	$(PYTHON) scripts/export_openapi.py

db-shell: ## Open psql shell
	$(COMPOSE) exec postgres psql -U ccad ccad

redis-cli: ## Open Redis CLI
	$(COMPOSE) exec redis redis-cli

clean: ## Remove results and cached files
	rm -rf results/*.csv results/*.md results/*.json results/*.log results/*.txt
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true

# === Frontend (CostGuard Console) ===
fe-install: ## Install frontend dependencies
	cd frontend && npm ci

fe-dev: ## Run Vite development server
	cd frontend && npm run dev

fe-build: ## Build production frontend bundle
	cd frontend && npm run build

fe-test: ## Run frontend unit and component tests
	cd frontend && npm test

fe-lint: ## Run frontend TypeScript check and linter
	cd frontend && npm run lint

fe-e2e: ## Run Playwright end-to-end tests
	cd frontend && npx playwright test

fe-screenshots: ## Capture automated dark and light mode screenshots for docs
	cd frontend && npm run screenshots

