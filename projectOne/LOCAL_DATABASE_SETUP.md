# Local Database Setup Guide

## 🚀 Cách 1: Docker Compose (Recommended - Dễ Nhất)

### Step 1: Đảm bảo Docker đã cài đặt
```bash
# Kiểm tra Docker
docker --version
docker-compose --version

# Nếu chưa cài, tải từ: https://www.docker.com/products/docker-desktop
```

### Step 2: Start PostgreSQL với Docker Compose
```bash
# Từ thư mục project
cd /path/to/projectOne

# Khởi động PostgreSQL
docker-compose up -d

# Kiểm tra container đã chạy
docker-compose ps
# Output:
# NAME                    STATUS
# elysia_postgres         Up (healthy)
```

### Step 3: Xác minh database
```bash
# Kiểm tra connection
docker-compose exec postgres pg_isready -U postgres

# Connect vào database
docker-compose exec postgres psql -U postgres -d elysia_db

# Trong psql:
\dt  # Xem tất cả tables
\l   # Xem tất cả databases
\q   # Thoát
```

### Step 4: Create .env file
```bash
# Copy từ .env.example
cp .env.example .env

# Nội dung .env:
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=elysia_db
NODE_ENV=development
```

### Step 5: Start Bun server
```bash
# Install dependencies
bun install

# Run development server
bun run dev

# Output:
# ✅ Database connection established
# Server running at http://localhost:3000
```

### Step 6: Test API
```bash
# Register user
curl -X POST http://localhost:3000/api/v1/users \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","email":"test@example.com"}'

# Response: 201 Created ✅
```

---

## 🛑 Dừng Database
```bash
# Dừng containers
docker-compose down

# Dừng nhưng giữ data
docker-compose stop

# Xóa containers + data
docker-compose down -v
```

---

## 💾 Quản Lý Database

### Backup Database
```bash
# Export database to SQL file
docker-compose exec postgres pg_dump -U postgres elysia_db > backup.sql

# Kích thước file
ls -lh backup.sql
```

### Restore Database
```bash
# Restore từ backup
docker-compose exec -T postgres psql -U postgres elysia_db < backup.sql
```

### Xóa & Reset Database
```bash
# Xóa toàn bộ data
docker-compose down -v

# Start lại database (sạch)
docker-compose up -d
```

---

## 🌐 Connect Database từ GUI Tools

### DBeaver (Miễn Phí)
1. Download: https://dbeaver.io/download/
2. Install
3. New Connection → PostgreSQL
4. Settings:
   - Host: localhost
   - Port: 5432
   - Database: elysia_db
   - Username: postgres
   - Password: postgres
5. Click **Test Connection** ✅
6. Kết nối và xem data

### pgAdmin (Web-based)
```bash
# Thêm vào docker-compose.yml
services:
  pgadmin:
    image: dpage/pgadmin4
    container_name: pgadmin4
    environment:
      PGADMIN_DEFAULT_EMAIL: admin@admin.com
      PGADMIN_DEFAULT_PASSWORD: admin
    ports:
      - "5050:80"
    depends_on:
      - postgres

# Sau đó:
docker-compose up -d

# Truy cập: http://localhost:5050
# Email: admin@admin.com
# Password: admin
```

---

## 📊 Database Structure

### Tables được tạo:
```
elysia_db
├── users (user management)
│   ├── id (UUID, primary)
│   ├── name
│   ├── email (unique)
│   ├── phone
│   ├── address
│   ├── status (active/inactive)
│   ├── role (admin/user)
│   ├── createdAt
│   ├── updatedAt
│   └── deletedAt (soft delete)
│
└── posts (blog posts)
    ├── id (UUID, primary)
    ├── title
    ├── slug (unique)
    ├── content
    ├── status (draft/published)
    ├── viewCount
    ├── createdAt
    ├── updatedAt
    └── deletedAt (soft delete)
```

---

## 🔧 Troubleshoot

### Error: Port 5432 already in use
```bash
# Kill process on port 5432
lsof -ti:5432 | xargs kill -9

# Hoặc sử dụng port khác
docker run -p 5433:5432 postgres:16-alpine
```

