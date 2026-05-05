# Security policy

## Reporting a vulnerability

If you believe you have found a security vulnerability in Knowledge Robot,
please report it privately rather than opening a public issue.

Email the maintainer with the details: please include reproduction steps, the
affected component (frontend / backend / docker image), and any logs or
proof-of-concept inputs you have.

You should expect an acknowledgement within a few business days and a fix or
mitigation timeline shortly after triage. We will credit reporters in the
release notes unless they request otherwise.

## Scope

In scope:

- Code in this repository (frontend, backend, docker compose files).
- Default configuration shipped in `.env.local.example`.

Out of scope:

- Third-party LLM provider behavior (DeepInfra, Gemini, Firecrawl, etc.) — please
  report those upstream.
- User-supplied API keys leaking via misconfigured deployments — that is a
  deployment concern, not a code defect, but we are happy to help harden the
  default configuration if you find a weak point.
