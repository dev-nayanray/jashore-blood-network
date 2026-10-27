# Contributing to Jashore Blood Network

Thank you for contributing. This document describes the branch policy, pull
request expectations, code review standards, and commit conventions for this
repository.

## Branch Policy

- `main` — protected. Always deployable. Pull requests merge here.
- `feature/<short-description>` — for new features (e.g. `feature/donor-search`).
- `fix/<short-description>` — for bug fixes (e.g. `fix/otp-rate-limit`).
- `chore/<short-description>` — for tooling, deps, refactor (e.g. `chore/upgrade-next`).
- `docs/<short-description>` — for documentation only.

## Pull Request Expectations

Every PR must:

1. **Link to an issue** (or describe the problem it solves in the PR body).
2. **Pass CI** — lint, typecheck, build, and tests must all be green.
3. **Be reviewed by at least one other contributor** before merge.
4. **Stay focused** — one concern per PR. Refactor + feature in the same PR is rejected.
5. **Include tests** for new behavior. Bug-fix PRs include a regression test.
6. **Not lower test coverage** below the agreed thresholds (80% API, 60% web).

## PR Template

```markdown
## What
<one-line description>

## Why
<problem this solves; link issue if applicable>

## How
<brief technical summary>

## Testing
- [ ] Unit tests added / updated
- [ ] Integration tests added / updated (if API change)
- [ ] Manually verified the user flow

## Risk
<what could break; what was done to mitigate>

## Checklist
- [ ] CI passes locally (`pnpm lint && pnpm typecheck && pnpm test && pnpm build`)
- [ ] No secrets committed
- [ ] No new dependencies without justification
- [ ] Documentation updated (if behavior changed)
```

## Commit Message Conventions

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>

<body optional>

<footer optional>
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`, `ci`.

Examples:
- `feat(donors): add blood-group filter to search endpoint`
- `fix(auth): correct OTP retry window calculation`
- `docs(api): document /api/v1/blood-requests contract`

## Code Review Standards

Reviewers should check for:

- **Correctness** — does the code do what the PR claims?
- **Security** — input validation, authorization, no leaked secrets, no SQL injection.
- **Tests** — are the tests meaningful? Do they cover edge cases?
- **Readability** — will a future contributor understand this in 6 months?
- **No premature abstraction** — does this introduce a generic abstraction before there's a second use case?

Reviewers should NOT block on:

- Pure style preferences covered by Prettier/ESLint.
- Personal naming tastes (within reason).

## Local Pre-PR Checklist

Before requesting review, run:

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

All five must pass. If any fails locally, fix it before pushing.

## Reporting Security Issues

**Do not open a public GitHub issue for security vulnerabilities.** Instead,
email the project owner (to be designated per Q-L8). Acknowledgement and
triage timelines will be documented in `SECURITY.md` before public launch.
