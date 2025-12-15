# Quick Start - Local Database (3 phút)

## 🚀 Setup Nhanh Nhất

### Linux/Mac
```bash
# 1. Chạy setup script
chmod +x setup-db.sh
./setup-db.sh

# 2. Install dependencies
bun install

# 3. Start server
bun run dev

# ✅ Done! Server chạy trên http://localhost:3000
```

### Windows
```bash
# 1. Chạy setup script
setup-db.bat

# 2. Install dependencies
bun install

# 3. Start server
bun run dev

# ✅ Done! Server chạy trên http://localhost:3000
```

---

## ✅ Kiểm Tra Setup

### Database chạy?
```bash
docker-compose ps
# Output: elysia_postgres UP (healthy) ✅
```

### Server chạy?
```bash
curl http://localhost:3000/health
# Output: {"success":true,"message":"Server is running"} ✅
```

### Database có data?
```bash
docker-compose exec postgres psql -U postgres -d elysia_db -c "SELECT COUNT(*) FROM users;"
```

---

## 🧪 Test API

### Create User
```bash
curl -X POST http://localhost:3000/api/v1/users \
  -H "Content-Type: application/json" \
  -d '{"name":"John","email":"john@example.com"}'
```

### List Users (with token)
```bash
TOKEN=$(echo -n "user-id:john@example.com:John:user" | base64)
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/v1/users
```

---

## 🛑 Stop Database

```bash
# Dừng nhưng giữ data
docker-compose stop

# Khởi động lại
docker-compose start

# Dừng + xóa data
docker-compose down -v
```

---

## 🆘 Troubleshoot

### Port 5432 đang sử dụng?
```bash
# Kill process
lsof -ti:5432 | xargs kill -9

# Hoặc dùng port khác trong docker-compose.yml
# ports: ["5433:5432"]
```

### Cannot connect database?
```bash
# Check logs
docker-compose logs postgres

# Restart
docker-compose restart postgres

# Wait 5 seconds and test again
```

### Database không có tables?
```bash
# Start Bun server (auto-creates tables)
bun run dev

# Hoặc check connection
docker-compose exec postgres psql -U postgres -d elysia_db -c "\dt"
```

---

## 📚 Tài Liệu Đầy Đủ

📖 **LOCAL_DATABASE_SETUP.md** - Hướng dẫn chi tiết (20 phút)

Đọc để học:
- Docker Compose advanced
- Backup & restore
- GUI tools (DBeaver, pgAdmin)
- Database management
- Advanced troubleshooting

---

## 🎯 Files

- `docker-compose.yml` - Docker Compose config
- `.env` - Environment variables (tạo từ .env.example)
- `setup-db.sh` - Setup script (Linux/Mac)
- `setup-db.bat` - Setup script (Windows)
- `LOCAL_DATABASE_SETUP.md` - Tài liệu đầy đủ

---

**Time to Setup:** ⏱️ 3 phút  
**Ready to Code:** ✅ Yes!
