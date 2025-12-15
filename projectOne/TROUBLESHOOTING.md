# 🔧 Troubleshooting Guide

## Common Issues & Solutions

### 1. TypeScript Decorator Errors

**Error:** "Unable to resolve signature of property decorator when called as an expression"

**Solution:** This is already fixed! The project now has:
- ✅ `experimentalDecorators: true` in tsconfig.json
- ✅ `emitDecoratorMetadata: true` in tsconfig.json
- ✅ `import 'reflect-metadata'` at top of files
- ✅ `@types/bun` for Bun type definitions

---

### 2. Module Not Found Errors

**Error:** "Cannot find module 'typeorm'"

**Solution:**
```bash
# Reinstall dependencies
bun install

# Clear cache and reinstall
rm -rf node_modules bun.lockb
bun install
```

---

### 3. Database Connection Failed

**Error:** "connect ECONNREFUSED 127.0.0.1:5432"

**Solution:**
```bash
# Ensure PostgreSQL is running with Docker
docker-compose up -d

# Verify container is running
docker-compose ps

# Check logs
docker-compose logs postgres

# Wait a moment for database to be ready
sleep 5
bun run dev
```

---

### 4. Port Already in Use

**Error:** "listen EADDRINUSE :::3000"

**Solution A:** Change port in .env
```env
PORT=3001
```

**Solution B:** Kill process on port 3000
```bash
# On Mac/Linux
lsof -ti:3000 | xargs kill -9

# On Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

---

### 5. Environment Variables Not Loaded

**Error:** Database connection fails even with .env file

**Solution:**
- Ensure `.env` file exists in project root
- Verify format: `KEY=VALUE` (no spaces)
- Restart development server after changing .env

```bash
# Check current environment
bun eval "console.log(Bun.env)"

# Or check specific var
bun eval "console.log(Bun.env.DB_HOST)"
```

---

### 6. TypeScript Errors in IDE

**Issue:** Red squiggly lines in editor but code runs fine

**Solution:**
```bash
# Run type check
bun run type-check

# Update TypeScript in editor
# VS Code: Cmd+Shift+P → TypeScript: Select Version → Use Workspace Version
```

---

### 7. Migration Errors

**Error:** "Migration not found"

**Solution:**
```bash
# Show migration status
bun typeorm migration:show -d src/database/connection.ts

# Reset database (careful!)
bun typeorm migration:revert -d src/database/connection.ts

# Rerun migrations
bun typeorm migration:run -d src/database/connection.ts
```

---

### 8. CORS Issues

**Error:** "Access to XMLHttpRequest blocked by CORS policy"

**Solution:** CORS is already configured in the project. If still having issues:

```typescript
// src/config/constants.ts
export const CORS_OPTIONS = {
  origin: '*',  // Change to specific domain in production
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
};
```

---

### 9. Hot Reload Not Working

**Error:** Changes not reflected when running `bun run dev`

**Solution:**
```bash
# Use --watch flag explicitly
bun run --watch src/index.ts

# Or restart
Ctrl+C
bun run dev
```

---

### 10. Docker Build Fails

**Error:** Docker build fails with TypeScript errors

**Solution:**
```bash
# Fix TypeScript errors first
bun run type-check

# Ensure all dependencies installed
bun install

# Then build
docker build -t elysia-app .
```

---

## Verification Checklist

Run these commands to verify setup:

```bash
# ✓ Check Bun
bun --version

# ✓ Check Node modules
ls -la node_modules | wc -l

# ✓ Type checking
bun run type-check

# ✓ Linting
bun run lint

# ✓ Database connection
docker-compose up -d
sleep 3
docker-compose ps

# ✓ Start server
bun run dev

# ✓ Test API
curl http://localhost:3000/health
```

---

## Testing the API

### Using curl
```bash
# Health check
curl http://localhost:3000/health

# Get all users
curl http://localhost:3000/api/v1/users

# Create user
curl -X POST http://localhost:3000/api/v1/users \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","email":"test@example.com"}'

# Get user by ID
curl http://localhost:3000/api/v1/users/{id}

# Update user
curl -X PUT http://localhost:3000/api/v1/users/{id} \
  -H "Content-Type: application/json" \
  -d '{"name":"Updated"}'

# Delete user
curl -X DELETE http://localhost:3000/api/v1/users/{id}
```

### Using VS Code REST Client

Create `requests.rest`:
```rest
### Health Check
GET http://localhost:3000/health

### Get All Users
GET http://localhost:3000/api/v1/users

### Create User
POST http://localhost:3000/api/v1/users
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com"
}

### Get User
GET http://localhost:3000/api/v1/users/{id}

### Update User
PUT http://localhost:3000/api/v1/users/{id}
Content-Type: application/json

{
  "name": "Jane Doe",
  "email": "jane@example.com"
}

### Delete User
DELETE http://localhost:3000/api/v1/users/{id}
```

---

## Performance Optimization

### Development Performance
```bash
# Use faster build
bun run build

# Profile code
bun --prof src/index.ts
```

### Production Optimization
```typescript
// In src/index.ts
app.listen(config.port, () => {
  // Use console directly in production (faster than logger)
  console.log(`🚀 Server running on port ${config.port}`);
});
```

---

## Security Checks

Before deploying:

```bash
# ✓ Check for exposed secrets
grep -r "password" src/ --include="*.ts" | grep -v ".env"

# ✓ Verify environment variables
cat .env | grep -v "^#"

# ✓ Check dependencies for vulnerabilities
bun outdated
```

---

## Debug Mode

Enable detailed logging:

```typescript
// src/config/env.ts
export const config = {
  // ... existing config
  debug: Bun.env.DEBUG === 'true',
};

// Use in services
if (config.debug) {
  console.log('Debug:', data);
}
```

Run with debug:
```bash
DEBUG=true bun run dev
```

---

## Database Debugging

### Connect to PostgreSQL directly
```bash
# Via Docker container
docker-compose exec postgres psql -U postgres -d elysia_db

# Or via local psql
psql -h localhost -U postgres -d elysia_db
```

### Common SQL queries
```sql
-- List tables
\dt

-- Describe users table
\d users

-- Show all users
SELECT * FROM users;

-- Delete all users
TRUNCATE users CASCADE;

-- Check migrations
SELECT * FROM typeorm_metadata;
```

---

## Logs Inspection

### View Docker logs
```bash
docker-compose logs postgres      # Database logs
docker-compose logs -f            # Follow all logs
```

### View application logs
```bash
# Logs appear in terminal when running
bun run dev

# Or check system logs
tail -f /var/log/syslog
```

---

## Reset Everything

If things are broken:

```bash
# Stop services
docker-compose down -v

# Clean node_modules
rm -rf node_modules bun.lockb

# Reinstall
bun install

# Restart database
docker-compose up -d

# Verify
docker-compose ps
```

---

## Additional Resources

- 📖 [SETUP.md](SETUP.md) - Setup guide
- 📖 [GUIDE.md](GUIDE.md) - Comprehensive guide
- 📖 [README.md](README.md) - Feature documentation
- 📖 [QUICK_REFERENCE.md](QUICK_REFERENCE.md) - Command reference
- 🔗 [Bun Docs](https://bun.sh/docs)
- 🔗 [Elysia Docs](https://elysiajs.com)
- 🔗 [TypeORM Docs](https://typeorm.io)

---

## Still Having Issues?

1. Check all error messages carefully
2. Verify all prerequisites are installed
3. Read the documentation files
4. Check Docker container health
5. Try resetting everything (see above)
6. Verify network connectivity

---

**Last Updated:** 12 December 2025  
**Version:** 1.0.0
