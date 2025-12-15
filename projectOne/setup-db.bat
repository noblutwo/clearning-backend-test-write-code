@echo off
REM Local Database Setup Script for Windows
REM Tự động setup PostgreSQL database chạy trên máy local

setlocal enabledelayedexpansion

echo.
echo ╔═══════════════════════════════════════════════════════════╗
echo ║                                                           ║
echo ║      🚀 Local Database Setup for Elysia Backend          ║
echo ║                                                           ║
echo ╚═══════════════════════════════════════════════════════════╝
echo.

REM Step 1: Check Docker
echo 📦 Step 1: Checking Docker installation...
docker --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Docker is not installed!
    echo    Install from: https://www.docker.com/products/docker-desktop
    pause
    exit /b 1
)

docker-compose --version >nul 2>&1
if errorlevel 1 (
    echo ❌ docker-compose is not installed!
    echo    Install from: https://docs.docker.com/compose/install/
    pause
    exit /b 1
)

echo ✅ Docker is installed
echo ✅ Docker Compose is installed
echo.

REM Step 2: Create .env file
echo 📝 Step 2: Creating .env file...
if exist .env (
    echo    ⚠️  .env already exists, skipping...
) else (
    if exist .env.example (
        copy .env.example .env >nul
        echo ✅ .env created from .env.example
    ) else (
        echo ❌ .env.example not found!
        pause
        exit /b 1
    )
)
echo.

REM Step 3: Stop existing containers
echo 🛑 Step 3: Stopping existing containers...
docker-compose down >nul 2>&1
echo ✅ Done
echo.

REM Step 4: Remove old volumes
echo 🗑️  Step 4: Cleaning old data...
docker-compose down -v >nul 2>&1
echo ✅ Old data cleaned
echo.

REM Step 5: Start PostgreSQL
echo 🐘 Step 5: Starting PostgreSQL container...
docker-compose up -d postgres
if errorlevel 1 (
    echo ❌ Failed to start PostgreSQL
    pause
    exit /b 1
)
echo ✅ PostgreSQL started
echo.

REM Step 6: Wait for database
echo ⏳ Step 6: Waiting for database to be ready...
timeout /t 5 /nobreak
echo ✅ Database should be ready
echo.

REM Step 7: Show connection details
echo 📋 Step 7: Database connection details:
echo    ┌─────────────────────────────────┐
echo    │ Database: elysia_db             │
echo    │ Host: localhost                 │
echo    │ Port: 5432                      │
echo    │ User: postgres                  │
echo    │ Password: postgres              │
echo    └─────────────────────────────────┘
echo.

REM Step 8: Summary
echo ╔═══════════════════════════════════════════════════════════╗
echo ║                   ✅ SETUP COMPLETE!                     ║
echo ╚═══════════════════════════════════════════════════════════╝
echo.
echo 🚀 Next steps:
echo.
echo    1. Install Bun dependencies:
echo       bun install
echo.
echo    2. Start the development server:
echo       bun run dev
echo.
echo    3. Test the API:
echo       curl http://localhost:3000/health
echo.
echo    4. Create a test user:
echo       curl -X POST http://localhost:3000/api/v1/users ^
echo         -H "Content-Type: application/json" ^
echo         -d "{\"name\":\"Test User\",\"email\":\"test@example.com\"}"
echo.
echo 📚 Documentation:
echo    Read: LOCAL_DATABASE_SETUP.md for detailed guide
echo.
echo 💾 Database management:
echo    Stop:   docker-compose down
echo    Restart: docker-compose restart postgres
echo    Logs:   docker-compose logs -f postgres
echo.
echo 🗑️  Clean everything:
echo    docker-compose down -v
echo.

pause
