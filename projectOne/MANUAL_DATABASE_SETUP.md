# Manual Database Setup (Nếu không dùng Docker)

Nếu bạn không muốn dùng Docker, bạn có thể install PostgreSQL trực tiếp.

---

## 🖥️ Windows

### Step 1: Download PostgreSQL
1. Vào https://www.postgresql.org/download/windows/
2. Download installer (v16 recommended)
3. Chạy installer

### Step 2: Cài Đặt
- Port: `5432` (default)
- Username: `postgres`
- Password: `postgres`
- Check "Install pgAdmin 4" (optional)

### Step 3: Create Database
```bash
# Mở PowerShell hoặc Command Prompt
psql -U postgres

# Trong psql:
CREATE DATABASE elysia_db;
\c elysia_db
\q
```

### Step 4: Update .env
```
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=elysia_db
```

### Step 5: Test Connection
```bash
psql -h localhost -U postgres -d elysia_db
\dt
\q
```

---

## 🍎 macOS

### Step 1: Install với Homebrew
```bash
brew install postgresql@16

# Start service
brew services start postgresql@16

# Verify
psql --version
```

### Step 2: Create Database
```bash
# Connect
psql postgres

# Create database
CREATE DATABASE elysia_db;
\c elysia_db
\q
```

### Step 3: Update .env
```
DB_HOST=localhost
DB_PORT=5432
DB_USER=yourname    # macOS default user
DB_PASSWORD=        # Thường không có password
DB_NAME=elysia_db
```

### Step 4: Test
```bash
psql -d elysia_db
\dt
```

---

## 🐧 Linux (Ubuntu/Debian)

### Step 1: Install
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib

# Start service
sudo systemctl start postgresql
sudo systemctl status postgresql
```

### Step 2: Create Database
```bash
# Connect as postgres user
sudo -u postgres psql

# Inside psql:
CREATE DATABASE elysia_db;
CREATE USER bun WITH PASSWORD 'bun123';
ALTER ROLE bun WITH CREATEDB;
GRANT ALL PRIVILEGES ON DATABASE elysia_db TO bun;

# Test connection
\c elysia_db bun
\q
```

### Step 3: Update .env
```
DB_HOST=localhost
DB_PORT=5432
DB_USER=bun
DB_PASSWORD=bun123
DB_NAME=elysia_db
```

### Step 4: Test
```bash
psql -h localhost -U bun -d elysia_db
```

---

## ✅ Verify Installation

Chạy sau cùng:

```bash
# 1. Check connection
psql -h localhost -U postgres -d elysia_db -c "SELECT 1;"
# Output: 1 ✅

# 2. Check Bun setup
bun install

# 3. Start Bun server
bun run dev
# Output: ✅ Database connection established

# 4. Test API
curl http://localhost:3000/health
# Output: {"success":true,...} ✅
```

---

## 🔧 Common Commands

```bash
# Connect to database
psql -h localhost -U postgres -d elysia_db

# List databases
\l

# Switch database
\c elysia_db

# List tables
\dt

# Describe table
\d users

# Query data
SELECT * FROM users;
SELECT COUNT(*) FROM users;

# Exit
\q
```

---

## 🛑 Stop/Start PostgreSQL

### Windows
```bash
# Command Prompt as Administrator
net stop postgresql-x64-16
net start postgresql-x64-16
```

### macOS
```bash
brew services stop postgresql@16
brew services start postgresql@16
```

### Linux
```bash
sudo systemctl stop postgresql
sudo systemctl start postgresql
sudo systemctl restart postgresql
```

---

## 💾 Backup & Restore

### Backup
```bash
pg_dump -h localhost -U postgres elysia_db > backup.sql
```

### Restore
```bash
psql -h localhost -U postgres elysia_db < backup.sql
```

---

## 🆘 Troubleshoot

### Cannot connect
```bash
# Check if PostgreSQL is running
# Windows: Services > postgresql-x64-16
# Mac: brew services list
# Linux: sudo systemctl status postgresql

# Try connecting without password
PGPASSWORD=postgres psql -h localhost -U postgres
```

### Password not working
```bash
# Reset password (Linux)
sudo -u postgres psql
ALTER USER postgres WITH PASSWORD 'postgres';
\q
```

### Port 5432 in use
```bash
# Windows: netstat -ano | findstr :5432
# Mac/Linux: lsof -i :5432

# Kill process
# Windows: taskkill /PID <PID> /F
# Mac/Linux: kill -9 <PID>

# Use different port in .env
DB_PORT=5433
```

---

## 🎯 Summary

| System | Install | Start | Stop |
|--------|---------|-------|------|
| **Windows** | Installer exe | Services UI | Services UI |
| **macOS** | brew install | brew services start | brew services stop |
| **Linux** | apt install | systemctl start | systemctl stop |

---

## 🚀 Next Steps

1. ✅ PostgreSQL cài xong
2. ✅ Database `elysia_db` tạo xong
3. ✅ `.env` file cập nhật
4. Chạy: `bun install`
5. Chạy: `bun run dev`
6. Test: `curl http://localhost:3000/health`

---

**Prefer Docker?** → Read `LOCAL_DATABASE_SETUP.md`
