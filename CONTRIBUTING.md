# Contributing to DocIntel AI

Thank you for your interest in contributing to DocIntel AI. This guide covers everything you need to get started.

## Prerequisites

| Tool       | Version |
| ---------- | ------- |
| Python     | 3.11+   |
| Node.js    | 20+     |
| Docker     | Latest  |
| Git        | Latest  |

## Development Setup

```bash
# Clone the repository
git clone https://github.com/AadityaUniyal/Googi.git
cd Googi

# Backend
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Frontend
cd ../frontend
npm install

# Infrastructure (Redis, PostgreSQL, etc.)
docker-compose up -d
```

## Project Structure

```
├── backend/          # FastAPI application, models, services
│   └── tests/        # Backend unit & integration tests
├── frontend/         # React/Next.js client application
├── packages/         # Shared libraries and utilities
├── k8s/              # Kubernetes manifests for deployment
└── tests/            # End-to-end and cross-cutting tests
```

## Code Style

- **Backend:** Linted and formatted with [ruff](https://github.com/astral-sh/ruff).
- **Frontend:** Linted with [ESLint](https://eslint.org/).

Run all linters:

```bash
make lint
```

## Testing

Run the full backend pytest suite:

```bash
make test
```

Tests live in `backend/tests/` (unit/integration) and `tests/` (end-to-end). Write tests for every new feature or bug fix.

## Branch Naming

Use prefixed branch names off `main`:

| Prefix      | Purpose                    |
| ----------- | -------------------------- |
| `feature/*` | New features               |
| `bugfix/*`  | Non-urgent bug fixes       |
| `hotfix/*`  | Critical production fixes  |

## Commit Conventions

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add document summarization endpoint
fix: resolve token refresh race condition
docs: update API reference for /v1/analyze
refactor: extract shared auth middleware
test: add coverage for RBAC permission checks
chore: bump dependencies
```

## Pull Request Process

1. **Fork** the repository and create a branch from `main`.
2. **Implement** your changes following the code style guidelines.
3. **Test** thoroughly — `make test` must pass with no failures.
4. **Commit** using conventional commit messages.
5. **Open a PR** against `main` with a clear description of what changed and why.

## Code Review Standards

- Every PR requires at least one approving review before merge.
- Reviewers check for correctness, test coverage, security implications, and adherence to project conventions.
- Address all review feedback before requesting re-review.
- Keep PRs focused — one logical change per PR.

---

By submitting a contribution, you agree that your work will be licensed under the project's existing license.
