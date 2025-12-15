# 🚀 QUICK REFERENCE - Bun + Elysia Backend

## ⚡ Installation (3 steps)

```bash
# 1. Install dependencies
cd projectOne
bun install

# 2. Start PostgreSQL
docker-compose up -d

# 3. Run dev server
bun run dev
```

**Server running at:** http://localhost:3000 ✅

---

## 🔌 API Quick Reference

### Health Check
```bash
curl http://localhost:3000/health
```

### Get All Users
```bash
curl http://localhost:3000/api/v1/users
```

### Create User
```bash
curl -X POST http://localhost:3000/api/v1/users \
  -H "Content-Type: application/json" \
  -d '{"name":"John","email":"john@example.com"}'
```

### Get User by ID
```bash
curl http://localhost:3000/api/v1/users/{id}
```

### Update User
```bash
curl -X PUT http://localhost:3000/api/v1/users/{id} \
  -H "Content-Type: application/json" \
  -d '{"name":"Jane"}'
```

### Delete User
```bash
curl -X DELETE http://localhost:3000/api/v1/users/{id}
```

---

## 📝 Essential Commands

| Command | Purpose |
|---------|---------|
| `bun run dev` | Development with hot reload |
| `bun run build` | Build production |
| `bun run start` | Run production |
| `bun run lint` | Lint code |
| `bun run format` | Format code |
| `bun run type-check` | Type checking |
| `bun test` | Run tests |
| `docker-compose up -d` | Start database |
| `docker-compose down` | Stop database |

---

## 🗂️ File Map

```
src/
├── index.ts              → Server entry point
├── config/               → Configuration
├── database/             → Database setup & entities
├── controllers/          → HTTP handlers
├── services/             → Business logic
├── repositories/         → Data access
├── routes/               → API endpoints
├── middleware/           → CORS, errors, logging
├── dtos/                 → Request/response schemas
├── types/                → TypeScript definitions
├── utils/                → Helpers & logger
└── models/               → Data models
```

---

## 🔧 Configuration Files

| File | Purpose |
|------|---------|
| `package.json` | Dependencies & scripts |
| `tsconfig.json` | TypeScript settings |
| `biome.json` | Linting & formatting |
| `.env` | Development environment |
| `docker-compose.yml` | PostgreSQL setup |

---

## 🗄️ Database Quick Reference

### Connect to PostgreSQL
```bash
psql -U postgres -d elysia_db
```

### See all users
```bash
SELECT * FROM users WHERE "deletedAt" IS NULL;
```

### Check migrations
```bash
bun typeorm migration:show -d src/database/connection.ts
```

### Run migrations
```bash
bun typeorm migration:run -d src/database/connection.ts
```

---

## 📚 Documentation Map

| File | Content | Read Time |
|------|---------|-----------|
| **SETUP.md** | Quick start (START HERE) | 5 min |
| **GUIDE.md** | Detailed guide + examples | 30 min |
| **README.md** | Features & API docs | 10 min |
| **SUMMARY.md** | Project overview | 5 min |
| **CHECKLIST.md** | Verification list | 5 min |
| **COMPLETION_REPORT.md** | What was created | 10 min |

---

## 🏗️ Layer Map

```
HTTP Request
    ↓
Routes (v1) → Controllers → Services → Repositories
    ↓                                       ↓
Middleware                              Database
(CORS, Logging,                      (PostgreSQL +
 Error Handling)                      TypeORM)
```

---

## 🎯 Adding New Feature (Example: Posts)

1. **Create Entity** → `src/database/entities/post.entity.ts`
2. **Create Migration** → `src/database/migrations/...ts`
3. **Create DTO** → `src/dtos/post.dto.ts`
4. **Create Repository** → `src/repositories/post.repository.ts`
5. **Create Service** → `src/services/post.service.ts`
6. **Create Controller** → `src/controllers/post.controller.ts`
7. **Create Routes** → `src/routes/v1/posts.routes.ts`
8. **Register Routes** → `src/routes/index.ts`

Done! ✅

---

## 🐳 Docker Commands

```bash
# Start services
docker-compose up -d

# View logs
docker-compose logs -f postgres

# Stop services
docker-compose down

# Rebuild image
docker-compose up -d --build
```

---

## 🔐 Environment Variables

```env
PORT=3000
NODE_ENV=development
LOG_LEVEL=debug

DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=elysia_db
```

---

## ✅ Before Deploying

- [ ] `bun run type-check` (no errors)
- [ ] `bun run lint` (no errors)
- [ ] `bun test` (tests pass)
- [ ] `docker-compose up -d` (DB running)
- [ ] `bun run build` (build succeeds)
- [ ] `bun run start` (server starts)
- [ ] Test endpoints with curl

---

## 🆘 Troubleshooting

### Port 3000 already in use
```bash
kill -9 $(lsof -ti :3000)  # Kill process on port 3000
```

### Database connection error
```bash
docker-compose logs postgres  # Check logs
docker-compose down && docker-compose up -d  # Restart
```

### TypeScript errors
```bash
bun run type-check  # See detailed errors
rm -rf node_modules bun.lockb && bun install  # Reinstall
```

### Migration issues
```bash
bun typeorm migration:revert -d src/database/connection.ts  # Rollback
bun typeorm migration:run -d src/database/connection.ts  # Re-run
```

---

## 📱 Response Format

### Success Response
```json
{
  "success": true,
  "data": { /* payload */ },
  "message": "Operation successful",
  "timestamp": "2024-12-12T10:00:00Z"
}
```

### Error Response
```json
{
  "success": false,
  "error": "Error message",
  "timestamp": "2024-12-12T10:00:00Z"
}
```

---

## 🔗 Useful Links

- Elysia: https://elysiajs.com
- Bun: https://bun.sh
- TypeORM: https://typeorm.io
- PostgreSQL: https://www.postgresql.org/docs
- Docker: https://docs.docker.com

---

## 🎯 Project Stats

- **Runtime:** Bun
- **Framework:** Elysia
- **Database:** PostgreSQL
- **ORM:** TypeORM
- **Language:** TypeScript
- **Endpoints:** 6+ (Health + CRUD)
- **Layers:** 7
- **Files:** 20+
- **Documentation:** 6 guides

---

**Ready to code? Run:** `bun run dev`

**Need help? Read:** SETUP.md (5 min read)

**Last Updated:** 12 December 2025

---

## 🚀 Quick Commands Summary

```bash
# Start
bun install && docker-compose up -d && bun run dev

# Build
bun run build && bun run start

# Quality
bun run lint && bun run format && bun run type-check

# Database
bun typeorm migration:run -d src/database/connection.ts

# Docker
docker-compose up -d && docker-compose logs -f
```

---

**Happy Coding! 🎉**
