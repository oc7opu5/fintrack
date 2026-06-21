# FinTrack - Session Progress

## Project Location
`C:\Users\Administrator\fintrack`

## GitHub Repository
`https://github.com/oc7opu5/fintrack.git`

## What Was Built

### Core Features
- **Auth System** - Login/Register with NextAuth.js v5, bcrypt password hashing
- **Dashboard** - Overview cards (income, expenses, savings, net worth)
- **Accounts** - bKash, Nagad, Rocket, Mobile Banking, Bank, Cash tracking
- **Transactions** - CRUD with AI-powered natural language chat input
- **Credit Cards** - Card management with loan tracker (reducing balance amortization)
- **Subscriptions** - Monthly/yearly/quarterly/lifetime deal tracking
- **Budget** - Per-category spending limits with progress bars and alerts
- **Reports** - Monthly income vs expense analytics with charts
- **Settings** - Profile, security, data management

### Tech Stack
- Next.js 16.2.9 with App Router + TypeScript
- PostgreSQL 16 with Prisma ORM v6
- NextAuth.js v5 (credentials provider)
- tRPC for type-safe APIs
- shadcn/ui components (20+ components)
- Tailwind CSS v4
- Docker + docker-compose for self-hosting
- Capacitor for iOS/Android mobile apps

### AI Parser
- OpenAI GPT-4o-mini integration
- Ollama local AI integration
- Regex fallback when no AI available
- Parses: amount, type, category, account, date from natural language

### Database Schema (Prisma)
- User, Account, Transaction, Category, Tag
- CreditCard, CreditCardLoan, LoanInstallment, LoanPayment
- Subscription, Budget, AIParseLog

### Files Created
```
fintrack/
├── src/app/
│   ├── (auth)/login, register
│   ├── (dashboard)/dashboard, transactions, accounts, credit-cards, subscriptions, budget, reports, settings, more
│   └── api/auth, trpc
├── src/components/layout/ (sidebar, topbar, mobile-nav)
├── src/components/ui/ (20+ shadcn components)
├── src/lib/
│   ├── auth.ts, prisma.ts, utils.ts
│   ├── ai/ (parser, providers/openai, ollama, prompts, types)
│   └── trpc/routers/ (account, transaction, category, credit-card, loan, subscription, budget, ai)
├── prisma/schema.prisma
├── docker-compose.yml, Dockerfile
├── capacitor.config.ts
└── README.md
```

## Current State

### Working
- Build passes (`npm run build` succeeds)
- Database schema pushed to PostgreSQL
- Demo data seeded (demo@fintrack.app / password123)
- All 9 MCP servers configured (filesystem, github, playwright, postgres, sqlite, docker, memory, context7, sentry)
- Skills installed (react, react-native, docker, webapp-testing, capacitor, nextjs)

### Not Working
- Dev server blocked by EACCES permission error on all ports
- Git push timing out (network issue) - 2 commits ahead of origin
- GitHub token exposed in chat (should be rotated)

## How to Continue

### When You Return
1. Navigate to project: `cd C:\Users\Administrator\fintrack`
2. Start dev server (may need admin PowerShell or different port)
3. All code is committed locally, push with: `git push origin main`

### Remaining Tasks
1. **Fix dev server** - EACCES permission issue on ports
2. **Push to GitHub** - 2 commits ahead, network timeout
3. **Test full flow** - Auth, transactions, credit cards, subscriptions, budget
4. **Add more seed data** - Credit card loans, more transactions
5. **Polish UI** - Loading states, error handling, empty states
6. **Docker deployment** - Test docker-compose up
7. **Mobile build** - Test Capacitor sync and build

### Quick Commands
```bash
cd C:\Users\Administrator\fintrack

# If database container stopped
docker start fintrack-db

# Push schema changes
npm run db:push

# Seed demo data
npm run db:seed

# Start dev server (try admin PowerShell if permission error)
npm run dev

# Push to GitHub
git push origin main

# Build for production
npm run build

# Docker deploy
docker-compose up -d
```

### Demo Credentials
- Email: demo@fintrack.app
- Password: password123

## MCP Servers (9 active)
filesystem, github (authed), playwright, postgres, sqlite, docker, memory, context7, sentry

## Skills Installed
vercel-react-best-practices, vercel-react-native-skills, docker-expert, webapp-testing, capacitor-react, nextjs-app-router-patterns
