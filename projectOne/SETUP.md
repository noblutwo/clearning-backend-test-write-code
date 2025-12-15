# 🎉 Cấu trúc Backend Bun + Elysia + PostgreSQL + TypeORM

## ✅ Đã cài đặt hoàn chỉnh

Cấu trúc backend chuyên nghiệp đã được tạo với đầy đủ các thành phần:

### 📦 Dependencies
- **elysia** - Framework web hiện đại
- **typeorm** - ORM mạnh mẽ
- **pg** - PostgreSQL driver
- **cors** - Cross-origin support
- **reflect-metadata** - TypeORM metadata
- **biome** - Linting & formatting
- **typescript** - Type safety

### 🏗️ Cấu trúc hoàn chỉnh

```
projectOne/
├── src/
│   ├── config/                 # Cấu hình
│   │   ├── env.ts
│   │   └── constants.ts
│   ├── database/               # Database layer
│   │   ├── connection.ts       # TypeORM config
│   │   ├── entities/
│   │   │   └── user.entity.ts  # User model
│   │   └── migrations/
│   │       └── 1702400000000-CreateUserTable.ts
│   ├── controllers/            # HTTP handlers
│   │   └── health.controller.ts
│   ├── services/               # Business logic
│   │   └── user.service.ts
│   ├── repositories/           # Data access
│   │   └── user.repository.ts
│   ├── dtos/                   # Data transfer
│   │   └── user.dto.ts
│   ├── middleware/             # Cross-cutting
│   │   ├── error.middleware.ts
│   │   ├── logger.middleware.ts
│   │   └── cors.middleware.ts
│   ├── utils/                  # Utilities
│   │   ├── logger.ts
│   │   └── helpers.ts
│   ├── types/                  # TypeScript types
│   │   ├── api.types.ts
│   │   └── response.types.ts
│   ├── routes/                 # API routes
│   │   ├── index.ts
│   │   └── v1/
│   │       ├── health.routes.ts
│   │       └── users.routes.ts
│   └── index.ts               # Entry point
├── Dockerfile                  # Docker image
├── docker-compose.yml         # Docker compose
├── package.json               # Dependencies
├── tsconfig.json             # TypeScript config
├── biome.json                # Biome config
├── .env                      # Environment (dev)
├── .env.production          # Environment (prod)
├── .gitignore               # Git ignore
├── README.md                # Documentation
├── GUIDE.md                 # Vietnamese guide
└── SETUP.md                 # This file
```

## 🚀 Bắt đầu nhanh

### 1. Cài đặt
```bash
cd projectOne
bun install
```

### 2. Cấu hình Database
```bash
# Option A: Dùng Docker (khuyến khích)
docker-compose up -d

# Option B: PostgreSQL cục bộ
createdb elysia_db
```

### 3. Chạy Development
```bash
bun run dev
```

Server sẽ chạy tại: **http://localhost:3000**

## 🔌 API Endpoints

### Health Check
```bash
GET http://localhost:3000/health
```

### Users API

```bash
# Lấy tất cả users
GET /api/v1/users

# Lấy user theo ID
GET /api/v1/users/:id

# Tạo user
POST /api/v1/users
{
  "name": "John Doe",
  "email": "john@example.com"
}

# Cập nhật user
PUT /api/v1/users/:id
{
  "name": "Jane Doe",
  "email": "jane@example.com"
}

# Xóa user (soft delete)
DELETE /api/v1/users/:id
```

## 📊 Commands

```bash
# Development
bun run dev          # Chạy dev server với hot reload

# Build & Deploy
bun run build        # Build production
bun run start        # Chạy production

# Code Quality
bun run lint         # Lint code
bun run format       # Format code
bun run type-check   # Type checking

# Testing
bun test            # Chạy tests

# Database
bun typeorm migration:run -d src/database/connection.ts     # Run migrations
bun typeorm migration:revert -d src/database/connection.ts  # Revert migrations
```

## 🗄️ Database Architecture

### Users Table
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(255),
  address TEXT,
  status VARCHAR(50) DEFAULT 'active',
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deletedAt TIMESTAMP NULL
);
```

## 🏛️ Architecture Layers

```
Request
   ↓
Routes (v1)
   ↓
Controllers (HTTP handling)
   ↓
Services (Business logic)
   ↓
Repositories (Data access)
   ↓
Entities/Database (PostgreSQL)
```

## 🔑 Các Tính Năng Chính

✅ **Modular Architecture** - Dễ mở rộng và bảo trì
✅ **TypeORM Integration** - ORM mạnh mẽ với migrations
✅ **PostgreSQL** - Cơ sở dữ liệu quan hệ
✅ **Error Handling** - Xử lý lỗi tập trung
✅ **Logging System** - Logging có cấu trúc
✅ **Validation** - Validate input
✅ **Soft Delete** - Xóa mềm dữ liệu
✅ **Docker Support** - Dễ containerize
✅ **TypeScript** - Type-safe

## 📝 Environment Variables

```env
# Server
PORT=3000
NODE_ENV=development
LOG_LEVEL=debug

# Database
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=elysia_db
```

## 🐳 Docker

### Build Image
```bash
docker build -t elysia-backend .
```

### Run Container
```bash
docker run -p 3000:3000 \
  -e DB_HOST=postgres \
  -e DB_USER=postgres \
  -e DB_PASSWORD=postgres \
  elysia-backend
```

### Docker Compose
```bash
docker-compose up -d      # Start
docker-compose logs -f    # Logs
docker-compose down       # Stop
```

## 📚 Tài Liệu

- **README.md** - English documentation
- **GUIDE.md** - Vietnamese guide with detailed examples
- **SETUP.md** - This setup summary

## 🔗 Tài Liệu Tham Khảo

- [Elysia Documentation](https://elysiajs.com)
- [Bun Official](https://bun.sh)
- [TypeORM Guide](https://typeorm.io)
- [PostgreSQL Manual](https://www.postgresql.org/docs)

## 💡 Tiếp Theo

1. **Thêm Authentication** - JWT/OAuth
2. **Thêm Validation** - Request validation
3. **Thêm Testing** - Unit & integration tests
4. **Thêm API Documentation** - Swagger/OpenAPI
5. **Thêm Caching** - Redis
6. **Thêm Email Service** - Nodemailer
7. **Thêm File Upload** - S3/Local storage
8. **Thêm Payment Gateway** - Stripe/PayPal

## ❓ Hỗ Trợ

Nếu gặp vấn đề:

1. Kiểm tra `.env` configuration
2. Xem logs: `docker-compose logs postgres`
3. Verify database connection: `psql -U postgres -d elysia_db`
4. Chạy migrations lại: `bun typeorm migration:run -d src/database/connection.ts`

## 📄 License

MIT - Tự do sử dụng và chỉnh sửa

---

**Happy Coding! 🚀**