### Error: Cannot connect to database
```bash
# Check logs
docker-compose logs postgres

# Restart container
docker-compose restart postgres
```

### Database không sync entities
```bash
# Xóa database và tạo lại
docker-compose down -v
docker-compose up -d
bun run dev  # Sẽ auto-sync entities
```

### Xem data từ command line
```bash
# Login vào container
docker-compose exec postgres psql -U postgres -d elysia_db

# Commands:
\dt                                    # Xem tables
SELECT * FROM users;                  # Xem users
SELECT * FROM posts;                  # Xem posts
SELECT COUNT(*) FROM users;           # Count users
\d users                               # Xem schema của users table
```

---

## 🔍 Kiểm Tra Status

### Check Docker
```bash
# Kiểm tra containers
docker ps

# Kiểm tra images
docker images | grep postgres

# Kiểm tra volumes
docker volume ls | grep postgres
```

### Check Database Health
```bash
# Từ PostgreSQL container
docker-compose exec postgres pg_isready -U postgres

# Output:
# accepting connections ✅

# Hoặc từ bên ngoài
psql -h localhost -U postgres -d elysia_db -c "SELECT version();"
```

### Check Server
```bash
# Kiểm tra Bun server đang chạy
curl http://localhost:3000/health

# Response:
# {"success":true,"message":"Server is running"}
```

---

## 📋 Complete Setup Script

Tạo file `setup-db.sh`:

```bash
#!/bin/bash

echo "🚀 Setting up local database..."

# Check Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed"
    exit 1
fi

# Create .env file
if [ ! -f .env ]; then
    echo "📝 Creating .env file..."
    cp .env.example .env
    echo "✅ .env created"
fi

# Start PostgreSQL
echo "🐘 Starting PostgreSQL..."
docker-compose down -v
docker-compose up -d

# Wait for database
echo "⏳ Waiting for database to be ready..."
sleep 5

# Check connection
docker-compose exec postgres pg_isready -U postgres

echo ""
echo "✅ Database setup complete!"
echo ""
echo "Next steps:"
echo "  1. bun install"
echo "  2. bun run dev"
echo ""
echo "Test endpoints:"
echo "  curl http://localhost:3000/health"
echo "  curl -X POST http://localhost:3000/api/v1/users \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d '{\"name\":\"Test\",\"email\":\"test@example.com\"}'"
```

Chạy:
```bash
chmod +x setup-db.sh
./setup-db.sh
```

---

## 🎯 Quick Start (5 phút)

```bash
# 1. Start database
docker-compose up -d

# 2. Create .env
cp .env.example .env

# 3. Install packages
bun install

# 4. Start server
bun run dev

# 5. Test
curl http://localhost:3000/health
```

---

## 🧪 Test Scenarios

### Test 1: Create User
```bash
curl -X POST http://localhost:3000/api/v1/users \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "+84912345678",
    "address": "Ha Noi, Vietnam"
  }'
```

### Test 2: List Users
```bash
USER_TOKEN=$(echo -n "user-id:john@example.com:John Doe:user" | base64)
curl -H "Authorization: Bearer $USER_TOKEN" \
  http://localhost:3000/api/v1/users
```

### Test 3: Check Database
```bash
docker-compose exec postgres psql -U postgres -d elysia_db -c "SELECT * FROM users;"
```

---

## 📚 Useful Commands

```bash
# Docker Compose
docker-compose up -d              # Start
docker-compose down               # Stop
docker-compose logs -f postgres   # View logs
docker-compose ps                 # Check status

# PostgreSQL CLI
psql -h localhost -U postgres     # Connect
\dt                               # List tables
\d users                          # Describe table
SELECT * FROM users;              # Query data

# Bun
bun install                       # Install deps
bun run dev                       # Start server
bun run build                     # Build
bun test                          # Run tests
```

---

## ✅ Checklist

- [ ] Docker đã cài đặt
- [ ] docker-compose.yml tồn tại
- [ ] .env file được tạo
- [ ] Docker container chạy
- [ ] Database connection thành công
- [ ] Bun server chạy trên port 3000
- [ ] API test thành công

---

**Status:** ✅ Ready for local development  
**Created:** 12/12/2025  
**Last Updated:** 12/12/2025
