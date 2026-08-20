# 💳 SSM-Pay Enterprise Payment Platform

<p align="center">
  <img src="public/logo.svg" alt="SSM-Pay Logo" width="120" height="120" />
</p>

<p align="center">
  <strong>Enterprise-grade payment processing platform with AI-powered fraud detection</strong>
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#getting-started">Getting Started</a> •
  <a href="#architecture">Architecture</a> •
  <a href="#api-documentation">API Docs</a> •
  <a href="#testing">Testing</a> •
  <a href="#contributing">Contributing</a>
</p>

---

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-20-black?style=flat-square&logo=next.js" alt="Next.js" />
  <img src="https://img.shields.io/badge/TypeScript-5.x-blue?style=flat-square&logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Bun-1.x-black?style=flat-square" alt="Bun" />
  <img src="https://img.shields.io/badge/Prisma-5.x-black?style=flat-square&logo=prisma" alt="Prisma" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-3.x-38B2AC?style=flat-square&logo=tailwind-css" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/Docker-Ready-2496ED?style=flat-square&logo=docker" alt="Docker" />
  <img src="https://img.shields.io/badge/CI/CD-GitHub_Actions-2088FF?style=flat-square&logo=github-actions" alt="CI/CD" />
  <img src="https://img.shields.io/badge/License-MIT-green?style=flat-square" alt="License" />
</p>

---

