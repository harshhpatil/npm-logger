# Changelog

All notable changes to this project will be documented in this file.

## [1.1.0] - 2026-10-08
### Added
- Robust `safeDeepCloneAndRedact` function to handle circular JSON references gracefully.
- Proper serialization of `Error` instances to retain message and stack traces.
- Exposes `silent` and `customTransports` options to the `createLogger` factory.
- Comprehensive `bun test` suite.

## [1.0.0] - 2026-10-08
### Added
- Initial package release.
- Base winston wrapper with development (text) and production (JSON) formatting.
- Naive JSON deep cloning for basic secret redaction.