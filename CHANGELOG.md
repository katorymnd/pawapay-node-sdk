# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2025-12-22

### Added
- **Security Layer:** Implemented surgical JavaScript obfuscation for core API and License logic.
- **Integrity Checker:** Added a new background process to detect if SDK files have been tampered with or modified.
- **Server-Side Validation:** Integrated a heartbeat and domain activation system with `katorymnd.com`.
- **Installation Imprint:** Implemented a unique installation "Soul" (TOFU - Trust On First Use) via the `.pawapay-imprint` system.
- **Path Locking:** Added hardware and project-path fingerprinting to prevent unauthorized SDK migration between servers.

### Changed
- **Build Pipeline:** Moved production builds to a `/dist` folder strategy to ensure development secrets (like `.env`) are never published.
- **Deployment:** Updated the publishing workflow to use `pnpm publish:secure`.
- **License Logic:** Strict domain enforcement via `PAWAPAY_SDK_LICENSE_DOMAIN` environment variable.

### Fixed
- Fixed an issue where the SDK would occasionally fail to detect the environment in Docker containers.
- Improved error messaging when a license key is missing or the domain is unauthorized.

### Removed
- Removed localhost forgiveness; all environments now require a valid domain configuration for security.
- Removed development scripts and backup files from the final production distribution.

---

## [1.0.0] - 2025-11-15
- Initial release of the PawaPay Node.js SDK.
- Core API client for mobile money deposits and payments.
- Basic error handling and logging.