## 📖 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Environment Configuration](#environment-configuration)
  - [Running Locally](#running-locally)
  - [Docker Alternative](#docker-alternative)
- [Architecture](#architecture)
  - [Project Structure](#project-structure)
  - [System Architecture](#system-architecture)
- [API Documentation](#api-documentation)
- [Testing](#testing)
- [Security](#security)
- [Monitoring & Observability](#monitoring--observability)
- [Deployment](#deployment)
- [Contributing](#contributing)
- [License](#license)

---

## 🎯 Overview

**SSM-Pay** is a comprehensive enterprise payment platform designed for businesses requiring secure, scalable, and intelligent payment processing. Built with modern web technologies, SSM-Pay integrates seamlessly with Zainpay's payment infrastructure while providing advanced features including:

- **AI-Powered Fraud Detection** using machine learning algorithms
- **Real-time Transaction Monitoring** with anomaly detection
- **Multi-channel Payment Processing** supporting various payment methods
- **Comprehensive Webhook System** for event-driven integrations
- **Enterprise-grade Security** with encryption and audit logging
- **Scalable Architecture** designed for high-volume transactions

---

## ✨ Features

### 🔐 Core Payment Features
- **Multi-Method Payments**: Support for bank transfers, cards, mobile money, and USSD
- **Zainbox Management**: Create and manage virtual accounts (Zainboxes) for collections
- **Transaction Processing**: Real-time payment initiation and status tracking
- **Refund Management**: Handle partial and full refunds with proper authorization
- **Balance Inquiry**: Real-time account balance checking

### 🤖 AI/ML Capabilities
- **Fraud Detection Engine**: ML-powered transaction risk scoring
- **Anomaly Detection**: Statistical analysis to identify unusual patterns
- **Risk Assessment**: Multi-factor risk evaluation (amount, frequency, geography, device)
- **Behavioral Analytics**: User behavior profiling for enhanced security
- **Revenue Prediction**: ML-based revenue forecasting models

### 🔒 Security Features
- **End-to-End Encryption**: All sensitive data encrypted at rest and in transit
- **Audit Logging**: Comprehensive audit trail for all operations
- **CSRF Protection**: Cross-site request forgery prevention
- **CORS Configuration**: Configurable cross-origin resource sharing
- **Rate Limiting**: API rate limiting to prevent abuse
- **Webhook Signature Verification**: Secure webhook payload validation

### 🔄 Integration Features
- **Webhook System**: Reliable webhook delivery with retry mechanisms
- **Event Subscriptions**: Subscribe to specific payment events
- **API Rate Limiting**: Configurable rate limits per endpoint
- **Resilience Patterns**: Circuit breakers, bulkheads, and fallbacks

### 📊 Monitoring & Observability
- **Health Checks**: Comprehensive health check endpoints
- **Metrics Collection**: Application performance metrics
- **Error Tracking**: Sentry integration for error monitoring
- **Performance Monitoring**: Request timing and throughput tracking
- **Alert System**: Email and webhook-based alerting

---

## 🛠️ Tech Stack

| Category | Technology | Purpose |
|----------|------------|---------|
| **Framework** | Next.js 20 | React-based full-stack framework |
| **Language** | TypeScript 5.x | Type-safe JavaScript |
| **Runtime** | Bun | Fast JavaScript runtime & package manager |
| **Database** | SQLite / Prisma | Database ORM & migrations |
| **Styling** | Tailwind CSS 4 | Utility-first CSS framework |
| **UI Components** | shadcn/ui | Accessible component library |
| **Auth** | NextAuth.js | Authentication solution |
| **Caching** | Redis | In-memory data store |
| **ML** | Custom ML Engine | Fraud detection & analytics |
| **Monitoring** | Sentry | Error tracking & performance |
| **Containerization** | Docker | Container runtime |
| **CI/CD** | GitHub Actions | Continuous integration |

---

## 🚀 Getting Started

### Prerequisites

Ensure you have the following installed on your system:

- **Node.js** >= 20.x ([Download](https://nodejs.org/))
- **Bun** >= 1.0.x ([Installation Guide](https://bun.sh/docs/installation))
- **Git** >= 2.x ([Download](https://git-scm.com/))
- **Redis** >= 7.x (optional, for caching) ([Download](https://redis.io/download))
- **Docker** & **Docker Compose** (optional) ([Download](https://docs.docker.com/get-docker/))

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-org/ssm-pay.git
   cd ssm-pay
   ```

2. **Install dependencies:**
   ```bash
   bun install
   ```

3. **Set up environment variables:**
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your configuration
   ```

4. **Set up the database:**
   ```bash
   # Generate Prisma client
   bunx prisma generate
   
   # Run database migrations
   bunx prisma migrate dev
   
   # Seed database (optional)
   bunx prisma db seed
   ```

### Environment Configuration

Copy `.env.example` to `.env.local` and configure the following essential variables:

```bash
# Required: Zainpay API Credentials
ZAINPAY_API_KEY=your_api_key_here
ZAINPAY_API_SECRET=your_secret_here

# Required: Authentication
NEXTAUTH_SECRET=generate_a_secure_random_string_at_least_32_chars

# Required: Security
ENCRYPTION_KEY=generate_a_32_character_encryption_key
CSRF_SECRET=generate_a_csrf_secret

# Optional: Redis (recommended for production)
REDIS_URL=redis://localhost:6379

# Optional: Sentry (error tracking)
NEXT_PUBLIC_SENTRY_DSN=your_sentry_dsn
```

#### Generating Secrets

Use these commands to generate secure secrets:

```bash
# Generate NEXTAUTH_SECRET (requires OpenSSL)
openssl rand -base64 32

# Generate ENCRYPTION_KEY (exactly 32 characters)
openssl rand -hex 16

# Generate CSRF_SECRET
openssl rand -base64 24
```

### Running Locally

**Development Mode:**
```bash
# Start development server with hot reload
bun run dev
```

The application will be available at [http://localhost:3000](http://localhost:3000).

**Available Scripts:**
```bash
bun run dev          # Start development server
bun run build        # Build for production
bun run start        # Start production server
bun run lint         # Run ESLint
bun run typecheck    # Run TypeScript checker
bun run test         # Run tests
bun run test:coverage # Run tests with coverage
bun run format       # Format code with Prettier
```

### Docker Alternative

**Using Docker Compose (Production):**
```bash
# Build and start all services
docker compose up -d

# View logs
docker compose logs -f app

# Stop services
docker compose down
```

**Using Docker Compose (Development):**
```bash
# Start development environment with hot reload
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

**Individual Docker Commands:**
```bash
# Build image
docker build -t ssmpay:latest .

# Run container
docker run -d \
  --name ssmpay \
  -p 3000:3000 \
  -v $(pwd)/data:/app/data \
  --env-file .env.local \
  ssmpay:latest
```

---

## 🏗️ Architecture

### Project Structure

```
ssm-pay/
├── .github/
│   └── workflows/
│       └── ci.yml              # CI/CD pipeline configuration
├── public/                     # Static assets
│   ├── logo.svg
│   └── robots.txt
├── prisma/
│   └── schema.prisma           # Database schema definition
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── api/                # API route handlers
│   │   ├── layout.tsx          # Root layout
│   │   ├── page.tsx            # Home page
│   │   └── globals.css         # Global styles
│   ├── components/
│   │   └── ui/                 # shadcn/ui components
│   ├── hooks/                  # React hooks
│   │   ├── use-mobile.ts
│   │   └── use-toast.ts
│   ├── lib/                    # Core libraries
│   │   ├── ml/                 # Machine learning modules
│   │   │   ├── fraud-detector/ # Fraud detection engine
│   │   │   ├── anomaly/        # Anomaly detection
│   │   │   ├── risk-engine/    # Risk assessment
│   │   │   └── predictor/      # Prediction models
│   │   ├── db.ts               # Database client
│   │   └── utils.ts            # Utility functions
│   ├── services/               # Business logic services
│   │   ├── webhooks/           # Webhook handling
│   │   ├── audit-log/          # Audit logging
│   │   ├── monitoring/         # Health & metrics
│   │   └── resilience/         # Resilience patterns
│   └── types/                  # TypeScript type definitions
│       ├── payment.ts
│       ├── transaction.ts
│       ├── customer.ts
│       └── zainbox.ts
├── tests/                      # Test configurations
├── .env.example                # Environment variable template
├── Dockerfile                  # Multi-stage Docker build
├── docker-compose.yml          # Production compose config
├── docker-compose.dev.yml      # Development override
├── next.config.ts              # Next.js configuration
├── tailwind.config.ts          # Tailwind CSS config
├── tsconfig.json               # TypeScript config
├── eslint.config.mjs           # ESLint configuration
├── package.json                # Dependencies & scripts
└── bun.lock                    # Lockfile
```

### System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         SSM-Pay Platform                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────┐  │
│  │   Next.js   │    │   API       │    │     Webhook         │  │
│  │   Frontend  │◄──►│   Routes    │◄──►│     Handlers        │  │
│  └──────┬──────┘    └──────┬──────┘    └──────────┬──────────┘  │
│         │                  │                      │             │
│         ▼                  ▼                      ▼             │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                   Service Layer                          │    │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │    │
│  │  │ Payment  │ │ Customer │ │ Zainbox  │ │  Auth    │   │    │
│  │  │ Service  │ │ Service  │ │ Service  │ │ Service  │   │    │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘   │    │
│  ├─────────────────────────────────────────────────────────┤    │
│  │                 ML / Intelligence Layer                  │    │
│  │  ┌──────────────┐ ┌────────────┐ ┌──────────────────┐  │    │
│  │  │ Fraud Detector│ │ Risk Engine│ │ Anomaly Detector │  │    │
│  │  └──────────────┘ └────────────┘ └──────────────────┘  │    │
│  └─────────────────────────────────────────────────────────┘    │
│         │                  │                      │             │
│         ▼                  ▼                      ▼             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────┐  │
│  │   SQLite    │    │    Redis    │    │   External APIs     │  │
│  │   (Prisma)  │    │   (Cache)   │    │   (Zainpay)        │  │
│  └─────────────┘    └─────────────┘    └─────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📚 API Documentation

### Base URL
- **Production**: `https://api.ssmpay.com/v1`
- **Development**: `http://localhost:3000/api`

### Key Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check endpoint |
| POST | `/api/payments/initiate` | Initiate a new payment |
| GET | `/api/payments/:id` | Get payment details |
| POST | `/api/zainboxes/create` | Create a Zainbox account |
| GET | `/api/transactions` | List transactions |
| POST | `/api/webhooks/handle` | Handle incoming webhooks |

### Full API Documentation

For comprehensive API documentation including:
- Authentication methods
- Request/response schemas
- Error codes
- Rate limiting details
- Webhook event types

👉 **[View Full API Docs](./docs/api.md)** *(Coming soon)*

### Interactive Testing

Use the built-in Swagger/OpenUI or Postman collection:

```bash
# Import Postman collection
# Location: docs/postman_collection.json
```

---

## 🧪 Testing

### Running Tests

```bash
# Run all tests
bun run test

# Run tests in watch mode
bun run test:watch

# Run tests with coverage report
bun run test:coverage

# Run specific test file
bun run test -- path/to/test.test.ts
```

### Test Structure

```
tests/
├── unit/
│   ├── services/
│   │   ├── payment.test.ts
│   │   └── fraud-detector.test.ts
│   └── lib/
│       └── utils.test.ts
├── integration/
│   ├── api/
│   │   └── payments.test.ts
│   └── webhooks/
│       └── handler.test.ts
└── e2e/
    └── payment-flow.spec.ts
```

### Coverage Requirements

We maintain minimum coverage thresholds:
- **Statements**: > 80%
- **Branches**: > 75%
- **Functions**: > 80%
- **Lines**: > 80%

---

## 🔒 Security

### Security Best Practices Implemented

1. **Environment Variables**: Sensitive data stored in environment, never in code
2. **Input Validation**: All inputs validated using Zod schemas
3. **SQL Injection Prevention**: Parameterized queries via Prisma ORM
4. **XSS Protection**: Built-in Next.js XSS protections + output encoding
5. **CSRF Protection**: Token-based CSRF protection
6. **Rate Limiting**: Configurable per-endpoint rate limiting
7. **Encryption**: AES-256-GCM for sensitive data at rest
8. **HTTPS Only**: Production enforces TLS 1.3

### Security Headers

```
Content-Security-Policy: default-src 'self'
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
Strict-Transport-Security: max-age=31536000; includeSubDomains
```

### Reporting Vulnerabilities

Please report security vulnerabilities responsibly:
- Email: security@ssmpay.com
- PGP Key: Available on request
- Please do NOT open public issues for security issues

---

## 📊 Monitoring & Observability

### Health Check

```bash
curl http://localhost:3000/api/health
```

Response:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00Z",
  "version": "2.1.0",
  "checks": {
    "database": "healthy",
    "redis": "healthy",
    "zainpay_api": "healthy"
  }
}
```

### Metrics Endpoints

| Endpoint | Description |
|----------|-------------|
| `/api/metrics` | Prometheus-formatted metrics |
| `/api/health/live` | Liveness probe |
| `/api/health/readiness` | Readiness probe |

### Sentry Integration

Errors are automatically captured and reported to Sentry when configured:
- Error tracking enabled by default in production
- Performance monitoring available
- Session replay for debugging (configurable)

---

## 🚢 Deployment

### Environment Checklist

Before deploying to any environment:

- [ ] All environment variables configured
- [ ] Database migrations run (`prisma migrate deploy`)
- [ ] SSL certificates installed
- [ ] Redis instance available (if using caching)
- [ ] Sentry DSN configured (for error tracking)
- [ ] Webhook URLs whitelisted with Zainpay

### Deployment Options

**1. Vercel (Recommended for Next.js)**
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

**2. Docker / Kubernetes**
```bash
# Build and push image
docker build -t your-registry/ssmpay:$VERSION .
docker push your-registry/ssmpay:$VERSION

# Apply Kubernetes manifests
kubectl apply -f k8s/
```

**3. Traditional Server (PM2)**
```bash
# Build application
bun run build

# Start with PM2
pm2 start ecosystem.config.cjs
```

---

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

### Quick Start for Contributors

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes
4. Run tests: `bun run test`
5. Commit changes: `git commit -m 'feat: add my feature'`
6. Push to fork: `git push origin feature/my-feature`
7. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

```
MIT License

Copyright (c) 2024 SSM-Pay

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of THE SOFTWARE.
```

---

## 📞 Support

- **Documentation**: [docs.ssmpay.com](https://docs.ssmpay.com)
- **Issues**: [GitHub Issues](https://github.com/your-org/ssm-pay/issues)
- **Email**: support@ssmpay.com
- **Status Page**: [status.ssmpay.com](https://status.ssmpay.com)

---

<div align="center">

**Built with ❤️ by the SSM-Pay Team**

[⬆ Back to Top](#-ssm-pay-enterprise-payment-platform)

</div>
