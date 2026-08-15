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

## Security Features

DocIntel AI implements the following security measures:

- **Authentication:** JWT-based auth with token blacklisting and refresh token rotation.
- **Password Security:** Bcrypt hashing with password strength enforcement (minimum length, complexity requirements).
- **Session Protection:** httpOnly, secure cookies to prevent XSS-based token theft.
- **Rate Limiting:** Redis-backed rate limiting on authentication and API endpoints.
- **Authorization:** Role-Based Access Control (RBAC) with granular permission checks.

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
