# Security policy

## Supported versions

| Version | Supported |
| --- | --- |
| `main` (latest deploy on Render) | Yes |
| Older tags / forks | Best effort |

## Reporting a vulnerability

Please **do not** open a public issue for security-sensitive reports.

1. Use [GitHub Security Advisories](https://github.com/smriad/house-pot/security/advisories/new) on this repository (recommended), or
2. Contact the maintainer via the email associated with the `smriad` GitHub account if you cannot use Advisories.

Include steps to reproduce, impact, and any suggested fix if you have one.

## What to expect

- Acknowledgment within a reasonable timeframe (typically a few days).
- Coordination on a fix and disclosure timeline before public details when appropriate.

## Scope notes

House Pot is a demo web app. Reports about **misconfigured production secrets** (exposed `MONGODB_URI`, `ELEVENLABS_API_KEY`, etc.) in commits or forks should be reported privately. Rotate keys immediately if they were exposed.

Out of scope: social engineering, denial-of-service against the free Render tier, and issues in third-party services (MongoDB Atlas, ElevenLabs, Google AI) except where this repo’s integration is clearly at fault.
