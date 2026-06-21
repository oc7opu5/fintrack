# FinTrack - Personal Finance Manager

A self-hostable, Docker-ready personal finance management app. Track income, expenses, credit card loans, subscriptions, and budgets with AI-powered natural language input.

## Features

- **Dashboard** - Overview of income, expenses, savings, and budget status
- **Chat Input** - Add transactions using natural language (e.g., "spent 500 on lunch via bKash")
- **Accounts** - Track bKash, Nagad, Rocket, bank accounts, and cash
- **Credit Cards** - Manage cards with installment loan tracker (reducing balance)
- **Subscriptions** - Track monthly, yearly, and lifetime deals
- **Budget** - Set spending limits per category with alerts
- **Reports** - Monthly/yearly analytics with charts
- **Mobile Responsive** - Works on phones and tablets
- **Self-Hostable** - Docker deployment included

## Tech Stack

- **Frontend**: Next.js 14+, Tailwind CSS, shadcn/ui
- **Backend**: tRPC, Prisma ORM
- **Database**: PostgreSQL
- **Auth**: NextAuth.js v5
- **AI**: OpenAI/Ollama (optional)
- **Mobile**: Capacitor (iOS/Android)

## Quick Start

### Local Development

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/fintrack.git
   cd fintrack
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment:
   ```bash
   cp .env.example .env
   # Edit .env with your database URL
   ```

4. Start PostgreSQL (or use Docker):
   ```bash
   docker run -d --name fintrack-db -p 5432:5432 -e POSTGRES_DB=fintrack -e POSTGRES_USER=fintrack -e POSTGRES_PASSWORD=fintrack123 postgres:16-alpine
   ```

5. Run database setup:
   ```bash
   npm run db:push
   npm run db:seed
   ```

6. Start development server:
   ```bash
   npm run dev
   ```

7. Open [http://localhost:3000](http://localhost:3000)

   Demo credentials:
   - Email: `demo@fintrack.app`
   - Password: `password123`

### Docker Deployment

1. Clone and configure:
   ```bash
   git clone https://github.com/yourusername/fintrack.git
   cd fintrack
   cp .env.example .env
   # Edit .env and set NEXTAUTH_SECRET
   ```

2. Start with Docker Compose:
   ```bash
   docker-compose up -d
   ```

3. Open [http://localhost:3000](http://localhost:3000)

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `NEXTAUTH_URL` | App URL for auth callbacks | Yes |
| `NEXTAUTH_SECRET` | Secret for JWT encryption | Yes |
| `OPENAI_API_KEY` | For AI natural language parsing | No |
| `OLLAMA_BASE_URL` | Local Ollama server URL | No |

## Project Structure

```
fintrack/
├── src/
│   ├── app/           # Next.js App Router pages
│   ├── components/    # React components
│   ├── lib/           # Utilities, tRPC, auth
│   └── providers/     # Context providers
├── prisma/            # Database schema & migrations
├── docker/            # Docker configuration
└── docker-compose.yml # Full stack setup
```

## API Routes

- `/api/auth/*` - NextAuth.js authentication
- `/api/trpc/*` - tRPC API endpoints

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

MIT License - see [LICENSE](LICENSE) for details.
