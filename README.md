# Nest Learning — High-Performance NestJS + Prisma API

A strictly typed (zero `any`), layered NestJS v12 REST API powered by **Bun**, **Prisma ORM** (with automatic multi-database support for SQLite, MySQL, and PostgreSQL), **NestJS Observe** APM, in-memory **O(1) LRU + Singleflight** caching, and native **Brotli/Gzip** compression.

---

## Project Architecture

```text
├── prisma/
│   └── schema.prisma              # Prisma schema (auto-synced with DB_CONNECTION)
├── src/
│   ├── config/                    # App, multi-DB, logger, and Prisma sync config
│   │   ├── app.config.ts
│   │   ├── database.config.ts
│   │   ├── logger.config.ts
│   │   ├── prisma-sync.ts
│   │   └── index.ts
│   ├── controllers/               # HTTP route handlers
│   │   ├── health.controller.ts
│   │   ├── users.controller.ts
│   │   ├── posts.controller.ts
│   │   └── index.ts
│   ├── dto/                       # Request validation DTOs (class-validator)
│   │   ├── create-user.dto.ts
│   │   ├── update-user.dto.ts
│   │   ├── create-post.dto.ts
│   │   ├── update-post.dto.ts
│   │   └── index.ts
│   ├── interceptors/              # HTTP logging interceptor & compression middleware
│   │   ├── logging.interceptor.ts
│   │   ├── compression.middleware.ts
│   │   └── index.ts
│   ├── models/                    # PrismaService & strict domain model types
│   │   ├── prisma.service.ts
│   │   ├── user.model.ts
│   │   ├── post.model.ts
│   │   └── index.ts
│   ├── routes/                    # Centralized route path constants
│   │   ├── app.routes.ts
│   │   └── index.ts
│   ├── services/                  # Business logic & LRU/Singleflight cache
│   │   ├── cache.service.ts
│   │   ├── health.service.ts
│   │   ├── users.service.ts
│   │   ├── posts.service.ts
│   │   └── index.ts
│   ├── app.module.ts              # Root application module
│   ├── cluster.ts                 # Multi-core cluster launcher
│   ├── main.ts                    # Application bootstrap
│   └── observe.ts                 # NestJS Observe APM instrumentation
└── test/
    ├── unit/                      # Fast unit test suites (Vitest)
    └── e2e/                       # End-to-end HTTP test suites
```

---

## Environment Configuration (`.env`)

Copy `.env.example` to `.env` and configure your environment:

```env
# Application
PORT=3000
CACHE_TTL_MS=5000

# Logging Channel:
# - stderr: Terminal only
# - file:   Log files only (logs/app.log & logs/error.log)
# - stack:  Both terminal and log files
LOG_CHANNEL=stack
LOG_FILE=logs/app.log
LOG_ERROR_FILE=logs/error.log

# Active Database Driver: sqlite | mysql | postgresql
DB_CONNECTION=postgresql

# Common Database Credentials (used when DB_CONNECTION is mysql or postgresql)
DB_HOST=127.0.0.1
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_DATABASE=nest_learning
DB_SCHEMA=public

# SQLite Configuration
SQLITE_DATABASE_PATH=./dev.db

# Optional Direct Connection URLs (override host/port settings when set)
# DATABASE_URL="file:./dev.db"
# MYSQL_DATABASE_URL="mysql://root:password@127.0.0.1:3306/nest_learning"
# POSTGRESQL_DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/nest_learning?schema=public"

# NestJS Observe Credentials
OBSERVE_APP_KEY=your_app_key
OBSERVE_APP_SECRET='your_app_secret'
```

---

## Commands

```bash
# Install dependencies
bun install

# Sync Prisma schema provider with DB_CONNECTION and push schema to DB
bun run db:sync

# Start in development watch mode (auto-syncs Prisma provider & client)
bun run start:dev

# Start in single-process mode
bun run start

# Start in multi-core cluster mode (1 worker per CPU core)
bun run start:cluster

# Build for production
bun run build

# Type-aware linting (oxlint)
bun run lint

# Run unit tests (Vitest)
bun run test

# Run E2E tests
bun run test:e2e
```

---

## REST API Endpoints

### Health
| Method | Path | Description |
| :--- | :--- | :--- |
| `GET` | `/` | Returns service status, timestamp, and uptime |
| `GET` | `/health` | Returns service status, timestamp, and uptime |

### Users
| Method | Path | Description |
| :--- | :--- | :--- |
| `POST` | `/users` | Create a new user (`{ email, name? }`) |
| `GET` | `/users?page=1&limit=50` | List users with post counts (paginated, cached) |
| `GET` | `/users/:id` | Get a user by ID with their recent posts |
| `PATCH` | `/users/:id` | Update a user's `email` or `name` |
| `DELETE` | `/users/:id` | Delete a user and cascade-delete their posts |

### Posts
| Method | Path | Description |
| :--- | :--- | :--- |
| `POST` | `/posts` | Create a post (`{ title, content?, published?, authorId }`) |
| `GET` | `/posts?page=1&limit=50` | List posts with author summary (paginated, cached) |
| `GET` | `/posts/:id` | Get a single post by ID with author details |
| `GET` | `/posts/user/:userId` | List all posts belonging to a specific author |
| `PATCH` | `/posts/:id` | Update a post's `title`, `content`, or `published` status |
| `DELETE` | `/posts/:id` | Delete a post by ID |
