# Contributing to SSM Pay

Thank you for your interest in contributing to SSM Pay! This document provides guidelines and instructions for contributing to this project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Commit Guidelines](#commit-guidelines)
- [Testing Guidelines](#testing-guidelines)
- [Pull Request Process](#pull-request-process)

## Code of Conduct

This project adheres to a code of conduct that all contributors are expected to follow. Please be respectful and constructive in all interactions.

## Getting Started

### Prerequisites

- Node.js 20 or later
- npm or bun package manager
- Git

### Setup Development Environment

1. **Clone the repository**
   ```bash
   git clone https://github.com/sudaissalisu/SSM-Pay.git
   cd SSM-Pay
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   ```
   
   Edit `.env.local` and add your credentials.

4. **Start development server**
   ```bash
   npm run dev
   ```

   The app will be available at http://localhost:9002

## Development Workflow

1. **Create a branch** for your feature or fix:
   ```bash
   git checkout -b feature/your-feature-name
   # or
   git checkout -b fix/your-bug-fix
   ```

2. **Make your changes** following the coding standards below.

3. **Test your changes**:
   ```bash
   # Run linting
   npm run lint
   
   # Run type checking
   npm run typecheck
   
   # Run tests
   npm run test
   
   # Or run all checks together
   npm run lint && npm run typecheck && npm run test
   ```

4. **Format your code**:
   ```bash
   npm run format
   ```

## Coding Standards

### TypeScript

- Use strict TypeScript typing
- Avoid `any` type; use specific types or `unknown`
- Use interfaces for object shapes, types for unions/primitives
- Export types explicitly

### React/Next.js

- Use functional components with hooks
- Use 'use client' directive for client components
- Keep components focused and single-purpose
- Extract complex logic into custom hooks or utility functions

### Code Style

This project uses ESLint and Prettier for code formatting:

```bash
# Check formatting
npm run format:check

# Auto-format
npm run format
```

### File Organization

```
src/
├── app/          # Next.js App Router pages and APIs
│   ├── actions/  # Server actions
│   └── api/      # API routes
├── components/   # React components
│   └── ui/       # UI primitives (shadcn/ui)
├── hooks/        # Custom React hooks
└── lib/          # Utilities, types, and configurations
```

## Commit Guidelines

We follow [Conventional Commits](https://www.conventionalcommits.org/) specification:

### Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- `feat`: A new feature
- `fix`: A bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks
- `perf`: Performance improvements

### Examples

```bash
feat(payment): add currency conversion display
fix(callback): handle missing transaction reference
test(actions): add tests for verifyTransaction
refactor(sidebar): split into modular components
docs(readme): add installation instructions
```

## Testing Guidelines

### Running Tests

```bash
# Run all tests once
npm run test

# Run tests in watch mode
npm run test:watch

# Run tests with UI coverage
npm run test:ui
```

### Writing Tests

- Write unit tests for utility functions and modules
- Write integration tests for server actions
- Use mock implementations for external API calls
- Aim for meaningful coverage of critical paths

### Example Test Structure

```typescript
import { describe, it, expect } from 'vitest';

describe('Module/Function', () => {
  it('should do something expected', () => {
    // Arrange
    const input = { ... };
    
    // Act
    const result = functionUnderTest(input);
    
    // Assert
    expect(result).toEqual(expected);
  });
});
```

## Pull Request Process

1. **Ensure tests pass** before submitting
2. **Update documentation** if you've changed functionality
3. **Add tests** for new features or bug fixes
4. **Follow the commit message format**
5. **Describe your changes** clearly in the PR description

### PR Title Format

Use conventional commit format for PR titles:

- `feat: Add new payment method selector`
- `fix: Resolve callback URL encoding issue`
- `test: Increase coverage for exchange rate logic`

### PR Description Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
How was this tested?

## Screenshots (if applicable)
Add screenshots for UI changes
```

## Need Help?

If you have questions, feel free to open an issue for discussion before submitting a PR.

---

Thank you for contributing! 🎉
