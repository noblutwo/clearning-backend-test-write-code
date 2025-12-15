#!/bin/bash

# Local Database Setup Script
# Tự động setup PostgreSQL database chạy trên máy local

set -e  # Exit on error

echo ""
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║                                                           ║"
echo "║      🚀 Local Database Setup for Elysia Backend          ║"
echo "║                                                           ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""

# Step 1: Check Docker
echo "📦 Step 1: Checking Docker installation..."
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed!"
    echo "   Install from: https://www.docker.com/products/docker-desktop"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ docker-compose is not installed!"
    echo "   Install from: https://docs.docker.com/compose/install/"
    exit 1
fi

echo "✅ Docker version: $(docker --version)"
echo "✅ Docker Compose version: $(docker-compose --version)"
echo ""

# Step 2: Create .env file
echo "📝 Step 2: Creating .env file..."
if [ -f .env ]; then
    echo "   ⚠️  .env already exists, skipping..."
else
    if [ -f .env.example ]; then
        cp .env.example .env
        echo "✅ .env created from .env.example"
    else
        echo "❌ .env.example not found!"
        exit 1
    fi
fi
echo ""

# Step 3: Stop existing containers
echo "🛑 Step 3: Stopping existing containers..."
docker-compose down 2>/dev/null || true
echo "✅ Done"
echo ""

# Step 4: Remove old volumes (optional)
echo "🗑️  Step 4: Cleaning old data..."
docker-compose down -v 2>/dev/null || true
echo "✅ Old data cleaned"
echo ""

# Step 5: Start PostgreSQL
echo "🐘 Step 5: Starting PostgreSQL container..."
docker-compose up -d postgres
echo "✅ PostgreSQL started"
echo ""

# Step 6: Wait for database to be ready
echo "⏳ Step 6: Waiting for database to be ready..."
for i in {1..30}; do
    if docker-compose exec postgres pg_isready -U postgres &> /dev/null; then
        echo "✅ Database is ready!"
        break
    fi
    echo "   Waiting... ($i/30)"
    sleep 1
done
echo ""

# Step 7: Verify connection
echo "🔍 Step 7: Verifying database connection..."
if docker-compose exec postgres psql -U postgres -d elysia_db -c "SELECT 1;" &> /dev/null; then
    echo "✅ Database connection successful!"
else
    echo "⚠️  Database might not be fully initialized yet, but container is running"
fi
echo ""

# Step 8: Show connection details
echo "📋 Step 8: Database connection details:"
echo "   ┌─────────────────────────────────┐"
echo "   │ Database: elysia_db             │"
echo "   │ Host: localhost                 │"
echo "   │ Port: 5432                      │"
echo "   │ User: postgres                  │"
echo "   │ Password: postgres              │"
echo "   └─────────────────────────────────┘"
echo ""

# Step 9: Summary
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║                   ✅ SETUP COMPLETE!                     ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""
echo "🚀 Next steps:"
echo ""
echo "   1. Install Bun dependencies:"
echo "      $ bun install"
echo ""
echo "   2. Start the development server:"
echo "      $ bun run dev"
echo ""
echo "   3. Test the API:"
echo "      $ curl http://localhost:3000/health"
echo ""
echo "   4. Create a test user:"
echo "      $ curl -X POST http://localhost:3000/api/v1/users \\"
echo "        -H 'Content-Type: application/json' \\"
echo "        -d '{\"name\":\"Test User\",\"email\":\"test@example.com\"}'"
echo ""
echo "📚 Documentation:"
echo "   Read: LOCAL_DATABASE_SETUP.md for detailed guide"
echo ""
echo "💾 Database management:"
echo "   Stop:   docker-compose down"
echo "   Restart: docker-compose restart postgres"
echo "   Logs:   docker-compose logs -f postgres"
echo ""
echo "🗑️  Clean everything:"
echo "   docker-compose down -v"
echo ""
