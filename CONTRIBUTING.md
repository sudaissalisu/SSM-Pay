# Contributing to SSM-Pay

Thank you for your interest in contributing to **SSM-Pay**! This document provides guidelines and instructions for contributing to this project.

---

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Workflow Process](#workflow-process)
- [Coding Standards](#coding-standards)
- [Commit Message Guidelines](#commit-message-guidelines)
- [Pull Request Process](#pull-request-process)
- [Testing Guidelines](#testing-guidelines)
- [Documentation](#documentation)

---

## Code of Conduct

This project adheres to a code of conduct that all contributors are expected to follow. By participating, you are expected to uphold this code of conduct:

- **Be respectful** - Treat others with respect and professionalism
- **Be welcoming** - Welcome newcomers and help them get started
- **Be collaborative** - Work together towards the best solution
- **Be constructive** - Provide helpful feedback and suggestions
- **Be responsible** - Take ownership of your contributions

Please report unacceptable behavior to: conduct@ssmpay.com

---

## Getting Started

### Prerequisites

Before contributing, ensure you have:

1. **Read the README.md** - Understand the project structure and purpose
2. **Set up development environment** - Follow installation instructions
3. **Fork the repository** - Create your own copy for contributions
4. **Clone your fork**
   ```bash
   git clone https://github.com/YOUR_USERNAME/ssm-pay.git
   cd ssm-pay
   ```

### Development Setup

1. **Install dependencies:**
   ```bash
   bun install
   ```

2. **Set up environment:**
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your local configuration
   ```

3. **Set up database:**
   ```bash
   bunx prisma generate
   bunx prisma migrate dev
   ```

4. **Verify setup:**
   ```bash
   bun run dev
   bun run test
   bun run lint
   bun run typecheck
   ```

5. **Add upstream remote:**
   ```bash
   git remote add upstream https://github.com/your-org/ssm-pay.git
   ```

---

## Workflow Process

We follow a **fork-based Git workflow**:

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   main      │◄────│  develop    │◄────│ feature/*   │
│  (stable)   │     │ (staging)   │     │  (your PR)  │
└─────────────┘     └─────────────┘     └─────────────┘
```

### Branch Naming Convention

Use descriptive branch names with prefixes:

| Prefix | Usage | Example |
|--------|-------|---------|
| `feature/` | New features | `feature/ml-fraud-detection` |
| `fix/` | Bug fixes | `fix/webhook-retry-logic` |
| `docs/` | Documentation | `docs/api-endpoints` |
| `refactor/` | Code refactoring | `refactor/payment-service` |
| `test/` | Test additions | `test/transaction-coverage` |
| `chore/` | Maintenance tasks | `chore/update-dependencies` |
| `hotfix/` | Production fixes | `hotfix/security-patch` |

### Steps for Contributing

1. **Sync with upstream:**
   ```bash
   git fetch upstream
   git checkout develop
   git merge upstream/develop
   ```

2. **Create feature branch:**
   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **Make your changes:**
   - Write clean, well-documented code
   - Follow coding standards
   - Add tests for new functionality
   - Update documentation as needed

4. **Commit your changes:** (see commit guidelines below)

5. **Push to your fork:**
   ```bash
   git push origin feature/your-feature-name
   ```

6. **Create Pull Request**

---

## Coding Standards

### TypeScript / JavaScript

```typescript
// ✅ Good: Use explicit types
interface PaymentRequest {
  amount: number;
  currency: string;
  customerId: string;
}

// ❌ Bad: Use 'any' type
const processPayment = (data: any) => { ... };
```

#### Type Safety Rules
- Always use TypeScript interfaces/types for objects
- Never use `any` type (use `unknown` if necessary)
- Enable strict mode in tsconfig.json
- Prefer `const` over `let`, avoid `var`
- Use async/await instead of raw Promises

### React / Next.js

```tsx
// ✅ Good: Functional components with proper typing
interface ButtonProps {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary';
}

export function Button({ label, onClick, variant = 'primary' }: ButtonProps) {
  return (
    <button 
      className={`btn btn-${variant}`}
      onClick={onClick}
    >
      {label}
    </button>
  );
}
```

#### React Best Practices
- Use functional components (no class components)
- Use hooks for state and side effects
- Keep components small and focused
- Extract reusable logic into custom hooks
- Use Server Components where appropriate (Next.js App Router)

### File Organization

```
src/
├── components/
│   └── ui/           # Reusable UI components
├── hooks/            # Custom React hooks
├── lib/              # Utility libraries
│   └── ml/           # ML modules
├── services/         # Business logic services
├── types/            # TypeScript type definitions
└── app/              # Next.js pages/API routes
```

#### Naming Conventions
- **Files**: kebab-case (`payment-service.ts`, `use-form-hook.ts`)
- **Components**: PascalCase (`PaymentForm.tsx`, `UserAvatar.tsx`)
- **Functions/Variables**: camelCase (`processPayment`, `userId`)
- **Constants**: UPPER_SNAKE_CASE (`MAX_RETRY_ATTEMPTS`, `API_BASE_URL`)
- **Types/Interfaces**: PascalCase with prefix (`IPaymentRequest`, `TTransactionStatus`)
- **Enums**: PascalCase (`PaymentStatus`, `RiskLevel`)

### Import Order

```typescript
// 1. React & Next.js imports
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

// 2. Third-party library imports
import { z } from 'zod';
import prisma from '@/lib/db';

// 3. Internal imports (alias @/)
import { PaymentService } from '@/services/payment';
import type { IPayment } from '@/types/payment';

// 4. Relative imports
import { formatAmount } from './utils';

// 5. Styles (if CSS modules)
import styles from './Component.module.css';
```

### Error Handling

```typescript
// ✅ Good: Proper error handling with specific error types
async function processPayment(paymentData: PaymentRequest): Promise<PaymentResult> {
  try {
    // Validate input first
    const validated = paymentSchema.parse(paymentData);
    
    // Process with error handling
    const result = await paymentService.process(validated);
    
    return result;
  } catch (error) {
    // Handle specific error types
    if (error instanceof ZodError) {
      throw new ValidationError('Invalid payment data', error.errors);
    }
    
    if (error instanceof ApiError) {
      throw new PaymentError('Payment processing failed', error.code);
    }
    
    // Log unexpected errors
    logger.error('Unexpected payment error', { error, paymentData });
    throw new InternalError('An unexpected error occurred');
  }
}
```

---

## Commit Message Guidelines

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

### Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

| Type | Description |
|------|-------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `style` | Formatting, missing semicolons, etc. (no code change) |
| `refactor` | Code change that neither fixes a bug nor adds a feature |
| `perf` | Performance improvement |
| `test` | Adding or updating tests |
| `chore` | Maintenance tasks, dependency updates |
| `ci` | CI/CD configuration changes |
| `build` | Build system or external dependency changes |

### Examples

```bash
# Simple feature
feat(payment): add support for mobile money payments

# Bug fix with issue reference
fix(webhook): resolve retry mechanism infinite loop

# Breaking change
feat(api)!: change transaction response schema

# Feature with detailed body
feat(ml): implement fraud detection scoring engine

- Add risk assessment service with configurable thresholds
- Implement multi-factor risk evaluation (amount, frequency, geo, device)
- Add ML model caching for improved performance

Closes #123
```

### Commit Message Rules
- Use present tense ("add" not "added")
- Use imperative mood ("move" not "moves")
- Limit first line to 72 characters
- Reference issues and PRs in footer when relevant
- Do not end subject line with period

---

## Pull Request Process

### Before Submitting

- [ ] Code follows project style guidelines
- [ ] All tests pass (`bun run test`)
- [ ] Linting passes (`bun run lint`)
- [ ] Type checking passes (`bun run typecheck`)
- [ ] New features include appropriate tests
- [ ] Documentation is updated for user-facing changes
- [ ] Commit messages follow conventional commits format

### PR Title Format

Use conventional commit format for PR titles:

```
feat(payment): add USSD payment channel support
fix(auth): resolve session expiration issue
docs(readme): update installation instructions
```

### PR Description Template

When creating a PR, use this template:

```markdown
## Description
Brief description of what this PR does.

## Type of Change
- [ ] Bug fix (non-breaking change fixing an issue)
- [ ] New feature (non-breaking change adding functionality)
- [ ] Breaking change (fix or feature causing existing functionality to change)
- [ ] Documentation update

## Related Issues
Closes #(issue number)

## How Has This Been Tested?
Describe test coverage and manual testing performed.

## Screenshots (if applicable)
Add screenshots for UI changes.

## Checklist
- [ ] My code follows the style guidelines
- [ ] I have performed self-review
- [ ] I have commented complex code areas
- [ ] I have updated documentation
- [ ] My changes generate no new warnings
- [ ] I have added tests that prove my fix is effective
- [ ] New and existing unit tests pass locally
```

### Review Process

1. **Automated checks** must pass (CI pipeline)
2. **At least one approval** from maintainer required
3. **Address all review comments** before merging
4. **Squash merge** is preferred for clean history
5. **Delete branch** after merge (cleanup)

---

## Testing Guidelines

### Writing Tests

```typescript
// ✅ Good: Clear test structure with Arrange-Act-Assert
describe('PaymentService', () => {
  describe('processPayment()', () => {
    it('should successfully process valid payment', async () => {
      // Arrange
      const paymentData = createMockPayment({ amount: 1000 });
      
      // Act
      const result = await paymentService.process(paymentData);
      
      // Assert
      expect(result.status).toBe('success');
      expect(result.transactionId).toBeDefined();
    });

    it('should throw validation error for negative amount', async () => {
      // Arrange
      const invalidData = createMockPayment({ amount: -100 });
      
      // Act & Assert
      await expect(
        paymentService.process(invalidData)
      ).rejects.toThrow(ValidationError);
    });
  });
});
```

### Test Categories

1. **Unit Tests**: Individual functions/components in isolation
2. **Integration Tests**: Multiple components working together
3. **E2E Tests**: Full user flows through the application

### Coverage Requirements

| Area | Minimum Coverage |
|------|------------------|
| Services | 85% |
| Utilities | 90% |
| Components | 75% |
| API Routes | 80% |
| Overall | 80% |

### Running Tests Locally

```bash
# Run all tests
bun run test

# Run with watch mode
bun run test:watch

# Run with coverage
bun run test:coverage

# Run specific test file
bun run test -- payment.test.ts
```

---

## Documentation

### When to Document

Update documentation when:
- Adding new features (API docs, README)
- Changing behavior (CHANGELOG, docs)
- Adding new environment variables (.env.example)
- Modifying architecture (README architecture section)

### Documentation Style

- Use clear, concise language
- Include code examples where helpful
- Keep documentation up-to-date with code
- Use consistent formatting

### Docstrings

```typescript
/**
 * Processes a payment request through Zainpay API.
 * 
 * @param paymentData - The payment request data
 * @returns Promise resolving to payment result with transaction details
 * 
 * @throws {ValidationError} When payment data fails validation
 * @throws {PaymentError} When payment processing fails
 * @throws {ApiError} When Zainpay API returns an error
 * 
 * @example
 * ```ts
 * const result = await processPayment({
 *   amount: 5000,
 *   currency: 'NGN',
 *   customerId: 'cust_123'
 * });
 * ```
 */
export async function processPayment(
  paymentData: PaymentRequest
): Promise<PaymentResult> {
  // Implementation
}
```

---

## Questions?

If you have questions about contributing:

- 📧 Email: dev@ssmpay.com
- 💬 Discussions: [GitHub Discussions](https://github.com/your-org/ssm-pay/discussions)
- 🐛 Issues: [GitHub Issues](https://github.com/your-org/ssm-pay/issues)

---

## License

By contributing, you agree that your contributions will be licensed under the same license as the project (MIT License).

---

*Thank you for contributing to SSM-Pay! 🎉*
