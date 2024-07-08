# Changelog

All notable changes to the SSM Pay project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2025-01-19

### Added
- **Test Suite**: Added comprehensive test coverage using Vitest and React Testing Library
  - Unit tests for error handling (`src/lib/errors.test.ts`)
  - Unit tests for logger (`src/lib/logger.test.ts`)
  - Unit tests for Zainpay API client (`src/lib/zainpay-client.test.ts`)
  - Integration tests for server actions (`src/app/actions.test.ts`)
- **CI/CD Pipeline**: GitHub Actions workflow for automated testing and building
  - Lint validation on every push/PR
  - TypeScript type checking
  - Test execution with coverage reporting
  - Build verification
- **Structured Error Handling**: Custom error classes with proper categorization
  - `AppError` base class with error codes and severity levels
  - `ConfigError`, `PaymentError`, `ApiError`, `ValidationError` specialized types
  - Error wrapping utility for consistent error handling
- **Structured Logging**: JSON-formatted logger for production use
  - Event tagging for payment, API, and application events
  - Development-friendly colored output
  - Production-ready structured logging
- **Zainpay API Client Module**: Centralized API client for better testability
  - `RealZainpayApiClient` for production use
  - `MockZainpayApiClient` for testing without network calls
  - Dependency injection support via factory function
- **Code Quality Improvements**:
  - ESLint configuration (`.eslintrc.json`)
  - Prettier configuration (`.prettierrc`)
  - Split large sidebar component into modular files
- **Dependency Management**: Dependabot configuration for automatic updates

### Changed
- Refactored server actions to use new Zainpay client module
- Replaced console.error calls with structured logging
- Updated `.env.example` to include all required environment variables
- Updated package.json name from "nextn" to "ssm-pay"
- Added new npm scripts: `test`, `test:watch`, `format`, `format:check`

### Fixed
- Missing environment variables in `.env.example`
  - Added `NEXT_PUBLIC_ZAINPAY_PUBLIC_KEY`
  - Added `NEXT_PUBLIC_ZAINBOX_CODE_NAME`

## [1.0.0] - 2025-11-19

### Added
- Initial release of SSM Pay integration kit
- Payment page with real-time currency conversion (NGN ↔ USD)
- Callback handling for transaction verification
- Zainpay API integration for payment processing
- Dashboard with Zainbox management (create/list)
- shadcn/ui component library integration
- Zod schema validation for form inputs
- Sandbox testing documentation

---

## Version History

| Version | Date       | Description                              |
|---------|------------|------------------------------------------|
| 1.1.0   | 2025-01-19 | Test suite, CI/CD, error handling, logging|
| 1.0.0   | 2025-11-19 | Initial release                          |
