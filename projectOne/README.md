# Elysia Backend - Professional Setup with PostgreSQL & TypeORM

A production-ready backend built with **Bun**, **Elysia**, **PostgreSQL**, and **TypeORM**.

## 🚀 Features

- ⚡ **Bun Runtime** - Ultra-fast JavaScript runtime
- 🎯 **Elysia Framework** - Fast & friendly web framework
- 🐘 **PostgreSQL Database** - Robust relational database
- 🗄️ **TypeORM** - Powerful ORM with migrations support
- 🏗️ **Modular Architecture** - Scalable project structure
- 🔐 **TypeScript Support** - Full type safety
- 🛡️ **Error Handling** - Centralized error management
- 📝 **Logging System** - Request/response logging
- 🔗 **CORS Support** - Cross-origin resource sharing
- 🐳 **Docker Support** - Easy containerization
- 🧪 **Testing Ready** - Bun test support
- 📋 **Code Quality** - Biome for linting & formatting

## 📁 Project Structure

```
src/
├── config/                          # Configuration
│   ├── env.ts                      # Environment variables
│   └── constants.ts                # Application constants
├── database/                        # Database layer
│   ├── connection.ts               # Database connection
│   ├── entities/                   # TypeORM entities
│   │   └── user.entity.ts
│   └── migrations/                 # Database migrations
│       └── 1702400000000-CreateUserTable.ts
├── controllers/                     # Request handlers
│   └── health.controller.ts        # User controller
├── services/                        # Business logic
│   └── user.service.ts            # User service
├── models/                          # Data models
│   └── user.model.ts
├── middleware/                      # Custom middleware
│   ├── error.middleware.ts
│   ├── logger.middleware.ts
│   └── cors.middleware.ts
├── utils/                           # Utility functions
│   ├── logger.ts
│   └── helpers.ts
├── types/                           # TypeScript definitions
│   ├── api.types.ts
│   └── response.types.ts
├── routes/                          # API routes
│   ├── index.ts
│   └── v1/
│       ├── health.routes.ts
│       └── users.routes.ts
└── index.ts                         # Application entry point

```

## 🛠️ Prerequisites

- **Bun** >= 1.0.0
- **PostgreSQL** >= 14
- **Node.js** >= 18 (for development tools)

## 📦 Installation

### Option 1: Using Docker (Recommended)

```bash
# Start PostgreSQL container
docker-compose up -d

# Install dependencies
bun install
```

### Option 2: Using Local PostgreSQL

1. Ensure PostgreSQL is installed and running
2. Create database:
   ```sql
   CREATE DATABASE elysia_db;
   ```
3. Update `.env` with your database credentials
4. Install dependencies:
   ```bash
   bun install
   ```

## 🎮 Development

```bash
# Run development server with hot reload
bun run dev
```

Server starts at `http://localhost:3000`

## 🗄️ Database Management

### Run Migrations

```bash
# Run pending migrations
bun typeorm migration:run -d src/database/connection.ts

# Revert last migration
bun typeorm migration:revert -d src/database/connection.ts

# Generate new migration
bun typeorm migration:generate -d src/database/connection.ts src/database/migrations/MigrationName
```

### Synchronize Database (Development Only)

In development mode with `synchronize: true`, TypeORM will automatically create/sync tables on startup.

## 🏗️ Build & Deploy

```bash
# Build for production
bun run build

# Start production server
bun run start
```

## 📊 Code Quality

```bash
# Lint code
bun run lint

# Format code
bun run format

# Type checking
bun run type-check
```

## 🧪 Testing

```bash
# Run tests
bun test
```

## 📝 Environment Variables

Create a `.env` file in the project root:

```env
# Server Configuration
PORT=3000
NODE_ENV=development
LOG_LEVEL=debug

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=elysia_db
```

## 🔌 API Endpoints

### Health Check
```
GET /health
```
Response:
```json
{
  "success": true,
  "message": "Server is healthy",
  "data": {
    "uptime": 12.345,
    "timestamp": "2024-12-12T10:00:00Z",
    "environment": "development"
  },
  "timestamp": "2024-12-12T10:00:00Z"
}
```

### Users API

#### Get All Users
```
GET /api/v1/users
```

#### Get User by ID
```
GET /api/v1/users/:id
```

#### Create User
```
POST /api/v1/users
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com"
}
```

#### Update User
```
PUT /api/v1/users/:id
Content-Type: application/json

{
  "name": "Jane Doe",
  "email": "jane@example.com"
}
```

#### Delete User
```
DELETE /api/v1/users/:id
```

## �️ Database Schema

### Users Table
- `id` (UUID, Primary Key)
- `name` (VARCHAR 255)
- `email` (VARCHAR 255, Unique)
- `phone` (VARCHAR 255, Optional)
- `address` (TEXT, Optional)
- `status` (VARCHAR 50, Default: 'active')
- `createdAt` (TIMESTAMP)
- `updatedAt` (TIMESTAMP)
- `deletedAt` (TIMESTAMP, Soft Delete)

## �📚 Project Architecture

### Layer Structure

1. **Controllers** - Handle HTTP requests and responses
2. **Services** - Contain business logic
3. **Database** - Handle data persistence with TypeORM
4. **Middleware** - Cross-cutting concerns (logging, error handling)
5. **Utils** - Helper functions
6. **Types** - TypeScript interfaces and types

### Request Flow
```
Request → Routes → Controllers → Services → Database
         ↓
      Middleware (CORS, Logging, Error Handling)
```

## 🔒 Key Features

### Soft Delete
Users are soft-deleted (marked with `deletedAt` timestamp) instead of hard-deleted for audit purposes.

### Timestamps
Automatic `createdAt` and `updatedAt` timestamps on all entities.

### Validation
Request validation with email format checking and required field validation.

### Error Handling
Centralized error handling with meaningful error messages and appropriate HTTP status codes.

### Logging
Structured JSON logging for debugging and monitoring.

## 📚 References

- [Elysia Documentation](https://elysiajs.com)
- [Bun Documentation](https://bun.sh/docs)
- [TypeORM Documentation](https://typeorm.io)
- [PostgreSQL Documentation](https://www.postgresql.org/docs)
- [TypeScript Documentation](https://www.typescriptlang.org/docs)

## 📄 License

MIT
