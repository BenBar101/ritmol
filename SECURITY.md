# Security Policy

## Supported versions

Only the latest deployed version of RITMOL is supported.

## Reporting a vulnerability

Please report security vulnerabilities by emailing YOUR_EMAIL_HERE.

Do not open a public GitHub issue for security findings. A public issue
exposes the vulnerability to everyone before it is fixed.

You can expect an acknowledgement within 7 days. RITMOL is a personal
open-source project maintained by one person; complex fixes may take longer.

## Threat model

RITMOL is a single-user personal app. The threat model assumes a trusted
device. Remote attackers who find the static site URL have access to the
app's UI only — all user data and API keys live in the user's own browser
storage and JSON file.

Full threat model: see README.md → Design Philosophy & Security Model.
