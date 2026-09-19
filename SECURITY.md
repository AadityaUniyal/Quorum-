# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |
| < 1.0   | :x:                |

Only the latest `1.0.x` release receives security patches. Upgrade to a supported version before reporting issues.

## Reporting a Vulnerability

**Do not open a public issue for security vulnerabilities.**

Report vulnerabilities through one of the following channels:

- **Email:** [security@docintel.ai](mailto:security@docintel.ai)
- **GitHub:** Open a [private security advisory](https://github.com/AadityaUniyal/Googi/security/advisories/new)

Include the following in your report:

- Description of the vulnerability and its potential impact
- Steps to reproduce or a proof of concept
- Affected version(s)
- Suggested fix, if any

## Response Timeline

| Severity | Acknowledgment | Patch Target |
| -------- | -------------- | ------------ |
| Critical | 48 hours       | 7 days       |
| High     | 48 hours       | 14 days      |
| Medium   | 72 hours       | 30 days      |
| Low      | 72 hours       | Next release |

We will keep you informed of our progress throughout the remediation process.

## Confirmed Security Architecture & Defense Layers

DocIntel AI enforces defense-in-depth across all system boundaries. Every security mechanism has been implemented, validated, and confirmed:

### 1. Zero-Trust Data Governance & Automated PII/PHI Redaction
- **Entity Detection**: Automated detection of high-risk sensitive identifiers including Social Security Numbers (SSN), credit card numbers (validated via Luhn algorithm), International Bank Account Numbers (IBAN with ISO 7064 Mod-97-10 verification), Tax Identification Numbers (EIN), emails, and phone numbers.
- **Pre-Storage Sanitization**: OCR text is sanitized *before* vector chunking, embedding generation, and ChromaDB persistence, guaranteeing that unmasked sensitive data is never indexed in vector databases or leaked into external LLM prompts.
- **Cryptographic Vault Tokenization**: Replaces detected entities with deterministic tokens (`{{PII_<TYPE>_<INDEX>}}`) and stores the original values in an isolated vault.
- **Attribute-Based Access Control (ABAC)**: De-anonymization of vault tokens is strictly restricted to users holding `ADMIN`, `COMPLIANCE_OFFICER`, or `AUDITOR` roles. Unprivileged users (e.g. operators, viewers) only receive masked representations.

### 2. Authentication, Session & Token Security
- **Credential Storage**: Passwords hashed using standard `bcrypt` with salt rounds and enforced minimum entropy scoring via `zxcvbn`.
- **JWT Lifecycle & Rotation**: Short-lived access tokens (15 minutes) paired with rotating refresh tokens (7 days). Token reuse is prevented through Redis blacklisting and user-level `token_version` invalidation on password change or forced sign-out.
- **Cookie Hardening**: Tokens transported via `httpOnly`, `Secure` (production), and `SameSite=Lax` cookies, neutralizing XSS exfiltration vectors.

### 3. Strict Multi-Tenant Isolation & Role-Based Access Control (RBAC)
- **Database Boundary Enforcement**: Queries filter through `filter_documents_for_user`, `require_document_read`, and `require_document_write` using composite database indexes (`organization_id`, `created_at`). Cross-organization access attempts return HTTP 403 Forbidden.
- **Tenant-Scoped Cache**: Redis cache keys incorporate `_tenant_org` and `_user_id` namespaces to prevent cross-tenant cache contamination.
- **Audit Lineage**: All modifications, status transitions, and human review corrections are recorded immutably in `AuditLog` records with user ID and timestamp.

### 4. Distributed Concurrency Control & Mutex Locking
- **Review Locking**: Review workspace implements distributed Redis mutex locks (`lock:document:<id>`) with automated TTL expiry (15 minutes) and client heartbeats.
- **Atomic Scripts**: Lock acquisition, renewal, and release are executed via atomic Lua scripts (`LUA_HEARTBEAT_SCRIPT`, `LUA_RELEASE_SCRIPT`) to prevent race conditions and split-brain edits between concurrent reviewers.

### 5. Network Boundary Defense & SSRF Mitigation
- **URL Validation**: Outbound webhook delivery and web crawler requests pass through `validate_safe_url`, which resolves domain IPs and strictly blocks private subnets (RFC 1918), loopback (`127.0.0.1`, `::1`), link-local (`169.254.169.254`), and cloud instance metadata endpoints.
- **HMAC Webhook Signatures**: All outgoing webhook payloads are cryptographically signed using HMAC-SHA256 (`X-DocIntel-Signature-256`) to ensure authenticity and integrity.

### 6. Application Hardening & Input Sanitization
- **HTTP Security Headers**: Enforced via `SecurityHeadersMiddleware`:
  - `Content-Security-Policy: default-src 'self'; frame-ancestors 'none';`
  - `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Referrer-Policy: strict-origin-when-cross-origin`
- **Injection Prevention**: 100% of database interactions execute through SQLAlchemy parameterized queries, preventing SQL injection. Ingress payloads are validated strictly against Pydantic v2 schemas.
- **Frontend XSS Shielding**: All raw OCR text and document previews rendered in the Next.js frontend are sanitized through `DOMPurify` before DOM insertion.
- **Rate Limiting**: Critical endpoints (login, register, token refresh, file upload, RAG streaming) are protected by Redis-backed sliding-window rate limiters via `slowapi`.

### 7. Zero Plaintext Secrets Policy
- Zero API keys, production database credentials, or signing secrets are committed to version control.
- All configuration is driven through environment variables validated at startup by `ConfigValidator`. Local development `.env` files are ignored by git.


## Responsible Disclosure

We ask that you:

1. **Allow reasonable time** for us to investigate and patch the vulnerability before any public disclosure.
2. **Avoid** accessing, modifying, or deleting data belonging to other users during your research.
3. **Act in good faith** — do not exploit vulnerabilities beyond what is necessary to demonstrate the issue.

We commit to:

- Not pursuing legal action against researchers who follow this policy.
- Crediting reporters in release notes (unless anonymity is preferred).
- Working transparently with you toward a resolution.

---

Thank you for helping keep DocIntel AI and its users secure.
